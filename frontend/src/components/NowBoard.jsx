import { useEffect, useRef } from "react";
import { C, displayName } from "../lib/constants";

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const pad = (n) => String(n).padStart(2, "0");
// "Hadziq Fabroyir, S.Kom., Ph.D." → "Hadziq Fabroyir": the titles do not
// fit a board read from a few metres away.
const shortName = (name) => name?.split(",")[0] ?? null;
const duration = (minutes) => (minutes < 60 ? `${minutes} mnt` : `${Math.floor(minutes / 60)} j ${pad(minutes % 60)} mnt`);

function Chip({ children, solid = false }) {
  return (
    <span style={{
      background: solid ? C.live : "transparent",
      color: solid ? C.bg : C.sub,
      border: `1px solid ${solid ? C.live : C.border}`,
      borderRadius: "999px", padding: solid ? "3px 11px" : "1px 7px",
      fontSize: solid ? "14px" : "11px", fontWeight: solid ? 500 : 400,
      letterSpacing: "0.5px", whiteSpace: "nowrap",
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
      background: focused ? C.liveDim : C.card,
      // Spelled out per side: mixing border and borderLeft makes React warn
      // when the focus changes the colour.
      borderTop: `1px solid ${focused ? C.live : C.border}`,
      borderRight: `1px solid ${focused ? C.live : C.border}`,
      borderBottom: `1px solid ${focused ? C.live : C.border}`,
      borderLeft: `4px solid ${C.live}`,
      borderRadius: "6px", padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: "6px",
      boxShadow: focused ? C.liveGlow : "none",
      transition: "background 0.4s, border-color 0.4s, box-shadow 0.4s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "20px", fontWeight: 700, color: C.text, letterSpacing: "1px", whiteSpace: "nowrap" }}>{displayName(item.nama_ruang)}</span>
        <Chip solid>{item.short}</Chip>
      </div>
      <p style={{ fontSize: "15px", color: C.text, lineHeight: 1.3 }}>
        {item.name}
        {item.program && <> <Chip>{item.program}</Chip></>}
        {item.english && <> <Chip>EN</Chip></>}
      </p>
      {lecturers.length > 0 && (
        <p style={{ fontSize: "13px", color: C.sub }}>
          {shortName(lecturers[0])}{lecturers.length > 1 && ` +${lecturers.length - 1}`}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1, height: "4px", background: C.border, borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: C.live, transition: "width 1s" }} />
        </div>
        <span style={{ fontSize: "12px", color: C.sub, whiteSpace: "nowrap" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p style={{ fontSize: "11px", letterSpacing: "2px", color: C.sub, textTransform: "uppercase" }}>
        Berikutnya · {when}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {shown.map((c) => (
          <span key={c.id} style={{ border: `1px solid ${C.border}`, borderRadius: "6px", padding: "5px 9px", fontSize: "13px", color: C.text, background: C.card }}>
            {displayName(c.nama_ruang)} <span style={{ color: C.sub }}>· {c.short}</span>
          </span>
        ))}
        {shown.length < next.classes.length && (
          <span style={{ padding: "5px 4px", fontSize: "13px", color: C.sub }}>+{next.classes.length - shown.length} lagi</span>
        )}
      </div>
    </div>
  );
}

/**
 * The idle board: classes in progress on the kiosk's floor, the next ones to
 * start, and a clock. `focusRoom` is the class the 3D map is pointing at.
 */
export function NowBoard({ floor, info, now, focusRoom }) {
  const focusedRef = useRef(null);
  const minute = now.getHours() * 60 + now.getMinutes();
  const { running, next, day } = info;

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusRoom]);

  return (
    <div style={{
      position: "absolute", top: "16px", right: "20px", width: "400px",
      maxHeight: "calc(100% - 36px)",
      background: "rgba(8,9,15,0.9)", border: `1px solid ${C.live}`, boxShadow: C.liveGlow,
      borderRadius: "8px", backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "boardIn 0.6s ease-out",
    }}>
      <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-end", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <p style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", letterSpacing: "2px", color: C.live, textTransform: "uppercase", textShadow: C.liveGlow }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: C.live, animation: "livePulse 1.6s ease-in-out infinite" }} />
            Sedang berlangsung
          </p>
          <p style={{ fontSize: "20px", fontWeight: 700, color: C.text, letterSpacing: "1px", marginTop: "6px" }}>{floor}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "30px", fontWeight: 500, color: C.text, lineHeight: 1 }}>{pad(now.getHours())}:{pad(now.getMinutes())}</p>
          <p style={{ fontSize: "12px", color: C.sub, marginTop: "4px" }}>{day ?? "Akhir pekan"}</p>
        </div>
      </div>

      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>
        {running.length > 0
          ? running.map((item) => (
              <RunningRow key={item.id} item={item} minute={minute}
                focused={item.nama_ruang === focusRoom}
                rowRef={item.nama_ruang === focusRoom ? focusedRef : null} />
            ))
          : (
            <p style={{ fontSize: "15px", color: C.sub, textAlign: "center", padding: "14px 0", letterSpacing: "0.5px" }}>
              Tidak ada kelas yang sedang berlangsung
            </p>
          )}
        {next && <NextUp next={next} compact={running.length > 0} />}
      </div>

      <p style={{ padding: "10px 18px 12px", borderTop: `1px solid ${C.border}`, fontSize: "11px", color: C.sub, letterSpacing: "0.5px" }}>
        Sesuai jadwal semester · scan QR di kiri bawah untuk mengontrol papan ini dan menjelajah
      </p>
    </div>
  );
}
