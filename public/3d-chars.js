// GIGGLEDOOM 3D characters and canvas helpers. Everything primitive-built, zero assets.
import * as THREE from './lib/three.module.min.js';

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...o });
export function shadowAll(g) { g.traverse(o => { if (o.isMesh) o.castShadow = true; }); }

// canvas-painted plane. paint(ctx, pw, ph). basic:true = unlit (signs, ZZZ, sky)
export function canvasPlane(w, h, pw, ph, paint, opts = {}) {
  const c = document.createElement('canvas'); c.width = pw; c.height = ph;
  paint(c.getContext('2d'), pw, ph);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const M = opts.basic ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
  const m = new M({ map: t, transparent: !!opts.transparent, ...(opts.mat || {}) });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

export function signPlane(lines, w, h, o = {}) {
  return canvasPlane(w, h, o.pw || 256, o.ph || 128, (g, pw, ph) => {
    g.fillStyle = o.bg || '#e8dfc8'; g.fillRect(0, 0, pw, ph);
    g.strokeStyle = o.border || '#2a1c0e'; g.lineWidth = 6; g.strokeRect(4, 4, pw - 8, ph - 8);
    g.fillStyle = o.fg || '#1c1108'; g.textAlign = 'center';
    const fs = o.fs || 22; g.font = `bold ${fs}px Courier New`;
    lines.forEach((ln, i) => g.fillText(ln, pw / 2, ph / 2 + (i - (lines.length - 1) / 2) * (fs + 6) + fs * 0.35));
  }, { basic: true });
}

// ---------- ZOOMY ----------
export function buildZoomy() {
  const g = new THREE.Group(), Z = {};
  const teal = std(0x2ad4d6, { emissive: 0x0a4a4e, emissiveIntensity: 0.55 });
  const tealDark = std(0x1aa8ac, { emissive: 0x073a3d, emissiveIntensity: 0.55 });
  const belly = std(0xc6f2ea, { roughness: 0.9 });
  const white = std(0xf7f7f2, { roughness: 0.35 });
  const black = std(0x14181c, { roughness: 0.3 });
  const pink = std(0xff9fb0);
  const red = std(0xd93a3a, { roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.42, 6, 18), teal);
  body.position.y = 0.62; g.add(body);
  const tum = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), belly);
  tum.scale.set(1, 1.25, 0.55); tum.position.set(0, 0.56, 0.17); g.add(tum);
  const head = new THREE.Group(); head.position.y = 1.18; Z.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), teal);
  skull.scale.set(1, 0.95, 0.92); head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), belly);
  muzzle.scale.set(1.25, 0.8, 0.8); muzzle.position.set(0, -0.08, 0.22); head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), pink);
  nose.position.set(0, -0.02, 0.33); head.add(nose);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03), white);
  teeth.position.set(0, -0.17, 0.28); head.add(teeth);
  const gap = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.035), black);
  gap.position.set(0, -0.17, 0.281); head.add(gap);
  Z.eyes = []; Z.pupils = [];
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), white);
    eye.position.set(0.115 * s, 0.06, 0.21); head.add(eye); Z.eyes.push(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8), black);
    pupil.position.set(0.115 * s, 0.06, 0.285); head.add(pupil); Z.pupils.push(pupil);
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 5, 12), teal);
    ear.position.set(0.13 * s, 0.5, -0.03); ear.rotation.z = -0.22 * s; ear.rotation.x = -0.1;
    head.add(ear); Z['ear' + (s > 0 ? 'R' : 'L')] = ear;
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.34, 4, 8), pink);
    inner.position.set(0.15 * s, 0.5, 0.03); inner.rotation.z = -0.22 * s; inner.rotation.x = -0.1;
    head.add(inner);
    for (let w = -1; w <= 1; w++) {
      const wk = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4), white);
      wk.rotation.z = Math.PI / 2 + 0.25 * w * s; wk.position.set(0.2 * s, -0.06 + w * 0.03, 0.24);
      head.add(wk);
    }
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 5, 10), tealDark);
    arm.position.set(0.34 * s, 0.72, 0.02); arm.rotation.z = 0.5 * s; g.add(arm);
    Z['arm' + (s > 0 ? 'R' : 'L')] = arm;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.2, 5, 10), tealDark);
    leg.position.set(0.15 * s, 0.22, 0); g.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.34), red);
    shoe.position.set(0.15 * s, 0.065, 0.06); g.add(shoe);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.06, 0.1), white);
    toe.position.set(0.15 * s, 0.04, 0.21); g.add(toe);
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.16), white);
    lace.position.set(0.15 * s, 0.12, 0.09); g.add(lace);
  });
  g.add(head);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), white);
  tail.position.set(0, 0.5, -0.28); g.add(tail);
  shadowAll(g);

  function tick(t, dt, player) {
    g.position.y = Math.sin(t * 2.1) * 0.03;
    const dx = player.x - g.position.x, dz = player.z - g.position.z;
    const want = Math.atan2(dx, dz);
    let dy = want - g.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    g.rotation.y += dy * Math.min(1, dt * 3);
    Z.earL.rotation.z = 0.22 + Math.sin(t * 2.3) * 0.08;
    Z.earR.rotation.z = -0.22 + Math.sin(t * 2.3 + 0.9) * 0.08;
    Z.armL.rotation.z = -0.5 + Math.sin(t * 2.1) * 0.06;
    Z.armR.rotation.z = 0.5 - Math.sin(t * 2.1) * 0.06;
    const blink = (t % 3.7) < 0.12 ? 0.08 : 1;
    Z.eyes.forEach(e => (e.scale.y = blink));
    Z.pupils.forEach(p => { p.position.y = 0.06 + Math.sin(t * 0.7) * 0.012; p.scale.setScalar(blink < 1 ? 0.01 : 1); });
    Z.head.rotation.x = Math.sin(t * 1.4) * 0.05;
  }
  return { group: g, tick };
}

