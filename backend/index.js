require("dotenv").config({ quiet: true });
const http = require("http");
const app  = require("./app");
const { attachWebSocketServer } = require("./ws");

const PORT = process.env.PORT || 8000;

const server = http.createServer(app);
attachWebSocketServer(server);

if (require.main === module) {
  server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

module.exports = server;
