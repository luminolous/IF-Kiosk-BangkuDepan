import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildData, parseCsv, readMeshNames } from "../scripts/build-data.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

const tables = (overrides = {}) => ({
  ruangan:  parseCsv("nama_ruang,lantai,kelas,lab,ruang_dosen,ruangan,keterangan\nIF_101,Lantai 1,1,,,,\nIF_233,Lantai 2,,,1,,\n"),
  dosen:    parseCsv('kode,nama\nHF,"Hadziq Fabroyir, S.Kom., Ph.D."\nRJ,"Rizky Januar Akbar, S.Kom., M.Eng."\n'),
  penghuni: parseCsv("nama_ruang,kode_dosen\nIF_233,RJ\nIF_233,HF\n"),
  jadwal:   parseCsv("hari,jam_mulai,jam_selesai,nama_ruang,mata_kuliah,dosen_1,dosen_2,dosen_3\nSenin,07:00,09:50,IF_101,Grafika Komputer,HF,RJ,\n"),
  ...overrides,
});

test("parseCsv handles quotes, a BOM, CRLF and Excel's semicolon separator", () => {
  const rows = parseCsv('﻿kode;nama\r\nHF;"Fabroyir; ""Hadziq"""\r\n\r\n');
  assert.deepEqual(rows, [{ line: 2, row: { kode: "HF", nama: 'Fabroyir; "Hadziq"' }, extra: 0 }]);
});

test("parseCsv reports the line of each record, counting quoted line breaks", () => {
  const rows = parseCsv('a,b\n1,"x\ny"\n2,z\n');
  assert.deepEqual(rows.map((r) => r.line), [2, 4]);
});

test("buildData resolves codes and keeps the occupant order of the CSV", () => {
  const { data, errors } = buildData(tables());
  assert.deepEqual(errors, []);
  assert.deepEqual(data.occupants, { IF_233: ["RJ", "HF"] });
  assert.deepEqual(data.jadwal[0].dosen, ["HF", "RJ"]);
  assert.equal(data.rooms[0].is_kelas, true);
  assert.equal(data.rooms[0].is_lab, false);
  assert.match(data.version, /^[0-9a-f]{12}$/);
});

test("buildData keeps a room's map label, and leaves it null when the column is empty or missing", () => {
  const { data } = buildData(tables({
    ruangan: parseCsv("nama_ruang,lantai,kelas,lab,ruang_dosen,ruangan,keterangan,label_peta\nIF_101,Lantai 1,1,,,,,\nIF_233,Lantai 2,,,1,,,Ruang Dosen\n"),
  }));
  assert.deepEqual(data.rooms.map((r) => r.label_peta), [null, "Ruang Dosen"]);
  assert.equal(buildData(tables()).data.rooms[0].label_peta, null);
});

test("buildData turns every silent failure of the old SQL seeds into an error with its line", () => {
  const { errors } = buildData(tables({
    penghuni: parseCsv("nama_ruang,kode_dosen\nIF_233,XX\nIF_999,HF\n"),
    jadwal:   parseCsv("hari,jam_mulai,jam_selesai,nama_ruang,mata_kuliah,dosen_1,dosen_2,dosen_3\nSabtu,7:00,09:50,IF_233,Grafika,HF,ZZ,\n"),
  }));
  assert.deepEqual(errors, [
    'penghuni.csv:2: kode dosen "XX" tidak ada di dosen.csv',
    'penghuni.csv:3: ruangan "IF_999" tidak ada di ruangan.csv',
    'jadwal.csv:2: hari "Sabtu" tidak dikenal; pilih salah satu: Senin, Selasa, Rabu, Kamis, Jumat',
    'jadwal.csv:2: jam_mulai "7:00" harus berformat JJ:MM, misalnya 07:00',
    'jadwal.csv:2: kode dosen "ZZ" tidak ada di dosen.csv',
    "jadwal.csv:2: IF_233 tidak ditandai kelas di ruangan.csv, jadi jadwalnya tidak akan tampil",
  ]);
});

test("buildData rejects a room with no mesh of that name in its floor model", () => {
  const meshNames = { "Lantai 1": new Set(["IF_101"]), "Lantai 2": new Set(["IF_233", "Tangga"]) };
  assert.deepEqual(buildData(tables(), { meshNames }).errors, []);

  const { errors } = buildData(tables(), { meshNames: { ...meshNames, "Lantai 1": new Set(["IF_102"]) } });
  assert.match(errors[0], /^ruangan\.csv:2: tidak ada mesh bernama IF_101 di model Lantai 1\.obj/);
});