// ---------- THE MONSTER (on break, asleep on a tiny folding chair) ----------
export function buildMonster() {
  const g = new THREE.Group();
  const fur = std(0x342238, { roughness: 0.95 });
  const furDark = std(0x241528, { roughness: 0.95 });
  const bellyM = std(0x4d3354, { roughness: 0.95 });
  const horn = std(0xd8c9a8, { roughness: 0.6 });
  const metal = std(0x6a6f74, { roughness: 0.4, metalness: 0.7 });

  // comically small folding chair
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.5), metal);
  seat.position.set(0, 0.45, 0); g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.05), metal);
  back.position.set(0, 0.8, -0.26); g.add(back);
  [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), metal);
    leg.position.set(x, 0.22, z); g.add(leg);
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.68, 20, 16), fur);
  body.scale.set(1, 1.1, 0.92); body.position.set(0, 1.05, 0.1); g.add(body);
  const tum = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), bellyM);
  tum.scale.set(0.95, 1, 0.6); tum.position.set(0, 0.92, 0.42); g.add(tum);
  let sr = 3;
  const srnd = () => (sr = (sr * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) { // fur clumps
    const cl = new THREE.Mesh(new THREE.SphereGeometry(0.16 + srnd() * 0.18, 10, 8), furDark);
    const a = srnd() * Math.PI * 2, b = srnd() * Math.PI - Math.PI / 2;
    cl.position.set(Math.cos(a) * Math.cos(b) * 0.62, 1.05 + Math.sin(b) * 0.68, 0.1 + Math.sin(a) * Math.cos(b) * 0.56);
    g.add(cl);
  }
  const head = new THREE.Group(); head.position.set(0, 1.85, 0.18); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), fur);
  skull.scale.set(1.05, 0.95, 0.95); head.add(skull);
  [-1, 1].forEach(s => {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 8), horn);
    h.position.set(0.26 * s, 0.38, -0.05); h.rotation.z = -0.5 * s; head.add(h);
  });
  const eyes = [];
  [[-0.15, 0.1, 0.09], [0.15, 0.1, 0.09], [0, 0.22, 0.07]].forEach(([x, y, r]) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a1a08, emissive: 0xff9d2e, emissiveIntensity: 0.5 }));
    e.position.set(x, y, 0.36); e.scale.y = 0.35; // sleepy lids
    head.add(e); eyes.push(e);
  });
  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), std(0x120608));
  maw.scale.set(1.3, 0.7, 0.5); maw.position.set(0, -0.16, 0.32); head.add(maw);
  for (let i = -2; i <= 2; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), std(0xf0ead8, { roughness: 0.4 }));
    tooth.position.set(i * 0.08, -0.1, 0.42); tooth.rotation.x = Math.PI; head.add(tooth);
  }
  const drool = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.12, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0xbfe8e0, transparent: true, opacity: 0.6, roughness: 0.2 }));
  drool.position.set(0.12, -0.32, 0.36); head.add(drool);
  [-1, 1].forEach(s => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 6, 10), fur);
    arm.position.set(0.62 * s, 0.85, 0.3); arm.rotation.z = 1.1 * s; arm.rotation.x = -0.5; g.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.4, 6, 10), fur);
    leg.position.set(0.28 * s, 0.35, 0.55); leg.rotation.x = Math.PI / 2 - 0.25; g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), furDark);
    foot.scale.set(1, 0.7, 1.35); foot.position.set(0.28 * s, 0.14, 0.85); g.add(foot);
  });
  // ZZZ sprites
  const zs = [];
  for (let i = 0; i < 3; i++) {
    const z = canvasPlane(0.26, 0.26, 64, 64, (c) => {
      c.fillStyle = '#f5efdc'; c.font = 'bold 52px Courier New'; c.textAlign = 'center'; c.fillText('Z', 32, 50);
    }, { basic: true, transparent: true });
    z.position.set(0.3, 2.3, 0.2); g.add(z); zs.push(z);
  }
  shadowAll(g);
  zs.forEach(z => (z.castShadow = false));

  function tick(t, dt, player) {
    body.scale.y = 1.1 + Math.sin(t * 1.1) * 0.035; // snore breathing
    head.rotation.x = 0.12 + Math.sin(t * 1.1) * 0.05;
    eyes.forEach(e => (e.material.emissiveIntensity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.7))));
    zs.forEach((z, i) => {
      const ph = (t * 0.35 + i / 3) % 1;
      z.position.set(0.3 + Math.sin(ph * 6 + i) * 0.12, 2.25 + ph * 0.9, 0.2);
      z.material.opacity = ph < 0.15 ? ph / 0.15 : 1 - (ph - 0.15) / 0.85;
      z.rotation.y = Math.atan2(player.x - z.getWorldPosition(V).x, player.z - V.z); // face player-ish
    });
  }
  return { group: g, tick };
}
const V = new THREE.Vector3();

