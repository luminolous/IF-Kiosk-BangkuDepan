import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GESTURES } from "../lib/config";
import { C } from "../lib/constants";
import { applyDefaultCameraView } from "../lib/cameraView";

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
    scene.background = new THREE.Color(C.bg);
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
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return sceneRef;
}
