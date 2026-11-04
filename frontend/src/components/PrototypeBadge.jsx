// A label on every page of a student prototype, so that nobody mistakes a
// course copy for the official IF E-Kiosk. Set at build time with
// VITE_PROTOTYPE_LABEL (see .github/workflows/pages.yml); the official build
// leaves it unset and shows nothing.
const LABEL = import.meta.env.VITE_PROTOTYPE_LABEL;

export function PrototypeBadge() {
  if (!LABEL) return null;
  return (
    <div
      role="note"
      style={{
        position: "fixed", left: "50%", bottom: 12, transform: "translateX(-50%)",
        zIndex: 9999, pointerEvents: "none",
        padding: "6px 14px", borderRadius: 999,
        background: "#7A1F1F", color: "#FFFFFF",
        font: "600 14px/1.2 'DM Mono', monospace", letterSpacing: "0.02em",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        maxWidth: "calc(100vw - 24px)", width: "max-content", textAlign: "center",
      }}
    >
      {LABEL}
    </div>
  );
}
