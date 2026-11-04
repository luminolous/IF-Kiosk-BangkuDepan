import { asset } from "./config";

let cached = null;

/**
 * The kiosk data, fetched once and shared by every caller. Pass
 * { fresh: true } to bypass both this cache and the browser's, which is how
 * the kiosk notices that a new version has been deployed.
 */
export function loadData({ fresh = false } = {}) {
  if (fresh) {
    return fetch(asset("data/kiosk.json"), { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`kiosk.json: HTTP ${r.status}`);
      return r.json();
    });
  }
  cached ??= loadData({ fresh: true }).catch((err) => { cached = null; throw err; });
  return cached;
}