// ---------- GNOME (they stare) ----------
export function buildGnome(s = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 12), std(0x35548f));
  body.position.y = 0.19; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), std(0xe8b890));
  head.position.y = 0.42; g.add(head);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), std(0xf2f0ea));
  beard.scale.set(1, 1.2, 0.6); beard.position.set(0, 0.36, 0.05); g.add(beard);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), std(0xd89078));
  nose.position.set(0, 0.44, 0.095); g.add(nose);
  [-1, 1].forEach(sx => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), std(0x0a0a0a, { roughness: 0.2 }));
    eye.position.set(0.035 * sx, 0.465, 0.085); g.add(eye);
  });
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.34, 12), std(0xc03030));
  hat.position.y = 0.62; g.add(hat);
  [-1, 1].forEach(sx => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), std(0x2a1c0e));
    foot.scale.set(1, 0.6, 1.5); foot.position.set(0.07 * sx, 0.025, 0.06); g.add(foot);
  });
  g.scale.setScalar(s);
  shadowAll(g);
  return { group: g };
}

// ---------- TEDDY (one glowing eye) ----------
export function buildTeddy() {
  const g = new THREE.Group();
  const brown = std(0x7a4e28, { roughness: 0.95 });
  const pale = std(0xc9a878, { roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), brown);
  body.scale.set(1, 1.15, 0.85); body.position.y = 0.38; g.add(body);
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), pale);
  patch.scale.set(0.9, 1, 0.5); patch.position.set(0, 0.36, 0.2); g.add(patch);
  for (let i = 0; i < 3; i++) { // stitches
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.012), std(0x201008));
    st.position.set(0, 0.24 + i * 0.12, 0.335); st.rotation.z = 0.3 * (i % 2 ? 1 : -1); g.add(st);
  }
  const head = new THREE.Group(); head.position.set(0, 0.86, 0.02); head.rotation.z = 0.18; g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), brown); head.add(skull);
  [-1, 1].forEach(s => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), brown);
    ear.position.set(0.17 * s, 0.19, 0); head.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pale);
    inner.position.set(0.17 * s, 0.19, 0.05); head.add(inner);
  });
  const muzz = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), pale);
  muzz.scale.set(1.1, 0.8, 0.9); muzz.position.set(0, -0.05, 0.18); head.add(muzz);
  const noseT = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0x1a0e06));
  noseT.position.set(0, -0.01, 0.27); head.add(noseT);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0x120a04, { roughness: 0.25 }));
  eyeL.position.set(-0.09, 0.06, 0.2); head.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x300404, emissive: 0xff2020, emissiveIntensity: 1.2 }));
  eyeR.position.set(0.09, 0.06, 0.2); head.add(eyeR);
  [-1, 1].forEach(s => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.2, 5, 8), brown);
    arm.position.set(0.33 * s, 0.45, 0.05); arm.rotation.z = 1.2 * s; g.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.18, 5, 8), brown);
    leg.position.set(0.16 * s, 0.12, 0.22); leg.rotation.x = Math.PI / 2 - 0.15; g.add(leg);
  });
  shadowAll(g);
  function tick(t) {
    eyeR.material.emissiveIntensity = (Math.sin(t * 0.9) > 0.94) ? 0.15 : 1.2; // occasional "blink" of the bad eye
  }
  return { group: g, tick };
}

