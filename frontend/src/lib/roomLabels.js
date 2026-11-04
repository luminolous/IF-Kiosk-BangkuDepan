// Room names drawn over a floor model, so a visitor can find a room on the
// map without tapping through the list first.
//
// Each label is sized in metres to fit its room, so labels never crowd each
// other, and turned to face the screen, so it stays upright whichever way the
// model is turned. A label too small on screen to read fades out and comes
// back as the visitor zooms in.

import * as THREE from "three";
import { Text } from "troika-three-text";
import fontUrl from "@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff?url";

import { C } from "./constants.js";
import { glueShortWords } from "./directory.js";

// Largest text height, in model units (metres). Classrooms reach it; the
// 4 m lecturer offices on Lantai 2 get about half.
const MAX_FONT = 1.6;
// Share of a room's smaller side the label may cover.
const FILL_WIDTH  = 0.8;
const FILL_HEIGHT = 0.5;
// Below MIN_PX on screen a label is unreadable, so it fades out; it is fully
// visible from MIN_PX + FADE_PX. A selected label never shrinks below SELECTED_PX.
const MIN_PX      = 10;
const FADE_PX     = 4;
const SELECTED_PX = 18;
// Opacity of the other labels while one room is selected, as the rooms dim.
const DIMMED = 0.25;
const FADE_IN_MS = 600;

const TEXT_COLOR     = new THREE.Color(C.text);
const SELECTED_COLOR = new THREE.Color(C.green);
// The "class in progress" badge above a label, as a share of the label's
// text height, and the gap between the two.
const BADGE_HEIGHT = 0.8;
const BADGE_GAP    = 0.3;
// Badges are too many to all be readable from the whole-floor view, so only
// the one the idle board points at grows to this height on screen.
const FOCUS_BADGE_PX = 36;

export const ROOM_LABELS = "__room_labels__";

const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * Lays the text out (troika does it in a worker) and resolves its block size.
 * Troika never calls back when nothing changed since the last layout, so call
 * this only after changing a property.
 */
const layout = (text) => new Promise((resolve) => text.sync(() => {
  const [minX, minY, maxX, maxY] = text.textRenderInfo.blockBounds;
  resolve({ width: maxX - minX, height: maxY - minY });
}));

/**
 * Fits a label into a square of `side` metres: on one line if that leaves the
 * text at least 80% of its largest size, otherwise wrapped at spaces, so
 * "IF 225" never breaks but "Co Working Space IUP" may.
 */
async function fitText(text, side) {
  const maxW = side * FILL_WIDTH, maxH = side * FILL_HEIGHT;
  const fit = ({ width, height }) => Math.min(MAX_FONT, MAX_FONT * maxW / width, MAX_FONT * maxH / height);

  text.fontSize = MAX_FONT;
  text.whiteSpace = "nowrap";
  const oneLine = fit(await layout(text));
  if (oneLine >= MAX_FONT * 0.8 || !text.text.includes(" ")) return oneLine;

  text.whiteSpace = "normal";
  text.maxWidth = maxW;
  const wrapped = fit(await layout(text));
  if (wrapped > oneLine) return wrapped;

  text.whiteSpace = "nowrap";
  await layout(text);
  return oneLine;
}

/** A restroom sign: one figure per gender, light on the kiosk's dark tile. */
function drawToiletSign(canvas, genders, selected) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const pad = 6, radius = 22;
  ctx.beginPath();
  ctx.roundRect(pad, pad, width - 2 * pad, height - 2 * pad, radius);
  ctx.fillStyle = "rgba(8,9,15,0.88)";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = selected ? C.green : C.blue;
  ctx.stroke();

  ctx.fillStyle = selected ? C.green : C.text;
  genders.forEach((gender, i) => {
    // Each figure is drawn in a 100 × 100 box, centred in its half.
    const s = (height - 2 * pad) / 120;
    const cx = (width / genders.length) * (i + 0.5);
    ctx.save();
    ctx.translate(cx - 50 * s, pad + 10 * s);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(50, 12, 11, 0, Math.PI * 2);
    if (gender === "Perempuan") {
      ctx.moveTo(40, 28); ctx.lineTo(60, 28); ctx.lineTo(76, 70); ctx.lineTo(24, 70); ctx.closePath();
      ctx.rect(39, 68, 8, 30); ctx.rect(53, 68, 8, 30);
    } else {
      ctx.roundRect(32, 28, 36, 40, 6);
      ctx.rect(36, 64, 12, 34); ctx.rect(52, 64, 12, 34);
    }
    ctx.fill();
    ctx.restore();
    if (i > 0) {
      ctx.fillStyle = selected ? C.green : C.sub;
      ctx.fillRect((width / genders.length) * i - 2, height * 0.22, 4, height * 0.56);
      ctx.fillStyle = selected ? C.green : C.text;
    }
  });
}

