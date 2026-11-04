// Camera moves that the phone remote asks the kiosk to make, in screen
// pixels of the phone's touch pad. Each moves an OrbitControls camera
// (camera + controls.target) the way the matching touch gesture on the
// kiosk's own screen would, so both ways of steering feel the same.

import * as THREE from "three";

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Orbits the camera around its target: dx turns it, dy tilts it. */
export function rotateBy(camera, controls, dx, dy) {
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
  const sph = new THREE.Spherical().setFromVector3(offset);
  sph.theta -= dx * 0.005;
  sph.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - dy * 0.005));
  offset.setFromSpherical(sph);
  camera.position.copy(controls.target).add(offset);
}

/** Moves the camera towards (scale < 1) or away from (scale > 1) its target. */
export function zoomBy(camera, controls, scale) {
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
  offset.setLength(Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() * scale)));
  camera.position.copy(controls.target).add(offset);
}

/**
 * Slides the camera and its target together, so the model follows the finger.
 *
 * With `ground`, the slide stays on the horizontal floor plane: dragging up
 * walks into the building instead of lifting the camera into the sky. This
 * is how a map pans, and how OrbitControls pans with screenSpacePanning off.
 * Without it, the slide is in the plane of the screen.
 */
export function panBy(camera, controls, dx, dy, { ground = false } = {}) {
  const speed = camera.position.distanceTo(controls.target) * 0.002;
  const dir   = camera.getWorldDirection(new THREE.Vector3());
  const right = new THREE.Vector3();
  const ahead = new THREE.Vector3();

  if (ground) {
    ahead.set(dir.x, 0, dir.z);
    // Looking straight down there is no horizontal "ahead"; the top of the
    // screen points the way instead.
    if (ahead.lengthSq() < 1e-8) ahead.copy(camera.up).applyQuaternion(camera.quaternion).setY(0);
    ahead.normalize();
    right.crossVectors(ahead, WORLD_UP).normalize();
  } else {
    right.crossVectors(dir, WORLD_UP).normalize();
    ahead.crossVectors(right, dir).normalize();
  }

  const offset = new THREE.Vector3()
    .addScaledVector(right, -dx * speed)
    .addScaledVector(ahead,  dy * speed);
  camera.position.add(offset);
  controls.target.add(offset);
}
