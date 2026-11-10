import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Search, X, LoaderCircle, CheckCircle } from "lucide-react";
import { DAYS, MENU_FLOORS, EXCLUDE, UI, displayName } from "../lib/constants";
import { RELAY_URL } from "../lib/config";
import { loadData } from "../lib/data";
import { search } from "../lib/directory";

const JS_DAY_TO_ID = ["", ...DAYS, ""];
const TODAY = JS_DAY_TO_ID[new Date().getDay()] || null;

// The two joysticks, in the kiosk camera's drag pixels per second at full
// deflection.
const WALK_PX_PER_S = 110;
const LOOK_PX_PER_S = 220;
const STICK_SIZE    = 112;
const THUMB_SIZE    = 48;
const DEADZONE      = 0.12;

const noSelect = { touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" };

/** One joystick. Calls onChange(x, y), each from -1 to 1, y down. */
function Joystick({ label, onChange }) {
  const thumb  = useRef(null);
  const active = useRef(null);
  const reach  = (STICK_SIZE - THUMB_SIZE) / 2;

  const update = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - (box.left + box.width / 2);
    const y = e.clientY - (box.top + box.height / 2);
    const len  = Math.hypot(x, y);
    const held = Math.min(len, reach);
    const nx = len ? x / len : 0;
    const ny = len ? y / len : 0;
    if (thumb.current) thumb.current.style.transform = `translate(${nx * held}px, ${ny * held}px)`;
    const mag = held / reach;
    // Past the dead zone, grow slowly at first, for fine moves near a room.
    const power = mag < DEADZONE ? 0 : ((mag - DEADZONE) / (1 - DEADZONE)) ** 1.5;
    onChange(nx * power, ny * power);
  };

  const release = (e) => {
    if (e.pointerId !== active.current) return;
    active.current = null;
    if (thumb.current) thumb.current.style.transform = "translate(0, 0)";
    onChange(0, 0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      <div
        role="application"
        aria-label={label}
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
          width: `${STICK_SIZE}px`, height: `${STICK_SIZE}px`, borderRadius: "50%",
          background: UI.surface, border: `1px solid ${UI.line}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div ref={thumb} style={{
          width: `${THUMB_SIZE}px`, height: `${THUMB_SIZE}px`, borderRadius: "50%",
          background: UI.text, pointerEvents: "none", transition: "transform 0.05s",
        }} />
      </div>
      <span style={{ fontSize: "14px", fontWeight: 500, color: UI.text }}>{label}</span>
    </div>
  );
}

/**
 * Two joysticks within reach of one thumb: the left one walks along the
 * floor, the right one turns the view in place. While either is held, the
 * kiosk's camera moves every frame.
 */
function CameraControls({ send }) {
  const move = useRef({ x: 0, y: 0 });
  const look = useRef({ x: 0, y: 0 });
  const loop = useRef(null);
  const last = useRef(0);

  useEffect(() => () => { cancelAnimationFrame(loop.current); loop.current = null; }, []);

  const tick = (now) => {
    // A frame's timestamp can be a little older than the press that started
    // the loop; never step backwards.
    const dt = Math.min(Math.max(now - last.current, 0) / 1000, 0.1);
    last.current = now;
    const m = move.current, l = look.current;
    if (!m.x && !m.y && !l.x && !l.y) { loop.current = null; return; }
    send("cameraTransform", {
      // The camera goes where the stick points; walkBy takes finger drags,
      // which move the model the opposite way.
      walkDx: -m.x * WALK_PX_PER_S * dt,
      walkDy: -m.y * WALK_PX_PER_S * dt,
      lookDx:  l.x * LOOK_PX_PER_S * dt,
      lookDy:  l.y * LOOK_PX_PER_S * dt,
    });
    loop.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (loop.current) return;
    last.current = performance.now();
    loop.current = requestAnimationFrame(tick);
  };

  const onMove = (x, y) => { move.current = { x, y }; if (x || y) start(); };
  const onLook = (x, y) => { look.current = { x, y }; if (x || y) start(); };

  return (
    <div style={{ flexShrink: 0, padding: "16px 16px 20px", borderTop: `1px solid ${UI.line}`, background: UI.bg, display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: "24px" }}>
        <Joystick label="Gerak" onChange={onMove} />
        <Joystick label="Pandang" onChange={onLook} />
      </div>
      <button className="k-button" onClick={() => send("cameraReset")} style={{ background: "transparent" }}>
        Reset View
      </button>
    </div>
  );
}

function ResultLine({ children, sub = false }) {
  return <span style={{ fontSize: sub ? "13px" : "14px", color: sub ? UI.sub : UI.text, lineHeight: 1.4 }}>{children}</span>;
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
        // Follow the kiosk, so a room cleared there is cleared here too.
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

  const clearRoom = () => { setSelectedRoom(null); send("selectRoom", null); };

  if (!connected) return (
    <div style={{ height: "100dvh", background: UI.bg, color: UI.text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: UI.font, padding: "24px", gap: "12px", textAlign: "center" }}>
      {!sid ? (
        <>
          <LoaderCircle size={32} style={{ color: UI.sub }} />
          <p style={{ fontSize: "16px", fontWeight: 500 }}>URL tidak valid. Scan ulang QR code.</p>
        </>
      ) : (
        <>
          <CheckCircle size={32} style={{ color: UI.sub }} />
          <p style={{ fontSize: "18px", fontWeight: 600 }}>Sesi berakhir.</p>
          <p style={{ fontSize: "15px", color: UI.sub }}>Scan QR code di layar TV untuk sesi baru.</p>
        </>
      )}
    </div>
  );

  const rooms = tvRooms.filter(n => !EXCLUDE.test(n));

  return (
    <div style={{ height: "100dvh", background: UI.bg, color: UI.text, fontFamily: UI.font, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${UI.line}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <p style={{ fontSize: "19px", fontWeight: 600, lineHeight: 1.2 }}>IF Kiosk</p>
          <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: UI.sub }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: UI.ok }} />
            Terhubung
          </p>
        </div>
        <button className="k-button" onClick={disconnect}>Selesai</button>
      </div>

      {/* Search bar */}
      <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search size={20} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: UI.sub, pointerEvents: "none" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari ruangan atau dosen"
            style={{
              width: "100%", boxSizing: "border-box", minHeight: "48px",
              background: UI.surface, border: `1px solid ${query ? UI.text : UI.line}`,
              borderRadius: "10px", padding: "0 44px 0 46px",
              color: UI.text, fontSize: "16px", outline: "none",
            }}
          />
          {query && (
            <button aria-label="Hapus pencarian" onClick={() => setQuery("")} style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", width: "40px", height: "40px", background: "none", border: "none", color: UI.sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
          )}
        </div>
      </div>

      {/* Scrollable content: search results OR floor/room list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>

        {/* ── Search results ── */}
        {query.trim().length >= 2 && (
          <>
            {searchLoading && (
              <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: UI.sub, margin: "8px 0" }}>
                <LoaderCircle size={16} style={{ animation: "spin 1s linear infinite" }} /> Mencari...
              </p>
            )}
            {!searchLoading && searchResults.length === 0 && (
              <p style={{ fontSize: "15px", color: UI.sub, textAlign: "center", marginTop: "24px" }}>
                Tidak ada hasil.
              </p>
            )}
            {!searchLoading && searchResults.map((item, i) => {
              const floor = item.lantai ?? null;
              const isDosen = item.result_type === "dosen";
              const isRoom  = item.result_type === "room";
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
                    background: UI.surface, border: "none", borderRadius: "10px",
                    padding: "12px 14px", marginBottom: "4px", color: UI.text,
                    display: "flex", flexDirection: "column", gap: "4px",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 600 }}>{displayName(item.room_name)}</span>
                    {floor && <ResultLine sub>{floor}</ResultLine>}
                  </span>

                  {isRoom ? null : isDosen ? (
                    item.occupants?.length > 0
                      ? item.occupants.map((name, j) => <ResultLine key={j}>{name}</ResultLine>)
                      : <ResultLine sub>{item.keterangan || displayName(item.room_name)}</ResultLine>
                  ) : (
                    <>
                      <ResultLine>
                        {item.class_code && <strong style={{ fontWeight: 600 }}>{item.class_code} · </strong>}
                        {item.mata_kuliah}
                      </ResultLine>
                      {[item.nama_dosen, item.nama_dosen_2, item.nama_dosen_3].filter(Boolean).map((nama) => (
                        <ResultLine key={nama} sub>{nama}</ResultLine>
                      ))}
                      <ResultLine sub>{item.jam_mulai}–{item.jam_selesai}</ResultLine>
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
              <button className="k-back" onClick={() => { setAwaitingRooms(false); send("back"); }} style={{ alignSelf: "flex-start" }}>
                <ArrowLeft size={20} /> Kembali
              </button>
            )}

            <div style={{ padding: "8px 12px 6px" }}>
              <p style={{ fontSize: "17px", fontWeight: 600 }}>
                {tvView === "floors" ? "Pilih lantai" : (tvFloor || "Ruangan")}
              </p>
              {tvView === "rooms" && (
                <p style={{ fontSize: "14px", color: UI.sub, lineHeight: 1.4 }}>
                  Pilih ruangan untuk menyorotnya di layar utama
                </p>
              )}
            </div>

            {tvView === "floors" && !awaitingRooms && MENU_FLOORS.map((f) => (
              <button key={f} className="k-row" data-active={tvFloor === f}
                onClick={() => { setSelectedRoom(null); setAwaitingRooms(true); send("selectFloor", f); }}>
                <span className="k-num">{f.replace(/^Lantai\s*/, "")}</span>
                {f}
              </button>
            ))}

            {tvView === "floors" && awaitingRooms && (
              <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "15px", color: UI.sub, marginTop: "24px" }}>
                <LoaderCircle size={16} style={{ animation: "spin 1s linear infinite" }} /> Memuat lantai...
              </p>
            )}

            {tvView === "rooms" && rooms.length === 0 && (
              <p style={{ fontSize: "14px", color: UI.sub, padding: "0 12px" }}>Tidak ada ruangan terdeteksi.</p>
            )}
            {tvView === "rooms" && rooms.length > 0 && (
              <button className="k-row" data-active={!selectedRoom} onClick={clearRoom}>
                Semua ruangan
              </button>
            )}
            {tvView === "rooms" && rooms.map((name) => (
              <button key={name} ref={selectedRoom === name ? activeRoomRef : null}
                className="k-row" data-active={selectedRoom === name}
                onClick={() => {
                  if (selectedRoom === name) { clearRoom(); return; }
                  setSelectedRoom(name);
                  send("selectRoom", name);
                }}>
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
