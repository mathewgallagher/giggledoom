// GIGGLEDOOM 3D synth SFX: everything from oscillators, no audio files.
// AudioContext unlocks on first user gesture (browsers require it).
// Now with: master bus + generated-impulse reverb, surface footsteps,
// floorboard creaks (incl. the through-the-ceiling kind), room-tone ambience.
let ctx = null, master = null, dryG = null, wetG = null, verb = null;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
    if (ctx) buildBus();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
addEventListener('pointerdown', ac, { once: true });
addEventListener('keydown', ac, { once: true });

function buildBus() {
  master = ctx.createGain(); master.gain.value = 1;
  dryG = ctx.createGain(); dryG.gain.value = 1;
  wetG = ctx.createGain(); wetG.gain.value = 0.14;
  verb = ctx.createConvolver();
  // impulse response from decaying noise = a free room
  const len = Math.floor(ctx.sampleRate * 1.4);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  verb.buffer = ir;
  master.connect(dryG); dryG.connect(ctx.destination);
  master.connect(verb); verb.connect(wetG); wetG.connect(ctx.destination);
}
const bus = () => master;

// where a sound leaves the chain: straight to the bus, or through a stereo panner
function out(node, pan) {
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p); p.connect(bus());
  } else node.connect(bus());
}
// one enveloped tone
function tone(freq, dur, { type = 'square', vol = 0.12, slide = 0, delay = 0, lp = 0, pan = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); out(f, pan); }
  else out(g, pan);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, { vol = 0.1, freq = 800, delay = 0, q = 1, lp = 0, pan = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g);
  if (lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; g.connect(f2); out(f2, pan); }
  else out(g, pan);
  src.start(t0);
}

export const sfx = {
  blip() { tone(660, 0.06, { type: 'square', vol: 0.07 }); },                    // task tick
  jingle() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.12, delay: i * 0.09 })); }, // task done
  coin() { tone(988, 0.07, { type: 'square', vol: 0.09 }); tone(1319, 0.14, { type: 'square', vol: 0.09, delay: 0.07 }); },
  boing() { tone(180, 0.16, { type: 'sine', vol: 0.1, slide: 140 }); },          // jump
  land() { noise(0.08, { vol: 0.06, freq: 300 }); },
  sting(pan = 0) { tone(220, 0.5, { type: 'sawtooth', vol: 0.16, slide: -160, pan }); noise(0.3, { vol: 0.12, freq: 500, pan }); }, // kill
  alarm() { [0, 0.22, 0.44].forEach(d => tone(740, 0.18, { type: 'square', vol: 0.13, delay: d })); }, // meeting
  fanfareGood() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.13, delay: i * 0.11 })); },
  fanfareBad() { [392, 370, 349, 311].forEach((f, i) => tone(f, 0.26, { type: 'sawtooth', vol: 0.12, delay: i * 0.16 })); },
  whoosh() { noise(0.18, { vol: 0.09, freq: 900 }); },                           // hide/unhide
  fail() { tone(196, 0.2, { type: 'square', vol: 0.09, slide: -60 }); },
};

// added for gameplay wave 2
sfx.laugh = (pan = 0) => { [520, 430, 360, 300].forEach((f, i) => tone(f, 0.11, { type: 'square', vol: 0.12, delay: i * 0.13, slide: -40, pan })); };
sfx.spook = (pan = 0) => { tone(210, 0.9, { type: 'sine', vol: 0.1, slide: -120, pan }); };
sfx.snore = () => { [0, 0.7].forEach(d => { tone(88, 0.55, { type: 'sawtooth', vol: 0.09, slide: 18, delay: d }); tone(66, 0.4, { type: 'sawtooth', vol: 0.07, delay: d + 0.35 }); }); };

// chaos & comedy wave
sfx.fart = (pan = 0) => { tone(90, 0.35, { type: 'sawtooth', vol: 0.16, slide: -35, pan }); noise(0.3, { vol: 0.09, freq: 180, pan }); tone(70, 0.18, { type: 'square', vol: 0.1, slide: 20, delay: 0.28, pan }); };
sfx.queef = () => { tone(320, 0.16, { type: 'sawtooth', vol: 0.09, slide: -120 }); noise(0.12, { vol: 0.05, freq: 500 }); };
sfx.quake = () => { tone(45, 1.1, { type: 'sawtooth', vol: 0.18, slide: 12 }); noise(1.0, { vol: 0.1, freq: 90 }); };
sfx.disco = () => { [0, 0.25, 0.5, 0.75].forEach(d => { tone(180, 0.1, { type: 'square', vol: 0.11, delay: d }); tone(360, 0.08, { type: 'triangle', vol: 0.08, delay: d + 0.12 }); }); };
sfx.scratch = () => { tone(800, 0.18, { type: 'sawtooth', vol: 0.12, slide: -700 }); };
sfx.burp = (pan = 0) => { tone(110, 0.3, { type: 'square', vol: 0.14, slide: -50, pan }); };

