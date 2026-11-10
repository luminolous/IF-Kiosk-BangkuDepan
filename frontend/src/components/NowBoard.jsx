import { useEffect, useRef } from "react";
import { UI, displayName } from "../lib/constants";

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const pad = (n) => String(n).padStart(2, "0");
// "Hadziq Fabroyir, S.Kom., Ph.D." → "Hadziq Fabroyir": the titles do not
// fit a board read from a few metres away.
const shortName = (name) => name?.split(",")[0] ?? null;
const duration = (minutes) => (minutes < 60 ? `${minutes} mnt` : `${Math.floor(minutes / 60)} j ${pad(minutes % 60)} mnt`);

function Chip({ children, solid = false }) {
  return (
    <span style={{
      background: solid ? UI.live : "transparent",
      color: solid ? UI.bg : UI.sub,
      border: solid ? "none" : `1px solid ${UI.line}`,
      borderRadius: "6px", padding: solid ? "2px 8px" : "0 6px",
      fontSize: solid ? "14px" : "12px", fontWeight: solid ? 600 : 500,
      whiteSpace: "nowrap", verticalAlign: "middle",
    }}>
      {children}
    </span>
  );
}

function RunningRow({ item, minute, focused, rowRef }) {
  const start = toMinutes(item.jam_mulai), end = toMinutes(item.jam_selesai);
  const progress = Math.min(1, Math.max(0, (minute - start) / (end - start)));
  const lecturers = [item.nama_dosen, item.nama_dosen_2, item.nama_dosen_3].filter(Boolean);

  return (
    <div ref={rowRef} style={{
      background: focused ? UI.surface : "transparent",
      // The bar on the left matches the colour of the room on the map.
      boxShadow: `inset 3px 0 0 ${focused ? UI.live : UI.line}`,
      borderRadius: "10px", padding: "12px 14px 12px 18px",
      display: "flex", flexDirection: "column", gap: "6px",
      transition: "background 0.4s, box-shadow 0.4s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "20px", fontWeight: 600, color: UI.text, whiteSpace: "nowrap" }}>{displayName(item.nama_ruang)}</span>
        <Chip solid>{item.short}</Chip>
      </div>
      <p style={{ fontSize: "15px", color: UI.text, lineHeight: 1.4 }}>
        {item.name}
        {item.program && <> <Chip>{item.program}</Chip></>}
        {item.english && <> <Chip>EN</Chip></>}
      </p>
      {lecturers.length > 0 && (
        <p style={{ fontSize: "14px", color: UI.sub }}>
          {shortName(lecturers[0])}{lecturers.length > 1 && ` +${lecturers.length - 1}`}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1, height: "4px", background: UI.line, borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: UI.text, transition: "width 1s" }} />
        </div>
        <span style={{ fontSize: "13px", color: UI.sub, whiteSpace: "nowrap" }}>
          {item.jam_mulai}–{item.jam_selesai} · sisa {duration(end - minute)}
        </span>
      </div>
    </div>
  );
}

function NextUp({ next, compact }) {
  const when = next.today ? `pukul ${next.jam_mulai}` : `${next.hari}, ${next.jam_mulai}`;
  const shown = compact ? next.classes.slice(0, 6) : next.classes;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "4px" }}>
      <p style={{ fontSize: "14px", fontWeight: 500, color: UI.sub }}>
        Berikutnya, {when}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {shown.map((c) => (
          <span key={c.id} style={{ borderRadius: "8px", padding: "5px 10px", fontSize: "14px", color: UI.text, background: UI.surface }}>
            {displayName(c.nama_ruang)} <span style={{ color: UI.sub }}>· {c.short}</span>
          </span>
        ))}
        {shown.length < next.classes.length && (
          <span style={{ padding: "5px 4px", fontSize: "14px", color: UI.sub }}>+{next.classes.length - shown.length} lagi</span>
        )}
      </div>
    </div>
  );
}

/**
 * The idle board: classes in progress on the kiosk's floor, the next ones to
 * start, and a clock. `focusRoom` is the class the 3D map is pointing at.
 * `top` leaves room for the QR hint above it.
 */
export function NowBoard({ floor, info, now, focusRoom, top = 16 }) {
  const focusedRef = useRef(null);
  const minute = now.getHours() * 60 + now.getMinutes();
  const { running, next, day } = info;

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusRoom]);

  return (
    <div style={{
      position: "absolute", top: `${top}px`, right: "20px", width: "400px",
      maxHeight: `calc(100% - ${top + 20}px)`,
      background: "rgba(12,24,33,0.94)", border: `1px solid ${UI.line}`,
      borderRadius: "14px", backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "boardIn 0.6s ease-out", fontFamily: UI.font, color: UI.text,
    }}>
      <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${UI.line}`, display: "flex", alignItems: "flex-end", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 500, color: UI.text }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: UI.live, animation: "livePulse 1.6s ease-in-out infinite" }} />
            Sedang berlangsung
          </p>
          <p style={{ fontSize: "22px", fontWeight: 600, color: UI.text, marginTop: "2px" }}>{floor}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "32px", fontWeight: 600, color: UI.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pad(now.getHours())}:{pad(now.getMinutes())}</p>
          <p style={{ fontSize: "14px", color: UI.sub, marginTop: "4px" }}>{day ?? "Akhir pekan"}</p>
        </div>
      </div>

      <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
        {running.length > 0
          ? running.map((item) => (
              <RunningRow key={item.id} item={item} minute={minute}
                focused={item.nama_ruang === focusRoom}
                rowRef={item.nama_ruang === focusRoom ? focusedRef : null} />
            ))
          : (
            <p style={{ fontSize: "15px", color: UI.sub, textAlign: "center", padding: "14px 0" }}>
              Tidak ada kelas yang sedang berlangsung
            </p>
          )}
        {next && <NextUp next={next} compact={running.length > 0} />}
      </div>

      <p style={{ padding: "12px 20px 14px", borderTop: `1px solid ${UI.line}`, fontSize: "13px", color: UI.sub, lineHeight: 1.45 }}>
        Sesuai jadwal semester · scan QR di kiri bawah untuk mengontrol papan ini dan menjelajah
      </p>
    </div>
  );
}