// ---------- SKELETON (party casualty) ----------
export function buildSkeleton() {
  const g = new THREE.Group();
  const bone = std(0xe8e4d6, { roughness: 0.6 });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), bone);
  spine.position.y = 0.55; g.add(spine);
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.16 - i * 0.02, 0.022, 6, 14), bone);
    rib.position.set(0, 0.68 - i * 0.11, 0.02); rib.rotation.x = Math.PI / 2 - 0.25; g.add(rib);
  }
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.16), bone);
  pelvis.position.y = 0.28; g.add(pelvis);
  const head = new THREE.Group(); head.position.y = 0.95; g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), bone);
  skull.scale.set(0.95, 1.05, 1); head.add(skull);
  [-1, 1].forEach(s => {
    const socket = new THREE.Mesh(new THREE.CircleGeometry(0.038, 10), std(0x0a0a0a));
    socket.position.set(0.055 * s, 0.02, 0.135); head.add(socket);
  });
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.09), bone);
  jaw.position.set(0, -0.12, 0.06); head.add(jaw);
  const hat = canvasHatCone(); hat.position.set(0.03, 0.19, 0); hat.rotation.z = -0.25; head.add(hat);
  [-1, 1].forEach(s => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), bone);
    arm.position.set(0.2 * s, 0.6, 0.05); arm.rotation.z = 0.9 * s; g.add(arm);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.42, 6), bone);
    leg.position.set(0.1 * s, 0.16, 0.2); leg.rotation.x = Math.PI / 2 - 0.4; g.add(leg);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.35, 6), bone);
    shin.position.set(0.1 * s, -0.05, 0.42); g.add(shin);
  });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.09, 10), std(0xd94040, { roughness: 0.5 }));
  cup.position.set(0.36, 0.42, 0.12); g.add(cup);
  shadowAll(g);
  function tick(t) {
    head.rotation.z = Math.sin(t * 0.6) * 0.12;
    jaw.position.y = -0.12 - ((Math.sin(t * 0.8) > 0.9) ? 0.035 : 0); // jaw drops sometimes
  }
  return { group: g, tick };
}
function canvasHatCone() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d84fd0'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ffd23e';
  for (let i = 0; i < 4; i++) g.fillRect(0, i * 18, 64, 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 12),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
}

// ---------- DUCK ----------
export function buildDuck(s = 1, cursed = false) {
  const g = new THREE.Group();
  const yellow = std(cursed ? 0x14141a : 0xf2c724, { roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), yellow);
  body.scale.set(1.25, 0.9, 1); body.position.y = 0.11; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), yellow);
  head.position.set(0.12, 0.24, 0); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 10), std(0xe07818, { roughness: 0.5 }));
  beak.rotation.z = -Math.PI / 2; beak.position.set(0.22, 0.23, 0); g.add(beak);
  [-1, 1].forEach(sz => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6),
      cursed ? new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff1a1a, emissiveIntensity: 1.5 })
             : std(0x14181c, { roughness: 0.25 }));
    eye.position.set(0.16, 0.27, 0.05 * sz); g.add(eye);
  });
  g.scale.setScalar(s);
  shadowAll(g);
  return { group: g };
}

// ---------- PLAYER RIGS (multiplayer) ----------
const CHAR_DEFS = {
  zoomy:    { body: 0x2ad4d6, dark: 0x1aa8ac, belly: 0xc6f2ea, em: 0x0a4a4e },
  slurp:    { body: 0xf090b8, dark: 0xd06a94, belly: 0xffd8e8, em: 0x4a1028 },
  gremlin:  { body: 0x6fb838, dark: 0x4e8a24, belly: 0xc8e8a0, em: 0x1e4a0a },
  wallfish: { body: 0x9a7ae0, dark: 0x7656b8, belly: 0xd8c8f8, em: 0x2a1a5a },
};

