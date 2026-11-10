import { useEffect, useState } from "react";
import { UI, displayName, DAYS } from "../lib/constants";
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
  const size = 64;
  const [failed, setFailed] = useState(false);
  const src = asset(`picture/${encodeURIComponent(kode)}.webp`);
  const box = { width: `${size}px`, height: `${size}px`, borderRadius: "10px", flexShrink: 0 };

  if (!failed) {
    return <img src={src} alt={name} onError={() => setFailed(true)} style={{ ...box, objectFit: "cover", background: UI.surface }} />;
  }

  return (
    <div style={{ ...box, background: UI.line, color: UI.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 600 }}>
      {getInitials(name)}
    </div>
  );
}

const panelStyle = {
  width: "300px", minWidth: "300px",
  background: UI.bg, borderLeft: `1px solid ${UI.line}`,
  display: "flex", flexDirection: "column",
  flexShrink: 0, height: "100%",
  overflowY: "auto", fontFamily: UI.font, color: UI.text,
};

function Heading({ kind, title, subtitle }) {
  return (
    <div style={{ padding: "24px 20px 18px", borderBottom: `1px solid ${UI.line}` }}>
      <p style={{ fontSize: "13px", fontWeight: 500, color: UI.sub, margin: "0 0 4px" }}>{kind}</p>
      <p style={{ fontSize: "24px", fontWeight: 600, color: UI.text, margin: 0, lineHeight: 1.25 }}>{title}</p>
      {subtitle && <p style={{ fontSize: "15px", color: UI.sub, margin: "4px 0 0" }}>{subtitle}</p>}
    </div>
  );
}

function Empty({ children }) {
  return <p style={{ fontSize: "15px", color: UI.sub, textAlign: "center", padding: "24px 0" }}>{children}</p>;
}

function ScheduleItems({ items, loading, error, today }) {
  if (loading) return <Empty>Memuat jadwal...</Empty>;
  if (error) return (
    <div style={{ background: "#2a1218", border: "1px solid #6b2a36", borderRadius: "8px", padding: "10px 12px", fontSize: "14px", color: "#f3b6c0" }}>
      {error}
    </div>
  );
  if (!today) return <Empty>Akhir pekan, tidak ada kelas</Empty>;
  if (items.length === 0) return <Empty>Tidak ada kelas lagi hari ini</Empty>;

  return items.map((item) => (
    <div key={item.id} style={{ display: "flex", gap: "14px", padding: "14px", borderRadius: "10px", background: UI.surface }}>
      <div style={{ width: "48px", flexShrink: 0, fontSize: "14px", lineHeight: 1.35 }}>
        <p style={{ fontWeight: 600, color: UI.text }}>{trimSecs(item.jam_mulai)}</p>
        <p style={{ color: UI.sub }}>{trimSecs(item.jam_selesai)}</p>
      </div>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
        <p style={{ fontSize: "15px", fontWeight: 600, color: UI.text, lineHeight: 1.35 }}>{item.mata_kuliah}</p>
        {item.kode_kelas && <p style={{ fontSize: "13px", color: UI.sub }}>Kelas {item.kode_kelas}</p>}
        {[item.nama_dosen, item.nama_dosen_2, item.nama_dosen_3].filter(Boolean).map((nama) => (
          <p key={nama} style={{ fontSize: "14px", color: UI.sub, lineHeight: 1.4 }}>{nama}</p>
        ))}
      </div>
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
      <p style={{ fontSize: "17px", color: UI.sub, textAlign: "center", padding: "24px", lineHeight: 1.5 }}>
        Pilih ruangan untuk melihat jadwal
      </p>
    </div>
  );

  if (loading || !roomData) return (
    <div style={{ ...panelStyle, alignItems: "center", justifyContent: "center" }}>
      <p style={{ fontSize: "15px", color: UI.sub, textAlign: "center", padding: "24px" }}>
        {loading ? "Memuat..." : displayName(roomName)}
      </p>
    </div>
  );

  const { lantai, is_kelas, is_lab, is_ruang_dosen, is_ruangan, keterangan, occupants = [] } = roomData;

  if (is_ruangan && !is_lab && !is_kelas && !is_ruang_dosen) return (
    <div style={panelStyle}>
      <Heading kind="Informasi ruangan" title={displayName(roomName)} subtitle={lantai ?? "-"} />
      <div style={{ padding: "20px" }}>
        <p style={{ fontSize: "15px", color: UI.text, lineHeight: 1.5 }}>{keterangan ?? displayName(roomName)}</p>
      </div>
    </div>
  );

  const topLabel = is_lab ? "Laboratorium" : is_ruang_dosen ? "Ruang dosen" : null;

  return (
    <div style={panelStyle}>
      {topLabel && <Heading kind={topLabel} title={keterangan || displayName(roomName)} subtitle={lantai ?? "-"} />}

      {is_ruang_dosen && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px", borderBottom: `1px solid ${UI.line}` }}>
          {occupants.length === 0
            ? <p style={{ fontSize: "14px", color: UI.sub }}>Belum ada data dosen</p>
            : occupants.map(({ kode, nama }) => (
                <div key={kode} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <DosenPhoto kode={kode} name={nama} />
                  <span style={{ fontSize: "14px", color: UI.text, lineHeight: 1.4 }}>{nama}</span>
                </div>
              ))
          }
        </div>
      )}

      {is_kelas && (
        <>
          {topLabel
            ? (
              <div style={{ padding: "18px 20px 0" }}>
                <p style={{ fontSize: "16px", fontWeight: 600, color: UI.text }}>Jadwal kelas</p>
                <p style={{ fontSize: "14px", color: UI.sub }}>{today ?? "Akhir pekan"}</p>
              </div>
            )
            : <Heading kind="Jadwal kelas" title={displayName(roomName)} subtitle={today ?? "Akhir pekan"} />}
          <div style={{ flex: 1, padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <ScheduleItems items={daySchedule} loading={false} error={error} today={today} />
          </div>
        </>
      )}

      {!is_kelas && <div style={{ flex: 1 }} />}
    </div>
  );
}
