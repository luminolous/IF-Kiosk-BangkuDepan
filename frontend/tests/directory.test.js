import { test } from "node:test";
import assert from "node:assert/strict";

import { getMapLabels, getRoom, glueShortWords, search } from "../src/lib/directory.js";

const data = {
  version: "test",
  rooms: [
    { nama_ruang: "IF_101", lantai: "Lantai 1", is_kelas: true,  is_lab: false, is_ruang_dosen: false, is_ruangan: false, keterangan: null },
    { nama_ruang: "IF_202", lantai: "Lantai 2", is_kelas: false, is_lab: false, is_ruang_dosen: false, is_ruangan: true,  keterangan: "Mushola" },
    { nama_ruang: "IF_233", lantai: "Lantai 2", is_kelas: false, is_lab: false, is_ruang_dosen: true,  is_ruangan: false, keterangan: null },
    { nama_ruang: "Aula Handayani", lantai: "Lantai 2", is_kelas: true, is_lab: false, is_ruang_dosen: false, is_ruangan: false, keterangan: null },
  ],
  dosen: { HF: "Hadziq Fabroyir, S.Kom., Ph.D.", RJ: "Rizky Januar Akbar, S.Kom., M.Eng." },
  occupants: { IF_233: ["RJ", "HF"] },
  jadwal: [
    { hari: "Senin",  jam_mulai: "07:00", jam_selesai: "09:50", nama_ruang: "IF_101", mata_kuliah: "Grafika Komputer", dosen: ["HF", "RJ"] },
    { hari: "Selasa", jam_mulai: "10:00", jam_selesai: "12:50", nama_ruang: "IF_101", mata_kuliah: "Realitas Virtual", dosen: ["HF"] },
  ],
};

test("getRoom matches a mesh name with underscores to a row with spaces", () => {
  assert.equal(getRoom(data, "Aula_Handayani").nama_ruang, "Aula Handayani");
  assert.equal(getRoom(data, "IF_999"), null);
});

test("getRoom returns occupants in order and the room's weekly schedule", () => {
  assert.deepEqual(getRoom(data, "IF_233").occupants, [
    { kode: "RJ", nama: "Rizky Januar Akbar, S.Kom., M.Eng." },
    { kode: "HF", nama: "Hadziq Fabroyir, S.Kom., Ph.D." },
  ]);
  const { schedules } = getRoom(data, "IF_101");
  assert.deepEqual(schedules.map((s) => s.hari), ["Senin", "Selasa"]);
  assert.equal(schedules[0].nama_dosen_2, "Rizky Januar Akbar, S.Kom., M.Eng.");
  assert.equal(schedules[1].nama_dosen_2, null);
});

test("search needs at least two characters", () => {
  assert.deepEqual(search(data, " h ", "Senin"), []);
});

test("search finds a lecturer by code: today's class first, then their office", () => {
  const results = search(data, "hf", "Senin");
  assert.deepEqual(results.map((r) => [r.result_type, r.room_name]), [["schedule", "IF_101"], ["dosen", "IF_233"]]);
  assert.equal(results[0].lantai, "Lantai 1");
  assert.deepEqual(results[1].occupants, ["Rizky Januar Akbar, S.Kom., M.Eng.", "Hadziq Fabroyir, S.Kom., Ph.D."]);
});

test("search shows schedules only for the given weekday", () => {
  assert.deepEqual(search(data, "Realitas", "Senin"), []);
  assert.equal(search(data, "Realitas", "Selasa").length, 1);
  assert.deepEqual(search(data, "Grafika", "Minggu"), []);
});

test("search finds a room by its description and by its name with spaces", () => {
  assert.deepEqual(search(data, "mushola", "Senin").map((r) => r.room_name), ["IF_202"]);
  assert.deepEqual(search(data, "IF 10", "Minggu").map((r) => [r.result_type, r.room_name]), [["room", "IF_101"]]);
});

test("search does not list a room twice when it already appears as a schedule", () => {
  assert.deepEqual(search(data, "IF_1", "Senin").map((r) => r.result_type), ["room"]);
  assert.deepEqual(search(data, "Grafika", "Senin").map((r) => r.result_type), ["schedule"]);
});

test("search finds a room by its map label", () => {
  const labelled = { ...data, rooms: data.rooms.map((r) => r.nama_ruang === "IF_101" ? { ...r, label_peta: "Ruang Kuliah Besar" } : r) };
  assert.deepEqual(search(labelled, "kuliah besar", "Rabu").map((r) => r.room_name), ["IF_101"]);
});