export function buildPlayerRig(char) {
  const def = CHAR_DEFS[char] || CHAR_DEFS.zoomy;
  const g = new THREE.Group();
  const main = std(def.body, { emissive: def.em, emissiveIntensity: 0.55 });
  const dark = std(def.dark, { emissive: def.em, emissiveIntensity: 0.45 });
  const belly = std(def.belly, { roughness: 0.9 });
  const white = std(0xf7f7f2, { roughness: 0.35 });
  const black = std(0x14181c, { roughness: 0.3 });
  const pink = std(0xff9fb0);
  const R = { g, eyes: [], pupils: [], tents: [] };

  const wide = char === 'slurp' ? 1.3 : 1;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, char === 'slurp' ? 0.3 : 0.42, 6, 18), main);
  body.scale.set(wide, 1, wide); body.position.y = 0.62; g.add(body);
  const tum = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), belly);
  tum.scale.set(wide, 1.25, 0.55); tum.position.set(0, 0.56, 0.17 * wide); g.add(tum);

  const head = new THREE.Group(); head.position.y = 1.18; g.add(head); R.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), main);
  if (char === 'wallfish') skull.scale.set(1.15, 1.3, 1.1); else skull.scale.set(1, 0.95, 0.92);
  head.add(skull);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), black);
  mouth.position.set(0, -0.13, 0.26); head.add(mouth); R.mouth = mouth;
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), white);
    eye.position.set(0.115 * s, 0.06, 0.21);
    eye.userData.lid = char === 'slurp' ? 0.7 : 1; // heavy lids ride every expression
    if (char === 'slurp') eye.scale.y = 0.7;
    head.add(eye); R.eyes.push(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8), black);
    pupil.position.set(0.115 * s, 0.06, 0.275); head.add(pupil); R.pupils.push(pupil);
    // arms with shoulder pivots so they can swing while walking
    const shoulder = new THREE.Group(); shoulder.position.set(0.32 * s * wide, 0.88, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 5, 10), dark);
    arm.position.y = -0.18; shoulder.add(arm); g.add(shoulder);
    R['arm' + (s > 0 ? 'R' : 'L')] = shoulder;
  });

  if (char === 'zoomy') {
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 5, 12), main);
      ear.position.set(0.13 * s, 0.5, -0.03); ear.rotation.z = -0.22 * s; head.add(ear);
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.34, 4, 8), pink);
      inner.position.set(0.15 * s, 0.5, 0.03); inner.rotation.z = -0.22 * s; head.add(inner);
    });
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03), white);
    teeth.position.set(0, -0.17, 0.26); head.add(teeth);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), white);
    tail.position.set(0, 0.5, -0.28); g.add(tail);
  } else if (char === 'slurp') {
    const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 8), pink);
    tongue.position.set(0.03, -0.18, 0.28); tongue.rotation.x = 1.1; head.add(tongue);
    const drool = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.08, 4, 6),
      new THREE.MeshStandardMaterial({ color: 0xbfe8e0, transparent: true, opacity: 0.6 }));
    drool.position.set(-0.08, -0.22, 0.24); head.add(drool);
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), main);
      ear.position.set(0.2 * s, 0.24, -0.02); head.add(ear);
    });
  } else if (char === 'gremlin') {
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 10), main);
      ear.position.set(0.24 * s, 0.28, -0.02); ear.rotation.z = -0.9 * s; head.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 8), pink);
      inner.position.set(0.25 * s, 0.26, 0.02); inner.rotation.z = -0.9 * s; head.add(inner);
    });
    const snaggle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.02),
      std(0xe8c840, { metalness: 0.7, roughness: 0.3 }));
    snaggle.position.set(0.04, -0.16, 0.26); head.add(snaggle);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.45, 5, 8), main);
    tail.position.set(0, 0.35, -0.3); tail.rotation.x = 0.9; g.add(tail);
  } else if (char === 'wallfish') {
    [[-0.08, 0.28], [0.05, 0.34], [0.14, 0.24]].forEach(([x, y]) => {
      const fr = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), belly);
      fr.position.set(x, y, 0.24); head.add(fr);
    });
    [-1, 1].forEach(s => {
      const fin = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), dark);
      fin.scale.set(0.3, 1, 0.7); fin.position.set(0.3 * s, 0.15, -0.02); head.add(fin);
    });
    for (let i = 0; i < 6; i++) { // tentacle skirt instead of legs
      const a = i / 6 * Math.PI * 2;
      const tent = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 5, 8), dark);
      tent.position.set(Math.cos(a) * 0.16, 0.18, Math.sin(a) * 0.16);
      tent.rotation.z = Math.cos(a) * 0.5; tent.rotation.x = -Math.sin(a) * 0.5;
      g.add(tent); R.tents.push({ m: tent, a });
    }
  }
  if (char !== 'wallfish') {
    [-1, 1].forEach(s => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.2, 5, 10), dark);
      leg.position.set(0.15 * s, 0.22, 0); g.add(leg);
      if (char === 'zoomy') {
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.34), std(0xd93a3a, { roughness: 0.6 }));
        shoe.position.set(0.15 * s, 0.065, 0.06); g.add(shoe);
        const toe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.06, 0.1), white);
        toe.position.set(0.15 * s, 0.04, 0.21); g.add(toe);
      } else {
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), dark);
        foot.scale.set(1, 0.55, 1.4); foot.position.set(0.15 * s, 0.05, 0.07); g.add(foot);
      }
    });
  }
  // eyebrows: the whole personality in one angled box per eye (refs kept ‚Äî the face reacts now)
  const browAngle = { zoomy: -0.18, slurp: 0.35, gremlin: -0.45, wallfish: 0 }[char] || 0;
  R.brows = [];
  R.eyes.forEach((eye, i) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.03), black);
    brow.position.copy(eye.position);
    brow.position.y += 0.085;
    brow.position.z += 0.015;
    brow.rotation.z = browAngle * (i === 0 ? 1 : -1); // mirrored: angry meets angrier
    brow.userData.by = brow.position.y; brow.userData.bz = brow.rotation.z;
    eye.parent.add(brow);
    R.brows.push(brow);
  });
  g.userData.char = char; // animateRig reads this for walk personality
  shadowAll(g);
  return R;
}

