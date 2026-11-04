import { test } from "node:test";
import assert from "node:assert/strict";

import { getClassesNow, parseCourse } from "../src/lib/directory.js";

const data = {
  version: "test",
  rooms: [
    { nama_ruang: "IF_101", lantai: "Lantai 1", is_kelas: true },
    { nama_ruang: "IF_102", lantai: "Lantai 1", is_kelas: true },
    { nama_ruang: "Aula Handayani", lantai: "Lantai 2", is_kelas: true },
  ],
  dosen: { HF: "Hadziq Fabroyir, S.Kom., Ph.D." },
  occupants: {},
  jadwal: [
    { hari: "Senin", jam_mulai: "07:00", jam_selesai: "09:30", nama_ruang: "IF_102", mata_kuliah: "IF_Sistem Basis Data C", dosen: ["HF"] },
    { hari: "Senin", jam_mulai: "07:00", jam_selesai: "09:30", nama_ruang: "IF_101", mata_kuliah: "IUP_Teori Graf I (EN)", dosen: ["HF"] },
    { hari: "Senin", jam_mulai: "09:40", jam_selesai: "12:10", nama_ruang: "IF_101", mata_kuliah: "IF_Matematika Diskrit C", dosen: ["HF"] },
    { hari: "Senin", jam_mulai: "08:00", jam_selesai: "10:00", nama_ruang: "Aula Handayani", mata_kuliah: "IF_Kuliah Tamu", dosen: ["HF"] },
    { hari: "Rabu",  jam_mulai: "12:30", jam_selesai: "15:00", nama_ruang: "IF_102", mata_kuliah: "S2_Topik Dalam Komputasi Awan A", dosen: ["HF"] },
  ],
};

// 2026-10-26 is a Monday.
const at = (date, time) => new Date(`${date}T${time}:00`);

test("parseCourse splits programme, name, class letter and the English mark", () => {
  assert.deepEqual(parseCourse("IF_Rekayasa Sistem Berbasis Pengetahuan D (EN)"), {
    program: "IF", name: "Rekayasa Sistem Berbasis Pengetahuan", kelas: "D", english: true, short: "RSBP D",
  });
  assert.equal(parseCourse("IF_Teori Graf B").short, "Teori Graf B");
  assert.equal(parseCourse("IF_Pemodelan dan Simulasi C").short, "PS C");
  assert.equal(parseCourse("S3_TD Interaksi Manusia dan Komputer A").short, "TD IMK A");
  assert.equal(parseCourse("PJJ_Topik dalam Analisis Data Multivariat P").short, "TD ADM P");
  assert.deepEqual(parseCourse("Metodologi Penelitian A By Riset"), {
    program: null, name: "Metodologi Penelitian A By Riset", kelas: null, english: false, short: "MP A BR",
  });
});

test("getClassesNow lists the floor's running classes by room, and the next start", () => {
  const { day, running, next } = getClassesNow(data, "Lantai 1", at("2026-10-26", "08:15"));
  assert.equal(day, "Senin");
  assert.deepEqual(running.map((c) => [c.nama_ruang, c.short, c.nama_dosen]), [
    ["IF_101", "Teori Graf I", "Hadziq Fabroyir, S.Kom., Ph.D."],
    ["IF_102", "SBD C", "Hadziq Fabroyir, S.Kom., Ph.D."],
  ]);
  assert.deepEqual({ ...next, classes: next.classes.map((c) => c.nama_ruang) },
    { hari: "Senin", jam_mulai: "09:40", today: true, classes: ["IF_101"] });
});

test("getClassesNow treats the end time as free and looks ahead to the next teaching day", () => {
  const { running, next } = getClassesNow(data, "Lantai 1", at("2026-10-26", "12:10"));
  assert.deepEqual(running, []);
  assert.equal(next.hari, "Rabu");
  assert.equal(next.today, false);
  assert.equal(next.classes[0].short, "TD KA A");
});

test("getClassesNow on a weekend has nothing running and points to Monday", () => {
  const { day, running, next } = getClassesNow(data, "Lantai 1", at("2026-10-31", "10:00"));
  assert.equal(day, null);
  assert.deepEqual(running, []);
  assert.deepEqual([next.hari, next.jam_mulai], ["Senin", "07:00"]);
});
