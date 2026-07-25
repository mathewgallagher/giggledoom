// GIGGLEDOOM 3D engine: renderer, first-person controls, roaming shadow light,
// room detection + snoop counter, speaker bubbles. World lives in 3d-world.js.
import * as THREE from './lib/three.module.min.js';
import { EffectComposer } from './lib/postprocessing/EffectComposer.js';
import { RenderPass } from './lib/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './lib/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './lib/postprocessing/ShaderPass.js';
import { OutputPass } from './lib/postprocessing/OutputPass.js';
import { buildWorld } from './3d-world.js';
import { initNet } from './3d-net.js';
import { sfx } from './3d-sfx.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05040a);
scene.fog = new THREE.FogExp2(0x0a0806, 0.03);
const hemi = new THREE.HemisphereLight(0x4a4d58, 0x241a10, 0.85);
scene.add(hemi);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 70);

// post: bloom makes every emissive in the house actually glow (neon, screens, goo, orb)
// the composer target carries MSAA (the default target has none and every edge goes jagged)
const composerTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, composerTarget);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(480, 480), 0.5, 0.55, 0.8);
composer.addPass(bloom);
// color grade: contrast/saturation/tint chase the current room, like ROOM_FOG does
const gradePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.04 },
    saturation: { value: 1.0 },
    tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; uniform vec3 tint;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * tint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.42) * contrast + 0.42;
      gl_FragColor = vec4(max(col, vec3(0.0)), c.a);
    }`,
});
composer.addPass(gradePass);
composer.addPass(new OutputPass());

const world = buildWorld(scene, renderer);
const P = { x: -3.4, z: 2.6, y: 0, vy: 0, grounded: true, hidden: null, yaw: -0.62, pitch: -0.02, bob: 0, stam: 1 };
const net = initNet({ scene, tickers: world.tickers, P, camera, colliders: world.colliders });

// flashlight for lights-out sabotage (follows the camera)
const torch = new THREE.SpotLight(0xffe8c0, 0, 14, 0.5, 0.5, 1.6);
torch.visible = false;
scene.add(torch, torch.target);

// one shadow-casting light roams to the current room's key spot (phones stay happy)
const shadowLight = new THREE.PointLight(0xffb45c, 30, 17, 1.7);
shadowLight.castShadow = true;
shadowLight.shadow.mapSize.set(1024, 1024);
shadowLight.shadow.bias = -0.004;
shadowLight.shadow.normalBias = 0.02;
shadowLight.shadow.camera.near = 0.1;
shadowLight.position.set(-0.7, 2.25, -1.0);
scene.add(shadowLight);

// ---------- controls ----------
const keys = {};
addEventListener('keydown', e => {
  if (e.key === ' ') e.preventDefault();
  keys[e.key.toLowerCase()] = true;
});
addEventListener('keyup', e => (keys[e.key.toLowerCase()] = false));

let look = null, stick = null;
const stickBase = document.getElementById('stickBase');
const stickKnob = document.getElementById('stickKnob');
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch' && e.clientX < window.innerWidth / 2) {
    stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
    stickBase.style.display = 'block';
    stickBase.style.left = e.clientX - 55 + 'px'; stickBase.style.top = e.clientY - 55 + 'px';
  } else look = { id: e.pointerId, lx: e.clientX, ly: e.clientY };
});
addEventListener('pointermove', e => {
  if (stick && e.pointerId === stick.id) {
    stick.dx = Math.max(-50, Math.min(50, e.clientX - stick.ox));
    stick.dy = Math.max(-50, Math.min(50, e.clientY - stick.oy));
    stickKnob.style.transform = `translate(calc(-50% + ${stick.dx}px), calc(-50% + ${stick.dy}px))`;
  } else if (look && e.pointerId === look.id) {
    P.yaw -= (e.clientX - look.lx) * 0.004;
    P.pitch = Math.max(-1.2, Math.min(1.2, P.pitch - (e.clientY - look.ly) * 0.003));
    look.lx = e.clientX; look.ly = e.clientY;
  }
});
addEventListener('pointerup', e => {
  if (stick && e.pointerId === stick.id) {
    stick = null; stickBase.style.display = 'none';
    stickKnob.style.transform = 'translate(-50%,-50%)';
  }
  if (look && e.pointerId === look.id) look = null;
});

const B = world.bounds;
let jumpQueued = false;
const R = 0.3, STEP = 0.42; // grounded players walk up anything this low (stairs)
// colliders may carry a base (bottom height): upstairs walls don't block the ground floor
const blocks = (x, z) => world.colliders.some(c =>
  x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R
  && P.y < c.top - 0.06 && P.y + 1.7 > (c.base || 0)
  && !(P.grounded && c.top - P.y <= STEP));
function groundAt(x, z) {
  let g = 0;
  const reach = P.grounded ? STEP : 0.06;
  for (const c of world.colliders) {
    if (x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R
      && c.top <= P.y + reach && c.top > g) g = c.top;
  }
  return g;
}
// which floor material is underfoot, per room (drives footstep sounds)
const SURF = {
  'THE MEAT KITCHEN': 'tile', 'BATHROOM OF DOOM': 'tile',
  'THE DISCO CRYPT': 'stone', 'THE OBSERVATORY': 'stone',
  'THE GNOME YARD': 'grass', 'THE BASEMENT': 'dirt', 'THE GAME ROOM': 'carpet',
};
let sprintingNow = false, strafeSm = 0, landDip = 0, lastStepBeat = 0;
function move(dt) {
  if (window.GD3 && window.GD3.freeze) return false; // debug: lock position for screenshots
  if (P.hidden) { jumpQueued = false; P.velX = P.velZ = 0; return false; } // tucked away inside something
  let fw = 0, st = 0;
  if (keys['w'] || keys['arrowup']) fw += 1;
  if (keys['s'] || keys['arrowdown']) fw -= 1;
  if (keys['a']) st -= 1;
  if (keys['d']) st += 1;
  if (keys['arrowleft']) P.yaw += 1.9 * dt;
  if (keys['arrowright']) P.yaw -= 1.9 * dt;
  if (stick) { fw = -stick.dy / 50; st = stick.dx / 50; }
  const wantSprint = (keys['shift'] || (window.GD3 && window.GD3.sprintHeld)) && (Math.abs(fw) + Math.abs(st) > 0.1);
  const sprinting = wantSprint && P.stam > 0.02;
  sprintingNow = sprinting;
  strafeSm += (st - strafeSm) * Math.min(1, dt * 8);
  P.stam = Math.max(0, Math.min(1, P.stam + (sprinting ? -0.35 : 0.22) * dt));
  const slow = (window.GD3 && window.GD3.slowMult) || 1;
  const ruleSpeed = (window.GD3 && window.GD3.speedMult) || 1; // ZOOMIES night
  // inertia: velocity chases the input instead of teleporting to it
  const sp = 3.5 * (sprinting ? 1.55 : 1) * slow * ruleSpeed, sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
  const wantVX = (-sin * fw + cos * st) * sp;
  const wantVZ = (-cos * fw - sin * st) * sp;
  const accel = (Math.abs(fw) + Math.abs(st) > 0.1) ? 13 : 17; // stops a touch quicker than it starts
  P.velX = (P.velX || 0) + (wantVX - (P.velX || 0)) * Math.min(1, dt * accel);
  P.velZ = (P.velZ || 0) + (wantVZ - (P.velZ || 0)) * Math.min(1, dt * accel);
  let nx = P.x + P.velX * dt;
  let nz = P.z + P.velZ * dt;
  nx = Math.max(B.x0, Math.min(B.x1, nx));
  nz = Math.max(B.z0, Math.min(B.z1, nz));
  if (!blocks(nx, P.z)) P.x = nx; else P.velX = 0;
  if (!blocks(P.x, nz)) P.z = nz; else P.velZ = 0;
  // vertical: gravity, jumping, standing on whatever has a top
  const wasGrounded = P.grounded;
  let jumped = false;
  if ((keys[' '] || jumpQueued) && P.grounded) { P.vy = 5.2; P.grounded = false; jumped = true; sfx.boing(); }
  jumpQueued = false;
  P.vy -= 12 * dt;
  const impact = P.vy;
  P.y += P.vy * dt;
  const g = groundAt(P.x, P.z);
  if (P.y <= g) { P.y = g; P.vy = 0; P.grounded = true; }
  else if (wasGrounded && !jumped && P.vy <= 0 && P.y - g <= 0.55) { P.y = g; P.vy = 0; P.grounded = true; } // glue feet walking down stairs
  else P.grounded = false;
  if (!wasGrounded && P.grounded && impact < -3.6) { // landed with intent
    const k = (-impact - 3) / 3;
    landDip = Math.min(0.26, 0.09 * k + 0.05);
    sfx.thump(k);
    if (navigator.vibrate) navigator.vibrate(Math.min(40, 12 + k * 12) | 0);
    if (window.GD3) window.GD3.shake = Math.max(window.GD3.shake, Math.min(0.25, 0.1 * k));
  }
  const speedNow = Math.hypot(P.velX || 0, P.velZ || 0);
  const moving = speedNow > 0.6;
  P.bob += (moving ? 5.4 + speedNow * 1.05 : 3) * dt;
  // footsteps ride the bob cycle; each surface has its own voice
  if (moving && P.grounded) {
    const beat = Math.floor(P.bob / Math.PI);
    if (beat !== lastStepBeat) {
      lastStepBeat = beat;
      const surf = SURF[curRoom.name] || 'wood';
      sfx.step(surf, sprinting ? 1.15 : 0.75);
      if (surf === 'wood') {
        const creaky = (curRoom.name === 'THE ATTIC' ? 0.22 : 0.08) * ((window.GD3 && window.GD3.creakMult) || 1);
        if (Math.random() < creaky) {
          sfx.creak(1);
          // a LOUD board betrays you: nearby giggles rise (yours included)
          if (Math.random() < 0.25) dispatchEvent(new CustomEvent('gd-funny', { detail: { x: P.x, z: P.z, y: P.y + 1, v: 0.1 } }));
        }
      }
    }
  }
  return moving;
}

// ---------- hide-inside-things + jump buttons ----------
// cheap cinema: vignette + faint grain, sits under all HUD (z-index 10+)
const vig = document.createElement('div');
vig.style.cssText = `position:fixed; inset:0; z-index:5; pointer-events:none;
  background:
    radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,.24) 78%, rgba(4,2,8,.55) 100%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.012) 0 1px, rgba(0,0,0,.012) 1px 2px);`;
document.body.appendChild(vig);

const uiCss = document.createElement('style');
uiCss.textContent = `
  .gdCtl { position:fixed; z-index:14; border-radius:6px;
    background:linear-gradient(180deg,#2a1b0e,#170e07); border:1px solid #8a6a2a;
    box-shadow:inset 0 1px 0 rgba(255,200,120,.14), 0 2px 6px rgba(0,0,0,.5);
    color:#ffd28a; font-family:'Courier New',monospace; font-size:12px; letter-spacing:2px; padding:11px 14px; cursor:pointer; }
  #gdJump { right:12px; bottom:max(76px, calc(env(safe-area-inset-bottom) + 60px)); border-radius:50%;
    width:64px; height:64px; padding:0; font-size:11px; }
  #gdSprint { right:86px; bottom:max(76px, calc(env(safe-area-inset-bottom) + 60px)); border-radius:50%;
    width:64px; height:64px; padding:0; font-size:10px; }
  #gdStam { position:fixed; left:50%; bottom:max(50px, calc(env(safe-area-inset-bottom) + 34px));
    transform:translateX(-50%); width:150px; height:5px; background:rgba(255,255,255,.1);
    border-radius:3px; z-index:12; display:none; }
  #gdStam div { height:100%; background:#6fb0d8; border-radius:3px; }
  #gdHide { left:12px; bottom:max(216px, calc(env(safe-area-inset-bottom) + 200px)); display:none;
    background:#102a1c; border-color:#2b8a5a; color:#9affc8; }
