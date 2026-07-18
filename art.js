/* GIGGLEDOOM character art engine. Hand-painted canvas rigs. Zero emojis.
   All characters draw in a 120-unit-tall local space, feet at y=0, scaled to h px. */
'use strict';

const { artCreature, artMonster, artGhost, ART_HEAD_TOP } = (() => {
  const TAU = Math.PI * 2;

  // ---- colour helpers ----
  function hexRgb(hex) {
    let s = (hex || '#888888').replace('#', '');
    if (s.length === 3) s = s.split('').map(c => c + c).join('');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  const clamp01 = v => Math.max(0, Math.min(255, v | 0));
  // returns HEX so results can be fed back into rgba()/sh() safely
  function sh(hex, amt) {
    const [r, g, b] = hexRgb(hex);
    const h = v => clamp01(v).toString(16).padStart(2, '0');
    return `#${h(r + amt)}${h(g + amt)}${h(b + amt)}`;
  }
  function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
  const rnd = i => Math.abs(Math.sin(i * 127.13 + 311.7) * 43758.55) % 1; // deterministic

  // ---- shape helpers ----
  function softBody(g, x, y, rx, ry, base, rot) {
    // volumetric blob: core gradient + top sheen + under-shadow
    g.save(); g.translate(x, y); if (rot) g.rotate(rot);
    const grad = g.createRadialGradient(-rx * 0.35, -ry * 0.45, Math.min(rx, ry) * 0.2, 0, 0, Math.max(rx, ry) * 1.25);
    grad.addColorStop(0, sh(base, 52));
    grad.addColorStop(0.55, base);
    grad.addColorStop(1, sh(base, -72));
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
    // sheen
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath(); g.ellipse(-rx * 0.3, -ry * 0.45, rx * 0.42, ry * 0.3, -0.5, 0, TAU); g.fill();
    // ground occlusion
    const oc = g.createRadialGradient(0, ry * 0.7, 0, 0, ry * 0.7, rx);
    oc.addColorStop(0, 'rgba(0,0,0,0.28)'); oc.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = oc;
    g.beginPath(); g.ellipse(0, ry * 0.55, rx * 0.9, ry * 0.5, 0, 0, TAU); g.fill();
    g.restore();
  }

  function limb(g, x1, y1, cx, cy, x2, y2, w, base) {
    // tapered curved limb with core + shadow edge + light edge
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = sh(base, -55); g.lineWidth = w + 2.6;
    g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke();
    g.strokeStyle = base; g.lineWidth = w;
    g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke();
    g.strokeStyle = rgba('#ffffff', 0.18); g.lineWidth = Math.max(1.5, w * 0.35);
    g.beginPath(); g.moveTo(x1 - 1, y1 - 1); g.quadraticCurveTo(cx - 1.5, cy - 1.5, x2 - 1, y2 - 1); g.stroke();
  }

  function eye(g, x, y, r, o) {
    // o: {lookX, lookY, iris, lid (0..1 closed), fear, lidColor}
    o = o || {};
    const lid = Math.max(0, Math.min(1, o.lid || 0));
    const scl = o.fear ? r * 1.14 : r;
    // sclera
    const sg = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.2, x, y, scl);
    sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#c9d2e2');
    g.fillStyle = sg;
    g.beginPath(); g.ellipse(x, y, scl, scl * 1.06, 0, 0, TAU); g.fill();
    // iris + pupil clipped to eyeball
    g.save();
    g.beginPath(); g.ellipse(x, y, scl, scl * 1.06, 0, 0, TAU); g.clip();
    const ix = x + (o.lookX || 0) * r * 0.34, iy = y + (o.lookY || 0) * r * 0.34;
    const ir = o.fear ? r * 0.46 : r * 0.58;
    const ig = g.createRadialGradient(ix, iy - ir * 0.2, ir * 0.1, ix, iy, ir);
    ig.addColorStop(0, sh(o.iris || '#c98a2b', 65));
    ig.addColorStop(0.7, o.iris || '#c98a2b');
    ig.addColorStop(1, sh(o.iris || '#c98a2b', -70));
    g.fillStyle = ig;
    g.beginPath(); g.arc(ix, iy, ir, 0, TAU); g.fill();
    g.fillStyle = '#10090e';
    g.beginPath(); g.arc(ix, iy, o.fear ? ir * 0.38 : ir * 0.52, 0, TAU); g.fill();
    // wet highlights
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.arc(ix - ir * 0.3, iy - ir * 0.35, ir * 0.2, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.arc(ix + ir * 0.28, iy + ir * 0.3, ir * 0.1, 0, TAU); g.fill();
    // eyelid: slides down from the top of the eyeball
    if (lid > 0.02) {
      g.fillStyle = o.lidColor || '#333';
      g.beginPath();
      g.ellipse(x, y - scl * 1.06 + scl * 1.06 * lid, scl * 1.04, scl * 1.06 * lid, 0, 0, TAU);
      g.fill();
    }
    // soft top shadow
    g.fillStyle = 'rgba(20,10,30,0.18)';
    g.beginPath(); g.ellipse(x, y - scl * 0.72, scl * 0.95, scl * 0.35, 0, Math.PI, TAU); g.fill();
    g.restore();
    // outline
    g.strokeStyle = 'rgba(15,8,20,0.55)'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(x, y, scl, scl * 1.06, 0, 0, TAU); g.stroke();
  }

  function teethRow(g, x, y, w, n, hgt, up, jitterSeed) {
    g.fillStyle = '#f4f0e4';
    for (let i = 0; i < n; i++) {
      const tx = x - w / 2 + (w / (n - 1)) * i;
      const th = hgt * (0.7 + rnd(i + (jitterSeed || 0)) * 0.6);
      g.beginPath();
      g.moveTo(tx - w / n * 0.34, y);
      g.lineTo(tx + w / n * 0.34, y);
      g.lineTo(tx, y + (up ? -th : th));
      g.closePath(); g.fill();
    }
  }

  function mouthFor(g, mx, my, o, t, palette) {
    // shared talk / laugh mouth. palette: {inner, tongue}
    if (o.laugh) {
      const open = 11 + Math.abs(Math.sin(t / 70)) * 4;
      const mg = g.createRadialGradient(mx, my + 3, 2, mx, my + 4, open + 6);
      mg.addColorStop(0, '#5e0f1e'); mg.addColorStop(1, '#1c0208');
      g.fillStyle = mg;
      g.beginPath(); g.ellipse(mx, my + 2, 11.5, open, 0, 0, TAU); g.fill();
      teethRow(g, mx, my - open + 3.5, 17, 5, 4, false, 3);
      g.fillStyle = '#c4374f';
      g.beginPath(); g.ellipse(mx, my + open * 0.55, 6.5, 3.6, 0, Math.PI, TAU); g.fill();
      g.strokeStyle = 'rgba(15,8,20,0.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(mx, my + 2, 11.5, open, 0, 0, TAU); g.stroke();
      return;
    }
    if (o.talk) {
      const open = (2.6 + o.talk * 2.6) * (0.55 + 0.45 * Math.abs(Math.sin(t / 90)));
      g.fillStyle = '#2a0510';
      g.beginPath(); g.ellipse(mx, my, 5 + o.talk * 1.2, open, 0, 0, TAU); g.fill();
      g.fillStyle = '#b03048';
      g.beginPath(); g.ellipse(mx, my + open * 0.5, 3.4, open * 0.4, 0, Math.PI, TAU); g.fill();
      return;
    }
    if (o.fear) {
      // trembling clenched frown
      g.strokeStyle = '#2a0510'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath();
      const wob = Math.sin(t / 45) * 0.8;
      g.moveTo(mx - 7, my + 2 + wob);
      g.quadraticCurveTo(mx - 3.5, my - 2, mx, my + 1.5 - wob);
      g.quadraticCurveTo(mx + 3.5, my + 4, mx + 7, my + wob);
      g.stroke();
    }
  }

  function tears(g, x, y, t) {
    g.fillStyle = 'rgba(140,214,255,0.9)';
    for (const s of [-1, 1]) {
      const drop = (t / 55 + (s + 1) * 4) % 12;
      g.beginPath(); g.ellipse(x + 19 * s, y + drop, 2.6, 4, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(x + 15 * s, y + ((drop + 7) % 12), 1.8, 3, 0, 0, TAU); g.fill();
    }
  }

  function sweat(g, x, y, t) {
    const p = (t / 900) % 1;
    g.fillStyle = `rgba(150,220,255,${0.85 * (1 - p)})`;
    g.beginPath(); g.ellipse(x, y + p * 14, 2.2, 3.4, 0, 0, TAU); g.fill();
  }

  // blink: mostly open, quick double-blink sometimes
  function blinkAmt(t, seed) {
    const ph = (t / 3400 + rnd(seed) * 7) % 1;
    if (ph < 0.045) return Math.sin((ph / 0.045) * Math.PI);
    if (ph > 0.09 && ph < 0.125) return Math.sin(((ph - 0.09) / 0.035) * Math.PI) * 0.85;
    return 0;
  }

  // =====================================================================
  // ZOOMY: manic teal hare. Long bent ears, buck teeth, huge sneakers.
  // =====================================================================
  function drawZoomy(g, t, o) {
    const base = o.tint || '#37d6c6';
    const dk = sh(base, -55), belly = sh(base, 40);
    const walk = o.moving ? Math.sin(t / 80) : 0;
    const lean = o.moving ? 0.14 : 0;
    const breathe = Math.sin(t / 470) * 1.4;
    const blink = blinkAmt(t, (o.seed || 0) + 1);
    const look = { x: Math.sin(t / 700 + (o.seed || 0)), y: Math.cos(t / 900) * 0.6 };
    const SNKR = '#e8404f';

    // --- legs + sneakers ---
    for (const s of [-1, 1]) {
      const ph = walk * s;
      const footX = s * 11 + ph * 9, footY = -3 - Math.max(0, Math.sin((t / 80) * 1) * (s > 0 ? 1 : -1)) * (o.moving ? 5 : 0);
      limb(g, s * 7, -36, s * 10 + ph * 4, -18, footX, footY - 2, 6, dk);
      // sneaker
      g.save(); g.translate(footX, footY); g.rotate(ph * 0.14);
      const sg = g.createLinearGradient(0, -7, 0, 4);
      sg.addColorStop(0, sh(SNKR, 30)); sg.addColorStop(1, sh(SNKR, -35));
      g.fillStyle = sg;
      g.beginPath(); g.roundRect(-12, -8, 25, 11, 6); g.fill();
      g.fillStyle = '#f3ede0';
      g.beginPath(); g.roundRect(-12.5, -1, 26, 5, 3); g.fill(); // sole
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(3, -5, 2, 0, TAU); g.fill(); // lace dot
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.roundRect(-12, -8, 25, 11, 6); g.stroke();
      g.restore();
    }

    g.save(); g.rotate(lean * (o.moving ? 1 : 0));
    // --- torso: narrow bean, chest patch, racing stripe ---
    softBody(g, 0, -50 - breathe * 0.4, 15, 20 + breathe, base);
    g.fillStyle = rgba(belly, 0.9);
    g.beginPath(); g.ellipse(0, -46, 8.5, 13, 0, 0, TAU); g.fill();
    g.fillStyle = rgba('#ffffff', 0.25);
    g.fillRect(-2, -68, 4, 34); // stripe

    // --- arms: wiry, pumping when running ---
    for (const s of [-1, 1]) {
      const ph = walk * -s;
      limb(g, s * 12, -58, s * (20 + ph * 5), -50 + ph * 6, s * (16 + ph * 8), -36 + ph * 10, 5, dk);
      g.fillStyle = base;
      g.beginPath(); g.arc(s * (16 + ph * 8), -36 + ph * 10, 4.2, 0, TAU); g.fill();
    }

    // --- head ---
    const hy = -88 + (o.moving ? Math.abs(walk) * 2 : breathe * 0.5);
    // ears: long, one bent
    for (const s of [-1, 1]) {
      const twitch = Math.max(0, Math.pow(Math.sin(t / 950 + s * 2 + (o.seed || 0)), 15)) * 0.5;
      g.save(); g.translate(s * 9, hy - 12); g.rotate(s * 0.28 + twitch * s + (o.moving ? -s * 0.18 : 0));
      const eg = g.createLinearGradient(0, 0, 0, -34);
      eg.addColorStop(0, base); eg.addColorStop(1, sh(base, -35));
      g.fillStyle = eg;
      g.beginPath();
      g.moveTo(-4.5, 0); g.quadraticCurveTo(-6, -22, s > 0 ? 2 : -2, -33);
      g.quadraticCurveTo(7, -26, 4.5, -2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,140,160,0.75)';
      g.beginPath(); g.ellipse(0, -16, 2.6, 11, 0, 0, TAU); g.fill();
      g.restore();
    }
    softBody(g, 0, hy, 17.5, 16.5, base);
    // cheek fluff
    g.strokeStyle = dk; g.lineWidth = 1.6; g.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(s * 15, hy + 4 + i * 2.5);
      g.lineTo(s * (18.5 + i * 0.5), hy + 5.5 + i * 2.8);
      g.stroke();
    }
    // muzzle
    g.fillStyle = belly;
    g.beginPath(); g.ellipse(0, hy + 8, 9, 6.5, 0, 0, TAU); g.fill();
    // eyes: big, amber, manic
    eye(g, -7.5, hy - 2, 6.2, { lookX: look.x, lookY: look.y, iris: '#ffb63d', lid: blink, fear: o.fear, lidColor: base });
    eye(g, 7.5, hy - 2, 6.2, { lookX: look.x, lookY: look.y, iris: '#ffb63d', lid: blink, fear: o.fear, lidColor: base });
    // brows
    g.strokeStyle = dk; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(-11, hy - 9 - (o.fear ? 3 : 0)); g.lineTo(-3, hy - 10.5 - (o.fear ? 1 : 0)); g.stroke();
    g.beginPath(); g.moveTo(11, hy - 9 - (o.fear ? 3 : 0)); g.lineTo(3, hy - 10.5 - (o.fear ? 1 : 0)); g.stroke();
    // nose + buck teeth
    g.fillStyle = '#e8607a';
    g.beginPath(); g.moveTo(-2.6, hy + 5); g.lineTo(2.6, hy + 5); g.lineTo(0, hy + 8); g.closePath(); g.fill();
    if (!o.laugh && !o.talk && !o.fear) {
      g.fillStyle = '#f7f3e7';
      g.beginPath(); g.roundRect(-3.6, hy + 9, 3.3, 5.5, 1.2); g.fill();
      g.beginPath(); g.roundRect(0.4, hy + 9, 3.3, 5.5, 1.2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(0, hy + 9); g.lineTo(0, hy + 14); g.stroke();
      g.strokeStyle = 'rgba(15,8,20,0.6)'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(0, hy + 8.5, 4.5, 0.25, Math.PI - 0.25); g.stroke();
    }
    mouthFor(g, 0, hy + 11, o, t);
    if (o.laugh) tears(g, 0, hy - 2, t);
    if (o.moving || o.fear) sweat(g, -14, hy - 14, t);
    g.restore();
  }

  // =====================================================================
  // BIG SLURP: colossal smug pink bean. Belly folds, heavy lids, drool.
  // =====================================================================
  function drawSlurp(g, t, o) {
    const base = o.tint || '#ff93b0';
    const dk = sh(base, -55), belly = sh(base, 42);
    const jig = Math.sin(t / 210) * (o.moving ? 2.4 : 1.1);
    const breathe = Math.sin(t / 520) * 2;
    const blink = Math.max(blinkAmt(t, (o.seed || 0) + 2), 0.42); // permanently heavy-lidded
    const look = { x: Math.sin(t / 1000 + (o.seed || 0)) * 0.7, y: 0.35 };

    // stub feet
    for (const s of [-1, 1]) {
      g.fillStyle = dk;
      g.beginPath(); g.ellipse(s * 17 + (o.moving ? Math.sin(t / 150) * 3 * s : 0), -3, 10, 5.5, 0, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', 0.12);
      g.beginPath(); g.ellipse(s * 17, -5, 6, 2.4, 0, 0, TAU); g.fill();
    }
    // THE BELLY
    g.save(); g.translate(0, jig * 0.4);
    softBody(g, 0, -42 - breathe * 0.5, 42 + jig, 40 + breathe, base);
    // belly plate
    g.fillStyle = rgba(belly, 0.95);
    g.beginPath(); g.ellipse(0, -34, 26 + jig * 0.7, 26, 0, 0, TAU); g.fill();
    // folds: soft smile-curves low on the belly
    g.strokeStyle = rgba(sh(base, -70), 0.45); g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.arc(0, -22, 17, 0.35, Math.PI - 0.35); g.stroke();
    g.beginPath(); g.arc(0, -16, 12, 0.45, Math.PI - 0.45); g.stroke();
    // belly button
    g.fillStyle = sh(base, -75);
    g.beginPath(); g.ellipse(0, -24, 2.4, 3.2, 0, 0, TAU); g.fill();
    // tiny arms resting on the belly
    for (const s of [-1, 1]) {
      limb(g, s * 38, -52, s * 47, -44, s * 44, -34 + Math.sin(t / 400 + s) * 1.5, 7.5, base);
      g.fillStyle = sh(base, 15);
      g.beginPath(); g.arc(s * 44, -33 + Math.sin(t / 400 + s) * 1.5, 5, 0, TAU); g.fill();
    }
    // head: merged into body top, chins
    const hy = -78 - breathe * 0.6;
    softBody(g, 0, hy, 19, 15, base);
    g.strokeStyle = rgba(sh(base, -60), 0.55); g.lineWidth = 2;
    g.beginPath(); g.arc(0, hy + 13, 13, 0.4, Math.PI - 0.4); g.stroke(); // chin fold
    // ear nubs
    for (const s of [-1, 1]) {
      g.fillStyle = sh(base, -18);
      g.beginPath(); g.ellipse(s * 15, hy - 10, 4.5, 5.5, s * 0.4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,120,150,0.5)';
      g.beginPath(); g.ellipse(s * 15, hy - 10, 2.2, 3, s * 0.4, 0, TAU); g.fill();
    }
    // dopey half-lidded eyes
    eye(g, -8, hy - 2, 5.6, { lookX: look.x, lookY: look.y, iris: '#7fc4ff', lid: o.fear ? 0.05 : blink, fear: o.fear, lidColor: base });
    eye(g, 8, hy - 2, 5.6, { lookX: look.x, lookY: look.y, iris: '#7fc4ff', lid: o.fear ? 0.05 : blink, fear: o.fear, lidColor: base });
    // snout
    g.fillStyle = sh(base, 22);
    g.beginPath(); g.ellipse(0, hy + 6.5, 7.5, 5, 0, 0, TAU); g.fill();
    g.fillStyle = sh(base, -60);
    g.beginPath(); g.ellipse(-2.4, hy + 6, 1.2, 2, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(2.4, hy + 6, 1.2, 2, 0, 0, TAU); g.fill();
    // content smile + single tooth
    if (!o.laugh && !o.talk && !o.fear) {
      g.strokeStyle = sh(base, -80); g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.arc(0, hy + 9, 9, 0.3, Math.PI - 0.3); g.stroke();
      g.fillStyle = '#f7f3e7';
      g.beginPath(); g.roundRect(-2, hy + 13.5, 4, 4.5, 1.2); g.fill();
    }
    mouthFor(g, 0, hy + 13, o, t);
    if (o.laugh) tears(g, 0, hy - 2, t);
    // drool
    const dp = (t / 1300) % 1;
    g.fillStyle = `rgba(160,235,255,${0.75 * (1 - dp)})`;
    g.beginPath(); g.ellipse(8.5, hy + 15 + dp * 16, 2, 3.6 + dp * 2, 0, 0, TAU); g.fill();
    g.restore();
  }

  // =====================================================================
  // LIL GREMLIN: hunched green chaos. Bat ears, snaggle teeth, gold tooth.
  // =====================================================================
  function drawGremlin(g, t, o) {
    const base = o.tint || '#79d24d';
    const dk = sh(base, -55), lt = sh(base, 38);
    const walk = o.moving ? Math.sin(t / 75) : 0;
    const breathe = Math.sin(t / 430) * 1.2;
    const blink = blinkAmt(t, (o.seed || 0) + 3);
    const look = { x: Math.sin(t / 480 + (o.seed || 0)) * 1.1, y: Math.cos(t / 620) * 0.8 };

    // digitigrade legs + clawed feet
    for (const s of [-1, 1]) {
      const ph = walk * s;
      const fx = s * 12 + ph * 8, fy = -2 - (o.moving ? Math.max(0, -Math.sin(t / 75) * s) * 4 : 0);
      limb(g, s * 8, -22, s * 15 + ph * 3, -14, fx, fy - 2, 5.5, dk);
      g.fillStyle = dk;
      g.beginPath(); g.ellipse(fx + s * 2, fy, 8, 4, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8e4d4'; // claws
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(fx + s * 6 + i * 3, fy - 1.5); g.lineTo(fx + s * 6 + i * 3 + 2.6 * s, fy - 0.5); g.lineTo(fx + s * 6 + i * 3, fy + 1.5);
        g.closePath(); g.fill();
      }
    }
    // spiky little tail
    g.strokeStyle = dk; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-10, -20);
    g.quadraticCurveTo(-22, -16 + Math.sin(t / 300) * 3, -26, -24 + Math.sin(t / 300) * 4); g.stroke();
    g.fillStyle = dk;
    g.beginPath(); g.moveTo(-29, -28); g.lineTo(-22, -24); g.lineTo(-27, -20); g.closePath(); g.fill();

    // hunched body
    g.save(); g.rotate(0.06 + (o.moving ? 0.08 : 0));
    softBody(g, 0, -30 - breathe * 0.3, 15, 14 + breathe * 0.6, base);
    g.fillStyle = rgba(lt, 0.85);
    g.beginPath(); g.ellipse(0, -27, 8.5, 8.5, 0, 0, TAU); g.fill();
    // knuckle-dragger arms
    for (const s of [-1, 1]) {
      const ph = walk * -s * 0.6;
      limb(g, s * 12, -36, s * 22, -24 + ph * 3, s * 24 + ph * 4, -6, 5, dk);
      // claw hand
      g.fillStyle = base;
      g.beginPath(); g.arc(s * 24 + ph * 4, -6, 4.6, 0, TAU); g.fill();
      g.fillStyle = '#e8e4d4';
      for (let i = 0; i < 3; i++) {
        const ang = -Math.PI / 2 + (i - 1) * 0.5;
        g.beginPath();
        g.moveTo(s * 24 + ph * 4 + Math.cos(ang) * 4, -6 + Math.sin(ang) * 4);
        g.lineTo(s * 24 + ph * 4 + Math.cos(ang) * 8.6, -6 + Math.sin(ang) * 8.6);
        g.lineTo(s * 24 + ph * 4 + Math.cos(ang + 0.35) * 4, -6 + Math.sin(ang + 0.35) * 4);
        g.closePath(); g.fill();
      }
    }

    // oversized head
    const hy = -58 + breathe * 0.4;
    // bat ears with notch tears
    for (const s of [-1, 1]) {
      const flap = Math.sin(t / 260 + s) * 0.06 + (o.fear ? -0.25 * s : 0);
      g.save(); g.translate(s * 16, hy - 4); g.rotate(s * 0.75 + flap);
      const eg = g.createLinearGradient(0, 0, 0, -26);
      eg.addColorStop(0, base); eg.addColorStop(1, sh(base, -40));
      g.fillStyle = eg;
      g.beginPath();
      g.moveTo(-7, 2); g.lineTo(s > 0 ? 8 : -2, -26); g.lineTo(s > 0 ? 12 : 4, -12);
      g.lineTo(s > 0 ? 15 : 8, -18); g.lineTo(10, 4); g.closePath(); g.fill(); // notched silhouette
      g.fillStyle = 'rgba(255,130,150,0.55)';
      g.beginPath(); g.moveTo(-2, 0); g.lineTo(s > 0 ? 6 : 0, -18); g.lineTo(7, -2); g.closePath(); g.fill();
      g.restore();
    }
    softBody(g, 0, hy, 21, 18, base);
    // warts
    g.fillStyle = sh(base, -30);
    g.beginPath(); g.arc(-14, hy - 8, 1.6, 0, TAU); g.fill();
    g.beginPath(); g.arc(16, hy + 3, 1.3, 0, TAU); g.fill();
    g.beginPath(); g.arc(-9, hy + 12, 1.2, 0, TAU); g.fill();
    // monobrow ridge
    g.fillStyle = dk;
    g.beginPath();
    g.moveTo(-14, hy - 7 - (o.fear ? 4 : 0)); g.quadraticCurveTo(0, hy - 12 - (o.fear ? 2 : -2), 14, hy - 7 - (o.fear ? 4 : 0));
    g.quadraticCurveTo(0, hy - 7 + (o.fear ? -1 : 3), -14, hy - 7 - (o.fear ? 4 : 0));
    g.closePath(); g.fill();
    // crazy eyes: small darting pupils
    eye(g, -8.5, hy - 1, 6, { lookX: look.x, lookY: look.y, iris: '#d8e34b', lid: blink, fear: o.fear, lidColor: base });
    eye(g, 8.5, hy - 1, 6, { lookX: -look.x * 0.7, lookY: look.y, iris: '#d8e34b', lid: blink, fear: o.fear, lidColor: base }); // walleyed
    // hooked nose
    g.fillStyle = sh(base, 12);
    g.beginPath(); g.moveTo(-2.5, hy + 3); g.quadraticCurveTo(0, hy + 11, 3.5, hy + 8); g.quadraticCurveTo(1, hy + 4, 2.5, hy + 3); g.closePath(); g.fill();
    // huge grin with snaggle teeth + one gold tooth
    if (!o.laugh && !o.talk && !o.fear) {
      g.fillStyle = '#2a0a14';
      g.beginPath();
      g.moveTo(-13, hy + 10); g.quadraticCurveTo(0, hy + 20 + breathe * 0.3, 13, hy + 10);
      g.quadraticCurveTo(0, hy + 15, -13, hy + 10); g.closePath(); g.fill();
      for (let i = 0; i < 5; i++) {
        const tx = -10 + i * 5;
        g.fillStyle = i === 3 ? '#f4c542' : '#f4f0e4';
        const th = 3 + rnd(i + 9) * 2.5;
        g.beginPath();
        g.moveTo(tx - 1.8, hy + 10.5 + (i % 2) * 1.5);
        g.lineTo(tx + 1.8, hy + 10.5 + (i % 2) * 1.5);
        g.lineTo(tx, hy + 10.5 + th + (i % 2) * 1.5);
        g.closePath(); g.fill();
      }
    }
    mouthFor(g, 0, hy + 13, o, t);
    if (o.laugh) tears(g, 0, hy - 1, t);
    if (o.fear) sweat(g, 17, hy - 12, t);
    g.restore();
  }

  // =====================================================================
  // WALLFISH: bioluminescent cephalopod. Glowing spots, frills, suckers.
  // =====================================================================
  function drawWallfish(g, t, o) {
    const base = o.tint || '#a06bff';
    const dk = sh(base, -55), lt = sh(base, 45);
    const hover = Math.sin(t / 420) * 3; // floats
    const blink = blinkAmt(t, (o.seed || 0) + 4);
    const look = { x: Math.sin(t / 800 + (o.seed || 0)) * 0.8, y: Math.cos(t / 950) * 0.7 + 0.2 };
    const wig = o.moving ? 1.6 : 1;

    g.save(); g.translate(0, hover);
    // tentacles: 6 tapered curves, front pair with sucker dots
    for (let i = 0; i < 6; i++) {
      const bx = -17.5 + i * 7;
      const ph = t / (160 + i * 22) + i * 1.7;
      const sway = Math.sin(ph) * 7 * wig;
      const tipX = bx + sway, tipY = -2 + Math.abs(Math.sin(ph * 0.7)) * 3;
      limb(g, bx * 0.75, -42, bx + sway * 0.5, -22, tipX, tipY, 6.2 - Math.abs(i - 2.5), i % 2 ? dk : base);
      if (i === 2 || i === 3) {
        g.fillStyle = rgba(lt, 0.9);
        for (let k = 1; k <= 3; k++) {
          g.beginPath();
          g.arc(bx * 0.75 + (tipX - bx * 0.75) * (k / 3.6), -42 + (tipY + 42) * (k / 3.6), 1.7, 0, TAU);
          g.fill();
        }
      }
    }
    // gill frills at mantle base
    for (const s of [-1, 1]) {
      g.fillStyle = rgba(sh(base, -25), 0.9);
      g.beginPath();
      const fy0 = -52;
      g.moveTo(s * 24, fy0);
      for (let k = 0; k < 3; k++) {
        const wob = Math.sin(t / 240 + k + s) * 2;
        g.quadraticCurveTo(s * (34 + wob), fy0 - 4 - k * 7, s * 24, fy0 - 8 - k * 7);
      }
      g.quadraticCurveTo(s * 18, fy0 - 12, s * 24, fy0);
      g.closePath(); g.fill();
    }
    // mantle: layered translucent dome
    g.save();
    g.globalAlpha *= 0.55;
    softBody(g, 0, -74, 31, 42, base); // outer glow layer
    g.restore();
    softBody(g, 0, -72, 26, 36, base);
    // inner core glow
    const cg = g.createRadialGradient(0, -84, 2, 0, -84, 22);
    cg.addColorStop(0, rgba(lt, 0.5)); cg.addColorStop(1, rgba(lt, 0));
    g.fillStyle = cg;
    g.beginPath(); g.ellipse(0, -84, 20, 26, 0, 0, TAU); g.fill();
    // bioluminescent freckles (pulse)
    for (let i = 0; i < 7; i++) {
      const a = rnd(i + 31) * TAU, rr = 12 + rnd(i + 77) * 14;
      const px = Math.cos(a) * rr * 0.8, py = -74 + Math.sin(a) * rr;
      const pulse = 0.45 + 0.55 * Math.sin(t / 500 + i * 1.9);
      g.fillStyle = `rgba(160,255,240,${0.5 * pulse})`;
      g.beginPath(); g.arc(px, py, 1.6 + pulse, 0, TAU); g.fill();
    }
    // enormous wet eyes
    eye(g, -11, -66, 8.5, { lookX: look.x, lookY: look.y, iris: '#2f6bff', lid: blink, fear: o.fear, lidColor: base });
    eye(g, 11, -66, 8.5, { lookX: look.x, lookY: look.y, iris: '#2f6bff', lid: blink, fear: o.fear, lidColor: base });
    // tiny w-beak
    if (!o.laugh && !o.talk && !o.fear) {
      g.strokeStyle = dk; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-4, -52); g.quadraticCurveTo(-2, -49.5, 0, -52); g.quadraticCurveTo(2, -49.5, 4, -52);
      g.stroke();
    }
    mouthFor(g, 0, -51, o, t);
    if (o.laugh) tears(g, 0, -66, t);
    if (o.fear) { // ink blush
      g.fillStyle = 'rgba(60,30,110,0.35)';
      g.beginPath(); g.ellipse(0, -58, 16, 7, 0, 0, TAU); g.fill();
    }
    g.restore();
  }

  // =====================================================================
  // dispatcher + shared chrome (aura, hat/prop, shadow handled by caller styles)
  // =====================================================================
  const HEADTOP = { zoomy: -122, slurp: -96, gremlin: -92, wallfish: -108 };
  const AURA_COLOR_LOCAL = { gold: '#ffe14d', toxic: '#52ffa8', royal: '#b28aff', fire: '#ff5470', rainbow: 'rainbow', sweat: '#7fd4ff' };

  function artCreature(g, cx, feetY, h, charId, t, o) {
    o = o || {};
    const s = h / 120;
    g.save();
    g.translate(cx, feetY);
    g.scale(s, s);
    g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    // contact shadow
    g.save(); g.globalAlpha *= 0.35; g.fillStyle = '#000';
    g.beginPath(); g.ellipse(0, 2, 34, 9, 0, 0, TAU); g.fill(); g.restore();
    // aura ring
    if (o.auraId && AURA_COLOR_LOCAL[o.auraId]) {
      const col = AURA_COLOR_LOCAL[o.auraId];
      for (let i = 0; i < 6; i++) {
        const a = t / 320 + i * (TAU / 6);
        g.save(); g.globalAlpha *= 0.55;
        g.fillStyle = col === 'rainbow' ? `hsl(${(t / 4 + i * 60) % 360},100%,62%)` : col;
        g.beginPath(); g.arc(Math.cos(a) * 44, -48 + Math.sin(a) * 34, 4.2, 0, TAU); g.fill();
        g.restore();
      }
    }
    if (charId === 'slurp') drawSlurp(g, t, o);
    else if (charId === 'gremlin' && drawGremlin) drawGremlin(g, t, o);
    else if (charId === 'wallfish' && drawWallfish) drawWallfish(g, t, o);
    else drawZoomy(g, t, o);
    // hat / held prop
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (o.acc) { g.font = '30px serif'; g.fillText(o.acc, 30, -36); }
    const hatY = (HEADTOP[charId] || -100) + 10;
    if (o.hat === '🤠') paintCowboyHat(g, 0, hatY + 4);
    else if (o.hat) { g.font = '34px serif'; g.fillText(o.hat, 0, hatY); }
    g.restore();
  }

  // the YEEHAW hat, painted (the emoji version is a whole second face — no)
  function paintCowboyHat(g, x, y) {
    const bg = g.createLinearGradient(x, y - 20, x, y + 4);
    bg.addColorStop(0, '#9a6a3c'); bg.addColorStop(1, '#5e3a1c');
    g.fillStyle = bg;
    g.beginPath(); g.ellipse(x, y, 24, 6.5, 0, 0, TAU); g.fill();          // brim
    g.beginPath(); g.roundRect(x - 12, y - 19, 24, 18, 6); g.fill();       // crown
    g.fillStyle = '#3c2410';
    g.beginPath(); g.roundRect(x - 12.5, y - 7, 25, 4.5, 2); g.fill();     // band
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath(); g.ellipse(x - 6, y - 14, 5, 7, -0.3, 0, TAU); g.fill(); // sheen
    g.strokeStyle = 'rgba(30,15,5,0.6)'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(x, y, 24, 6.5, 0, 0, TAU); g.stroke();
  }

  // =====================================================================
  // THE MONSTER: shaggy hue-tinted horror. Fur clumps, glowing eyes, maw.
  // =====================================================================
  function artMonster(g, cx, feetY, h, t, hue, o) {
    o = o || {};
    const s = h / 140;
    const H = ((hue % 360) + 360) % 360;
    const fur = l => `hsl(${H}, 62%, ${l}%)`;
    const heave = Math.sin(t / 380) * 3;
    const jaw = 10 + Math.abs(Math.sin(t / 600)) * 8 + (o.roar ? 14 : 0);
    g.save();
    g.translate(cx, feetY);
    g.scale(s, s);
    g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    // shadow
    g.save(); g.globalAlpha *= 0.4; g.fillStyle = '#000';
    g.beginPath(); g.ellipse(0, 3, 52, 12, 0, 0, TAU); g.fill(); g.restore();

    // hulking arms behind body, knuckles planted
    for (const sd of [-1, 1]) {
      limb(g, sd * 30, -78 + heave, sd * 52, -46, sd * 48, -8, 15, fur(20));
      g.fillStyle = fur(24);
      g.beginPath(); g.arc(sd * 48, -8, 11, 0, TAU); g.fill();
      g.fillStyle = '#e9e2cf';
      for (let i = 0; i < 3; i++) {
        const ang = -Math.PI / 2 + (i - 1) * 0.55;
        g.beginPath();
        g.moveTo(sd * 48 + Math.cos(ang) * 9, -8 + Math.sin(ang) * 9);
        g.lineTo(sd * 48 + Math.cos(ang) * 17, -8 + Math.sin(ang) * 17);
        g.lineTo(sd * 48 + Math.cos(ang + 0.4) * 9, -8 + Math.sin(ang + 0.4) * 9);
        g.closePath(); g.fill();
      }
    }

    // body: shaggy dome, back layer then front
    for (const [ry, li] of [[86, 16], [80, 26]]) {
      g.fillStyle = fur(li);
      g.beginPath();
      g.moveTo(-48, 0);
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (i / 16) * Math.PI;
        const wob = 1 + Math.sin(i * 2.7 + t / 300) * 0.045;
        const px = Math.cos(a) * 48 * wob;
        const py = (-ry - heave) * Math.max(0.06, Math.sin((i / 16) * Math.PI)) * 1 - 0;
        // clumped silhouette: alternate radius
        const clump = i % 2 ? 1 : 0.88;
        g.lineTo(px * clump, -((ry + heave) * Math.sin((i / 16) * Math.PI) * clump) - 0);
      }
      g.closePath(); g.fill();
    }
    // fur strokes along silhouette
    g.strokeStyle = fur(10); g.lineWidth = 2.2; g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + ((i + 0.5) / 14) * Math.PI;
      const px = Math.cos(a) * 44, py = -78 * Math.sin((i + 0.5) / 14 * Math.PI) - heave * 0.5;
      g.beginPath(); g.moveTo(px, py);
      g.lineTo(px + Math.cos(a) * 8, py - 6 - rnd(i) * 5); g.stroke();
    }
    // chest gradient core
    const cg = g.createRadialGradient(0, -46 - heave, 6, 0, -50, 60);
    cg.addColorStop(0, fur(34)); cg.addColorStop(1, rgba('#000000', 0));
    g.fillStyle = cg;
    g.beginPath(); g.ellipse(0, -48 - heave * 0.5, 40, 46, 0, 0, TAU); g.fill();

    // horns with ridges
    for (const sd of [-1, 1]) {
      g.save(); g.translate(sd * 24, -86 - heave); g.rotate(sd * 0.5);
      const hg = g.createLinearGradient(0, 0, 0, -26);
      hg.addColorStop(0, '#d8c9a8'); hg.addColorStop(1, '#8f8066');
      g.fillStyle = hg;
      g.beginPath();
      g.moveTo(-6, 2); g.quadraticCurveTo(sd * 6, -16, sd * 2, -26);
      g.quadraticCurveTo(sd * 10, -12, 6, 3); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(60,45,20,0.5)'; g.lineWidth = 1.4;
      for (let k = 1; k <= 3; k++) { g.beginPath(); g.moveTo(-5 + k, 2 - k * 5); g.lineTo(5 - k * 0.5, 3 - k * 5.4); g.stroke(); }
      g.restore();
    }

    // glowing asymmetric eyes (+ tiny third eye)
    const eyes = [[-16, -66, 8], [15, -68, 6.2], [2, -80, 2.8]];
    for (const [ex, ey2, er] of eyes) {
      const glow = g.createRadialGradient(ex, ey2 - heave * 0.4, 0.5, ex, ey2 - heave * 0.4, er * 2.6);
      glow.addColorStop(0, 'rgba(255,240,150,0.95)');
      glow.addColorStop(0.4, 'rgba(255,170,60,0.55)');
      glow.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(ex, ey2 - heave * 0.4, er * 2.6, 0, TAU); g.fill();
      g.fillStyle = '#fff3c0';
      g.beginPath(); g.arc(ex, ey2 - heave * 0.4, er, 0, TAU); g.fill();
      g.fillStyle = '#3a0d05';
      const lx = Math.sin(t / 350) * er * 0.35;
      g.beginPath(); g.arc(ex + lx, ey2 - heave * 0.4, er * 0.34, 0, TAU); g.fill();
    }

    // THE MAW
    const my = -34 - heave * 0.3;
    const mg = g.createRadialGradient(0, my + 6, 4, 0, my + 8, 34);
    mg.addColorStop(0, '#6e1020'); mg.addColorStop(0.55, '#2a0410'); mg.addColorStop(1, '#0c0106');
    g.fillStyle = mg;
    g.beginPath(); g.ellipse(0, my, 30, jaw + 8, 0, 0, TAU); g.fill();
    teethRow(g, 0, my - jaw - 1, 50, 7, 8, false, 5);   // upper fangs hang down
    teethRow(g, 0, my + jaw + 3, 44, 6, 7, true, 11);   // lower rise up
    // gum lines
    g.strokeStyle = 'rgba(90,20,35,0.8)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, my, 30, jaw + 8, 0, 0, TAU); g.stroke();
    // glisten
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.ellipse(-10, my - jaw * 0.4, 10, 4, -0.4, 0, TAU); g.fill();
    // drool strands
    for (const [dx2, ph] of [[-14, 0], [6, 2.2], [18, 4.1]]) {
      const dp = (t / 900 + ph) % 1;
      g.strokeStyle = `rgba(170,235,255,${0.55 * (1 - dp)})`;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(dx2, my + jaw + 4);
      g.quadraticCurveTo(dx2 + 2, my + jaw + 10 + dp * 14, dx2, my + jaw + 12 + dp * 20); g.stroke();
      g.fillStyle = `rgba(170,235,255,${0.6 * (1 - dp)})`;
      g.beginPath(); g.arc(dx2, my + jaw + 13 + dp * 20, 2.2, 0, TAU); g.fill();
    }
    g.restore();
  }

  // =====================================================================
  // GHOST: what's left of you. Wavy sheet, hollow sockets, inner glow.
  // =====================================================================
  function artGhost(g, cx, feetY, h, t, o) {
    o = o || {};
    const s = h / 100;
    const bob = Math.sin(t / 380 + (o.seed || 0)) * 4;
    g.save();
    g.translate(cx, feetY + bob * s);
    g.scale(s, s);
    g.globalAlpha = (o.alpha == null ? 0.75 : o.alpha);
    const gg = g.createRadialGradient(0, -52, 4, 0, -46, 46);
    gg.addColorStop(0, 'rgba(235,245,255,0.95)');
    gg.addColorStop(0.7, 'rgba(190,210,235,0.75)');
    gg.addColorStop(1, 'rgba(150,170,210,0.35)');
    g.fillStyle = gg;
    g.beginPath();
    g.moveTo(-26, -14);
    g.quadraticCurveTo(-30, -66, 0, -78);
    g.quadraticCurveTo(30, -66, 26, -14);
    for (let i = 0; i < 5; i++) { // wavy hem
      const hx = 26 - (i + 0.5) * 10.4;
      g.quadraticCurveTo(hx + 5, -4 + Math.sin(t / 200 + i) * 3, hx, -12 + Math.sin(t / 240 + i) * 2);
    }
    g.closePath(); g.fill();
    // hollow sockets + mouth
    g.fillStyle = 'rgba(20,18,40,0.85)';
    g.beginPath(); g.ellipse(-9, -56, 5, 6.5 + Math.sin(t / 500) * 0.6, 0.15, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(9, -56, 5, 6.5 + Math.cos(t / 460) * 0.6, -0.15, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0, -42, 4, 6 + Math.sin(t / 300) * 1.4, 0, 0, TAU); g.fill();
    // faint hands
    g.fillStyle = 'rgba(220,235,255,0.5)';
    g.beginPath(); g.ellipse(-24, -34 + Math.sin(t / 330) * 2, 6, 4, 0.5, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(24, -34 + Math.cos(t / 330) * 2, 6, 4, -0.5, 0, TAU); g.fill();
    g.restore();
  }

  return { artCreature, artMonster, artGhost, ART_HEAD_TOP: HEADTOP };
})();
