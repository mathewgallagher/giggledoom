// GIGGLEDOOM 3D world: 8 themed rooms, walls with doorways, per-room light rigs,
// props, talking things. All procedural. Returns { colliders, tickers, speakers, rooms, bounds }.
import * as THREE from './lib/three.module.min.js';
import { RoundedBoxGeometry } from './lib/geometries/RoundedBoxGeometry.js';
import { std, shadowAll, canvasPlane, signPlane, buildZoomy, buildMonster, buildGnome, buildTeddy, buildSkeleton, buildDuck } from './3d-chars.js';
import { sfx } from './3d-sfx.js';

const H = 3.2, V = new THREE.Vector3();

export function buildWorld(scene, renderer) {
  const colliders = [], tickers = [], speakers = [];
  const hideys = []; // enterable hiding spots: {id, label, x, z, inX, inZ, inYaw, outX, outZ, y?, crouch?}
  // top = height of the obstacle: you can stand on anything with a reachable top.
  // base = bottom of the obstacle: upstairs walls/floors don't block whoever walks beneath them.
  const addCollider = (x, z, sx, sz, top = H, base = 0) =>
    colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, top, base });
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  function cv(w, h, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  }
  const noise = (g, w, h, n, a, dark = true) => {
    for (let i = 0; i < n; i++) {
      const v = rnd();
      g.fillStyle = dark && v < 0.5 ? `rgba(10,8,6,${a * rnd()})` : `rgba(235,225,205,${a * 0.6 * rnd()})`;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 1 + rnd() * 3, 0, 7); g.fill();
    }
  };

  // ---------- textures ----------
  // size is parameterized: floors live at 1024 now so the boards hold up close-up
  const plankTex = (r, gr, b, size = 1024) => cv(size, size, (g, w, h) => {
    const sc = w / 512;
    g.fillStyle = `rgb(${r * 0.55 | 0},${gr * 0.55 | 0},${b * 0.55 | 0})`; g.fillRect(0, 0, w, h);
    const rows = 6, plw = 128 * sc;
    for (let row = 0; row < rows; row++) {
      const y = row * (h / rows), ph = h / rows, off = (row % 2) * plw * 0.5;
      for (let x = -1; x < 5; x++) {
        const px = x * plw + off, l = 0.75 + rnd() * 0.5;
        g.fillStyle = `rgb(${r * l | 0},${gr * l | 0},${b * l | 0})`;
        g.fillRect(px + 2 * sc, y + 2 * sc, plw - 4 * sc, ph - 4 * sc);
        g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3 * sc;
        g.strokeRect(px + sc, y + sc, plw - 2 * sc, ph - 2 * sc);
        for (let s = 0; s < 6; s++) {
          g.strokeStyle = `rgba(20,12,6,${0.1 + rnd() * 0.2})`; g.lineWidth = (1 + rnd()) * sc;
          const gy = y + 6 * sc + rnd() * (ph - 12 * sc);
          g.beginPath(); g.moveTo(px + 4 * sc, gy);
          g.bezierCurveTo(px + plw * 0.3, gy + (rnd() * 6 - 3) * sc, px + plw * 0.7, gy + (rnd() * 6 - 3) * sc, px + plw - 4 * sc, gy + (rnd() * 4 - 2) * sc);
          g.stroke();
        }
      }
    }
  });
  const denFloorTex = plankTex(86, 58, 34);
  const paleFloorTex = plankTex(148, 132, 112);
  const hallFloorTex = plankTex(62, 42, 24);

  const plasterTex = cv(512, 512, (g, w, h) => {
    g.fillStyle = '#6e6152'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 2400, 0.12);
    for (let i = 0; i < 8; i++) {
      const x = rnd() * w, y = rnd() * h, r = 24 + rnd() * 70;
      const rg = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      rg.addColorStop(0, 'rgba(52,40,26,.2)'); rg.addColorStop(1, 'rgba(52,40,26,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
  const darkWoodTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#33220f'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 4; x++) {
      const l = 0.8 + rnd() * 0.4;
      g.fillStyle = `rgb(${60 * l | 0},${40 * l | 0},${22 * l | 0})`;
      g.fillRect(x * 64 + 2, 0, 60, h);
      for (let s = 0; s < 9; s++) {
        g.strokeStyle = `rgba(18,10,4,${0.15 + rnd() * 0.25})`; g.lineWidth = 1 + rnd();
        g.beginPath(); g.moveTo(x * 64 + 4 + rnd() * 56, 0); g.lineTo(x * 64 + 4 + rnd() * 56, h); g.stroke();
      }
    }
  });
  const damaskTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#3a1220'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * 64 + 32 + (y % 2) * 32, cy = y * 64 + 32;
      g.strokeStyle = 'rgba(160,110,60,.35)'; g.lineWidth = 2;
      g.beginPath(); g.arc(cx % w, cy, 16, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(cx % w, cy - 24); g.lineTo(cx % w + 10, cy); g.lineTo(cx % w, cy + 24); g.lineTo(cx % w - 10, cy); g.closePath();
      g.strokeStyle = 'rgba(90,20,40,.8)'; g.stroke();
    }
    noise(g, w, h, 600, 0.08);
  });
  const nurseryTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#dcc0ca'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * 64 + 32 + (y % 2) * 20, cy = y * 64 + 28;
      g.fillStyle = '#e8d548';
      g.beginPath(); g.ellipse(cx % w, cy, 11, 8, 0, 0, 7); g.fill();
      g.beginPath(); g.arc((cx % w) + 8, cy - 8, 6, 0, 7); g.fill();
      g.fillStyle = '#d8863a'; g.beginPath(); g.moveTo((cx % w) + 13, cy - 9); g.lineTo((cx % w) + 20, cy - 7); g.lineTo((cx % w) + 13, cy - 5); g.fill();
    }
    g.strokeStyle = 'rgba(60,30,30,.28)'; g.lineWidth = 3; // crayon scribbles
    for (let i = 0; i < 1; i++) {
      g.beginPath(); g.moveTo(rnd() * w, rnd() * h);
      for (let k = 0; k < 5; k++) g.lineTo(rnd() * w, rnd() * h);
      g.stroke();
    }
    noise(g, w, h, 500, 0.06);
  });
  const checkerTex = cv(1024, 1024, (g, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#57524a' : '#c8c0ac';
      g.fillRect(x * 256, y * 256, 256, 256);
    }
    noise(g, w, h, 3600, 0.14);
  });
  const tileWallTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4640'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const l = 0.85 + rnd() * 0.25;
      g.fillStyle = `rgb(${168 * l | 0},${176 * l | 0},${164 * l | 0})`;
      g.fillRect(x * 64 + 3, y * 64 + 3, 58, 58);
    }
    noise(g, w, h, 700, 0.12);
  });
  const bathTileTex = cv(1024, 1024, (g, w, h) => {
    g.fillStyle = '#3c4a40'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const l = 0.8 + rnd() * 0.3;
      g.fillStyle = `rgb(${128 * l | 0},${168 * l | 0},${140 * l | 0})`;
      g.fillRect(x * 128 + 8, y * 128 + 8, 112, 112);
    }
    g.strokeStyle = 'rgba(20,16,12,.3)'; g.lineWidth = 5; // cracks
    for (let i = 0; i < 2; i++) {
      g.beginPath(); g.moveTo(rnd() * w, rnd() * h);
      for (let k = 0; k < 3; k++) g.lineTo(rnd() * w, rnd() * h);
      g.stroke();
    }
  });
  const stoneWallTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#2c2c30'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) {
      const off = (y % 2) * 42, l = 0.75 + rnd() * 0.5;
      g.fillStyle = `rgb(${104 * l | 0},${104 * l | 0},${112 * l | 0})`;
      g.beginPath(); g.roundRect((x * 85 + off) % w, y * 64 + 4, 78, 56, 8); g.fill();
      if (rnd() < 0.35) { g.fillStyle = 'rgba(60,90,50,.3)'; g.beginPath(); g.arc((x * 85 + off + 20) % w, y * 64 + 40, 12, 0, 7); g.fill(); }
    }
  });
  const stoneFloorTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#232326'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const l = 0.8 + rnd() * 0.35;
      g.fillStyle = `rgb(${88 * l | 0},${88 * l | 0},${96 * l | 0})`;
      g.fillRect(x * 128 + 4, y * 128 + 4, 120, 120);
    }
    noise(g, w, h, 700, 0.1);
  });
  const hedgeTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#16290f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const l = rnd();
      g.fillStyle = `rgb(${20 + l * 40 | 0},${52 + l * 50 | 0},${20 + l * 30 | 0})`;
      g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 4 + rnd() * 7, 2 + rnd() * 4, rnd() * 3, 0, 7); g.fill();
    }
  });
  const grassTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#2a4220'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const l = rnd();
      g.strokeStyle = `rgb(${34 + l * 40 | 0},${74 + l * 50 | 0},${28 + l * 26 | 0})`;
      const x = rnd() * w, y = rnd() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 4 - 2, y - 4 - rnd() * 5); g.stroke();
    }
  });
  const dirtTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#463424'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 2200, 0.16);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(120,105,85,${0.3 + rnd() * 0.3})`;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 4, 0, 7); g.fill();
    }
  });
  const concreteTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#6e6a64'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 1600, 0.1);
    g.strokeStyle = 'rgba(25,22,18,.25)'; g.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      g.beginPath(); g.moveTo(rnd() * w, 0);
      g.bezierCurveTo(rnd() * w, h * 0.3, rnd() * w, h * 0.7, rnd() * w, h);
      g.stroke();
    }
  });
  const skyTex = cv(512, 512, (g, w, h) => {
    g.fillStyle = '#05070f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(220,230,255,${0.25 + rnd() * 0.75})`;
      g.fillRect(rnd() * w, rnd() * h, rnd() < 0.12 ? 3 : 1.6, rnd() < 0.12 ? 3 : 1.6);
    }
    g.fillStyle = '#d9e2f0'; g.beginPath(); g.arc(370, 150, 44, 0, 7); g.fill();
    g.fillStyle = 'rgba(150,160,180,.5)';
    [[352, 138, 8], [386, 162, 6], [372, 172, 4]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
  });
  const runnerTex = cv(512, 128, (g, w, h) => {
    g.fillStyle = '#5a1f1f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 5; g.strokeRect(9, 9, w - 18, h - 18);
    g.fillStyle = 'rgba(201,162,74,.8)';
    for (let x = 40; x < w; x += 70) {
      g.save(); g.translate(x, h / 2); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore();
    }
    noise(g, w, h, 500, 0.1);
  });
  const crateTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#6b4a26'; g.fillRect(0, 0, w, h);
    for (let s = 0; s < 5; s++) {
      const l = 0.85 + rnd() * 0.3;
      g.fillStyle = `rgb(${118 * l | 0},${82 * l | 0},${44 * l | 0})`;
      g.fillRect(4, s * 52 + 4, w - 8, 44);
    }
    g.strokeStyle = '#2e1c0b'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    g.fillStyle = '#1c1108'; g.font = 'bold 34px Courier New'; g.textAlign = 'center';
    g.fillText('HA HA', w / 2, h / 2 - 20); g.fillText('SUPPLY', w / 2, h / 2 + 22);
  });
  const rugTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#5a1f1f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = '#7e2f2f'; g.lineWidth = 12; g.strokeRect(34, 34, w - 68, h - 68);
    g.fillStyle = '#c9a24a';
    for (let i = 0; i < 4; i++) { g.save(); g.translate(w / 2, h / 2); g.rotate(i * Math.PI / 2); g.fillRect(-5, 40, 10, 40); g.restore(); }
    noise(g, w, h, 700, 0.08);
  });

  // ---------- upstairs textures ----------
  const floralTex = cv(256, 256, (g, w, h) => { // faded rose wallpaper, peeling at heart
    g.fillStyle = '#8a7668'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = (x * 64 + 32 + (y % 2) * 32) % w, cy = y * 64 + 32;
      g.fillStyle = 'rgba(140,80,90,.55)';
      for (let p = 0; p < 5; p++) {
        const a = p * 1.257;
        g.beginPath(); g.ellipse(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 7, 5, a, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(90,50,60,.7)'; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
      g.strokeStyle = 'rgba(70,90,60,.4)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx, cy + 8); g.quadraticCurveTo(cx + 6, cy + 20, cx + 2, cy + 30); g.stroke();
    }
    for (let i = 0; i < 3; i++) { // water stains
      const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 50;
      const rg = g.createRadialGradient(x, y, r * 0.3, x, y, r);
      rg.addColorStop(0, 'rgba(60,45,30,.22)'); rg.addColorStop(1, 'rgba(60,45,30,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    noise(g, w, h, 600, 0.09);
  });
  const gameWallTex = cv(256, 256, (g, w, h) => { // pool-hall diamond paper
    g.fillStyle = '#233028'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const cx = x * 32 + 16 + (y % 2) * 16, cy = y * 32 + 16;
      g.strokeStyle = 'rgba(180,150,80,.3)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(cx % w, cy - 11); g.lineTo((cx % w) + 8, cy); g.lineTo(cx % w, cy + 11); g.lineTo((cx % w) - 8, cy); g.closePath(); g.stroke();
      if ((x + y) % 3 === 0) { g.fillStyle = 'rgba(140,50,50,.4)'; g.beginPath(); g.arc(cx % w, cy, 2.5, 0, 7); g.fill(); }
    }
    noise(g, w, h, 500, 0.1);
  });
  const carpetTex = cv(256, 256, (g, w, h) => { // loud casino carpet. it has seen things.
    g.fillStyle = '#2c1e34'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * 64 + 32, cy = y * 64 + 32;
      g.strokeStyle = (x + y) % 2 ? 'rgba(190,140,60,.5)' : 'rgba(80,150,140,.45)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, 18, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(cx - 26, cy); g.lineTo(cx, cy - 26); g.lineTo(cx + 26, cy); g.lineTo(cx, cy + 26); g.closePath(); g.stroke();
    }
    noise(g, w, h, 1200, 0.12);
  });
  const obsWallTex = cv(256, 256, (g, w, h) => { // midnight plaster with tiny stars
    g.fillStyle = '#1b1f33'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 900, 0.08);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(200,215,255,${0.2 + rnd() * 0.6})`;
      g.fillRect(rnd() * w, rnd() * h, rnd() < 0.15 ? 2.4 : 1.3, rnd() < 0.15 ? 2.4 : 1.3);
    }
    g.strokeStyle = 'rgba(170,180,220,.25)'; g.lineWidth = 1.4; // a constellation nobody asked for
    const pts = [[40, 60], [80, 40], [120, 70], [150, 50], [190, 90]];
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  });
  const bookTex = cv(256, 128, (g, w, h) => { // shelf of spines
    g.fillStyle = '#241708'; g.fillRect(0, 0, w, h);
    let x = 2;
    const cols = ['#5a2f22', '#2f4a3a', '#3a3358', '#6a5220', '#4a2438', '#33220f', '#264a52'];
    while (x < w - 8) {
      const bw = 9 + rnd() * 14, bh = h - 8 - rnd() * 22;
      g.fillStyle = cols[(rnd() * cols.length) | 0];
      g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = 'rgba(220,190,120,.5)';
      g.fillRect(x + 2, h - bh + 6, bw - 4, 2);
      g.fillRect(x + 2, h - bh + 12, bw - 4, 1.4);
      if (rnd() < 0.12) { g.save(); g.translate(x + bw / 2, h - bh - 3); g.rotate(-0.35); g.fillStyle = '#7a6a4a'; g.fillRect(-bw / 2, 0, bw, 5); g.restore(); } // one leaning on top
      x += bw + 2;
    }
    noise(g, w, h, 200, 0.1);
  });
  const atticTex = plankTex(96, 78, 52);

  // procedural normal maps: Sobel over each texture's own luminance, so plank grain
  // and tile grout actually catch the roaming light. Cached per source texture;
  // clones share the GPU upload via texture.source.
  const normalCache = new Map();
  function normalFor(srcTex, strength = 1.3) {
    if (normalCache.has(srcTex.uuid)) return normalCache.get(srcTex.uuid);
    const img = srcTex.image;
    const w = img.width, h = img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h);
    const hgt = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) hgt[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
    const at = (x, y) => hgt[((y + h) % h) * w + ((x + w) % w)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const o = (y * w + x) * 4;
      out.data[o] = (-dx * inv * 0.5 + 0.5) * 255;
      out.data[o + 1] = (dy * inv * 0.5 + 0.5) * 255;
      out.data[o + 2] = inv * 255;
      out.data[o + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    normalCache.set(srcTex.uuid, t);
    return t;
  }
  // procedural roughness maps: wear follows each texture's own luminance (bright, walked-on
  // wood goes shiny; grime pools stay matte) plus a few big scuffed/dusty blotches.
  // Cached per source like the normal maps; the GREEN channel is what three reads.
  const roughCache = new Map();
  function roughFor(srcTex) {
    if (roughCache.has(srcTex.uuid)) return roughCache.get(srcTex.uuid);
    const img = srcTex.image;
    const w = img.width, h = img.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < w * h; i++) {
      const lum = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
      const r = Math.max(0, Math.min(255, (0.62 + (1 - lum) * 0.38) * 255)) | 0;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = r; d[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    for (let i = 0; i < 7; i++) { // large-scale wear: shiny worn paths + matte dust pools
      const x = rnd() * w, y = rnd() * h, rr = w * (0.12 + rnd() * 0.22), shiny = rnd() < 0.55;
      const rg = g.createRadialGradient(x, y, rr * 0.15, x, y, rr);
      rg.addColorStop(0, shiny ? 'rgba(48,48,48,.38)' : 'rgba(232,232,232,.3)');
      rg.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    roughCache.set(srcTex.uuid, t);
    return t;
  }
  function mat(map, rough = 0.9, rep = [1, 1], color = 0xffffff) {
    const m = map.clone(); m.needsUpdate = true; m.repeat.set(rep[0], rep[1]);
    const n = normalFor(map).clone(); n.needsUpdate = true; n.repeat.set(rep[0], rep[1]);
    const r = roughFor(map).clone(); r.needsUpdate = true; r.repeat.set(rep[0], rep[1]);
    return new THREE.MeshStandardMaterial({ map: m, roughness: rough, metalness: 0.02, color,
      normalMap: n, normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: r });
  }

  // ---------- floors / ceilings ----------
  function floorRect(x0, z0, x1, z1, tex, perM, color = 0xffffff, rough = 0.9, y = 0) {
    const w = x1 - x0, d = z1 - z0;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(tex, rough, [w * perM, d * perM], color));
    f.rotation.x = -Math.PI / 2; f.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    f.receiveShadow = true; scene.add(f);
    return f;
  }
  function ceilRect(x0, z0, x1, z1, tex, perM, color = 0x8a8a8a, basic = false, y = H) {
    const w = x1 - x0, d = z1 - z0;
    const m = basic
      ? new THREE.MeshBasicMaterial({ map: (() => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w * perM, d * perM); return t; })() })
      : mat(tex, 0.95, [w * perM, d * perM], color);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    c.rotation.x = Math.PI / 2; c.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    c.receiveShadow = !basic; scene.add(c);
  }
  // walkable upper floor: visible surface + a collider slab you can stand on (base keeps it
  // out of the way of whoever is on the floor below)
  function slab(x0, z0, x1, z1, y) {
    addCollider((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y, y - 0.5);
  }

  // ---------- walls ----------
  // style: {up, upPerM, upColor, low, lowPerM, lowH, lowColor, rail, base}
  const S = {
    den:     { up: plasterTex, upPerM: 0.31, low: darkWoodTex, lowPerM: 0.7, lowH: 1.05, rail: 0x2a1c0e, base: 0x1c130a },
    hall:    { up: damaskTex, upPerM: 0.5, low: darkWoodTex, lowPerM: 0.7, lowH: 0.95, rail: 0x6a5220, base: 0x1c130a },
    nursery: { up: nurseryTex, upPerM: 0.55, low: null, base: 0xd8d2c4 },
    kitchen: { up: plasterTex, upPerM: 0.31, upColor: 0xb8b4a4, low: tileWallTex, lowPerM: 0.8, lowH: 1.4, rail: 0x3a3a34, base: 0x2a2a24 },
    bath:    { up: plasterTex, upPerM: 0.31, upColor: 0xa8b8a0, low: bathTileTex, lowPerM: 0.9, lowH: 1.8, rail: 0x2c3a30, base: 0x222c24 },
    crypt:   { up: stoneWallTex, upPerM: 0.55, low: null },
    yard:    { up: hedgeTex, upPerM: 0.55, low: null },
    base:    { up: concreteTex, upPerM: 0.45, low: null, base: 0x3a3630 },
    landing: { up: damaskTex, upPerM: 0.5, upColor: 0x8f9ac8, low: darkWoodTex, lowPerM: 0.7, lowH: 0.95, rail: 0x6a5220, base: 0x1c130a },
    master:  { up: floralTex, upPerM: 0.5, low: darkWoodTex, lowPerM: 0.7, lowH: 0.8, rail: 0x4a3a22, base: 0x241708 },
    library: { up: darkWoodTex, upPerM: 0.8, low: null, base: 0x140c04 },
    trophy:  { up: plasterTex, upPerM: 0.31, upColor: 0xa89878, low: darkWoodTex, lowPerM: 0.7, lowH: 1.2, rail: 0x2a1c0e, base: 0x1c130a },
    game:    { up: gameWallTex, upPerM: 0.5, low: darkWoodTex, lowPerM: 0.7, lowH: 0.9, rail: 0x2a1c0e, base: 0x14100a },
    obs:     { up: obsWallTex, upPerM: 0.4, low: null, base: 0x101020 },
    attic:   { up: atticTex, upPerM: 0.35, upColor: 0x9a8a72, low: null, base: 0x241708 },
  };
  const FACE = { '+z': [0, 0, 0.06], '-z': [Math.PI, 0, -0.06], '+x': [Math.PI / 2, 0.06, 0], '-x': [-Math.PI / 2, -0.06, 0] };
  const frameM = std(0x241708, { roughness: 0.75 });

  // fake AO: one shared gradient (dark at v=1), two jobs — a contact-shadow strip lying on
  // the floor along every wall base, and a soft corner line where walls meet ceilings.
  // Same recipe as the prop blob shadows: transparent, no depth write, renderOrder 1.
  const aoTex = cv(16, 64, (g2, w2, h2) => {
    const lg = g2.createLinearGradient(0, 0, 0, h2);
    lg.addColorStop(0, 'rgba(0,0,0,.42)'); lg.addColorStop(0.55, 'rgba(0,0,0,.13)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = lg; g2.fillRect(0, 0, w2, h2);
  });
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false });
  const aoGeo = new THREE.PlaneGeometry(1, 1);

  // hero shadow lights (den fireplace, stairwell chandelier) register here so potato
  // mode can strip their shadow maps at runtime without touching the light itself
  const heroLights = [];
  const heroShadow = l => {
    l.castShadow = true;
    l.shadow.mapSize.set(512, 512);
    l.shadow.bias = -0.004; l.shadow.normalBias = 0.02; l.shadow.camera.near = 0.05;
    heroLights.push(l);
    return l;
  };

  // geometry dignity: the most-stared-at props trade razor box edges for a soft chamfer
  const rbox = (w2, h2, d2, r = 0.035) =>
    new RoundedBoxGeometry(w2, h2, d2, 3, Math.min(r, w2 * 0.45, h2 * 0.45, d2 * 0.45));
  // crown molding: a rounded strip snug under the ceiling in the rooms with pretensions
  const crownM = std(0x3a2a18, { roughness: 0.7 });
  function crownRun(ax, az, bx, bz, lift = 0) {
    const alongX = az === bz;
    const len = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
    if (len < 0.3) return;
    const m = new THREE.Mesh(rbox(alongX ? len : 0.14, 0.1, alongX ? 0.14 : len, 0.03), crownM);
    m.position.set((ax + bx) / 2, lift + H - 0.08, (az + bz) / 2);
    m.receiveShadow = true;
    scene.add(m);
  }

  function facePiece(style, w, y0, y1, px, pz, ry, lift = 0) {
    const g = new THREE.Group();
    const lowH = style.low ? style.lowH : 0;
    if (style.low && y0 < lowH) {
      const lo = new THREE.Mesh(new THREE.PlaneGeometry(w, lowH - y0),
        mat(style.low, 0.85, [w * style.lowPerM, 1], style.lowColor || 0xffffff));
      lo.position.y = (y0 + lowH) / 2; g.add(lo);
      if (style.rail != null) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.05), std(style.rail, { roughness: 0.7 }));
        rail.position.set(0, lowH, 0.02); g.add(rail);
      }
    }
    const uy0 = Math.max(y0, lowH);
    const up = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - uy0),
      mat(style.up, 0.95, [w * style.upPerM, (y1 - uy0) / H * 2.2], style.upColor || 0xffffff));
    up.position.y = (uy0 + y1) / 2; g.add(up);
    if (style.base != null && y0 === 0) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.04), std(style.base, { roughness: 0.8 }));
      b.position.set(0, 0.07, 0.02); g.add(b);
    }
    g.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
    // AO skirts go in AFTER the shadow traverse: they must never cast or receive
    if (y0 === 0) { // floor-contact shadow, dark edge against the wall
      const sk = new THREE.Mesh(aoGeo, aoMat);
      sk.rotation.x = -Math.PI / 2;
      sk.scale.set(w, 0.55, 1);
      sk.position.set(0, 0.012, 0.275);
      sk.renderOrder = 1;
      g.add(sk);
    }
    if (y1 >= H) { // ceiling-corner shade, dark edge up top
      const cs = new THREE.Mesh(aoGeo, aoMat);
      cs.scale.set(w, 0.42, 1);
      cs.position.set(0, H - 0.21, 0.012);
      cs.renderOrder = 1;
      g.add(cs);
    }
    g.position.set(px, lift, pz); g.rotation.y = ry;
    scene.add(g);
  }

  // a=[x,z] to b=[x,z] axis-aligned. doors: [lo,hi] in run-axis coords. collide once per boundary.
  // lift raises the whole wall to an upper story (colliders keep the floor below clear).
  function wallRun(style, a, b, face, doors = [], collide = false, lift = 0) {
    const alongX = a[1] === b[1];
    const [ry, ox, oz] = FACE[face];
    const lo = Math.min(alongX ? a[0] : a[1], alongX ? b[0] : b[1]);
    const hi = Math.max(alongX ? a[0] : a[1], alongX ? b[0] : b[1]);
    const fixed = alongX ? a[1] : a[0];
    const ds = [...doors].sort((p, q) => p[0] - q[0]);
    let cur = lo;
    const spans = [];
    ds.forEach(d => { if (d[0] > cur) spans.push([cur, d[0]]); cur = d[1]; });
    if (cur < hi) spans.push([cur, hi]);
    spans.forEach(([s0, s1]) => {
      const w = s1 - s0; if (w < 0.02) return;
      const c = (s0 + s1) / 2;
      const px = alongX ? c : fixed + ox, pz = alongX ? fixed + oz : c;
      facePiece(style, w, 0, H, px, pz, ry, lift);
      if (collide) alongX ? addCollider(c, fixed, w, 0.36, lift + H, lift) : addCollider(fixed, c, 0.36, w, lift + H, lift);
    });
    ds.forEach(d => { // lintel above each door
      const w = d[1] - d[0], c = (d[0] + d[1]) / 2;
      const px = alongX ? c : fixed + ox, pz = alongX ? fixed + oz : c;
      facePiece(style, w, 2.15, H, px, pz, ry, lift);
      if (collide) { // door frame, once per boundary
        [d[0], d[1]].forEach(edge => {
          const j = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.1 : 0.16, 2.18, alongX ? 0.16 : 0.1), frameM);
          j.position.set(alongX ? edge : fixed, lift + 1.09, alongX ? fixed : edge);
          j.castShadow = j.receiveShadow = true; scene.add(j);
        });
        const hd = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w + 0.2 : 0.16, 0.12, alongX ? 0.16 : w + 0.2), frameM);
        hd.position.set(alongX ? c : fixed, lift + 2.21, alongX ? fixed : c);
        hd.castShadow = hd.receiveShadow = true; scene.add(hd);
      }
    });
  }

  // ---------- floor plan ----------
  // DEN x[-7,7] z[-5,5] | HALL x[-13,10] z[-9,-5] | NURSERY x[-13,-3] KITCHEN x[-3,5] BATH x[5,10] all z[-17,-9]
  // CRYPT x[7,16] z[-5,5] | YARD x[-7,3] BASEMENT x[3,12] both z[5,14]
  floorRect(-7, -5, 7, 5, denFloorTex, 0.25);
  floorRect(-13, -9, 10, -5, hallFloorTex, 0.3);
  floorRect(-13, -17, -3, -9, paleFloorTex, 0.25);
  floorRect(-3, -17, 5, -9, checkerTex, 0.55);
  floorRect(5, -17, 10, -9, bathTileTex, 0.7);
  floorRect(7, -5, 16, 5, stoneFloorTex, 0.45);
  floorRect(-7, 5, 3, 14, grassTex, 0.5);
  floorRect(3, 5, 12, 14, dirtTex, 0.45);
  ceilRect(-7, -5, 7, 5, darkWoodTex, 0.5);
  // hall ceiling leaves the grand stairwell open (x -12.9..-8.5, z -6.7..-5)
  ceilRect(-13, -9, 10, -6.7, plasterTex, 0.2, 0x5a5248);
  ceilRect(-8.5, -6.7, 10, -5, plasterTex, 0.2, 0x5a5248);
  ceilRect(-13, -6.7, -12.9, -5, plasterTex, 0.2, 0x5a5248);
  ceilRect(-13, -17, -3, -9, plasterTex, 0.2, 0xb8a0a8);
  ceilRect(-3, -17, 5, -9, plasterTex, 0.25, 0x9a9a90);
  ceilRect(5, -17, 10, -9, plasterTex, 0.25, 0x8a9a88);
  ceilRect(7, -5, 16, 5, stoneWallTex, 0.3, 0x707078);
  ceilRect(-7, 5, 3, 14, skyTex, 0.11, 0xffffff, true); // fake night sky
  ceilRect(3, 5, 12, 14, concreteTex, 0.3, 0x6a6660);

  const D = { // doors
    hallDen: [-1, 1], hallNur: [-9, -7.4], hallKit: [0.2, 1.8], hallBath: [6.4, 8],
    hallCrypt: [8, 9.5], denCrypt: [-1, 1], denYard: [-3, -1.4], denBase: [4, 5.6],
    yardBase: [8.5, 10.1], cryptBase: [9, 10.6],
  };
  // z = -17 exterior
  wallRun(S.nursery, [-13, -17], [-3, -17], '+z', [], true);
  wallRun(S.kitchen, [-3, -17], [5, -17], '+z', [], true);
  wallRun(S.bath, [5, -17], [10, -17], '+z', [], true);
  // z = -9 hall north
  wallRun(S.nursery, [-13, -9], [-3, -9], '-z', [D.hallNur]);
  wallRun(S.kitchen, [-3, -9], [5, -9], '-z', [D.hallKit]);
  wallRun(S.bath, [5, -9], [10, -9], '-z', [D.hallBath]);
  wallRun(S.hall, [-13, -9], [10, -9], '+z', [D.hallNur, D.hallKit, D.hallBath], true);
  // z = -5
  wallRun(S.hall, [-13, -5], [-7, -5], '-z', [], true);
  wallRun(S.hall, [-7, -5], [7, -5], '-z', [D.hallDen]);
  wallRun(S.den, [-7, -5], [7, -5], '+z', [D.hallDen], true);
  wallRun(S.hall, [7, -5], [10, -5], '-z', [D.hallCrypt]);
  wallRun(S.crypt, [7, -5], [10, -5], '+z', [D.hallCrypt], true);
  wallRun(S.crypt, [10, -5], [16, -5], '+z', [], true);
  // z = 5
  wallRun(S.den, [-7, 5], [3, 5], '-z', [D.denYard]);
  wallRun(S.yard, [-7, 5], [3, 5], '+z', [D.denYard], true);
  wallRun(S.den, [3, 5], [7, 5], '-z', [D.denBase]);
  wallRun(S.base, [3, 5], [7, 5], '+z', [D.denBase], true);
  wallRun(S.crypt, [7, 5], [12, 5], '-z', [D.cryptBase]);
  wallRun(S.base, [7, 5], [12, 5], '+z', [D.cryptBase], true);
  wallRun(S.crypt, [12, 5], [16, 5], '-z', [], true);
  // z = 14 exterior
  wallRun(S.yard, [-7, 14], [3, 14], '-z', [], true);
  wallRun(S.base, [3, 14], [12, 14], '-z', [], true);
  // x walls
  wallRun(S.nursery, [-13, -17], [-13, -9], '+x', [], true);
  wallRun(S.hall, [-13, -9], [-13, -5], '+x', [], true);
  wallRun(S.den, [-7, -5], [-7, 5], '+x', [[-2.2, -1.0]], true); // hidden gap behind the bookshelf
  wallRun(S.yard, [-7, 5], [-7, 14], '+x', [], true);
  wallRun(S.nursery, [-3, -17], [-3, -9], '-x', [], true);
  wallRun(S.kitchen, [-3, -17], [-3, -9], '+x');
  wallRun(S.kitchen, [5, -17], [5, -9], '-x', [], true);
  wallRun(S.bath, [5, -17], [5, -9], '+x');
  wallRun(S.bath, [10, -17], [10, -9], '-x', [], true);
  wallRun(S.hall, [10, -9], [10, -5], '-x', [], true);
  wallRun(S.den, [7, -5], [7, 5], '-x', [D.denCrypt], true);
  wallRun(S.crypt, [7, -5], [7, 5], '+x', [D.denCrypt]);
  wallRun(S.crypt, [16, -5], [16, 5], '-x', [], true);
  wallRun(S.yard, [3, 5], [3, 14], '-x', [D.yardBase], true);
  wallRun(S.base, [3, 5], [3, 14], '+x', [D.yardBase]);
  wallRun(S.base, [12, 5], [12, 14], '-x', [], true);

  // ---------- shared prop helpers ----------
  const crateM = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.9 });
  function crate(x, z, s, ry, y = null) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateM);
    c.position.set(x, y == null ? s / 2 : y, z); c.rotation.y = ry;
    c.castShadow = c.receiveShadow = true; scene.add(c);
    addCollider(x, z, s + 0.1, s + 0.1, y == null ? s : y + s / 2);
    return c;
  }
  function vent(x, z, ry = 0) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.035, 0.4), std(0x3c4044, { roughness: 0.5, metalness: 0.6 }));
    p.position.set(x, 0.018, z); p.rotation.y = ry; p.receiveShadow = true; scene.add(p);
    for (let i = -1; i <= 1; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.05), std(0x14161a));
      s.position.set(x, 0.02, z + i * 0.1); s.rotation.y = ry; scene.add(s);
    }
  }
  function bulbFixture(x, y, z) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, H - y, 6), std(0x111111));
    cord.position.set(x, (H + y) / 2, z); scene.add(cord);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    glow.position.set(x, y, z); scene.add(glow);
    return glow;
  }

  // ================= THE DEN =================
  const beamMat = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.9, color: 0x9a9a9a });
  for (let i = -2; i <= 2; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 10), beamMat);
    beam.position.set(i * 3.0, H - 0.12, 0);
    beam.castShadow = beam.receiveShadow = true; scene.add(beam);
  }
  crate(-5.6, -3.4, 1.1, 0.12); crate(-4.4, -3.7, 0.9, -0.3);
  crate(-5.5, -3.3, 0.7, 0.5, 1.45);
  crate(5.7, 3.2, 1.0, -0.15);
  const duckA = buildDuck(1); duckA.group.position.set(-5.5, 1.8, -3.3); scene.add(duckA.group);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), mat(rugTex, 1.0, [1, 1]));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0.6, 0.006, 0.4); rug.receiveShadow = true; scene.add(rug);
  {
    const woodM = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.75, color: 0xcfae86 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 28), woodM);
    top.position.set(0.6, 0.78, 0.4); top.receiveShadow = true; scene.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.78, 12), woodM);
    leg.position.set(0.6, 0.39, 0.4); leg.castShadow = true; scene.add(leg);
    addCollider(0.6, 0.4, 1.5, 1.5, 0.86);
    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 24, 1, false, 0, Math.PI * 1.7),
      std(0xe8c93f, { roughness: 0.6 }));
    cheese.position.set(0.55, 0.91, 0.35); cheese.castShadow = true; scene.add(cheese);
  }
  // moon window, west wall: built later by moonWindow() with the upstairs ones —
  // the ground floor joins the parallax club (call site sits after darkM exists)
  // swinging lamp (the den key light fixture)
  const lamp = new THREE.Group(); lamp.position.set(-0.7, H, -1.0);
  {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 6), std(0x111111));
    cord.position.y = -0.425; lamp.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 20, 1, true),
      std(0x37483a, { roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }));
    shade.position.y = -0.86; lamp.add(shade);
  }
  const denBulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  denBulb.position.y = -0.95; lamp.add(denBulb);
  scene.add(lamp);
  tickers.push(t => { lamp.rotation.z = Math.sin(t * 0.9) * 0.08; lamp.rotation.x = Math.sin(t * 0.63 + 1.7) * 0.05; });
  // emergency meeting button (for the future sneaky-bastard mode)
  {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.9, 14), std(0x5a5f66, { roughness: 0.4, metalness: 0.6 }));
    ped.position.set(-5.6, 0.45, 3.6); ped.castShadow = ped.receiveShadow = true; scene.add(ped);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      std(0xd42222, { roughness: 0.3, emissive: 0x550000, emissiveIntensity: 0.7 }));
    dome.position.set(-5.6, 0.9, 3.6); dome.castShadow = true; scene.add(dome);
    addCollider(-5.6, 3.6, 0.6, 0.6, 1.0);
    const sg = signPlane(['EMERGENCY', 'GIGGLE MEETING'], 0.85, 0.42, { fs: 20 });
    sg.position.set(-5.6, 1.9, 4.9); sg.rotation.y = Math.PI; scene.add(sg);
  }
  const zoomy = buildZoomy();
  zoomy.group.position.set(2.3, 0, -1.6); scene.add(zoomy.group);
  addCollider(2.3, -1.6, 1.0, 1.0, 1.45); // yes, you can stand on zoomy. he allows it.
  tickers.push((t, dt, p) => zoomy.tick(t, dt, p));
  const zfill = new THREE.PointLight(0x5ce8ff, 3, 7, 2); zfill.position.set(3.6, 1.7, -3.0); scene.add(zfill);
  speakers.push({ name: 'ZOOMY', x: 2.3, z: -1.6, y: 1.95, radius: 3.2, lines: [
    'oh great. it walks.', 'welcome to the third dimension, sweaty.', 'do NOT touch the cheese.',
    'do not go in the nursery. i mean it.', 'the gnomes came with the house. we do not discuss them.',
    'yes, the yard is indoors. rent is weird here.', 'the monster? downstairs. on break. do NOT clock him in.',
    'you look rendered. barely.',
  ] });

  // ================= HALL OF PORTRAITS =================
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(21.5, 1.8), mat(runnerTex, 1.0, [6, 1]));
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(-1.5, 0.008, -7); runner.receiveShadow = true; scene.add(runner);
  const PNAMES = ['GREAT UNCLE SLURP', 'GAMMY ZOOM', 'BABY GERALD, 47', 'THE TWINS (1 MISSING)', 'COLONEL GIGGLES',
    'AUNT VOID', '??? ??? ???', 'THE LANDLORD', 'COUSIN TRENCH', 'MEEMAW DOOM', 'DO NOT FEED'];
  const SKINS = ['#9fbf8a', '#8a9fbf', '#bf9a8a', '#b08ab8', '#c2b26a', '#7fae9e'];
  const portraits = [];
  function portrait(x, z, ry, i) {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.14, 0.05), std(0x8a6a2a, { roughness: 0.45, metalness: 0.5 }));
    g.add(frame);
    const face = canvasPlane(0.74, 0.98, 128, 170, (c, w, h) => {
      c.fillStyle = '#1c1410'; c.fillRect(0, 0, w, h);
      c.fillStyle = SKINS[i % SKINS.length];
      c.beginPath(); c.ellipse(w / 2, h * 0.44, 34, 44, 0, 0, 7); c.fill();
      c.fillStyle = '#f2eee0'; // empty eyes; the pupils are 3D and they follow you
      c.beginPath(); c.ellipse(w / 2 - 14, h * 0.4, 10, 12, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(w / 2 + 14, h * 0.4, 10, 12, 0, 0, 7); c.fill();
      c.strokeStyle = '#20140c'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(w / 2 - 12, h * 0.62); c.lineTo(w / 2 + 12, h * 0.62 + (i % 3 - 1) * 6); c.stroke();
      if (i % 4 === 0) { c.fillStyle = '#2a1a10'; c.fillRect(w / 2 - 18, h * 0.52, 36, 6); } // mustache
      if (i % 4 === 1) { c.strokeStyle = '#d8c060'; c.lineWidth = 2; c.beginPath(); c.arc(w / 2 + 14, h * 0.4, 14, 0, 7); c.stroke(); }
      if (i % 4 === 2) { c.fillStyle = '#222'; c.fillRect(w / 2 - 26, h * 0.12, 52, 12); c.fillRect(w / 2 - 16, h * 0.02, 32, 12); } // hat
      if (i % 4 === 3) { c.fillStyle = '#f2eee0'; c.beginPath(); c.ellipse(w / 2, h * 0.26, 7, 9, 0, 0, 7); c.fill(); } // third eye
    });
    face.position.z = 0.03; g.add(face);
    const pupils = [];
    [-0.083, 0.083].forEach(ex => {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.024, 10), std(0x0c0c0e, { roughness: 0.2 }));
      p.position.set(ex, 0.045, 0.035); g.add(p); pupils.push({ m: p, ex, ey: 0.045 });
    });
    if (i % 4 === 3) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), std(0x0c0c0e)); p.position.set(0, 0.21, 0.035); g.add(p); pupils.push({ m: p, ex: 0, ey: 0.21 }); }
    const plaque = signPlane([PNAMES[i % PNAMES.length]], 0.62, 0.14, { fs: 13, bg: '#c9a24a', fg: '#241708', pw: 256, ph: 48 });
    plaque.position.y = -0.68; g.add(plaque);
    g.position.set(x, 1.75, z); g.rotation.y = ry;
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    scene.add(g); portraits.push({ g, pupils });
  }
  [[-11.4, -8.9, 0], [-5.8, -8.9, 0], [-3.6, -8.9, 0], [3.2, -8.9, 0], [5.2, -8.9, 0], [9.1, -8.9, 0],
   [-12, -5.1, Math.PI], [-9.8, -5.1, Math.PI], [-4, -5.1, Math.PI], [2.6, -5.1, Math.PI], [4.6, -5.1, Math.PI]]
    .forEach(([x, z, ry], i) => portrait(x, z, ry, i));
  tickers.push((t, dt, p) => {
    portraits.forEach(pt => {
      V.set(p.x, 1.58, p.z); pt.g.worldToLocal(V);
      if (V.z < 0.1) return;
      const ox = THREE.MathUtils.clamp(V.x * 0.02, -0.033, 0.033);
      const oy = THREE.MathUtils.clamp(V.y * 0.02, -0.028, 0.028);
      pt.pupils.forEach(pp => pp.m.position.set(pp.ex + ox, pp.ey + oy, 0.035));
    });
  });
  // sconces
  const flames = [];
  [[-7.2, -8.86, 0], [2.6, -8.86, 0], [-11, -5.14, Math.PI], [6, -5.14, Math.PI]].forEach(([x, z, ry], i) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.05), frameM);
    plate.position.set(x, 2.0, z); plate.rotation.y = ry; scene.add(plate);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 8), std(0xe8e0c8, { roughness: 0.6 }));
    candle.position.set(x, 2.12, z + (ry ? -0.07 : 0.07)); scene.add(candle);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc36a }));
    fl.position.set(x, 2.26, z + (ry ? -0.07 : 0.07)); scene.add(fl); flames.push(fl);
    if (i < 2) { const pl = new THREE.PointLight(0xff9a55, 3.5, 5.5, 2); pl.position.set(x, 2.3, z + (ry ? -0.3 : 0.3)); scene.add(pl); }
  });
  tickers.push(t => flames.forEach((f, i) => { const s = 0.85 + 0.3 * Math.abs(Math.sin(t * 7 + i * 2)); f.scale.set(s, s, s); }));
  // fake management door, east end
  {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 1.0), frameM);
    door.position.set(9.9, 1.05, -7); door.castShadow = false; door.receiveShadow = true; scene.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), std(0xb89a4a, { metalness: 0.7, roughness: 0.3 }));
    knob.position.set(9.85, 1.0, -6.7); scene.add(knob);
    const sg = signPlane(['MANAGEMENT ONLY', '(do not giggle', 'at the management)'], 0.8, 0.5, { fs: 15, pw: 256, ph: 160 });
    sg.position.set(9.86, 2.4, -7); sg.rotation.y = -Math.PI / 2; scene.add(sg);
  }
  speakers.push({ name: 'THE PORTRAITS', x: -4.5, z: -7, y: 2.5, radius: 3.0, lines: [
    'we saw you trip once. we still laugh about it.',
    'great uncle slurp says hi. do not say hi back.',
    'walk slower. we are painting you.',
  ] });

  // ================= NURSERY =================
  const cribG = new THREE.Group(); cribG.position.set(-10.8, 0, -13.5);
  {
    const white = std(0xdfd8ce, { roughness: 0.8 });
    [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]].forEach(([x, z]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8), white);
      post.position.set(x, 0.43, z); cribG.add(post);
    });
    [-0.35, 0.35].forEach(z => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.05), white);
      rail.position.set(0, 0.82, z); cribG.add(rail);
      for (let i = -4; i <= 4; i++) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.55, 6), white);
        bar.position.set(i * 0.13, 0.53, z); cribG.add(bar);
      }
    });
    [-0.6, 0.6].forEach(x => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.72), white);
      board.position.set(x, 0.55, 0); cribG.add(board);
    });
    const matr = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.1, 0.64), std(0xc8bfae));
    matr.position.y = 0.3; cribG.add(matr);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.4), std(0xe4dccc));
    pillow.position.set(-0.38, 0.38, 0); cribG.add(pillow);
    [-0.35, 0.35].forEach(z => {
      const rocker = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 12, Math.PI * 0.8), white);
      rocker.position.set(0, 0.52, z); rocker.rotation.z = Math.PI + Math.PI * 0.1; cribG.add(rocker);
    });
    shadowAll(cribG); scene.add(cribG);
    addCollider(-10.8, -13.5, 1.5, 1.0, 0.88);
  }
  let cribAmp = 0.09;
  tickers.push((t, dt, p) => {
    const near = Math.hypot(p.x + 10.8, p.z + 13.5) < 3.5;
    cribAmp += ((near ? 0 : 0.09) - cribAmp) * Math.min(1, dt * (near ? 12 : 0.5)); // stops when watched
    cribG.rotation.z = Math.sin(t * 1.5) * cribAmp;
  });
  const mobile = new THREE.Group(); mobile.position.set(-10.8, 2.35, -13.5);
  {
    const stick1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.02), std(0x8a7a5a));
    const stick2 = stick1.clone(); stick2.rotation.y = Math.PI / 2;
    mobile.add(stick1, stick2);
    [[0.36, 0], [-0.36, 0], [0, 0.36], [0, -0.36]].forEach(([x, z], i) => {
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4), std(0xaaaaaa));
      str.position.set(x, -0.15, z); mobile.add(str);
      const shape = i === 0
        ? buildDuck(0.45).group
        : new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(i % 2 ? 0xe8d548 : 0xcfe0ff, { emissive: 0x333322, emissiveIntensity: 0.4 }));
      shape.position.set(x, -0.34, z); mobile.add(shape);
    });
    scene.add(mobile);
  }
  tickers.push((t, dt) => { mobile.rotation.y += dt * 0.45; });
  const teddy = buildTeddy();
  teddy.group.position.set(-3.75, 0, -13.4); teddy.group.rotation.y = -Math.PI / 2 - 0.3;
  scene.add(teddy.group); addCollider(-3.75, -13.4, 0.8, 0.8, 1.0);
  tickers.push(t => teddy.tick(t));
  'RUN'.split('').forEach((ch, i) => {
    const t = cv(64, 64, (g) => {
      g.fillStyle = ['#c9705a', '#7aa860', '#6a88c0'][i]; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = '#332211'; g.lineWidth = 4; g.strokeRect(3, 3, 58, 58);
      g.fillStyle = '#2a1a0c'; g.font = 'bold 40px Courier New'; g.textAlign = 'center'; g.fillText(ch, 32, 46);
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
    b.position.set(-8.9 + i * 0.34, 0.12, -10.5 + (i % 2) * 0.14); b.rotation.y = (i - 1) * 0.35;
    b.castShadow = b.receiveShadow = true; scene.add(b);
  });
  { // giant baby bottle
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 14),
      new THREE.MeshStandardMaterial({ color: 0xd8e2e4, transparent: true, opacity: 0.7, roughness: 0.3 }));
    bot.position.set(-12.35, 0.32, -15.9); bot.rotation.z = 0.22; scene.add(bot);
    const nip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 12), std(0xc09a5a));
    nip.position.set(-12.5, 0.68, -15.9); nip.rotation.z = 0.22; scene.add(nip);
    addCollider(-12.35, -15.9, 0.5, 0.5, 0.75);
  }
  const nl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 10),
    new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  nl.position.set(-3.12, 0.42, -11.8); scene.add(nl);
  speakers.push({ name: 'TEDDY', x: -3.75, z: -13.4, y: 1.35, radius: 2.8, lines: [
    'hug me. forever.', 'the crib stops when you watch. we all do.',
    'i lost this eye in the war. do not ask which war.',
  ] });

  // ================= MEAT KITCHEN =================
  const fluoro = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a8, emissive: 0xeef2ff, emissiveIntensity: 1 }));
  fluoro.position.set(1, H - 0.06, -13); scene.add(fluoro);
  { // fridge: hollow, door ajar, and yes you can hide inside it
    const fm = std(0xc4cac4, { roughness: 0.35, metalness: 0.15 });
    const fmDark = std(0x6a706a, { roughness: 0.6 });
    const mk = (w, h2, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h2, d), fm);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
    };
    mk(1.0, 2.0, 0.08, -2.3, 1.0, -16.86);          // back
    mk(0.08, 2.0, 0.86, -2.78, 1.0, -16.45);        // left
    mk(0.08, 2.0, 0.86, -1.82, 1.0, -16.45);        // right
    mk(1.0, 0.08, 0.9, -2.3, 1.98, -16.45);         // top
    mk(1.0, 0.05, 0.9, -2.3, 0.03, -16.45);         // base
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.9, 0.02), fmDark);
    inner.position.set(-2.3, 1.0, -16.83); scene.add(inner);
    const door = new THREE.Group(); door.position.set(-2.78, 1.0, -16.02); door.rotation.y = -0.62;
    const panel = new THREE.Mesh(rbox(0.96, 1.96, 0.07, 0.03), fm);
    panel.position.x = 0.48; panel.castShadow = true; door.add(panel);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), std(0x8a8f8a, { metalness: 0.6 }));
    hd.position.set(0.88, 0.25, 0.06); door.add(hd);
    const magnets = canvasPlane(0.8, 0.7, 128, 112, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = 'bold 26px Courier New'; c.textAlign = 'center';
      'FEED ME'.split('').forEach((ch, i) => {
        if (ch === ' ') return;
        c.fillStyle = ['#d84040', '#4070d8', '#38a048', '#d8a030', '#9040c8', '#d84090'][i % 6];
        c.save(); c.translate(20 + i * 15, 48 + (i % 3 - 1) * 9); c.rotate((i % 3 - 1) * 0.2); c.fillText(ch, 0, 0); c.restore();
      });
    }, { basic: true, transparent: true });
    magnets.position.set(0.48, 0.25, 0.045); door.add(magnets);
    scene.add(door);
    addCollider(-2.3, -16.86, 1.1, 0.2, 2.0);   // back
    addCollider(-2.78, -16.45, 0.2, 1.0, 2.0);  // left
    addCollider(-1.82, -16.45, 0.2, 1.0, 2.0);  // right
    addCollider(-2.62, -15.85, 0.5, 0.2, 2.0);  // ajar door blocks the left half
    hideys.push({ id: 'fridge', label: 'THE FRIDGE', x: -2.1, z: -15.4, inX: -2.3, inZ: -16.42, inYaw: Math.PI, outX: -2.0, outZ: -15.2 });
  }
  { // stove + goo pot
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.8), std(0x8a8478, { roughness: 0.5, metalness: 0.3 }));
    st.position.set(3.9, 0.43, -16.5); st.castShadow = st.receiveShadow = true; scene.add(st);
    addCollider(3.9, -16.5, 1.15, 1.0, 0.87);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 14), std(0x1a1a1a));
      b.position.set(3.68 + (i % 2) * 0.45, 0.87, -16.7 + ((i / 2) | 0) * 0.4); scene.add(b);
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.28, 18), std(0x2c3034, { roughness: 0.4, metalness: 0.6 }));
    pot.position.set(3.68, 1.01, -16.7); pot.castShadow = true; scene.add(pot);
    const goo = new THREE.Mesh(new THREE.CircleGeometry(0.23, 18),
      new THREE.MeshStandardMaterial({ color: 0x3aa020, emissive: 0x5aff3a, emissiveIntensity: 0.9 }));
    goo.rotation.x = -Math.PI / 2; goo.position.set(3.68, 1.16, -16.7); scene.add(goo);
    const gl = new THREE.PointLight(0x66ff44, 4, 4, 2); gl.position.set(3.68, 1.5, -16.5); scene.add(gl);
    const bubbles = [];
    for (let i = 0; i < 5; i++) {
      const bu = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a7018, emissive: 0x66ff44, emissiveIntensity: 0.8, transparent: true }));
      scene.add(bu); bubbles.push(bu);
    }
    tickers.push(t => bubbles.forEach((bu, i) => {
      const ph = (t * 0.6 + i / 5) % 1;
      bu.position.set(3.68 + Math.sin(i * 9) * 0.12, 1.16 + ph * 0.45, -16.7 + Math.cos(i * 7) * 0.12);
      bu.material.opacity = 1 - ph;
    }));
  }
  { // counter, cleaver, sausages, rubber chicken
    const co = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.85, 0.65), std(0x6a5236, { roughness: 0.75 }));
    co.position.set(1.1, 0.43, -16.55); co.castShadow = co.receiveShadow = true; scene.add(co);
    addCollider(1.1, -16.55, 2.8, 0.85, 0.87);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.35), std(0xb89868));
    board.position.set(0.7, 0.87, -16.5); scene.add(board);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.012), std(0xb8bec4, { metalness: 0.8, roughness: 0.25 }));
    blade.position.set(1.6, 0.94, -16.5); blade.rotation.z = 0.5; scene.add(blade);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), std(0x2a1a0c));
    handle.position.set(1.76, 1.04, -16.5); handle.rotation.z = 0.5; scene.add(handle);
    for (let i = 0; i < 5; i++) { // sausage chain
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 5, 8), std(0x8a3a2a, { roughness: 0.6 }));
      s.position.set(-0.5 + i * 0.13, 2.15 - Math.sin(i / 4 * Math.PI) * 0.25, -11.5);
      s.rotation.z = 0.6 - i * 0.3; s.castShadow = true; scene.add(s);
    }
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), std(0x333333));
    hook.position.set(-0.5, 2.7, -11.5); scene.add(hook);
    const ch = new THREE.Group(); // rubber chicken, hanging, upside down
    const cbody = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), std(0xe8d060, { roughness: 0.5 }));
    cbody.scale.set(1, 1.4, 0.9); ch.add(cbody);
    const cneck = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.18, 5, 8), std(0xe8d060));
    cneck.position.set(0.04, -0.22, 0); cneck.rotation.z = -0.3; ch.add(cneck);
    const chead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), std(0xe8d060));
    chead.position.set(0.1, -0.34, 0); ch.add(chead);
    const cbeak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 8), std(0xd87818));
    cbeak.rotation.z = -Math.PI / 2; cbeak.position.set(0.17, -0.34, 0); ch.add(cbeak);
    const ccomb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), std(0xc03030));
    ccomb.position.set(0.1, -0.4, 0); ch.add(ccomb);
    ch.position.set(2.6, 1.95, -11.2); shadowAll(ch); scene.add(ch);
    const hook2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), std(0x333333));
    hook2.position.set(2.6, 2.7, -11.2); scene.add(hook2);
    tickers.push(t => { ch.rotation.y = Math.sin(t * 0.7) * 0.5; ch.rotation.z = Math.sin(t * 1.1) * 0.07; });
  }
  vent(1.2, -10.2);
  speakers.push({ name: 'THE FRIDGE', x: -2.3, z: -16.4, y: 2.3, radius: 2.8, lines: [
    'FEED ME.', 'I AM SO COLD. AND SO HUNGRY.', 'THE CHEESE IN THE DEN IS A COWARD.',
    'i have a leftover in here from 2011. it has opinions now.', 'shut my door. were you raised in a BARN.',
    'there is a casserole in the back. do not trust it. do not name it.',
  ] });

  // ================= BATHROOM OF DOOM =================
  { // tub + duck armada
    const white = std(0xd8dcd8, { roughness: 0.3 });
    const tub = new THREE.Group(); tub.position.set(5.95, 0, -14.2);
    [[-0.55, 0, 0.1, 2.3], [0.55, 0, 0.1, 2.3], [0, -1.1, 1.2, 0.1], [0, 1.1, 1.2, 0.1]].forEach(([x, z, sx, sz]) => {
      const wallP = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.6, sz), white);
      wallP.position.set(x, 0.3, z); tub.add(wallP);
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 2.3), white);
    base.position.y = 0.04; tub.add(base);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x3a7c8c, transparent: true, opacity: 0.75, roughness: 0.15 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.42; tub.add(water);
    shadowAll(tub); scene.add(tub);
    addCollider(5.95, -14.2, 1.4, 2.5, 0.62);
    const duckSpots = [[5.7, -14.9, 0.8], [6.2, -14.4, 0.7], [5.8, -13.9, 0.75], [6.15, -13.4, 0.8], [5.75, -13.1, 0.7]];
    duckSpots.forEach(([x, z, s], i) => {
      const d = buildDuck(s); d.group.position.set(x, 0.42, z); d.group.rotation.y = i * 1.7; scene.add(d.group);
    });
    const cursed = buildDuck(0.9, true);
    cursed.group.position.set(5.95, 0.42, -14.35); scene.add(cursed.group);
    tickers.push((t, dt, p) => { // the cursed one rotates to face you. the others do not.
      cursed.group.rotation.y = Math.atan2(p.x - 5.95, p.z + 14.35) - Math.PI / 2;
      duckSpots.forEach(() => {});
    });
    const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), std(0x9aa0a4, { metalness: 0.8, roughness: 0.3 }));
    faucet.position.set(5.95, 0.75, -15.2); scene.add(faucet);
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x9fd4e0, transparent: true, opacity: 0.8 }));
    scene.add(drip);
    tickers.push(t => { const ph = (t * 0.9) % 1; drip.position.set(5.95, 0.72 - ph * 0.3, -15.2); drip.material.opacity = 0.8 * (1 - ph); });
  }
  { // toilet
    const white = std(0xd8dcd8, { roughness: 0.35 });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.4, 16), white);
    bowl.position.set(9.3, 0.2, -15.6); bowl.castShadow = true; scene.add(bowl);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 18), white);
    seat.rotation.x = Math.PI / 2; seat.position.set(9.3, 0.43, -15.6); scene.add(seat);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.18), white);
    tank.position.set(9.75, 0.6, -15.6); tank.rotation.y = Math.PI / 2; tank.castShadow = true; scene.add(tank);
    addCollider(9.4, -15.6, 0.8, 0.7, 0.5);
  }
  { // sink + useless mirror
    const white = std(0xd8dcd8, { roughness: 0.35 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 10), white);
    ped.position.set(9.4, 0.35, -10.6); scene.add(ped);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.14, 16), white);
    basin.position.set(9.4, 0.76, -10.6); basin.castShadow = true; scene.add(basin);
    addCollider(9.4, -10.6, 0.6, 0.6, 0.83);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8),
      std(0x14181e, { roughness: 0.08, metalness: 0.9 }));
    mirror.position.set(9.93, 1.7, -10.6); mirror.rotation.y = -Math.PI / 2; scene.add(mirror);
    const sg = signPlane(['MIRROR OUT OF ORDER', '(you look great though)'], 0.7, 0.26, { fs: 13, pw: 256, ph: 96 });
    sg.position.set(9.92, 1.15, -10.6); sg.rotation.y = -Math.PI / 2; scene.add(sg);
  }
  bulbFixture(7.5, 2.75, -13);

  // ================= DISCO CRYPT =================
  function coffin(x, z, ry, lidOpen) {
    const wood = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.8, color: 0xa88a6a });
    const box = new THREE.Mesh(rbox(0.75, 0.5, 2.1, 0.05), wood);
    box.position.set(x, 0.25, z); box.rotation.y = ry;
    box.castShadow = box.receiveShadow = true; scene.add(box);
    const lid = new THREE.Mesh(rbox(0.75, 0.06, 2.1, 0.024), wood);
    lid.position.set(x + (lidOpen ? 0.32 : 0), 0.53 + (lidOpen ? 0.1 : 0), z);
    lid.rotation.y = ry; lid.rotation.z = lidOpen ? 0.35 : 0;
    lid.castShadow = true; scene.add(lid);
    addCollider(x, z, 1.0, 2.2, 0.56);
  }
  coffin(9.2, -3.1, 0.25, true);
  coffin(14.2, -2.6, -0.15, false);
  { // upright coffin: hollow, lid ajar, prime hiding real estate
    const wood = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.8, color: 0x987a5a });
    const mk = (w, h2, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h2, d), wood);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
    };
    mk(0.08, 2.2, 0.72, 15.82, 1.1, -3.6);   // back (against east wall)
    mk(0.62, 2.2, 0.08, 15.5, 1.1, -3.94);   // side
    mk(0.62, 2.2, 0.08, 15.5, 1.1, -3.26);   // side
    mk(0.7, 0.08, 0.72, 15.5, 2.22, -3.6);   // cap
    const lid = new THREE.Mesh(rbox(0.06, 2.2, 0.72, 0.024), wood);
    lid.position.set(15.08, 1.1, -3.85); lid.rotation.y = -0.55; lid.castShadow = true; scene.add(lid);
    addCollider(15.82, -3.6, 0.2, 0.8, 2.2);
    addCollider(15.5, -3.94, 0.7, 0.2, 2.2);
    addCollider(15.5, -3.26, 0.7, 0.2, 2.2);
    addCollider(15.08, -3.85, 0.2, 0.6, 2.2); // ajar lid
    hideys.push({ id: 'coffin', label: 'THE STANDING COFFIN', x: 14.7, z: -3.5, inX: 15.45, inZ: -3.6, inYaw: Math.PI / 2, outX: 14.6, outZ: -3.5 });
  }
  const skel = buildSkeleton();
  skel.group.position.set(14.2, 0.56, -2.6); skel.group.rotation.y = -0.6; scene.add(skel.group);
  tickers.push(t => skel.tick(t));
  { // disco ball + orbiting colored beams
    const ballG = new THREE.Group(); ballG.position.set(11.5, 2.45, 0);
    const speck = cv(128, 128, (g, w, h) => {
      g.fillStyle = '#666a70'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = `rgba(${200 + rnd() * 55 | 0},${200 + rnd() * 55 | 0},255,${0.5 + rnd() * 0.5})`;
        g.fillRect(x * 16 + 1, y * 16 + 1, 13, 13);
      }
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14),
      new THREE.MeshStandardMaterial({ map: speck, roughness: 0.2, metalness: 0.9, emissive: 0x9aa8c8, emissiveIntensity: 0.9 }));
    ballG.add(ball);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, H - 2.45 - 0.3, 6), std(0x222222));
    rod.position.y = (H - 2.45 + 0.3) / 2; ballG.add(rod);
    const spots = [];
    [0xff4488, 0x44ddff, 0xaaff44].forEach((cl, i) => {
      const sp = new THREE.SpotLight(cl, 18, 14, 0.5, 0.55, 1.5);
      sp.position.set(0, 0, 0);
      sp.target.position.set(Math.cos(i * 2.1) * 3.5, -2.45, Math.sin(i * 2.1) * 3.5);
      ballG.add(sp, sp.target); spots.push(sp);
    });
    scene.add(ballG);
    tickers.push((t, dt) => { ballG.rotation.y += dt * 0.9; ball.rotation.y -= dt * 1.6; });
  }
  { // jukebox
    const jb = new THREE.Group(); jb.position.set(8, 0, 4.3);
    const bodyJ = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.55), std(0x7a2a1a, { roughness: 0.5 }));
    bodyJ.position.y = 0.65; jb.add(bodyJ);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.55, 16, 1, false, 0, Math.PI), std(0x7a2a1a, { roughness: 0.5 }));
    arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.y = 1.3; jb.add(arch);
    const glowStrip = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 20, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x201008, emissive: 0xffa02e, emissiveIntensity: 1.4 }));
    glowStrip.position.y = 1.3; jb.add(glowStrip);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x102008, emissive: 0x66ff88, emissiveIntensity: 0.8 }));
    screen.position.set(0, 1.05, 0.28); jb.add(screen);
    shadowAll(jb); scene.add(jb);
    addCollider(8, 4.3, 1.1, 0.8, 1.45);
    tickers.push(t => { glowStrip.material.emissiveIntensity = 1.0 + 0.5 * Math.sin(t * 2.4); });
  }
  for (let i = 0; i < 40; i++) { // old confetti, nobody swept
    const cf = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05),
      new THREE.MeshBasicMaterial({ color: [0xd84fd0, 0xffd23e, 0x44ddff, 0xaaff44][i % 4] }));
    cf.rotation.x = -Math.PI / 2; cf.rotation.z = rnd() * 3;
    cf.position.set(8 + rnd() * 7.5, 0.012, -4.5 + rnd() * 9); scene.add(cf);
  }
  vent(12.5, -3.8, 0.3);
  speakers.push({ name: 'SKELETON', x: 14.2, z: -2.6, y: 1.8, radius: 3.0, lines: [
    'nice moves. i have none. i am dead.',
    'the disco never stops. i have asked. it will not stop.',
    'there is a guy in the standing coffin. we do not talk.',
  ] });

  // ================= GNOME YARD =================
  { // dead tree
    const bark = std(0x241a10, { roughness: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.9, 10), bark);
    trunk.position.set(-4.6, 0.95, 10.8); trunk.castShadow = true; scene.add(trunk);
    [[0.5, 0.4, 1.7], [-0.5, 0.9, 1.6], [0.2, -0.6, 1.9], [-0.25, 0.1, 2.1]].forEach(([rz, ry, y]) => {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.9, 8), bark);
      br.position.set(-4.6 + rz * 0.5, y, 10.8 + ry * 0.3); br.rotation.z = rz; br.rotation.x = ry * 0.4;
      br.castShadow = true; scene.add(br);
    });
    addCollider(-4.6, 10.8, 0.5, 0.5);
  }
  const gnomes = [];
  [[-5.5, 6.5], [-2, 7.2], [1.5, 6.3], [-6, 9.5], [2.2, 9.8], [-4, 12.8], [-1, 11.5], [1.8, 12.9], [-6.3, 13.3], [0.2, 8.7], [2.6, 7.8]]
    .forEach(([x, z], i) => {
      const gn = buildGnome(0.9 + (i % 3) * 0.12);
      gn.group.position.set(x, 0, z); gn.group.rotation.y = rnd() * 6;
      scene.add(gn.group); gnomes.push({ g: gn.group, sp: 0.25 + (i % 5) * 0.12 });
    });
  { // gnorman's throne
    const th = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), std(0x76767e, { roughness: 0.9 }));
    th.position.set(0.5, 0.25, 12.5); th.castShadow = th.receiveShadow = true; scene.add(th);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.1), std(0x76767e, { roughness: 0.9 }));
    back.position.set(0.5, 0.85, 12.72); back.castShadow = true; scene.add(back);
    addCollider(0.5, 12.5, 0.8, 0.8, 0.52);
    const gnorman = buildGnome(1.25);
    gnorman.group.position.set(0.5, 0.5, 12.45); scene.add(gnorman.group);
    gnomes.push({ g: gnorman.group, sp: 1.4 });
  }
  let omen = null; // once a game, every gnome briefly turns toward the bastard
  tickers.push((t, dt, p) => {
    if (omen) { omen.left -= dt; if (omen.left <= 0) omen = null; }
    const tx = omen ? omen.x : p.x, tz = omen ? omen.z : p.z;
    gnomes.forEach(({ g, sp }) => {
      const want = Math.atan2(tx - g.position.x, tz - g.position.z);
      let dy = want - g.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      g.rotation.y += dy * Math.min(1, dt * (omen ? 6 : sp));
    });
  });
  const moonSpot = new THREE.SpotLight(0x9db8e8, 16, 16, 0.75, 0.5, 1.4);
  moonSpot.position.set(-2, 3.1, 9.5); moonSpot.target.position.set(-2, 0, 9.5);
  scene.add(moonSpot, moonSpot.target);
  { // fireflies
    const n = 14, pos = new Float32Array(n * 3), sd = [];
    for (let i = 0; i < n; i++) { pos[i * 3] = -6.5 + rnd() * 9; pos[i * 3 + 1] = 0.4 + rnd() * 1.8; pos[i * 3 + 2] = 5.5 + rnd() * 8; sd.push(rnd() * 20); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ff = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xcaff6a, size: 0.05, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(ff);
    tickers.push((t, dt) => {
      const a = gg.attributes.position.array;
      for (let i = 0; i < n; i++) {
        a[i * 3] += Math.sin(t * 0.7 + sd[i]) * 0.004;
        a[i * 3 + 1] += Math.cos(t * 0.9 + sd[i] * 2) * 0.003;
        a[i * 3 + 2] += Math.sin(t * 0.5 + sd[i] * 3) * 0.004;
      }
      gg.attributes.position.needsUpdate = true;
      ff.material.opacity = 0.5 + 0.4 * Math.sin(t * 2.2);
    });
  }
  speakers.push({ name: 'GNORMAN', x: 0.5, z: 12.45, y: 1.6, radius: 3.2, lines: [
    'we see you. we have always seen you.',
    'do not touch the hat. the hat is load bearing.',
    'the moon is fake. the grass is real. weird, right.',
  ] });

  // ================= BASEMENT =================
  const baseBulb = bulbFixture(7.5, 2.4, 9.5);
  [[4.5, 6.5, 1.0], [9, 7.5, 1.3], [5.5, 12.5, 0.9], [10.5, 10.8, 1.1]].forEach(([x, z, len]) => {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 6), std(0x3a3a3e, { metalness: 0.7, roughness: 0.5 }));
    chain.position.set(x, H - len / 2, z); scene.add(chain);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), std(0x3a3a3e, { metalness: 0.7 }));
    hook.position.set(x, H - len - 0.05, z); scene.add(hook);
  });
  crate(4, 13.2, 1.0, 0.2); crate(5.2, 13.3, 0.8, -0.4); crate(4.4, 12.2, 0.6, 0.7); crate(11, 6, 1.1, 0.1);
  const monster = buildMonster();
  monster.group.position.set(10.3, 0, 12.3); monster.group.rotation.y = -2.4;
  scene.add(monster.group);
  addCollider(10.3, 12.3, 1.6, 1.6, 2.1); // standing on the sleeping monster: allowed, unwise
  tickers.push((t, dt, p) => monster.tick(t, dt, p));
  { // break table + mug + signage
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.55), std(0x8a8478, { roughness: 0.6 }));
    tb.position.set(9.2, 0.7, 11.2); tb.castShadow = tb.receiveShadow = true; scene.add(tb);
    [[-0.32, -0.2], [0.32, -0.2], [-0.32, 0.2], [0.32, 0.2]].forEach(([dx, dz]) => {
      const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), std(0x6a6f74, { metalness: 0.6 }));
      lg.position.set(9.2 + dx, 0.35, 11.2 + dz); scene.add(lg);
    });
    addCollider(9.2, 11.2, 1.0, 0.75, 0.73);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 12), std(0xd8d0c0, { roughness: 0.5 }));
    mug.position.set(9.1, 0.78, 11.15); scene.add(mug);
    const mh = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.01, 6, 10), std(0xd8d0c0));
    mh.position.set(9.17, 0.78, 11.15); mh.rotation.y = Math.PI / 2; scene.add(mh);
    const sg = signPlane(['BACK IN 5', '(DO NOT PERCEIVE ME)'], 1.0, 0.44, { fs: 18, pw: 256, ph: 112 });
    sg.position.set(11.92, 1.8, 12.3); sg.rotation.y = -Math.PI / 2; scene.add(sg);
    const clock = canvasPlane(0.5, 0.5, 128, 128, (c, w, h) => {
      c.fillStyle = '#d8d0c0'; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill();
      c.strokeStyle = '#222'; c.lineWidth = 5; c.stroke();
      c.lineWidth = 4;
      for (let i = 0; i < 12; i++) { c.beginPath(); const a = i / 12 * Math.PI * 2; c.moveTo(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48); c.lineTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54); c.stroke(); }
      c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 26); c.stroke();
      c.beginPath(); c.moveTo(64, 64); c.lineTo(92, 78); c.stroke();
      c.fillStyle = '#222'; c.font = 'bold 13px Courier New'; c.textAlign = 'center';
      c.fillText('BREAK O CLOCK', 64, 100);
    }, { basic: true });
    clock.position.set(8.5, 2.0, 13.92); clock.rotation.y = Math.PI; scene.add(clock);
  }
  { // SECURITY: camera desk (sneaky-bastard-mode foreshadowing)
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 0.55), std(0x4a4640, { roughness: 0.7 }));
    desk.position.set(4.6, 0.38, 5.75); desk.castShadow = desk.receiveShadow = true; scene.add(desk);
    addCollider(4.6, 5.75, 1.9, 0.8, 0.78);
    const screens = [];
    ['DEN', 'HALL', 'YARD'].forEach((label, i) => {
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.3), std(0x2c2c30, { roughness: 0.6 }));
      mon.position.set(4.1 + i * 0.5, 0.96, 5.7); mon.castShadow = true; scene.add(mon);
      const c = document.createElement('canvas'); c.width = 64; c.height = 48;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.27),
        new THREE.MeshBasicMaterial({ map: t }));
      scr.position.set(4.1 + i * 0.5, 0.97, 5.86); scene.add(scr);
      screens.push({ ctx: c.getContext('2d'), t, label });
    });
    tickers.push((t, dt, p) => {
      if (Math.hypot(p.x - 4.6, p.z - 5.75) > 9) return;
      screens.forEach(s => {
        const g = s.ctx;
        for (let i = 0; i < 130; i++) { const v = (Math.random() * 110) | 0; g.fillStyle = `rgb(${v},${v + 8},${v})`; g.fillRect((Math.random() * 64) | 0, (Math.random() * 48) | 0, 3, 2); }
        g.fillStyle = '#aef2ae'; g.font = 'bold 9px Courier New'; g.fillText('CAM ' + s.label, 4, 10);
        s.t.needsUpdate = true;
      });
    });
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.45, 12), std(0x5a3a2a, { roughness: 0.7 }));
    stool.position.set(4.6, 0.22, 6.6); stool.castShadow = true; scene.add(stool);
    addCollider(4.6, 6.6, 0.45, 0.45, 0.45);
    const sg = signPlane(['SECURITY', 'cameras: 3 of 3 haunted'], 0.95, 0.4, { fs: 16, pw: 256, ph: 104 });
    sg.position.set(4.6, 1.9, 5.09); sg.rotation.y = 0; scene.add(sg);
  }
  vent(-11.8, -10.2, 0.1); // nursery vent (they connect. to what? unclear.)
  speakers.push({ name: 'THE MONSTER', x: 10.3, z: 12.3, y: 2.5, radius: 3.4, lines: [
    'i am on break. scram.', 'union rules. no chasing until the next round.',
    'tell zoomy he still owes me five bucks.',
    'i ate a guy named kevin once. tasted like regret. and kevin.',
    'my therapist says i have a healthy work-life balance now.',
    'do NOT wake me. i have plans. the plans are eating you.',
  ] });
  speakers.push({ name: 'THE BUTTON', x: -5.6, z: 3.6, y: 1.5, radius: 1.7, lines: [
    'do not press me. i am for emergencies. GIGGLE emergencies.',
  ] });

  // ================= MEAT PASS: more furniture, more parkour, more places to lurk =================
  { // DEN: sofa (climbable) + bookshelf
    const fabric = std(0x6a2430, { roughness: 0.95 });
    const base = new THREE.Mesh(rbox(1.9, 0.42, 0.8, 0.07), fabric);
    base.position.set(-2.6, 0.21, -3.75); base.castShadow = base.receiveShadow = true; scene.add(base);
    const back = new THREE.Mesh(rbox(1.9, 0.6, 0.22, 0.06), fabric);
    back.position.set(-2.6, 0.72, -4.05); back.castShadow = true; scene.add(back);
    [-1, 1].forEach(s => {
      const arm = new THREE.Mesh(rbox(0.24, 0.3, 0.8, 0.06), fabric);
      arm.position.set(-2.6 + s * 0.95, 0.57, -3.75); arm.castShadow = true; scene.add(arm);
    });
    [-0.45, 0.45].forEach(dx => {
      const cush = new THREE.Mesh(rbox(0.82, 0.14, 0.66, 0.05), std(0x7e3240, { roughness: 0.95 }));
      cush.position.set(-2.6 + dx, 0.49, -3.72); cush.castShadow = true; scene.add(cush);
    });
    addCollider(-2.6, -3.75, 2.1, 1.0, 0.56);
    const shelf = new THREE.Group(); shelf.position.set(-6.72, 0, -1.6);
    const shelfM = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.8 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 2.2, 1.8), shelfM);
    frame.position.y = 1.1; shelf.add(frame);
    for (let row = 0; row < 4; row++) {
      for (let b = 0; b < 8; b++) {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28 + rnd() * 0.08, 0.12),
          std([0x7e3240, 0x2a5a4a, 0x8a6a2a, 0x3a4a7a, 0x5a3a6a][(b + row) % 5], { roughness: 0.8 }));
        book.position.set(0.19, 0.36 + row * 0.5, -0.75 + b * 0.21);
        shelf.add(book);
      }
    }
    shelf.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(shelf);
    addCollider(-6.72, -1.6, 0.6, 1.9, 2.2);
  }
  { // HALL: grandfather clock with a swinging pendulum
    const wood = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.75, color: 0xb89a72 });
    const body = new THREE.Mesh(rbox(0.55, 2.3, 0.38, 0.04), wood);
    body.position.set(-12.68, 1.15, -6.1); body.castShadow = body.receiveShadow = true; scene.add(body);
    const face = canvasPlane(0.4, 0.4, 96, 96, (c) => {
      c.fillStyle = '#e8dfc8'; c.beginPath(); c.arc(48, 48, 44, 0, 7); c.fill();
      c.strokeStyle = '#241708'; c.lineWidth = 4; c.stroke();
      c.beginPath(); c.moveTo(48, 48); c.lineTo(48, 18); c.stroke();
      c.beginPath(); c.moveTo(48, 48); c.lineTo(68, 60); c.stroke();
    }, { basic: true });
    face.position.set(-12.48, 1.95, -6.1); face.rotation.y = Math.PI / 2; scene.add(face);
    const pend = new THREE.Group(); pend.position.set(-12.48, 1.45, -6.1);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), std(0xb89a4a, { metalness: 0.7, roughness: 0.3 }));
    rod.position.y = -0.35; pend.add(rod);
    const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16), std(0xb89a4a, { metalness: 0.8, roughness: 0.25 }));
    bob.rotation.x = Math.PI / 2; bob.position.y = -0.68; pend.add(bob);
    scene.add(pend);
    tickers.push(t => { pend.rotation.x = Math.sin(t * 2.4) * 0.28; });
    addCollider(-12.68, -6.1, 0.75, 0.6, 2.3);
  }
  { // KITCHEN: prep table with ham (mid-room cover for chases)
    const wood = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.7, color: 0xc9a878 });
    const top = new THREE.Mesh(rbox(1.3, 0.09, 0.8, 0.03), wood);
    top.position.set(1.3, 0.83, -12.6); top.castShadow = top.receiveShadow = true; scene.add(top);
    [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(([dx, dz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.8, 0.09), wood);
      leg.position.set(1.3 + dx, 0.4, -12.6 + dz); leg.castShadow = true; scene.add(leg);
    });
    const ham = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.2, 6, 12), std(0xd88a8a, { roughness: 0.6 }));
    ham.rotation.z = Math.PI / 2; ham.position.set(1.15, 0.98, -12.6); ham.castShadow = true; scene.add(ham);
    const bone2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), std(0xf0ead8));
    bone2.rotation.z = Math.PI / 2; bone2.position.set(1.48, 0.98, -12.6); scene.add(bone2);
    addCollider(1.3, -12.6, 1.5, 1.0, 0.87);
  }
  { // NURSERY: wardrobe (hideable) + rocking horse that never stops
    const wood = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.75, color: 0xd8cab0 });
    const mk = (w, h2, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h2, d), wood);
      m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
    };
    mk(0.08, 2.2, 1.1, -12.88, 1.1, -11.5);  // back
    mk(0.6, 2.2, 0.08, -12.6, 1.1, -12.05);  // side
    mk(0.6, 2.2, 0.08, -12.6, 1.1, -10.95);  // side
    mk(0.62, 0.1, 1.14, -12.6, 2.24, -11.5); // crown
    mk(0.62, 0.06, 1.14, -12.6, 0.03, -11.5); // base
    const doorR = new THREE.Mesh(rbox(0.05, 2.1, 0.53, 0.02), wood); // closed door
    doorR.position.set(-12.33, 1.08, -11.22); doorR.castShadow = doorR.receiveShadow = true; scene.add(doorR);
    const doorL = new THREE.Mesh(rbox(0.05, 2.1, 0.53, 0.02), wood);
    doorL.position.set(-12.28, 1.08, -11.88); doorL.rotation.y = 0.7; doorL.castShadow = true; scene.add(doorL);
    [doorR, doorL].forEach(d => {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(0xb89a4a, { metalness: 0.7 }));
      knob.position.set(0.05, 0, d === doorR ? -0.2 : 0.2); d.add ? d.add(knob) : null;
    });
    addCollider(-12.88, -11.5, 0.2, 1.2, 2.2);
    addCollider(-12.6, -12.05, 0.7, 0.2, 2.2);
    addCollider(-12.6, -10.95, 0.7, 0.2, 2.2);
    addCollider(-12.33, -11.22, 0.15, 0.55, 2.2); // closed half
    hideys.push({ id: 'wardrobe', label: 'THE WARDROBE', x: -11.9, z: -11.6, inX: -12.58, inZ: -11.72, inYaw: -Math.PI / 2, in2X: -12.58, in2Z: -11.28, outX: -11.8, outZ: -11.6, cap: 2 });
    const horse = new THREE.Group(); horse.position.set(-6.6, 0, -15.6);
    const hbody = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.4, 6, 12), std(0xc9a878, { roughness: 0.8 }));
    hbody.rotation.z = Math.PI / 2; hbody.position.y = 0.55; horse.add(hbody);
    const hhead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), std(0xc9a878, { roughness: 0.8 }));
    hhead.scale.set(1.3, 1, 0.8); hhead.position.set(0.36, 0.78, 0); horse.add(hhead);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.04), std(0x7e3240));
    mane.position.set(0.28, 0.88, 0); horse.add(mane);
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), std(0x14181c, { roughness: 0.2 }));
      eye.position.set(0.42, 0.82, 0.08 * s); horse.add(eye);
      const rocker = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.028, 8, 12, Math.PI * 0.85), std(0x8a6a3a));
      rocker.position.set(0, 0.46, 0.14 * s); rocker.rotation.z = Math.PI + Math.PI * 0.075; horse.add(rocker);
      const legF = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), std(0xc9a878));
      legF.position.set(0.22 * s, 0.3, 0.14 * s * 0.5); horse.add(legF);
    });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), std(0xb89a4a, { metalness: 0.6 }));
    handle.rotation.x = Math.PI / 2; handle.position.set(0.36, 0.92, 0); horse.add(handle);
    horse.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(horse);
    tickers.push(t => { horse.rotation.z = Math.sin(t * 1.9) * 0.16; }); // it does not stop. ever.
    addCollider(-6.6, -15.6, 1.0, 0.6, 0.9);
  }
  { // CRYPT: candelabras + bone pile
    [[9.3, 2.2], [13.5, -0.5]].forEach(([x, z]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.5, 8), std(0x3a3a40, { metalness: 0.7, roughness: 0.4 }));
      pole.position.set(x, 0.75, z); pole.castShadow = true; scene.add(pole);
      for (let i = -1; i <= 1; i++) {
        const cnd = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.16, 8), std(0xe8e0c8));
        cnd.position.set(x + i * 0.14, 1.58, z); scene.add(cnd);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 8), new THREE.MeshBasicMaterial({ color: 0xd8a2ff }));
        fl.position.set(x + i * 0.14, 1.71, z); scene.add(fl);
        tickers.push(t => { const s2 = 0.8 + 0.35 * Math.abs(Math.sin(t * 6.4 + i * 2 + x)); fl.scale.set(s2, s2, s2); });
      }
      addCollider(x, z, 0.35, 0.35, 1.6);
    });
    let br = 11;
    const brnd = () => (br = (br * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 7; i++) {
      const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), std(0xd8d4c6, { roughness: 0.6 }));
      bone.position.set(12.6 + (brnd() - 0.5) * 0.8, 0.06 + brnd() * 0.15, 3.6 + (brnd() - 0.5) * 0.7);
      bone.rotation.set(brnd() * 3, brnd() * 3, Math.PI / 2 + (brnd() - 0.5));
      bone.castShadow = true; scene.add(bone);
    }
    const skull2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), std(0xd8d4c6, { roughness: 0.6 }));
    skull2.position.set(12.7, 0.28, 3.5); skull2.castShadow = true; scene.add(skull2);
    addCollider(12.6, 3.6, 1.0, 0.9, 0.35);
  }
  { // YARD: gnome shed (hideable, gnome on the roof) + stump
    const shedM = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.85, color: 0x9a8a6a });
    const backW = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 1.8), shedM);
    backW.position.set(-6.55, 0.75, 7.3); backW.castShadow = backW.receiveShadow = true; scene.add(backW);
    [-1, 1].forEach(s => {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 1.2), shedM);
      roof.position.set(-5.95, 1.32, 7.3 + s * 0.52); roof.rotation.x = -s * 0.72;
      roof.castShadow = roof.receiveShadow = true; scene.add(roof);
      const sideW = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.07), shedM);
      sideW.position.set(-5.95, 0.45, 7.3 + s * 0.95); sideW.castShadow = true; scene.add(sideW);
      addCollider(-5.95, 7.3 + s * 0.95, 1.5, 0.2, 1.2);
    });
    addCollider(-6.55, 7.3, 0.2, 1.9, 1.5);
    const roofGnome = buildGnome(1.0);
    roofGnome.group.position.set(-5.9, 1.62, 7.3); scene.add(roofGnome.group);
    gnomes.push({ g: roofGnome.group, sp: 0.9 });
    hideys.push({ id: 'shed', label: 'THE GNOME SHED', x: -5.0, z: 7.3, inX: -6.0, inZ: 6.95, inYaw: -Math.PI / 2, in2X: -6.0, in2Z: 7.65, outX: -4.9, outZ: 7.3, cap: 2 });
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.45, 12), std(0x4a3520, { roughness: 0.95 }));
    stump.position.set(2.0, 0.22, 10.9); stump.castShadow = stump.receiveShadow = true; scene.add(stump);
    addCollider(2.0, 10.9, 0.7, 0.7, 0.45);
  }
  { // BASEMENT: shelf rack (climbable) + boiler
    const metal = std(0x4a4640, { roughness: 0.6, metalness: 0.4 });
    const rack = new THREE.Group(); rack.position.set(4.1, 0, 10.6);
    for (let lv = 0; lv < 3; lv++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.5), metal);
      sh.position.y = 0.55 + lv * 0.65; rack.add(sh);
      for (let j = 0; j < 3; j++) {
        if ((lv + j) % 2) continue;
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 10),
          std(0x8aa06a, { roughness: 0.3, transparent: true, opacity: 0.8 }));
        jar.position.set(-0.5 + j * 0.5, 0.55 + lv * 0.65 + 0.12, 0); rack.add(jar);
      }
    }
    [[-0.78, -0.22], [0.78, -0.22], [-0.78, 0.22], [0.78, 0.22]].forEach(([dx, dz]) => {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 0.05), metal);
      up.position.set(dx, 0.95, dz); rack.add(up);
    });
    rack.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(rack);
    addCollider(4.1, 10.6, 1.7, 0.6, 1.85);
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 1.8, 16), std(0x6a4a3a, { roughness: 0.5, metalness: 0.5 }));
    boiler.position.set(5.6, 0.9, 13.1); boiler.castShadow = boiler.receiveShadow = true; scene.add(boiler);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x6a4a3a, { roughness: 0.5, metalness: 0.5 }));
    dome.position.set(5.6, 1.8, 13.1); dome.castShadow = true; scene.add(dome);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), std(0x3a3a40, { metalness: 0.7 }));
    pipe.position.set(5.6, 2.6, 13.1); scene.add(pipe);
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 14), std(0xa03030, { roughness: 0.4, metalness: 0.5 }));
    valve.position.set(5.15, 1.2, 12.9); valve.rotation.y = Math.PI / 2; scene.add(valve);
    addCollider(5.6, 13.1, 1.15, 1.15, 1.8);
  }

  // ================= DECOR PASS: fill every room. walls, stacks, water, filth, jokes =================
  // fake contact shadows: a soft dark blob under anything that sits on a floor.
  // one shared texture + geometry; grounds ~200 props for almost nothing.
  const blobTex = cv(128, 128, (g) => {
    const rg = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    rg.addColorStop(0, 'rgba(0,0,0,.5)'); rg.addColorStop(0.65, 'rgba(0,0,0,.25)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
  });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  const BB3 = new THREE.Box3();
  function blobUnder(m) {
    BB3.setFromObject(m);
    if (!isFinite(BB3.min.y)) return;
    for (const fy of [0, 3.7, 7.4]) {
      if (Math.abs(BB3.min.y - fy) < 0.14) {
        const sx = BB3.max.x - BB3.min.x, sz = BB3.max.z - BB3.min.z;
        if (sx > 6 || sz > 6 || sx < 0.18 || sz < 0.18) return; // beams and toothpicks need no shadow
        const p = new THREE.Mesh(blobGeo, blobMat);
        p.rotation.x = -Math.PI / 2;
        p.position.set((BB3.min.x + BB3.max.x) / 2, fy + 0.008 + rnd() * 0.008, (BB3.min.z + BB3.max.z) / 2);
        p.scale.set(sx * 1.35, sz * 1.35, 1);
        p.renderOrder = 1;
        scene.add(p);
        return;
      }
    }
  }
  const put = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); blobUnder(m); return m; };
  const boxAt = (w, h2, d, m2, x, y, z, ry = 0) => put(new THREE.Mesh(new THREE.BoxGeometry(w, h2, d), m2), x, y, z, ry);
  const rboxAt = (w, h2, d, m2, x, y, z, ry = 0, r = 0.035) => put(new THREE.Mesh(rbox(w, h2, d, r), m2), x, y, z, ry);
  const cylAt = (r1, r2, h2, m2, x, y, z, seg = 12) => put(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h2, seg), m2), x, y, z);
  const sphAt = (r, m2, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = put(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m2), x, y, z); m.scale.set(sx, sy, sz); return m; };
  function wallSign(lines, w, h2, x, y, z, ry, o = {}) { const s = signPlane(lines, w, h2, o); s.position.set(x, y, z); s.rotation.y = ry; s.rotation.z = o.tilt || 0; scene.add(s); return s; }
  function waterJet(x, yTop, z, yBot, r = 0.018) {
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.6, yTop - yBot, 8),
      new THREE.MeshStandardMaterial({ color: 0xbfe4f0, transparent: true, opacity: 0.55, roughness: 0.1 }));
    jet.position.set(x, (yTop + yBot) / 2, z); scene.add(jet);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0xcfeaf4, transparent: true, opacity: 0.6 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, yBot + 0.015, z); scene.add(ring);
    tickers.push(t => {
      const ph = (t * 1.6) % 1;
      ring.scale.setScalar(0.6 + ph * 1.6); ring.material.opacity = 0.6 * (1 - ph);
      jet.scale.x = jet.scale.z = 0.85 + 0.3 * Math.abs(Math.sin(t * 9 + x));
    });
  }
  function dripper(x, yTop, z) {
    const dr = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x9fd4e0, transparent: true, opacity: 0.8 }));
    scene.add(dr);
    const pud = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14),
      new THREE.MeshStandardMaterial({ color: 0x3a4c50, roughness: 0.1, metalness: 0.3 }));
    pud.rotation.x = -Math.PI / 2; pud.position.set(x, 0.012, z); pud.receiveShadow = true; scene.add(pud);
    tickers.push(t => { const ph = (t * 0.8 + x) % 1; dr.position.set(x, yTop - ph * (yTop - 0.02), z); dr.material.opacity = 0.85 * (1 - ph * 0.4); });
  }
  function cobweb(x, z, ry, y = H - 0.46) {
    const web = canvasPlane(0.9, 0.9, 96, 96, (c) => {
      c.strokeStyle = 'rgba(220,220,220,.5)'; c.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(4, 4); c.lineTo(4 + Math.cos(i / 5 * 1.5) * 90, 4 + Math.sin(i / 5 * 1.5) * 90); c.stroke(); }
      for (let rr = 18; rr < 92; rr += 18) { c.beginPath(); c.arc(4, 4, rr, 0, 1.6); c.stroke(); }
    }, { basic: true, transparent: true });
    web.position.set(x, y, z); web.rotation.y = ry; scene.add(web);
  }
  function rat(path) {
    const g = new THREE.Group();
    const body = sphAt(0.07, std(0x2c2420, { roughness: 0.9 }), 0, 0.06, 0, 1.5, 0.9, 1); g.add(body); scene.remove(body); g.add(body);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.18, 6), std(0x4a3a34));
    tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.05, -0.15); g.add(tail);
    [-1, 1].forEach(s => { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), std(0x4a3a34)); ear.position.set(0.03 * s, 0.11, 0.06); g.add(ear); });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    let seg = 0, u = 0;
    tickers.push((t, dt) => {
      u += dt * 0.55;
      if (u >= 1) { u = 0; seg = (seg + 1) % path.length; }
      const a = path[seg], b = path[(seg + 1) % path.length];
      g.position.set(a[0] + (b[0] - a[0]) * u, 0, a[1] + (b[1] - a[1]) * u);
      g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    });
  }
  const junkM = { paper: std(0xd8cfae, { roughness: 0.95 }), pizza: std(0xc8a86a, { roughness: 0.9 }), dark: std(0x2a2622, { roughness: 0.95 }) };

  { // ---- DEN: hoarder cozy nightmare ----
    // fireplace with fake fire + mantel (climbable)
    const brick = mat(stoneWallTex, 0.9, [1.2, 0.8], 0xa07a6a);
    boxAt(1.7, 1.35, 0.5, brick, -3.9, 0.67, -4.68);
    boxAt(2.0, 0.14, 0.62, new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.7 }), -3.9, 1.41, -4.62);
    const fbox = boxAt(1.0, 0.8, 0.3, std(0x120a08), -3.9, 0.45, -4.5);
    fbox.receiveShadow = false;
    const flames2 = [];
    for (let i = -1; i <= 1; i++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8), new THREE.MeshBasicMaterial({ color: i ? 0xff8a2e : 0xffc34d }));
      fl.position.set(-3.9 + i * 0.18, 0.28, -4.5); scene.add(fl); flames2.push(fl);
    }
    tickers.push(t => flames2.forEach((f, i) => { f.scale.y = 0.7 + 0.5 * Math.abs(Math.sin(t * 7 + i * 2.1)); f.scale.x = f.scale.z = 0.8 + 0.25 * Math.sin(t * 9 + i); }));
    const fglow = new THREE.PointLight(0xff8a3a, 5, 5, 2); fglow.position.set(-3.9, 0.6, -4.2);
    heroShadow(fglow); scene.add(fglow); // hero shadow #1: the den flickers with real shadows
    tickers.push(t => { fglow.intensity = 4 + 1.6 * Math.sin(t * 8.2) * Math.sin(t * 3.1); });
    addCollider(-3.9, -4.66, 1.8, 0.6, 1.41);
    ['GARY?', 'NO'].forEach((nm, i) => {
      const stk = boxAt(0.14, 0.24, 0.06, std(i ? 0x7e3240 : 0x2a5a4a, { roughness: 0.9 }), -4.3 + i * 0.8, 1.2, -4.58);
      stk.rotation.x = 0.12;
      wallSign([nm], 0.16, 0.08, -4.3 + i * 0.8, 1.04, -4.55, 0, { fs: 10, pw: 64, ph: 32 });
    });
    // singing fish plaque (it flaps)
    const plq = boxAt(0.5, 0.24, 0.05, new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.7 }), 3.4, 1.9, -4.93);
    const fish = new THREE.Group();
    const fbody = sphAt(0.11, std(0x5a8a6a, { roughness: 0.5 }), 0, 0, 0, 1.6, 0.8, 0.5); fish.add(fbody); scene.remove(fbody); fish.add(fbody);
    const ftail = sphAt(0.06, std(0x4a7a5a), -0.18, 0, 0, 1, 1.3, 0.3); scene.remove(ftail); fish.add(ftail);
    const feye = sphAt(0.02, std(0x111111), 0.09, 0.03, 0.05); scene.remove(feye); fish.add(feye);
    fish.position.set(3.4, 1.9, -4.86); scene.add(fish);
    let fishOn = false;
    tickers.push(t => { // occasionally goes off. it counts as comedy.
      const on = Math.sin(t * 0.7) > 0.93;
      if (on && !fishOn) dispatchEvent(new CustomEvent('gd-funny', { detail: { x: 3.4, z: -4.9, v: 0.35 } }));
      fishOn = on;
      ftail.rotation.y = on ? Math.sin(t * 22) * 0.7 : 0;
    });
    wallSign(['BIG MOUTH BILLY', '(DO NOT TRUST)'], 0.44, 0.14, 3.4, 1.7, -4.92, 0, { fs: 9, pw: 160, ph: 48 });
    // posters
    wallSign(['LIVE', 'LAUGH', 'LURK'], 0.55, 0.7, -1.2, 2.1, -4.93, 0, { fs: 22, pw: 128, ph: 176, bg: '#3a2a3a', fg: '#e8c9d4' });
    wallSign(['EMPLOYEE OF THE MONTH', '[3 AMBER EYES]', 'THE MONSTER. AGAIN.'], 0.6, 0.44, 5.5, 1.95, -4.93, 0, { fs: 11, pw: 224, ph: 160 });
    // pizza box tower + newspaper stacks + bottles
    for (let i = 0; i < 9; i++) boxAt(0.42, 0.045, 0.42, junkM.pizza, -1.35 + Math.sin(i * 9) * 0.04, 0.03 + i * 0.05, -3.9 + Math.cos(i * 7) * 0.04, i * 0.3);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 5 - i; j++)
      boxAt(0.34, 0.16, 0.42, junkM.paper, 6.45 - i * 0.02, 0.08 + j * 0.165 + i * 0, -4.4 + i * 0.4, (i + j) * 0.2);
    addCollider(6.45, -4.2, 0.6, 1.2, 0.85);
    [[1.7, 0.86 + 0.09, 0.9], [-3.1, 0.6, -3.3], [-2.0, 0.02 + 0.09, -3.2], [-1.8, 0.09, -2.8]].forEach(([x, y, z], i) => {
      const bt = cylAt(0.035, 0.045, 0.18, std([0x3a5a2a, 0x5a3a2a, 0x2a3a5a][i % 3], { roughness: 0.25 }), x, y, z, 8);
      if (i === 3) { bt.rotation.z = Math.PI / 2; bt.position.y = 0.045; }
    });
    wallSign(['REGRET JUICE'], 0.14, 0.06, 1.7, 0.95, 0.98, 0, { fs: 8, pw: 96, ph: 32 });
    // bear trap by the rug. it's fine. it's decor.
    const trapM = std(0x3a3e42, { metalness: 0.7, roughness: 0.4 });
    cylAt(0.16, 0.16, 0.02, trapM, 2.9, 0.01, 2.6, 14);
    for (let i = 0; i < 7; i++) {
      const tooth = put(new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 6), trapM), 2.9 + Math.cos(i / 7 * Math.PI) * 0.14, 0.06, 2.6 + Math.sin(i / 7 * Math.PI) * 0.14);
      const tooth2 = put(new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 6), trapM), 2.9 - Math.cos(i / 7 * Math.PI) * 0.14, 0.06, 2.6 - Math.sin(i / 7 * Math.PI) * 0.14);
      tooth.rotation.x = 0.4; tooth2.rotation.x = -0.4;
    }
    wallSign(['FREE HUGS', '(STAND HERE)'], 0.3, 0.16, 2.9, 0.02, 2.95, 0, { fs: 9, pw: 128, ph: 64 }).rotation.x = -Math.PI / 2;
    cobweb(-6.6, -4.6, Math.PI / 4); cobweb(6.6, -4.6, -Math.PI / 4);
  }

  { // ---- HALL: museum of bad ancestors ----
    const brass = std(0xb89a4a, { metalness: 0.75, roughness: 0.3 });
    [[-9, -7], [-4.5, -7], [0, -7], [4.5, -7]].forEach(([x, z]) => {
      cylAt(0.035, 0.05, 0.95, brass, x, 0.48, z, 10);
      sphAt(0.05, brass, x, 0.98, z);
      addCollider(x, z, 0.25, 0.25, 1.0);
    });
    for (let i = 0; i < 3; i++) { // sagging velvet ropes
      const x0 = -9 + i * 4.5;
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 4.3, 6), std(0x7e2f3f, { roughness: 0.8 }));
      rope.rotation.z = Math.PI / 2; rope.position.set(x0 + 2.25, 0.82, -7);
      rope.scale.y = 1; scene.add(rope);
      const sag = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), std(0x7e2f3f)); // lazy sag knot
      sag.scale.set(1, 0.5, 1); sag.position.set(x0 + 2.25, 0.72, -7); scene.add(sag);
    }
    // suit of armor holding a plunger
    const arm2 = std(0x8a8f96, { metalness: 0.8, roughness: 0.35 });
    const ax = -11.6, az = -5.7;
    cylAt(0.22, 0.28, 0.1, arm2, ax, 0.05, az, 12);
    boxAt(0.34, 0.55, 0.24, arm2, ax, 0.62, az);
    sphAt(0.13, arm2, ax, 1.06, az);
    boxAt(0.3, 0.06, 0.3, arm2, ax, 1.17, az); // dumb hat brim
    [-1, 1].forEach(s => { cylAt(0.045, 0.05, 0.5, arm2, ax + 0.22 * s, 0.6, az, 8); });
    const plng = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 8), std(0xc9a878));
    stick.position.y = 0.35; plng.add(stick);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x7e3240, { roughness: 0.6 }));
    cup.rotation.x = Math.PI; cup.position.y = 0.02; plng.add(cup);
    plng.position.set(ax + 0.3, 0.9, az); scene.add(plng);
    addCollider(ax, az, 0.6, 0.6, 1.2);
    wallSign(['SIR CLOGSWORTH', 'HE DIED AS HE LIVED:', 'PLUNGING'], 0.6, 0.34, ax, 1.7, -5.08, Math.PI, { fs: 11, pw: 224, ph: 120 });
    wallSign(['DO NOT LICK', 'THE PORTRAITS'], 0.7, 0.3, 7.2, 2.3, -8.92, 0, { fs: 14, pw: 224, ph: 96, tilt: 0.04 });
    // the backwards portrait. he knows what he did.
    const bk = boxAt(0.9, 1.14, 0.05, std(0x6a5a3a, { roughness: 0.9 }), 1.2, 1.75, -8.9);
    bk.rotation.y = Math.PI;
    wallSign(['HE KNOWS WHAT HE DID'], 0.62, 0.14, 1.2, 1.0, -8.88, 0, { fs: 10, pw: 256, ph: 48, bg: '#c9a24a' });
    // wall crack with eyes near the fake door
    [[-0.05], [0.06]].forEach(([dx]) => {
      const eye = sphAt(0.022, new THREE.MeshStandardMaterial({ color: 0x201000, emissive: 0xffa02e, emissiveIntensity: 1.4 }), 8.6 + dx, 0.42, -8.93);
      eye.scale.y = 0.7;
    });
    wallSign(['(do not feed the wall)'], 0.5, 0.1, 8.6, 0.2, -8.92, 0, { fs: 9, pw: 224, ph: 32 });
    cobweb(-12.6, -8.6, Math.PI / 4); cobweb(9.6, -5.4, Math.PI + 0.6);
  }

  { // ---- MEAT KITCHEN: health code apocalypse ----
    // running sink into a basin + leaking ceiling pipe into bucket
    const steel = std(0x9aa0a4, { metalness: 0.8, roughness: 0.3 });
    boxAt(0.9, 0.8, 0.62, steel, -1.1, 0.4, -16.55);
    const basin = boxAt(0.7, 0.16, 0.44, std(0x6a7074, { metalness: 0.7, roughness: 0.4 }), -1.1, 0.82, -16.52);
    const water2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x4a6c74, transparent: true, opacity: 0.8, roughness: 0.1 }));
    water2.rotation.x = -Math.PI / 2; water2.position.set(-1.1, 0.9, -16.52); scene.add(water2);
    const fct = put(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8), steel), -1.1, 1.06, -16.72);
    fct.rotation.x = 0.5;
    waterJet(-1.1, 1.14, -16.6, 0.9);
    addCollider(-1.1, -16.55, 1.1, 0.85, 0.87);
    const pipe2 = put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 8), std(0x5a5a60, { metalness: 0.6 })), 0.4, H - 0.18, -13.6);
    pipe2.rotation.z = Math.PI / 2;
    const bucket = cylAt(0.16, 0.12, 0.28, std(0x4a5a6a, { metalness: 0.5, roughness: 0.5 }), 1.2, 0.14, -13.6, 12);
    dripper(1.2, H - 0.25, -13.6);
    // dish towers (climbable, wobbling would be too cruel)
    for (let i = 0; i < 12; i++) cylAt(0.14, 0.16, 0.035, std(i % 3 ? 0xc8c4b8 : 0x8a9a94, { roughness: 0.4 }), 2.6 + Math.sin(i * 5) * 0.02, 0.89 + i * 0.045, -16.5, 12);
    for (let i = 0; i < 16; i++) cylAt(0.16, 0.18, 0.04, std(i % 4 ? 0xc8c4b8 : 0xb8a894, { roughness: 0.4 }), 4.4 + Math.sin(i * 3) * 0.03, 0.02 + i * 0.05, -12.2 + Math.cos(i * 5) * 0.03, 14);
    addCollider(4.4, -12.2, 0.5, 0.5, 0.85);
    // canned goods pyramid
    for (let lv = 0; lv < 4; lv++) for (let j = 0; j <= 3 - lv; j++)
      cylAt(0.07, 0.07, 0.16, std(0xb84a3a, { roughness: 0.4, metalness: 0.3 }), -2.5 + j * 0.16 + lv * 0.08, 0.08 + lv * 0.17, -10.2, 10);
    wallSign(['CREAM OF BEEF'], 0.3, 0.08, -2.5, 0.75, -10.05, 0, { fs: 9, pw: 160, ph: 32 });
    // garbage pile + flies
    [[-0.4, -9.8], [0.1, -9.6], [-0.2, -10.15]].forEach(([x, z], i) => sphAt(0.28, junkM.dark, x, 0.2, z, 1.2, 0.8, 1).rotation.y = i);
    addCollider(-0.2, -9.9, 1.1, 0.9, 0.4);
    const flies = [];
    for (let i = 0; i < 6; i++) { const f = sphAt(0.012, std(0x111111), 0, 0, 0); flies.push(f); }
    tickers.push(t => flies.forEach((f, i) => f.position.set(-0.2 + Math.sin(t * 3.1 + i * 2) * 0.35, 0.62 + Math.sin(t * 5.7 + i) * 0.18, -9.9 + Math.cos(t * 2.3 + i * 2) * 0.35)));
    // wall: utensil rack, meat chart of THE MONSTER, incident counter, grade F
    const rackBar = put(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), steel), 3.2, 2.1, -16.93);
    rackBar.rotation.z = Math.PI / 2;
    [-0.6, -0.2, 0.2, 0.6].forEach((dx, i) => {
      if (i === 2) { // pan
        const pan = cylAt(0.12, 0.12, 0.03, std(0x2a2a2e, { metalness: 0.6 }), 3.2 + dx, 1.85, -16.9, 14);
        pan.rotation.x = Math.PI / 2;
      } else {
        const ld = boxAt(0.05, 0.3, 0.02, steel, 3.2 + dx, 1.9, -16.9);
        ld.rotation.z = 0.1 * (i - 1);
      }
    });
    const chart = canvasPlane(0.85, 1.05, 176, 224, (c, w, h) => {
      c.fillStyle = '#e8dfc8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#241708'; c.lineWidth = 5; c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = '#3a2a3a';
      c.beginPath(); c.ellipse(w / 2, h * 0.52, 46, 62, 0, 0, 7); c.fill(); // monster silhouette
      c.beginPath(); c.arc(w / 2, h * 0.24, 26, 0, 7); c.fill();
      [[-10, -4], [10, -4], [0, -12]].forEach(([dx, dy]) => { c.fillStyle = '#ffa02e'; c.beginPath(); c.arc(w / 2 + dx, h * 0.24 + dy, 3, 0, 7); c.fill(); });
      c.strokeStyle = '#7e2f3f'; c.lineWidth = 2;
      c.font = 'bold 11px Courier New'; c.fillStyle = '#7e2f3f'; c.textAlign = 'center';
      [[0.38, 'SNUGGLE'], [0.55, 'BRISKET'], [0.72, 'REGION OF MYSTERY']].forEach(([fy, lb]) => {
        c.beginPath(); c.moveTo(w * 0.18, h * fy); c.lineTo(w * 0.82, h * fy); c.stroke();
        c.fillText(lb, w / 2, h * fy - 4);
      });
      c.font = 'bold 13px Courier New'; c.fillStyle = '#241708';
      c.fillText('KNOW YOUR MONSTER', w / 2, 20);
      c.fillText('(EDUCATIONAL)', w / 2, h - 12);
    }, { basic: true });
    chart.position.set(-2.94, 1.9, -12.4); chart.rotation.y = Math.PI / 2; scene.add(chart);
    wallSign(['DAYS SINCE', 'LAST INCIDENT:', '-3'], 0.6, 0.5, 4.94, 2.0, -14.6, -Math.PI / 2, { fs: 14, pw: 192, ph: 160 });
    wallSign(['HEALTH INSPECTION', 'GRADE: F', '(F FOR FANTASTIC)'], 0.55, 0.4, 4.94, 1.2, -11.2, -Math.PI / 2, { fs: 11, pw: 192, ph: 128, tilt: -0.06 });
    rat([[-2.6, -9.4], [4.2, -9.4], [4.2, -10.6], [-2.6, -10.4]]);
    cobweb(-2.6, -16.6, Math.PI / 4);
  }

  { // ---- BATHROOM OF DOOM: biohazard spa ----
    // running shower in the corner
    const steel2 = std(0x9aa0a4, { metalness: 0.8, roughness: 0.3 });
    const shx = 6.0, shz = -10.0;
    cylAt(0.03, 0.03, 2.2, steel2, shx, 1.1, shz, 8);
    const head2 = put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.08, 12), steel2), shx + 0.18, 2.16, shz + 0.18);
    head2.rotation.z = -0.5;
    for (let i = 0; i < 3; i++) waterJet(shx + 0.22 + (i - 1) * 0.07, 2.1, shz + 0.22 + (i - 1) * 0.07, 0.02, 0.012);
    const wet = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18),
      new THREE.MeshStandardMaterial({ color: 0x3a4c50, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.85 }));
    wet.rotation.x = -Math.PI / 2; wet.position.set(shx + 0.25, 0.014, shz + 0.25); scene.add(wet);
    // tub faucet now runs
    waterJet(5.95, 0.72, -15.1, 0.44);
    // TP pyramid to the ceiling (climbable!)
    const tpM = std(0xe8e4dc, { roughness: 0.7 });
    for (let lv = 0; lv < 8; lv++) for (let j = 0; j <= Math.max(0, 3 - (lv / 3 | 0)); j++)
      cylAt(0.11, 0.11, 0.24, tpM, 8.9 - j * 0.24 + (lv % 2) * 0.1, 0.12 + lv * 0.25, -13.0 + (lv % 2) * 0.05, 12);
    addCollider(8.75, -13.0, 1.0, 0.55, 2.1);
    wallSign(['THE THRONE OF SOFTNESS', 'DO NOT WITHDRAW'], 0.6, 0.24, 9.92, 2.5, -13.0, -Math.PI / 2, { fs: 10, pw: 224, ph: 80 });
    // plunger collection
    for (let i = 0; i < 5; i++) {
      const px2 = 6.6 + i * 0.35;
      cylAt(0.014, 0.014, 0.4 + i * 0.08, std(0xc9a878), px2, 0.24 + i * 0.04, -16.75, 8);
      const cup2 = new THREE.Mesh(new THREE.SphereGeometry(0.06 + i * 0.012, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x7e3240, { roughness: 0.6 }));
      cup2.rotation.x = Math.PI; cup2.position.set(px2, 0.05, -16.75); scene.add(cup2);
    }
    wallSign(['THE BOYS'], 0.4, 0.12, 7.3, 0.85, -16.93, 0, { fs: 12, pw: 128, ph: 40 });
    // medicine cabinet, open, spilled pills
    boxAt(0.5, 0.4, 0.1, std(0xc8ccc8, { roughness: 0.4 }), 9.93, 2.25, -10.0);
    const cabDoor = boxAt(0.08, 0.4, 0.42, std(0xc8ccc8, { roughness: 0.4 }), 9.8, 2.25, -9.7);
    cabDoor.rotation.y = 0.8;
    wallSign(['LAUGH SUPPRESSANTS', '(EXPIRED 1997)'], 0.42, 0.18, 9.9, 1.95, -10.0, -Math.PI / 2, { fs: 9, pw: 192, ph: 64 });
    for (let i = 0; i < 8; i++) sphAt(0.018, std(i % 2 ? 0xd84040 : 0xe8e4dc, { roughness: 0.4 }), 9.2 + Math.sin(i * 7) * 0.25, 0.85, -10.1 + Math.cos(i * 5) * 0.2);
    // drain thing (it lives here now)
    cylAt(0.1, 0.1, 0.015, std(0x2a2e32, { metalness: 0.6 }), 7.4, 0.008, -12.2, 14);
    const tuft = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const hair = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.16, 4, 6), std(0x1a1c1e, { roughness: 0.95 }));
      hair.position.set(Math.sin(i * 2) * 0.04, 0.1, Math.cos(i * 2) * 0.04);
      hair.rotation.z = Math.sin(i * 3) * 0.5; tuft.add(hair);
    }
    [-1, 1].forEach(s => {
      const ey = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(0xf7f7f2, { roughness: 0.3 }));
      ey.position.set(0.035 * s, 0.16, 0.03); tuft.add(ey);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), std(0x14181c));
      pu.position.set(0.035 * s, 0.16, 0.055); tuft.add(pu);
    });
    tuft.position.set(7.4, 0, -12.2); scene.add(tuft);
    tickers.push(t => { tuft.position.y = -0.06 + 0.07 * Math.sin(t * 0.9); tuft.rotation.y = Math.sin(t * 0.5) * 0.4; });
    speakers.push({ name: 'THE DRAIN THING', x: 7.4, z: -12.2, y: 0.7, radius: 2.2, lines: [
      'i live here now.', 'the hair? mine. all of it. even yours.', 'flush nothing. i see everything.',
    ] });
    // goo handprints + crooked signage
    [[6.4, 1.3, -16.92, 0], [9.91, 1.5, -14.2, -Math.PI / 2]].forEach(([x, y, z, ry]) => {
      const hp = canvasPlane(0.26, 0.3, 48, 56, (c) => {
        c.fillStyle = 'rgba(90,160,60,.75)';
        c.beginPath(); c.ellipse(24, 34, 12, 16, 0, 0, 7); c.fill();
        for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(10 + i * 7, 14 - Math.sin(i / 4 * 3) * 6, 3.4, 8, 0, 0, 7); c.fill(); }
      }, { basic: true, transparent: true });
      hp.position.set(x, y, z); hp.rotation.y = ry; scene.add(hp);
    });
    wallSign(['WASH YOUR', 'DAMN HANDS'], 0.5, 0.3, 8.4, 2.3, -16.93, 0, { fs: 14, pw: 160, ph: 96, tilt: 0.12 });
    wallSign(['THINKING CHAIR'], 0.5, 0.12, 9.3, 1.35, -16.5, Math.PI, { fs: 11, pw: 192, ph: 40 });
  }

  { // ---- NURSERY: wrongness, escalated ----
    // jack-in-the-box: cranks itself, POPS when you get close
    const jb2 = new THREE.Group(); jb2.position.set(-9.4, 0, -10.6);
    const jbox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8, color: 0xc9909a }));
    jbox.position.y = 0.21; jb2.add(jbox);
    const lid2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42),
      new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8, color: 0xc9909a }));
    lid2.position.set(0, 0.44, 0); jb2.add(lid2);
    const crank = new THREE.Group(); crank.position.set(0.24, 0.21, 0);
    const cr1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), std(0x3a3e42, { metalness: 0.6 }));
    cr1.rotation.z = Math.PI / 2; cr1.position.x = 0.06; crank.add(cr1);
    const cr2 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0xd8a030));
    cr2.position.set(0.12, 0.07, 0); crank.add(cr2);
    jb2.add(crank);
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8),
      std(0x8a8f96, { metalness: 0.7, roughness: 0.4 }));
    spring.position.y = 0.45; spring.scale.y = 0.05; jb2.add(spring);
    const clown = new THREE.Group(); clown.position.y = 0.48; clown.scale.setScalar(0.01);
    const chead2 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), std(0xf0e8e0, { roughness: 0.6 }));
    clown.add(chead2);
    const cnose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std(0xd42222)); cnose.position.set(0, -0.01, 0.12); clown.add(cnose);
    [-1, 1].forEach(s => {
      const ce = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), std(0x14181c)); ce.position.set(0.05 * s, 0.04, 0.11); clown.add(ce);
    });
    const chat = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 10), std(0x9040c8)); chat.position.y = 0.16; clown.add(chat);
    jb2.add(clown);
    jb2.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(jb2);
    addCollider(-9.4, -10.6, 0.6, 0.6, 0.46);
    let popped = false;
    tickers.push((t, dt, p) => {
      const d = Math.hypot(p.x + 9.4, p.z + 10.6);
      crank.rotation.x += dt * (popped ? 0 : 2.2);
      if (!popped && d < 2.2) {
        popped = true; sfx.sting();
        if (window.GD3) window.GD3.shake = 0.5;
        dispatchEvent(new CustomEvent('gd-funny', { detail: { x: -9.4, z: -10.6, v: 0.6 } }));
      }
      const target = popped ? 1 : 0.05;
      spring.scale.y += (target - spring.scale.y) * Math.min(1, dt * 14);
      spring.position.y = 0.42 + spring.scale.y * 0.25;
      const cs = popped ? 1 : 0.01;
      clown.scale.setScalar(clown.scale.x + (cs - clown.scale.x) * Math.min(1, dt * 14));
      clown.position.y = 0.44 + spring.scale.y * 0.5;
      lid2.position.z = popped ? -0.18 : 0; lid2.rotation.x = popped ? -1.2 : 0;
      if (popped && d > 4.5) popped = false; // re-cranks when you leave. sleep well.
    });
    // block tower to climb + stuffed pile + timeout teddy
    for (let i = 0; i < 8; i++) boxAt(0.26, 0.26, 0.26,
      std([0xc9705a, 0x7aa860, 0x6a88c0, 0xd8a030][i % 4], { roughness: 0.7 }),
      -5.2 + Math.sin(i * 9) * 0.03, 0.13 + i * 0.265, -16.2 + Math.cos(i * 7) * 0.03, i * 0.35);
    addCollider(-5.2, -16.2, 0.5, 0.5, 2.15);
    [[-8.6, -16.4, 0xc9909a], [-8.2, -16.2, 0x8a9ac9], [-8.5, -15.9, 0xa8c98a]].forEach(([x, z, cl]) => {
      sphAt(0.16, std(cl, { roughness: 0.95 }), x, 0.13, z, 1, 1.1, 0.9);
      sphAt(0.1, std(cl, { roughness: 0.95 }), x, 0.32, z);
    });
    const timeout = buildTeddy();
    timeout.group.position.set(-12.6, 0, -16.5); timeout.group.rotation.y = Math.PI * 0.9; // facing the corner
    scene.add(timeout.group);
    wallSign(['HE BIT FIRST'], 0.4, 0.12, -12.6, 1.3, -16.93, 0, { fs: 10, pw: 160, ph: 40 });
    // wall wrongness
    const mural = canvasPlane(1.5, 0.9, 224, 136, (c, w, h) => {
      c.strokeStyle = 'rgba(60,30,30,.8)'; c.lineWidth = 4; c.lineCap = 'round';
      const stick = (x, big) => {
        c.beginPath(); c.arc(x, 40, big ? 16 : 10, 0, 7); c.stroke();
        c.beginPath(); c.moveTo(x, 40 + (big ? 16 : 10)); c.lineTo(x, 95); c.stroke();
        c.beginPath(); c.moveTo(x - 14, 70); c.lineTo(x + 14, 70); c.stroke();
        c.beginPath(); c.moveTo(x, 95); c.lineTo(x - 10, 120); c.moveTo(x, 95); c.lineTo(x + 10, 120); c.stroke();
      };
      stick(40, true); stick(90, false); stick(130, false);
      c.strokeStyle = 'rgba(120,20,20,.9)'; c.lineWidth = 7;
      for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(160 + Math.random() * 40, 20 + Math.random() * 110); c.lineTo(160 + Math.random() * 40, 20 + Math.random() * 110); c.stroke(); }
      c.font = 'bold 12px Courier New'; c.fillStyle = 'rgba(60,30,30,.9)';
      c.fillText('MY FAMILY', 60, 15);
    }, { basic: true, transparent: true });
    mural.position.set(-7.5, 1.4, -16.92); scene.add(mural);
    wallSign(["BABY'S FIRST WORDS:", '"BEHIND YOU"'], 0.7, 0.3, -4.4, 2.2, -16.92, 0, { fs: 11, pw: 256, ph: 96 });
    // growth chart, concerning
    const growth = canvasPlane(0.3, 2.4, 48, 384, (c, w, h) => {
      c.fillStyle = '#e8dfc8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#241708'; c.lineWidth = 2;
      c.font = 'bold 8px Courier New'; c.fillStyle = '#7e2f3f';
      [[0.92, 'GERALD 1'], [0.8, 'GERALD 5'], [0.55, 'GERALD 12'], [0.18, 'GERALD 47'], [0.04, 'GERALD NOW']].forEach(([fy, lb]) => {
        c.beginPath(); c.moveTo(4, h * fy); c.lineTo(w - 4, h * fy); c.stroke();
        c.fillText(lb, 5, h * fy - 3);
      });
    }, { basic: true });
    growth.position.set(-12.93, 1.25, -14.4); growth.rotation.y = Math.PI / 2; scene.add(growth);
    cobweb(-12.6, -16.6, Math.PI / 4);
  }

  { // ---- DISCO CRYPT: an actual club now ----
    // DJ BONES: booth, spinning turntables, head-bobbing skeleton
    const booth = boxAt(1.6, 0.9, 0.6, new THREE.MeshStandardMaterial({ map: stoneWallTex, roughness: 0.8, color: 0x8a8a96 }), 11.5, 0.45, -4.4);
    addCollider(11.5, -4.4, 1.8, 0.8, 0.95);
    const deck = boxAt(1.2, 0.06, 0.4, std(0x1c1c22, { roughness: 0.4 }), 11.5, 0.93, -4.35);
    const discs = [];
    [-0.35, 0.35].forEach(dx => {
      const disc = cylAt(0.14, 0.14, 0.02, std(0x2a2a30, { roughness: 0.3 }), 11.5 + dx, 0.975, -4.35, 16);
      const dot = sphAt(0.02, std(0xd42222), 11.5 + dx + 0.08, 0.99, -4.35);
      disc.userData.dot = dot; discs.push({ disc, dot, dx });
    });
    tickers.push((t, dt) => discs.forEach(({ dot, dx }) => {
      dot.position.x = 11.5 + dx + Math.cos(t * 6) * 0.08;
      dot.position.z = -4.35 + Math.sin(t * 6) * 0.08;
    }));
    const dj = buildSkeleton();
    dj.group.position.set(11.5, 0, -4.75); dj.group.rotation.y = Math.PI; scene.add(dj.group);
    tickers.push(t => { dj.group.position.y = Math.abs(Math.sin(t * 4.8)) * 0.06; }); // head bob whole-body edition
    speakers.push({ name: 'DJ BONES', x: 11.5, z: -4.6, y: 1.7, radius: 3.0, lines: [
      'requests? no. the song is disco. forever.',
      'this next one goes out to everyone who is dead.',
      'I HAVE BEEN SPINNING FOR 400 YEARS.',
    ] });
    // speaker stacks TO THE CEILING (climbable) that pulse with the beat
    [[8.2, -4.2], [15.2, 3.8]].forEach(([x, z]) => {
      const stack = [];
      for (let i = 0; i < 3; i++) {
        const spk = boxAt(0.85, 0.85, 0.6, std(0x16161a, { roughness: 0.7 }), x, 0.43 + i * 0.87, z);
        cylAt(0.26, 0.26, 0.02, std(0x2e2e34, { roughness: 0.5 }), x, 0.43 + i * 0.87, z + 0.31, 16).rotation.x = Math.PI / 2;
        stack.push(spk);
      }
      addCollider(x, z, 1.0, 0.75, 2.6);
      tickers.push(t => stack.forEach((s, i) => { const b = 1 + Math.max(0, Math.sin(t * 4.8 + i)) * 0.035; s.scale.set(b, 1, b); }));
    });
    // neon-ish sign + skull shelf + crude tombstones + party trash
    const neon = canvasPlane(2.0, 0.5, 256, 64, (c, w, h) => {
      c.fillStyle = '#0a0a12'; c.fillRect(0, 0, w, h);
      c.font = 'bold 30px Courier New'; c.textAlign = 'center';
      c.shadowColor = '#ff4488'; c.shadowBlur = 14;
      c.fillStyle = '#ff8ac8'; c.fillText('CRYPT NITE', w / 2, 30);
      c.font = 'bold 14px Courier New'; c.fillStyle = '#8ae8ff'; c.shadowColor = '#44ddff';
      c.fillText('EVERY NITE. FOREVER NITE.', w / 2, 52);
    }, { basic: true });
    neon.position.set(11.5, 2.65, -4.92); scene.add(neon);
    tickers.push(t => { neon.material.opacity = Math.sin(t * 11) > -0.92 ? 1 : 0.25; neon.material.transparent = true; });
    for (let i = 0; i < 6; i++) { // skull niche shelf
      const nx = 15.93, nz = 0.6 + (i % 3) * 0.7, ny = 1.4 + ((i / 3) | 0) * 0.6;
      boxAt(0.1, 0.5, 0.6, new THREE.MeshStandardMaterial({ map: stoneWallTex, color: 0x55555e }), nx, ny - 0.28, nz);
      const sk = sphAt(0.1, std(0xd8d4c6, { roughness: 0.6 }), nx - 0.08, ny, nz, 0.95, 1.05, 1);
      if (i === 4) boxAt(0.16, 0.05, 0.04, std(0x111111, { roughness: 0.2 }), nx - 0.16, ny + 0.02, nz); // sunglasses guy
    }
    [['HERE LIES GARY', 'DIED DOING WHAT', 'HE LOVED (NOTHING)'], ['RESERVED', '(FOR YOU)'], ['DO NOT', 'DIG']].forEach((lines, i) => {
      const tx = 9.0 + i * 1.4, tz = 1.8 + (i % 2) * 0.8;
      const stone = boxAt(0.6, 0.7, 0.12, new THREE.MeshStandardMaterial({ map: stoneWallTex, color: 0x9a9aa4 }), tx, 0.35, tz, (i - 1) * 0.2);
      stone.rotation.z = (i - 1) * 0.06;
      wallSign(lines, 0.5, 0.34, tx, 0.42, tz + 0.07, (i - 1) * 0.2, { fs: 9, pw: 192, ph: 128, bg: '#b8b8c0' });
      addCollider(tx, tz, 0.7, 0.3, 0.7);
    });
    for (let i = 0; i < 8; i++) cylAt(0.035, 0.028, 0.09, std(0xc03030, { roughness: 0.5 }), 9 + rnd() * 6, 0.045, -3 + rnd() * 6, 10);
    wallSign(['BYOB', '(BRING YOUR OWN BONES)'], 0.7, 0.24, 13.5, 2.2, 4.92, Math.PI, { fs: 10, pw: 256, ph: 80 });
    cobweb(15.6, -4.6, -Math.PI / 4);
  }

  { // ---- GNOME YARD: cursed garden party ----
    // THE FOUNTAIN: gnome statue, peeing into the basin. classic. timeless.
    const stone2 = new THREE.MeshStandardMaterial({ map: stoneWallTex, roughness: 0.85, color: 0xa8a8b0 });
    const fx = -1.8, fz = 11.3;
    cylAt(1.05, 1.15, 0.35, stone2, fx, 0.17, fz, 20);
    const fwater = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20),
      new THREE.MeshStandardMaterial({ color: 0x3a6c74, transparent: true, opacity: 0.8, roughness: 0.1 }));
    fwater.rotation.x = -Math.PI / 2; fwater.position.set(fx, 0.3, fz); scene.add(fwater);
    cylAt(0.14, 0.18, 0.75, stone2, fx, 0.65, fz, 10);
    const statue = buildGnome(1.3);
    statue.group.position.set(fx, 1.0, fz);
    statue.group.traverse(o => { if (o.isMesh) o.material = stone2; }); // stone gnome
    scene.add(statue.group);
    waterJet(fx + 0.12, 1.28, fz + 0.14, 0.32, 0.014);
    addCollider(fx, fz, 2.3, 2.3, 0.35);
    wallSign(['FOUNTAIN OF THE', 'GNOME KING', '(DO NOT DRINK. HE AIMS.)'], 0.7, 0.34, fx, 0.62, fz + 1.25, 0, { fs: 10, pw: 256, ph: 112 });
    // grill + banner
    const kettle = sphAt(0.34, std(0x1c1c22, { roughness: 0.5, metalness: 0.4 }), -0.2, 0.55, 6.6, 1, 0.75, 1);
    cylAt(0.02, 0.02, 0.5, std(0x3a3e42, { metalness: 0.6 }), -0.2, 0.25, 6.6, 6);
    const susMeat = sphAt(0.13, std(0xc06a5a, { roughness: 0.6 }), -0.2, 0.78, 6.6, 1.4, 0.6, 1);
    addCollider(-0.2, 6.6, 0.75, 0.75, 0.9);
    wallSign(['GNOME ROAST 2026', '(THEY KNOW)'], 1.2, 0.3, -0.2, 2.2, 5.15, 0, { fs: 13, pw: 320, ph: 80 });
    // flamingo flock, one down
    [[-3.3, 6.3, 0], [-2.7, 6.9, 0.9], [2.5, 11.8, -0.7], [1.2, 13.2, 9]].forEach(([x, z, ry], i) => {
      const down = i === 3;
      const fg = new THREE.Group();
      const fb = sphAt(0.11, std(0xf090b8, { roughness: 0.6 }), 0, down ? 0.12 : 0.55, 0, 1.3, 0.9, 1); scene.remove(fb); fg.add(fb);
      const fn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 6), std(0xf090b8));
      fn.position.set(0.1, down ? 0.2 : 0.72, 0); fn.rotation.z = -0.5; fg.add(fn);
      const fh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), std(0xf090b8)); fh.position.set(0.22, down ? 0.3 : 0.85, 0); fg.add(fh);
      const fk = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 6), std(0x2a2a2e)); fk.rotation.z = -Math.PI / 2; fk.position.set(0.28, down ? 0.29 : 0.84, 0); fg.add(fk);
      if (!down) [0.06, -0.04].forEach(dx => { const lg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 4), std(0x2a2a2e)); lg2.position.set(dx, 0.24, 0); fg.add(lg2); });
      fg.position.set(x, 0, z); fg.rotation.y = ry; if (down) fg.rotation.z = 1.4;
      fg.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(fg);
    });
    // scarecrow + crow
    const scx = -5.6, scz = 12.6;
    cylAt(0.03, 0.03, 1.7, std(0x6a5236), scx, 0.85, scz, 6);
    const scArm = put(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), std(0x6a5236)), scx, 1.35, scz);
    scArm.rotation.z = Math.PI / 2;
    boxAt(0.4, 0.5, 0.22, std(0x7e5a3a, { roughness: 0.95 }), scx, 1.15, scz);
    const scHead = sphAt(0.14, std(0xc9b088, { roughness: 0.9 }), scx, 1.62, scz);
    [-1, 1].forEach(s => sphAt(0.025, std(0x14181c), scx + 0.05 * s, 1.66, scz + 0.12));
    const crow = sphAt(0.07, std(0x14161a, { roughness: 0.8 }), scx + 0.45, 1.44, scz, 1.3, 0.9, 1);
    sphAt(0.04, std(0x14161a), scx + 0.55, 1.52, scz);
    addCollider(scx, scz, 0.5, 0.5, 1.7);
    speakers.push({ name: 'THE SCARECROW', x: scx, z: scz, y: 2.0, radius: 2.6, lines: [
      'the crows and i have an arrangement.',
      'i am not here to scare crows.',
      'the gnomes fear ME. remember that.',
    ] });
    // bug zapper + firewood
    const zap = boxAt(0.16, 0.34, 0.16, std(0x2a2e32, { metalness: 0.5 }), 2.6, 2.5, 6.2);
    const zapGlow = boxAt(0.06, 0.26, 0.06, new THREE.MeshStandardMaterial({ color: 0x8a60ff, emissive: 0x9a70ff, emissiveIntensity: 1.2 }), 2.6, 2.5, 6.2);
    cylAt(0.01, 0.01, 0.5, std(0x333333), 2.6, 2.92, 6.2, 4);
    tickers.push(t => { zapGlow.material.emissiveIntensity = (Math.sin(t * 1.9) > 0.97) ? 6 : 1.1; });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4 - i; j++) {
      const log = cylAt(0.09, 0.09, 0.6, std(0x5a4028, { roughness: 0.95 }), -6.2 + j * 0.19 + i * 0.1, 0.09 + i * 0.17, 5.9, 8);
      log.rotation.x = Math.PI / 2;
    }
    addCollider(-6.0, 5.9, 0.9, 0.7, 0.6);
    // glowing mushroom ring
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      cylAt(0.02, 0.03, 0.09, std(0xd8d4c6), -3.9 + Math.cos(a) * 0.6, 0.045, 9.2 + Math.sin(a) * 0.6, 6);
      sphAt(0.05, new THREE.MeshStandardMaterial({ color: 0x4a7a8a, emissive: 0x5ad8e8, emissiveIntensity: 0.5 }), -3.9 + Math.cos(a) * 0.6, 0.1, 9.2 + Math.sin(a) * 0.6, 1, 0.6, 1);
    }
  }

  { // ---- BASEMENT: murder workshop (he's on break) ----
    // pegboard of missing tools + rubber duck
    const peg = canvasPlane(1.6, 1.0, 224, 144, (c, w, h) => {
      c.fillStyle = '#8a7a5a'; c.fillRect(0, 0, w, h);
      for (let y = 10; y < h; y += 14) for (let x = 10; x < w; x += 14) { c.fillStyle = '#6a5a40'; c.beginPath(); c.arc(x, y, 1.5, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(40,30,20,.8)'; c.lineWidth = 3;
      c.strokeRect(20, 30, 30, 70);   // missing saw outline
      c.beginPath(); c.arc(90, 50, 20, 0, 7); c.stroke(); c.strokeRect(84, 70, 12, 40); // missing hammer
      c.strokeRect(140, 35, 14, 80);  // missing Large Knife
      c.font = 'bold 10px Courier New'; c.fillStyle = '#3a2a1a';
      c.fillText('WHERE?', 22, 25); c.fillText('WHERE??', 80, 25); c.fillText('DO NOT ASK', 130, 25);
    }, { basic: true });
    peg.position.set(6.8, 1.8, 13.93); peg.rotation.y = Math.PI; scene.add(peg);
    const duckP = buildDuck(0.7);
    duckP.group.position.set(7.45, 1.45, 13.85); duckP.group.rotation.y = Math.PI; scene.add(duckP.group);
    // leaking ceiling pipes + spinning valve
    const pipeM = std(0x5a5a60, { metalness: 0.6, roughness: 0.45 });
    const bp1 = put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8.6, 8), pipeM), 7.5, H - 0.3, 9.5);
    bp1.rotation.z = Math.PI / 2;
    const bp2 = put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 8), pipeM), 5.0, H - 0.5, 11.5);
    bp2.rotation.x = Math.PI / 2;
    const valve2 = put(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 14), std(0xa03030, { metalness: 0.5, roughness: 0.4 })), 6.4, H - 0.52, 9.5);
    tickers.push((t, dt) => { valve2.rotation.z += dt * 0.4; });
    dripper(4.6, H - 0.55, 8.2); dripper(9.8, H - 0.4, 11.6);
    // box stacks to the ceiling: XMAS, XMAS?, TEETH
    const cardM = std(0xa8845a, { roughness: 0.95 });
    [['XMAS', 0], ['XMAS?', 0.9], ['TEETH', 1.8]].forEach(([lb, dy], i) => {
      boxAt(0.8, 0.8, 0.8, cardM, 3.7, 0.4 + dy, 6.8 + i * 0.05, i * 0.12);
      wallSign([lb], 0.5, 0.16, 3.7, 0.62 + dy, 7.23 + i * 0.05, i * 0.12, { fs: 14, pw: 160, ph: 48, bg: '#a8845a', border: '#5a4028' });
    });
    addCollider(3.7, 6.8, 0.95, 0.95, 2.6);
    for (let lv = 0; lv < 3; lv++) for (let j = 0; j <= 2 - lv; j++)
      cylAt(0.11, 0.11, 0.24, std([0x7e3240, 0x2a5a4a, 0x8a8f96][(lv + j) % 3], { metalness: 0.4, roughness: 0.5 }), 11.4 - j * 0.24 + lv * 0.12, 0.12 + lv * 0.25, 13.4, 12);
    // washer + dryer. one of them is having a moment.
    const applM = std(0xc4cac4, { roughness: 0.35, metalness: 0.15 });
    const washer = boxAt(0.75, 0.95, 0.7, applM, 10.9, 0.48, 8.1);
    cylAt(0.22, 0.22, 0.03, std(0x2a2e32, { roughness: 0.3 }), 10.9, 0.52, 8.47, 16).rotation.x = Math.PI / 2;
    const dryer = boxAt(0.75, 0.95, 0.7, applM, 10.0, 0.48, 8.1);
    cylAt(0.22, 0.22, 0.03, std(0x2a2e32, { roughness: 0.3 }), 10.0, 0.52, 8.47, 16).rotation.x = Math.PI / 2;
    addCollider(10.45, 8.1, 1.8, 0.85, 0.95);
    tickers.push(t => {
      washer.position.x = 10.9 + Math.sin(t * 37) * 0.012;
      washer.position.y = 0.48 + Math.abs(Math.sin(t * 41)) * 0.012;
    });
    wallSign(['DO NOT OPEN', '(IT KNOWS THE SCHEDULE)'], 0.6, 0.24, 10.9, 1.25, 8.5, 0, { fs: 9, pw: 224, ph: 80, tilt: -0.05 });
    // furnace glow + tally marks + family photo
    boxAt(1.0, 1.2, 0.2, std(0x3a3634, { roughness: 0.7, metalness: 0.3 }), 4.6, 0.6, 13.85);
    const grate = canvasPlane(0.7, 0.5, 96, 64, (c, w, h) => {
      c.fillStyle = '#ff7a2e'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1a1210';
      for (let i = 0; i < 5; i++) c.fillRect(i * 20 + 4, 0, 12, h);
    }, { basic: true, transparent: false });
    grate.position.set(4.6, 0.6, 13.74); grate.rotation.y = Math.PI; scene.add(grate);
    tickers.push(t => { grate.material.color.setHSL(0.06, 1, 0.45 + 0.15 * Math.sin(t * 5.3) * Math.sin(t * 2.2)); });
    const tally = canvasPlane(0.8, 0.5, 128, 80, (c, w, h) => {
      c.strokeStyle = 'rgba(220,210,190,.7)'; c.lineWidth = 2;
      for (let g2 = 0; g2 < 6; g2++) for (let i = 0; i < 4; i++) {
        const x = 12 + g2 * 19 + i * 3.5, y = 14 + (g2 % 2) * 30;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 20); c.stroke();
      }
      c.font = 'bold 9px Courier New'; c.fillStyle = 'rgba(220,210,190,.8)';
      c.fillText('DAYS ON BREAK', 24, 74);
    }, { basic: true, transparent: true });
    tally.position.set(11.93, 1.1, 10.4); tally.rotation.y = -Math.PI / 2; scene.add(tally);
    const photo = canvasPlane(0.34, 0.28, 64, 56, (c, w, h) => {
      c.fillStyle = '#e8dfc8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3a2a3a';
      [[18, 30, 9], [34, 32, 7], [46, 34, 5]].forEach(([x, y, r]) => {
        c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
        c.fillStyle = '#ffa02e'; c.fillRect(x - 3, y - 3, 2, 2); c.fillRect(x + 1, y - 3, 2, 2); c.fillStyle = '#3a2a3a';
      });
      c.font = 'bold 7px Courier New'; c.fillStyle = '#7e2f3f'; c.fillText('MY BOYS', 20, 52);
    }, { basic: true });
    photo.position.set(11.93, 1.6, 12.0); photo.rotation.y = -Math.PI / 2; photo.rotation.z = 0.08; scene.add(photo);
    rat([[4.2, 5.8], [11.2, 5.8], [11.2, 7.2], [4.6, 7.4]]);
    cobweb(3.4, 13.6, Math.PI * 0.75); cobweb(11.6, 5.4, -Math.PI / 4);
    // fuse box (lights-out sabotage fix point)
    boxAt(0.1, 0.6, 0.45, std(0x5a6a5a, { metalness: 0.5, roughness: 0.5 }), 3.12, 1.35, 9.0);
    for (let i = 0; i < 3; i++) boxAt(0.04, 0.08, 0.05, std(i === 1 ? 0xc03030 : 0x2a2e32), 3.18, 1.2 + i * 0.14, 8.9 + (i % 2) * 0.2);
    wallSign(['FUSES', '(ANGRY)'], 0.4, 0.2, 3.12, 1.85, 9.0, Math.PI / 2, { fs: 11, pw: 128, ph: 64 });
  }

  // ---------- THE SNUG: secret room behind the den bookshelf ----------
  floorRect(-9.5, -2.7, -7, -0.5, stoneFloorTex, 0.45);
  ceilRect(-9.5, -2.7, -7, -0.5, stoneWallTex, 0.3, 0x606068);
  wallRun(S.crypt, [-9.5, -2.7], [-7, -2.7], '+z', [], true);
  wallRun(S.crypt, [-9.5, -0.5], [-7, -0.5], '-z', [], true);
  wallRun(S.crypt, [-9.5, -2.7], [-9.5, -0.5], '+x', [], true);
  wallRun(S.crypt, [-7, -2.7], [-7, -0.5], '-x', [[-2.2, -1.0]]); // snug side of the shared wall
  { // furnishings + the sliding bookshelf mechanism
    const bench = boxAt(0.5, 0.42, 1.6, new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.8 }), -9.2, 0.21, -1.6);
    addCollider(-9.2, -1.6, 0.7, 1.8, 0.44);
    for (let i = 0; i < 2; i++) {
      const cnd = cylAt(0.03, 0.035, 0.14, std(0xe8e0c8), -8.2 + i * 0.5, 0.5, -2.55, 8);
      const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.08, 8), new THREE.MeshBasicMaterial({ color: 0xffc36a }));
      fl2.position.set(-8.2 + i * 0.5, 0.6, -2.55); scene.add(fl2);
      tickers.push(t => { const s3 = 0.8 + 0.3 * Math.abs(Math.sin(t * 6 + i * 3)); fl2.scale.set(s3, s3, s3); });
      boxAt(0.4, 0.44, 0.4, new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.8 }), -8.2 + i * 0.5, 0.22, -2.5);
    }
    const snugLight = new THREE.PointLight(0xff9a55, 5, 6, 2);
    snugLight.position.set(-8.2, 1.6, -1.6); scene.add(snugLight);
    wallSign(['THE SNUG', 'members only.', 'you are now a member.'], 0.8, 0.44, -9.42, 1.7, -1.6, Math.PI / 2, { fs: 11, pw: 224, ph: 144 });
    wallSign(['what happens in the snug', 'stays in the snug'], 0.7, 0.2, -8.2, 2.1, -2.62, 0, { fs: 9, pw: 256, ph: 64 });
  }

  // loot chest (heist deliveries go here; nice furniture otherwise)
  {
    const wood2 = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.7, color: 0xa88a5a });
    const chest = boxAt(0.9, 0.5, 0.55, wood2, -1.7, 0.25, -4.35);
    const lid3 = boxAt(0.9, 0.14, 0.55, wood2, -1.7, 0.56, -4.42);
    lid3.rotation.x = -0.35;
    boxAt(0.94, 0.08, 0.06, std(0xd8a030, { metalness: 0.7, roughness: 0.3 }), -1.7, 0.32, -4.08);
    addCollider(-1.7, -4.35, 1.1, 0.75, 0.6);
    wallSign(['THE LOOT CHEST'], 0.5, 0.12, -1.7, 0.85, -4.0, 0, { fs: 10, pw: 192, ph: 40 });
  }

  // hot tub: HOUSE LEVEL 3 unlock (hidden until then)
  const hotTub = new THREE.Group();
  {
    const tubWood = new THREE.MeshStandardMaterial({ map: darkWoodTex, roughness: 0.7, color: 0xb0906a });
    const ring2 = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.9, 0.75, 18, 1, true), tubWood);
    ring2.position.y = 0.37; ring2.material.side = THREE.DoubleSide; hotTub.add(ring2);
    const tw = new THREE.Mesh(new THREE.CircleGeometry(0.88, 18),
      new THREE.MeshStandardMaterial({ color: 0x4a8c94, transparent: true, opacity: 0.85, roughness: 0.1 }));
    tw.rotation.x = -Math.PI / 2; tw.position.y = 0.66; hotTub.add(tw);
    const steam = [];
    for (let i = 0; i < 5; i++) {
      const s4 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xdde8ec, transparent: true, opacity: 0.25 }));
      hotTub.add(s4); steam.push(s4);
    }
    tickers.push(t => {
      if (!hotTub.visible) return;
      steam.forEach((s4, i) => {
        const ph = (t * 0.3 + i / 5) % 1;
        s4.position.set(Math.sin(i * 2.2) * 0.5, 0.7 + ph * 0.9, Math.cos(i * 2.2) * 0.5);
        s4.material.opacity = 0.25 * (1 - ph);
      });
    });
    hotTub.position.set(-5.2, 0, 9.8);
    hotTub.visible = false;
    hotTub.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(hotTub);
  }
  let tubUnlocked = false;
  function applyHouseLevel(lv) {
    if (lv >= 2) { rug.material.color.set(0xc9a24a); } // the fancy rug era
    if (lv >= 3 && !tubUnlocked) {
      tubUnlocked = true;
      hotTub.visible = true;
      addCollider(-5.2, 9.8, 2.0, 2.0, 0.72);
      hideys.push({ id: 'tub', label: 'THE HOT TUB', x: -4.0, z: 9.8, inX: -5.35, inZ: 9.8, inYaw: -Math.PI / 2, in2X: -5.05, in2Z: 9.8, outX: -3.9, outZ: 9.8, cap: 2 });
    }
  }

  // sabotage flood puddles (hidden until the pipes burst)
  const puddles = [];
  [[0.6, -14.2], [-1.6, -11.0], [7.2, -13.6], [8.6, -11.2]].forEach(([x, z]) => {
    const pd = new THREE.Mesh(new THREE.CircleGeometry(0.85, 18),
      new THREE.MeshStandardMaterial({ color: 0x33505a, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.85 }));
    pd.rotation.x = -Math.PI / 2; pd.position.set(x, 0.016, z);
    pd.visible = false; pd.receiveShadow = true; scene.add(pd);
    puddles.push({ mesh: pd, x, z, r: 0.95 });
  });

  // ---------- global dust ----------
  {
    const n = 850, DUST_TOP = 9.6; // motes drift on all three floors now
    const pos = new Float32Array(n * 3), sd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -13 + rnd() * 29; pos[i * 3 + 1] = rnd() * DUST_TOP; pos[i * 3 + 2] = -17 + rnd() * 31; sd[i] = rnd() * 100;
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(gg, new THREE.PointsMaterial({
      color: 0xffe0b0, size: 0.02, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false,
    })));
    tickers.push(t => {
      const a = gg.attributes.position.array;
      for (let i = 0; i < n; i++) {
        a[i * 3 + 1] += Math.sin(t * 0.5 + sd[i]) * 0.0008 + 0.0005;
        if (a[i * 3 + 1] > DUST_TOP) a[i * 3 + 1] = 0;
      }
      gg.attributes.position.needsUpdate = true;
    });
  }

  // ================================================================
  // ===================== UPSTAIRS + THE ATTIC =====================
  // ================================================================
  // Second story at y=3.7 over the north wing, den and crypt; attic at y=7.4
  // over the west wing. Grand staircase in the hall, servant stairs to the attic.
  const L2 = 3.7, ATT = 7.4, C2 = L2 + H; // upper floor, attic floor, upper ceiling
  const woodM = std(0x4a3418, { roughness: 0.8 });
  const brassM = std(0xc9a24a, { roughness: 0.35, metalness: 0.6 });
  const darkM = std(0x241708, { roughness: 0.85 });

  // ---------- floors + walk slabs ----------
  floorRect(-13, -17, -3, -9, paleFloorTex, 0.25, 0xcabfae, 0.9, L2); slab(-13, -17, -3, -9, L2);   // master
  floorRect(-3, -17, 4, -9, hallFloorTex, 0.3, 0xffffff, 0.9, L2);    slab(-3, -17, 4, -9, L2);     // library
  floorRect(4, -17, 10, -9, denFloorTex, 0.27, 0xffffff, 0.9, L2);    slab(4, -17, 10, -9, L2);     // trophy
  floorRect(-13, -9, 10, -6.7, hallFloorTex, 0.3, 0xffffff, 0.9, L2); slab(-13, -9, 10, -6.7, L2);  // landing (north of well)
  floorRect(-8.5, -6.7, 10, -5, hallFloorTex, 0.3, 0xffffff, 0.9, L2); slab(-8.5, -6.7, 10, -5, L2); // landing (east of well)
  floorRect(-7, -5, 7, 5, carpetTex, 0.4, 0xffffff, 0.95, L2);        slab(-7, -5, 7, 5, L2);       // game room
  floorRect(7, -5, 16, 5, stoneFloorTex, 0.45, 0x8f8fb0, 0.9, L2);    slab(7, -5, 16, 5, L2);       // observatory

  // ---------- ceilings ----------
  // master ceiling leaves the attic hatch open (x -4.6..-3, z -13.55..-10.45)
  ceilRect(-13, -17, -4.6, -9, plasterTex, 0.2, 0x8a7a80, false, C2);
  ceilRect(-4.6, -17, -3, -13.55, plasterTex, 0.2, 0x8a7a80, false, C2);
  ceilRect(-4.6, -10.45, -3, -9, plasterTex, 0.2, 0x8a7a80, false, C2);
  ceilRect(-3, -17, 4, -9, darkWoodTex, 0.4, 0x7a6a55, false, C2);    // library
  ceilRect(4, -17, 10, -9, plasterTex, 0.25, 0x9a9a90, false, C2);    // trophy
  ceilRect(-13, -9, 10, -5, plasterTex, 0.2, 0x5a5248, false, C2);    // landing
  ceilRect(-7, -5, 7, 5, plasterTex, 0.25, 0x4a5248, false, C2);      // game room
  ceilRect(7, -5, 16, 5, skyTex, 0.09, 0xffffff, true, C2);           // observatory: open to the night. allegedly.

  // ---------- walls ----------
  const D2 = { landMaster: [-9, -7.4], landLib: [0.2, 1.8], landTrophy: [6.4, 8],
    landGame: [-1, 1], landObs: [8, 9.5], libTrophy: [-14, -12.4], gameObs: [-1, 1] };
  // z = -17 exterior
  wallRun(S.master, [-13, -17], [-3, -17], '+z', [], true, L2);
  wallRun(S.library, [-3, -17], [4, -17], '+z', [], true, L2);
  wallRun(S.trophy, [4, -17], [10, -17], '+z', [], true, L2);
  // z = -9 landing north
  wallRun(S.master, [-13, -9], [-3, -9], '-z', [D2.landMaster], false, L2);
  wallRun(S.library, [-3, -9], [4, -9], '-z', [D2.landLib], false, L2);
  wallRun(S.trophy, [4, -9], [10, -9], '-z', [D2.landTrophy], false, L2);
  wallRun(S.landing, [-13, -9], [10, -9], '+z', [D2.landMaster, D2.landLib, D2.landTrophy], true, L2);
  // z = -5
  wallRun(S.landing, [-13, -5], [-7, -5], '-z', [], true, L2);
  wallRun(S.landing, [-7, -5], [7, -5], '-z', [D2.landGame], false, L2);
  wallRun(S.game, [-7, -5], [7, -5], '+z', [D2.landGame], true, L2);
  wallRun(S.landing, [7, -5], [10, -5], '-z', [D2.landObs], false, L2);
  wallRun(S.obs, [7, -5], [10, -5], '+z', [D2.landObs], true, L2);
  wallRun(S.obs, [10, -5], [16, -5], '+z', [], true, L2);
  // z = 5 south exterior
  wallRun(S.game, [-7, 5], [7, 5], '-z', [], true, L2);
  wallRun(S.obs, [7, 5], [16, 5], '-z', [], true, L2);
  // x walls
  wallRun(S.master, [-13, -17], [-13, -9], '+x', [], true, L2);
  wallRun(S.landing, [-13, -9], [-13, -5], '+x', [], true, L2);
  wallRun(S.master, [-3, -17], [-3, -9], '-x', [], true, L2);
  wallRun(S.library, [-3, -17], [-3, -9], '+x', [], false, L2);
  wallRun(S.library, [4, -17], [4, -9], '-x', [D2.libTrophy], true, L2);
  wallRun(S.trophy, [4, -17], [4, -9], '+x', [D2.libTrophy], false, L2);
  wallRun(S.trophy, [10, -17], [10, -9], '-x', [], true, L2);
  wallRun(S.landing, [10, -9], [10, -5], '-x', [], true, L2);
  wallRun(S.game, [-7, -5], [-7, 5], '+x', [], true, L2);
  wallRun(S.game, [7, -5], [7, 5], '-x', [D2.gameObs], true, L2);
  wallRun(S.obs, [7, -5], [7, 5], '+x', [D2.gameObs], false, L2);
  wallRun(S.obs, [16, -5], [16, 5], '-x', [], true, L2);

  // ---------- doors that announce you ----------
  // real swinging leaves on the quieter doorways. they never block (no collider),
  // but they creak open when anyone approaches and drift back to ajar. sound = information.
  let slamDoorFn = null;    // ghosts slam doors through this
  const mannequinsOut = []; // ghosts wear these
  {
    const doorM = mat(darkWoodTex, 0.85, [0.8, 0.7]);
    const knobM = std(0xc9a24a, { roughness: 0.3, metalness: 0.7 });
    const doors = [];
    // axis 'x': doorway runs along x at fixed z (hinge at lo end). axis 'z': runs along z at fixed x.
    const mkDoor = (axis, lo, hi, fixed, fy = 0) => {
      const w = hi - lo;
      const g = new THREE.Group();
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, 2.1, 0.07), doorM);
      leaf.position.set(w / 2, 1.05, 0);
      leaf.castShadow = leaf.receiveShadow = true;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), knobM);
      knob.position.set(w / 2 - 0.14, 0, 0.07);
      leaf.add(knob);
      g.add(leaf);
      const closedRy = axis === 'x' ? 0 : -Math.PI / 2;
      g.position.set(axis === 'x' ? lo : fixed, fy, axis === 'x' ? fixed : lo);
      g.rotation.y = closedRy + 0.09; // resting ajar. of course it is.
      scene.add(g);
      doors.push({
        g, closedRy, openRy: closedRy + 1.72, fy,
        cx: axis === 'x' ? (lo + hi) / 2 : fixed,
        cz: axis === 'x' ? fixed : (lo + hi) / 2,
        wasNear: false,
      });
    };
    mkDoor('x', D.hallNur[0], D.hallNur[1], -9);
    mkDoor('x', D.hallKit[0], D.hallKit[1], -9);
    mkDoor('x', D.hallBath[0], D.hallBath[1], -9);
    mkDoor('x', D.denBase[0], D.denBase[1], 5);
    mkDoor('x', D2.landMaster[0], D2.landMaster[1], -9, L2);
    mkDoor('x', D2.landLib[0], D2.landLib[1], -9, L2);
    mkDoor('x', D2.landTrophy[0], D2.landTrophy[1], -9, L2);
    mkDoor('z', D2.gameObs[0], D2.gameObs[1], 7, L2);
    tickers.push((t, dt, p2) => {
      const net2 = window.GD3 && window.GD3.net;
      doors.forEach(d => {
        let near = false;
        const chk = (px, pz, py) => {
          if (!near && Math.hypot(px - d.cx, pz - d.cz) < 1.6 && Math.abs((py || 0) - d.fy) < 1.6) near = true;
        };
        chk(p2.x, p2.z, p2.y);
        if (net2 && net2.peers) net2.peers.forEach(pr => chk(pr.cx, pr.cz, pr.cy));
        if (near !== d.wasNear) {
          d.wasNear = near;
          const myD = Math.hypot(p2.x - d.cx, p2.z - d.cz) + Math.abs((p2.y || 0) - d.fy) * 2;
          const vol = Math.max(0, 1 - myD / 11);
          const pan = sfx.panTo(d.cx, d.cz);
          if (vol > 0.03) (near ? sfx.doorCreak(vol, pan) : setTimeout(() => sfx.doorShut(vol * 0.7, pan), 700));
        }
        if (d.slamUntil && performance.now() < d.slamUntil) return; // mid-slam: hands off
        const want = near ? d.openRy : d.closedRy + 0.09;
        d.g.rotation.y += (want - d.g.rotation.y) * Math.min(1, dt * 3.0);
      });
    });
    // a ghost slams the nearest door: whips open, bangs shut. terror, delivered.
    slamDoorFn = (x, z) => {
      let best = null, bd = 4;
      doors.forEach(d => { const dd = Math.hypot(x - d.cx, z - d.cz); if (dd < bd) { bd = dd; best = d; } });
      if (!best) return false;
      const d = best;
      d.slamUntil = performance.now() + 900;
      d.g.rotation.y = d.openRy;
      sfx.doorCreak(1, sfx.panTo(d.cx, d.cz));
      setTimeout(() => {
        d.g.rotation.y = d.closedRy + 0.02;
        sfx.doorShut(1.4, sfx.panTo(d.cx, d.cz));
      }, 550);
      return true;
    };
  }

  // ---------- THE GRAND STAIRCASE (hall → landing) ----------
  // solid flight in the hall's south-west corner: low end east (x -8.5), top west (x -12.9)
  {
    const N = 11, run = 4.4, rise = L2, sw = 1.7, cz2 = -5.85;
    for (let i = 0; i < N; i++) {
      const top = ((i + 1) / N) * rise;
      const cx = -8.5 - (i + 0.5) * (run / N);
      boxAt(run / N + 0.02, top, sw, woodM, cx, top / 2, cz2);
      addCollider(cx, cz2, run / N, sw, top, 0);
    }
    // slanted banister on the open (north) side, lower 8 steps; top 3 are the exit
    for (let i = 0; i < 8; i++) {
      const top = ((i + 1) / N) * rise, cx = -8.5 - (i + 0.5) * (run / N);
      boxAt(0.06, 0.8, 0.06, darkM, cx, top + 0.4, -6.62);
      addCollider(cx, -6.62, 0.3, 0.18, top + 0.85, 0);
    }
    const hr = boxAt(3.4, 0.08, 0.08, brassM, -10.1, ((0.34 + 2.69) / 2) + 0.85, -6.62);
    hr.rotation.z = -Math.atan2(2.35, 3.2);
    // landing guard rails around the open well
    const guard = (cx, cz3, sx, sz) => {
      addCollider(cx, cz3, sx, sz, L2 + 1.05, L2 - 0.3);
      boxAt(sx || 0.07, 0.07, sz || 0.07, brassM, cx, L2 + 0.98, cz3);
      const n2 = Math.max(2, Math.round(Math.max(sx, sz) / 0.36));
      for (let i = 0; i <= n2; i++) {
        const t2 = i / n2;
        boxAt(0.05, 0.95, 0.05, darkM, sx > sz ? cx - sx / 2 + t2 * sx : cx, L2 + 0.48, sx > sz ? cz3 : cz3 - sz / 2 + t2 * sz);
      }
    };
    guard(-10.05, -6.74, 3.1, 0.07);  // north lip of the well (exit gap stays open at the west end)
    guard(-8.46, -5.85, 0.07, 1.7);   // east lip
    // fascia so the slab edge reads as a real floor from below
    boxAt(4.4, 0.5, 0.1, woodM, -10.7, L2 - 0.25, -6.72);
    boxAt(0.1, 0.5, 1.7, woodM, -8.52, L2 - 0.25, -5.85);
    wallSign(['UPSTAIRS', 'MORE HOUSE. WHY.'], 1.1, 0.5, -8.2, 1.7, -5.06, 0, {});
    // chandelier over the well, visible from the hall below
    const chg = new THREE.Group();
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6), darkM);
    chain.position.y = 0.75; chg.add(chain);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 20), brassM);
    ring.rotation.x = Math.PI / 2; chg.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 8), std(0xe8dcc0, { roughness: 0.6 }));
      c2.position.set(Math.cos(a) * 0.55, 0.13, Math.sin(a) * 0.55); chg.add(c2);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffc46a }));
      fl.position.set(Math.cos(a) * 0.55, 0.29, Math.sin(a) * 0.55); chg.add(fl);
    }
    chg.position.set(-10.7, 5.45, -5.85);
    chg.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(chg);
    const chLight = new THREE.PointLight(0xffc06a, 9, 10, 1.8);
    chLight.position.set(-10.7, 5.35, -5.85);
    heroShadow(chLight); scene.add(chLight); // hero shadow #2: baluster shadows rake the stairwell
    tickers.push(t => {
      chg.rotation.z = Math.sin(t * 0.7) * 0.02; chg.rotation.x = Math.cos(t * 0.53) * 0.02;
      chLight.intensity = 9 * (0.86 + 0.14 * Math.sin(t * 9) * Math.sin(t * 5.3 + 1));
    });
  }

  // ---------- ATTIC SHELL + SERVANT STAIRS (master bedchamber → attic) ----------
  // the attic hatch is in the bedroom, obviously. flight hugs the master's east wall,
  // low end south (z -10.5), top at z -13.4; you step off WEST (or north) onto the attic floor.
  floorRect(-13, -17, -4.6, -5, atticTex, 0.3, 0xffffff, 0.95, ATT); slab(-13, -17, -4.6, -5, ATT);
  floorRect(-4.6, -17, -3, -13.55, atticTex, 0.3, 0xffffff, 0.95, ATT); slab(-4.6, -17, -3, -13.55, ATT);
  floorRect(-4.6, -10.45, -3, -5, atticTex, 0.3, 0xffffff, 0.95, ATT); slab(-4.6, -10.45, -3, -5, ATT);
  ceilRect(-13, -17, -3, -5, atticTex, 0.25, 0x6a5a48, false, ATT + 2.3);
  wallRun(S.attic, [-13, -17], [-3, -17], '+z', [], true, ATT);
  wallRun(S.attic, [-13, -5], [-3, -5], '-z', [], true, ATT);
  wallRun(S.attic, [-13, -17], [-13, -5], '+x', [], true, ATT);
  wallRun(S.attic, [-3, -17], [-3, -5], '-x', [], true, ATT);
  {
    const N = 11, run = 3.0, sw = 1.3, cx2 = -3.85; // strip x[-4.5,-3.2]
    for (let i = 0; i < N; i++) {
      const top = L2 + ((i + 1) / N) * (ATT - L2);
      const cz3 = -10.5 - (i + 0.5) * (run / N); // climbing north
      boxAt(sw, top - L2, run / N + 0.02, woodM, cx2, L2 + (top - L2) / 2, cz3);
      addCollider(cx2, cz3, sw, run / N, top, L2);
    }
    // rail on the open (west) side of the flight, lower steps only (top two are the exit)
    for (let i = 0; i < 9; i++) {
      const top = L2 + ((i + 1) / N) * (ATT - L2), cz3 = -10.5 - (i + 0.5) * (run / N);
      boxAt(0.05, 0.75, 0.05, darkM, -4.55, top + 0.37, cz3);
      addCollider(-4.55, cz3, 0.16, 0.26, top + 0.8, L2);
    }
    // attic-level guards around the open well
    const aguard = (gx, gz, sx, sz) => {
      addCollider(gx, gz, sx, sz, ATT + 1.0, ATT - 0.3);
      boxAt(Math.max(sx, 0.07), 0.07, Math.max(sz, 0.07), woodM, gx, ATT + 0.93, gz);
      const n2 = Math.max(2, Math.round(Math.max(sx, sz) / 0.36));
      for (let i = 0; i <= n2; i++)
        boxAt(0.05, 0.9, 0.05, darkM, sx > sz ? gx - sx / 2 + (i / n2) * sx : gx, ATT + 0.45, sx > sz ? gz : gz - sz / 2 + (i / n2) * sz);
    };
    aguard(-4.62, -11.5, 0.07, 2.1);            // west lip, south portion (exit gap at the north end)
    aguard(-3.82, -10.42, 1.55, 0.07);          // south lip
    boxAt(0.1, 0.5, 3.1, woodM, -4.61, ATT - 0.25, -12); // fascia
    wallSign(['ATTIC ↑', 'GOOD LUCK UP THERE'], 1.0, 0.5, -3.08, L2 + 1.7, -10.6, -Math.PI / 2, {});
  }

  // ---------- moon windows (upper exterior walls) ----------
  // the night outside is four stacked layers now — stars / moon / drifting clouds /
  // a bare tree — whose texture offsets slide against the viewer for real parallax
  const starsOnlyTex = cv(256, 256, (g, w, h) => {
    g.fillStyle = '#05070f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 130; i++) {
      g.fillStyle = `rgba(220,230,255,${0.25 + rnd() * 0.75})`;
      g.fillRect(rnd() * w, rnd() * h, rnd() < 0.12 ? 2.5 : 1.4, rnd() < 0.12 ? 2.5 : 1.4);
    }
  });
  const moonLayerTex = cv(128, 128, (g) => {
    g.fillStyle = '#dde6f2'; g.beginPath(); g.arc(78, 44, 22, 0, 7); g.fill();
    g.fillStyle = 'rgba(150,160,180,.55)';
    [[70, 38, 5], [86, 50, 4], [78, 56, 2.6]].forEach(([px2, py2, r]) => { g.beginPath(); g.arc(px2, py2, r, 0, 7); g.fill(); });
  });
  const cloudLayerTex = cv(256, 128, (g, w, h) => {
    for (let i = 0; i < 14; i++) {
      const cx2 = rnd() * w, cy2 = rnd() * h, r = 18 + rnd() * 30;
      const rg = g.createRadialGradient(cx2, cy2, r * 0.2, cx2, cy2, r);
      rg.addColorStop(0, 'rgba(150,165,195,.16)'); rg.addColorStop(1, 'rgba(150,165,195,0)');
      g.fillStyle = rg; g.beginPath(); g.ellipse(cx2, cy2, r * 1.6, r * 0.5, 0, 0, 7); g.fill();
    }
  });
  const treeLayerTex = cv(128, 128, (g) => {
    g.strokeStyle = 'rgba(8,6,10,.95)'; g.lineCap = 'round';
    const branch = (x, y, a, len, wd) => {
      if (wd < 0.5 || len < 4) return;
      const nx = x + Math.cos(a) * len, ny = y - Math.sin(a) * len;
      g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      branch(nx, ny, a + 0.35 + rnd() * 0.3, len * 0.72, wd * 0.62);
      branch(nx, ny, a - 0.4 - rnd() * 0.25, len * 0.68, wd * 0.62);
    };
    branch(34, 128, 1.35, 34, 5);
  });
  const parallaxWins = [];
  function moonWindow(x, y, z, ry, wdt = 1.5, hgt = 1.4) {
    const wg = new THREE.Group();
    const mkLayer = (tex, lz, tr, ro) => {
      const m2 = new THREE.MeshBasicMaterial({ map: tex.clone(), transparent: !!tr, depthWrite: !tr });
      m2.map.needsUpdate = true;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(wdt, hgt), m2);
      pl.position.z = lz;
      if (ro) pl.renderOrder = ro;
      wg.add(pl);
      return m2.map;
    };
    const stars = mkLayer(starsOnlyTex, -0.06);
    stars.repeat.set(1.3, 1.1); stars.offset.set(rnd() * 0.5, rnd() * 0.3);
    const moonL = mkLayer(moonLayerTex, -0.048, true, 2);
    moonL.wrapS = moonL.wrapT = THREE.ClampToEdgeWrapping;
    const cloud = mkLayer(cloudLayerTex, -0.036, true, 3);
    cloud.repeat.set(1.4, 1);
    const tree = mkLayer(treeLayerTex, -0.022, true, 4);
    tree.wrapS = tree.wrapT = THREE.ClampToEdgeWrapping;
    [[0, hgt / 2 + 0.05], [0, -hgt / 2 - 0.05]].forEach(([fx, fy]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(wdt + 0.16, 0.1, 0.08), darkM); b.position.set(fx, fy, 0); wg.add(b);
    });
    [-wdt / 2 - 0.05, 0, wdt / 2 + 0.05].forEach(fx => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, hgt + 0.1, 0.08), darkM); b.position.set(fx, 0, 0); wg.add(b);
    });
    const cross = new THREE.Mesh(new THREE.BoxGeometry(wdt, 0.06, 0.06), darkM); cross.position.z = 0.02; wg.add(cross);
    wg.position.set(x, y, z); wg.rotation.y = ry; scene.add(wg);
    parallaxWins.push({ wg, stars, moonL, cloud, tree, sx: stars.offset.x, sy: stars.offset.y });
    const glow = new THREE.PointLight(0x9db8e8, 3, 6, 2);
    glow.position.set(x + Math.sin(ry) * 0.6, y, z + Math.cos(ry) * 0.6); scene.add(glow);
    // gobo: project the pane pattern onto the floor as a real moonlight patch
    const spot = new THREE.SpotLight(0x9db8e8, 15, 10, 0.48, 0.4, 1.3);
    spot.position.set(x, y, z);
    spot.target.position.set(x + Math.sin(ry) * 3.0, y - 3.1, z + Math.cos(ry) * 3.0);
    spot.map = goboTex;
    scene.add(spot, spot.target);
  }
  // slide the layers against the viewer's eye: the tree is close, the moon is not
  tickers.push((t, dt, p) => {
    const scroll = t * 0.006;
    parallaxWins.forEach(w2 => {
      V.set(p.x, (p.y || 0) + 1.58, p.z);
      w2.wg.worldToLocal(V);
      if (V.z < 0.25) return; // behind or inside the glass: nothing to fake
      const px2 = Math.max(-0.6, Math.min(0.6, V.x / V.z));
      const py2 = Math.max(-0.5, Math.min(0.5, V.y / V.z));
      w2.stars.offset.set(w2.sx + px2 * 0.02, w2.sy + py2 * 0.012);
      w2.moonL.offset.set(px2 * 0.07, py2 * 0.045);
      w2.cloud.offset.set(scroll + px2 * 0.11, py2 * 0.06);
      w2.tree.offset.set(px2 * 0.2, py2 * 0.12);
    });
  });
  const goboTex = cv(128, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    [[16, 16], [70, 16], [16, 70], [70, 70]].forEach(([px2, py2]) => g.fillRect(px2, py2, 42, 42));
  });
  moonWindow(-12.87, L2 + 1.8, -13, Math.PI / 2);        // master, west wall
  moonWindow(9.87, L2 + 1.8, -7, -Math.PI / 2, 1.3, 1.3); // landing, east end
  moonWindow(-6.87, L2 + 1.8, 0, Math.PI / 2);            // game room, west wall
  moonWindow(-8, ATT + 1.5, -16.87, 0, 1.0, 1.0);         // attic, tiny north window
  moonWindow(-6.87, 1.9, 1.2, Math.PI / 2, 1.5, 1.2);     // den, west wall (ground floor)

  // ---------- crown molding (den / hall / landing / master) ----------
  // hall + master runs skip the stairwell void and the attic hatch respectively
  [ // den
    [-6.87, -4.87, 6.87, -4.87], [-6.87, 4.87, 6.87, 4.87],
    [-6.87, -4.87, -6.87, 4.87], [6.87, -4.87, 6.87, 4.87],
    // hall (west end stops at the grand-stair void)
    [-12.87, -8.87, 9.87, -8.87], [-8.5, -5.13, 9.87, -5.13],
    [9.87, -8.87, 9.87, -5.13], [-12.87, -8.87, -12.87, -6.7],
  ].forEach(s => crownRun(...s));
  [ // landing
    [-12.87, -8.87, 9.87, -8.87], [-12.87, -5.13, 9.87, -5.13],
    [-12.87, -8.87, -12.87, -5.13], [9.87, -8.87, 9.87, -5.13],
    // master (east wall splits around the attic hatch)
    [-12.87, -16.87, -3.13, -16.87], [-12.87, -9.13, -3.13, -9.13],
    [-12.87, -16.87, -12.87, -9.13],
    [-3.13, -16.87, -3.13, -13.55], [-3.13, -10.45, -3.13, -9.13],
  ].forEach(s => crownRun(s[0], s[1], s[2], s[3], L2));

  // ================= MASTER BEDCHAMBER =================
  {
    // the four-poster: tall enough to hide under, sturdy enough to jump on
    const bx = -9.6, bz = -13.2, deckY = L2 + 0.55;
    rboxAt(2.3, 0.22, 1.9, woodM, bx, deckY + 0.11, bz, 0, 0.04);             // deck
    rboxAt(2.3, 0.34, 1.9, std(0x8a2438, { roughness: 0.85 }), bx, deckY + 0.39, bz, 0, 0.09); // mattress + blanket
    rboxAt(0.7, 0.16, 0.4, std(0xe8dcc0, { roughness: 0.9 }), bx - 0.6, deckY + 0.62, bz - 0.55, 0, 0.06); // pillow
    rboxAt(0.7, 0.16, 0.4, std(0xe8dcc0, { roughness: 0.9 }), bx - 0.6, deckY + 0.62, bz + 0.55, 0, 0.06);
    const lump = rboxAt(0.6, 0.3, 0.5, std(0x6a1c2c, { roughness: 0.9 }), bx + 0.45, deckY + 0.6, bz + 0.1, 0, 0.09);
    tickers.push(t => { lump.scale.y = 1 + Math.sin(t * 1.1) * 0.12; });      // it breathes. do not make the bed angry.
    [[-1.05, -0.85], [1.05, -0.85], [-1.05, 0.85], [1.05, 0.85]].forEach(([ox, oz]) =>
      boxAt(0.12, 2.5, 0.12, darkM, bx + ox, L2 + 1.25, bz + oz));
    boxAt(2.5, 0.1, 2.1, std(0x3a1220, { roughness: 0.95 }), bx, L2 + 2.55, bz); // canopy
    // dust ruffle: three sides skirted, the east side stays open 0.55m for crawling under
    [[bx, bz - 0.95, 2.3, 0.04], [bx, bz + 0.95, 2.3, 0.04], [bx - 1.15, bz, 0.04, 1.9]].forEach(([sx2, sz2, w2, d2]) =>
      boxAt(w2, 0.42, d2, std(0x5a1f2f, { roughness: 0.95 }), sx2, L2 + 0.24, sz2));
    addCollider(bx, bz, 2.3, 1.9, deckY + 0.56, L2); // solid to jumpers, the void below is for hiding
    hideys.push({ id: 'underbed', label: 'UNDER THE BED', x: bx + 1.6, z: bz, inX: bx, inZ: bz, inYaw: -Math.PI / 2, outX: bx + 1.6, outZ: bz, y: L2, crouch: true });
    // vanity with a mirror that shows nothing
    boxAt(1.3, 0.8, 0.5, woodM, -12.3, L2 + 0.4, -10.2);
    addCollider(-12.3, -10.2, 1.3, 0.5, L2 + 0.8, L2);
    boxAt(1.1, 1.1, 0.06, std(0x101014, { roughness: 0.15, metalness: 0.7 }), -12.3, L2 + 1.6, -10.2);
    wallSign(['NO REFLECTION?', 'DO NOT WORRY ABOUT IT'], 1.2, 0.4, -12.3, L2 + 2.5, -10.15, 0, {});
    cylAt(0.22, 0.26, 0.45, woodM, -11.3, L2 + 0.22, -10.4); // stool
    addCollider(-11.3, -10.4, 0.5, 0.5, L2 + 0.46, L2);
    // dresser, drawers flung open, one sock reaching out
    boxAt(1.5, 1.1, 0.6, woodM, -4.2, L2 + 0.55, -16.3);
    addCollider(-4.2, -16.3, 1.5, 0.6, L2 + 1.1, L2);
    boxAt(1.1, 0.18, 0.5, darkM, -4.2, L2 + 0.75, -15.95);
    boxAt(1.1, 0.18, 0.7, darkM, -4.2, L2 + 0.35, -15.85);
    boxAt(0.14, 0.5, 0.1, std(0xd8d2c4, { roughness: 0.95 }), -4.5, L2 + 1.28, -16.1).rotation.z = 0.5;
    // nightstands + a lamp that hums
    boxAt(0.55, 0.6, 0.55, woodM, -8.2, L2 + 0.3, -14.35);
    addCollider(-8.2, -14.35, 0.55, 0.55, L2 + 0.6, L2);
    cylAt(0.05, 0.07, 0.35, darkM, -8.2, L2 + 0.78, -14.35);
    const shade = cylAt(0.18, 0.24, 0.24, std(0xe8c9a0, { roughness: 0.9 }), -8.2, L2 + 1.05, -14.35);
    shade.material.emissive = new THREE.Color(0x9a6a30); shade.material.emissiveIntensity = 0.7;
    wallSign(['HIS SIDE', '(DO NOT)'], 0.9, 0.4, -8.2, L2 + 1.9, -16.94, 0, {});
    // reading chair by the window
    boxAt(0.8, 0.45, 0.8, std(0x2f4a3a, { roughness: 0.95 }), -12.1, L2 + 0.22, -15.6);
    boxAt(0.8, 0.9, 0.2, std(0x2f4a3a, { roughness: 0.95 }), -12.42, L2 + 0.65, -15.6);
    addCollider(-12.1, -15.6, 0.9, 0.9, L2 + 0.46, L2);
    speakers.push({ name: 'THE BED', x: bx, y: L2 + 1.4, z: bz, radius: 3.4, lines: [
      'get out of me.',
      'someone is already under here. probably.',
      'i have held worse than you.',
      'the lump? the lump is fine. next question.',
      'tuck me in and PERISH.',
      'i creak because i CHOOSE to.',
    ] });
  }

  // ================= LIBRARY OF LIES =================
  {
    // shelf walls stuffed with spines
    const shelfM = mat(bookTex, 0.9, [3, 1]);
    [[-2.9, -10.5, 0.24, 2.8, Math.PI / 2], [-2.9, -14.5, 0.24, 2.8, Math.PI / 2],
     [3.9, -11, 0.24, 2.6, -Math.PI / 2], [0.5, -16.9, 5.6, 0.24, 0]].forEach(([sx2, sz2, w2, d2, ry2]) => {
      for (let lvl = 0; lvl < 4; lvl++) {
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w2, d2), 0.62, 0.22), shelfM);
        b2.position.set(sx2, L2 + 0.5 + lvl * 0.66, sz2); b2.rotation.y = ry2;
        b2.castShadow = b2.receiveShadow = true; scene.add(b2);
      }
      addCollider(sx2, sz2, Math.max(w2, 0.3), Math.max(d2 === 2.8 || d2 === 2.6 ? d2 : 0.3, 0.3), L2 + 3.0, L2);
    });
    // rolling ladder, leaning with intent
    const lad = new THREE.Group();
    for (let i = 0; i < 6; i++) { const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), woodM); r2.position.y = 0.3 + i * 0.42; lad.add(r2); }
    [[-0.27], [0.27]].forEach(([ox]) => { const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.8, 0.06), woodM); s2.position.set(ox, 1.4, 0); lad.add(s2); });
    lad.position.set(-2.55, L2, -12.4); lad.rotation.z = 0.24;
    lad.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(lad);
    // desk with the screaming book
    boxAt(1.6, 0.1, 0.9, woodM, 1.2, L2 + 0.78, -13.1);
    [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]].forEach(([ox, oz]) => boxAt(0.1, 0.78, 0.1, woodM, 1.2 + ox, L2 + 0.39, -13.1 + oz));
    addCollider(1.2, -13.1, 1.6, 0.9, L2 + 0.83, L2);
    const book = boxAt(0.5, 0.08, 0.36, std(0x5a1c1c, { roughness: 0.8 }), 1.2, L2 + 0.87, -13.1, 0.4);
    tickers.push((t, dt, p2) => { // it slams itself when you get close
      const d3 = Math.hypot(p2.x - 1.2, p2.z + 13.1);
      const near2 = d3 < 2 && Math.abs((p2.y || 0) - L2) < 1.5;
      book.scale.z += ((near2 ? 1.35 : 1) - book.scale.z) * Math.min(1, dt * 6);
    });
    wallSign(['DO NOT READ', 'THE BROWN ONE'], 1.2, 0.45, 1.2, L2 + 2.4, -16.9, 0, {});
    // book stacks you can climb
    [[-1.6, -15.8, 0.5], [-1.1, -15.9, 0.95], [-0.5, -15.7, 1.4]].forEach(([sx2, sz2, h2]) => {
      for (let i = 0; i < Math.round(h2 / 0.12); i++)
        boxAt(0.5 - rnd() * 0.1, 0.11, 0.38, std([0x5a2f22, 0x2f4a3a, 0x3a3358, 0x6a5220][i % 4], { roughness: 0.85 }), sx2 + rnd() * 0.06, L2 + 0.06 + i * 0.12, sz2 + rnd() * 0.06, rnd() * 0.4);
      addCollider(sx2, sz2, 0.55, 0.45, L2 + h2, L2);
    });
    // globe of somewhere else
    cylAt(0.06, 0.3, 0.9, woodM, 3.2, L2 + 0.45, -15.9);
    const globe = sphAt(0.42, std(0x2f4a5a, { roughness: 0.6 }), 3.2, L2 + 1.25, -15.9);
    tickers.push(t => { globe.rotation.y = t * 0.4; });
    addCollider(3.2, -15.9, 0.7, 0.7, L2 + 1.0, L2);
    // armchair + lamp
    boxAt(0.9, 0.45, 0.9, std(0x4a2438, { roughness: 0.95 }), 2.9, L2 + 0.22, -10.2);
    boxAt(0.9, 1.0, 0.22, std(0x4a2438, { roughness: 0.95 }), 2.9, L2 + 0.7, -9.82);
    addCollider(2.9, -10.2, 1.0, 1.0, L2 + 0.46, L2);
    speakers.push({ name: 'A BOOK', x: 1.2, y: L2 + 1.1, z: -13.1, radius: 3.2, lines: [
      'AAAAAAAAAAAH.',
      'chapter one: AAAAAAH.',
      'i am 900 pages of pure screaming.',
      'the sequel is worse.',
      'shhh. this is a library. AAAAAH.',
      'banned in 40 countries and one basement.',
    ] });
  }

  // ================= THE TROPHY ROOM =================
  {
    // mounted heads along the north wall. one plaque is still hungry.
    const plaque = (x2, y2, z2, ry2) => {
      const p3 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.08), woodM);
      p3.position.set(x2, y2, z2); p3.rotation.y = ry2; p3.castShadow = true; scene.add(p3);
    };
    // THE ELK (cone snout, box antlers, deeply tired)
    plaque(5.2, L2 + 2.0, -16.9, 0);
    const elk = new THREE.Group();
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 10), std(0x6a4a2a, { roughness: 0.9 }));
    snout.rotation.x = Math.PI / 2; snout.position.z = 0.3; elk.add(snout);
    [[-0.12], [0.12]].forEach(([ox]) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), std(0x1a1a1a, { roughness: 0.3 }));
      eye.position.set(ox, 0.14, 0.18); elk.add(eye);
    });
    [[-0.2, 1], [0.2, -1]].forEach(([ox, s2]) => {
      for (let i = 0; i < 3; i++) {
        const tine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3 + i * 0.12, 0.05), std(0xd8ccb0, { roughness: 0.8 }));
        tine.position.set(ox + s2 * i * 0.1, 0.35 + i * 0.1, -0.05); tine.rotation.z = s2 * (0.3 + i * 0.2); elk.add(tine);
      }
    });
    elk.position.set(5.2, L2 + 2.0, -16.82); elk.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(elk);
    // taxidermied WHOLE gnome. they caught him staring.
    plaque(6.6, L2 + 1.9, -16.9, 0);
    const tg = buildGnome(1.0);
    tg.group.position.set(6.6, L2 + 1.62, -16.78); tg.group.rotation.x = -0.25;
    scene.add(tg.group);
    wallSign(['CAUGHT STARING', '2019'], 0.7, 0.3, 6.6, L2 + 1.28, -16.9, 0, {});
    // the duck that quacked
    plaque(7.9, L2 + 2.0, -16.9, 0);
    const td = buildDuck(0.8);
    td.group.position.set(7.9, L2 + 1.86, -16.8);
    scene.add(td.group);
    wallSign(['IT QUACKED', 'ONCE'], 0.7, 0.3, 7.9, L2 + 1.5, -16.9, 0, {});
    // empty plaque, engraved with menace
    plaque(9.1, L2 + 2.0, -16.9, 0);
    wallSign(['RESERVED:', 'YOU (SOON)'], 0.7, 0.4, 9.1, L2 + 2.0, -16.84, 0, {});
    // bear rug. flat. furious.
    boxAt(1.9, 0.08, 1.3, std(0x3a2414, { roughness: 1 }), 7.2, L2 + 0.04, -12.6);
    const bh = sphAt(0.3, std(0x3a2414, { roughness: 1 }), 8.2, L2 + 0.22, -12.6, 1.2, 0.8, 1);
    [[-0.1], [0.1]].forEach(([oz]) => sphAt(0.05, new THREE.MeshBasicMaterial({ color: 0xffd23e }), 8.45, L2 + 0.28, -12.6 + oz));
    // trophy case
    boxAt(2.2, 1.0, 0.5, woodM, 9.6, L2 + 0.5, -10.5);
    addCollider(9.6, -10.5, 2.2, 0.5, L2 + 1.0, L2);
    ['PARTICIPATION', '2ND PLACE', 'MOST FLAMMABLE'].forEach((txt, i) => {
      const cup = cylAt(0.09, 0.13, 0.26, brassM, 8.9 + i * 0.7, L2 + 1.14, -10.5, 10);
      cup.castShadow = true;
      wallSign([txt], 0.62, 0.2, 8.9 + i * 0.7, L2 + 0.62, -10.22, 0, {});
    });
    // gun cabinet: empty. note flutters.
    boxAt(1.2, 2.0, 0.4, woodM, 4.35, L2 + 1.0, -9.6);
    addCollider(4.35, -9.6, 1.2, 0.4, L2 + 2.0, L2);
    wallSign(['GONE FISHIN', '— THE GUNS'], 1.0, 0.5, 4.35, L2 + 1.3, -9.36, 0, {});
    speakers.push({ name: 'MOUNTED ELK', x: 5.2, y: L2 + 2.0, z: -16.8, radius: 3.4, lines: [
      'avenge me. or at least dust me.',
      'the duck saw everything.',
      'i had plans that thursday.',
      'my body is in the freezer downstairs. probably the ham.',
      'the empty plaque is measuring your head right now.',
      'antler maintenance is a nightmare up here.',
    ] });
  }

  // ================= THE GAME ROOM =================
  {
    // billiards: a table that has hosted violence
    rboxAt(2.6, 0.22, 1.5, std(0x1c4a2c, { roughness: 0.95 }), 0, L2 + 0.72, 0.5, 0, 0.05);
    rboxAt(2.8, 0.14, 1.7, woodM, 0, L2 + 0.62, 0.5, 0, 0.05);
    [[-1.3, -0.25], [1.3, -0.25], [-1.3, 1.25], [1.3, 1.25]].forEach(([ox, oz]) => boxAt(0.16, 0.62, 0.16, woodM, ox, L2 + 0.31, oz));
    addCollider(0, 0.5, 2.8, 1.7, L2 + 0.83, L2);
    [0xffffff, 0xd83a3a, 0x3a68d8, 0xe8b830, 0x8a2ad8, 0x1a1a1a].forEach((col, i) =>
      sphAt(0.07, std(col, { roughness: 0.25 }), -0.8 + (i % 3) * 0.5 + (i > 2 ? 0.2 : 0), L2 + 0.9, 0.28 + Math.floor(i / 3) * 0.4));
    const cue = boxAt(1.5, 0.04, 0.04, woodM, 1.9, L2 + 0.95, 1.3, 0.5);
    cue.rotation.z = -0.35;
    wallSign(['RACK EM', '(OR ELSE)'], 0.9, 0.4, 0, L2 + 2.2, 4.92, Math.PI, {});
    // arcade corner: GIGGLE INVADERS, permanently mid-crash
    const arcadeScreen = cv(128, 128, (g2, w2, h2) => {
      g2.fillStyle = '#050a05'; g2.fillRect(0, 0, w2, h2);
      g2.fillStyle = '#48e848';
      for (let r2 = 0; r2 < 3; r2++) for (let c3 = 0; c3 < 5; c3++) g2.fillRect(14 + c3 * 20, 16 + r2 * 16, 12, 9);
      g2.fillStyle = '#e8e848'; g2.fillRect(58, 100, 14, 8);
      g2.font = 'bold 11px Courier New'; g2.textAlign = 'center';
      g2.fillStyle = '#e84848'; g2.fillText('GIGGLE INVADERS', 64, 66);
      g2.fillStyle = '#48e848'; g2.fillText('INSERT TOOTH', 64, 82);
    });
    [[-5.9, 3.6, 0.6], [-5.9, 2.2, -0.2]].forEach(([ax, az, ry2], i) => {
      rboxAt(0.85, 1.9, 0.7, std(i ? 0x24384a : 0x3a2438, { roughness: 0.7 }), ax, L2 + 0.95, az, ry2, 0.05);
      addCollider(ax, az, 0.95, 0.85, L2 + 1.9, L2);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5),
        new THREE.MeshBasicMaterial({ map: arcadeScreen }));
      scr.position.set(ax + Math.sin(ry2 + Math.PI / 2) * 0.38, L2 + 1.35, az + Math.cos(ry2 + Math.PI / 2) * 0.38);
      scr.rotation.y = ry2 + Math.PI / 2; scr.rotation.x = -0.12;
      scene.add(scr);
      if (!i) tickers.push(t => { scr.visible = Math.sin(t * 13) > -0.92; }); // one screen blinks. it is fine.
    });
    // dartboard on the north wall + the chore
    const board = cylAt(0.4, 0.4, 0.06, std(0x2c1c10, { roughness: 0.8 }), 4, L2 + 1.8, -4.9, 18);
    board.rotation.x = Math.PI / 2;
    cylAt(0.26, 0.26, 0.07, std(0x8a2438, { roughness: 0.8 }), 4, L2 + 1.8, -4.88, 18).rotation.x = Math.PI / 2;
    cylAt(0.12, 0.12, 0.08, std(0xd8b830, { roughness: 0.8 }), 4, L2 + 1.8, -4.86, 18).rotation.x = Math.PI / 2;
    [[3.7, L2 + 1.9], [4.15, L2 + 1.7], [5.1, L2 + 2.3]].forEach(([dx2, dy2]) => { // one dart missed by a lot
      const dart = boxAt(0.04, 0.04, 0.3, std(0xd83a3a, { roughness: 0.5 }), dx2, dy2, -4.82);
      dart.rotation.x = 0.2;
    });
    wallSign(['DARTS: 0 — HOUSE: 41'], 1.3, 0.35, 4, L2 + 2.5, -4.9, 0, {});
    // card table, mid-game, everyone had aces
    cylAt(0.75, 0.75, 0.09, std(0x1c4a2c, { roughness: 0.95 }), 4.6, L2 + 0.72, 2.6, 16);
    cylAt(0.1, 0.14, 0.72, woodM, 4.6, L2 + 0.36, 2.6);
    addCollider(4.6, 2.6, 1.5, 1.5, L2 + 0.78, L2);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      boxAt(0.45, 0.5, 0.45, woodM, 4.6 + Math.cos(a) * 1.25, L2 + 0.25, 2.6 + Math.sin(a) * 1.25);
      addCollider(4.6 + Math.cos(a) * 1.25, 2.6 + Math.sin(a) * 1.25, 0.5, 0.5, L2 + 0.5, L2);
      for (let c3 = 0; c3 < 2; c3++) {
        const card = boxAt(0.12, 0.005, 0.17, std(0xe8e0d0, { roughness: 0.6 }), 4.6 + Math.cos(a) * 0.5 + c3 * 0.05, L2 + 0.78, 2.6 + Math.sin(a) * 0.5, a);
      }
    }
    wallSign(['FOUR PLAYERS.', 'SIXTEEN ACES.'], 1.1, 0.5, 6.92, L2 + 2.1, 2.6, -Math.PI / 2, {});
    // neon sign, buzzing
    const neon = wallSign(['THE GAME ROOM'], 2.2, 0.55, 0, L2 + 2.75, -4.92, 0, { color: '#7ce8d0' });
    tickers.push(t => { neon.visible = Math.sin(t * 21) > -0.97; });
    // the vent (imposter travel; matches VENTS in 3d-game.js)
    boxAt(0.7, 0.1, 0.7, std(0x6a6a72, { roughness: 0.5, metalness: 0.5 }), -5.6, L2 + 0.05, -3.9);
    wallSign(['NOT A VENT'], 0.75, 0.25, -5.6, L2 + 0.5, -4.9, 0, {});
    speakers.push({ name: 'ARCADE CABINET', x: -5.9, y: L2 + 1.5, z: 3.6, radius: 3.2, lines: [
      'INSERT TOOTH TO CONTINUE.',
      'high score holder: THE HOUSE. forever.',
      'i ate a quarter in 1987 and i will do it again.',
      'player 2 never came back. press start.',
      'the darts cheat. i saw them.',
      'GAME OVER is not a threat it is a promise.',
    ] });
  }

  // ================= THE OBSERVATORY =================
  {
    // the great telescope, aimed at something that is also aiming back
    const tel = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.6, 14), brassM);
    tube.rotation.z = -0.85; tube.position.y = 1.9; tel.add(tube);
    const eyep = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.3, 10), darkM);
    eyep.rotation.z = -0.85; eyep.position.set(-1.05, 1.05, 0); tel.add(eyep);
    [[0.5, 0], [-0.25, 0.43], [-0.25, -0.43]].forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 8), woodM);
      leg.position.set(ox * 0.8, 0.85, oz * 0.8); leg.rotation.z = ox * 0.4; leg.rotation.x = -oz * 0.4;
      tel.add(leg);
    });
    tel.position.set(12.5, L2, -1.6);
    tel.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(tel);
    addCollider(12.5, -1.6, 1.4, 1.4, L2 + 1.2, L2);
    // the orrery: the solar system, but wrong
    const orr = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.1, 10), brassM);
    pole.position.y = 0.55; orr.add(pole);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffc46a }));
    sun.position.y = 1.15; orr.add(sun);
    const arms = [];
    [[0.45, 0x8a99b8, 0.05], [0.7, 0xb87a5a, 0.07], [0.95, 0x5a8a6a, 0.06]].forEach(([r2, col, pr], i) => {
      const arm = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.BoxGeometry(r2, 0.02, 0.02), brassM);
      rod.position.set(r2 / 2, 1.15, 0); arm.add(rod);
      const pl = new THREE.Mesh(new THREE.SphereGeometry(pr, 10, 8), std(col, { roughness: 0.5 }));
      pl.position.set(r2, 1.15, 0); arm.add(pl);
      orr.add(arm); arms.push({ arm, sp: 0.7 - i * 0.2 });
    });
    orr.position.set(11.5, L2, 1.4);
    orr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(orr);
    addCollider(11.5, 1.4, 0.9, 0.9, L2 + 1.1, L2);
    tickers.push(t => arms.forEach(({ arm, sp }) => { arm.rotation.y = t * sp; }));
    // orb pedestal (the heist target spawns here)
    cylAt(0.3, 0.4, 1.0, std(0x76767e, { roughness: 0.9 }), 12.5, L2 + 0.5, 2.2, 12);
    addCollider(12.5, 2.2, 0.7, 0.7, L2 + 1.0, L2);
    wallSign(['THE ORB', '(DO NOT ORB)'], 0.9, 0.4, 12.5, L2 + 1.7, 2.9, Math.PI, {});
    // star charts
    wallSign(['THE MOON:', 'UP TO SOMETHING'], 1.6, 0.8, 15.92, L2 + 1.9, 0, -Math.PI / 2, {});
    wallSign(['TONIGHT:', 'STARS. AGAIN.'], 1.4, 0.7, 9, L2 + 2.0, -4.9, 0, {});
    wallSign(['DAYS SINCE', 'COMET: 12,041'], 1.2, 0.6, 7.08, L2 + 1.9, 2.5, Math.PI / 2, {});
    // observer's desk
    boxAt(1.5, 0.08, 0.8, woodM, 14.8, L2 + 0.76, 3.9);
    [[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]].forEach(([ox, oz]) => boxAt(0.1, 0.76, 0.1, woodM, 14.8 + ox, L2 + 0.38, 3.9 + oz));
    addCollider(14.8, 3.9, 1.5, 0.8, L2 + 0.8, L2);
    boxAt(0.4, 0.01, 0.3, std(0xe8e0d0, { roughness: 0.9 }), 14.7, L2 + 0.81, 3.85, 0.3);
    wallSign(['"IT BLINKED."', '— final entry'], 1.0, 0.5, 15.92, L2 + 1.6, 3.9, -Math.PI / 2, {});
    speakers.push({ name: 'THE TELESCOPE', x: 12.5, y: L2 + 1.9, z: -1.6, radius: 3.6, lines: [
      'i looked. i regret.',
      'the moon has been making eye contact for 40 years.',
      'do NOT touch the orb. it remembers fingerprints.',
      'saturn called. it wants its ring back. all of ours are cursed.',
      'astronomy fact: the stars are technically watching YOU.',
      'point me at the neighbors again and i quit.',
    ] });
  }

  // ================= THE LANDING =================
  {
    // runner down the corridor
    const run2 = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.6), mat(runnerTex, 0.95, [6, 1]));
    run2.rotation.x = -Math.PI / 2; run2.position.set(-1.5, L2 + 0.012, -7.6);
    run2.receiveShadow = true; scene.add(run2);
    // ancestor overflow: the portraits they were NOT proud of
    const badPortrait = (x2, z2, ry2, seedFace) => {
      const t2 = cv(128, 160, (g2, w2, h2) => {
        g2.fillStyle = '#241a10'; g2.fillRect(0, 0, w2, h2);
        g2.fillStyle = '#c9a24a'; g2.fillRect(4, 4, w2 - 8, h2 - 8);
        g2.fillStyle = '#3a3026'; g2.fillRect(10, 10, w2 - 20, h2 - 20);
        g2.fillStyle = '#c9b090';
        g2.beginPath(); g2.ellipse(w2 / 2, 70, 26, 34 + seedFace * 6, 0, 0, 7); g2.fill();
        g2.fillStyle = '#1a1208';
        g2.beginPath(); g2.arc(w2 / 2 - 10, 62, 4 + seedFace, 0, 7); g2.fill();
        g2.beginPath(); g2.arc(w2 / 2 + 10, 62, 4, 0, 7); g2.fill();
        g2.beginPath(); g2.arc(w2 / 2, 88 + seedFace * 4, 7, 0, Math.PI, seedFace % 2 === 0); g2.stroke();
        g2.strokeStyle = '#1a1208'; g2.lineWidth = 3; g2.stroke();
      });
      const p3 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.9 }));
      p3.position.set(x2, L2 + 1.9, z2); p3.rotation.y = ry2; p3.receiveShadow = true;
      scene.add(p3);
    };
    badPortrait(-4, -8.92, 0, 0); badPortrait(-1, -8.92, 0, 1); badPortrait(3, -8.92, 0, 2); badPortrait(5.4, -8.92, 0, 3);
    wallSign(['THE OTHERS', '(we tried)'], 1.1, 0.4, 0.9, L2 + 2.6, -8.92, 0, {});
    // console table + dead ferns
    boxAt(1.4, 0.75, 0.45, woodM, 8.6, L2 + 0.37, -8.6);
    addCollider(8.6, -8.6, 1.4, 0.45, L2 + 0.75, L2);
    cylAt(0.18, 0.22, 0.3, std(0x8a5a2a, { roughness: 0.95 }), 8.2, L2 + 0.9, -8.6);
    [[8.6, -8.6], [-12.5, -5.5]].forEach(([fx, fz]) => {
      const pot = cylAt(0.2, 0.26, 0.4, std(0xa8542a, { roughness: 0.9 }), fx + 0.4, L2 + 0.2, fz);
      pot.castShadow = true;
      for (let i = 0; i < 5; i++) {
        const frond = boxAt(0.04, 0.7, 0.04, std(0x5a5230, { roughness: 1 }), fx + 0.4, L2 + 0.7, fz);
        frond.rotation.z = (i - 2) * 0.35; frond.rotation.x = 0.55; // wilted with dignity
      }
    });
    speakers.push({ name: 'THE BANNISTER', x: -8.9, y: L2 + 1.0, z: -5.9, radius: 3.0, lines: [
      'please do not slide down me. please. ...slide.',
      'i have dropped exactly one person. he deserved it.',
      'polished daily by ghosts. you are welcome.',
      'the chandelier is showing off again.',
      'mind the gap. the gap minds you.',
    ] });
  }

  // ================= THE ATTIC (interior) =================
  {
    // rafters
    for (let i = 0; i < 6; i++) {
      const r2 = boxAt(0.18, 0.24, 12, std(0x33220f, { roughness: 0.95 }), -12 + i * 1.9, ATT + 2.1, -11);
      r2.rotation.z = (i % 2 ? 1 : -1) * 0.02;
    }
    // box canyon: stacks with labels, climbable
    const boxTexLbl = (lbl) => cv(128, 128, (g2, w2, h2) => {
      g2.fillStyle = '#6b4a26'; g2.fillRect(0, 0, w2, h2);
      g2.strokeStyle = '#2e1c0b'; g2.lineWidth = 6; g2.strokeRect(3, 3, w2 - 6, h2 - 6);
      g2.fillStyle = '#1c1108'; g2.font = 'bold 20px Courier New'; g2.textAlign = 'center';
      g2.fillText(lbl, w2 / 2, h2 / 2 + 7);
    });
    [['1987', -11.8, -15.8, 0.7], ['REGRETS', -11.0, -15.9, 1.3], ['HAIR', -10.1, -15.7, 0.65],
     ['GRANDMA?', -6.2, -16.2, 1.25], ['XMAS 3', -5.4, -16.0, 0.6], ['DO NOT', -4.4, -15.4, 1.9]].forEach(([lbl, bx2, bz2, h2]) => {
      let y2 = ATT;
      while (y2 < ATT + h2 - 0.05) {
        const s2 = 0.62 - rnd() * 0.06;
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(s2, 0.6, s2), new THREE.MeshStandardMaterial({ map: boxTexLbl(lbl), roughness: 0.9 }));
        b2.position.set(bx2 + rnd() * 0.05, y2 + 0.3, bz2 + rnd() * 0.05); b2.rotation.y = rnd() * 0.3;
        b2.castShadow = b2.receiveShadow = true; scene.add(b2);
        y2 += 0.6;
      }
      addCollider(bx2, bz2, 0.65, 0.65, ATT + h2, ATT);
    });
    // the mannequin family. one of them is patient.
    const manns = [];
    const buildMann = (x2, z2, ry2) => {
      const mg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 10), std(0xb8a890, { roughness: 0.85 }));
      body.position.y = 0.95; mg.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), std(0xc9b8a0, { roughness: 0.8 }));
      head.position.y = 1.62; mg.add(head);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8), std(0x8a7a62, { roughness: 0.8 }));
      neck.position.y = 1.46; mg.add(neck);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.06, 12), darkM);
      base.position.y = 0.03; mg.add(base);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), darkM);
      rod.position.y = 0.3; mg.add(rod);
      mg.position.set(x2, ATT, z2); mg.rotation.y = ry2;
      mg.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(mg);
      addCollider(x2, z2, 0.5, 0.5, ATT + 1.1, ATT);
      return mg;
    };
    manns.push(buildMann(-8.4, -14.8, 0.6));
    manns.push(buildMann(-7.2, -15.2, -0.4));
    mannequinsOut.push(manns[0], manns[1]); // possession candidates for the dead
    const walker = buildMann(-4.8, -8.2, 2.6); // this one has ambitions
    let walkerHome = { x: -4.8, z: -8.2 };
    tickers.push((t, dt, p2) => {
      manns.forEach((m2, i) => { // the standing ones just... track you
        if (m2.userData.possessed) return; // this one has a tenant
        const want = Math.atan2(p2.x - m2.position.x, p2.z - m2.position.z);
        let d3 = want - m2.rotation.y;
        while (d3 > Math.PI) d3 -= Math.PI * 2; while (d3 < -Math.PI) d3 += Math.PI * 2;
        m2.rotation.y += d3 * Math.min(1, dt * (0.15 + i * 0.1));
      });
      // the walker only creeps toward you while you are NOT looking at it (attic only)
      if (Math.abs((p2.y || 0) - ATT) < 1.2) {
        const yaw2 = window.GD3 ? window.GD3.P.yaw : 0;
        const dx2 = walker.position.x - p2.x, dz2 = walker.position.z - p2.z;
        const dd = Math.hypot(dx2, dz2) || 1;
        const facing = (-Math.sin(yaw2)) * (dx2 / dd) + (-Math.cos(yaw2)) * (dz2 / dd);
        if (facing < 0.25 && dd > 1.6) { // unwatched and not yet at your neck
          walker.position.x -= (dx2 / dd) * 0.32 * dt;
          walker.position.z -= (dz2 / dd) * 0.32 * dt;
          walker.rotation.y = Math.atan2(-dx2, -dz2);
        }
      } else if (Math.hypot(walker.position.x - walkerHome.x, walker.position.z - walkerHome.z) > 0.1) {
        walker.position.x += (walkerHome.x - walker.position.x) * Math.min(1, dt * 0.4); // shuffles home when you leave
        walker.position.z += (walkerHome.z - walker.position.z) * Math.min(1, dt * 0.4);
      }
    });
    // sheet ghost (it is a sheet. probably.)
    const sheet = new THREE.Group();
    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.7, 12), std(0xd8d2c4, { roughness: 0.95 }));
    cone2.position.y = 0.85; sheet.add(cone2);
    [[-0.14], [0.14]].forEach(([ox]) => {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
      eye.position.set(ox, 1.18, 0.42); sheet.add(eye);
    });
    sheet.position.set(-10.6, ATT, -12.4);
    sheet.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(sheet);
    addCollider(-10.6, -12.4, 0.7, 0.7, ATT + 1.4, ATT);
    tickers.push(t => { sheet.position.y = ATT + Math.max(0, Math.sin(t * 0.9)) * 0.06; sheet.rotation.y = Math.sin(t * 0.4) * 0.3; });
    // rocking chair. nobody rocks it. it rocks.
    const rock = new THREE.Group();
    const seat2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.55), woodM); seat2.position.y = 0.45; rock.add(seat2);
    const back2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.07), woodM); back2.position.set(0, 0.85, -0.26); rock.add(back2);
    [[-0.26], [0.26]].forEach(([ox]) => {
      const runn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.9), woodM); runn.position.set(ox, 0.05, 0); rock.add(runn);
      [[0.18], [-0.18]].forEach(([oz]) => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), woodM); leg.position.set(ox, 0.26, oz); rock.add(leg); });
    });
    rock.position.set(-12.2, ATT, -14.8); rock.rotation.y = 0.9;
    rock.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(rock);
    addCollider(-12.2, -14.8, 0.7, 0.7, ATT + 0.5, ATT);
    tickers.push(t => { rock.rotation.x = Math.sin(t * 1.7) * 0.09; });
    // the steamer trunk: a hiding spot with history
    const trunkG = new THREE.Group();
    const tb = new THREE.Mesh(rbox(1.3, 0.62, 0.8, 0.06), std(0x5a3a22, { roughness: 0.85 }));
    tb.position.y = 0.31; trunkG.add(tb);
    const lid = new THREE.Mesh(rbox(1.3, 0.1, 0.8, 0.04), std(0x4a2f1a, { roughness: 0.85 }));
    lid.position.set(0, 0.68, -0.3); lid.rotation.x = -0.9; trunkG.add(lid); // ajar
    [[-0.5], [0.5]].forEach(([ox]) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.64, 0.82), brassM);
      strap.position.set(ox, 0.31, 0); trunkG.add(strap);
    });
    trunkG.position.set(-5.4, ATT, -12.6);
    trunkG.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(trunkG);
    addCollider(-5.4, -12.6, 1.3, 0.8, ATT + 0.62, ATT);
    hideys.push({ id: 'trunk', label: 'THE STEAMER TRUNK', x: -4.5, z: -12.6, inX: -5.4, inZ: -12.6, inYaw: Math.PI / 2, outX: -4.4, outZ: -12.5, y: ATT, crouch: true });
    // leaning paintings, one facing the wall (it knows why)
    [[-3.4, -6.3, -0.3], [-3.35, -7.2, 0.2]].forEach(([px2, pz2, tilt]) => {
      const fr = boxAt(0.8, 1.0, 0.06, woodM, px2, ATT + 0.5, pz2, Math.PI / 2 + tilt);
      fr.rotation.z = 0.08;
    });
    wallSign(['(faces the wall)', 'it knows why'], 1.0, 0.4, -3.08, ATT + 1.3, -6.8, -Math.PI / 2, {});
    cobweb(-12.6, -16.5, 0.6, ATT + 1.9); cobweb(-3.5, -16.4, -0.8, ATT + 1.9);
    speakers.push({ name: 'THE MANNEQUINS', x: -7.8, y: ATT + 1.5, z: -15, radius: 3.6, lines: [
      'we were here first.',
      'the one behind you is new.',
      'we do not move. we REPOSITION.',
      'try the trunk. gerald loved the trunk.',
      'it gets so quiet up here between footsteps.',
      'do not count us. the number changes.',
    ] });
  }

  // ---------- practicals: every open flame gets an additive glow sprite ----------
  const flameTex = cv(64, 64, (g2) => {
    const rg = g2.createRadialGradient(32, 34, 2, 32, 34, 30);
    rg.addColorStop(0, 'rgba(255,220,150,.9)');
    rg.addColorStop(0.35, 'rgba(255,150,60,.45)');
    rg.addColorStop(1, 'rgba(255,90,20,0)');
    g2.fillStyle = rg; g2.beginPath(); g2.arc(32, 32, 31, 0, 7); g2.fill();
  });
  const flameSpriteMat = new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const flameSprites = [];
  function flameGlow(x, y, z, s = 0.34) {
    const sp = new THREE.Sprite(flameSpriteMat);
    sp.position.set(x, y, z); sp.scale.set(s, s * 1.25, 1);
    sp.userData.s = s;
    scene.add(sp); flameSprites.push(sp);
  }
  // hall sconces (candle sits 0.07 off the plate, toward the room)
  [[-7.2, -8.79], [2.6, -8.79], [-11, -5.21], [6, -5.21]].forEach(([x, z]) => flameGlow(x, 2.28, z));
  // crypt candelabras, three candles each
  [[9.3, 2.2], [13.5, -0.5]].forEach(([x, z]) => { for (let i = -1; i <= 1; i++) flameGlow(x + i * 0.14, 1.73, z, 0.22); });
  // den fireplace mouth
  flameGlow(-3.9, 0.42, -4.46, 0.8);
  // stairwell chandelier, six candles
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    flameGlow(-10.7 + Math.cos(a) * 0.55, 5.45 + 0.31, -5.85 + Math.sin(a) * 0.55, 0.26);
  }
  tickers.push(t => {
    for (let i = 0; i < flameSprites.length; i++) {
      const sp = flameSprites[i];
      const k = 0.82 + 0.26 * Math.abs(Math.sin(t * 6.7 + i * 1.7)) * (0.7 + 0.3 * Math.sin(t * 13 + i));
      sp.scale.set(sp.userData.s * k, sp.userData.s * 1.25 * k, 1);
    }
  });
  // arcade corner screen-glow: sick green light with a crash-blink stutter
  const arcGlow = new THREE.PointLight(0x52e87a, 2.6, 3.6, 2);
  arcGlow.position.set(-5.35, L2 + 1.35, 2.9); scene.add(arcGlow);
  tickers.push(t => { arcGlow.intensity = 2.2 + 0.5 * Math.sin(t * 13) + (Math.sin(t * 3.1) > 0.9 ? -1.4 : 0); });
  // den fireplace embers: little sparks that ride the draft and die young
  const emberMat = new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xff8a40 });
  const embers = [];
  for (let i = 0; i < 9; i++) {
    const e = new THREE.Sprite(emberMat);
    e.userData.ph = rnd(); e.userData.ox = (rnd() - 0.5) * 0.62; e.userData.sp2 = 0.55 + rnd() * 0.5;
    e.scale.set(0.05, 0.05, 1);
    scene.add(e); embers.push(e);
  }
  tickers.push(t => {
    embers.forEach(e => {
      const ph = (t * 0.22 * e.userData.sp2 + e.userData.ph) % 1;
      e.position.set(-3.9 + e.userData.ox + Math.sin(t * 2 + e.userData.ph * 9) * 0.05, 0.26 + ph * 0.62, -4.48);
      const a = ph < 0.7 ? 1 : (1 - ph) / 0.3;
      e.scale.setScalar(0.02 + 0.034 * a);
    });
  });

  // ---------- rooms + key lights ----------
  const soft = t => { let f = 0.88 + 0.12 * Math.sin(t * 11) * Math.sin(t * 4.7 + 2); if (Math.sin(t * 1.3) > 0.992) f *= 0.35; return f; };
  const buzz = t => { let f = 0.92 + 0.08 * Math.sin(t * 47) * Math.sin(t * 13); if (Math.sin(t * 2.1) > 0.995) f = 0.15; return f; };
  const hard = t => { let f = 0.85 + 0.15 * Math.sin(t * 29) * Math.sin(t * 7.3); if (Math.sin(t * 1.7) > 0.86) f *= 0.3; if (Math.sin(t * 0.77) > 0.95) f *= 0.1; return f; };
  const pulse = t => 0.72 + 0.28 * Math.sin(t * 1.1);
  const candle = t => 0.82 + 0.18 * Math.sin(t * 9) * Math.sin(t * 5.1 + 1);
  const disco = t => 0.8 + 0.2 * Math.sin(t * 2.4);
  const steady = () => 1;

  const rooms = [
    { name: 'THE DEN', x0: -7, z0: -5, x1: 7, z1: 5, color: 0xffb45c, base: 30, flick: soft,
      posFn: () => denBulb.getWorldPosition(V).clone() },
    { name: 'HALL OF PORTRAITS', x0: -13, z0: -9, x1: 10, z1: -5, color: 0xff9a55, base: 15, flick: candle, pos: [-1.5, 2.5, -7] },
    { name: 'THE NURSERY', x0: -13, z0: -17, x1: -3, z1: -9, color: 0x8fb7ff, base: 12, flick: pulse, pos: [-8, 2.5, -13] },
    { name: 'THE MEAT KITCHEN', x0: -3, z0: -17, x1: 5, z1: -9, color: 0xdfe8ff, base: 24, flick: buzz, pos: [1, 2.85, -13] },
    { name: 'BATHROOM OF DOOM', x0: 5, z0: -17, x1: 10, z1: -9, color: 0xcfe6c8, base: 13, flick: buzz, pos: [7.5, 2.7, -13] },
    { name: 'THE DISCO CRYPT', x0: 7, z0: -5, x1: 16, z1: 5, color: 0xb46cff, base: 16, flick: disco, pos: [11.5, 2.1, 0] },
    { name: 'THE GNOME YARD', x0: -7, z0: 5, x1: 3, z1: 14, color: 0x9db8e8, base: 18, flick: steady, pos: [-2, 2.85, 9.5] },
    { name: 'THE BASEMENT', x0: 3, z0: 5, x1: 12, z1: 14, color: 0xffb45c, base: 24, flick: hard, pos: [7.5, 2.3, 9.5] },
    // ---- upstairs (y 3.7) ----
    { name: 'THE LANDING', x0: -13, z0: -9, x1: 10, z1: -5, y0: 3.45, y1: 7.15, floorY: L2, lvl: 1,
      color: 0xffa964, base: 14, flick: candle, pos: [-1.5, L2 + 2.5, -7] },
    { name: 'MASTER BEDCHAMBER', x0: -13, z0: -17, x1: -3, z1: -9, y0: 3.45, y1: 7.15, floorY: L2, lvl: 1,
      color: 0xc9a2ff, base: 13, flick: soft, pos: [-8, L2 + 2.5, -13] },
    { name: 'LIBRARY OF LIES', x0: -3, z0: -17, x1: 4, z1: -9, y0: 3.45, y1: 7.15, floorY: L2, lvl: 1,
      color: 0xffc46a, base: 15, flick: candle, pos: [0.5, L2 + 2.5, -13] },
    { name: 'THE TROPHY ROOM', x0: 4, z0: -17, x1: 10, z1: -9, y0: 3.45, y1: 7.15, floorY: L2, lvl: 1,
      color: 0xd8b878, base: 14, flick: soft, pos: [7, L2 + 2.5, -13] },
    { name: 'THE GAME ROOM', x0: -7, z0: -5, x1: 7, z1: 5, y0: 3.45, y1: 7.15, floorY: L2, lvl: 1,
      color: 0x7ce8d0, base: 18, flick: buzz, pos: [0, L2 + 2.6, 0] },
    { name: 'THE OBSERVATORY', x0: 7, z0: -5, x1: 16, z1: 5, y0: 3.45, y1: 7.15, floorY: L2, lvl: 1,
      color: 0x8fa8ff, base: 14, flick: pulse, pos: [11.5, L2 + 2.7, 0] },
    // ---- attic (y 7.4) ----
    { name: 'THE ATTIC', x0: -13, z0: -17, x1: -3, z1: -5, y0: 7.15, y1: 10.6, floorY: ATT, lvl: 2,
      color: 0xffb45c, base: 12, flick: hard, pos: [-8, ATT + 1.9, -11] },
  ];
  rooms.forEach(r => {
    if (!r.posFn) { const p = r.pos; r.posFn = () => V.set(p[0], p[1], p[2]).clone(); }
    const fill = new THREE.PointLight(r.color, r.base * 0.3, 13, 1.9);
    const fp = r.posFn(); fill.position.copy(fp);
    scene.add(fill); r.fill = fill;
    tickers.push(t => { fill.intensity = r.base * 0.3 * r.flick(t); });
  });
  // sync den bulb + kitchen fluoro + basement bulb glow with their flickers
  tickers.push(t => {
    denBulb.material.color.setHSL(0.09, 0.85, 0.4 + 0.35 * soft(t));
    fluoro.material.emissiveIntensity = 0.4 + 0.8 * buzz(t);
    baseBulb.material.color.setHSL(0.09, 0.85, 0.15 + 0.55 * hard(t));
  });

  return {
    colliders, tickers, speakers, rooms, hideys, puddles,
    gnomeOmen: (x, z) => { omen = { x, z, left: 2.2 }; },
    applyHouseLevel,
    heist: { items: { skull: [12.7, 3.5], ham: [1.15, -12.6], crown: [-1.8, 11.3], orb: [12.5, 2.2, L2] }, chest: [-1.7, -4.35] },
    monsterSpawn: [7.5, 11.5],
    bounds: { x0: -12.6, z0: -16.6, x1: 15.6, z1: 13.6 },
    // stair footprints for the floorplan map: lo/hi are the levels they connect
    stairs: [
      { x0: -12.9, z0: -6.7, x1: -8.5, z1: -5, lo: 0, hi: 1 },
      { x0: -4.6, z0: -13.5, x1: -3.2, z1: -10.5, lo: 1, hi: 2 },
    ],
    levels: [{ y: 0, label: 'GROUND' }, { y: L2, label: 'UPSTAIRS' }, { y: ATT, label: 'ATTIC' }],
    slamDoor: (x, z) => slamDoorFn && slamDoorFn(x, z),
    mannequins: mannequinsOut,
    heroLights,
    potato: () => { heroLights.forEach(l => { l.castShadow = false; }); }, // 3d.js calls this when the fps dips
  };
}
