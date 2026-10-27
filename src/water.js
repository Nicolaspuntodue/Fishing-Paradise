// Hero WebGL: a waterline shader behind the name, and a 3D minnow on the line that sinks with the scroll.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const srgb = (hex) => { const c = new THREE.Color(); c.setHex(hex, THREE.LinearSRGBColorSpace); return new THREE.Vector3(c.r, c.g, c.b); };

const bgFrag = /* glsl */ `
  uniform vec2 uRes; uniform float uTime, uLine, uP;
  uniform vec3 uPaper, uTeal, uBlue;
  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float y = 1.0 - uv.y;
    float x = uv.x * uRes.x / uRes.y;
    float line = uLine + sin(x * 9.0 + uTime * 1.3) * 0.0045 + sin(x * 23.0 - uTime * 2.1) * 0.0018;
    if (y < line) { gl_FragColor = vec4(uPaper, 1.0); return; }
    float d = y - line;
    vec3 col = mix(uTeal, uBlue, smoothstep(0.0, 1.0, clamp(d * 0.9 + uP * 1.25, 0.0, 1.0)));
    // slanted sun beams from the surface, fading with depth
    float sx = x + d * 0.35;
    float rays = pow(sin(sx * 4.0 + uTime * 0.15) * 0.5 + 0.5, 8.0) + 0.6 * pow(sin(sx * 7.3 - uTime * 0.22 + 1.7) * 0.5 + 0.5, 12.0);
    col += rays * exp(-d * 2.5) * (1.0 - uP) * 0.14;
    col = mix(col, uPaper, smoothstep(0.012, 0.0, d) * 0.4);
    col = mix(col, uBlue, smoothstep(0.45, 0.68, uP));
    gl_FragColor = vec4(col, 1.0);
  }`;

function makeLure() {
  const g = new THREE.Group();
  // minnow body: a lathe along Y, laid along X with the nose at +X
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = 0.3 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.75) + 0.004;
    prof.push(new THREE.Vector2(r, -1 + 2 * t));
  }
  const geo = new THREE.LatheGeometry(prof, 40);
  geo.rotateZ(-Math.PI / 2);
  geo.scale(1, 1, 0.62);
  const pos = geo.attributes.position, col = [], c = new THREE.Color();
  const back = new THREE.Color(0x1e5fa8), side = new THREE.Color(0xd9e2e6), belly = new THREE.Color(0xff7a2f);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 0.3;
    if (y > 0.15) c.copy(side).lerp(back, Math.min(1, (y - 0.15) / 0.55));
    else if (y < -0.45) c.copy(side).lerp(belly, Math.min(1, (-y - 0.45) / 0.35));
    else c.copy(side);
    // dark parr marks along the flank
    const x = pos.getX(i);
    if (y > 0.05 && y < 0.5 && Math.sin(x * 14) > 0.75 && x < 0.6) c.multiplyScalar(0.35);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 })));

  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0xffc21a, metalness: 0.4, roughness: 0.2, clearcoat: 1 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), eyeMat);
    eye.position.set(0.68, 0.06, s * 0.13);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), pupilMat);
    pupil.position.set(0.7, 0.06, s * 0.185);
    g.add(eye, pupil);
  }
  // clear diving lip
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.24),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.6, roughness: 0.1, transparent: true, opacity: 0.55 }));
  lip.position.set(1.08, -0.1, 0); lip.rotation.z = -0.55;
  g.add(lip);
  // two trebles
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4ab, metalness: 1, roughness: 0.25 });
  for (const hx of [0.25, -0.7]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 16), steel);
    ring.position.set(hx, -0.31, 0);
    g.add(ring);
    for (let k = 0; k < 3; k++) {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 6, 18, Math.PI * 1.35), steel);
      hook.position.set(hx, -0.43, 0);
      hook.rotation.set(0, (k * Math.PI * 2) / 3, Math.PI * 0.85);
      g.add(hook);
    }
  }
  const tie = new THREE.Object3D();
  tie.position.set(1.18, -0.02, 0);
  g.add(tie);
  return { g, tie };
}

