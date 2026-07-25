// GIGGLEDOOM 3D multiplayer: join overlay + socket.io walkabout sync.
// Renders other players as character rigs with name tags. Voice chat comes later.
import * as THREE from './lib/three.module.min.js';
import { buildPlayerRig, animateRig, makeNameTag, attachHat } from './3d-chars.js';
import { initVoice } from './3d-voice.js';
import { initGame } from './3d-game.js';
import { sfx } from './3d-sfx.js';

const CHARS = [
  { id: 'zoomy', label: 'ZOOMY', color: '#2ad4d6' },
  { id: 'slurp', label: 'SLURP', color: '#f090b8' },
  { id: 'gremlin', label: 'GREMLIN', color: '#6fb838' },
  { id: 'wallfish', label: 'WALLFISH', color: '#9a7ae0' },
];

export function initNet({ scene, tickers, P, camera, colliders }) {
  // ---------- join overlay ----------
  const css = document.createElement('style');
  css.textContent = `
    #gdJoinWrap { position:fixed; inset:0; z-index:30; display:flex; align-items:center; justify-content:center;
      background:rgba(4,3,8,.88); font-family:'Courier New',monospace; }
    #gdCard { width:min(92vw,420px); background:linear-gradient(180deg,#1a120a,#0f0a05);
      border:1px solid #8a6a2a; border-radius:8px;
      box-shadow:inset 0 1px 0 rgba(255,200,120,.12), 0 8px 28px rgba(0,0,0,.65);
      padding:22px 20px; color:#e8dcc8; text-align:center; }
    #gdCard h1 { font-size:20px; letter-spacing:3px; color:#ffb34d; margin-bottom:2px;
      font-family:'Special Elite','Courier New',monospace; }
    #gdCard .sub { font-size:10px; letter-spacing:2px; opacity:.6; margin-bottom:16px; }
    #gdCard label { display:block; font-size:10px; letter-spacing:2px; opacity:.7; margin:10px 0 4px; text-align:left; }
    #gdCard input { width:100%; background:#0a0806; border:1px solid #4a3a22; border-radius:4px; color:#f2ead8;
      font-family:inherit; font-size:15px; letter-spacing:2px; padding:9px 10px; text-transform:uppercase; }
    #gdChars { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-top:4px; }
    .gdChar { background:#0a0806; border:1px solid #4a3a22; border-radius:6px; padding:9px 2px 7px; cursor:pointer;
      color:#c9bda6; font-family:inherit; font-size:9px; letter-spacing:1px; }
    .gdChar .dot { width:26px; height:26px; border-radius:50%; margin:0 auto 6px; }
    .gdChar.sel { border-color:#ffb34d; color:#ffd28a; background:#1c130a; }
    #gdJoin { width:100%; margin-top:18px; background:linear-gradient(180deg,#9a6224,#6a3a14);
      border:1px solid #c99a4a; border-radius:6px;
      box-shadow:inset 0 1px 0 rgba(255,220,150,.28), 0 2px 6px rgba(0,0,0,.5);
      color:#ffe8c8; font-family:'Special Elite','Courier New',monospace; font-size:15px; letter-spacing:3px; padding:12px; cursor:pointer; }
    #gdJoin:active { background:linear-gradient(180deg,#7a4a1c,#5a3010); }
    #gdSolo { margin-top:10px; background:none; border:none; color:#8a7c62; font-family:inherit; font-size:10px;
      letter-spacing:2px; cursor:pointer; text-decoration:underline; }
    #gdStatus { margin-top:10px; font-size:10px; letter-spacing:1px; color:#ff9a9a; min-height:14px; }
    #gdWho { position:fixed; top:calc(max(10px, env(safe-area-inset-top)) + 26px); right:12px; z-index:10;
      font-family:'Courier New',monospace; font-size:10px; letter-spacing:2px; color:#c9a24a;
      text-shadow:0 2px 6px #000; pointer-events:none; }
    #gdMute { position:fixed; right:12px; bottom:max(16px, env(safe-area-inset-bottom)); z-index:10;
      background:#1c130a; border:1px solid #5a4326; border-radius:6px; color:#ffd28a;
      font-family:'Courier New',monospace; font-size:11px; letter-spacing:2px; padding:9px 12px; cursor:pointer; }
    #gdMute.muted { background:#3a1010; border-color:#8a2b2b; color:#ff9a9a; }
    #gdMute.nomic { opacity:.55; color:#8a7c62; }
  `;
  document.head.appendChild(css);

  const wrap = document.createElement('div');
  wrap.id = 'gdJoinWrap';
  wrap.innerHTML = `
    <div id="gdCard">
      <h1>THE GIGGLEHOUSE</h1>
      <div class="sub">3D BETA ¬∑ WALK IT TOGETHER</div>
      <label>YOUR NAME</label>
      <input id="gdName" maxlength="14" placeholder="WET NUGGET">
      <label>PICK YOUR IDIOT</label>
      <div id="gdChars">${CHARS.map(c =>
        `<button class="gdChar" data-char="${c.id}"><div class="dot" style="background:${c.color}"></div>${c.label}</button>`).join('')}
      </div>
      <label>HOUSE CODE (SHARE IT)</label>
      <input id="gdCode" maxlength="8" value="HOUSE">
      <button id="gdJoin">ENTER THE HOUSE</button>
      <button id="gdSolo">walk alone (no friends. it happens.)</button>
      <div id="gdStatus"></div>
      <a href="/classic" style="display:block; margin-top:12px; font-size:9px; letter-spacing:2px; color:#6a5c46; text-decoration:underline;">the old 2D game lives at /classic</a>
    </div>`;
  document.body.appendChild(wrap);

  const who = document.createElement('div');
  who.id = 'gdWho'; who.style.display = 'none';
  document.body.appendChild(who);

  const nameEl = wrap.querySelector('#gdName');
  const codeEl = wrap.querySelector('#gdCode');
  const statusEl = wrap.querySelector('#gdStatus');
  let myChar = localStorage.getItem('gd3_char') || 'zoomy';
  nameEl.value = localStorage.getItem('gd3_name') || '';
  const charBtns = [...wrap.querySelectorAll('.gdChar')];
  const selChar = id => {
    myChar = id; localStorage.setItem('gd3_char', id);
    charBtns.forEach(b => b.classList.toggle('sel', b.dataset.char === id));
  };
  charBtns.forEach(b => b.addEventListener('click', () => selChar(b.dataset.char)));
  selChar(myChar);

  // ---------- peers ----------
  const peers = new Map(); // id -> {rig, tag, name, char, dead, tx, tz, tyaw, cx, cz, cyaw, moving, tk, pc, vcGain, vcFilter}
  let sock = null, joined = false, voice = null, game = null;
  const voiceCtl = { meDead: false, meeting: false, deadSet: new Set() };

  let blobMat = null;
  function rigBlob() { // a soft shadow so nobody floats
    if (!blobMat) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const rg = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      rg.addColorStop(0, 'rgba(0,0,0,.45)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
      blobMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
    }
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), blobMat);
    p.rotation.x = -Math.PI / 2; p.position.y = 0.012; p.renderOrder = 1;
    return p;
  }
  function addPeer(p) {
    if (peers.has(p.id)) return;
    const rig = buildPlayerRig(p.char);
    if (p.hat) attachHat(rig, p.hat);
    rig.g.add(rigBlob());
    rig.g.position.set(p.x, 0, p.z); rig.g.rotation.y = p.yaw;
    scene.add(rig.g);
    const tag = makeNameTag(p.name);
    tag.position.set(p.x, 1.95, p.z);
    scene.add(tag);
    peers.set(p.id, {
      rig, tag, name: p.name, char: p.char, dead: false,
      tx: p.x, tz: p.z, ty: p.y || 0, tyaw: p.yaw, cx: p.x, cz: p.z, cy: p.y || 0, cyaw: p.yaw, moving: false,
    });
    updateWho();
    if (game) game.setCount(peers.size + 1);
  }
  function removePeer(id) {
    const pr = peers.get(id);
    if (!pr) return;
    if (voice) voice.drop(pr);
    scene.remove(pr.rig.g); scene.remove(pr.tag);
    peers.delete(id);
    updateWho();
  }
  function updateWho() {
    who.textContent = `IN THE HOUSE: ${peers.size + 1}`;
    who.style.display = joined ? 'block' : 'none';
  }

  tickers.push((t, dt) => {
    peers.forEach(pr => {
      const k = Math.min(1, dt * 10);
      pr.cx += (pr.tx - pr.cx) * k;
      pr.cz += (pr.tz - pr.cz) * k;
      pr.cy += ((pr.ty || 0) - pr.cy) * k;
      let dy = pr.tyaw - pr.cyaw;
      while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      pr.cyaw += dy * k;
      pr.moving = Math.hypot(pr.tx - pr.cx, pr.tz - pr.cz) > 0.04;
      pr.rig.g.position.x = pr.cx; pr.rig.g.position.z = pr.cz;
      pr.rig.g.rotation.y = pr.cyaw;
      // lean into turns (plus slurp's waddle from animateRig)
      pr.lean = (pr.lean || 0) + (Math.max(-0.12, Math.min(0.12, dy * 4)) - (pr.lean || 0)) * Math.min(1, dt * 6);
      pr.rig.g.rotation.z = pr.lean + (pr.rig.waddle || 0);
      // feed the reactive face from state already on the wire (talk level, deadness, kill scares)
      pr.rig.talk = pr.tk || 0;
      pr.rig.dead = !!pr.dead;
      pr.rig.fear = pr.fearUntil ? Math.max(0, Math.min(1, (pr.fearUntil - performance.now()) / 2600)) : 0;
      animateRig(pr.rig, t, pr.moving); // sets bob on position.y, then we add altitude
      pr.rig.g.position.y += pr.cy;
      if (pr.danceUntil && performance.now() < pr.danceUntil) { // the DANCE emote is full-body
        pr.rig.g.rotation.z = Math.sin(t * 9) * 0.2;
        pr.rig.g.position.y += Math.abs(Math.sin(t * 9)) * 0.16;
      }
      // crouch spots (under the bed, the trunk): squash the rig flat so it fits the gap
      const squish = (pr.hidey === 'underbed' || pr.hidey === 'trunk') ? 0.28 : 1;
      pr.rig.g.scale.y += (squish - pr.rig.g.scale.y) * Math.min(1, dt * 8);
      if (pr.rig.mouth) { // mic-driven mouth flaps
        const open = 1 + (pr.tk || 0) * 1.6 * (0.75 + 0.25 * Math.sin(t * 16));
        pr.rig.mouth.scale.y += (open - pr.rig.mouth.scale.y) * Math.min(1, dt * 14);
      }
      // other people's feet: same-floor steps, muffled thuds from below,
      // and the all-important CEILING CREAK when someone walks around above you
      if (pr.moving && !pr.hidey && !pr.dead) {
        pr.stepBob = (pr.stepBob || 0) + dt * 9;
        const beat = Math.floor(pr.stepBob / Math.PI);
        if (beat !== pr.stepBeat) {
          pr.stepBeat = beat;
          const dh = Math.hypot(P.x - pr.cx, P.z - pr.cz);
          const dyF = (pr.cy || 0) - P.y;
          const pan = sfx.panTo(pr.cx, pr.cz);
          if (dyF > 2 && dyF < 5.4 && dh < 7) sfx.ceilingCreak(Math.max(0.15, 1 - dh / 7), pan);
          else if (Math.abs(dyF) < 2 && dh < 9 && dh > 0.4) sfx.step('wood', 0.55 * Math.max(0.08, 1 - dh / 9), false, pan);
          else if (dyF < -2 && dyF > -5.4 && dh < 6) sfx.step('wood', 0.3 * Math.max(0.08, 1 - dh / 6), true, pan);
        }
      }
      pr.tag.position.set(pr.cx, 1.95 + pr.rig.g.position.y, pr.cz);
      pr.tag.quaternion.copy(camera.quaternion);
    });
    if (voice) voice.tick(dt);
  });

  // ---------- join / send loop ----------
  function join() {
    if (typeof io === 'undefined') {
      statusEl.textContent = 'SERVER NOT REACHABLE. TRY AGAIN OR WALK ALONE.';
      return;
    }
    statusEl.textContent = 'KNOCKING...';
    localStorage.setItem('gd3_name', nameEl.value);
    sock = sock || io();
    sock.emit('3d-join', {
      name: nameEl.value, char: myChar, code: codeEl.value,
      hat: localStorage.getItem('gd3_hat') || '',
    }, res => {
      if (!res || !res.ok) { statusEl.textContent = (res && res.err) || 'THE HOUSE SAID NO.'; return; }
      joined = true;
      P.x = res.you.x; P.z = res.you.z; P.yaw = res.you.yaw;
      if (!game) game = initGame({ sock, peers, P, scene, tickers, voiceCtl, camera, world: window.GD3 && window.GD3.world, myName: () => res.you.name });
      res.players.filter(p => p.id !== sock.id).forEach(addPeer);
      game.setHost(res.hostId === sock.id);
      game.setCount(res.players.length);
      if (res.house) game.setHouse(res.house);
      wrap.style.display = 'none';
      updateWho();
      startVoice();
    });
    sock.off('3d-joined'); sock.off('3d-pos'); sock.off('3d-left');
    sock.on('3d-joined', addPeer);
    sock.on('3d-pos', d => {
      const pr = peers.get(d.id);
      if (pr) { pr.tx = d.x; pr.tz = d.z; pr.ty = d.y || 0; pr.tyaw = d.yaw; pr.tk = d.t || 0; pr.hidey = d.h || ''; pr.pm = (d.pm === 0 || d.pm === 1) ? d.pm : -1; }
    });
    sock.on('3d-left', d => {
      removePeer(d.id);
      if (game) { game.setHost(d.hostId === sock.id); game.setCount(peers.size + 1); }
    });
    sock.on('3d-hat', d => {
      const pr = peers.get(d.id);
      if (pr) attachHat(pr.rig, d.hat);
    });
    // phone locked / signal dropped: socket.io reconnects, the server restores the
    // session (connectionStateRecovery). if the window expired, reload for a clean rejoin.
    sock.on('disconnect', () => {
      statusEl.textContent = '';
      if (joined) reconEl.style.display = 'flex';
    });
    sock.io.on('reconnect', () => {
      if (!joined) return;
      if (sock.recovered) { reconEl.style.display = 'none'; }
      else { reconEl.querySelector('span').textContent = 'SESSION LOST. RE-ENTERING THE HOUSE...'; setTimeout(() => location.reload(), 900); }
    });
  }
  const reconEl = document.createElement('div');
  reconEl.style.cssText = `position:fixed; inset:0; z-index:29; display:none; align-items:center; justify-content:center;
    background:rgba(4,3,8,.72); font-family:'Courier New',monospace;`;
  reconEl.innerHTML = '<span style="color:#ffd28a; font-size:13px; letter-spacing:3px; text-shadow:0 2px 8px #000;">RECONNECTING TO THE HOUSE...</span>';
  document.body.appendChild(reconEl);
  wrap.querySelector('#gdJoin').addEventListener('click', join);
  wrap.querySelector('#gdSolo').addEventListener('click', () => { wrap.style.display = 'none'; });

  function startVoice() {
    if (voice) return;
    voice = initVoice({ sock, peers, P, colliders: colliders || [], voiceCtl, getHidey: () => (P.hidden ? P.hidden.id : ''), onStatus: s => {
      if (s === 'nomic') statusEl.textContent = '';
      updateMuteBtn();
    } });
    const btn = document.createElement('button');
    btn.id = 'gdMute';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => { if (voice.hasMic()) { voice.setMuted(!voice.isMuted()); updateMuteBtn(); } });
    updateMuteBtn();
  }
  function updateMuteBtn() {
    const btn = document.getElementById('gdMute');
    if (!btn || !voice) return;
    if (!voice.hasMic()) { btn.className = 'nomic'; btn.textContent = 'NO MIC (SILENT GHOST)'; }
    else if (voice.isMuted()) { btn.className = 'muted'; btn.textContent = 'MIC MUTED'; }
    else { btn.className = ''; btn.textContent = 'MIC LIVE'; }
  }

  let last = { x: 0, z: 0, y: 0, yaw: 0, t: 0, h: '', pm: -1 };
  setInterval(() => {
    if (!joined || !sock || !sock.connected) return;
    const t = voice ? voice.talkLevel() : 0;
    const py = P.y || 0;
    const h = P.hidden ? P.hidden.id : '';
    const pm = (window.GD3 && window.GD3.possess != null) ? window.GD3.possess : -1;
    if (Math.abs(P.x - last.x) < 0.02 && Math.abs(P.z - last.z) < 0.02
      && Math.abs(py - last.y) < 0.02 && Math.abs(P.yaw - last.yaw) < 0.02 && t === last.t && h === last.h && pm === last.pm) return;
    last = { x: P.x, z: P.z, y: py, yaw: P.yaw, t, h, pm };
    sock.emit('3d-pos', { x: +P.x.toFixed(2), z: +P.z.toFixed(2), y: +py.toFixed(2), yaw: +P.yaw.toFixed(2), t, h, pm });
  }, 100);

  return {
    peers, isJoined: () => joined, voice: () => voice, game: () => game,
    setHat: h => { localStorage.setItem('gd3_hat', h); if (sock && joined) sock.emit('3d-hat', { hat: h }); },
    getTalk: () => (voice ? voice.talkLevel() : 0),
  };
}
