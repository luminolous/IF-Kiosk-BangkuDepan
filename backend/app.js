const express = require("express");
const path    = require("path");

const app = express();

// Serves a local build of the kiosk (built with the default base "/"), so a
// kiosk on a LAN without internet still works: one process, one port, and
// the phone reaches the relay on the same origin it loaded the page from.
// express.static answers /mobile/ from the mobile/index.html the build emits.
const frontendDist = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendDist));

module.exports = app;