export function animateRig(R, t, moving) {
  // walk personality: zoomy bounces, slurp waddles, gremlin skitters, wallfish glides
  const ch = R.g.userData.char || 'zoomy';
  const P9 = { zoomy: [10, 0.09, 0, 0.55], slurp: [6.5, 0.045, 0.1, 0.45], gremlin: [12.5, 0.05, 0, 0.85], wallfish: [7, 0.015, 0, 0.4] };
  const [f, hop, rock, arm] = P9[ch] || P9.zoomy;
  R.g.position.y = moving ? Math.abs(Math.sin(t * f)) * hop : Math.sin(t * 2.1) * 0.03;
  R.waddle = moving && rock ? Math.sin(t * f * 0.5) * rock : 0; // applied on top of the lean by the caller
  const swing = moving ? Math.sin(t * f) * arm : Math.sin(t * 2.1) * 0.05;
  if (R.armL) R.armL.rotation.x = swing;
  if (R.armR) R.armR.rotation.x = -swing;
  const blink = (t % 3.7) < 0.12 ? 0.08 : 1;
  // reactive face: fear pops the eyes and lifts the brows, loud talking narrows the
  // pupils, death droops the lot. Caller feeds R.fear (0..1), R.talk (0..3), R.dead.
  const fear = R.dead ? 0 : (R.fear || 0);
  R.eyes.forEach(e => (e.scale.y = (e.userData.lid || 1) * blink * (R.dead ? 0.55 : 1 + fear * 0.5)));
  const pupS = R.dead ? 0.7 : Math.max(0.4, 1 - (R.talk || 0) * 0.16 - fear * 0.25);
  R.pupils.forEach(p => p.scale.setScalar(blink < 1 ? 0.01 : pupS));
  if (R.brows) R.brows.forEach((b, i) => {
    const s = i === 0 ? 1 : -1;
    b.position.y = b.userData.by + (R.dead ? -0.035 : fear * 0.045);
    b.rotation.z = R.dead ? -0.45 * s : b.userData.bz + (-0.3 * s - b.userData.bz) * fear;
  });
  R.tents.forEach(({ m, a }, i) => {
    m.rotation.z = Math.cos(a) * 0.5 + Math.sin(t * (moving ? 9.5 : 3) + i) * (ch === 'wallfish' ? 0.26 : 0.18);
  });
  if (R.head) R.head.rotation.x = Math.sin(t * 1.4) * 0.05;
  if (R.hatMesh) R.hatMesh.children.forEach(c => {
    if (c.userData.spin) c.rotation.y += moving ? 0.45 : 0.12;
    if (c.userData.hover) c.position.y = 0.16 + Math.sin(t * 2) * 0.025;
  });
}

