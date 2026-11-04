import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Search, X, LoaderCircle, CheckCircle, ChevronRight } from "lucide-react";
import { C, DAYS, MENU_FLOORS, EXCLUDE, displayName } from "../lib/constants";
import { GESTURES, RELAY_URL } from "../lib/config";
import { loadData } from "../lib/data";
import { search } from "../lib/directory";

const JS_DAY_TO_ID = ["", ...DAYS, ""];
const TODAY = JS_DAY_TO_ID[new Date().getDay()] || null;

function CameraControls({ send }) {
  const ptrs    = useRef(new Map()); // pointerId → {x, y}
  const pending = useRef(null);      // accumulated transform waiting for rAF flush
  const rafId   = useRef(null);

  const vals    = () => [...ptrs.current.values()];
  const getMid  = () => ({ x: (vals()[0].x + vals()[1].x) / 2, y: (vals()[0].y + vals()[1].y) / 2 });
  const getDist = () => { const [a, b] = vals(); return Math.hypot(b.x - a.x, b.y - a.y); };

  const scheduleTransform = ({ panDx = 0, panDy = 0, rotateDx = 0, rotateDy = 0, zoom = 1 }) => {
    if (!pending.current) pending.current = { panDx: 0, panDy: 0, rotateDx: 0, rotateDy: 0, zoom: 1 };
    pending.current.panDx    += panDx;
    pending.current.panDy    += panDy;
    pending.current.rotateDx += rotateDx;
    pending.current.rotateDy += rotateDy;
    pending.current.zoom     *= zoom;
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        send("cameraTransform", pending.current);
        pending.current = null;
        rafId.current   = null;
      });
    }
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const count = ptrs.current.size;

    if (count === 1) {
      const prev = ptrs.current.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        if (GESTURES === "map") scheduleTransform({ panDx: dx, panDy: dy });
        else send("cameraRotate", { dx, dy });
      }
    } else if (count === 2) {
      const oldMid  = getMid();
      const oldDist = getDist();
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const newMid  = getMid();
      const newDist = getDist();

      const dx   = newMid.x - oldMid.x;
      const dy   = newMid.y - oldMid.y;
      const zoom = oldDist > 1 ? oldDist / newDist : 1;
      if (GESTURES === "map") scheduleTransform({ rotateDx: dx, rotateDy: dy, zoom });
      else scheduleTransform({ panDx: dx, panDy: dy, zoom });
    }
  };

  const onPointerUp = (e) => { ptrs.current.delete(e.pointerId); };

  return (
    <div style={{
      borderTop: `1px solid ${C.border}`,
      background: C.card,
      padding: "12px 16px 24px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      flexShrink: 0,
    }}>
      <p style={{ fontSize: "9px", letterSpacing: "2px", color: C.cyan, margin: 0, textTransform: "uppercase", textShadow: `0 0 8px ${C.cyan}` }}>
        Kontrol Kamera
      </p>

      {/* Touch pad: gestures follow GESTURES, chosen on the kiosk */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          height: "180px",
          background: C.cyanDim,
          border: `1px solid ${C.cyan}`,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "none",
          userSelect: "none",
          cursor: "grab",
        }}
      >
        <span style={{ color: "#ffffff", fontSize: "11px", letterSpacing: "1.5px", pointerEvents: "none", textTransform: "uppercase" }}>
          {GESTURES === "map" ? "1 finger: pan  ·  2 fingers: rotate / pinch" : "1 finger: rotate  ·  2 fingers: pan / pinch"}
        </span>
      </div>

      {/* Reset row */}
      <button
        onClick={() => send("cameraReset")}
        style={{
          width: "100%",
          padding: "14px 0",
          background: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          color: C.sub,
          fontSize: "10px",
          letterSpacing: "1.5px",
          cursor: "pointer",
          fontFamily: "'DM Mono', monospace",
          textTransform: "uppercase",
        }}
      >Reset View</button>
    </div>
  );
}

