import { QRCodeSVG } from "qrcode.react";
import { C } from "../lib/constants";

const wrapStyle = {
  borderRadius: "8px",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  fontFamily: "'DM Mono', monospace",
};

/**
 * Sits at the foot of the sidebar, clear of the 3D view: a QR code when no
 * phone is connected, or a "Smartphone terhubung" badge when one is paired.
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
          width: "8px", height: "8px", borderRadius: "50%",
          background: C.green, boxShadow: C.greenGlow,
          flexShrink: 0, marginTop: "4px",
        }} />
        <div>
          <p style={{ fontSize: "11px", color: C.green, letterSpacing: "1px", margin: 0 }}>
            Smartphone terhubung
          </p>
          <p style={{ fontSize: "9px", color: "#ff4060", letterSpacing: "0.5px", margin: "4px 0 0" }}>
            Sesi terputus otomatis setelah 1 menit tidak aktif
          </p>
        </div>
      </div>
    );
  }

  if (!mobileUrl) return null;

  return (
    <div style={{
      ...wrapStyle,
      border: `1px solid ${C.cyan}`,
      boxShadow: C.cyanGlow,
    }}>
      <QRCodeSVG
        value={mobileUrl}
        size={180}
        bgColor="transparent"
        fgColor="#ffffff"
        level="M"
      />
      <p style={{
        fontSize: "13px", color: "#ffffff", letterSpacing: "1.5px",
        textTransform: "uppercase", margin: 0,
        textShadow: `0 0 8px ${C.cyan}`,
      }}>
        Scan untuk kontrol
      </p>
    </div>
  );
}