/** A "class in progress" badge: dark text on a pill in the live colour, with a dot. */
function drawLiveBadge(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = "500 64px 'DM Mono', monospace";
  ctx.font = font;
  const height = 104, padX = 34, dot = 22;
  canvas.width = Math.ceil(ctx.measureText(text).width + 2 * padX + dot * 2);
  canvas.height = height;

  ctx.font = font;
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, height - 8, (height - 8) / 2);
  ctx.fillStyle = C.live;
  ctx.fill();
  ctx.fillStyle = C.bg;
  ctx.beginPath();
  ctx.arc(padX + dot / 2, height / 2, dot / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.fillText(text, padX + dot * 2, height / 2 + 3);
  return canvas;
}

/**
 * Labels for one loaded floor model. `entries` come from getMapLabels(); a
 * room whose meshes are missing from the model gets no label.
 *
 * Call update(camera, viewportHeight) once a frame and dispose() when the
 * model goes away. The group is named ROOM_LABELS, so code that only has the
 * scene can find it and set userData.hidden.
 */
export class RoomLabels {
  constructor(model, entries) {
    this.model = model;
    this.group = new THREE.Group();
    this.group.name = ROOM_LABELS;
    this.group.matrixAutoUpdate = false;
    this.labels = [];
    this.selected = null;
    this.createdAt = performance.now();

    const meshes = new Map();
    model.updateMatrixWorld(true);
    model.traverse((child) => { if (child.isMesh && child.name) meshes.set(child.name, child); });

    for (const entry of entries) {
      const found = entry.meshes.map((name) => meshes.get(name)).filter(Boolean);
      if (!found.length) continue;

      // Bounds in the model's own frame, so the label group can simply carry
      // the model's transform, idle rotation included.
      const box = new THREE.Box3();
      for (const mesh of found) {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
      }
      const size = box.getSize(new THREE.Vector3());
      const side = Math.min(size.x, size.z);
      const label = { meshes: entry.meshes, side, ready: false };

      if (entry.toilet) this.addToiletSign(label, entry.toilet);
      else this.addText(label, entry.text);

      const center = box.getCenter(new THREE.Vector3());
      label.object.position.set(center.x, box.max.y, center.z);
      label.object.renderOrder = 1;
      label.object.visible = false;
      this.group.add(label.object);
      this.labels.push(label);
    }
  }

  addText(label, string) {
    const text = new Text();
    text.text = glueShortWords(string);
    text.font = fontUrl;
    text.anchorX = "center";
    text.anchorY = "bottom";
    text.textAlign = "center";
    text.lineHeight = 1.1;
    text.color = TEXT_COLOR;
    text.outlineWidth = "12%";
    text.outlineColor = C.bg;
    text.outlineBlur = "4%";
    text.material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
    label.object = text;
    fitText(text, label.side).then(async (fontSize) => {
      if (fontSize !== text.fontSize) {
        text.fontSize = fontSize;
        await layout(text);
      }
      const [, minY, , maxY] = text.textRenderInfo.blockBounds;
      label.height = fontSize;
      label.blockHeight = maxY - minY;
      label.ready = true;
    });
  }

