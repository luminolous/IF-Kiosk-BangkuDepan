import { forwardRef, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { UI, MENU_FLOORS, EXCLUDE, getRoomSort, displayName, groupMeshNames } from "../lib/constants";

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: "13px", fontWeight: 500, color: UI.sub, margin: "0 0 8px 12px" }}>
      {children}
    </p>
  );
}

function FloorBtn({ label, active, onClick }) {
  return (
    <button className="k-row" data-active={active} onClick={onClick}>
      <span className="k-num">{label.replace(/^Lantai\s*/, "")}</span>
      {label}
    </button>
  );
}

const RoomBtn = forwardRef(function RoomBtn({ label, active, onClick }, ref) {
  return (
    <button ref={ref} className="k-row" data-active={active} onClick={onClick}>
      {displayName(label)}
    </button>
  );
});

export function Sidebar({
  view,
  activeFloor,
  activeRoom,
  modelInfo,
  status,
  errorMsg,
  isAnimatingRef,
  onFloorSelect,
  onBack,
  onRoomSelect,
  onRoomClear,
  footer,
}) {
  const activeRoomRef = useRef(null);

  useEffect(() => {
    activeRoomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeRoom]);

  return (
    <div style={{ width: "280px", minWidth: "280px", background: UI.bg, borderRight: `1px solid ${UI.line}`, display: "flex", flexDirection: "column", padding: "24px 12px 20px", gap: "20px", overflowY: "auto", fontFamily: UI.font, color: UI.text }}>

      {/* header */}
      <div style={{ padding: "0 12px 18px", borderBottom: `1px solid ${UI.line}` }}>
        <p style={{ fontSize: "24px", fontWeight: 600, margin: 0, lineHeight: 1.2, color: UI.text }}>IF Kiosk</p>
        <p style={{ fontSize: "14px", color: UI.sub, margin: "2px 0 0" }}>Teknik Informatika</p>
      </div>

      {/* floor picker */}
      {view === "floors" && (
        <div>
          <SectionLabel>Pilih lantai</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {MENU_FLOORS.map((f) => (
              <FloorBtn key={f} label={f} active={activeFloor === f}
                onClick={() => {
                  if (isAnimatingRef.current) return;
                  onFloorSelect(f);
                }} />
            ))}
          </div>
        </div>
      )}

      {/* room picker */}
      {view === "rooms" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button className="k-back" onClick={onBack} style={{ alignSelf: "flex-start" }}>
            <ArrowLeft size={18} /> Kembali
          </button>
          <div>
            <SectionLabel>{activeFloor || "Ruangan"}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {modelInfo?.meshNames?.length > 0 ? (
                <>
                  <button className="k-row" data-active={!activeRoom} onClick={onRoomClear}>
                    Semua ruangan
                  </button>
                  {groupMeshNames(modelInfo.meshNames.filter((name) => !EXCLUDE.test(name)).sort(getRoomSort(activeFloor)))
                    .map((name) => (
                      <RoomBtn key={name} ref={activeRoom === name ? activeRoomRef : null}
                        label={name} active={activeRoom === name}
                        onClick={() => (activeRoom === name ? onRoomClear() : onRoomSelect(name))} />
                    ))}
                </>
              ) : (
                <p style={{ fontSize: "14px", color: UI.sub, lineHeight: 1.6, padding: "0 12px" }}>Tidak ada mesh ditemukan.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* status indicators */}
      {status === "loading" && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: UI.sub, fontSize: "14px", padding: "0 12px" }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
          Memuat...
        </div>
      )}
      {status === "error" && (
        <div style={{ background: "#2a1218", border: "1px solid #6b2a36", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", color: "#f3b6c0" }}>
          {errorMsg}
        </div>
      )}

      {/* footer (the phone QR code): pinned to the bottom while the lists scroll */}
      {footer && (
        <div style={{ flexShrink: 0, position: "sticky", bottom: "-20px", margin: "auto -12px -20px", padding: "16px", background: UI.bg, borderTop: `1px solid ${UI.line}` }}>
          {footer}
        </div>
      )}

    </div>
  );
}