export default function MobileControl() {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get("sid");

  const wsRef          = useRef(null);
  const searchTimerRef = useRef(null);
  const activeRoomRef  = useRef(null);
  const [connected,     setConnected]     = useState(false);
  const [tvView,        setTvView]        = useState("floors");
  const [tvFloor,       setTvFloor]       = useState(null);
  const [tvRooms,       setTvRooms]       = useState([]);
  const [query,         setQuery]         = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedRoom,  setSelectedRoom]  = useState(null);
  const [awaitingRooms, setAwaitingRooms] = useState(false);

  const disconnect = () => wsRef.current?.close();

  useEffect(() => {
    if (!sid || !RELAY_URL) return;
    const ws = new WebSocket(`${RELAY_URL}/ws?role=phone&sid=${encodeURIComponent(sid)}`);
    wsRef.current = ws;
    ws.onopen    = () => setConnected(true);
    ws.onclose   = () => setConnected(false);
    ws.onerror   = () => setConnected(false);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "state") {
        setTvView(msg.view);
        setTvFloor(msg.activeFloor);
        setTvRooms(msg.rooms || []);
        if (msg.view === "rooms") setAwaitingRooms(false);
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    activeRoomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedRoom, tvView, awaitingRooms]);

  // Fetch the data while the visitor is still reading the screen, so the
  // first search does not wait on the network.
  useEffect(() => { loadData().catch(() => {}); }, []);

  // Debounced search — fires 200 ms after the user stops typing
  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(() => {
      loadData()
        .then((data) => { setSearchResults(search(data, query, TODAY)); setSearchLoading(false); })
        .catch(() => { setSearchResults([]); setSearchLoading(false); });
    }, 200);
    return () => clearTimeout(searchTimerRef.current);
  }, [query]);

  const send = (action, payload) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "cmd", action, payload }));
    }
  };

  const btnStyle = (active, accent) => ({
    width: "100%",
    padding: "16px 20px",
    borderRadius: "10px",
    fontSize: "15px",
    cursor: "pointer",
    textAlign: "left",
    letterSpacing: "0.5px",
    fontFamily: "'DM Mono', monospace",
    transition: "all 0.15s",
    background: active ? (accent === "cyan" ? C.cyanDim : C.blueDim) : C.card,
    border: `1px solid ${active ? (accent === "cyan" ? C.cyan : C.blue) : C.border}`,
    borderLeft: `4px solid ${active ? (accent === "cyan" ? C.cyan : C.blue) : "transparent"}`,
    color: active ? (accent === "cyan" ? C.cyan : C.blue) : C.text,
    boxShadow: active ? (accent === "cyan" ? C.cyanGlow : C.blueGlow) : "none",
  });

  if (!connected) return (
    <div style={{ height: "100dvh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", padding: "20px", gap: "12px" }}>
      {!sid ? (
        <>
          <LoaderCircle size={28} style={{ opacity: 0.3 }} />
          <p style={{ color: C.sub, fontSize: "13px", letterSpacing: "1px", margin: 0, textAlign: "center" }}>
            URL tidak valid. Scan ulang QR code.
          </p>
        </>
      ) : (
        <>
          <CheckCircle size={28} style={{ opacity: 0.4 }} />
          <p style={{ color: C.sub, fontSize: "13px", letterSpacing: "1px", margin: 0, textAlign: "center" }}>
            Sesi berakhir.
          </p>
          <p style={{ color: C.muted, fontSize: "11px", letterSpacing: "1px", margin: 0, textAlign: "center" }}>
            Scan QR code di layar TV untuk sesi baru.
          </p>
        </>
      )}
    </div>
  );

  const rooms = tvRooms.filter(n => !EXCLUDE.test(n));

  return (
    <div style={{ height: "100dvh", background: C.bg, fontFamily: "'DM Mono', monospace", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, borderTop: `2px solid ${C.cyan}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "8px", letterSpacing: "3px", color: "#ffffff", textTransform: "uppercase", margin: "0 0 2px" }}>Teknik Informatika</p>
          <p style={{ fontSize: "18px", fontWeight: "700", margin: 0, letterSpacing: "2px", textShadow: `0 0 16px ${C.cyan}` }}>
            <span style={{ color: C.cyan }}>IF </span>
            <span style={{ color: C.cyan }}>Kiosk</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.green, boxShadow: C.greenGlow, flexShrink: 0 }} />
            <span style={{ fontSize: "10px", color: C.green, letterSpacing: "1px" }}>Terhubung</span>
          </div>
          <button onClick={disconnect} style={{
            background: "transparent",
            border: "1px solid rgba(255,60,80,0.35)",
            borderRadius: "6px",
            padding: "5px 10px",
            color: "rgba(255,100,120,0.8)",
            fontSize: "10px",
            letterSpacing: "1px",
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
            textTransform: "uppercase",
          }}>
            Selesai
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: "10px 16px 0", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search size={20} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari ruangan, mata kuliah, dosen..."
            style={{
              width: "100%", boxSizing: "border-box",
              background: C.card, border: `1px solid ${query ? C.cyan : C.border}`,
              borderRadius: "8px", padding: "11px 36px 11px 46px",
              color: C.text, fontSize: "13px", fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.3px", outline: "none",
              boxShadow: query ? C.cyanGlow : "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}><X size={18} /></button>
          )}
        </div>
      </div>

      {/* Scrollable content: search results OR floor/room list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>

        {/* ── Search results ── */}
        {query.trim().length >= 2 && (
          <>
            {searchLoading && (
              <p style={{ fontSize: "11px", color: C.cyan, letterSpacing: "1px", margin: "8px 0" }}>
                <LoaderCircle size={14} style={{ animation: "spin 1s linear infinite" }} /> Mencari...
              </p>
            )}
            {!searchLoading && searchResults.length === 0 && (
              <p style={{ fontSize: "11px", color: C.muted, letterSpacing: "1px", textAlign: "center", marginTop: "24px" }}>
                Tidak ada hasil.
              </p>
            )}
            {!searchLoading && searchResults.map((item, i) => {
              const floor = item.lantai ?? null;
              const isDosen = item.result_type === "dosen";
              const isRoom  = item.result_type === "room";
              const accentColor = isDosen ? C.cyan : C.blue;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedRoom(item.room_name);
                    if (floor && (tvView !== "rooms" || tvFloor !== floor)) {
                      setAwaitingRooms(true);
                      send("selectFloorAndRoom", { floor, room: item.room_name });
                    } else {
                      send("selectRoom", item.room_name);
                    }
                    setQuery("");
                  }}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer",
                    background: C.card, border: `1px solid ${C.border}`,
                    borderLeft: `4px solid ${accentColor}`, borderRadius: "10px",
                    padding: "12px 14px", fontFamily: "'DM Mono', monospace",
                    display: "flex", flexDirection: "column", gap: "5px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: accentColor, letterSpacing: "0.5px" }}>
                      {displayName(item.room_name)}
                    </span>
                    {floor && (
                      <span style={{ fontSize: "10px", color: C.muted, letterSpacing: "1px", flexShrink: 0 }}>{floor}</span>
                    )}
                  </div>

                  {isRoom ? null : isDosen ? (
                    item.occupants?.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {item.occupants.map((name, j) => (
                          <span key={j} style={{ fontSize: "11px", color: C.sub, display: "inline-flex", alignItems: "center", gap: "2px" }}>
                            <ChevronRight size={12} /> {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "12px", color: C.sub, letterSpacing: "0.5px" }}>
                        {item.keterangan || displayName(item.room_name)}
                      </span>
                    )
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {item.class_code && (
                          <span style={{ fontSize: "10px", color: C.cyan, background: C.cyanDim, border: `1px solid ${C.cyan}`, borderRadius: "4px", padding: "1px 6px", letterSpacing: "0.5px" }}>
                            {item.class_code}
                          </span>
                        )}
                        <span style={{ fontSize: "13px", color: C.text, letterSpacing: "0.3px" }}>{item.mata_kuliah}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {item.nama_dosen && (
                          <span style={{ fontSize: "11px", color: C.text, display: "inline-flex", alignItems: "center", gap: "2px" }}><ChevronRight size={12} /> {item.nama_dosen}</span>
                        )}
                        {item.nama_dosen_2 && (
                          <span style={{ fontSize: "11px", color: C.text, display: "inline-flex", alignItems: "center", gap: "2px" }}><ChevronRight size={12} /> {item.nama_dosen_2}</span>
                        )}
                        {item.nama_dosen_3 && (
                          <span style={{ fontSize: "11px", color: C.text, display: "inline-flex", alignItems: "center", gap: "2px" }}><ChevronRight size={12} /> {item.nama_dosen_3}</span>
                        )}
                        <span style={{ fontSize: "10px", color: C.muted, marginLeft: "auto" }}>
                          {item.jam_mulai}–{item.jam_selesai}
                        </span>
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </>
        )}

        {/* ── Normal floor / room list (hidden while searching) ── */}
        {query.trim().length < 2 && (
          <>
            {tvView === "rooms" && (
              <button onClick={() => { setAwaitingRooms(false); send("back"); }} style={{
                padding: "12px 16px", background: "transparent",
                border: `1px solid ${C.border}`, borderRadius: "8px",
                color: C.sub, fontSize: "14px", cursor: "pointer",
                textAlign: "left", letterSpacing: "0.5px",
                fontFamily: "'DM Mono', monospace", width: "100%",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                <ArrowLeft size={22} strokeWidth={2.5} /> Kembali
              </button>
            )}

            <div>
              <p style={{ fontSize: "10px", letterSpacing: "2px", color: C.cyan, margin: "0 0 4px", textTransform: "uppercase", textShadow: `0 0 8px ${C.cyan}` }}>
                {tvView === "floors" ? "Pilih Lantai" : (tvFloor || "Ruangan")}
              </p>
{tvView === "rooms" && (
                <p style={{ fontSize: "11px", color: C.sub, letterSpacing: "0.3px", margin: "4px 0 0", fontStyle: "italic" }}>
                  Pilih salah satu ruangan untuk menyorotnya di layar utama
                </p>
              )}
            </div>

            {tvView === "floors" && !awaitingRooms && MENU_FLOORS.map((f) => (
              <button key={f} onClick={() => { setSelectedRoom(null); setAwaitingRooms(true); send("selectFloor", f); }} style={btnStyle(tvFloor === f, "cyan")}>
                {f}
              </button>
            ))}

            {tvView === "floors" && awaitingRooms && (
              <p style={{ fontSize: "12px", color: C.cyan, letterSpacing: "1px", textAlign: "center", marginTop: "24px", textShadow: `0 0 8px ${C.cyan}` }}>
                <LoaderCircle size={14} style={{ animation: "spin 1s linear infinite", display: "inline-block" }} /> Memuat lantai...
              </p>
            )}

            {tvView === "rooms" && rooms.length === 0 && (
              <p style={{ fontSize: "12px", color: C.muted, letterSpacing: "0.5px" }}>Tidak ada ruangan terdeteksi.</p>
            )}
            {tvView === "rooms" && rooms.map((name) => (
              <button key={name} ref={selectedRoom === name ? activeRoomRef : null}
                onClick={() => { setSelectedRoom(name); send("selectRoom", name); }}
                style={btnStyle(selectedRoom === name, "cyan")}>
                {displayName(name)}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Camera controls — always visible at bottom */}
      <CameraControls send={send} />
    </div>
  );
}