// ---------- the juice pass: feet, floors, air ----------
// footsteps keyed by surface. vol 0..1-ish, muffled = heard through a wall/floor.
const STEP_DEF = {
  wood:   { thump: [72, 0.05, 0.5], tap: [420, 0.045, 0.8] },
  tile:   { thump: [90, 0.03, 0.3], tap: [1500, 0.04, 1.0] },
  stone:  { thump: [65, 0.05, 0.6], tap: [700, 0.05, 0.7] },
  dirt:   { thump: [58, 0.06, 0.7], tap: [220, 0.06, 0.5] },
  grass:  { thump: [58, 0.05, 0.5], tap: [260, 0.07, 0.4] },
  carpet: { thump: [60, 0.04, 0.4], tap: [180, 0.05, 0.3] },
};
sfx.step = (surface = 'wood', vol = 1, muffled = false, pan = 0) => {
  const s = STEP_DEF[surface] || STEP_DEF.wood;
  const lp = muffled ? 420 : 0;
  const jitter = 0.85 + Math.random() * 0.3;
  tone(s.thump[0] * jitter, s.thump[1], { type: 'sine', vol: 0.11 * vol * s.thump[2], lp, pan });
  noise(s.tap[1], { vol: 0.05 * vol * s.tap[2], freq: s.tap[0] * jitter, lp, pan });
};
// a floorboard with opinions
sfx.creak = (vol = 1, muffled = false, pan = 0) => {
  const lp = muffled ? 500 : 1200;
  tone(140 + Math.random() * 60, 0.32, { type: 'sawtooth', vol: 0.06 * vol, slide: -60 - Math.random() * 40, lp, pan });
};
// somebody is walking around UP THERE. the multi-floor tell.
sfx.ceilingCreak = (vol = 1, pan = 0) => {
  tone(58, 0.09, { type: 'sine', vol: 0.13 * vol, lp: 300, pan });
  if (Math.random() < 0.4) tone(120 + Math.random() * 50, 0.3, { type: 'sawtooth', vol: 0.045 * vol, slide: -50, lp: 380, pan });
};
// landing weight, scaled by fall speed
sfx.thump = (k = 1, pan = 0) => {
  tone(52, 0.11, { type: 'sine', vol: Math.min(0.3, 0.1 * k), pan });
  noise(0.09, { vol: Math.min(0.2, 0.06 * k), freq: 140, pan });
};
// giggle leaking out of your nose
sfx.snort = () => { tone(310, 0.07, { type: 'square', vol: 0.06, slide: 90 }); tone(280, 0.05, { type: 'square', vol: 0.05, slide: 60, delay: 0.09 }); };
// a door announcing you
sfx.doorCreak = (vol = 1, pan = 0) => {
  tone(180 + Math.random() * 80, 0.7, { type: 'sawtooth', vol: 0.05 * vol, slide: 60 + Math.random() * 60, lp: 900, pan });
};
sfx.doorShut = (vol = 1, pan = 0) => { tone(70, 0.07, { type: 'sine', vol: 0.1 * vol, pan }); noise(0.05, { vol: 0.05 * vol, freq: 500, pan }); };

// ---------- where is the listener, and which ear should this hit ----------
sfx.listener = { x: 0, z: 0, yaw: 0 };
sfx.panTo = (x, z) => {
  const L = sfx.listener;
  const dx = x - L.x, dz = z - L.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.4) return 0; // on top of you = center
  // right vector for our yaw convention (forward = (-sin, -cos)) is (cos, -sin)
  return Math.max(-1, Math.min(1, (dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / d)) * 0.85;
};

// reverb wetness per room size (0 dry .. ~0.3 cathedral)
sfx.setVerb = (wet) => { if (wetG) wetG.gain.value = wet; };

// ---------- room-tone ambience: persistent, crossfaded ----------
const amb = { built: false, cur: null, nodes: {}, plinkTimer: null };
function buildAmbience() {
  if (amb.built || !ctx) return;
  amb.built = true;
  const mk = (build) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(ctx.destination); build(g); return g; };
  // basement: mains hum
  amb.nodes.hum = mk(g => {
    [55, 110].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = i ? 0.35 : 1;
      o.connect(og); og.connect(g); o.start();
    });
  });
  // crypt/observatory: detuned drone
  amb.nodes.drone = mk(g => {
    [66, 66.7].forEach(f => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 190;
      o.connect(fl); fl.connect(g); o.start();
    });
  });
  // attic/yard: wind through gaps
  amb.nodes.wind = mk(g => {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) { v = v * 0.98 + (Math.random() * 2 - 1) * 0.02; d[i] = v * 8; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 420; fl.Q.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lfoG = ctx.createGain(); lfoG.gain.value = 180;
    lfo.connect(lfoG); lfoG.connect(fl.frequency); lfo.start();
    src.connect(fl); fl.connect(g); src.start();
  });
  // everywhere else: the house's own low breath
  amb.nodes.house = mk(g => {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) { v = v * 0.995 + (Math.random() * 2 - 1) * 0.005; d[i] = v * 10; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 130;
    src.connect(fl); fl.connect(g); src.start();
  });
  amb.nodes.musicbox = ctx.createGain(); // gate for the nursery plinks
  amb.nodes.musicbox.gain.value = 0;
}
const AMB_VOL = { hum: 0.035, drone: 0.028, wind: 0.05, house: 0.03, musicbox: 1 };
sfx.ambience = (kind) => {
  const c = ac(); if (!c) return;
  buildAmbience();
  if (amb.cur === kind) return;
  amb.cur = kind;
  const t0 = c.currentTime;
  Object.entries(amb.nodes).forEach(([k, g]) => {
    g.gain.cancelScheduledValues(t0);
    g.gain.setTargetAtTime(k === kind ? (AMB_VOL[k] || 0.03) : 0, t0, 0.8);
  });
  clearInterval(amb.plinkTimer); amb.plinkTimer = null;
  if (kind === 'musicbox') { // the nursery plays itself, sparsely, slightly wrong
    const plink = () => {
      if (amb.cur !== 'musicbox') return;
      const notes = [880, 987, 1174, 1318, 1568, 830];
      tone(notes[(Math.random() * notes.length) | 0], 1.4, { type: 'triangle', vol: 0.035 });
    };
    amb.plinkTimer = setInterval(plink, 2600 + Math.random() * 2000);
    plink();
  }
};
