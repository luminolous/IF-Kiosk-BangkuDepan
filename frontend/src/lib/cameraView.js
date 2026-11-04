import * as THREE from "three";

export const DEFAULT_CAMERA_SIZE = new THREE.Vector3(67, 11, 82);

export function applyDefaultCameraView(camera, controls, size = DEFAULT_CAMERA_SIZE, saveState = true, view = null) {
  if (!camera || !controls) return;

  const span = Math.max(size.x, size.z, 1);
  const defaultTarget = new THREE.Vector3(0, Math.max(size.y * 0.35, 1.5), 0);
  const cameraTarget = view?.target ?? view ?? defaultTarget;
  const cameraPosition = view?.position ?? new THREE.Vector3(span * -0.08, span * 0.62, span * 1.28);

  controls.target.copy(cameraTarget);
  camera.position.copy(cameraPosition);
  camera.lookAt(controls.target);
  controls.update();

  if (saveState) controls.saveState();
}

export function getMarkerDefaultCameraView(markerPosition, markerSize, modelSize = DEFAULT_CAMERA_SIZE, mode = "disconnected") {
  const span = Math.max(modelSize.x, modelSize.z, 1);
  const screenLeftOffset = span * (mode === "connected" ? 0.35 : 0.38);

  return {
    target: new THREE.Vector3(
      markerPosition.x + screenLeftOffset,
      markerPosition.y + markerSize * 0.4,
      markerPosition.z - span * 0.18,
    ),
    position: new THREE.Vector3(
      markerPosition.x - span * 0.8 + screenLeftOffset,
      markerPosition.y + span * 0.62,
      markerPosition.z + span * 0.52,
    ),
  };
}