test("getMapLabels labels a floor's rooms by name, by label_peta, or not at all", () => {
  const rooms = [
    { nama_ruang: "IF_202",         lantai: "Lantai 2", label_peta: "Mushola" },
    { nama_ruang: "IF_233",         lantai: "Lantai 2", label_peta: null },
    { nama_ruang: "Aula Handayani", lantai: "Lantai 2", label_peta: null },
    { nama_ruang: "IF_237",         lantai: "Lantai 2", label_peta: "-" },
    { nama_ruang: "IF_101",         lantai: "Lantai 1", label_peta: null },
  ];
  assert.deepEqual(getMapLabels({ rooms }, "Lantai 2"), [
    { meshes: ["IF_202"],         text: "Mushola" },
    { meshes: ["IF_233"],         text: "IF 233" },
    { meshes: ["Aula_Handayani"], text: "Aula Handayani" },
  ]);
});

test("getMapLabels gives the toilets on one side of a floor one shared pictogram", () => {
  const rooms = [
    { nama_ruang: "Toilet_Perempuan_Utara_L2",  lantai: "Lantai 2", label_peta: null },
    { nama_ruang: "Toilet_Laki-laki_Utara_L2",  lantai: "Lantai 2", label_peta: null },
    { nama_ruang: "Toilet_Laki-laki_Selatan_L2", lantai: "Lantai 2", label_peta: null },
    { nama_ruang: "Toilet_Perempuan_Selatan_L2", lantai: "Lantai 2", label_peta: "Toilet Dosen" },
  ];
  assert.deepEqual(getMapLabels({ rooms }, "Lantai 2"), [
    { meshes: ["Toilet_Perempuan_Utara_L2", "Toilet_Laki-laki_Utara_L2"], toilet: ["Laki-laki", "Perempuan"] },
    { meshes: ["Toilet_Laki-laki_Selatan_L2"], toilet: ["Laki-laki"] },
    { meshes: ["Toilet_Perempuan_Selatan_L2"], text: "Toilet Dosen" },
  ]);
});

test("glueShortWords keeps room codes on one line but lets longer names wrap", () => {
  const nbsp = " ";
  assert.equal(glueShortWords("IF 218"), `IF${nbsp}218`);
  assert.equal(glueShortWords("LP 1"), `LP${nbsp}1`);
  assert.equal(glueShortWords("Co Working Space IUP"), `Co${nbsp}Working Space IUP`);
  assert.equal(glueShortWords("Ruang Sidang"), "Ruang Sidang");
  assert.equal(glueShortWords("NETICS"), "NETICS");
});

test("getMapLabels groups current toilet names into pictograms", () => {
  const rooms = [
    { nama_ruang: "Toilet_Utara_L1_Mahasiswi", lantai: "Lantai 1", label_peta: null },
    { nama_ruang: "Toilet_Utara_L1_Mahasiswa", lantai: "Lantai 1", label_peta: null },
    { nama_ruang: "Toilet_Selatan_Pegawai_Perempuan", lantai: "Lantai 2", label_peta: null },
    { nama_ruang: "Toilet_Selatan_Pegawai_Laki-laki", lantai: "Lantai 2", label_peta: null },
    { nama_ruang: "Toilet_Utara_Pegawai_Perempuan", lantai: "Lantai 2", label_peta: null },
    { nama_ruang: "Toilet_Utara_Pegawai_Laki-laki", lantai: "Lantai 2", label_peta: null },
    { nama_ruang: "Toilet_Selatan_L3_Mahasiswi", lantai: "Lantai 3", label_peta: null },
    { nama_ruang: "Toilet_Selatan_L3_Mahasiswa", lantai: "Lantai 3", label_peta: null },
  ];
  assert.deepEqual(getMapLabels({ rooms }, "Lantai 1"), [
    { meshes: ["Toilet_Utara_L1_Mahasiswi", "Toilet_Utara_L1_Mahasiswa"], toilet: ["Laki-laki", "Perempuan"] },
  ]);
  assert.deepEqual(getMapLabels({ rooms }, "Lantai 2"), [
    { meshes: ["Toilet_Selatan_Pegawai_Perempuan", "Toilet_Selatan_Pegawai_Laki-laki"], toilet: ["Laki-laki", "Perempuan"] },
    { meshes: ["Toilet_Utara_Pegawai_Perempuan", "Toilet_Utara_Pegawai_Laki-laki"], toilet: ["Laki-laki", "Perempuan"] },
  ]);
  assert.deepEqual(getMapLabels({ rooms }, "Lantai 3"), [
    { meshes: ["Toilet_Selatan_L3_Mahasiswi", "Toilet_Selatan_L3_Mahasiswa"], toilet: ["Laki-laki", "Perempuan"] },
  ]);
});
