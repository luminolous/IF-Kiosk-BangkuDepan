import { useEffect, useState } from "react";
import { C } from "../lib/constants";
import { GESTURES } from "../lib/config";

const gestureLine = GESTURES === "orbit"
  ? "Satu jari memutar peta, dua jari menggeser, cubit untuk zoom."
  : "Satu jari menggeser peta, dua jari memutar, cubit untuk zoom.";

const STEPS = {
  kiosk: [
    "Pilih lantai di menu kiri.",
    "Ketuk nama ruangan di daftar untuk melihat jadwal atau dosen.",
    gestureLine,
    "Ketuk \"Semua ruangan\" atau tombol × untuk kembali melihat seluruh lantai.",
    "Mau mengontrol dari HP? Scan kode QR di kiri bawah.",
  ],
  phone: [
    "Cari ruangan atau dosen di kolom pencarian.",
    "Pilih lantai, lalu ketuk ruangan untuk menampilkannya di layar kiosk.",
    `Di area sentuh: ${gestureLine.charAt(0).toLowerCase()}${gestureLine.slice(1)}`,
    "Ketuk \"Selesai\" kalau sudah. Sesi juga berhenti sendiri setelah 1 menit tidak aktif.",
  ],
};

/**
 * Small "?" button that opens a short how-to card. `variant` picks the text:
 * "kiosk" for the big screen, "phone" for /mobile/. `style` positions the
 * button (absolute on the kiosk, inline in the phone's header).
 */
export function HelpButton({ variant = "kiosk", style }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Cara menggunakan"
        title="Cara menggunakan"
        style={{
          width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
          border: `1px solid ${C.cyan}`, background: "rgba(8,9,15,0.85)", color: C.cyan,
          fontSize: "20px", fontWeight: 700, cursor: "pointer",
          fontFamily: "'DM Mono', monospace", ...style,
        }}
      >
        ?
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            role="dialog"
            aria-label="Cara menggunakan"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", width: "100%", maxWidth: "460px", maxHeight: "90dvh", overflowY: "auto", background: C.sidebar, border: `1px solid ${C.cyan}`, boxShadow: C.cyanGlow, borderRadius: "10px", padding: "24px 20px 20px", fontFamily: "'DM Mono', monospace", color: C.text }}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Tutup"
              style={{ position: "absolute", top: "8px", right: "8px", width: "44px", height: "44px", borderRadius: "8px", border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: "24px", cursor: "pointer" }}
            >
              ×
            </button>
            <p style={{ fontSize: "18px", fontWeight: 700, color: C.cyan, margin: "0 0 14px", paddingRight: "48px", letterSpacing: "1px" }}>
              Cara menggunakan
            </p>
            <ol style={{ margin: 0, paddingLeft: "22px", fontSize: "16px", lineHeight: 1.5, display: "flex", flexDirection: "column", gap: "8px" }}>
              {STEPS[variant].map((s) => <li key={s}>{s}</li>)}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
