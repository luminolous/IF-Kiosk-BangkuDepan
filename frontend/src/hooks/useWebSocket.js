import { useEffect, useRef, useState } from "react";
import { BASE, GESTURES, RELAY_URL } from "../lib/config";

/**
 * Origin the phone should load the app from. Normally the kiosk's own. When
 * the kiosk is opened as localhost, a phone cannot reach that, so use the LAN
 * address a local relay reports, or the public URL it was configured with.
 */
function phoneOrigin({ mobileOrigin, lanAddress }) {
  if (mobileOrigin) return mobileOrigin.replace(/\/+$/, "");
  const { protocol, hostname, port, origin } = window.location;
  if (lanAddress && /^(localhost|127\.|\[::1\]$)/.test(hostname)) {
    return `${protocol}//${lanAddress}${port ? `:${port}` : ""}`;
  }
  return origin;
}

// How often the kiosk pings the relay while waiting for a phone.
const PING_MS = 30 * 1000;

/**
 * The URL in the QR code. The phone loads the same build, so it knows the
 * relay already; it only needs the session, and the gestures if not default.
 */
const buildMobileUrl = (msg) =>
  `${phoneOrigin(msg)}${BASE}mobile/?sid=${encodeURIComponent(msg.sid)}${GESTURES === "map" ? "" : `&gestures=${GESTURES}`}`;

/**
 * Connects the TV browser to the WebSocket relay. With no relay configured
 * (RELAY_URL is null) it does nothing, and mobileUrl stays empty so no QR
 * code is shown.
 *
 * @param {object} callbacks
 * @param {(action, payload) => void} callbacks.onCmd         - called when phone sends a command
 * @param {() => void}                callbacks.onPhoneConnect - called when phone pairs (use to sync state)
 *
 * @returns {{ mobileUrl, phoneConnected, sendState }}
 *   - mobileUrl:      URL encoded in the QR code (empty until session is established)
 *   - phoneConnected: true while a phone is paired to this session
 *   - sendState:      call this to push current app state to the phone
 */
export function useTVWebSocket({ onCmd, onPhoneConnect, onPhoneDisconnect }) {
  const wsRef          = useRef(null);
  const onCmdRef       = useRef(onCmd);
  const onConnectRef   = useRef(onPhoneConnect);
  const onDisconnectRef = useRef(onPhoneDisconnect);
  const retryRef       = useRef(null);

  const [mobileUrl,      setMobileUrl]      = useState("");
  const [phoneConnected, setPhoneConnected] = useState(false);

  // keep callbacks fresh on every render without re-running the effect
  onCmdRef.current     = onCmd;
  onConnectRef.current = onPhoneConnect;
  onDisconnectRef.current = onPhoneDisconnect;

  const sendState = (state) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "state", ...state }));
    }
  };

  useEffect(() => {
    if (!RELAY_URL) return;
    let active = true;
    let pingTimer = null;

    function connect() {
      const ws = new WebSocket(`${RELAY_URL}/ws?role=tv`);

      ws.onopen = () => {
        if (!active) { ws.close(); return; }
        wsRef.current = ws;
        // A kiosk can sit for hours with no phone. Keep the connection from
        // being dropped as idle; the relay answers "pong" without waking up.
        pingTimer = setInterval(() => ws.send("ping"), PING_MS);
      };

      ws.onmessage = (e) => {
        if (!active || e.data === "pong") return;
        const msg = JSON.parse(e.data);

        if (msg.type === "session") {
          setMobileUrl(buildMobileUrl(msg));
        }
        if (msg.type === "phoneConnected") {
          setPhoneConnected(true);
          // small delay so React state has settled before we broadcast
          setTimeout(() => onConnectRef.current?.(), 100);
        }
        if (msg.type === "phoneDisconnected") {
          setPhoneConnected(false);
          onDisconnectRef.current?.();
        }
        if (msg.type === "cmd") {
          onCmdRef.current?.(msg.action, msg.payload);
        }
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        if (!active) return;
        wsRef.current = null;
        // Keep mobileUrl so QR stays visible; only reset connected status
        setPhoneConnected(false);
        // Reconnect after a short delay to get a fresh session
        retryRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      active = false;
      clearInterval(pingTimer);
      clearTimeout(retryRef.current);
      const ws = wsRef.current;
      wsRef.current = null;
      // only close if already OPEN — avoids StrictMode "closed before
      // established" warning when the cleanup fires mid-handshake
      if (ws?.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  return { mobileUrl, phoneConnected, sendState };
}
