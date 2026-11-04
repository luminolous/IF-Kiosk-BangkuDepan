// The hosted relay that pairs a kiosk screen with a phone. It speaks the same
// protocol as the local relay in backend/ws/index.js, and passes the same
// tests (backend/tests/relay.test.js):
//
//   /ws?role=tv               opens a session; the kiosk receives { type: "session", sid }
//   /ws?role=phone&sid=<id>   joins it; from then on messages are relayed verbatim
//
// Each session is one Durable Object, addressed by its sid, so the kiosk and
// the phone meet in the same place wherever in the world they connect from.
// The object uses the WebSocket Hibernation API: while nobody is sending, it
// is evicted from memory and costs nothing, but its sockets stay open.

import { DurableObject } from "cloudflare:workers";

// A phone that sends nothing for this long is dropped, freeing the session.
const PHONE_IDLE_MS = 60 * 1000;

const SID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Completes the WebSocket handshake only to close it at once with a code,
 * which is how the protocol rejects a connection (1008, or 1000 for a
 * session that already has a phone). A plain HTTP error would reach the
 * browser as an anonymous failure.
 */
function reject(code, reason) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.close(code, reason);
  return new Response(null, { status: 101, webSocket: client });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/ws") {
      return new Response(url.pathname === "/" ? "IF Kiosk relay\n" : "Not found\n", { status: url.pathname === "/" ? 200 : 404 });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade\n", { status: 426 });
    }

    // Browsers always send Origin, so this keeps other websites from using the
    // relay. It is not authentication: a non-browser client can send anything.
    const origin  = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
    if (origin && !allowed.includes(origin)) return new Response("Origin not allowed\n", { status: 403 });

    const role = url.searchParams.get("role");
    let sid    = url.searchParams.get("sid");
    if (role === "tv") sid = crypto.randomUUID();
    else if (role !== "phone" || !sid || !SID.test(sid)) return reject(1008, "Invalid params");

    const session = env.SESSIONS.get(env.SESSIONS.idFromName(sid));
    return session.fetch(new Request(`https://session/${role}?sid=${sid}`, request));
  },
};

export class Session extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // The kiosk pings to keep an idle connection from being dropped. Answering
    // here does not wake the object, so an idle kiosk costs nothing.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** Closes a phone from this side, marked so webSocketClose does not answer twice. */
  closePhone(phone, reason) {
    phone.serializeAttachment({ closedByRelay: true });
    phone.close(1000, reason);
  }

  open(role) {
    return this.ctx.getWebSockets(role).filter((ws) => ws.readyState === WebSocket.OPEN);
  }

  async fetch(request) {
    const url  = new URL(request.url);
    const role = url.pathname.slice(1);
    const [tv] = this.open("tv");

    if (role === "phone") {
      if (!tv) return reject(1008, "Invalid params");
      if (this.open("phone").length > 0) return reject(1000, "session already in use");
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [role]);

    if (role === "tv") {
      server.send(JSON.stringify({ type: "session", sid: url.searchParams.get("sid") }));
    } else {
      tv.send(JSON.stringify({ type: "phoneConnected" }));
      await this.ctx.storage.setAlarm(Date.now() + PHONE_IDLE_MS);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const [role] = this.ctx.getTags(ws);
    if (role === "phone") {
      await this.ctx.storage.setAlarm(Date.now() + PHONE_IDLE_MS);
      for (const tv of this.open("tv")) tv.send(message);
    } else {
      for (const phone of this.open("phone")) phone.send(message);
    }
  }

  async webSocketClose(ws, code, reason) {
    const [role] = this.ctx.getTags(ws);
    // Answer the close frame, or the client waits for a reply that never comes.
    // 1005 ("no code given") and 1006 cannot be sent back, so answer 1000.
    if (!ws.deserializeAttachment()?.closedByRelay) ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);

    if (role === "phone") {
      await this.ctx.storage.deleteAlarm();
      for (const tv of this.open("tv")) tv.send(JSON.stringify({ type: "phoneDisconnected" }));
    } else {
      // Without its kiosk the session is over; its QR code is gone too.
      for (const phone of this.open("phone")) this.closePhone(phone, "session ended");
    }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws, 1011, "error");
  }

  async alarm() {
    for (const phone of this.open("phone")) this.closePhone(phone, "idle");
  }
}
