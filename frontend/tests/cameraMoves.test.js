import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { panBy, rotateBy, zoomBy } from "../src/lib/cameraMoves.js";

// A camera 20 units back from the origin and 20 up, looking at it: tilted
// 45°, as the kiosk shows a floor.
function rig(position = [0, 20, 20]) {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  camera.position.set(...position);
  const controls = { target: new THREE.Vector3(0, 0, 0), minDistance: 1, maxDistance: 200 };
  camera.lookAt(controls.target);
  camera.updateMatrixWorld();
  return { camera, controls };
}

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≉ ${b}`);

test("a ground pan stays on the floor plane, however the camera is tilted", () => {
  const { camera, controls } = rig();
  panBy(camera, controls, 30, 40, { ground: true });
  close(camera.position.y, 20);
  close(controls.target.y, 0);
});

test("dragging down on a ground pan pulls the far side of the floor towards the viewer", () => {
  const { camera, controls } = rig();
  panBy(camera, controls, 0, 50, { ground: true });
  // The camera looks towards -z, so it moves that way, into the building.
  assert.ok(controls.target.z < 0);
  close(controls.target.x, 0);
});

test("dragging right moves the camera left, so the model follows the finger", () => {
  const { camera, controls } = rig();
  panBy(camera, controls, 50, 0, { ground: true });
  assert.ok(controls.target.x < 0);
  close(controls.target.z, 0);
});

test("a ground pan still works when looking straight down", () => {
  const { camera, controls } = rig([0, 30, 0.0001]);
  panBy(camera, controls, 20, 20, { ground: true });
  for (const v of [camera.position, controls.target]) assert.ok([v.x, v.y, v.z].every(Number.isFinite));
  close(camera.position.y, 30);
  assert.ok(controls.target.length() > 0);
});

test("a screen pan moves in the plane of the screen, as before", () => {
  const { camera, controls } = rig();
  panBy(camera, controls, 0, 50);
  assert.ok(controls.target.y > 0, "dragging down lifts the camera, and the model follows the finger down");
});

test("rotating keeps the distance to the target, and zoom stays within its limits", () => {
  const { camera, controls } = rig();
  const distance = camera.position.distanceTo(controls.target);
  rotateBy(camera, controls, 120, -40);
  close(camera.position.distanceTo(controls.target), distance);

  zoomBy(camera, controls, 0.001);
  close(camera.position.distanceTo(controls.target), controls.minDistance);
  zoomBy(camera, controls, 1e6);
  close(camera.position.distanceTo(controls.target), controls.maxDistance);
});