export function makeNameTag(text) {
  const tag = canvasPlane(1.1, 0.26, 256, 64, (c, w, h) => {
    c.font = 'bold 30px Courier New'; c.textAlign = 'center';
    c.lineWidth = 6; c.strokeStyle = '#0a0a0c'; c.strokeText(text, w / 2, 42);
    c.fillStyle = '#f2ead8'; c.fillText(text, w / 2, 42);
  }, { basic: true, transparent: true });
  tag.material.depthWrite = false;
  return tag;
}

// ---------- HATS (bought with coins, worn with pride) ----------
export const HATS = {
  party:   { label: 'PARTY CONE', cost: 50 },
  cone:    { label: 'TRAFFIC CONE', cost: 75 },
  plunger: { label: 'PLUNGER (WHY)', cost: 90 },
  tophat:  { label: 'TOP HAT', cost: 100 },
  prop:    { label: 'PROPELLER', cost: 125 },
  viking:  { label: 'VIKING HORNS', cost: 140 },
  halo:    { label: 'HALO (UNDESERVED)', cost: 150 },
  chef:    { label: 'CHEF TOQUE', cost: 175 },
  crown:   { label: 'CROWN', cost: 200 },
  gnomecap:{ label: 'GNOME CAP (EARNED?)', cost: 250 },
};
export function makeHat(id) {
  const g = new THREE.Group();
  if (id === 'party') {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#d84fd0'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#ffd23e'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 18, 64, 7);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 12), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    cone.position.y = 0.15; g.add(cone);
  } else if (id === 'cone') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 12), std(0xe07818, { roughness: 0.5 }));
    cone.position.y = 0.17; g.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.06, 12), std(0xf2f0ea));
    band.position.y = 0.14; g.add(band);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.24), std(0xe07818));
    base.position.y = 0.01; g.add(base);
  } else if (id === 'tophat') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16), std(0x16161a, { roughness: 0.4 }));
    g.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 16), std(0x16161a, { roughness: 0.4 }));
    top.position.y = 0.14; g.add(top);
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 16), std(0x7e2f3f, { roughness: 0.5 }));
    rib.position.y = 0.05; g.add(rib);
  } else if (id === 'prop') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x3a6cc8, { roughness: 0.6 }));
    g.add(cap);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), std(0xd8d0c0));
    stick.position.y = 0.13; g.add(stick);
    const blades = new THREE.Group(); blades.position.y = 0.18;
    [0, Math.PI / 2].forEach(ry => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, 0.05), std(0xd84040, { roughness: 0.5 }));
      b.rotation.y = ry; blades.add(b);
    });
    blades.userData.spin = true;
    g.add(blades);
  } else if (id === 'halo') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x8a7020, emissive: 0xffd23e, emissiveIntensity: 1.1 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.16;
    ring.userData.hover = true;
    g.add(ring);
  } else if (id === 'plunger') {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(0x8a2438, { roughness: 0.7 }));
    cup.rotation.x = Math.PI; cup.position.y = 0.06; g.add(cup);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), std(0xb8905a, { roughness: 0.8 }));
    stick.position.y = 0.2; g.add(stick);
  } else if (id === 'viking') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x76767e, { metalness: 0.6, roughness: 0.4 }));
    g.add(cap);
    [-1, 1].forEach(s => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 8), std(0xe8dcc0, { roughness: 0.6 }));
      horn.position.set(0.16 * s, 0.1, 0); horn.rotation.z = -s * 0.9; g.add(horn);
    });
  } else if (id === 'chef') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.1, 14), std(0xf2f0ea, { roughness: 0.85 }));
    base.position.y = 0.05; g.add(base);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), std(0xf2f0ea, { roughness: 0.9 }));
    puff.scale.y = 0.85; puff.position.y = 0.16; g.add(puff);
  } else if (id === 'gnomecap') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 12), std(0xc02828, { roughness: 0.75 }));
    cone.position.y = 0.2; cone.rotation.z = 0.15; g.add(cone); // slightly askew. stolen, clearly.
  } else if (id === 'crown') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.09, 12),
      std(0xd8a030, { metalness: 0.8, roughness: 0.25 }));
    band.position.y = 0.045; g.add(band);
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), std(0xd8a030, { metalness: 0.8, roughness: 0.25 }));
      const a = i / 6 * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.12, 0.12, Math.sin(a) * 0.12); g.add(spike);
    }
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x7e2f3f, emissive: 0xd42222, emissiveIntensity: 0.5 }));
    gem.position.set(0, 0.05, 0.13); g.add(gem);
  } else return null;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function attachHat(R, id) {
  if (R.hatMesh) { (R.head || R.g).remove(R.hatMesh); R.hatMesh = null; }
  const h = makeHat(id);
  if (!h) return;
  h.position.y = 0.26; // sits on top of the head
  (R.head || R.g).add(h);
  R.hatMesh = h;
}