export function initHero(canvas) {
  // phones: no MSAA and a lower pixel ratio; the shader is full-screen, so pixels are the whole cost
  const small = innerWidth <= 820;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.25 : 1.5));
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  // background: one full-screen triangle with the water shader
  const bgUni = {
    uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uLine: { value: 0.5 }, uP: { value: 0 },
    uPaper: { value: srgb(0xf2f5f6) }, uTeal: { value: srgb(0x1a6f8a) }, uBlue: { value: srgb(0x0e3f5c) },
  };
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const bgScene = new THREE.Scene();
  bgScene.add(new THREE.Mesh(bgGeo, new THREE.ShaderMaterial({
    uniforms: bgUni, depthWrite: false, depthTest: false,
    vertexShader: 'void main(){ gl_Position = vec4(position, 1.0); }',
    fragmentShader: bgFrag,
  })));
  const bgCam = new THREE.Camera();

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 5, 4);
  scene.add(sun, new THREE.AmbientLight(0x8fb3c2, 0.6));
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 10;

  const { g: lure, tie } = makeLure();
  scene.add(lure);

  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const fishLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x06141c, transparent: true, opacity: 0.7 }));
  scene.add(fishLine);

  // bubbles, only below the surface
  const N = small ? 36 : 70, bPos = new Float32Array(N * 3), bSpeed = new Float32Array(N);
  const bUni = { uSurf: { value: 0 }, uPx: { value: 1 } };
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const bubbles = new THREE.Points(bGeo, new THREE.ShaderMaterial({
    uniforms: bUni, transparent: true, depthWrite: false,
    vertexShader: `uniform float uPx; varying float vY;
      void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uPx * (2.0 + mod(position.x * 37.0, 5.0)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uSurf; varying float vY;
      void main(){ if (vY > uSurf - 0.05) discard; float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(0.93, 0.97, 0.96, smoothstep(0.5, 0.3, d) * 0.55); }`,
  }));
  scene.add(bubbles);

  let W = 1, H = 1, visH = 1, visW = 1, phone = false;
  const world = (fx, fy, out = new THREE.Vector3()) => out.set((fx - 0.5) * visW, (0.5 - fy) * visH, 0);

  function resize() {
    // the stage is 100svh, so a phone's address bar showing or hiding changes nothing here
    if (canvas.clientWidth === W && canvas.clientHeight === H) return;
    W = canvas.clientWidth; H = canvas.clientHeight;
    phone = W < 820;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    visW = visH * camera.aspect;
    bgUni.uRes.value.set(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
    bUni.uPx.value = renderer.getPixelRatio();
    lure.scale.setScalar(phone ? (0.42 * visW) / 2 : Math.min(1.15, (0.2 * visW) / 2));
    for (let i = 0; i < N; i++) {
      bPos[i * 3] = (Math.random() - 0.5) * visW;
      bPos[i * 3 + 1] = (Math.random() - 0.5) * visH;
      bSpeed[i] = 0.25 + Math.random() * 0.6;
    }
  }

  const state = { p: 0, line: 0.5, still: false };
  const anchor = new THREE.Vector3(), top = new THREE.Vector3(), tieW = new THREE.Vector3();
  let last = performance.now(), time = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!state.still) time += dt;
    const { p, line } = state;

    bgUni.uTime.value = time; bgUni.uLine.value = line; bgUni.uP.value = p;

    // the lure hangs nose-up just under the surface, then turns and swims as it sinks
    const fx = phone ? 0.72 : 0.79, fy = (phone ? 0.69 : 0.72) - 0.14 * p;
    // when the story rises over the dive, the lure swims off to the right
    world(fx + THREE.MathUtils.smoothstep(p, 0.5, 0.95) * 0.7, fy + Math.sin(time * 1.1) * 0.012, anchor);
    lure.position.copy(anchor);
    const swim = THREE.MathUtils.smoothstep(p, 0.02, 0.45);
    lure.rotation.set(Math.sin(time * 2.6) * 0.25 * (0.4 + swim), Math.sin(time * 1.7) * 0.18 + swim * 0.35, THREE.MathUtils.lerp(1.3, -0.08, swim));

    lure.updateMatrixWorld();
    tie.getWorldPosition(tieW);
    world(fx + 0.12 + 0.1 * swim, -0.05, top);
    const lp = lineGeo.attributes.position;
    lp.setXYZ(0, tieW.x, tieW.y, tieW.z); lp.setXYZ(1, top.x, top.y, 0); lp.needsUpdate = true;

    const surf = (0.5 - line) * visH;
    bUni.uSurf.value = surf;
    for (let i = 0; i < N; i++) {
      bPos[i * 3 + 1] += bSpeed[i] * dt;
      bPos[i * 3] += Math.sin(time * 2 + i) * 0.002;
      if (bPos[i * 3 + 1] > visH / 2) bPos[i * 3 + 1] = -visH / 2;
    }
    bGeo.attributes.position.needsUpdate = true;

    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.render(scene, camera);
  }

  let raf = 0, running = false;
  const loop = (t) => { frame(t); raf = requestAnimationFrame(loop); };
  resize();
  frame(performance.now());

  return {
    set(p, line) { state.p = p; state.line = line; },
    still(v) { state.still = v; },
    run(on) {
      if (on === running) return;
      running = on;
      if (on) { last = performance.now(); raf = requestAnimationFrame(loop); } else cancelAnimationFrame(raf);
    },
    resize,
  };
}
