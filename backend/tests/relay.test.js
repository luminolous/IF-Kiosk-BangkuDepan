// The relay protocol, as tests. They run against the local relay in this
// package, or, with RELAY_TEST_URL set, against any other relay: relay/'s
// test script points them at the Cloudflare Worker running in wrangler dev.
// Both relays must pass the same cases, so the protocol stays one protocol.

const WebSocket = require("ws");

const REMOTE = process.env.RELAY_TEST_URL;
// The cases describe the default setup, so a developer's backend/.env must not
// change it. dotenv never overrides a variable that is already set.
if (!REMOTE) process.env.PUBLIC_FRONTEND_URL = "";
const server = REMOTE ? null : require("../index");

function getWsUrl(path) {
  return REMOTE ? `${REMOTE}${path}` : `ws://localhost:${server.address().port}${path}`;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Open a WebSocket and return { ws, firstMessage } promise */
function connectWs(path) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(getWsUrl(path));
    const firstMessage = waitForMessage(ws);
    firstMessage.catch(() => {}); // not every caller awaits it
    ws.once("open",    ()    => resolve({ ws, firstMessage }));
    ws.once("error",   (err) => reject(err));
    ws.once("close",   (code, reason) => reject(new Error(`Closed ${code}: ${reason}`)));
  });
}

/** Wait for the next message on a WebSocket */
function waitForMessage(ws, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("WS message timeout")), timeoutMs);
    ws.once("message", (data) => { clearTimeout(t); resolve(JSON.parse(data.toString())); });
  });
}

/** Wait for a WebSocket to close */
function waitForClose(ws, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ code: -1 }), timeoutMs);
    ws.once("close", (code, reason) => { clearTimeout(t); resolve({ code, reason: reason.toString() }); });
  });
}

// ── WebSocket ────────────────────────────────────────────────────────

describe("WebSocket /ws", () => {
  beforeAll((done) => { if (server) server.listen(0, done); else done(); });
  afterAll((done) => { if (server) server.close(done); else done(); });

  it("tv role receives a session message with a sid", async () => {
    const { ws, firstMessage } = await connectWs("/ws?role=tv");
    const msg = await firstMessage;
    expect(msg.type).toBe("session");
    expect(typeof msg.sid).toBe("string");
    expect(msg.sid.length).toBeGreaterThan(0);
    // Only the local relay knows a LAN address worth putting in the QR code.
    if (!REMOTE) expect(typeof msg.lanAddress).toBe("string");
    ws.close();
  });

  it("answers the kiosk's ping with pong", async () => {
    const { ws, firstMessage } = await connectWs("/ws?role=tv");
    await firstMessage;
    const reply = new Promise((resolve) => ws.once("message", (data) => resolve(data.toString())));
    ws.send("ping");
    expect(await reply).toBe("pong");
    ws.close();
  });

  it("ends the phone's session when the kiosk leaves", async () => {
    const { ws: tvWs, firstMessage } = await connectWs("/ws?role=tv");
    const { sid } = await firstMessage;

    const phoneConnected = waitForMessage(tvWs);
    const { ws: phoneWs } = await connectWs(`/ws?role=phone&sid=${sid}`);
    await phoneConnected;

    // Against wrangler dev the close frame arrives at once, but the TCP
    // connection lingers about 10 s and this client reports the close only
    // then. Chromium reports it within a fraction of a second.
    const phoneClosed = waitForClose(phoneWs, 15000);
    tvWs.close();
    expect(await phoneClosed).toEqual({ code: 1000, reason: "session ended" });

    const late = new WebSocket(getWsUrl(`/ws?role=phone&sid=${sid}`));
    expect((await waitForClose(late)).code).toBe(1008);
  }, 20000);

  it.each([
    ["phone with a malformed sid", "/ws?role=phone&sid=INVALID-SID-THAT-DOES-NOT-EXIST"],
    ["phone with an unknown sid",  "/ws?role=phone&sid=00000000-0000-4000-8000-000000000000"],
    ["phone with no sid",         "/ws?role=phone"],
    ["an unknown role",           "/ws?role=unknown"],
  ])("rejects %s with close code 1008", async (_label, path) => {
    const ws = new WebSocket(getWsUrl(path));
    const { code } = await waitForClose(ws);
    expect(code).toBe(1008);
  });

  it("pairing notifies the tv on phone connect and disconnect", async () => {
    const { ws: tvWs, firstMessage } = await connectWs("/ws?role=tv");
    const { sid } = await firstMessage;

    const tvNext  = waitForMessage(tvWs);
    const { ws: phoneWs } = await connectWs(`/ws?role=phone&sid=${sid}`);
    expect((await tvNext).type).toBe("phoneConnected");

    const tvDisconnect = waitForMessage(tvWs);
    phoneWs.close();
    expect((await tvDisconnect).type).toBe("phoneDisconnected");

    tvWs.close();
  });

  it("relays messages both ways", async () => {
    const { ws: tvWs, firstMessage } = await connectWs("/ws?role=tv");
    const { sid } = await firstMessage;

    const phoneConnected = waitForMessage(tvWs);
    const { ws: phoneWs } = await connectWs(`/ws?role=phone&sid=${sid}`);
    await phoneConnected;

    const atTv = waitForMessage(tvWs);
    phoneWs.send(JSON.stringify({ type: "cmd", action: "selectFloor", payload: "Lantai 2" }));
    expect(await atTv).toEqual({ type: "cmd", action: "selectFloor", payload: "Lantai 2" });

    const atPhone = waitForMessage(phoneWs);
    tvWs.send(JSON.stringify({ type: "state", floor: "Lantai 2" }));
    expect(await atPhone).toEqual({ type: "state", floor: "Lantai 2" });

    phoneWs.close();
    tvWs.close();
  });

  it("closes a second phone on the same session with code 1000", async () => {
    const { ws: tvWs, firstMessage } = await connectWs("/ws?role=tv");
    const { sid } = await firstMessage;

    const phoneConnected = waitForMessage(tvWs);
    const { ws: phoneWs } = await connectWs(`/ws?role=phone&sid=${sid}`);
    await phoneConnected;

    const second = new WebSocket(getWsUrl(`/ws?role=phone&sid=${sid}`));
    const { code, reason } = await waitForClose(second);
    expect(code).toBe(1000);
    expect(reason).toBe("session already in use");

    phoneWs.close();
    tvWs.close();
  });
});
