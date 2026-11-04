// Everything that differs between deployments. Kept apart from constants.js
// so that file stays importable from Node (scripts/build-data.js).

// Where the app is served from: "/" locally, "/IF-Kiosk/" on GitHub Pages.
// Set at build time with BASE_PATH (see vite.config.js).
export const BASE = import.meta.env.BASE_URL;

/** Absolute URL path of a file in public/, e.g. asset("models/TC.obj"). */
export const asset = (path) => `${BASE}${path}`;

/**
 * WebSocket relay that pairs the kiosk with a phone, without the /ws suffix.
 *
 * - VITE_RELAY_URL unset: same origin as the page. This is the local backend,
 *   reached directly in production or through the Vite proxy in development.
 * - VITE_RELAY_URL=none: no relay. The kiosk works but shows no QR code.
 * - Anything else: that relay, e.g. wss://if-kiosk-relay.example.workers.dev
 */
const configured = import.meta.env.VITE_RELAY_URL;
export const RELAY_URL =
  configured === "none" ? null
  : configured ? configured.replace(/\/+$/, "")
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

/**
 * Touch gestures for the 3D view, on the kiosk's screen and on the phone.
 *
 * - "map" (default): one finger pans along the floor, two fingers rotate and
 *   pinch to zoom, as in map apps.
 * - "orbit": one finger rotates, two fingers pan and pinch, the OrbitControls
 *   default this kiosk shipped with. Open the kiosk with ?gestures=orbit to
 *   use it; the QR code passes the choice on to the phone.
 */
export const GESTURES =
  new URLSearchParams(window.location.search).get("gestures") === "orbit" ? "orbit" : "map";

/**
 * The kiosk's clock, for the idle board of classes in progress. Open the
 * kiosk with ?sekarang=Senin-09:45 to try the board outside class hours: the
 * clock starts at the next such weekday and time, and runs on from there.
 */
const WEEKDAYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const fakeNow = new URLSearchParams(window.location.search).get("sekarang")?.toLowerCase().match(/^([a-z]+)-(\d{2}):(\d{2})$/);
const clockOffset = (() => {
  if (!fakeNow || !WEEKDAYS.includes(fakeNow[1])) return 0;
  const target = new Date();
  target.setHours(Number(fakeNow[2]), Number(fakeNow[3]), 0, 0);
  target.setDate(target.getDate() + ((WEEKDAYS.indexOf(fakeNow[1]) - target.getDay() + 7) % 7));
  return target.getTime() - Date.now();
})();
export const kioskNow = () => new Date(Date.now() + clockOffset);