  addToiletSign(label, genders) {
    const canvas = document.createElement("canvas");
    canvas.width = 128 * genders.length;
    canvas.height = 128;
    drawToiletSign(canvas, genders, false);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const height = Math.min(MAX_FONT * 1.4, (label.side * FILL_WIDTH) / genders.length);
    const geometry = new THREE.PlaneGeometry(height * genders.length, height);
    geometry.translate(0, height / 2, 0);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });

    label.object = new THREE.Mesh(geometry, material);
    label.height = height;
    label.redraw = (selected) => { drawToiletSign(canvas, genders, selected); texture.needsUpdate = true; };
    label.ready = true;
  }

  /** Highlights the label of `roomName` and dims the rest; null clears it. */
  select(roomName) {
    this.selected = roomName;
    for (const label of this.labels) {
      const isSelected = label.meshes.includes(roomName);
      if (label.redraw) label.redraw(isSelected);
      else label.object.color = isSelected ? SELECTED_COLOR : TEXT_COLOR;
    }
  }

  /**
   * Puts a "class in progress" badge above the label of each room in
   * `badges` (a Map of mesh name to short course name) and removes the rest;
   * null removes them all. The badge of `focus` pulses.
   */
  setLive(badges, focus = null) {
    this.liveFocus = focus;
    for (const label of this.labels) {
      const room = badges && !label.redraw ? label.meshes.find((m) => badges.has(m)) : null;
      const text = room ? badges.get(room) : null;
      if (label.badge && label.badge.userData.text !== text) this.removeBadge(label);
      label.badgeText = text;
      label.badgeRoom = room;
    }
  }

  // Drawn once the label's own size is known, which may be after setLive().
  addBadge(label) {
    const canvas = drawLiveBadge(label.badgeText);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const height = label.height * BADGE_HEIGHT;
    const geometry = new THREE.PlaneGeometry((height * canvas.width) / canvas.height, height);
    geometry.translate(0, height / 2, 0);
    const badge = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
    );
    badge.userData.text = label.badgeText;
    badge.position.y = label.blockHeight + label.height * BADGE_GAP;
    badge.renderOrder = 2;
    label.object.add(badge);
    label.badge = badge;
  }

  removeBadge(label) {
    const { badge } = label;
    badge.removeFromParent();
    badge.geometry.dispose();
    badge.material.map.dispose();
    badge.material.dispose();
    label.badge = null;
  }

  update(camera, viewportHeight) {
    const { model, group } = this;
    // userData.hidden is set when the floor starts to animate away.
    group.visible = !group.userData.hidden && model.visible && !!model.parent;
    if (!group.visible) return;

    model.updateWorldMatrix(true, false);
    group.matrix.copy(model.matrixWorld);
    group.updateMatrixWorld(true);

    // Face the screen: undo the model's rotation, then take the camera's.
    const modelQuat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    model.matrixWorld.decompose(new THREE.Vector3(), modelQuat, scale);
    const faceCamera = modelQuat.invert().multiply(camera.quaternion);

    const pxPerUnitAtDistance1 = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const fadeIn = smoothstep((performance.now() - this.createdAt) / FADE_IN_MS);
    const worldPos = new THREE.Vector3();

    for (const label of this.labels) {
      const { object } = label;
      if (!label.ready) continue;
      object.visible = true;
      object.quaternion.copy(faceCamera);

      object.scale.setScalar(1);
      object.getWorldPosition(worldPos);
      const px = (label.height * scale.y * pxPerUnitAtDistance1) / worldPos.distanceTo(camera.position);

      const isSelected = this.selected !== null && label.meshes.includes(this.selected);
      let opacity;
      if (isSelected) {
        object.scale.setScalar(Math.max(1, SELECTED_PX / px));
        opacity = 1;
      } else {
        opacity = smoothstep((px - MIN_PX) / FADE_PX) * (this.selected ? DIMMED : 1);
      }
      opacity *= fadeIn;
      const focused = !!label.badge && label.badgeRoom === this.liveFocus;
      object.visible = opacity > 0.01 || focused;

      if (object instanceof Text) {
        object.fillOpacity = opacity;
        object.outlineOpacity = opacity;
      } else {
        object.material.opacity = opacity;
      }

      if (label.badgeText && !label.badge) this.addBadge(label);
      if (label.badge) {
        const { badge } = label;
        const grow = focused ? Math.max(1, FOCUS_BADGE_PX / (px * BADGE_HEIGHT)) : 1;
        const pulse = focused ? 0.5 + 0.5 * Math.sin(performance.now() / 250) : 0;
        badge.scale.setScalar(grow * (1 + 0.08 * pulse));
        badge.renderOrder = focused ? 3 : 2;
        badge.material.opacity = focused ? fadeIn : opacity;
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    for (const label of this.labels) if (label.badge) this.removeBadge(label);
    for (const { object } of this.labels) {
      if (object instanceof Text) object.dispose();
      else { object.geometry.dispose(); object.material.map.dispose(); object.material.dispose(); }
    }
    this.labels = [];
  }
}
