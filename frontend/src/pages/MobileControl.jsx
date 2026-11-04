import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Search, X, LoaderCircle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { C, DAYS, MENU_FLOORS, EXCLUDE, displayName } from "../lib/constants";
import { RELAY_URL } from "../lib/config";
import { loadData } from "../lib/data";
import { search } from "../lib/directory";
import { HelpButton } from "../components/HelpButton";

const JS_DAY_TO_ID = ["", ...DAYS, ""];
const TODAY = JS_DAY_TO_ID[new Date().getDay()] || null;

// Drone controls, in pixels per second at full deflection, the same pixels the
// kiosk's camera moves take.
const WALK_PX_PER_S = 110;
const LIFT_PX_PER_S = 90;
const STICK_SIZE    = 132;
const THUMB_SIZE    = 56;
const DEADZONE      = 0.12;

const noSelect = { touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" };

/** Whether to lay the controls out for a phone held sideways. */
function useLandscape() {
  const read = () => window.innerWidth > window.innerHeight;
  const [landscape, setLandscape] = useState(read);
  useEffect(() => {
    // The on-screen keyboard shrinks the page; that is not a turned phone.
    const onChange = () => { if (document.activeElement?.tagName !== "INPUT") setLandscape(read()); };
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    window.addEventListener("focusout", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      window.removeEventListener("focusout", onChange);
    };
  }, []);
  return landscape;
}

/** Moves the camera every frame while the joystick or a lift button is held. */
function useDroneLoop(send) {
  const stick = useRef({ x: 0, y: 0 });
  const lift  = useRef({ up: false, down: false });
  const loop  = useRef(null);
  const last  = useRef(0);

  useEffect(() => () => { cancelAnimationFrame(loop.current); loop.current = null; }, []);

  const tick = (now) => {
    const dt = Math.min((now - last.current) / 1000, 0.1);
    last.current = now;
    const { x, y } = stick.current;
    const rise = (lift.current.up ? 1 : 0) - (lift.current.down ? 1 : 0);
    if (!x && !y && !rise) { loop.current = null; return; }
    send("cameraTransform", {
      // The camera goes where the stick points; walkBy takes finger drags, which
      // move the model the opposite way.
      walkDx: -x * WALK_PX_PER_S * dt,
      walkDy: -y * WALK_PX_PER_S * dt,
      lift: rise * LIFT_PX_PER_S * dt,
    });
    loop.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (loop.current) return;
    last.current = performance.now();
    loop.current = requestAnimationFrame(tick);
  };

  return {
    setStick: (x, y) => { stick.current = { x, y }; if (x || y) start(); },
    setUp:    (on) => { lift.current.up = on; if (on) start(); },
    setDown:  (on) => { lift.current.down = on; if (on) start(); },
  };
}

function Joystick({ onChange }) {
  const thumb = useRef(null);
  const active = useRef(null);
  const reach = (STICK_SIZE - THUMB_SIZE) / 2;

  const update = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - (box.left + box.width / 2);
    const y = e.clientY - (box.top + box.height / 2);
    const len = Math.hypot(x, y);
    const held = Math.min(len, reach);
    const nx = len ? x / len : 0;
    const ny = len ? y / len : 0;
    if (thumb.current) thumb.current.style.transform = `translate(${nx * held}px, ${ny * held}px)`;
    const mag = held / reach;
    // Past the dead zone, grow slowly at first for fine moves near a room.
    const power = mag < DEADZONE ? 0 : ((mag - DEADZONE) / (1 - DEADZONE)) ** 1.5;
    onChange(nx * power, ny * power);
  };

  const release = (e) => {
    if (e.pointerId !== active.current) return;
    active.current = null;
    if (thumb.current) thumb.current.style.transform = "translate(0, 0)";
    onChange(0, 0);
  };

  const arrow = { position: "absolute", color: "#ffffff", opacity: 0.55, pointerEvents: "none" };

  return (
    <div
      role="application"
      aria-label="Joystick: maju, mundur, kiri, kanan"
      onPointerDown={(e) => {
        if (active.current !== null) return;
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => { if (e.pointerId === active.current) update(e); }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        ...noSelect,
        position: "relative", width: `${STICK_SIZE}px`, height: `${STICK_SIZE}px`, flexShrink: 0,
        borderRadius: "50%", background: C.cyanDim, border: `1px solid ${C.cyan}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <ChevronUp    size={16} style={{ ...arrow, top: "3px" }} />
      <ChevronDown  size={16} style={{ ...arrow, bottom: "3px" }} />
      <ChevronLeft  size={16} style={{ ...arrow, left: "3px" }} />
      <ChevronRight size={16} style={{ ...arrow, right: "3px" }} />
      <div ref={thumb} style={{
        width: `${THUMB_SIZE}px`, height: `${THUMB_SIZE}px`, borderRadius: "50%",
        background: C.cyan, boxShadow: C.cyanGlow, pointerEvents: "none",
      }} />
    </div>
  );
}

function LiftButton({ label, symbol, onHold }) {
  const release = () => onHold(false);
  return (
    <button
      aria-label={label}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onHold(true); }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        ...noSelect,
        flex: 1, width: "52px", minHeight: "48px", borderRadius: "10px", background: C.cyanDim,
        border: `1px solid ${C.cyan}`, color: "#ffffff", fontSize: "20px", cursor: "pointer",
      }}
    >
      {symbol}
    </button>
  );
}

function LookPad({ send }) {
  const ptrs    = useRef(new Map()); // pointerId → {x, y}
  const pending = useRef(null);      // accumulated transform waiting for rAF flush
  const rafId   = useRef(null);

  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  const vals    = () => [...ptrs.current.values()];
  const getMid  = () => ({ x: (vals()[0].x + vals()[1].x) / 2, y: (vals()[0].y + vals()[1].y) / 2 });
  const getDist = () => { const [a, b] = vals(); return Math.hypot(b.x - a.x, b.y - a.y); };

  const schedule = ({ lookDx = 0, lookDy = 0, zoom = 1 }) => {
    if (!pending.current) pending.current = { lookDx: 0, lookDy: 0, zoom: 1 };
    pending.current.lookDx += lookDx;
    pending.current.lookDy += lookDy;
    pending.current.zoom   *= zoom;
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        send("cameraTransform", pending.current);
        pending.current = null;
        rafId.current   = null;
      });
    }
  };

  const onPointerMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const count = ptrs.current.size;

    if (count === 1) {
      const prev = ptrs.current.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) schedule({ lookDx: dx, lookDy: dy });
    } else if (count === 2) {
      const oldDist = getDist();
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const newDist = getDist();
      schedule({ zoom: oldDist > 1 && newDist > 1 ? oldDist / newDist : 1 });
    }
  };

  const onPointerUp = (e) => { ptrs.current.delete(e.pointerId); };

  return (
    <div
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        ...noSelect,
        flex: 1, minWidth: 0, minHeight: `${STICK_SIZE}px`, background: C.cyanDim,
        border: `1px solid ${C.cyan}`, borderRadius: "10px", cursor: "grab", padding: "8px",
        display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      }}
    >
      <span style={{ color: "#ffffff", fontSize: "13px", lineHeight: 1.5, pointerEvents: "none" }}>
        Geser: lihat sekeliling<br />Cubit: zoom
      </span>
    </div>
  );
}

function ResetButton({ send }) {
  return (
    <button
      onClick={() => send("cameraReset")}
      style={{
        width: "100%", minHeight: "44px", background: "transparent",
        border: `1px solid ${C.border}`, borderRadius: "8px", color: C.text,
        fontSize: "13px", letterSpacing: "0.5px", cursor: "pointer",
        fontFamily: "'DM Mono', monospace", flexShrink: 0,
      }}
    >Reset tampilan</button>
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
  const landscape = useLandscape();

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
        setSelectedRoom(msg.activeRoom ?? null);
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

  const drone = useDroneLoop(send);

  const clearRoom = () => { setSelectedRoom(null); send("selectRoom", null); };

  const btnStyle = (active, accent) => ({
    width: "100%",
    padding: landscape ? "10px 14px" : "16px 20px",
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
      <div style={{ padding: landscape ? "4px 12px" : "8px 16px", borderBottom: `1px solid ${C.border}`, borderTop: `2px solid ${C.cyan}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <p style={{ fontSize: "18px", fontWeight: "700", margin: 0, letterSpacing: "1px", whiteSpace: "nowrap", color: C.cyan, textShadow: `0 0 16px ${C.cyan}` }}>
          IF Kiosk
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.green, boxShadow: C.greenGlow, flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: C.green }}>Terhubung</span>
          </div>
          <HelpButton variant="phone" />
          <button onClick={disconnect} style={{
            background: "transparent",
            border: "1px solid rgba(255,60,80,0.5)",
            borderRadius: "8px",
            minHeight: "44px",
            padding: "0 12px",
            color: "#ff8092",
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
          }}>
            Selesai
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: landscape ? "row" : "column" }}>

      {/* Sideways: the joystick under the left thumb */}
      {landscape && (
        <div style={{ flexShrink: 0, padding: "12px", display: "flex", alignItems: "flex-end", borderRight: `1px solid ${C.border}`, background: C.card }}>
          <Joystick onChange={drone.setStick} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* Search bar */}
      <div style={{ padding: "10px 16px 0", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search size={20} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari ruangan atau dosen"
            style={{
              width: "100%", boxSizing: "border-box",
              background: C.card, border: `1px solid ${query ? C.cyan : C.border}`,
              borderRadius: "8px", padding: "11px 36px 11px 46px",
              color: C.text, fontSize: "16px", fontFamily: "'DM Mono', monospace",
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
                <ArrowLeft size={20} strokeWidth={2.5} /> Pilih lantai lain
              </button>
            )}

            <div>
              <p style={{ fontSize: "10px", letterSpacing: "2px", color: C.cyan, margin: "0 0 4px", textTransform: "uppercase", textShadow: `0 0 8px ${C.cyan}` }}>
                {tvView === "floors" ? "Pilih Lantai" : (tvFloor || "Ruangan")}
              </p>
{tvView === "rooms" && !landscape && (
                <p style={{ fontSize: "12px", color: C.sub, letterSpacing: "0.3px", margin: "4px 0 0", fontStyle: "italic" }}>
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
            {tvView === "rooms" && rooms.length > 0 && (
              <button onClick={clearRoom} style={btnStyle(!selectedRoom, "cyan")}>
                Semua ruangan
              </button>
            )}
            {tvView === "rooms" && rooms.map((name) => (
              <button key={name} ref={selectedRoom === name ? activeRoomRef : null}
                onClick={() => {
                  if (selectedRoom === name) { clearRoom(); return; }
                  setSelectedRoom(name);
                  send("selectRoom", name);
                }}
                style={btnStyle(selectedRoom === name, "cyan")}>
                {displayName(name)}
              </button>
            ))}
          </>
        )}
      </div>

      </div>

      {/* Camera controls: the right column sideways, the bottom row upright */}
      {landscape ? (
        <div style={{ width: "clamp(190px, 30vw, 250px)", flexShrink: 0, padding: "12px", display: "flex", flexDirection: "column", gap: "8px", borderLeft: `1px solid ${C.border}`, background: C.card }}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <LiftButton label="Terbang naik" symbol="▲" onHold={drone.setUp} />
              <LiftButton label="Terbang turun" symbol="▼" onHold={drone.setDown} />
            </div>
            <LookPad send={send} />
          </div>
          <ResetButton send={send} />
        </div>
      ) : (
        <div style={{ flexShrink: 0, padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: "10px", borderTop: `1px solid ${C.border}`, background: C.card }}>
          <div style={{ display: "flex", alignItems: "stretch", gap: "10px" }}>
            <Joystick onChange={drone.setStick} />
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <LiftButton label="Terbang naik" symbol="▲" onHold={drone.setUp} />
              <LiftButton label="Terbang turun" symbol="▼" onHold={drone.setDown} />
            </div>
            <LookPad send={send} />
          </div>
          <ResetButton send={send} />
        </div>
      )}
      </div>
    </div>
  );
}
