const { WebSocketServer, WebSocket } = require("ws");
const { randomUUID } = require("crypto");
const { getLocalIP } = require("../utils/network");

// A phone that stops sending for this long is dropped, freeing the session.
const PHONE_IDLE_MS = 1 * 60 * 1000;

/**
 * Pairs a kiosk screen ("tv") with a phone that drives it.
 *
 * The TV connects first and is handed a fresh session id, from which it builds
 * the URL in its QR code. The phone connects with that sid; from then on every
 * message is relayed verbatim between the two sockets.
 *
 * This is the local relay, for development and for a kiosk on a LAN. The
 * hosted kiosk uses relay/, a Cloudflare Worker with the same protocol.
 */
function attachWebSocketServer(server) {
  const wss      = new WebSocketServer({ server, path: "/ws" });
  const sessions = new Map();

  wss.on("connection", (ws, req) => {
    const params = new URL(req.url, "http://localhost").searchParams;
    const role   = params.get("role");
    const sid    = params.get("sid");

    if (role === "tv") {
      const newSid = randomUUID();
      sessions.set(newSid, { tv: ws, phone: null });

      // Both hints are only for a kiosk opened as localhost, whose own origin a
      // phone cannot reach; the kiosk ignores lanAddress otherwise.
      ws.send(JSON.stringify({
        type: "session",
        sid:  newSid,
        ...(process.env.PUBLIC_FRONTEND_URL
          ? { mobileOrigin: process.env.PUBLIC_FRONTEND_URL }
          : { lanAddress: getLocalIP() }),
      }));

      ws.on("message", (data) => {
        // The kiosk pings to keep an idle connection open through proxies.
        if (data.toString() === "ping") { ws.send("pong"); return; }
        const session = sessions.get(newSid);
        if (session?.phone?.readyState === WebSocket.OPEN) session.phone.send(data.toString());
      });

      // Without its kiosk the session is over; its QR code is gone too.
      ws.on("close", () => {
        sessions.get(newSid)?.phone?.close(1000, "session ended");
        sessions.delete(newSid);
      });

    } else if (role === "phone" && sid && sessions.has(sid)) {
      const session = sessions.get(sid);
      if (session.phone && session.phone.readyState === WebSocket.OPEN) {
        ws.close(1000, "session already in use");
        return;
      }
      session.phone = ws;

      if (session.tv?.readyState === WebSocket.OPEN) {
        session.tv.send(JSON.stringify({ type: "phoneConnected" }));
      }

      let idleTimer = setTimeout(() => ws.close(1000, "idle"), PHONE_IDLE_MS);
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => ws.close(1000, "idle"), PHONE_IDLE_MS);
      };

      ws.on("message", (data) => {
        resetIdle();
        const s = sessions.get(sid);
        if (s?.tv?.readyState === WebSocket.OPEN) s.tv.send(data.toString());
      });

      ws.on("close", () => {
        clearTimeout(idleTimer);
        const s = sessions.get(sid);
        if (s) {
          s.phone = null;
          if (s.tv?.readyState === WebSocket.OPEN) s.tv.send(JSON.stringify({ type: "phoneDisconnected" }));
        }
      });

    } else {
      ws.close(1008, "Invalid params");
    }
  });

  return wss;
}

module.exports = { attachWebSocketServer, PHONE_IDLE_MS };