test("buildData rejects a row with more fields than the header, as an unquoted comma produces", () => {
  const { errors } = buildData(tables({ dosen: parseCsv("kode,nama\nHF,Hadziq Fabroyir, S.Kom., Ph.D.\nRJ,Rizky\n") }));
  assert.deepEqual(errors, [
    "dosen.csv:2: ada 2 kolom lebih banyak dari judul kolom; nilai yang mengandung koma harus diapit tanda kutip",
  ]);
});

test("buildData rejects a missing floor model", () => {
  const meshNames = { "Lantai 1": null, "Lantai 2": new Set(["IF_233"]) };
  assert.deepEqual(buildData(tables(), { meshNames }).errors, [
    "model Lantai 1.obj tidak ditemukan di public/models; kiosk tidak bisa memuat lantai ini",
  ]);
});

test("buildData reports every class that overlaps a long one, not only its neighbour", () => {
  const { warnings } = buildData(tables({
    jadwal: parseCsv("hari,jam_mulai,jam_selesai,nama_ruang,mata_kuliah,dosen_1,dosen_2,dosen_3\n" +
      "Senin,07:00,12:00,IF_101,A,HF,,\nSenin,08:00,09:00,IF_101,B,HF,,\nSenin,10:00,11:00,IF_101,C,HF,,\nSenin,12:00,13:00,IF_101,D,HF,,\n"),
  }), { photos: new Set(["HF", "RJ"]) });
  assert.deepEqual(warnings.map((w) => w.replace(/ di IF_101.*/, "")), [
    "jadwal.csv:3: B bentrok dengan A (baris 2)",
    "jadwal.csv:4: C bentrok dengan A (baris 2)",
  ]);
});

test("buildData warns when a lecturer teaches in two rooms at overlapping times", () => {
  const { warnings } = buildData(tables({
    ruangan: parseCsv("nama_ruang,lantai,kelas,lab,ruang_dosen,ruangan,keterangan\nIF_101,Lantai 1,1,,,,\nIF_102,Lantai 1,1,,,,\nIF_233,Lantai 2,,,1,,\n"),
    jadwal:  parseCsv("hari,jam_mulai,jam_selesai,nama_ruang,mata_kuliah,dosen_1,dosen_2,dosen_3\n" +
      "Senin,07:00,09:30,IF_101,A,HF,RJ,\nSenin,09:00,11:30,IF_102,B,RJ,HF,\n" +
      "Senin,09:30,12:00,IF_101,C,HF,,\nSelasa,09:00,11:30,IF_102,D,HF,,\n"),
  }), { photos: new Set(["HF", "RJ"]) });
  assert.deepEqual(warnings, [
    "jadwal.csv:3: RJ, HF mengajar B di IF_102 dan A di IF_101 (baris 2) pada jam yang sama hari Senin",
    "jadwal.csv:4: HF mengajar C di IF_101 dan B di IF_102 (baris 3) pada jam yang sama hari Senin",
  ]);
});

test("buildData warns about overlapping classes and missing photos", () => {
  const { warnings } = buildData(tables({
    jadwal: parseCsv("hari,jam_mulai,jam_selesai,nama_ruang,mata_kuliah,dosen_1,dosen_2,dosen_3\n" +
      "Senin,07:00,09:50,IF_101,A,HF,,\nSenin,09:00,10:50,IF_101,B,RJ,,\n"),
  }), { photos: new Set(["HF"]) });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /^dosen\.csv:3: belum ada foto public\/picture\/RJ\.webp/);
  assert.match(warnings[1], /^jadwal\.csv:3: B bentrok dengan A \(baris 2\)/);
});

test("the CSV files in data/ build without errors against the real models", () => {
  const read = (name) => parseCsv(readFileSync(join(root, "data", `${name}.csv`), "utf8"));
  const { errors } = buildData(
    { ruangan: read("ruangan"), dosen: read("dosen"), penghuni: read("penghuni"), jadwal: read("jadwal") },
    { meshNames: readMeshNames(join(root, "frontend/public/models")) },
  );
  assert.deepEqual(errors, []);
});
