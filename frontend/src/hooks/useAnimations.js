import { useCallback, useRef } from "react";
import * as THREE from "three";
import { FLOORS, tcFloorByName } from "../lib/constants";
import { ROOM_LABELS } from "../lib/roomLabels";

export function useAnimations(sceneRef) {
  const floorAnimRef    = useRef(null);
  const isAnimatingRef  = useRef(false);
  const rotationAnimRef = useRef(null);
  const rotationPivotRef = useRef(null);
  const defaultRotationYRef = useRef(0);

  const getLoadedModel = useCallback(() => sceneRef.current.scene?.getObjectByName("__loaded_model__"), [sceneRef]);

  const cancelRotationAnimation = useCallback(() => {
    if (rotationAnimRef.current) cancelAnimationFrame(rotationAnimRef.current);
    rotationAnimRef.current = null;
  }, []);

  const getIdlePivotPoint = useCallback(() => {
    const model = getLoadedModel();
    if (!model) return null;

    model.updateMatrixWorld(true);
    let plazaMesh = null;
    model.traverse((child) => {
      if (plazaMesh || !child.isMesh || !child.name) return;
      if (/^plaza(_|\b)/i.test(child.name) || /plaza_supeno/i.test(child.name)) {
        plazaMesh = child;
      }
    });

    const box = plazaMesh
      ? new THREE.Box3().setFromObject(plazaMesh)
      : new THREE.Box3().setFromObject(model);
    return box.getCenter(new THREE.Vector3());
  }, [getLoadedModel]);

  const wrapModelInRotationPivot = useCallback(() => {
    if (rotationPivotRef.current) return rotationPivotRef.current;

    const model = getLoadedModel();
    const { scene } = sceneRef.current;
    if (!model || !scene) return null;

    const pivotPoint = getIdlePivotPoint();
    if (!pivotPoint) return null;

    const pivot = new THREE.Group();
    pivot.name = "__idle_rotation_pivot__";
    pivot.position.copy(pivotPoint);
    scene.add(pivot);
    pivot.attach(model);

    rotationPivotRef.current = pivot;
    return pivot;
  }, [getIdlePivotPoint, getLoadedModel, sceneRef]);

  const unwrapModelFromRotationPivot = useCallback(() => {
    const pivot = rotationPivotRef.current;
    const model = getLoadedModel();
    const { scene } = sceneRef.current;
    if (!pivot || !model || !scene) {
      rotationPivotRef.current = null;
      return;
    }

    scene.attach(model);
    scene.remove(pivot);
    rotationPivotRef.current = null;
  }, [getLoadedModel, sceneRef]);

  const setModelRotationBase = useCallback((rotationY = 0) => {
    defaultRotationYRef.current = rotationY;
  }, []);

  const startIdleRotation = useCallback((speed = 0.00035) => {
    const pivot = wrapModelInRotationPivot();
    if (!pivot) return;

    cancelRotationAnimation();

    const baseRotationY = rotationPivotRef.current?.rotation.y ?? defaultRotationYRef.current;
    const startTime = performance.now();

    const tick = (now) => {
      pivot.rotation.y = baseRotationY + (now - startTime) * speed;
      rotationAnimRef.current = requestAnimationFrame(tick);
    };

    rotationAnimRef.current = requestAnimationFrame(tick);
  }, [cancelRotationAnimation, getLoadedModel]);

  const restoreModelRotation = useCallback((duration = 1800) => {
    const pivot = rotationPivotRef.current;
    const model = getLoadedModel();
    const baseRotationY = defaultRotationYRef.current;

    if (!model) {
      unwrapModelFromRotationPivot();
      return;
    }

    // No idle pivot means there is no active orbit to interpolate from.
    // Snap directly to the known base orientation so reconnect is deterministic.
    if (!pivot) {
      model.rotation.y = baseRotationY;
      unwrapModelFromRotationPivot();
      return;
    }

    const startRotationY = pivot.rotation.y;
    const TAU = Math.PI * 2;

    const normalizeAngle = (angle) => {
      const wrapped = angle % TAU;
      return wrapped < 0 ? wrapped + TAU : wrapped;
    };

    // Continue in the same anti-clockwise direction as idle rotation.
    const startWrapped = normalizeAngle(startRotationY);
    const baseWrapped = normalizeAngle(baseRotationY);
    const delta = (baseWrapped - startWrapped + TAU) % TAU;
    const targetRotationY = startRotationY + delta;

    cancelRotationAnimation();

    if (Math.abs(startRotationY - targetRotationY) < 0.0001) {
      model.rotation.y = baseRotationY;
      unwrapModelFromRotationPivot();
      return;
    }

    const startTime = performance.now();

    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      pivot.rotation.y = startRotationY + (targetRotationY - startRotationY) * eased;

      if (t < 1) {
        rotationAnimRef.current = requestAnimationFrame(tick);
      } else {
        rotationAnimRef.current = null;
        pivot.rotation.y = targetRotationY;
        unwrapModelFromRotationPivot();
        model.rotation.y = baseRotationY;
      }
    };

    rotationAnimRef.current = requestAnimationFrame(tick);
  }, [cancelRotationAnimation, getLoadedModel, unwrapModelFromRotationPivot]);

  const snapModelRotation = useCallback(() => {
    const pivot = rotationPivotRef.current;
    if (!pivot) return;
    cancelRotationAnimation();
    pivot.rotation.y = defaultRotationYRef.current;
    unwrapModelFromRotationPivot();
  }, [cancelRotationAnimation, unwrapModelFromRotationPivot]);

  const animateFloorTransition = (selectedFloor, callback) => {
    const { scene } = sceneRef.current;
    const model = scene.getObjectByName("__loaded_model__");
    if (!model) { callback(); return; }

    // The labels belong to the floor that is leaving.
    const labels = scene.getObjectByName(ROOM_LABELS);
    if (labels) labels.userData.hidden = true;

    const selectedIdx = FLOORS.indexOf(selectedFloor);
    if (selectedIdx === -1) { callback(); return; }

    const totalBox = new THREE.Box3().setFromObject(model);
    const minY     = totalBox.min.y;
    const totalH   = totalBox.max.y - minY;
    if (totalH === 0) { callback(); return; }
    const floorH = totalH / FLOORS.length;

    const meshData = [];
    model.traverse((child) => {
      if (!child.isMesh) return;
      const box      = new THREE.Box3().setFromObject(child);
      const named    = tcFloorByName(child.name);
      const floorIdx = named !== -1
        ? named
        : Math.min(FLOORS.length - 1, Math.floor((box.min.y - minY) / floorH));

      if (floorIdx > selectedIdx) {
        const origLocalY   = child.position.y;
        const relIdx       = floorIdx - selectedIdx - 1;
        const totalAbove   = FLOORS.length - 1 - selectedIdx;
        const staggerDelay = totalAbove > 1
          ? ((totalAbove - 1 - relIdx) / (totalAbove - 1)) * 0.3
          : 0;
        const mats = (Array.isArray(child.material) ? child.material : [child.material]).filter(Boolean);
        mats.forEach((m) => { m.transparent = true; });
        meshData.push({ mesh: child, origLocalY, staggerDelay, dir: 1 });
      } else if (floorIdx < selectedIdx) {
        const origLocalY   = child.position.y;
        const relIdx       = selectedIdx - floorIdx - 1;
        const totalBelow   = selectedIdx;
        const staggerDelay = totalBelow > 1
          ? ((totalBelow - 1 - relIdx) / (totalBelow - 1)) * 0.3
          : 0;
        const mats = (Array.isArray(child.material) ? child.material : [child.material]).filter(Boolean);
        mats.forEach((m) => { m.transparent = true; });
        meshData.push({ mesh: child, origLocalY, staggerDelay, dir: -1 });
      } else {
        // Selected floor: fade out in place (no Y movement) after other floors have moved away.
        // This prevents structural elements like Plaza_Supeno or pillar boxes (which land on
        // floorIdx === selectedIdx via Y-position fallback) from lingering visibly.
        const origLocalY = child.position.y;
        const mats = (Array.isArray(child.material) ? child.material : [child.material]).filter(Boolean);
        mats.forEach((m) => { m.transparent = true; });
        meshData.push({ mesh: child, origLocalY, staggerDelay: 0.5, dir: 0 });
      }
    });

    if (meshData.length === 0) { callback(); return; }

    if (floorAnimRef.current) cancelAnimationFrame(floorAnimRef.current);
    isAnimatingRef.current = true;

    const DURATION  = 700;
    const startTime = performance.now();

    const tick = (now) => {
      const t = Math.min((now - startTime) / DURATION, 1);

      meshData.forEach(({ mesh, origLocalY, staggerDelay, dir }) => {
        const localT = staggerDelay >= 1
          ? 0
          : Math.max(0, Math.min(1, (t - staggerDelay) / (1 - staggerDelay)));
        const eased = localT * localT; // easeInQuad — accelerate away

        mesh.position.y = origLocalY + dir * eased * floorH * 2.5;

        const opacity = Math.max(0, 1 - localT * 1.5);
        const applyOp = (m) => { m.opacity = opacity; };
        if (Array.isArray(mesh.material)) mesh.material.forEach(applyOp);
        else if (mesh.material) applyOp(mesh.material);
      });

      if (t < 1) {
        floorAnimRef.current = requestAnimationFrame(tick);
      } else {
        isAnimatingRef.current = false;
        floorAnimRef.current   = null;
        callback();
      }
    };

    floorAnimRef.current = requestAnimationFrame(tick);
  };

  const animateTCIntro = (lastFloor) => {
    const { scene } = sceneRef.current;
    const model = scene.getObjectByName("__loaded_model__");
    if (!model || !lastFloor) return;

    const selectedIdx = FLOORS.indexOf(lastFloor);
    if (selectedIdx === -1) return;

    const totalBox = new THREE.Box3().setFromObject(model);
    const minY   = totalBox.min.y;
    const totalH = totalBox.max.y - minY;
    if (totalH === 0) return;
    const floorH = totalH / FLOORS.length;

    const meshData = [];
    model.traverse((child) => {
      if (!child.isMesh) return;
      const box      = new THREE.Box3().setFromObject(child);
      const named    = tcFloorByName(child.name);
      const centerY  = (box.min.y + box.max.y) / 2;
      const floorIdx = named !== -1
        ? named
        : Math.min(FLOORS.length - 1, Math.floor((centerY - minY) / floorH));
      if (floorIdx === selectedIdx) return;

      const origLocalY   = child.position.y;
      const dir          = floorIdx > selectedIdx ? 1 : -1;
      const relIdx       = dir === 1 ? floorIdx - selectedIdx - 1 : selectedIdx - floorIdx - 1;
      const totalOther   = dir === 1 ? FLOORS.length - 1 - selectedIdx : selectedIdx;
      const staggerDelay = totalOther > 1 ? (relIdx / (totalOther - 1)) * 0.3 : 0;
      const startOffset  = dir * floorH * 2.5;

      const mats = (Array.isArray(child.material) ? child.material : [child.material]).filter(Boolean);
      child.position.y = origLocalY + startOffset;
      mats.forEach((m) => { m.transparent = true; m.opacity = 0; });
      meshData.push({ mesh: child, origLocalY, startOffset, staggerDelay, mats });
    });

    if (meshData.length === 0) return;

    if (floorAnimRef.current) cancelAnimationFrame(floorAnimRef.current);
    isAnimatingRef.current = true;

    const DURATION  = 700;
    const startTime = performance.now();

    const tick = (now) => {
      const t = Math.min((now - startTime) / DURATION, 1);

      meshData.forEach(({ mesh, origLocalY, startOffset, staggerDelay, mats }) => {
        const localT = staggerDelay >= 1
          ? 0
          : Math.max(0, Math.min(1, (t - staggerDelay) / (1 - staggerDelay)));
        const eased = 1 - (1 - localT) * (1 - localT); // easeOutQuad — decelerate to settle

        mesh.position.y = origLocalY + startOffset * (1 - eased);
        const opacity = Math.min(1, localT * 1.5);
        mats.forEach((m) => { m.opacity = opacity; });
      });

      if (t < 1) {
        floorAnimRef.current = requestAnimationFrame(tick);
      } else {
        meshData.forEach(({ mesh, origLocalY, mats }) => {
          mesh.position.y = origLocalY;
          mats.forEach((m) => { m.opacity = 1; m.transparent = false; });
        });
        isAnimatingRef.current = false;
        floorAnimRef.current   = null;
      }
    };

    floorAnimRef.current = requestAnimationFrame(tick);
  };

  const animateFloorIntro = (model) => {
    // Collect unique materials first, saving opacity BEFORE any modification.
    // Multiple meshes can share the same material instance — modifying on first
    // pass would corrupt naturalOpacity on subsequent passes for the same mat.
    const matMap = new Map();
    model.traverse((child) => {
      if (!child.isMesh) return;
      const mats = (Array.isArray(child.material) ? child.material : [child.material]).filter(Boolean);
      mats.forEach((m) => { if (!matMap.has(m)) matMap.set(m, m.opacity); });
    });

    if (matMap.size === 0) return;

    matMap.forEach((naturalOpacity, mat) => {
      mat.transparent = true;
      mat.needsUpdate = true;
      mat.opacity     = 0;
    });

    if (floorAnimRef.current) cancelAnimationFrame(floorAnimRef.current);
    isAnimatingRef.current = true;

    const DURATION  = 600;
    const startTime = performance.now();

    const tick = (now) => {
      const t     = Math.min((now - startTime) / DURATION, 1);
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad

      matMap.forEach((naturalOpacity, mat) => { mat.opacity = eased * naturalOpacity; });

      if (t < 1) {
        floorAnimRef.current = requestAnimationFrame(tick);
      } else {
        matMap.forEach((naturalOpacity, mat) => { mat.opacity = naturalOpacity; });
        isAnimatingRef.current = false;
        floorAnimRef.current   = null;
      }
    };

    floorAnimRef.current = requestAnimationFrame(tick);
  };

  return {
    floorAnimRef,
    isAnimatingRef,
    animateFloorTransition,
    animateTCIntro,
    animateFloorIntro,
    startIdleRotation,
    restoreModelRotation,
    snapModelRotation,
    cancelRotationAnimation,
    setModelRotationBase,
  };
}