`;
document.head.appendChild(uiCss);
const jumpBtn = document.createElement('button');
jumpBtn.id = 'gdJump'; jumpBtn.className = 'gdCtl'; jumpBtn.textContent = 'JUMP';
jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); jumpQueued = true; });
document.body.appendChild(jumpBtn);
const sprintBtn = document.createElement('button');
sprintBtn.id = 'gdSprint'; sprintBtn.className = 'gdCtl'; sprintBtn.textContent = 'RUN';
sprintBtn.addEventListener('pointerdown', e => { e.preventDefault(); window.GD3.sprintHeld = true; });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
  sprintBtn.addEventListener(ev, () => { window.GD3.sprintHeld = false; }));
document.body.appendChild(sprintBtn);
const stamEl = document.createElement('div');
stamEl.id = 'gdStam'; stamEl.innerHTML = '<div></div>';
document.body.appendChild(stamEl);
const hideBtn = document.createElement('button');
hideBtn.id = 'gdHide'; hideBtn.className = 'gdCtl';
document.body.appendChild(hideBtn);
let nearHidey = null;
hideBtn.addEventListener('click', () => {
  if (P.hidden) {
    P.x = P.hidden.outX; P.z = P.hidden.outZ; P.y = P.hidden.y || 0; P.hidden = null;
    sfx.whoosh();
  } else if (nearHidey) {
    P.hidden = nearHidey;
    // two-person spots: if slot 1 is taken by a peer, take slot 2
    let ix = nearHidey.inX, iz = nearHidey.inZ;
    if (nearHidey.cap === 2 && nearHidey.in2X != null) {
      const peers = net && net.peers;
      let slot1Taken = false;
      if (peers) peers.forEach(pr => { if (pr.hidey === nearHidey.id && Math.hypot(pr.cx - ix, pr.cz - iz) < 0.4) slot1Taken = true; });
      if (slot1Taken) { ix = nearHidey.in2X; iz = nearHidey.in2Z; }
    }
    P.x = ix; P.z = iz; P.y = nearHidey.y || 0; P.yaw = nearHidey.inYaw; P.pitch = 0;
    sfx.whoosh();
  }
});
function hideyTick() {
  if (P.hidden) { hideBtn.style.display = 'block'; hideBtn.textContent = 'GET OUT'; return; }
  nearHidey = null;
  for (const h of world.hideys) {
    if (Math.hypot(P.x - h.x, P.z - h.z) < 1.5 && Math.abs(P.y - (h.y || 0)) < 1.6) { nearHidey = h; break; }
  }
  hideBtn.style.display = nearHidey ? 'block' : 'none';
  if (nearHidey) hideBtn.textContent = 'HIDE IN ' + nearHidey.label;
}

// ---------- HUD: room tag + snoop counter ----------
const roomNameEl = document.getElementById('roomName');
const snoopEl = document.getElementById('snoop');
const objEl = document.getElementById('obj');
let curRoom = world.rooms[0];
world.rooms.forEach(r => (r.visited = false));
let allDone = false;
function roomAt(x, z, y = 0) {
  return world.rooms.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1
    && y >= (r.y0 != null ? r.y0 : -0.5) && y < (r.y1 != null ? r.y1 : 3.45)) || curRoom;
}

// per-room air: [fog color, density]
const ROOM_FOG = {
  'THE MEAT KITCHEN': [0x0a1206, 0.046],   // sickly green haze
  'THE NURSERY': [0x060a16, 0.042],        // cold blue
  'THE DISCO CRYPT': [0x0d0616, 0.036],    // purple must
  'THE BASEMENT': [0x0b0703, 0.052],       // thick and brown
  'THE ATTIC': [0x090603, 0.058],          // dust you can chew
  'THE OBSERVATORY': [0x04060f, 0.026],    // thin midnight air
  'THE GNOME YARD': [0x040909, 0.038],     // night garden damp
  'BATHROOM OF DOOM': [0x06100c, 0.044],   // steam that never left
  default: [0x0a0806, 0.03],
};
const fogTarget = new THREE.Color();
// per-room grade: [contrast, saturation, tint] ‚Äî subtle, the fog does the loud part
const ROOM_GRADE = {
  'THE MEAT KITCHEN': [1.07, 0.88, 0xdcf2d4],   // grease-green, a little dead
  'THE NURSERY': [1.05, 0.80, 0xd8e4ff],        // cold and drained
  'THE DISCO CRYPT': [1.06, 1.20, 0xf0e2ff],    // saturated party rot
  'THE BASEMENT': [1.10, 0.86, 0xffe2c4],       // crushed amber
  'THE ATTIC': [1.08, 0.72, 0xffe6c0],          // old-photo sepia
  'THE OBSERVATORY': [1.06, 1.04, 0xdce6ff],    // crisp midnight
  'THE GNOME YARD': [1.05, 0.96, 0xd8eee0],     // damp moon garden
  'BATHROOM OF DOOM': [1.06, 0.90, 0xe0f4e6],   // sickly steam
  'MASTER BEDCHAMBER': [1.05, 0.92, 0xffe2ea],  // romance gone off
  default: [1.04, 1.0, 0xffffff],
};
const gradeTint = new THREE.Color();
const BLOOD_GRADE = [1.16, 0.62, 0xff9a86]; // BLOOD MOON: the grade goes red so the hemi doesn't have to
// which loop the room hums, and how much the walls echo
const ROOM_AMB = {
  'THE BASEMENT': 'hum', 'THE DISCO CRYPT': 'drone', 'THE OBSERVATORY': 'drone',
  'THE ATTIC': 'wind', 'THE GNOME YARD': 'wind', 'THE NURSERY': 'musicbox',
};
const ROOM_VERB = {
  'BATHROOM OF DOOM': 0.26, 'THE DISCO CRYPT': 0.24, 'THE OBSERVATORY': 0.22,
  'THE BASEMENT': 0.2, 'THE DEN': 0.16, 'THE GAME ROOM': 0.16, 'THE LANDING': 0.16,
};
let nextSnort = 0;

// ---------- speaker bubbles ----------
const bubble = document.getElementById('bubble');
let bubbleUntil = 0, bubbleSp = null, dwellSp = null, dwell = 0;
const V3 = new THREE.Vector3();

// ---------- main loop ----------
const playerPos = { x: P.x, z: P.z };
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  const moving = move(dt);
  hideyTick();
  playerPos.x = P.x; playerPos.z = P.z; playerPos.y = P.y;
  sfx.listener.x = P.x; sfx.listener.z = P.z; sfx.listener.yaw = P.yaw; // ears follow the head
  const eyeH = P.hidden && P.hidden.crouch ? 0.45 : 1.58; // under the bed you ARE the floor
  landDip = Math.max(0, landDip - dt * 1.1); // knees recover after a landing
  camera.position.set(P.x, P.y + eyeH - landDip + (moving ? Math.sin(P.bob) * 0.035 : Math.sin(P.bob) * 0.008), P.z);
  if (window.GD3 && window.GD3.shake > 0) { // kill nearby, meeting slam, etc
    window.GD3.shake = Math.max(0, window.GD3.shake - dt);
    const a = window.GD3.shake * 0.06;
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a;
  }
  camera.rotation.set(0, 0, 0);
  camera.rotateY(P.yaw); camera.rotateX(P.pitch);
  camera.rotateZ(-strafeSm * 0.018); // lean into the strafe
  // the giggle takes over the camera when it gets bad
  const gfx = (window.GD3 && window.GD3.giggleFx) || 0;
  if (gfx > 0.55) {
    const wob = (gfx - 0.55) / 0.45;
    camera.rotateZ(Math.sin(t * 8.5) * 0.02 * wob);
    camera.rotateX(Math.sin(t * 11.3) * 0.012 * wob);
    if (t > nextSnort && gfx > 0.75) { nextSnort = t + 1.1 + Math.random(); sfx.snort(); }
  }
  // sprint stretches the view a touch
  const wantFov = 72 + (sprintingNow ? 6 : 0);
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 6);
    camera.updateProjectionMatrix();
  }
  if (window.GD3 && window.GD3.camView) { // security cameras: view swaps, body stays
    const cv2 = window.GD3.camView;
    camera.position.set(cv2.x, cv2.y, cv2.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(cv2.yaw); camera.rotateX(cv2.pitch);
  }
  stamEl.style.display = P.stam < 0.995 ? 'block' : 'none';
  stamEl.firstElementChild.style.width = (P.stam * 100) + '%';
  torch.position.copy(camera.position);
  torch.target.position.set(
    camera.position.x - Math.sin(P.yaw) * 6,
    camera.position.y - 2.2,
    camera.position.z - Math.cos(P.yaw) * 6);

  // current room, snoop tally, roaming shadow light
  const room = roomAt(P.x, P.z, P.y);
  if (room !== curRoom) { curRoom = room; roomNameEl.textContent = room.name; }
  sfx.ambience(ROOM_AMB[room.name] || 'house');
  sfx.setVerb(ROOM_VERB[room.name] || 0.1);
  if (!room.visited) {
    room.visited = true;
    const n = world.rooms.filter(r => r.visited).length;
    snoopEl.textContent = `SNOOPED ${n}/${world.rooms.length}`;
    if (n === world.rooms.length && !allDone) {
      allDone = true;
      objEl.textContent = 'HOUSE FULLY SNOOPED. YOU LIVE HERE NOW.';
    }
  }
  const kp = room.posFn();
  shadowLight.position.lerp(kp, Math.min(1, dt * 6));
  shadowLight.color.lerp(new THREE.Color(room.color), Math.min(1, dt * 6));
  shadowLight.intensity += (room.base * 0.85 * room.flick(t) - shadowLight.intensity) * Math.min(1, dt * 10);

  // each room breathes its own air: fog color + density crossfade as you move
  const fg = ROOM_FOG[room.name] || ROOM_FOG.default;
  fogTarget.setHex(fg[0]);
  scene.fog.color.lerp(fogTarget, Math.min(1, dt * 1.6));
  scene.fog.density += (fg[1] * ((window.GD3 && window.GD3.fogMult) || 1) - scene.fog.density) * Math.min(1, dt * 1.6);

  // the grade chases the room's palette; BLOOD MOON night grabs the wheel
  const gr = (window.GD3 && window.GD3.bloodmoon) ? BLOOD_GRADE : (ROOM_GRADE[room.name] || ROOM_GRADE.default);
  const gu = gradePass.uniforms;
  gu.contrast.value += (gr[0] - gu.contrast.value) * Math.min(1, dt * 1.6);
  gu.saturation.value += (gr[1] - gu.saturation.value) * Math.min(1, dt * 1.6);
  gradeTint.setHex(gr[2]);
  gu.tint.value.lerp(gradeTint, Math.min(1, dt * 1.6));

  world.tickers.forEach(f => f(t, dt, playerPos));
  // disco fever: the whole house throbs with color for a few seconds
  if (window.GD3 && window.GD3.discoUntil && performance.now() < window.GD3.discoUntil) {
    hemi.color.setHSL((t * 0.6) % 1, 0.7, 0.55);
    hemi.intensity = 0.9 + 0.4 * Math.sin(t * 12);
  } else if (window.GD3 && window.GD3.discoUntil) {
    window.GD3.discoUntil = 0; hemi.color.setHex(0x4a4d58);
  }
  const dark = window.GD3 && window.GD3.lightsOut;
  const blood = window.GD3 && window.GD3.bloodmoon; // BLOOD MOON night: dim and resentful
  if (!(window.GD3 && window.GD3.discoUntil)) {
    hemi.intensity += ((dark ? 0.06 : blood ? 0.5 : 0.85) - hemi.intensity) * Math.min(1, dt * 4);
    fogTarget.setHex(blood ? 0x565055 : 0x4a4d58); // blood stays dim but neutral: the grade pass paints the red now
    hemi.color.lerp(fogTarget, Math.min(1, dt * 2));
  }
  torch.visible = !!dark;
  torch.intensity += ((dark ? 11 : 0) - torch.intensity) * Math.min(1, dt * 5);
  if (dark) {
    shadowLight.intensity *= 0.07;
    world.rooms.forEach(r => { r.fill.intensity *= 0.07; });
  }

  // nearest talking thing (same floor only ‚Äî walls muffle, floors mute)
  let near = null, nd = 1e9;
  for (const sp of world.speakers) {
    const d = Math.hypot(P.x - sp.x, P.z - sp.z);
    if (d < sp.radius && d < nd && Math.abs((sp.y || 1.2) - (P.y + 1.2)) < 2.6) { nd = d; near = sp; }
  }
  if (near === dwellSp) dwell += dt; else { dwellSp = near; dwell = 0; }
  if (near && dwell > 0.15 && t > bubbleUntil && t > (near.cool || 0)) {
    near.i = near.i || 0;
    bubble.textContent = `${near.name}: "${near.lines[near.i++ % near.lines.length]}"`;
    bubble.style.display = 'block';
    bubbleUntil = t + 3.4; near.cool = t + 9; bubbleSp = near;
    dispatchEvent(new CustomEvent('gd-funny', { detail: { x: near.x, z: near.z, y: near.y, v: 0.22 } }));
  }
  if (bubble.style.display === 'block' && bubbleSp) {
    if (t > bubbleUntil + 0.6) bubble.style.display = 'none';
    else {
      V3.set(bubbleSp.x, bubbleSp.y, bubbleSp.z).project(camera);
      if (V3.z < 1) {
        bubble.style.left = (V3.x * 0.5 + 0.5) * window.innerWidth + 'px';
        bubble.style.top = (-V3.y * 0.5 + 0.5) * window.innerHeight + 'px';
      } else bubble.style.display = 'none';
    }
  }

  composer.render();

  // potato mode: if a phone can't hold the frame rate, quietly trade beauty for feel
  fpsN++; fpsT += dt;
  if (!potato && fpsT > 5 && clock.elapsedTime > 8) {
    const fps = fpsN / fpsT;
    fpsN = 0; fpsT = 0;
    if (fps < 42) {
      potato = true;
      bloom.enabled = false;
      // MSAA off: zero the samples and force the FBOs to rebuild without them
      composer.renderTarget1.samples = 0;
      composer.renderTarget2.samples = 0;
      composer.renderTarget1.dispose();
      composer.renderTarget2.dispose();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); // internal buffers shrink too
      if (world.potato) world.potato(); // world-side heavy bits (hero shadows, practicals) stand down
      objEl.textContent = 'POTATO MODE ENGAGED. the house looks worse but feels better.';
      setTimeout(() => { objEl.textContent = 'OBJECTIVE: SNOOP ALL 15 ROOMS. YES, FIFTEEN NOW.'; }, 5000);
    }
  } else if (fpsT > 5) { fpsN = 0; fpsT = 0; }
}
let fpsN = 0, fpsT = 0, potato = false;
tick();

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// debug handle (module scope is unreachable from the console otherwise)
window.GD3 = {
  P, keys, rooms: world.rooms, net, world, shake: 0, bloom, grade: gradePass, composer,
  slowMult: 1, sprintHeld: false, lightsOut: false, camView: null, discoUntil: 0,
  go(name) {
    const r = world.rooms.find(r => r.name.includes(name.toUpperCase()));
    if (r) { P.x = (r.x0 + r.x1) / 2; P.z = (r.z0 + r.z1) / 2; P.y = r.floorY || 0; P.vy = 0; }
    return r ? r.name : 'no such room';
  },
};
