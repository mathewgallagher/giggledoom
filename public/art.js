/* GIGGLEDOOM character art engine. Hand-painted canvas rigs. Zero emojis.
   All characters draw in a 120-unit-tall local space, feet at y=0, scaled to h px. */
'use strict';

const { artCreature, artMonster, artGhost, artProp, artBot, ART_HEAD_TOP } = (() => {
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
    if (o.hat === 'ü§†') paintCowboyHat(g, 0, hatY + 4);
    else if (o.hat) { g.font = '34px serif'; g.fillText(o.hat, 0, hatY); }
    g.restore();
  }

  // the YEEHAW hat, painted (the emoji version is a whole second face ‚Äî no)
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

  // =====================================================================
  // WORLD PROPS: every hiding spot / decor / egg, painted + grounded.
  // Local space: feet on floor at y=0, up = negative y, ~[-60..60] wide.
  // =====================================================================
  function rrectF(g, x, y, w, h, r, fill) { g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
  function ellF(g, x, y, rx, ry, fill, rot) { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); g.fill(); }
  function lgrad(g, x0, y0, x1, y1, c0, c1) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }
  function contact(g, w) { g.save(); g.globalAlpha *= 0.38; ellF(g, 0, 1, w, w * 0.2, '#000'); g.restore(); }
  function woodBox(g, x, y, w, h, base) {
    g.fillStyle = lgrad(g, x, y, x, y + h, sh(base, 26), sh(base, -30));
    g.fillRect(x, y, w, h);
    g.strokeStyle = rgba(sh(base, -60), 0.8); g.lineWidth = 1.6;
    g.strokeRect(x, y, w, h);
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x, y + (h / 3) * i); g.lineTo(x + w, y + (h / 3) * i); g.stroke(); }
    g.fillStyle = rgba('#000000', 0.5);
    for (const [nx, ny] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) { g.beginPath(); g.arc(nx, ny, 1.4, 0, TAU); g.fill(); }
  }
  function bottleRow(g, x, y, n, tint) {
    for (let i = 0; i < n; i++) { ellF(g, x + i * 11, y, 4.6, 4.6, tint); ellF(g, x + i * 11, y, 2.2, 2.2, sh(tint, -70)); }
  }
  function flame(g, x, y, s2, t, ph) {
    const fl = 1 + Math.sin(t / 90 + ph) * 0.25;
    ellF(g, x, y - 4 * s2 * fl, 2.4 * s2, 5 * s2 * fl, '#ffb347');
    ellF(g, x, y - 3 * s2 * fl, 1.2 * s2, 2.6 * s2 * fl, '#fff3c0');
  }

  function artProp(g, cx, feetY, h, kind, t, o) {
    o = o || {};
    const s = h / 110;
    g.save();
    g.translate(cx + (o.jig || 0), feetY);
    g.scale(s, s);
    g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.glow) { g.save(); g.globalAlpha *= 0.3 + 0.14 * Math.sin(t / 200); ellF(g, 0, 0, 52, 13, '#52ffa8'); g.restore(); }

    switch (kind) {
      case 'bush': case 'sunflower': {
        contact(g, 48);
        const gr2 = '#2f6b35';
        for (const [bx, by, r] of [[-22, -20, 22], [20, -22, 24], [0, -38, 26], [-8, -16, 20], [12, -12, 18]]) {
          const sway = Math.sin(t / 600 + bx) * 1.5;
          g.fillStyle = lgrad(g, bx, by - r, bx, by + r, sh(gr2, 45 + (by < -30 ? 20 : 0)), sh(gr2, -35));
          g.beginPath(); g.arc(bx + sway, by, r, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.arc(-6, -44, 14, 0, TAU); g.fill();
        if (kind === 'sunflower') {
          for (const [fx, ph] of [[-20, 0], [4, 2], [26, 4]]) {
            const sway = Math.sin(t / 500 + ph) * 2;
            g.strokeStyle = '#3d7a2e'; g.lineWidth = 3; g.beginPath(); g.moveTo(fx, -30); g.quadraticCurveTo(fx + sway, -55, fx + sway, -66); g.stroke();
            for (let p = 0; p < 8; p++) { const a = (p / 8) * TAU + ph; ellF(g, fx + sway + Math.cos(a) * 8, -66 + Math.sin(a) * 8, 4.5, 2.6, '#ffd23f', a); }
            ellF(g, fx + sway, -66, 5, 5, '#6b4423');
          }
        }
        break;
      }
      case 'crate': { contact(g, 44); woodBox(g, -30, -46, 60, 46, '#8a6134'); woodBox(g, -18, -74, 40, 30, '#7a5228'); break; }
      case 'pizzastack': {
        contact(g, 42);
        for (let i = 0; i < 5; i++) {
          const y2 = -i * 11 - 10, rot = (rnd(i) - 0.5) * 0.12;
          g.save(); g.translate(0, y2); g.rotate(rot);
          rrectF(g, -30, -9, 60, 11, 3, i % 2 ? '#c9a86a' : '#bd9a58');
          g.fillStyle = 'rgba(120,60,20,0.5)'; g.beginPath(); g.arc(10 - i * 4, -4, 3, 0, TAU); g.fill();
          ellF(g, -14, -3.5, 5, 2.4, '#a3323a');
          g.restore();
        }
        break;
      }
      case 'freezer': {
        contact(g, 50);
        rrectF(g, -42, -52, 84, 52, 6, lgrad(g, 0, -52, 0, 0, '#e8eef2', '#a8b4bd'));
        g.strokeStyle = 'rgba(60,80,95,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-42, -38); g.lineTo(42, -38); g.stroke();
        rrectF(g, -10, -44, 20, 4, 2, '#7f8d96');
        const fr = 0.4 + 0.2 * Math.sin(t / 700);
        g.fillStyle = `rgba(160,230,255,${fr})`; g.fillRect(-40, -39, 80, 2.5);
        break;
      }
      case 'toolbox': { contact(g, 34); rrectF(g, -26, -26, 52, 26, 4, lgrad(g, 0, -26, 0, 0, '#d8434e', '#8f1f28')); rrectF(g, -26, -30, 52, 6, 3, '#b32a35'); g.strokeStyle = '#3a3f44'; g.lineWidth = 3; g.beginPath(); g.arc(0, -30, 9, Math.PI, TAU); g.stroke(); rrectF(g, -4, -26, 8, 7, 2, '#c8ccd0'); break; }
      case 'fridge': {
        contact(g, 40);
        rrectF(g, -30, -104, 60, 104, 6, lgrad(g, -30, 0, 30, 0, '#d6dde2', '#9aa6ae'));
        g.strokeStyle = 'rgba(70,85,95,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-30, -64); g.lineTo(30, -64); g.stroke();
        rrectF(g, 18, -96, 5, 26, 2, '#6f7d86'); rrectF(g, 18, -58, 5, 34, 2, '#6f7d86');
        ellF(g, -12, -86, 4, 4, '#e25555'); ellF(g, -2, -78, 3.4, 3.4, '#3f7fd6'); ellF(g, -16, -74, 3, 3, '#ffd23f');
        break;
      }
      case 'cheese': {
        contact(g, 46);
        g.fillStyle = lgrad(g, 0, -60, 0, 0, '#ffd94f', '#d8a41f');
        g.beginPath(); g.moveTo(-44, 0); g.lineTo(44, 0); g.lineTo(30, -58); g.quadraticCurveTo(0, -70, -30, -58); g.closePath(); g.fill();
        for (const [hx, hy, r] of [[-16, -20, 7], [12, -34, 5.5], [22, -12, 6], [-4, -46, 4.5], [-28, -36, 5]]) ellF(g, hx, hy, r, r * 0.8, '#b07f14');
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(-12, -52, 16, 5, -0.2, 0, TAU); g.fill();
        break;
      }
      case 'trash': {
        contact(g, 36);
        g.fillStyle = lgrad(g, -26, 0, 26, 0, '#b7c2c9', '#6f7d86');
        g.beginPath(); g.moveTo(-24, -66); g.lineTo(24, -66); g.lineTo(20, 0); g.lineTo(-20, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(50,62,70,0.5)'; g.lineWidth = 1.6;
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 9, -64); g.lineTo(i * 7.5, -2); g.stroke(); }
        g.save(); g.translate(2, -66); g.rotate(-0.12); ellF(g, 0, 0, 27, 7, '#8d9aa2'); ellF(g, 0, -3, 6, 3, '#6f7d86'); g.restore();
        g.fillStyle = '#e8d44f'; g.beginPath(); g.moveTo(14, -62); g.quadraticCurveTo(26, -58, 24, -46); g.quadraticCurveTo(18, -54, 14, -62); g.fill();
        const fa = t / 260;
        ellF(g, Math.cos(fa) * 30, -74 + Math.sin(fa * 1.7) * 8, 1.8, 1.8, '#2a2a2a');
        break;
      }
      case 'couch': {
        contact(g, 62);
        rrectF(g, -58, -48, 116, 20, 8, '#5d3a6e');
        rrectF(g, -58, -30, 116, 30, 8, lgrad(g, 0, -30, 0, 0, '#7a4d91', '#4a2c58'));
        rrectF(g, -55, -44, 53, 16, 7, '#8a5aa3'); rrectF(g, 2, -44, 53, 16, 7, '#8a5aa3');
        rrectF(g, -66, -42, 14, 42, 7, '#6b4180'); rrectF(g, 52, -42, 14, 42, 7, '#6b4180');
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, -28, 44, 5, 0, 0, TAU); g.fill();
        break;
      }
      case 'tv': {
        contact(g, 44);
        rrectF(g, -34, -22, 68, 22, 3, '#4a3626');
        rrectF(g, -38, -78, 76, 58, 6, lgrad(g, 0, -78, 0, -20, '#5c5f66', '#26282c'));
        const st = rnd(Math.floor(t / 60)) * 30;
        g.fillStyle = `rgb(${90 + st},${100 + st},${115 + st})`;
        rrectF(g, -31, -71, 54, 44, 3, g.fillStyle);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-31, -71 + ((t / 18) % 44), 54, 2.5);
        ellF(g, 30, -64, 3, 3, '#d8434e'); ellF(g, 30, -52, 3, 3, '#7f8d96');
        g.strokeStyle = '#888'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -78); g.lineTo(-18, -98); g.moveTo(-6, -78); g.lineTo(10, -96); g.stroke();
        break;
      }
      case 'plant': {
        contact(g, 34);
        g.fillStyle = lgrad(g, 0, -26, 0, 0, '#c46a3a', '#8a4423');
        g.beginPath(); g.moveTo(-22, -26); g.lineTo(22, -26); g.lineTo(15, 0); g.lineTo(-15, 0); g.closePath(); g.fill();
        g.strokeStyle = '#3d7a2e'; g.lineWidth = 4; g.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i - 2.5) * 0.42, sway = Math.sin(t / 480 + i) * 2.5;
          g.beginPath(); g.moveTo(0, -26);
          g.quadraticCurveTo(Math.cos(a) * 26 + sway, -46, Math.cos(a) * 44 + sway, -30 - Math.abs(Math.sin(a)) * 46);
          g.stroke();
        }
        break;
      }
      case 'teddy': {
        contact(g, 34);
        const tb = '#a4713d';
        ellF(g, -14, -46, 8, 8, tb); ellF(g, 14, -46, 8, 8, tb); ellF(g, -14, -46, 4, 4, '#7a4d24');
        ellF(g, 0, -40, 17, 16, sh(tb, 10));
        ellF(g, -26, -20, 8, 12, tb, 0.5); ellF(g, 26, -20, 8, 12, tb, -0.5);
        ellF(g, 0, -16, 20, 17, tb); ellF(g, 0, -13, 12, 10, sh(tb, 35));
        ellF(g, -12, -2, 9, 5, sh(tb, -15)); ellF(g, 12, -2, 9, 5, sh(tb, -15));
        ellF(g, -6, -43, 2.2, 2.2, '#1c120a'); ellF(g, 6, -43, 2.2, 2.2, '#1c120a');
        ellF(g, 0, -37, 4.5, 3.4, sh(tb, 45)); ellF(g, 0, -38.5, 2, 1.6, '#1c120a');
        g.strokeStyle = '#1c120a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3, -12); g.lineTo(3, -8); g.moveTo(3, -12); g.lineTo(-3, -8); g.stroke();
        break;
      }
      case 'bed': {
        contact(g, 62);
        rrectF(g, -58, -60, 12, 60, 4, '#5c3a20'); // headboard post side
        rrectF(g, -58, -66, 116, 14, 6, '#6d4526');
        rrectF(g, -58, -40, 116, 18, 6, lgrad(g, 0, -40, 0, -22, '#f0ead8', '#c9c0a8'));
        rrectF(g, -58, -24, 116, 12, 4, '#8a5a30');
        rrectF(g, -52, -50, 34, 12, 5, '#fff'); // pillow
        g.fillStyle = lgrad(g, 0, -38, 0, -10, '#b03048', '#7a1c30');
        g.beginPath(); g.moveTo(-14, -40); g.lineTo(58, -40); g.lineTo(58, -14); g.quadraticCurveTo(20, -8, -8, -16); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(-54, -12, 108, 10); // under-bed dark
        break;
      }
      case 'closet': {
        contact(g, 44);
        rrectF(g, -36, -108, 72, 108, 5, lgrad(g, -36, 0, 36, 0, '#7a5228', '#4a2f14'));
        g.strokeStyle = 'rgba(30,18,8,0.8)'; g.lineWidth = 2;
        g.strokeRect(-30, -100, 26, 92); g.strokeRect(4, -100, 26, 92);
        ellF(g, -8, -56, 2.4, 2.4, '#d8b46a'); ellF(g, 8, -56, 2.4, 2.4, '#d8b46a');
        g.fillStyle = '#0a0508'; g.fillRect(1, -100, 4, 92); // ajar gap
        const bl = blinkAmt(t, 5) < 0.5;
        if (bl) { ellF(g, 3, -66, 1.5, 2, '#ffd23f'); ellF(g, 3, -58, 1.5, 2, '#ffd23f'); } // eyes inside
        break;
      }
      case 'hamper': {
        contact(g, 38);
        g.fillStyle = lgrad(g, 0, -44, 0, 0, '#b08d52', '#7a5c2e');
        g.beginPath(); g.moveTo(-30, -44); g.lineTo(30, -44); g.lineTo(24, 0); g.lineTo(-24, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(60,42,16,0.5)'; g.lineWidth = 1.4;
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 11, -42); g.lineTo(i * 9, -2); g.stroke(); }
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-28 + i, -14 - i * 12); g.lineTo(28 - i, -14 - i * 12); g.stroke(); }
        ellF(g, -8, -48, 12, 6, '#e8e2d4'); ellF(g, 10, -46, 9, 5, '#b03048'); ellF(g, 0, -52, 8, 4.5, '#3f7fd6');
        g.fillStyle = '#e8e2d4'; g.beginPath(); g.moveTo(24, -40); g.quadraticCurveTo(34, -30, 30, -18); g.quadraticCurveTo(26, -28, 24, -40); g.fill();
        break;
      }
      case 'shoes': {
        contact(g, 40);
        const cols = ['#b03048', '#3f7fd6', '#e8e2d4', '#4a3626', '#d88a2a'];
        for (let i = 0; i < 5; i++) {
          const sx2 = -26 + rnd(i + 3) * 52, sy2 = -6 - rnd(i + 8) * 16, rot = (rnd(i) - 0.5) * 1.2;
          g.save(); g.translate(sx2, sy2); g.rotate(rot);
          ellF(g, 0, 0, 12, 5.5, cols[i]); ellF(g, -7, -3, 5.5, 4.5, sh(cols[i], -25));
          g.restore();
        }
        break;
      }
      case 'car': {
        contact(g, 66);
        ellF(g, 0, 2, 58, 7, 'rgba(20,14,8,0.5)'); // oil stain
        g.fillStyle = lgrad(g, 0, -46, 0, -12, '#4a7d9e', '#2b4a5e');
        g.beginPath();
        g.moveTo(-62, -14); g.lineTo(-58, -30); g.quadraticCurveTo(-34, -34, -26, -46);
        g.quadraticCurveTo(8, -52, 26, -44); g.quadraticCurveTo(52, -38, 60, -26); g.lineTo(62, -14); g.closePath(); g.fill();
        g.fillStyle = '#12202a';
        g.beginPath(); g.moveTo(-22, -44); g.quadraticCurveTo(6, -48, 22, -42); g.lineTo(18, -32); g.lineTo(-20, -32); g.closePath(); g.fill();
        for (const wx of [-34, 36]) {
          ellF(g, wx, -10, 13, 13, '#1c1c20'); ellF(g, wx, -10, 6, 6, '#8d9aa2');
        }
        ellF(g, -46, -24, 6, 4, '#c46a3a'); ellF(g, 30, -20, 5, 3.4, '#c46a3a'); // rust
        rrectF(g, 54, -22, 8, 5, 2, '#ffd23f');
        break;
      }
      case 'tires': {
        contact(g, 42);
        for (let i = 0; i < 3; i++) {
          const ty = -10 - i * 16, tx = i === 2 ? 6 : 0, rot2 = i === 2 ? 0.12 : 0;
          g.save(); g.translate(tx, ty); g.rotate(rot2);
          ellF(g, 0, 0, 34, 12, '#22242a'); ellF(g, 0, -1.5, 34, 12, '#2e3138'); ellF(g, 0, -1.5, 15, 5.5, '#0e0f12');
          g.restore();
        }
        break;
      }
      case 'web': {
        g.strokeStyle = 'rgba(230,238,248,0.5)'; g.lineWidth = 1.1;
        for (let i = 0; i < 6; i++) { const a = Math.PI + (i / 5) * (Math.PI / 2); g.beginPath(); g.moveTo(30, -96); g.lineTo(30 + Math.cos(a) * 62, -96 - Math.sin(a) * -62); g.stroke(); }
        for (let r = 14; r <= 56; r += 14) { g.beginPath(); g.arc(30, -96, r, Math.PI * 0.98, Math.PI * 1.52); g.stroke(); }
        const sy3 = -50 + Math.sin(t / 700) * 9;
        g.beginPath(); g.moveTo(2, -96); g.lineTo(2, sy3 - 8); g.stroke();
        ellF(g, 2, sy3, 5, 6, '#1c1620'); ellF(g, 0, sy3 - 3, 1.2, 1.2, '#d84a4a'); ellF(g, 4, sy3 - 3, 1.2, 1.2, '#d84a4a');
        for (const s2 of [-1, 1]) for (let l2 = 0; l2 < 3; l2++) { g.strokeStyle = 'rgba(28,22,32,0.9)'; g.beginPath(); g.moveTo(2 + s2 * 4, sy3); g.quadraticCurveTo(2 + s2 * 10, sy3 - 2 + l2 * 3, 2 + s2 * 13, sy3 + 2 + l2 * 3); g.stroke(); }
        contact(g, 20);
        break;
      }
      case 'wine': {
        contact(g, 42);
        woodBox(g, -36, -80, 72, 80, '#5c3a20');
        g.strokeStyle = '#3d2412'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-36, -80); g.lineTo(36, 0); g.moveTo(36, -80); g.lineTo(-36, 0); g.stroke();
        bottleRow(g, -22, -62, 5, '#3a5e2a'); bottleRow(g, -22, -34, 5, '#5e2a3a'); bottleRow(g, -22, -10, 5, '#3a5e2a');
        g.save(); g.translate(44, -4); g.rotate(1.35); rrectF(g, -3.4, -14, 6.8, 14, 3, '#5e2a3a'); rrectF(g, -1.6, -20, 3.2, 7, 1.4, '#5e2a3a'); g.restore();
        break;
      }
      case 'mannequin': {
        contact(g, 30);
        ellF(g, 0, -4, 16, 4, '#5c5f66');
        rrectF(g, -2.5, -46, 5, 42, 2, '#7f8d96');
        g.fillStyle = lgrad(g, 0, -88, 0, -46, '#ded4c4', '#a89c88');
        g.beginPath(); g.moveTo(-16, -46); g.quadraticCurveTo(-20, -70, -12, -82); g.lineTo(12, -82); g.quadraticCurveTo(20, -70, 16, -46); g.closePath(); g.fill();
        const turn = Math.sin(t / 2600) * 6;
        ellF(g, turn, -94, 11, 13, '#d4c8b4');
        ellF(g, turn - 3.5, -96, 1.6, 2.4, 'rgba(40,30,20,0.75)'); ellF(g, turn + 3.5, -96, 1.6, 2.4, 'rgba(40,30,20,0.75)');
        break;
      }
      case 'amp': {
        contact(g, 44);
        rrectF(g, -34, -52, 68, 52, 5, lgrad(g, 0, -52, 0, 0, '#3a3d42', '#17181b'));
        rrectF(g, -28, -30, 56, 24, 3, '#26282c');
        g.strokeStyle = 'rgba(140,150,160,0.35)'; g.lineWidth = 1.4;
        for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 8, -29); g.lineTo(i * 8, -7); g.stroke(); }
        for (let i = 0; i < 4; i++) ellF(g, -20 + i * 13, -42, 3.2, 3.2, '#c8ccd0');
        g.save(); g.translate(40, 0); g.rotate(-0.28);
        ellF(g, 0, -18, 12, 15, '#b03048'); ellF(g, 0, -22, 5, 6, '#1c120a');
        rrectF(g, -2, -74, 4, 54, 2, '#6d4526'); rrectF(g, -4, -80, 8, 8, 2, '#4a2f14');
        g.restore();
        break;
      }
      case 'tub': {
        contact(g, 54);
        g.fillStyle = lgrad(g, 0, -44, 0, -6, '#f2f5f7', '#b6c2ca');
        g.beginPath(); g.moveTo(-50, -44); g.quadraticCurveTo(0, -36, 50, -44); g.lineTo(44, -10); g.quadraticCurveTo(0, -2, -44, -10); g.closePath(); g.fill();
        for (const s2 of [-1, 1]) { ellF(g, s2 * 38, -4, 5, 6, '#c8a44a'); ellF(g, s2 * 34, 0, 4, 3, '#c8a44a'); }
        g.strokeStyle = '#8d9aa2'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-44, -44); g.lineTo(-44, -66); g.lineTo(-36, -66); g.stroke();
        const dp = (t / 1100) % 1;
        ellF(g, -36, -60 + dp * 16, 2, 3, `rgba(150,220,255,${0.8 * (1 - dp)})`);
        for (let i = 0; i < 4; i++) { const bp = (t / 900 + i * 0.7) % 1; ellF(g, -20 + i * 13, -46 - bp * 6, 3.5 * (1 - bp * 0.5), 3.5 * (1 - bp * 0.5), `rgba(255,255,255,${0.5 * (1 - bp)})`); }
        break;
      }
      case 'shower': {
        contact(g, 44);
        rrectF(g, -38, -8, 76, 8, 3, '#b6c2ca');
        g.strokeStyle = '#8d9aa2'; g.lineWidth = 3; g.beginPath(); g.moveTo(-38, -100); g.lineTo(38, -100); g.stroke();
        g.fillStyle = 'rgba(190,220,235,0.55)';
        g.beginPath(); g.moveTo(-34, -98);
        for (let i = 0; i <= 8; i++) { const wx2 = -34 + i * 8.5; g.quadraticCurveTo(wx2 - 4, -54 + Math.sin(t / 400 + i) * 3, wx2, -10); }
        g.lineTo(-34, -10); g.closePath(); g.fill();
        for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(150,180,200,0.4)'; g.lineWidth = 1.2; const wx2 = -30 + i * 8; g.beginPath(); g.moveTo(wx2, -96); g.quadraticCurveTo(wx2 + Math.sin(t / 400 + i) * 3, -50, wx2, -12); g.stroke(); }
        g.strokeStyle = '#8d9aa2'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, -100); g.lineTo(30, -84); g.stroke();
        ellF(g, 30, -82, 6, 4, '#b6c2ca');
        break;
      }
      case 'toilet': {
        contact(g, 36);
        rrectF(g, -14, -66, 28, 34, 4, lgrad(g, -14, 0, 14, 0, '#f2f5f7', '#c2ced6'));
        rrectF(g, -10, -60, 20, 6, 3, '#dde5ea');
        g.fillStyle = lgrad(g, 0, -34, 0, 0, '#f2f5f7', '#b6c2ca');
        g.beginPath(); g.moveTo(-20, -32); g.quadraticCurveTo(0, -40, 22, -32); g.quadraticCurveTo(30, -14, 16, -4); g.lineTo(-12, -4); g.quadraticCurveTo(-26, -16, -20, -32); g.closePath(); g.fill();
        ellF(g, 0, -32, 18, 7, '#dde5ea'); ellF(g, 0, -32, 11, 4, '#7a97a8');
        break;
      }
      case 'tp': {
        contact(g, 40);
        const roll = (x2, y2) => { ellF(g, x2, y2, 11, 11, '#eef1f4'); ellF(g, x2, y2, 4, 4, '#b6c2ca'); g.strokeStyle = 'rgba(150,165,175,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(x2, y2, 8, 0, TAU); g.stroke(); };
        roll(-22, -10); roll(0, -10); roll(22, -10); roll(-11, -28); roll(11, -28); roll(0, -46);
        g.fillStyle = '#eef1f4'; g.beginPath(); g.moveTo(28, -12); g.quadraticCurveTo(44, -6, 40, 0); g.lineTo(30, 0); g.closePath(); g.fill();
        break;
      }
      case 'tent': {
        contact(g, 54);
        g.fillStyle = lgrad(g, 0, -76, 0, 0, '#d88a2a', '#8f5416');
        g.beginPath(); g.moveTo(-50, 0); g.lineTo(0, -76); g.lineTo(50, 0); g.closePath(); g.fill();
        g.fillStyle = '#6b3d0e';
        const flap = Math.sin(t / 520) * 5;
        g.beginPath(); g.moveTo(0, -70); g.lineTo(-16, 0); g.lineTo(6 + flap, 0); g.closePath(); g.fill();
        g.fillStyle = '#241205'; g.beginPath(); g.moveTo(0, -58); g.lineTo(-11, 0); g.lineTo(2 + flap * 0.6, 0); g.closePath(); g.fill();
        g.strokeStyle = '#c9a86a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-50, 0); g.lineTo(-60, 4); g.moveTo(50, 0); g.lineTo(60, 4); g.stroke();
        break;
      }
      case 'grill': {
        contact(g, 38);
        for (let i = 0; i < 3; i++) {
          const sp = (t / 1400 + i * 0.33) % 1;
          g.fillStyle = `rgba(200,200,210,${0.30 * (1 - sp)})`;
          g.beginPath(); g.arc(Math.sin(sp * 7 + i) * 8, -66 - sp * 34, 6 + sp * 8, 0, TAU); g.fill();
        }
        ellF(g, 0, -46, 30, 18, lgrad(g, 0, -64, 0, -30, '#3a3d42', '#141518'));
        ellF(g, 0, -46, 30, 6, '#26282c');
        g.strokeStyle = '#26282c'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-18, -34); g.lineTo(-26, 0); g.moveTo(18, -34); g.lineTo(26, 0); g.moveTo(0, -30); g.lineTo(0, 0); g.stroke();
        rrectF(g, -38, -50, 8, 4, 2, '#6d4526');
        ellF(g, 10, -62, 4, 2.6, '#d84a2a');
        break;
      }
      case 'hole': {
        ellF(g, 0, -4, 40, 13, '#050308');
        g.strokeStyle = '#6d4526'; g.lineWidth = 5; g.lineCap = 'butt';
        for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 42, -4 + Math.sin(a) * 14); g.lineTo(Math.cos(a) * 52, -4 + Math.sin(a) * 18); g.stroke(); }
        g.save(); g.translate(30, -8); g.rotate(0.4); rrectF(g, -4, -30, 8, 34, 2, '#8a6134'); g.restore();
        const gp = 0.25 + 0.15 * Math.sin(t / 800);
        ellF(g, 0, -4, 22, 7, `rgba(120,220,170,${gp})`);
        break;
      }
      case 'nook': {
        contact(g, 34);
        rrectF(g, -30, -96, 60, 96, 3, '#3d2f4a');
        rrectF(g, -24, -90, 48, 84, 2, lgrad(g, -24, 0, 24, 0, '#55446b', '#2c2238'));
        g.fillStyle = '#0a0510'; g.beginPath(); g.moveTo(8, -90); g.lineTo(24, -86); g.lineTo(24, -6); g.lineTo(12, -6); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(230,238,248,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(10, -88); g.lineTo(20, -70); g.moveTo(14, -84); g.lineTo(12, -60); g.stroke();
        break;
      }
      case 'heater': {
        contact(g, 36);
        rrectF(g, -24, -92, 48, 92, 14, lgrad(g, -24, 0, 24, 0, '#c2ccd2', '#6f7d86'));
        g.strokeStyle = 'rgba(60,75,85,0.6)'; g.lineWidth = 2;
        for (const y2 of [-72, -46, -20]) { g.beginPath(); g.moveTo(-24, y2); g.lineTo(24, y2); g.stroke(); }
        g.strokeStyle = '#8d9aa2'; g.lineWidth = 5; g.beginPath(); g.moveTo(14, -92); g.lineTo(14, -108); g.moveTo(-14, -92); g.lineTo(-14, -102); g.lineTo(-30, -102); g.stroke();
        ellF(g, 0, -80, 8, 8, '#c23b3b'); ellF(g, 0, -80, 3, 3, '#7a1c1c');
        const sp2 = (t / 1000) % 1;
        ellF(g, 16, -112 - sp2 * 14, 4 + sp2 * 4, 3 + sp2 * 3, `rgba(220,228,235,${0.35 * (1 - sp2)})`);
        break;
      }
      case 'gnome': {
        contact(g, 26);
        g.fillStyle = lgrad(g, 0, -30, 0, 0, '#4a6fd6', '#2b4088');
        g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(-16, -30, 0, -34); g.quadraticCurveTo(16, -30, 14, 0); g.closePath(); g.fill();
        ellF(g, 0, -36, 9, 8, '#e8b48a');
        g.fillStyle = '#eef1f4'; g.beginPath(); g.moveTo(-8, -34); g.quadraticCurveTo(0, -18, 8, -34); g.quadraticCurveTo(0, -28, -8, -34); g.fill();
        g.fillStyle = lgrad(g, 0, -62, 0, -38, '#e04848', '#8f1f28');
        g.beginPath(); g.moveTo(-9, -40); g.lineTo(9, -40); g.lineTo(0, -64); g.closePath(); g.fill();
        ellF(g, -3.4, -38, 1.4, 1.8, '#1c120a'); ellF(g, 3.4, -38, 1.4, 1.8, '#1c120a');
        g.strokeStyle = '#7a4d24'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, -33, 4, 0.3, Math.PI - 0.3); g.stroke();
        break;
      }
      case 'duck': {
        contact(g, 22);
        ellF(g, 0, -10, 15, 10, lgrad(g, 0, -20, 0, 0, '#ffe14d', '#e0b514'));
        ellF(g, -9, -22, 8, 7.5, '#ffe14d');
        g.fillStyle = '#ff8c2a'; g.beginPath(); g.moveTo(-16, -22); g.lineTo(-24, -20); g.lineTo(-16, -18); g.closePath(); g.fill();
        ellF(g, -11, -24, 1.6, 1.6, '#1c120a');
        ellF(g, 4, -14, 6, 4, 'rgba(255,255,255,0.4)', -0.4);
        break;
      }
      case 'button': {
        contact(g, 26);
        rrectF(g, -18, -34, 36, 34, 4, lgrad(g, -18, 0, 18, 0, '#8d9aa2', '#4a555e'));
        const bp2 = 0.5 + 0.5 * Math.sin(t / 300);
        ellF(g, 0, -36, 13, 6, '#6f1620');
        ellF(g, 0, -40, 11, 8, `rgb(${180 + bp2 * 70},30,50)`);
        ellF(g, -3, -43, 4, 2.4, 'rgba(255,255,255,0.45)');
        rrectF(g, -14, -22, 28, 9, 2, '#d8cfae');
        g.fillStyle = '#332'; g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.fillText('DO NOT', 0, -15.5);
        break;
      }
      case 'painting': {
        rrectF(g, -30, -100, 60, 76, 4, '#c8a44a');
        rrectF(g, -25, -95, 50, 66, 2, lgrad(g, 0, -95, 0, -29, '#2c2238', '#151020'));
        ellF(g, 0, -70, 12, 15, '#3d3548');
        ellF(g, 0, -52, 18, 14, '#332b42');
        const lx2 = Math.sin(t / 1900) * 2;
        ellF(g, -5, -72, 3.4, 4, '#e8e2d4'); ellF(g, 5, -72, 3.4, 4, '#e8e2d4');
        ellF(g, -5 + lx2, -72, 1.5, 2, '#8f1f28'); ellF(g, 5 + lx2, -72, 1.5, 2, '#8f1f28');
        contact(g, 24);
        break;
      }
      case 'jukebox': {
        contact(g, 40);
        g.fillStyle = lgrad(g, 0, -92, 0, 0, '#6d4526', '#3d2412');
        g.beginPath(); g.moveTo(-34, 0); g.lineTo(-34, -58); g.quadraticCurveTo(-34, -92, 0, -92); g.quadraticCurveTo(34, -92, 34, -58); g.lineTo(34, 0); g.closePath(); g.fill();
        g.lineWidth = 5;
        for (let i = 0; i < 3; i++) {
          g.strokeStyle = `hsl(${(t / 8 + i * 60) % 360},85%,60%)`;
          g.beginPath(); g.arc(0, -52, 26 - i * 7, Math.PI, TAU); g.stroke();
        }
        rrectF(g, -20, -44, 40, 22, 4, '#1c1218');
        g.strokeStyle = 'rgba(200,180,120,0.5)'; g.lineWidth = 1.2;
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 7, -42); g.lineTo(i * 7, -24); g.stroke(); }
        break;
      }
      case 'garlic': {
        g.strokeStyle = '#8a6134'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -104); g.lineTo(0, -88); g.stroke();
        for (let i = 0; i < 5; i++) {
          const gy = -82 + i * 13, gx = Math.sin(i * 2.2) * 7;
          ellF(g, gx, gy, 9 - i * 0.8, 10 - i * 0.8, i % 2 ? '#eef1f4' : '#ded8c8');
          g.strokeStyle = 'rgba(150,140,110,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(gx, gy - 8); g.lineTo(gx, gy + 8); g.stroke();
        }
        contact(g, 16);
        break;
      }
      case 'phone': {
        contact(g, 30);
        rrectF(g, -22, -34, 44, 34, 3, '#6d4526');
        rrectF(g, -18, -30, 36, 4, 2, '#4a2f14');
        const ring = Math.sin(t / 70) * (Math.sin(t / 2400) > 0.6 ? 2.4 : 0);
        g.save(); g.translate(ring, 0);
        rrectF(g, -3, -62, 6, 28, 3, '#17181b');
        ellF(g, 0, -64, 9, 5, '#17181b');
        rrectF(g, -14, -56, 6, 18, 3, '#17181b');
        g.strokeStyle = '#17181b'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(-11, -38); g.quadraticCurveTo(-18, -28, -12, -30); g.quadraticCurveTo(-20, -20, -10, -26); g.stroke();
        g.restore();
        break;
      }
      case 'lamp': {
        contact(g, 26);
        ellF(g, 0, -2, 16, 4.5, '#3a3d42');
        rrectF(g, -2, -78, 4, 76, 2, '#5c5f66');
        const gl = 0.5 + 0.12 * Math.sin(t / 160);
        g.fillStyle = `rgba(255,200,110,${gl * 0.35})`;
        g.beginPath(); g.moveTo(-16, -78); g.lineTo(16, -78); g.lineTo(34, -20); g.lineTo(-34, -20); g.closePath(); g.fill();
        g.fillStyle = lgrad(g, 0, -96, 0, -78, '#d8b46a', '#a4713d');
        g.beginPath(); g.moveTo(-16, -78); g.lineTo(-10, -96); g.lineTo(10, -96); g.lineTo(16, -78); g.closePath(); g.fill();
        break;
      }
      case 'chair': {
        contact(g, 30);
        g.strokeStyle = '#6d4526'; g.lineWidth = 4.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-16, 0); g.lineTo(-14, -30); g.moveTo(16, 0); g.lineTo(14, -30); g.moveTo(-12, -2); g.lineTo(-10, -28); g.stroke();
        rrectF(g, -18, -36, 36, 8, 3, '#8a6134');
        rrectF(g, -18, -74, 7, 40, 3, '#7a5228'); rrectF(g, 11, -74, 7, 40, 3, '#7a5228');
        rrectF(g, -18, -72, 36, 7, 3, '#8a6134'); rrectF(g, -18, -58, 36, 6, 3, '#8a6134');
        break;
      }
      case 'candle': {
        contact(g, 22);
        rrectF(g, -2.5, -50, 5, 48, 2, '#c8a44a');
        g.beginPath(); g.moveTo(-16, -50); g.lineTo(16, -50); g.stroke();
        g.strokeStyle = '#c8a44a'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-16, -50); g.quadraticCurveTo(-16, -40, -8, -40); g.moveTo(16, -50); g.quadraticCurveTo(16, -40, 8, -40); g.stroke();
        for (const [fx2, fy2] of [[-16, -54], [0, -62], [16, -54]]) {
          rrectF(g, fx2 - 2, fy2, 4, 8, 1.4, '#eee6d0');
          flame(g, fx2, fy2, 1, t, fx2);
        }
        break;
      }
      case 'ladder': {
        contact(g, 34);
        g.strokeStyle = '#a4713d'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-20, 0); g.lineTo(-6, -88); g.moveTo(20, 0); g.lineTo(6, -88); g.stroke();
        g.lineWidth = 4;
        for (let i = 1; i <= 5; i++) { const y2 = -i * 15, w2 = 20 - i * 1.9; g.beginPath(); g.moveTo(-w2, y2); g.lineTo(w2, y2); g.stroke(); }
        break;
      }
      case 'coffin': {
        contact(g, 34);
        g.save(); g.rotate(-0.08);
        g.fillStyle = lgrad(g, -20, 0, 20, 0, '#4a2f5e', '#241230');
        g.beginPath(); g.moveTo(-14, 0); g.lineTo(-22, -58); g.lineTo(-10, -92); g.lineTo(10, -92); g.lineTo(22, -58); g.lineTo(14, 0); g.closePath(); g.fill();
        g.strokeStyle = '#8a6ba0'; g.lineWidth = 2; g.stroke();
        const gp2 = 0.3 + 0.2 * Math.sin(t / 600);
        g.fillStyle = `rgba(140,255,190,${gp2})`; g.fillRect(-13, -60, 3, 52);
        g.restore();
        break;
      }
      case 'flamingo': {
        g.strokeStyle = '#e86a8a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -34); g.stroke();
        ellF(g, 4, -44, 14, 10, lgrad(g, 0, -54, 0, -34, '#ff8fae', '#d84a72'));
        g.strokeStyle = '#ff8fae'; g.lineWidth = 4; g.beginPath(); g.moveTo(-6, -50); g.quadraticCurveTo(-16, -66, -8, -72); g.stroke();
        ellF(g, -7, -74, 5, 4.4, '#ff8fae');
        g.fillStyle = '#2c2238'; g.beginPath(); g.moveTo(-11, -74); g.lineTo(-18, -71); g.lineTo(-11, -70); g.closePath(); g.fill();
        ellF(g, -6, -75, 1.2, 1.2, '#1c120a');
        contact(g, 18);
        break;
      }
      case 'mirror': {
        contact(g, 28);
        g.strokeStyle = '#c8a44a'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(0, -52, 22, 34, 0, 0, TAU); g.stroke();
        g.fillStyle = lgrad(g, -20, -80, 20, -24, '#3a4458', '#161c28');
        g.beginPath(); g.ellipse(0, -52, 20, 32, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(220,232,245,0.25)'; g.beginPath(); g.ellipse(-8, -62, 5, 14, 0.4, 0, TAU); g.fill();
        ellF(g, 6, -50, 6, 14, 'rgba(10,6,16,0.8)'); // the figure that is not you
        g.strokeStyle = '#c8a44a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, 0); g.lineTo(0, -20); g.lineTo(10, 0); g.stroke();
        break;
      }
      case 'gem': {
        const bob2 = Math.sin(t / 300) * 4;
        ellF(g, 0, 0, 14, 4, 'rgba(140,255,220,0.30)');
        g.save(); g.translate(0, -26 + bob2);
        g.fillStyle = lgrad(g, -10, -10, 10, 10, '#b0ffe8', '#2fbf98');
        g.beginPath(); g.moveTo(0, -13); g.lineTo(11, -3); g.lineTo(0, 13); g.lineTo(-11, -3); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-11, -3); g.lineTo(11, -3); g.moveTo(0, -13); g.lineTo(0, 13); g.stroke();
        g.restore();
        break;
      }
      case 'squeaker': {
        contact(g, 18);
        ellF(g, 0, -8, 13, 8, '#b6c2ca');
        ellF(g, -10, -12, 5, 4.5, '#b6c2ca');
        ellF(g, -13, -15, 2.6, 2.6, '#e86a8a');
        g.strokeStyle = '#8d9aa2'; g.lineWidth = 2; g.beginPath(); g.moveTo(12, -8); g.quadraticCurveTo(22, -12, 20, -4); g.stroke();
        g.save(); g.translate(6, -14); g.rotate(t / 300); rrectF(g, -1.4, -6, 2.8, 6, 1, '#c8a44a'); rrectF(g, -6, -7.4, 12, 2.8, 1, '#c8a44a'); g.restore();
        break;
      }
      case 'ham': {
        contact(g, 22);
        g.save(); g.rotate(-0.3);
        ellF(g, 0, -16, 16, 12, lgrad(g, 0, -28, 0, -4, '#d88a5a', '#9e4f28'));
        ellF(g, -4, -20, 7, 4.5, 'rgba(255,235,210,0.45)', -0.4);
        rrectF(g, 12, -20, 14, 5, 2.4, '#f0e6d4');
        ellF(g, 27, -17.5, 4, 4, '#f0e6d4');
        g.restore();
        break;
      }
      default: { contact(g, 30); ellF(g, 0, -20, 18, 18, '#6d3bbf'); }
    }
    g.restore();
  }

  // =====================================================================
  // ROOM BOT: a floating imp with stubby wings, doing its little chore.
  // toolIdx: 0 stir-pot, 1 duster, 2 sock, 3 wrench, 4 shovel, 5 plunger, 6 rake
  // =====================================================================
  function artBot(g, cx, feetY, h, t, o) {
    o = o || {};
    const s = h / 100;
    const bobv = Math.sin(t / 340 + (o.seed || 0)) * 5;
    const work = Math.sin(t / 220 + (o.seed || 0)); // chore oscillation
    g.save();
    g.translate(cx, feetY);
    g.scale(s, s);
    g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    g.save(); g.globalAlpha *= 0.3; ellF(g, 0, 1, 24, 6, '#000'); g.restore();
    g.translate(0, bobv);
    if (o.active) { g.save(); g.globalAlpha *= 0.3 + 0.15 * Math.sin(t / 200); ellF(g, 0, -42, 40, 44, '#ff3ba3'); g.restore(); }
    // stubby wings
    for (const sd of [-1, 1]) {
      const fl = Math.sin(t / 90 + sd) * 0.5;
      g.save(); g.translate(sd * 20, -52); g.rotate(sd * (0.5 + fl));
      ellF(g, sd * 8, 0, 11, 5.5, 'rgba(255,120,190,0.75)', sd * 0.4);
      g.restore();
    }
    // body
    g.fillStyle = lgrad(g, 0, -68, 0, -16, '#5e1b4a', '#26081f');
    g.beginPath(); g.ellipse(0, -40, 19, 25, 0, 0, TAU); g.fill();
    ellF(g, -6, -50, 8, 10, 'rgba(255,255,255,0.09)', -0.3);
    // horns + face
    for (const sd of [-1, 1]) {
      g.fillStyle = '#ff3ba3';
      g.beginPath(); g.moveTo(sd * 8, -60); g.lineTo(sd * 16, -76); g.lineTo(sd * 2, -64); g.closePath(); g.fill();
    }
    const talking = !!o.talking;
    ellF(g, -6.5, -50, 4.4, 4.8, o.active ? '#ff5470' : '#8a2f52');
    ellF(g, 6.5, -50, 4.4, 4.8, o.active ? '#ff5470' : '#8a2f52');
    ellF(g, -6.5, -50, 1.8, 1.8, '#0a0208'); ellF(g, 6.5, -50, 1.8, 1.8, '#0a0208');
    const mo = talking ? 3 + Math.abs(Math.sin(t / 100)) * 5 : 2;
    ellF(g, 0, -37, 7, mo, '#12000a');
    g.fillStyle = '#fff';
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 4 - 1.6, -37 - mo * 0.5); g.lineTo(i * 4 + 1.6, -37 - mo * 0.5); g.lineTo(i * 4, -33); g.closePath(); g.fill(); }
    // arms + chore tool
    const ti = o.toolIdx || 0;
    g.strokeStyle = '#3d1230'; g.lineWidth = 5; g.lineCap = 'round';
    if (ti === 0) { // stirring a pot on the floor
      ellF(g, 26, -8, 16, 9, '#3a3d42'); ellF(g, 26, -12, 14, 5, '#565a61');
      for (let i = 0; i < 2; i++) { const bp = (t / 700 + i * 0.5) % 1; ellF(g, 20 + i * 10, -16 - bp * 8, 2.5 * (1 - bp * 0.5), 2.5, `rgba(180,255,190,${0.5 * (1 - bp)})`); }
      g.beginPath(); g.moveTo(12, -38); g.quadraticCurveTo(24, -32, 26 + work * 5, -18); g.stroke();
      g.strokeStyle = '#8a6134'; g.lineWidth = 3; g.beginPath(); g.moveTo(26 + work * 5, -18); g.lineTo(30 + work * 7, -34); g.stroke();
    } else if (ti === 1) { // feather duster
      g.beginPath(); g.moveTo(-12, -38); g.quadraticCurveTo(-24, -36, -28, -28 + work * 8); g.stroke();
      g.strokeStyle = '#8a6134'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-28, -28 + work * 8); g.lineTo(-36, -20 + work * 10); g.stroke();
      for (let i = 0; i < 5; i++) ellF(g, -38 - i, -18 + work * 10 + Math.sin(i * 2) * 4, 3, 6, ['#e86a8a', '#7fd4ff', '#ffd23f'][i % 3], i);
    } else if (ti === 2) { // folding a sock, badly
      g.beginPath(); g.moveTo(-12, -38); g.lineTo(-22, -28); g.moveTo(12, -38); g.lineTo(22, -28); g.stroke();
      g.save(); g.translate(0, -24); g.rotate(work * 0.3);
      rrectF(g, -8, -4, 16, 9, 4, '#e8e2d4'); rrectF(g, 4, -8, 7, 8, 3, '#e8e2d4');
      ellF(g, 6, 2, 2, 2, '#c23b3b');
      g.restore();
    } else if (ti === 3) { // wrench on a bolt
      ellF(g, 26, -20, 5, 5, '#565a61');
      g.beginPath(); g.moveTo(12, -38); g.quadraticCurveTo(20, -32, 24, -24); g.stroke();
      g.save(); g.translate(26, -20); g.rotate(work * 0.7);
      rrectF(g, -2, -16, 4, 16, 2, '#8d9aa2'); ellF(g, 0, -17, 5, 4, '#8d9aa2'); ellF(g, 0, -17, 2.2, 2, '#3a3d42');
      g.restore();
    } else if (ti === 4) { // shoveling
      g.beginPath(); g.moveTo(12, -38); g.quadraticCurveTo(22, -30, 26, -18 - Math.max(0, work) * 8); g.stroke();
      g.save(); g.translate(26, -18 - Math.max(0, work) * 8); g.rotate(0.5 - Math.max(0, work) * 0.4);
      g.strokeStyle = '#8a6134'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(10, 14); g.stroke();
      g.fillStyle = '#8d9aa2'; g.beginPath(); g.moveTo(10, 14); g.lineTo(18, 18); g.lineTo(14, 26); g.lineTo(6, 20); g.closePath(); g.fill();
      g.restore();
      if (work > 0.5) for (let i = 0; i < 3; i++) ellF(g, 34 + i * 4, -30 - i * 5, 2, 2, '#6d4526');
    } else if (ti === 5) { // plunging
      const push = Math.max(0, work) * 10;
      g.beginPath(); g.moveTo(12, -38); g.lineTo(20, -30 + push * 0.4); g.stroke();
      g.strokeStyle = '#8a6134'; g.lineWidth = 3; g.beginPath(); g.moveTo(20, -30 + push * 0.4); g.lineTo(26, -12 + push); g.stroke();
      ellF(g, 26, -8 + push, 9, 5, '#8f1f28');
    } else { // raking
      g.beginPath(); g.moveTo(-12, -38); g.quadraticCurveTo(-22, -32, -26 + work * 8, -16); g.stroke();
      g.strokeStyle = '#8a6134'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-26 + work * 8, -16); g.lineTo(-34 + work * 10, -2); g.stroke();
      g.strokeStyle = '#565a61'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-40 + work * 10 + i * 4, -4); g.lineTo(-40 + work * 10 + i * 4, 2); g.stroke(); }
    }
    g.restore();
  }

  return { artCreature, artMonster, artGhost, artProp, artBot, ART_HEAD_TOP: HEADTOP };
})();
