import { test } from "node:test";
import assert from "node:assert/strict";

import { FLOORS, MENU_FLOORS } from "../src/lib/constants.js";

test("Lantai 4 remains available internally but is hidden from floor menus", () => {
  assert.ok(FLOORS.includes("Lantai 4"));
  assert.deepEqual(MENU_FLOORS, ["Lantai 1", "Lantai 2", "Lantai 3"]);
});
