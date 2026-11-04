export const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

export const FLOORS = ["Lantai 1", "Lantai 2", "Lantai 3", "Lantai 4"];
export const MENU_FLOORS = FLOORS.filter((floor) => floor !== "Lantai 4");

export function getExt(name) { return name.split(".").pop().toLowerCase(); }

const BLUE = "#5b7fff";
const BLUE_RGB = "91,127,255";
const BLUE_GLOW_RGB = "91,127,255";
const GREEN = "#22c55e";
const GREEN_RGB = "34,197,94";
// Cyan stands out against both the terracotta floor and the white walls of
// the floor models.
const LIVE = "#22d3ee";
const LIVE_RGB = "34,211,238";

export const C = {
  bg:        "#060d0f",
  sidebar:   "#080f12",
  card:      "#0b1316",
  border:    "#142025",
  cyan:      BLUE,
  cyanDim:   `rgba(${BLUE_RGB},0.16)`,
  cyanGlow:  `0 0 12px rgba(${BLUE_GLOW_RGB},0.55)`,
  green:     GREEN,
  greenGlow: `0 0 12px rgba(${GREEN_RGB},0.55)`,
  // Classes in progress, on the idle board and the 3D map.
  live:      LIVE,
  liveDim:   `rgba(${LIVE_RGB},0.12)`,
  liveGlow:  `0 0 12px rgba(${LIVE_RGB},0.45)`,
  blue:      BLUE,
  blueDim:   `rgba(${BLUE_RGB},0.16)`,
  blueGlow:  `0 0 12px rgba(${BLUE_GLOW_RGB},0.55)`,
  text:      "#c8d8f0",
  muted:     "#3a4460",
  sub:       "#6a7890",
};

export const EXCLUDE = /pillar|box|TV|lantai|tangga|pintu|sebelah/i;


export const groupMeshNames = (names) => {
  const seen = new Set();
  const result = [];
  for (const name of names) {
    if (!seen.has(name)) { seen.add(name); result.push(name); }
  }
  return result;
};

// Classify a TC-model mesh to a floor index by name before falling back to Y position.
// This prevents exterior/structural geometry (Plaza_Supeno, IF_1xx rooms) from being
// mis-assigned when bounding-box extents distort the Y-based boundaries.
export const tcFloorByName = (name) => {
  const ifM = name.match(/^IF_([1-4])/i);
  if (ifM) return parseInt(ifM[1]) - 1;
  const lM = name.match(/^lantai[_\s]*([1-4])$/i);
  if (lM) return parseInt(lM[1]) - 1;
  const tM = name.match(/tembok.*lantai[_\s]*([1-4])/i);
  if (tM) return parseInt(tM[1]) - 1;
  if (/^plaza/i.test(name)) return 0;
  return -1;
};

const roomSort = (a, b) => {
  const isToilet = (n) => /toilet|wc|km|kamar/i.test(n);
  const ta = isToilet(a), tb = isToilet(b);
  if (ta !== tb) return ta ? 1 : -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
};

const LANTAI3_ORDER = [
  (n) => /\bRPL\b/i.test(n),
  (n) => /\bKBJ\b/i.test(n),
  (n) => /\bKCV\b/i.test(n),
  (n) => /\bLP.?1\b/i.test(n),
  (n) => /\bHMTC\b/i.test(n),
  (n) => /pascasarjana/i.test(n),
  (n) => /\bnetics\b/i.test(n),
  (n) => /\bgiga\b/i.test(n),
  (n) => /co.{0,5}working/i.test(n) || /\bIUP\b/i.test(n),
  (n) => /\bLP.?2\b/i.test(n),
  (n) => /\balpro\b/i.test(n),
  (n) => /\bMCI\b/i.test(n),
  (n) => /\bPKT\b/i.test(n),
  (n) => /toilet|wc|km|kamar/i.test(n),
];

const makeFloorSort = (matchers) => (a, b) => {
  const asDisplay = (n) => n.replace(/_/g, " ");
  const getIdx = (n) => {
    const d = asDisplay(n);
    for (let i = 0; i < matchers.length; i++) {
      if (matchers[i](n) || matchers[i](d)) return i;
    }
    return matchers.length;
  };
  const ia = getIdx(a), ib = getIdx(b);
  if (ia !== ib) return ia - ib;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
};

export const getRoomSort = (floorName) => {
  if (floorName === "Lantai 3") return makeFloorSort(LANTAI3_ORDER);
  return roomSort;
};

export const displayName = (name) => name.replace(/_/g, " ");
