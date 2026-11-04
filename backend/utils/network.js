const { networkInterfaces } = require("os");

/**
 * Best-effort LAN address of this machine, used to build the QR-code URL the
 * phone scans. Prefers a real private address over a virtual-adapter gateway
 * (Docker/VMware hand out .1 and .254), then any private address, then any
 * external IPv4 at all.
 */
function getLocalIP() {
  const nets = networkInterfaces();
  const isPrivate = (addr) =>
    /^192\.168\./.test(addr) ||
    /^10\./.test(addr) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(addr);

  const isVirtualGateway = (addr) => addr.endsWith(".1") || addr.endsWith(".254");

  const candidates = Object.values(nets).flat().filter(Boolean);
  const external   = candidates.filter((net) => net.family === "IPv4" && !net.internal);

  return (
    external.find((net) => isPrivate(net.address) && !isVirtualGateway(net.address))?.address ||
    external.find((net) => isPrivate(net.address))?.address ||
    external[0]?.address ||
    "localhost"
  );
}

module.exports = { getLocalIP };