// ---------- WALKING MONSTER (MONSTER WAKES mode) ‚Äî upright, striding, furious ----------
export function buildWalkMonster() {
  const g = new THREE.Group();
  const fur = std(0x342238, { roughness: 0.95 });
  const furDark = std(0x241528, { roughness: 0.95 });
  const bellyM = std(0x4d3354, { roughness: 0.95 });
  const horn = std(0xd8c9a8, { roughness: 0.6 });
  const R = {};
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.5, 8, 18), fur);
  body.position.y = 1.15; g.add(body);
  const tum = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), bellyM);
  tum.scale.set(1, 1.2, 0.6); tum.position.set(0, 1.05, 0.28); g.add(tum);
  let sr = 5; const srnd = () => (sr = (sr * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 8; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(0.13 + srnd() * 0.16, 10, 8), furDark);
    const a = srnd() * Math.PI * 2, b = srnd() * Math.PI - Math.PI / 2;
    cl.position.set(Math.cos(a) * Math.cos(b) * 0.44, 1.2 + Math.sin(b) * 0.55, Math.sin(a) * Math.cos(b) * 0.36);
    g.add(cl);
  }
  const head = new THREE.Group(); head.position.set(0, 1.95, 0.05); g.add(head); R.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), fur);
  skull.scale.set(1.05, 0.95, 0.95); head.add(skull);
  [-1, 1].forEach(s => {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 8), horn);
    h.position.set(0.22 * s, 0.34, -0.04); h.rotation.z = -0.5 * s; head.add(h);
  });
  R.eyes = [];
  [[-0.13, 0.06, 0.08], [0.13, 0.06, 0.08], [0, 0.2, 0.06]].forEach(([x, y, r]) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a1a08, emissive: 0xff5a1e, emissiveIntensity: 1.4 }));
    e.position.set(x, y, 0.3); head.add(e); R.eyes.push(e);
  });
  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), std(0x120608));
  maw.scale.set(1.3, 0.8, 0.5); maw.position.set(0, -0.16, 0.28); head.add(maw); R.maw = maw;
  for (let i = -2; i <= 2; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 6), std(0xf0ead8, { roughness: 0.4 }));
    tooth.position.set(i * 0.07, -0.09, 0.36); tooth.rotation.x = Math.PI; head.add(tooth);
  }
  [-1, 1].forEach(s => {
    const arm = new THREE.Group(); arm.position.set(0.5 * s, 1.5, 0);
    const a1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 6, 10), fur);
    a1.position.y = -0.3; arm.add(a1);
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), furDark);
    claw.position.y = -0.62; arm.add(claw);
    g.add(arm); R['arm' + (s > 0 ? 'R' : 'L')] = arm;
    const leg = new THREE.Group(); leg.position.set(0.2 * s, 0.75, 0);
    const l1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 6, 10), fur);
    l1.position.y = -0.3; leg.add(l1);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), furDark);
    foot.scale.set(1, 0.6, 1.4); foot.position.set(0, -0.6, 0.12); leg.add(foot);
    g.add(leg); R['leg' + (s > 0 ? 'R' : 'L')] = leg;
  });
  shadowAll(g);
  R.group = g;
  R.tick = (t, moving) => {
    const sw = Math.sin(t * (moving ? 7 : 1.5));
    R.legL.rotation.x = moving ? sw * 0.7 : 0;
    R.legR.rotation.x = moving ? -sw * 0.7 : 0;
    R.armL.rotation.x = moving ? -sw * 0.5 : Math.sin(t * 1.5) * 0.1;
    R.armR.rotation.x = moving ? sw * 0.5 : -Math.sin(t * 1.5) * 0.1;
    g.position.y = moving ? Math.abs(Math.sin(t * 7)) * 0.08 : 0;
    R.head.rotation.z = sw * 0.06;
    R.maw.scale.y = 0.8 + Math.abs(Math.sin(t * 3)) * 0.5; // gnashing
    R.eyes.forEach(e => (e.material.emissiveIntensity = moving ? 1.8 : 1.2));
  };
  return R;
}
