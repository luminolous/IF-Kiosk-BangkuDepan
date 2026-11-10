import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GESTURES } from "../lib/config";
import { UI } from "../lib/constants";
import { applyDefaultCameraView } from "../lib/cameraView";

// The palette as plain sRGB numbers: the backdrop shader writes them straight
// to the screen, without Three's colour management.
const rgb = (hex) => new THREE.Vector3(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));

/**
 * A light shader behind the model: a slow gradient in the interface palette
 * with a little grain. One full-screen quad, drawn first, never in the way of
 * the model, never picked, and still when the visitor prefers less motion.
 */
function createBackdrop() {
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const uniforms = {
    uTime: { value: 0 },
    uRes:  { value: new THREE.Vector2(1, 1) },
    uDeep: { value: rgb(UI.black) },
    uBase: { value: rgb(UI.bg) },
    uHigh: { value: rgb(UI.surface) },
    uGlow: { value: rgb(UI.line) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 0.999, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec2  uRes;
      uniform vec3  uDeep, uBase, uHigh, uGlow;
      varying vec2  vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 p = vUv - 0.5;
        p.x *= uRes.x / uRes.y;
        float t = uTime * 0.05;
        vec2 c = vec2(0.45 * sin(t), 0.18 + 0.12 * cos(t * 1.3));
        float glow = smoothstep(0.95, 0.0, length(p - c));
        vec3 col = mix(uBase, uHigh, smoothstep(0.0, 1.0, vUv.y) * 0.7);
        col = mix(col, uGlow, glow * 0.35);
        col = mix(uDeep, col, smoothstep(1.25, 0.25, length(p)));
        col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.02;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.raycast = () => {};
  mesh.name = "__backdrop__";
  const start = performance.now();
  return {
    mesh,
    tick(width, height) {
      uniforms.uRes.value.set(width || 1, height || 1);
      if (!still) uniforms.uTime.value = (performance.now() - start) / 1000;
    },
    dispose() { mesh.geometry.dispose(); material.dispose(); },
  };
}

export function useThreeScene(mountRef) {
  const sceneRef = useRef({});

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const backdrop = createBackdrop();
    scene.add(backdrop.mesh);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.5);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.01, 1000);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 200;
    if (GESTURES === "map") {
      // Map-style: one finger (or the left mouse button) pans along the floor,
      // two fingers (or the right button) rotate, pinch zooms.
      controls.screenSpacePanning = false;
      controls.touches      = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
      controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    }
    applyDefaultCameraView(camera, controls);

    // Called with (camera, viewportHeight) right before each frame is drawn,
    // for objects that follow the camera, such as the room labels.
    const onFrame = new Set();

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      backdrop.tick(el.clientWidth, el.clientHeight);
      onFrame.forEach((fn) => fn(camera, el.clientHeight));
      renderer.render(scene, camera);
    };
    animate();

    const resizeScene = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", resizeScene);
    const resizeObserver = new ResizeObserver(resizeScene);
    resizeObserver.observe(el);

    sceneRef.current = { scene, camera, renderer, controls, onFrame };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resizeScene);
      resizeObserver.disconnect();
      backdrop.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return sceneRef;
}
