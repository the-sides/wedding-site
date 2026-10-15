import * as THREE from "three";
import { ClothSim } from "./physics";
import { makeWeaveNormalMap, makeGrainRoughnessMap } from "./textures";
import { RSVP_CLOSED_DETAILS } from "../rsvp-status";

/** The announcement is printed into the surface, so every letter folds with it. */
function printNotice() {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff8e9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#8f5147";
  ctx.lineWidth = 1.5;
  ctx.fillStyle = "#48201e";
  ctx.textAlign = "center";
  ctx.font = "106px Georgia, serif";
  ctx.fillText("RSVPs are", 768, 510);
  ctx.fillText("temporarily closed.", 768, 631);
  ctx.beginPath();
  ctx.moveTo(714, 702);
  ctx.lineTo(822, 702);
  ctx.stroke();
  ctx.font = "50px Georgia, serif";
  // Keep the same wording as the accessible HTML and API response.
  const words = RSVP_CLOSED_DETAILS.split(" ");
  ctx.fillText(words.slice(0, 6).join(" "), 768, 794);
  ctx.fillText(words.slice(6).join(" "), 768, 849);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function mountClothNotice(stage: HTMLElement) {
  const host = stage.querySelector<HTMLElement>("[data-cloth-canvas]")!;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 600px)").matches;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 30);
  camera.position.set(0, 0, 12);
  const segX = compact ? 32 : 44;
  const segY = compact ? 28 : 38;
  const sim = new ClothSim(5.5, 4.6, segX, segY);
  const geometry = new THREE.PlaneGeometry(5.5, 4.6, segX, segY);
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(sim.positions, 3),
  );
  const colors = new Float32Array(sim.count * 3).fill(1);
  const cavity = new Float32Array(sim.count);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const print = printNotice();
  print.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const weave = makeWeaveNormalMap(compact ? 128 : 256, compact ? 40 : 80);
  weave.repeat.set(5, 5);
  const grain = makeGrainRoughnessMap();
  const material = new THREE.MeshPhysicalMaterial({
    map: print,
    normalMap: weave,
    normalScale: new THREE.Vector2(0.16, 0.16),
    roughnessMap: grain,
    roughness: 0.94,
    metalness: 0,
    sheen: 0.35,
    sheenColor: new THREE.Color("#ede0c7"),
    sheenRoughness: 0.9,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  const cloth = new THREE.Mesh(geometry, material);
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  scene.add(cloth);
  scene.add(new THREE.HemisphereLight("#fff9ef", "#bca185", 2.4));
  const light = new THREE.DirectionalLight("#fff4df", 2.8);
  light.position.set(-3, 6, 8);
  light.castShadow = true;
  const shadowSize = compact ? 512 : 1024;
  light.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(light.shadow.camera, {
    left: -5,
    right: 5,
    top: 5,
    bottom: -5,
  });
  light.shadow.bias = -0.001;
  light.shadow.normalBias = 0.02;
  scene.add(light);
  const wallGeometry = new THREE.PlaneGeometry(30, 30);
  const wallMaterial = new THREE.ShadowMaterial({ opacity: 0.12 });
  const wall = new THREE.Mesh(wallGeometry, wallMaterial);
  wall.position.z = -0.65;
  wall.receiveShadow = true;
  scene.add(wall);

  // Two tiny brass pins make the suspension points legible.
  const pinGeometry = new THREE.SphereGeometry(0.035, 12, 8);
  const pinMaterial = new THREE.MeshStandardMaterial({
    color: "#9b6e38",
    metalness: 0.7,
    roughness: 0.4,
  });
  for (const x of [-2.75, 2.75]) {
    const pin = new THREE.Mesh(pinGeometry, pinMaterial);
    pin.position.set(x, 2.3, 0.045);
    scene.add(pin);
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    const aspect = width / height;
    const viewHeight = Math.max(5.65, 6.15 / aspect);
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (!renderer.getContext().isContextLost()) renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  host.appendChild(renderer.domElement);
  resize();

  let start = performance.now();
  let last = start;
  let frame = 0;
  let running = false;
  let dragging = false;
  let disposed = false;
  let contextLost = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const target = new THREE.Vector3();
  const canvas = renderer.domElement;
  const physics = {
    viscosity: 0.045,
    stiffness: 0.92,
    iterations: compact ? 7 : 9,
    smoothing: 0.001,
  };

  function updatePointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  }
  function draw(now: number) {
    if (disposed || contextLost) return;
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    const age = (now - start) / 1000;
    if (!reducedMotion.matches && age > 0.65) sim.step(dt, physics);
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    sim.computeCavity(geometry.attributes.normal.array, cavity, 2);
    for (let i = 0; i < sim.count; i++) {
      const shade = 1 - cavity[i] * 0.12;
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = shade;
    }
    geometry.attributes.color.needsUpdate = true;
    geometry.computeBoundingSphere();
    renderer.render(scene, camera);
    // Stop spending frames after the fabric settles; dragging wakes it up.
    if (!reducedMotion.matches && (age < 14 || dragging))
      frame = requestAnimationFrame(draw);
    else running = false;
  }
  function wake() {
    if (running || disposed || contextLost || document.hidden) return;
    running = true;
    last = performance.now();
    frame = requestAnimationFrame(draw);
  }
  function onDown(event: PointerEvent) {
    if (reducedMotion.matches || event.button !== 0) return;
    updatePointer(event);
    const hit = raycaster.intersectObject(cloth)[0];
    if (!hit || !sim.startGrab(hit.point, 0.48)) return;
    dragging = true;
    plane.constant = -hit.point.z;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
    canvas.style.touchAction = "none";
    wake();
  }
  function onMove(event: PointerEvent) {
    if (!dragging) return;
    updatePointer(event);
    if (raycaster.ray.intersectPlane(plane, target)) sim.moveGrab(target);
  }
  function onUp(event: PointerEvent) {
    if (!dragging) return;
    sim.endGrab();
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "pan-y";
    start = performance.now() - 4000;
  }
  function reset() {
    sim.endGrab();
    dragging = false;
    if (reducedMotion.matches) sim.settle();
    else sim.reset();
    canvas.style.cursor = reducedMotion.matches ? "default" : "grab";
    start = performance.now();
    wake();
  }
  function visibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      running = false;
    } else wake();
  }
  function onContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame);
    running = false;
    dragging = false;
    sim.endGrab();
    // Chrome paints a white "sad canvas" after GPU loss. Hide that surface,
    // keep the message readable, and let Three.js rebuild its GPU resources.
    stage.classList.remove("is-ready");
    stage.classList.add("is-unavailable");
  }
  function onContextRestored() {
    if (disposed) return;
    contextLost = false;
    last = performance.now();
    start = last - 4000;
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    renderer.render(scene, camera);
    stage.classList.remove("is-unavailable");
    stage.classList.add("is-ready");
    wake();
  }
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  reducedMotion.addEventListener("change", reset);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pageshow", wake);
  if (reducedMotion.matches) sim.settle();
  else {
    canvas.style.cursor = "grab";
  }
  stage.classList.add("is-ready");
  wake();

  window.addEventListener("pagehide", (event) => {
    if (event.persisted) {
      // Phones often restore this exact page from the back/forward cache.
      cancelAnimationFrame(frame);
      running = false;
      return;
    }
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    window.removeEventListener("pageshow", wake);
    reducedMotion.removeEventListener("change", reset);
    document.removeEventListener("visibilitychange", visibility);
    for (const resource of [
      geometry,
      material,
      print,
      weave,
      grain,
      wallGeometry,
      wallMaterial,
      pinGeometry,
      pinMaterial,
    ])
      resource.dispose();
    renderer.dispose();
    canvas.remove();
  });
}
