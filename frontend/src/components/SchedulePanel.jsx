import { useEffect, useState } from "react";
import { C, displayName, DAYS } from "../lib/constants";
import { asset } from "../lib/config";

const JS_DAY_TO_ID = ["", ...DAYS, ""];
const trimSecs = (t) => t?.slice(0, 5) ?? t;

function getTodayName() {
  return JS_DAY_TO_ID[new Date().getDay()] || null;
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(time) {
  const [hours = 0, minutes = 0] = (trimSecs(time) || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function getInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function DosenPhoto({ kode, name }) {
  const size = 150;
  const [failed, setFailed] = useState(false);
  const src = asset(`picture/${encodeURIComponent(kode)}.webp`);

  if (!failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        style={{ width: "100%", maxWidth: `${size}px`, aspectRatio: "1 / 1", borderRadius: "6px", objectFit: "cover", border: `1px solid ${C.blue}80`, flexShrink: 0 }}
      />
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: `${size}px`, aspectRatio: "1 / 1", borderRadius: "6px", border: `1px solid ${C.blue}80`, background: C.blueDim, color: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "700", flexShrink: 0 }}>
      {getInitials(name)}
    </div>
  );
}

const panelStyle = {
  width: "300px", minWidth: "300px",
  background: C.sidebar, borderLeft: `1px solid ${C.border}`,
  display: "flex", flexDirection: "column",
  flexShrink: 0, height: "100%",
  overflowY: "auto", fontFamily: "'DM Mono', monospace",
};

function ScheduleItems({ items, color, loading, error, today }) {
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: C.cyan, fontSize: "12px" }}>
      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>...</span> Memuat jadwal...
    </div>
  );
  if (error) return (
    <div style={{ background: "#200a10", border: "1px solid #5a1020", borderRadius: "6px", padding: "10px", fontSize: "12px", color: "#ff4060" }}>
      ! {error}
    </div>
  );
  if (!today) return <p style={{ fontSize: "15px", color: C.muted, letterSpacing: "1px", textAlign: "center", padding: "20px 0" }}>- AKHIR PEKAN -</p>;
  if (items.length === 0) return <p style={{ fontSize: "15px", color: C.muted, letterSpacing: "1px", textAlign: "center", padding: "20px 0" }}>- TIDAK ADA KELAS -</p>;

  return items.map((item) => (
    <div key={item.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`, borderRadius: "6px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ background: `${color}26`, border: `1px solid ${color}66`, borderRadius: "4px", padding: "3px 9px", fontSize: "13px", color: "#d0dcff", fontWeight: "400", letterSpacing: "0.3px" }}>
          {trimSecs(item.jam_mulai)} - {trimSecs(item.jam_selesai)}
        </span>
        {item.kode_kelas && <span style={{ fontSize: "11px", color: C.sub, letterSpacing: "1px" }}>{item.kode_kelas}</span>}
      </div>
      <p style={{ fontSize: "15px", fontWeight: "600", color: C.text, margin: 0 }}>{item.mata_kuliah}</p>
      {item.nama_dosen && <p style={{ fontSize: "13px", color: C.text, margin: 0 }}>&gt; {item.nama_dosen}</p>}
      {item.nama_dosen_2 && <p style={{ fontSize: "13px", color: C.text, margin: 0 }}>&gt; {item.nama_dosen_2}</p>}
      {item.nama_dosen_3 && <p style={{ fontSize: "13px", color: C.text, margin: 0 }}>&gt; {item.nama_dosen_3}</p>}
    </div>
  ));
}

export function SchedulePanel({ roomName, roomData, loading, error }) {
  const today = getTodayName();
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentMinutes);
  const daySchedule = today && roomData?.schedules
    ? roomData.schedules.filter((s) => s.hari === today && timeToMinutes(s.jam_selesai) > currentMinutes)
    : [];

  useEffect(() => {
    const id = setInterval(() => setCurrentMinutes(getCurrentMinutes()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!roomName) return (
    <div style={{ ...panelStyle, alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontSize: "18px", color: "#ffffff", textAlign: "center", padding: "20px", letterSpacing: "0.5px" }}>
        Pilih ruangan untuk melihat jadwal
      </p>
    </div>
  );

  if (loading || !roomData) return (
    <div style={{ ...panelStyle, alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontSize: "11px", color: C.muted, textAlign: "center", padding: "20px", letterSpacing: "0.5px" }}>
        {loading ? "Memuat..." : displayName(roomName)}
      </p>
    </div>
  );

  const { lantai, is_kelas, is_lab, is_ruang_dosen, is_ruangan, keterangan, occupants = [] } = roomData;

  if (is_ruangan && !is_lab && !is_kelas && !is_ruang_dosen) return (
    <div style={panelStyle}>
      <div style={{ padding: "20px 16px 14px", borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, background: `linear-gradient(90deg, ${C.blue}0d 0%, transparent 100%)` }}>
        <p style={{ fontSize: "12px", letterSpacing: "2px", color: C.blue, marginBottom: "8px", textTransform: "uppercase", textShadow: `0 0 8px ${C.blue}` }}>
          Informasi Ruangan
        </p>
        <p style={{ fontSize: "22px", fontWeight: "700", color: C.text, margin: "0 0 6px", letterSpacing: "1px" }}>{displayName(roomName)}</p>
        <p style={{ fontSize: "16px", color: C.sub, margin: 0, letterSpacing: "0.5px" }}>{lantai ?? "-"}</p>
      </div>
      <div style={{ flex: 1, padding: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: "14px", color: C.sub, letterSpacing: "1px" }}>{keterangan ?? displayName(roomName)}</p>
      </div>
    </div>
  );

  const topLabel = is_lab ? "Laboratorium" : is_ruang_dosen ? "Ruang Dosen" : null;
  const topColor = is_lab ? C.cyan : C.blue;

  return (
    <div style={panelStyle}>
      {topLabel && (
        <div style={{ padding: "20px 16px 14px", borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${topColor}`, background: `linear-gradient(90deg, ${topColor}0d 0%, transparent 100%)` }}>
          <p style={{ fontSize: "12px", letterSpacing: "2px", color: topColor, marginBottom: "8px", textTransform: "uppercase", textShadow: `0 0 8px ${topColor}` }}>
            {topLabel}
          </p>
          {keterangan && <p style={{ fontSize: "22px", fontWeight: "700", color: C.text, margin: "0 0 4px", letterSpacing: "1px" }}>{keterangan}</p>}
          {!keterangan && <p style={{ fontSize: "22px", fontWeight: "700", color: C.text, margin: "0 0 4px", letterSpacing: "1px" }}>{displayName(roomName)}</p>}
          <p style={{ fontSize: "16px", color: C.sub, margin: 0, letterSpacing: "0.5px" }}>{lantai ?? "-"}</p>
        </div>
      )}

      {is_ruang_dosen && (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", borderBottom: `1px solid ${C.border}` }}>
          {occupants.length === 0
            ? <p style={{ fontSize: "13px", color: C.muted, letterSpacing: "1px", margin: 0 }}>-</p>
            : occupants.map(({ kode, nama }) => (
                <div key={kode} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, borderRadius: "6px", padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <DosenPhoto kode={kode} name={nama} />
                  <span style={{ fontSize: "13px", color: C.text, lineHeight: 1.35, textAlign: "center" }}>{nama}</span>
                </div>
              ))
          }
        </div>
      )}

      {is_kelas && (
        <>
          <div style={{ padding: "20px 16px 14px", borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, background: `linear-gradient(90deg, ${C.blue}0d 0%, transparent 100%)`, flexShrink: 0 }}>
            <p style={{ fontSize: "12px", letterSpacing: "2px", color: C.blue, marginBottom: "8px", textTransform: "uppercase", textShadow: `0 0 8px ${C.blue}` }}>
              Jadwal Kelas
            </p>
            {!topLabel && (
              <p style={{ fontSize: "22px", fontWeight: "700", color: C.text, margin: "0 0 6px", letterSpacing: "1px" }}>{displayName(roomName)}</p>
            )}
            <p style={{ fontSize: "13px", color: C.sub, margin: 0, letterSpacing: "0.5px" }}>{today ?? "Akhir Pekan"}</p>
          </div>
          <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <ScheduleItems items={daySchedule} color={C.blue} loading={false} error={error} today={today} />
          </div>
        </>
      )}

      {!is_kelas && <div style={{ flex: 1 }} />}
    </div>
  );
}
