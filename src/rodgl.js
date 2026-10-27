// The rod builder in 3D: blank, handle, reel seat, and guides placed by rod.js with the chosen thread colour.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const L = 9;

export function initRod(canvas) {
  const small = innerWidth <= 820;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(3, 6, 5);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  const rod = new THREE.Group();
  const spin = new THREE.Group();
  rod.add(spin);
  scene.add(rod);

  const carbon = new THREE.MeshPhysicalMaterial({ color: 0x0c1418, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
  const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.1, L, 24), carbon);
  blank.rotation.z = -Math.PI / 2; // butt at -X, tip at +X
  const eva = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, L * 0.2, 28), new THREE.MeshStandardMaterial({ color: 0x23282b, roughness: 0.9 }));
  eva.rotation.z = -Math.PI / 2; eva.position.x = -L / 2 + L * 0.1;
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.55, 28), new THREE.MeshStandardMaterial({ color: 0xb8c0c4, metalness: 1, roughness: 0.2 }));
  seat.rotation.z = -Math.PI / 2; seat.position.x = -L / 2 + L * 0.23;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 28), new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.4 }));
  cap.rotation.z = -Math.PI / 2; cap.position.x = -L / 2 + 0.04;
  spin.add(blank, eva, seat, cap);

  const guides = new THREE.Group();
  spin.add(guides);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xc9d1d5, metalness: 1, roughness: 0.18 });
  const ringMat = new THREE.MeshPhysicalMaterial({ color: 0x15191b, metalness: 0.2, roughness: 0.1, clearcoat: 1 });
  const threadMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.35, clearcoat: 1 });

  function set(positions, thread) {
    threadMat.color.set(thread);
    guides.children.forEach((m) => m.geometry.dispose());
    guides.clear();
    for (const f of positions) {
      const x = -L / 2 + f * L;
      const r = THREE.MathUtils.lerp(0.1, 0.022, f);
      const ringR = THREE.MathUtils.lerp(0.34, 0.07, (f - 0.28) / 0.72);
      const lift = f === 1 ? 0 : r + 0.05 + ringR;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.022, 10, 32), ringMat);
      const outer = new THREE.Mesh(new THREE.TorusGeometry(ringR + 0.02, 0.012, 8, 32), frameMat);
      for (const m of [ring, outer]) { m.rotation.y = Math.PI / 2; m.position.set(x, lift, 0); }
      guides.add(ring, outer);
      if (f < 1) {
        const legLen = lift - ringR - r + 0.02;
        for (const s of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, legLen * 1.25, 8), frameMat);
          leg.position.set(x + s * legLen * 0.35, r + legLen / 2, 0);
          leg.rotation.z = s * 0.6;
          guides.add(leg);
        }
      }
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.012, r + 0.012, f === 1 ? 0.12 : 0.34, 20), threadMat);
      wrap.rotation.z = -Math.PI / 2; wrap.position.x = x;
      guides.add(wrap);
    }
  }

  let w = 0, h = 0;
  function resize() {
    if (canvas.clientWidth === w && canvas.clientHeight === h) return;
    w = canvas.clientWidth; h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // fit the diagonal rod: wider screens can stand further back
    const wide = w / h > 1;
    rod.rotation.z = wide ? 0.42 : 1.1;
    // stand back far enough for the tilted rod (plus guides) to fit the shorter side
    const half = L / 2 + 0.6, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needH = half * Math.sin(rod.rotation.z) / tan, needW = half * Math.cos(rod.rotation.z) / (tan * camera.aspect);
    camera.position.set(0, 0, Math.max(needH, needW) * 1.08);
    camera.updateProjectionMatrix();
  }

  let raf = 0, running = false, last = performance.now(), t = 0, still = false, tilt = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!still) t += dt;
    spin.rotation.x = Math.sin(t * 0.6) * 0.9 + 0.5;
    rod.rotation.y = tilt;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  resize();

  return {
    set,
    resize,
    tilt(v) { tilt = v; },
    still(v) { still = v; },
    run(on) {
      if (on === running) return;
      running = on;
      if (on) { last = performance.now(); raf = requestAnimationFrame(loop); } else cancelAnimationFrame(raf);
    },
    draw() { renderer.render(scene, camera); },
  };
}
