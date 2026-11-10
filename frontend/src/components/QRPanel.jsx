import { QRCodeSVG } from "qrcode.react";
import { UI } from "../lib/constants";

/**
 * Sits at the foot of the sidebar, clear of the 3D view: a QR code when no
 * phone is connected, or a "Smartphone terhubung" note when one is paired.
 */
export function QRPanel({ mobileUrl, phoneConnected }) {
  if (phoneConnected) {
    return (
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px 14px", borderRadius: "10px", background: UI.surface, fontFamily: UI.font }}>
        <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: UI.ok, flexShrink: 0, marginTop: "6px" }} />
        <div>
          <p style={{ fontSize: "15px", fontWeight: 500, color: UI.text, margin: 0 }}>Smartphone terhubung</p>
          <p style={{ fontSize: "13px", color: UI.sub, margin: "2px 0 0", lineHeight: 1.4 }}>
            Sesi terputus otomatis setelah 1 menit tidak aktif
          </p>
        </div>
      </div>
    );
  }

  if (!mobileUrl) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", fontFamily: UI.font }}>
      {/* Dark modules on a light tile read best on phone cameras. */}
      <div style={{ background: UI.text, padding: "12px", borderRadius: "12px", lineHeight: 0 }}>
        <QRCodeSVG
          value={mobileUrl}
          size={168}
          bgColor={UI.text}
          fgColor={UI.bg}
          level="M"
        />
      </div>
      <p style={{ fontSize: "15px", fontWeight: 500, color: UI.text, margin: 0 }}>
        Scan untuk kontrol
      </p>
    </div>
  );
}
