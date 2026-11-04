import { useRef } from "react";
import * as THREE from "three";
import { OBJLoader }    from "three/examples/jsm/loaders/OBJLoader";
import { MTLLoader }    from "three/examples/jsm/loaders/MTLLoader";
import { C, getExt } from "../lib/constants";
import { asset } from "../lib/config";
import { applyDefaultCameraView, getMarkerDefaultCameraView } from "../lib/cameraView";
import { loadData } from "../lib/data";
import { getMapLabels } from "../lib/directory";
import { RoomLabels } from "../lib/roomLabels";

export function useModelLoader({
  sceneRef,
  floorAnimRef,
  isAnimatingRef,
  animateFloorIntro,
  animateTCIntro,
  cancelRotationAnimation,
  setModelRotationBase,
  lastActiveFloorRef,
  pendingRoomRef,
  setStatus,
  setModelInfo,
  setErrorMsg,
  setActiveFloor,
  setActiveRoom,
  setRoomData,
  setView,
}) {
  const originalMaterials = useRef({});
  const savedCameraRef    = useRef(null);
  const modelCacheRef     = useRef(new Map());
  const markerRef         = useRef(null);
  const markerSizeRef     = useRef(null);
  const modelSizeRef      = useRef(null);
  const labelsRef         = useRef(null);
  const selectedRoomRef   = useRef(null);
  const liveRef           = useRef(null);

  const removeLabels = () => {
    const labels = labelsRef.current;
    if (!labels) return;
    sceneRef.current.onFrame?.delete(labels.onFrame);
    labels.dispose();
    labelsRef.current = null;
  };

  // The room names come from the data, which may still be loading on the
  // first floor, so the labels appear a moment after the model.
  const addRoomLabels = (model, floorName) => {
    loadData()
      .then((data) => {
        const { scene, onFrame } = sceneRef.current;
        if (scene?.getObjectByName("__loaded_model__") !== model) return;
        removeLabels();
        const labels = new RoomLabels(model, getMapLabels(data, floorName));
        labels.select(selectedRoomRef.current);
        if (liveRef.current?.model === model) labels.setLive(liveRef.current.badges, liveRef.current.focus);
        labels.onFrame = (camera, viewportHeight) => labels.update(camera, viewportHeight);
        onFrame?.add(labels.onFrame);
        scene.add(labels.group);
        labelsRef.current = labels;
      })
      .catch((err) => console.warn("Room labels unavailable:", err));
  };

  const removeMarker = () => {
    if (markerRef.current) {
      sceneRef.current.scene?.remove(markerRef.current);
      markerRef.current = null;
    }
  };

  const addYouAreHereMarker = () => {
    removeMarker();
    const { scene } = sceneRef.current;
    const model = scene?.getObjectByName("__loaded_model__");
    if (!model) return null;

    let tvMesh = null;
    model.traverse((child) => { if (child.isMesh && child.name === "TV") tvMesh = child; });
    if (!tvMesh) return null;

    model.updateMatrixWorld(true);
    const tvBox = new THREE.Box3().setFromObject(tvMesh);
    const tvCenter = tvBox.getCenter(new THREE.Vector3());
    const tvSize = tvBox.getSize(new THREE.Vector3());

    const s = Math.max(tvSize.x, tvSize.z) * 0.8;
    const group = new THREE.Group();
    group.name = "__you_are_here__";

    const pinMat = new THREE.MeshBasicMaterial({ color: 0x26328f });

    const cone = new THREE.Mesh(new THREE.ConeGeometry(s * 0.5, s * 1.5, 16), pinMat);
    cone.rotation.x = Math.PI;
    cone.position.y = s * 0.75;
    group.add(cone);

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(s * 0.6, 16, 16), pinMat);
    sphere.position.y = s * 1.8;
    group.add(sphere);

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(s * 0.25, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    dot.position.y = s * 1.8;
    group.add(dot);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(s * 0.6, s * 0.9, 32),
      new THREE.MeshBasicMaterial({ color: 0x26328f, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.font = "bold 44px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // A dark chip like the floor badge, so the room labels behind it do not
    // show through the text.
    const chipWidth = ctx.measureText("Anda berada di sini").width + 56;
    ctx.beginPath();
    ctx.roundRect((768 - chipWidth) / 2, 20, chipWidth, 88, 18);
    ctx.fillStyle = "rgba(8,9,15,0.88)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.blue;
    ctx.stroke();
    ctx.fillStyle = C.blue;
    ctx.fillText("Anda berada di sini", 384, 66);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
    );
    label.renderOrder = 2;
    label.scale.set(s * 9, s * 1.5, 1);
    label.position.y = s * 3;
    group.add(label);

    group.position.copy(tvCenter);
    group.position.y = tvBox.max.y;
    model.updateMatrixWorld(true);
    model.add(group);
    model.worldToLocal(group.position);
    markerRef.current = group;
    markerSizeRef.current = s;

    return getMarkerDefaultCameraView(group.getWorldPosition(new THREE.Vector3()), s, modelSizeRef.current);
  };

  const applyMarkerCameraView = (mode = "disconnected") => {
    const { camera, controls } = sceneRef.current;
    if (!camera || !controls || !markerRef.current || !markerSizeRef.current) return;

    const view = getMarkerDefaultCameraView(
      markerRef.current.getWorldPosition(new THREE.Vector3()),
      markerSizeRef.current,
      modelSizeRef.current,
      mode,
    );
    applyDefaultCameraView(camera, controls, modelSizeRef.current, true, view);
  };

  const deepClone = (obj) => {
    const clone = obj.clone(true);
    clone.traverse((child) => {
      if (!child.isMesh) return;
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => m.clone())
        : child.material.clone();
    });
    return clone;
  };

  const onErr = (err) => {
    console.error(err);
    setErrorMsg(err?.message || "Failed to load.");
    setStatus("error");
  };

  // Rooms with a class in progress turn cyan over a cyan floor plate, and the
  // focused one pulses.
  // Only the materials set here are undone, so a room selected meanwhile
  // keeps its highlight.
  const clearLive = () => {
    const live = liveRef.current;
    if (!live) return;
    sceneRef.current.onFrame?.delete(live.onFrame);
    for (const { mesh, material, original } of live.meshes) {
      if (mesh.material === material) mesh.material = original;
    }
    for (const plate of live.plates) {
      plate.removeFromParent();
      plate.geometry.dispose();
      plate.material.dispose();
    }
    labelsRef.current?.setLive(null);
    liveRef.current = null;
  };

  /**
   * Marks the rooms with a class in progress: `badges` maps a mesh name to
   * the short course name shown above its label; null clears it all.
   */
  const setLiveRooms = (badges, focus = null) => {
    const { scene, onFrame } = sceneRef.current;
    const model = scene?.getObjectByName("__loaded_model__");
    const key = badges ? [...badges].join("|") : "";
    const live = liveRef.current;
    if (live && live.model === model && live.key === key) {
      live.focus = focus;
      labelsRef.current?.setLive(badges, focus);
      return;
    }
    clearLive();
    if (!model || !badges?.size) return;

    // The rooms' walls are near white, so an emissive glow would clip to
    // white; blend the colour itself instead.
    const liveColor = new THREE.Color(C.live);
    const tint = (mat) => {
      const t = mat.clone();
      t.userData.baseColor = t.color?.clone();
      return t;
    };
    const meshes = [];
    const boxes = new Map();
    model.traverse((child) => {
      if (!child.isMesh || !badges.has(child.name)) return;
      const original = child.material;
      child.material = Array.isArray(original) ? original.map(tint) : tint(original);
      meshes.push({ mesh: child, material: child.material, original, room: child.name });
      // Bounds in the model's frame, as for the room labels.
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      const box = boxes.get(child.name) ?? new THREE.Box3();
      boxes.set(child.name, box.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrix)));
    });

    // A plate just above the floor of each room, so the whole room reads as
    // in use and not only its walls.
    const plates = [...boxes].map(([room, box]) => {
      const size = box.getSize(new THREE.Vector3());
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(size.x, size.z),
        new THREE.MeshBasicMaterial({ color: liveColor, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }),
      );
      plate.rotation.x = -Math.PI / 2;
      plate.position.set((box.min.x + box.max.x) / 2, box.min.y + 0.05, (box.min.z + box.max.z) / 2);
      plate.userData.room = room;
      model.add(plate);
      return plate;
    });

    const next = { model, key, badges, focus, meshes, plates };
    next.onFrame = () => {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
      for (const { material, room } of meshes) {
        const amount = room === next.focus ? 0.55 + 0.35 * pulse : 0.55;
        for (const m of Array.isArray(material) ? material : [material]) {
          if (m.userData.baseColor) m.color.copy(m.userData.baseColor).lerp(liveColor, amount);
        }
      }
      for (const plate of plates) {
        plate.material.opacity = plate.userData.room === next.focus ? 0.3 + 0.35 * pulse : 0.3;
      }
    };
    onFrame?.add(next.onFrame);
    liveRef.current = next;
    labelsRef.current?.setLive(badges, focus);
  };

  const highlightRoom = (roomName) => {
    const { scene } = sceneRef.current;
    const model = scene.getObjectByName("__loaded_model__");
    if (!model) return;

    // Selecting a room ends the idle board; untint first so the materials
    // saved below are the model's own.
    clearLive();
    selectedRoomRef.current = roomName;
    labelsRef.current?.select(roomName);

    model.traverse((child) => {
      if (!child.isMesh) return;
      if (!originalMaterials.current[child.uuid]) {
        originalMaterials.current[child.uuid] = Array.isArray(child.material)
          ? child.material.map((m) => m.clone())
          : child.material.clone();
      }

      // Only lit materials have an emissive uniform. Setting `emissive` on a
      // MeshBasicMaterial (the "you are here" marker) makes the renderer throw
      // on every frame, so leave those materials' emissive alone.
      const highlight = (mat) => {
        const h = mat.clone();
        if (h.emissive) {
          h.emissive = new THREE.Color(0x22aa44);
          h.emissiveIntensity = 0.8;
        }
        h.transparent = true;
        h.opacity     = 1;
        h.depthWrite  = true;
        return h;
      };
      const dim = (mat) => {
        const d = mat.clone();
        d.transparent = true;
        d.opacity     = roomName ? 0.2 : 1;
        if (d.emissive) {
          d.emissive = new THREE.Color(0x000000);
          d.emissiveIntensity = 0;
        }
        return d;
      };

      const orig = originalMaterials.current[child.uuid];
      const isMatch = child.name === roomName;
      child.material = isMatch
        ? (Array.isArray(orig) ? orig.map(highlight) : highlight(orig))
        : (Array.isArray(orig) ? orig.map(dim)       : dim(orig));
    });
  };

  const finalizeModel = (model, switchToRooms = true, preserveCamera = false, floorName = null) => {
    if (floorAnimRef.current) {
      cancelAnimationFrame(floorAnimRef.current);
      floorAnimRef.current  = null;
      isAnimatingRef.current = false;
    }
    cancelRotationAnimation?.();

    const { scene, camera, controls } = sceneRef.current;
    const pivot = scene.getObjectByName("__idle_rotation_pivot__");
    if (pivot) scene.remove(pivot);
    removeMarker();
    clearLive();
    removeLabels();
    selectedRoomRef.current = null;
    const prev = scene.getObjectByName("__loaded_model__");
    if (prev) scene.remove(prev);
    originalMaterials.current = {};

    model.name = "__loaded_model__";
    const meshNames = [];
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        if (child.name) meshNames.push(child.name);
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => { if (m && m.opacity < 1) { m.transparent = true; m.depthWrite = false; } });
      }
    });

    const box    = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    model.position.sub(center);
    model.position.y += size.y / 2;
    scene.add(model);

    modelSizeRef.current = size;
    setModelRotationBase?.(model.rotation.y);

    if (floorName) addRoomLabels(model, floorName);
    const cameraTarget = floorName === "Lantai 1" ? addYouAreHereMarker() : null;
    applyDefaultCameraView(camera, controls, size, true, cameraTarget);

    if (preserveCamera && savedCameraRef.current) {
      camera.position.copy(savedCameraRef.current.position);
      controls.target.copy(savedCameraRef.current.target);
      savedCameraRef.current = null;
      controls.update();
    }

    if (switchToRooms) {
      animateFloorIntro(model);
      setModelInfo({
        meshCount: meshNames.length,
        meshNames,
        size: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) },
      });

      // Search results carry the CSV name, which may use spaces where the
      // mesh name has underscores ("Aula Handayani" → Aula_Handayani).
      const pending = pendingRoomRef?.current?.replace(/ /g, "_");
      if (pending && meshNames.includes(pending)) {
        pendingRoomRef.current = null;
        setActiveRoom(pending);
        setRoomData(null);
        highlightRoom(pending);
      } else {
        setActiveRoom(null);
        setRoomData(null);
      }
      setView("rooms");
    } else {
      const lf = lastActiveFloorRef.current;
      lastActiveFloorRef.current = null;
      animateTCIntro(lf);
    }

    setStatus("success");
  };

  const loadTC = (preserveCamera = true) => {
    const { camera, controls } = sceneRef.current;
    cancelRotationAnimation?.();
    if (preserveCamera && camera && controls) {
      savedCameraRef.current = { position: camera.position.clone(), target: controls.target.clone() };
    }
    setStatus("loading"); setModelInfo(null); setErrorMsg("");
    setActiveFloor(null); setActiveRoom(null); setRoomData(null);
    const ml = new MTLLoader();
    ml.load(
      asset("models/TC.mtl"),
      (mats) => {
        mats.preload();
        const ol = new OBJLoader();
        ol.setMaterials(mats);
        ol.load(asset("models/TC.obj"), (obj) => finalizeModel(obj, false, preserveCamera), undefined, onErr);
      },
      undefined,
      onErr,
    );
  };

  const loadFloorObjMtl = (floorName, resetCamera = false) => {
    const { camera, controls, scene } = sceneRef.current;
    cancelRotationAnimation?.();
    if (!resetCamera && camera && controls) {
      savedCameraRef.current = { position: camera.position.clone(), target: controls.target.clone() };
    } else {
      savedCameraRef.current = null;
    }
    const prev = scene?.getObjectByName("__loaded_model__");
    if (prev) prev.visible = false;
    setStatus("loading"); setModelInfo(null); setErrorMsg(""); setView("floors");

    const preserve = !resetCamera;

    if (modelCacheRef.current.has(floorName)) {
      finalizeModel(deepClone(modelCacheRef.current.get(floorName)), true, preserve, floorName);
      return;
    }

    const ml = new MTLLoader();
    ml.load(
      asset(`models/${floorName}.mtl`),
      (mats) => {
        mats.preload();
        const ol = new OBJLoader();
        ol.setMaterials(mats);
        ol.load(asset(`models/${floorName}.obj`), (obj) => {
          modelCacheRef.current.set(floorName, deepClone(obj));
          finalizeModel(obj, true, preserve, floorName);
        }, undefined, onErr);
      },
      undefined,
      onErr,
    );
  };

  const loadByUrl = (url) => {
    cancelRotationAnimation?.();
    setStatus("loading"); setModelInfo(null); setErrorMsg(""); setView("floors");
    new OBJLoader().load(url, finalizeModel, undefined, onErr);
  };

  const loadByFiles = (files) => {
    cancelRotationAnimation?.();
    const fm = {};
    Array.from(files).forEach((f) => { fm[getExt(f.name)] = f; });
    setStatus("loading"); setModelInfo(null); setErrorMsg(""); setView("floors");

    if (fm["obj"]) {
      if (fm["mtl"]) {
        const ml = new MTLLoader();
        ml.load(
          URL.createObjectURL(fm["mtl"]),
          (mats) => {
            mats.preload();
            const ol = new OBJLoader();
            ol.setMaterials(mats);
            ol.load(URL.createObjectURL(fm["obj"]), finalizeModel, undefined, onErr);
          },
          undefined,
          onErr,
        );
      } else {
        loadByUrl(URL.createObjectURL(fm["obj"]));
      }
    } else {
      setErrorMsg("No supported file found.");
      setStatus("error");
    }
  };

  return { loadTC, loadFloorObjMtl, loadByFiles, highlightRoom, setLiveRooms, applyMarkerCameraView };
}
