"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  DISTRICT_STRUCTURE,
  inspectDistrictStructure,
  isInInteractionRange,
} from "../src/world/district-structure-interaction.mjs";
import type { InteractionDistrict } from "../src/world/district-structure-interaction.mjs";

type StructureResponse = {
  title: string;
  district: string;
  transactions: string;
};

const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

export function Bitmapverse3DExperience({
  onExit,
  district,
  entryName,
  authorizationStatus,
}: {
  onExit: () => void;
  district: InteractionDistrict;
  entryName?: string;
  authorizationStatus: string;
}) {
  const [inRange, setInRange] = useState(false);
  const [response, setResponse] = useState<StructureResponse | null>(null);
  const districtRef = useRef(district);
  districtRef.current = district;
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const positionRef = useRef<HTMLSpanElement>(null);
  const orientationRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = canvasHostRef.current;
    const shell = shellRef.current;

    if (!host || !shell) return;

    const shellElement = shell;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050806);
    scene.fog = new THREE.Fog(0x050806, 14, 42);

    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 80);
    camera.position.set(0, 1.7, 7);
    camera.rotation.order = "YXZ";

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const groundGeometry = new THREE.PlaneGeometry(40, 40);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x142119,
      roughness: 0.96,
      metalness: 0.04,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const structureGeometry = new THREE.BoxGeometry(3.2, 4.8, 3.2);
    const structureMaterial = new THREE.MeshStandardMaterial({
      color: 0x65f59a,
      roughness: 0.38,
      metalness: 0.22,
    });
    const structure = new THREE.Mesh(structureGeometry, structureMaterial);
    structure.position.set(0, 2.4, -2);
    scene.add(structure);

    const light = new THREE.HemisphereLight(0xd9ffe5, 0x142033, 2.8);
    scene.add(light);

    let yaw = 0;
    let pitch = 0;
    let dragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    const pressedKeys = new Set<string>();

    function updateReadout() {
      if (positionRef.current) {
        positionRef.current.textContent = `${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}`;
      }
      if (orientationRef.current) {
        orientationRef.current.textContent = `${THREE.MathUtils.radToDeg(yaw).toFixed(1)}°, ${THREE.MathUtils.radToDeg(pitch).toFixed(1)}°`;
      }
    }

    // Human adapter: E triggers the semantic action; it is not the action.
    const actor = { x: 0, z: 0 };
    let rangeState = false;

    function syncInteraction() {
      actor.x = camera.position.x;
      actor.z = camera.position.z;
      const nowInRange = isInInteractionRange(actor);
      if (nowInRange === rangeState) return;
      rangeState = nowInRange;
      setInRange(nowInRange);
      if (!nowInRange) setResponse(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "KeyE") {
        if (event.repeat) return;
        actor.x = camera.position.x;
        actor.z = camera.position.z;
        const result = inspectDistrictStructure(
          DISTRICT_STRUCTURE,
          actor,
          districtRef.current,
        );
        if (result.ok) setResponse(result.response);
        return;
      }
      if (!MOVE_KEYS.has(event.code)) return;
      event.preventDefault();
      pressedKeys.add(event.code);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (!MOVE_KEYS.has(event.code)) return;
      event.preventDefault();
      pressedKeys.delete(event.code);
    }

    function onPointerDown(event: PointerEvent) {
      dragging = true;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      shellElement.focus();
    }

    function onPointerMove(event: PointerEvent) {
      if (!dragging) return;

      yaw -= (event.clientX - lastPointerX) * 0.004;
      pitch -= (event.clientY - lastPointerY) * 0.004;
      pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2.1, Math.PI / 2.1);
      camera.rotation.set(pitch, yaw, 0);
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      updateReadout();
    }

    function onPointerUp(event: PointerEvent) {
      dragging = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    }

    function onWindowBlur() {
      pressedKeys.clear();
      dragging = false;
    }

    const resizeObserver = new ResizeObserver(() => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(host);

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
    window.addEventListener("blur", onWindowBlur);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    let animationFrame = 0;
    let previousFrameTime = performance.now();

    function render(frameTime: number) {
      const distance =
        4.5 * Math.min((frameTime - previousFrameTime) / 1000, 0.05);
      previousFrameTime = frameTime;
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));

      if (pressedKeys.has("KeyW")) camera.position.addScaledVector(forward, distance);
      if (pressedKeys.has("KeyS")) camera.position.addScaledVector(forward, -distance);
      if (pressedKeys.has("KeyD")) camera.position.addScaledVector(right, distance);
      if (pressedKeys.has("KeyA")) camera.position.addScaledVector(right, -distance);

      updateReadout();
      syncInteraction();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    }

    updateReadout();
    shellElement.focus();
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      pressedKeys.clear();
      groundGeometry.dispose();
      groundMaterial.dispose();
      structureGeometry.dispose();
      structureMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main
      ref={shellRef}
      className="bitmapverse-3d-shell"
      tabIndex={-1}
      aria-label={`${entryName ?? "Direct District entry"} in BITMAPVERSE 937336.bitmap 3D environment`}
    >
      <div ref={canvasHostRef} className="bitmapverse-3d-canvas" />
      <header className="bitmapverse-3d-identity">
        <span>ENTRY IDENTITY</span>
        <strong>{entryName ?? "DIRECT DISTRICT ENTRY"}</strong>
        <small>{district.blockHeight}.bitmap</small>
        <small>{authorizationStatus}</small>
      </header>
      <div className="bitmapverse-3d-controls">
        <p>W / A / S / D — MOVE</p>
        <p>DRAG — LOOK</p>
        {inRange && <p className="bitmapverse-3d-prompt">[E] INTERACT</p>}
      </div>
      <div className="bitmapverse-3d-readout" aria-label="Camera state">
        <span>POSITION</span>
        <strong ref={positionRef}>0.00, 1.70, 7.00</strong>
        <span>LOOK</span>
        <strong ref={orientationRef}>0.0°, 0.0°</strong>
      </div>
      {response && (
        <section className="bitmapverse-3d-response" aria-live="polite">
          <strong>{response.title}</strong>
          <p>District: {response.district}</p>
          <p>Transactions: {response.transactions}</p>
        </section>
      )}
      <button type="button" className="bitmapverse-3d-exit" onClick={onExit}>
        EXIT 3D
      </button>
    </main>
  );
}
