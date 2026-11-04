import { QRCodeSVG } from "qrcode.react";
import { C } from "../lib/constants";
import { RELAY_URL } from "../lib/config";

const wrapStyle = {
  borderRadius: "8px",
  padding: "10px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  fontFamily: "'DM Mono', monospace",
};

/**
 * Sits at the foot of the sidebar, clear of the 3D view: a QR code with the
 * steps to use it when no phone is connected, or a "Smartphone terhubung"
 * badge when one is paired.
 */
export function QRPanel({ mobileUrl, phoneConnected }) {
  if (phoneConnected) {
    return (
      <div style={{
        ...wrapStyle,
        flexDirection: "row",
        alignItems: "flex-start",
        padding: "10px 14px",
        border: `1px solid ${C.green}`,
        boxShadow: C.greenGlow,
      }}>
        <span style={{
          width: "10px", height: "10px", borderRadius: "50%",
          background: C.green, boxShadow: C.greenGlow,
          flexShrink: 0, marginTop: "5px",
        }} />
        <div>
          <p style={{ fontSize: "16px", color: C.green, letterSpacing: "0.5px", margin: 0 }}>
            Smartphone terhubung
          </p>
          <p style={{ fontSize: "14px", color: "#fbbf24", letterSpacing: "0.3px", margin: "4px 0 0", lineHeight: 1.35 }}>
            Sesi terputus otomatis setelah 1 menit tidak aktif
          </p>
        </div>
      </div>
    );
  }

  // Pairing is switched off (VITE_RELAY_URL=none): nothing to show.
  if (!RELAY_URL) return null;

  // Relay not ready yet or unreachable: say so instead of vanishing.
  if (!mobileUrl) {
    return (
      <div style={{ ...wrapStyle, border: `1px solid ${C.border}` }}>
        <p style={{ fontSize: "14px", color: C.text, margin: 0, textAlign: "center", lineHeight: 1.4 }}>
          Menyambungkan ke layanan HP… Layar sentuh tetap bisa dipakai.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      ...wrapStyle,
      border: `1px solid ${C.cyan}`,
      boxShadow: C.cyanGlow,
    }}>
      {/* Dark modules on a white box: most phone cameras cannot read light-on-dark codes. */}
      <div style={{ background: "#ffffff", padding: "12px", borderRadius: "6px", lineHeight: 0 }}>
        <QRCodeSVG
          value={mobileUrl}
          size={184}
          bgColor="#ffffff"
          fgColor="#000000"
          level="M"
        />
      </div>
      <p style={{ fontSize: "14px", color: C.green, margin: 0 }}>Menunggu HP…</p>
      <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "14px", color: C.text, lineHeight: 1.45, alignSelf: "stretch" }}>
        <li>Buka kamera HP</li>
        <li>Arahkan ke kode ini</li>
        <li>Ketuk tautan yang muncul</li>
      </ol>
    </div>
  );
}
