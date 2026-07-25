// SNEAKY BASTARD MODE (client): roles, chores, kills, bodies, meetings, votes.
// Server (server.js sb-* events) is the referee; this file is HUD + interactions.
import * as THREE from './lib/three.module.min.js';
import { buildPlayerRig, buildWalkMonster, HATS } from './3d-chars.js';
import { sfx } from './3d-sfx.js';

const VENTS = [
  { x: 1.2, z: -10.2, y: 0, room: 'KITCHEN' },
  { x: 12.5, z: -3.8, y: 0, room: 'CRYPT' },
  { x: -11.8, z: -10.2, y: 0, room: 'NURSERY' },
  { x: -5.6, z: -3.9, y: 3.7, room: 'GAME ROOM (UP)' },
];
const FIXES = { lights: { x: 3.15, z: 9.0, label: 'FUSES' }, pipes: { x: 5.15, z: 12.9, label: 'VALVE' } };
const CAM_VIEWS = [
  { label: 'DEN', x: 6.4, y: 2.7, z: -4.4, yaw: 2.18, pitch: -0.45 },
  { label: 'HALL', x: 9.4, y: 2.6, z: -8.4, yaw: 1.45, pitch: -0.4 },
  { label: 'YARD', x: -6.4, y: 2.8, z: 5.6, yaw: -2.46, pitch: -0.5 },
  { label: 'LANDING', x: 9.3, y: 6.2, z: -7, yaw: 1.57, pitch: -0.38 },
];

// mini: mash = tap fast, timing = hit the gold zone, seq = press the shown keys in order
// y marks which floor a station lives on (0 = ground)
const STATIONS = {
  cheese:   { x: 0.6, z: 0.4, r: 1.7, label: 'SLAP THE CHEESE', mini: 'mash' },
  fridge:   { x: -2.3, z: -15.9, r: 1.7, label: 'FEED THE FRIDGE', mini: 'seq' },
  flush:    { x: 9.3, z: -15.6, r: 1.6, label: 'FLUSH IT. ALL OF IT.', mini: 'timing' },
  clock:    { x: 8.5, z: 13.4, r: 1.6, label: 'WIND THE BREAK CLOCK', mini: 'timing' },
  coffin:   { x: 14.2, z: -2.6, r: 2.1, label: 'DUST THE COFFIN', mini: 'seq' },
  gnome:    { x: 0.5, z: 12.45, r: 1.9, label: 'COMPLIMENT GNORMAN', mini: 'mash' },
  crib:     { x: -10.8, z: -13.5, r: 1.9, label: 'ROCK THE CRIB (WHY)', mini: 'mash' },
  portrait: { x: -3.6, z: -8.4, r: 1.6, label: 'STRAIGHTEN A PORTRAIT', mini: 'timing' },
  ham: { x: 1.3, z: -12.6, r: 1.9, label: 'LIFT THE HAM', mini: 'mash' },
  valve: { x: 5.6, z: 13.1, r: 1.9, label: 'CRANK THE BOILER', mini: 'timing' },
  bed:    { x: -9.6, z: -12.4, y: 3.7, r: 1.9, label: 'MAKE THE BED (IT RESISTS)', mini: 'timing' },
  books:  { x: -2.5, z: -12.4, y: 3.7, r: 1.7, label: 'RESHELVE THE LIES', mini: 'seq' },
  trophy: { x: 5.2, z: -16.2, y: 3.7, r: 1.7, label: 'POLISH THE ELK', mini: 'mash' },
  darts:  { x: 4, z: -4.1, y: 3.7, r: 1.7, label: 'LOSE AT DARTS', mini: 'timing' },
  stars:  { x: 11.5, z: 1.4, y: 3.7, r: 1.8, label: 'ALIGN THE STARS', mini: 'seq' },
  sheets: { x: -10.4, z: -12.9, y: 7.4, r: 1.8, label: 'FOLD THE ANGRY SHEETS', mini: 'mash' },
};
const DUO_LABEL = { ham: 1, valve: 1 }; // these need a second crew member standing nearby
const BUTTON_POS = { x: -5.6, z: 3.6 };
const KILL_CD = 25000;

export function initGame({ sock, peers, P, scene, tickers, voiceCtl, camera, world, myName }) {
  const V3E = new THREE.Vector3();
  // ---------- state ----------
  let role = null;            // null | 'crew' | 'imposter' | 'spectator'
  let phase = 'walk';         // walk | playing | meeting | over
  let mode = 'classic';       // classic | monster | heist
  let meDead = false, myTasks = [], aliveIds = new Set();
  let killReadyAt = 0, nearTask = null, mini = null;
  let meetingEndsAt = 0, votedFor = null;
  const bodies = new Map();   // victim id -> mesh group
  let isHost = false, houseCount = 1, pickMode = 'classic';
  let coins = parseInt(localStorage.getItem('gd3_coins') || '0', 10) || 0;
  let houseXP = 0, houseLvl = 1;
  const items = new Map();    // heist item -> { mesh, state, by }
  let carrying = null, monster = null, mwTgt = { x: 7.5, z: 11.5, y: 0 };
  let giggle = 0, clenchHeld = false;
  let sab = null, sabReadyLocal = 0, doorPlank = null, doorCollider = null;
  let ventReady = 0, dragging = null, lastDragEmit = 0, hauntReady = 0;
  let ownedHats = JSON.parse(localStorage.getItem('gd3_hats') || '[]');
  let houseRule = null, spookReady = 0; // tonight's rule + ghost spook cooldown

  // ---------- css + dom ----------
  const css = document.createElement('style');
  css.textContent = `
    .sbui { font-family:'Courier New',monospace; letter-spacing:2px; }
    #sbBarWrap { position:fixed; top:0; left:0; right:0; height:5px; z-index:12; display:none; background:rgba(255,255,255,.08); }
    #sbBar { height:100%; width:0%; background:#c9a24a; transition:width .4s; }
    #sbTasks { position:fixed; top:calc(max(10px, env(safe-area-inset-top)) + 40px); left:12px; z-index:11;
      font-size:10px; color:#e8dcc8; text-shadow:0 2px 6px #000; display:none; pointer-events:none; }
    #sbTasks .done { color:#7a8a5a; text-decoration:line-through; }
    #sbTasks .hdr { color:#ffb34d; margin-bottom:3px; }
    #sbRole { position:fixed; left:50%; top:34%; transform:translate(-50%,-50%); z-index:25; text-align:center;
      color:#ffd28a; text-shadow:0 3px 12px #000; display:none; pointer-events:none; }
    #sbRole b { display:block; font-size:27px; letter-spacing:5px; margin-bottom:8px;
      font-family:'Special Elite','Courier New',monospace; }
    #sbRole span { font-size:12px; color:#e8dcc8; }
    #sbRole.bad b { color:#ff5a5a; }
    .sbBtn { position:fixed; left:12px; z-index:14; display:none;
      background:linear-gradient(180deg,#2a1b0e,#170e07); border:1px solid #8a6a2a;
      box-shadow:inset 0 1px 0 rgba(255,200,120,.14), 0 2px 6px rgba(0,0,0,.5);
      border-radius:6px; color:#ffd28a; font-family:'Courier New',monospace; font-size:12px; letter-spacing:2px;
      padding:11px 14px; cursor:pointer; text-align:left; }
    #sbChore { bottom:max(120px, calc(env(safe-area-inset-bottom) + 104px)); }
    #sbKill { bottom:max(72px, calc(env(safe-area-inset-bottom) + 56px)); background:#3a1010; border-color:#8a2b2b; color:#ff9a9a; }
    #sbReport { bottom:max(24px, calc(env(safe-area-inset-bottom) + 8px)); background:#2a2110; border-color:#8a6b2b; }
    #sbPanic { bottom:max(168px, calc(env(safe-area-inset-bottom) + 152px)); background:#33101c; border-color:#8a2b5a; color:#ff9ac8; }
    #sbStart { position:fixed; left:50%; bottom:max(64px, calc(env(safe-area-inset-bottom) + 48px)); transform:translateX(-50%);
      z-index:14; display:none; background:linear-gradient(180deg,#9a6224,#6a3a14); border:1px solid #c99a4a;
      box-shadow:inset 0 1px 0 rgba(255,220,150,.28), 0 2px 6px rgba(0,0,0,.5); border-radius:6px; color:#ffe8c8;
      font-family:'Special Elite','Courier New',monospace; font-size:13px; letter-spacing:3px; padding:12px 18px; cursor:pointer; }
    #sbTint { position:fixed; inset:0; z-index:20; pointer-events:none; display:none; }
    #sbDead { position:fixed; left:50%; top:max(46px, calc(env(safe-area-inset-top) + 36px)); transform:translateX(-50%);
      z-index:21; font-size:12px; color:#b8c4d8; text-shadow:0 2px 8px #000; display:none; pointer-events:none; }
    #sbMeet { position:fixed; inset:0; z-index:28; display:none; align-items:center; justify-content:center;
      background:rgba(6,4,10,.9); }
    #sbMeetCard { width:min(94vw,460px); background:linear-gradient(180deg,#1a120a,#0f0a05);
      border:1px solid #8a6a2a; border-radius:8px;
      box-shadow:inset 0 1px 0 rgba(255,200,120,.12), 0 8px 28px rgba(0,0,0,.65);
      padding:18px; color:#e8dcc8; text-align:center; max-height:86vh; overflow-y:auto; }
    #sbMeetCard h2 { font-size:16px; letter-spacing:3px; color:#ffb34d; margin-bottom:2px;
      font-family:'Special Elite','Courier New',monospace; }
    #sbMeetWhy { font-size:10px; opacity:.65; margin-bottom:12px; }
    #sbTimer { font-size:11px; color:#c9a24a; margin-bottom:10px; }
    .sbCand { display:flex; align-items:center; gap:10px; background:#0a0806; border:1px solid #4a3a22;
      border-radius:6px; padding:8px 10px; margin-bottom:7px; }
    .sbCand .dot { width:18px; height:18px; border-radius:50%; flex:0 0 18px; }
    .sbCand .nm { flex:1; text-align:left; font-size:12px; }
    .sbCand .vt { font-size:9px; color:#7a8a5a; margin-right:6px; }
    .sbCand button { background:#3a1010; border:1px solid #8a2b2b; color:#ff9a9a; border-radius:4px;
      font-family:inherit; font-size:10px; letter-spacing:2px; padding:6px 10px; cursor:pointer; }
    .sbCand button:disabled { opacity:.35; cursor:default; }
    #sbSkip { width:100%; background:#1c130a; border:1px solid #5a4326; color:#c9bda6; border-radius:6px;
      font-family:inherit; font-size:11px; letter-spacing:2px; padding:10px; cursor:pointer; margin-top:4px; }
    #sbResult { margin-top:12px; font-size:12px; color:#ffd28a; min-height:16px; }
    #sbOver { position:fixed; left:50%; top:40%; transform:translate(-50%,-50%); z-index:29; text-align:center;
      display:none; pointer-events:none; text-shadow:0 3px 14px #000; }
    #sbOver b { display:block; font-size:25px; letter-spacing:4px; color:#ffd28a; margin-bottom:8px;
      font-family:'Special Elite','Courier New',monospace; }
    #sbOver span { font-size:12px; color:#e8dcc8; }
    #sbCoins { position:fixed; top:calc(max(10px, env(safe-area-inset-top)) + 44px); right:12px; z-index:11;
      font-size:11px; color:#ffd23e; text-shadow:0 2px 6px #000; pointer-events:none; }
    .sbPop { position:fixed; left:50%; top:42%; z-index:26; font-family:'Courier New',monospace; font-size:22px;
      letter-spacing:2px; color:#ffd23e; text-shadow:0 2px 8px #000; pointer-events:none;
      animation:sbFloat 1.1s ease-out forwards; }
    @keyframes sbFloat { from { opacity:1; transform:translate(-50%,0); } to { opacity:0; transform:translate(-50%,-70px); } }
    #sbMini { position:fixed; left:12px; bottom:max(120px, calc(env(safe-area-inset-bottom) + 104px)); z-index:15;
      width:230px; background:#140f0a; border:1px solid #5a4326; border-radius:8px; padding:12px; display:none;
      color:#e8dcc8; }
    #sbMini h3 { font-size:11px; letter-spacing:2px; color:#ffb34d; margin-bottom:9px; }
    #sbMashBtn { width:100%; background:#7a2f1a; border:1px solid #c05a2a; border-radius:6px; color:#ffd8b0;
      font-family:inherit; font-size:16px; letter-spacing:3px; padding:14px; cursor:pointer; }
    #sbMashBar { font-size:12px; margin-top:8px; letter-spacing:1px; color:#c9a24a; }
    #sbTimeBar { position:relative; height:22px; background:#0a0806; border:1px solid #4a3a22; border-radius:4px;
      margin-bottom:9px; overflow:hidden; }
    #sbTimeZone { position:absolute; left:39%; width:22%; top:0; bottom:0; background:rgba(201,162,74,.4); }
    #sbTimeCur { position:absolute; width:4px; top:0; bottom:0; background:#ff9a5a; }
    #sbNowBtn { width:100%; background:#1c130a; border:1px solid #c05a2a; border-radius:6px; color:#ffd8b0;
      font-family:inherit; font-size:13px; letter-spacing:3px; padding:10px; cursor:pointer; }
    #sbSeq { font-size:17px; letter-spacing:6px; margin-bottom:9px; color:#ffd28a; }
    #sbSeq .did { color:#5a6a4a; }
    #sbSeqBtns { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
    #sbSeqBtns button { background:#1c130a; border:1px solid #5a4326; border-radius:5px; color:#ffd28a;
      font-family:inherit; font-size:14px; padding:9px 0; cursor:pointer; }
  `;
  document.head.appendChild(css);

  const el = html => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };
  const barWrap = el('<div id="sbBarWrap" class="sbui"><div id="sbBar"></div></div>');
  const tasksEl = el('<div id="sbTasks" class="sbui"></div>');
  const roleEl = el('<div id="sbRole" class="sbui"><b></b><span></span></div>');
  const choreBtn = el('<button id="sbChore" class="sbBtn sbui"></button>');
  const killBtn = el('<button id="sbKill" class="sbBtn sbui"></button>');
  const reportBtn = el('<button id="sbReport" class="sbBtn sbui"></button>');
  const panicBtn = el('<button id="sbPanic" class="sbBtn sbui">PANIC BUTTON</button>');
  const startBtn = el('<button id="sbStart" class="sbui">START ROUND</button>');
  const modeBtn = el('<button id="sbMode" class="sbui">MODE: SNEAKY BASTARD</button>');
  const houseHud = el('<div id="sbHouse" class="sbui">HOUSE LVL 1</div>');
  const deliverBtn = el('<button id="sbDeliver" class="sbBtn sbui">DROP LOOT IN CHEST</button>');
  const grabBtn = el('<button id="sbGrab" class="sbBtn sbui"></button>');
  const tint = el('<div id="sbTint"></div>');
  const deadEl = el('<div id="sbDead" class="sbui">YOU ARE DEAD. HAUNT RESPONSIBLY.</div>');
  const meet = el(`<div id="sbMeet" class="sbui"><div id="sbMeetCard">
    <h2>EMERGENCY GIGGLE MEETING</h2><div id="sbMeetWhy"></div><div id="sbTimer"></div>
    <div id="sbCands"></div><button id="sbSkip">SKIP VOTE (coward)</button><div id="sbResult"></div>
  </div></div>`);
  const over = el('<div id="sbOver" class="sbui"><b></b><span></span></div>');
  const css2 = document.createElement('style');
  css2.textContent = `
    #sbGiggle { position:fixed; left:50%; bottom:max(64px, calc(env(safe-area-inset-bottom) + 48px));
      transform:translateX(-50%); width:190px; height:8px; background:rgba(255,255,255,.1);
      border:1px solid rgba(255,210,80,.35); border-radius:4px; z-index:12; display:none; }
    #sbGiggle div { height:100%; border-radius:3px; background:#c9a24a; }
    #sbClench { position:fixed; right:12px; bottom:max(150px, calc(env(safe-area-inset-bottom) + 134px));
      z-index:14; width:70px; height:70px; border-radius:50%; display:none;
      background:#2a2110; border:1px solid #c9a24a; color:#ffd28a;
      font-family:'Courier New',monospace; font-size:10px; letter-spacing:1px; cursor:pointer; }
    #sbSab { bottom:max(264px, calc(env(safe-area-inset-bottom) + 248px)); background:#33101c; border-color:#8a2b5a; color:#ff9ac8; }
    #sbSabRow, #sbVentRow { position:fixed; left:12px; bottom:max(312px, calc(env(safe-area-inset-bottom) + 296px));
      z-index:15; display:none; flex-direction:column; gap:6px; }
    #sbSabRow button, #sbVentRow button { background:#1c130a; border:1px solid #8a2b5a; border-radius:6px;
      color:#ff9ac8; font-family:'Courier New',monospace; font-size:11px; letter-spacing:2px; padding:9px 12px; cursor:pointer; }
    #sbVent { bottom:max(312px, calc(env(safe-area-inset-bottom) + 296px)); background:#33101c; border-color:#8a2b5a; color:#ff9ac8; }
    #sbDrag { bottom:max(360px, calc(env(safe-area-inset-bottom) + 344px)); background:#33101c; border-color:#8a2b5a; color:#ff9ac8; }
    #sbFixBtn { bottom:max(264px, calc(env(safe-area-inset-bottom) + 248px)); background:#102a1c; border-color:#2b8a5a; color:#9affc8; }
    #sbHaunt { bottom:max(72px, calc(env(safe-area-inset-bottom) + 56px)); background:#1a2033; border-color:#4a5a8a; color:#b8c8ff; }
    #sbCams { bottom:max(408px, calc(env(safe-area-inset-bottom) + 392px)); background:#101f2a; border-color:#2b6a8a; color:#9adcff; }
    #sbHats { bottom:max(24px, calc(env(safe-area-inset-bottom) + 8px)); background:#2a2110; border-color:#c9a24a; color:#ffd28a; }
    #sbToast { position:fixed; left:50%; top:calc(max(10px, env(safe-area-inset-top)) + 66px); transform:translateX(-50%);
      z-index:22; font-family:'Courier New',monospace; font-size:12px; letter-spacing:2px; color:#ffd28a;
      text-shadow:0 2px 8px #000; display:none; text-align:center; pointer-events:none; }
    #sbCamHud { position:fixed; inset:0; z-index:24; display:none; pointer-events:none;
      background:repeating-linear-gradient(0deg, rgba(0,0,0,.13) 0 2px, transparent 2px 4px); }
    #sbCamHud .lbl { position:absolute; top:18px; left:18px; font-family:'Courier New',monospace; font-size:16px;
      letter-spacing:3px; color:#9affc8; text-shadow:0 0 8px #0f0; }
    #sbCamHud .rec { position:absolute; top:18px; right:18px; font-family:'Courier New',monospace; font-size:13px;
      color:#ff5a5a; letter-spacing:2px; }
    #sbCamHud .btns { position:absolute; left:50%; bottom:36px; transform:translateX(-50%); display:flex; gap:10px; pointer-events:auto; }
    #sbCamHud button { background:#101f2a; border:1px solid #2b6a8a; border-radius:6px; color:#9adcff;
      font-family:'Courier New',monospace; font-size:12px; letter-spacing:2px; padding:10px 16px; cursor:pointer; }
    #sbShop { position:fixed; inset:0; z-index:28; display:none; align-items:center; justify-content:center; background:rgba(6,4,10,.9); }
    #sbShopCard { width:min(94vw,420px); background:#140f0a; border:1px solid #5a4326; border-radius:8px; padding:18px;
      color:#e8dcc8; font-family:'Courier New',monospace; max-height:86vh; overflow-y:auto; }
    #sbShopCard h2 { font-size:15px; letter-spacing:3px; color:#ffb34d; text-align:center; margin-bottom:12px; }
    .sbHatRow { display:flex; align-items:center; gap:10px; background:#0a0806; border:1px solid #4a3a22;
      border-radius:6px; padding:9px 11px; margin-bottom:7px; font-size:12px; letter-spacing:1px; }
    .sbHatRow .nm2 { flex:1; }
    .sbHatRow button { background:#2a2110; border:1px solid #c9a24a; color:#ffd28a; border-radius:4px;
      font-family:inherit; font-size:10px; letter-spacing:2px; padding:7px 10px; cursor:pointer; }
    .sbHatRow button:disabled { opacity:.4; cursor:default; }
    #sbShopClose { width:100%; margin-top:6px; background:#1c130a; border:1px solid #5a4326; color:#c9bda6;
      border-radius:6px; font-family:inherit; font-size:11px; letter-spacing:2px; padding:10px; cursor:pointer; }
    #sbAwards { margin-top:14px; font-size:12px; letter-spacing:1px; color:#e8dcc8; line-height:1.7; }
    #sbAwards b { color:#ffd28a; }
  `;
  document.head.appendChild(css2);

  const coinsEl = el(`<div id="sbCoins" class="sbui">COINS ${coins}</div>`);
  const miniEl = el('<div id="sbMini" class="sbui"><h3></h3><div id="sbMiniBody"></div></div>');
  const giggleEl = el('<div id="sbGiggle"><div></div></div>');
  const clenchBtn = el('<button id="sbClench" class="sbui">CLENCH</button>');
  const sabBtn = el('<button id="sbSab" class="sbBtn sbui">SABOTAGE</button>');
  const sabRow = el(`<div id="sbSabRow"><button data-k="lights">LIGHTS OUT</button>
    <button data-k="pipes">BURST THE PIPES</button><button data-k="door">JAM THE DEN DOOR</button></div>`);
  const ventBtn = el('<button id="sbVent" class="sbBtn sbui">VENT</button>');
  const ventRow = el('<div id="sbVentRow"></div>');
  const dragBtn = el('<button id="sbDrag" class="sbBtn sbui">DRAG BODY</button>');
  const fixBtn = el('<button id="sbFixBtn" class="sbBtn sbui">FIX IT</button>');
  const hauntBtn = el('<button id="sbHaunt" class="sbBtn sbui">HAUNT</button>');
  const camsBtn = el('<button id="sbCams" class="sbBtn sbui">CAMERAS</button>');
  const hatsBtn = el('<button id="sbHats" class="sbBtn sbui">HATS</button>');
  const toastEl = el('<div id="sbToast" class="sbui"></div>');
  const camHud = el(`<div id="sbCamHud"><div class="lbl"></div><div class="rec">REC ‚óè</div>
    <div class="btns"><button id="sbCamNext">NEXT CAM</button><button id="sbCamExit">EXIT</button></div></div>`);
  const shop = el('<div id="sbShop" class="sbui"><div id="sbShopCard"><h2>THE HAT HOLE</h2><div id="sbHatList"></div><button id="sbShopClose">LEAVE THE HOLE</button></div></div>');
  [barWrap, tasksEl, roleEl, choreBtn, killBtn, reportBtn, panicBtn, startBtn, tint, deadEl, meet, over, coinsEl, miniEl,
   giggleEl, clenchBtn, sabBtn, sabRow, ventBtn, ventRow, dragBtn, fixBtn, hauntBtn, camsBtn, hatsBtn, toastEl, camHud, shop,
   modeBtn, houseHud, deliverBtn, grabBtn]
    .forEach(d => document.body.appendChild(d));

  const styleExtra = document.createElement('style');
  styleExtra.textContent = `
    #sbMode { position:fixed; left:50%; bottom:max(112px, calc(env(safe-area-inset-bottom) + 96px)); transform:translateX(-50%);
      z-index:14; display:none; background:#1c130a; border:1px solid #5a4326; border-radius:6px; color:#c9bda6;
      font-family:'Courier New',monospace; font-size:11px; letter-spacing:2px; padding:9px 14px; cursor:pointer; }
    #sbHouse { position:fixed; top:calc(max(10px, env(safe-area-inset-top)) + 62px); right:12px; z-index:11;
      font-family:'Courier New',monospace; font-size:10px; letter-spacing:2px; color:#9adcff; text-shadow:0 2px 6px #000; pointer-events:none; }
    #sbDeliver { bottom:max(120px, calc(env(safe-area-inset-bottom) + 104px)); background:#2a2110; border-color:#c9a24a; color:#ffd28a; }
    #sbGrab { bottom:max(168px, calc(env(safe-area-inset-bottom) + 152px)); background:#2a2110; border-color:#c9a24a; color:#ffd28a; }
  `;
  document.head.appendChild(styleExtra);
  const MODES3D = [
    { id: 'classic', label: 'SNEAKY BASTARD', min: 3 },
    { id: 'monster', label: 'THE MONSTER WAKES', min: 1 },
    { id: 'heist', label: 'THE HEIST', min: 3 },
  ];
  modeBtn.addEventListener('click', () => {
    const i = MODES3D.findIndex(m => m.id === pickMode);
    pickMode = MODES3D[(i + 1) % MODES3D.length].id;
    modeBtn.textContent = 'MODE: ' + MODES3D.find(m => m.id === pickMode).label;
    sfx.blip();
  });

  // ---------- MAP (layout + your chores + you-are-here; NEVER other players) ----------
  const mapCss = document.createElement('style');
  mapCss.textContent = `
    #sbMapBtn { position:fixed; top:max(10px, env(safe-area-inset-top)); left:50%; transform:translateX(-50%); z-index:14;
      background:#1c130a; border:1px solid #5a4326; border-radius:6px; color:#c9bda6;
      font-family:'Courier New',monospace; font-size:10px; letter-spacing:2px; padding:6px 12px; cursor:pointer; }
    #sbMapWrap { position:fixed; inset:0; z-index:27; display:none; align-items:center; justify-content:center; background:rgba(6,4,10,.82); }
    #sbMapCard { background:linear-gradient(180deg,#1a120a,#0f0a05); border:1px solid #8a6a2a; border-radius:10px;
      box-shadow:inset 0 1px 0 rgba(255,200,120,.12), 0 8px 28px rgba(0,0,0,.65); padding:14px; text-align:center; }
    #sbMapCard h3 { font-family:'Special Elite','Courier New',monospace; font-size:14px; letter-spacing:3px; color:#ffb34d; margin-bottom:4px; }
    #sbMapCv, #sbRecap { border-radius:4px; box-shadow:0 3px 10px rgba(0,0,0,.5); }
    #sbMapCard .leg { font-family:'Courier New',monospace; font-size:9px; letter-spacing:1px; color:#8a7c62; margin-top:6px; }
    #sbMapClose { margin-top:8px; background:#1c130a; border:1px solid #5a4326; color:#c9bda6; border-radius:6px;
      font-family:'Courier New',monospace; font-size:11px; letter-spacing:2px; padding:8px 14px; cursor:pointer; }
  `;
  document.head.appendChild(mapCss);
  const mapBtn = el('<button id="sbMapBtn" class="sbui">MAP</button>');
  const mapWrap = el(`<div id="sbMapWrap"><div id="sbMapCard"><h3>THE GIGGLEHOUSE</h3>
    <div id="sbMapFloors"></div>
    <canvas id="sbMapCv" width="300" height="320"></canvas>
    <div class="leg">‚óÜ your chores &nbsp; ‚óè you &nbsp; ‚ñ≤‚ñº stairs &nbsp; (nobody else is on this map. trust no one.)</div>
    <button id="sbMapClose">CLOSE</button></div></div>`);
  document.body.appendChild(mapBtn); document.body.appendChild(mapWrap);
  const mapCv = mapWrap.querySelector('#sbMapCv');
  const mapFloorsEl = mapWrap.querySelector('#sbMapFloors');
  const mapFloorCss = document.createElement('style');
  mapFloorCss.textContent = `
    #sbMapFloors { display:flex; gap:6px; justify-content:center; margin:6px 0 8px; }
    #sbMapFloors button { background:#0a0806; border:1px solid #4a3a22; border-radius:5px; color:#8a7c62;
      font-family:'Courier New',monospace; font-size:9px; letter-spacing:2px; padding:5px 10px; cursor:pointer; }
    #sbMapFloors button.on { border-color:#ffb34d; color:#ffd28a; background:#1c130a; }
  `;
  document.head.appendChild(mapFloorCss);
  let mapOpen = false, mapFloor = 0;
  const MINX = -13.5, MINZ = -17.5, MSC = 10;
  const FLOOR_NAMES = ['GROUND', 'UPSTAIRS', 'ATTIC'];
  const myFloor = () => (P.y > 5.5 ? 2 : P.y > 1.8 ? 1 : 0);
  const stationFloor = s => ((s.y || 0) > 5.5 ? 2 : (s.y || 0) > 1.8 ? 1 : 0);
  FLOOR_NAMES.forEach((nm, i) => {
    const b = el(`<button data-f="${i}">${nm}</button>`);
    b.addEventListener('click', () => { mapFloor = i; drawMap(); sfx.blip(); });
    mapFloorsEl.appendChild(b);
  });
  const shortRoom = n => n.replace('THE ', '').replace('HALL OF PORTRAITS', 'HALL').replace('BATHROOM OF DOOM', 'BATH')
    .replace('MEAT KITCHEN', 'KITCHEN').replace('DISCO CRYPT', 'CRYPT').replace('GNOME YARD', 'YARD')
    .replace('MASTER BEDCHAMBER', 'BEDCHAMBER').replace('LIBRARY OF LIES', 'LIBRARY').replace('TROPHY ROOM', 'TROPHIES');
  // both maps are drawn on aged parchment now: house blueprint meets ransom note
  function parchment(g, w, h) {
    g.fillStyle = '#d3c096'; g.fillRect(0, 0, w, h);
    let ps = 5;
    const prnd = () => (ps = (ps * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { // mottled staining
      const x = prnd() * w, y = prnd() * h, r = 12 + prnd() * 46;
      const rg = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      rg.addColorStop(0, `rgba(150,118,66,${0.05 + prnd() * 0.09})`);
      rg.addColorStop(1, 'rgba(150,118,66,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(84,58,26,.45)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); // scorched edges
    g.strokeStyle = 'rgba(84,58,26,.2)'; g.lineWidth = 14; g.strokeRect(8, 8, w - 16, h - 16);
  }
  function drawMap() {
    mapFloorsEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.f === mapFloor));
    const g = mapCv.getContext('2d');
    parchment(g, 300, 320);
    const px = x => (x - MINX) * MSC, py = z => (z - MINZ) * MSC;
    (world && world.rooms || []).filter(r => (r.lvl || 0) === mapFloor).forEach(r => {
      const x0 = px(r.x0), y0 = py(r.z0), w = (r.x1 - r.x0) * MSC, h = (r.z1 - r.z0) * MSC;
      g.fillStyle = 'rgba(122,96,58,.16)'; g.fillRect(x0, y0, w, h);
      g.strokeStyle = '#5a3f22'; g.lineWidth = 1.5; g.strokeRect(x0, y0, w, h);
      g.fillStyle = '#4a3820'; g.font = 'bold 8px Courier New'; g.textAlign = 'center';
      g.fillText(shortRoom(r.name), x0 + w / 2, y0 + 12);
    });
    // stairs: ‚ñ≤ where they go up from this floor, ‚ñº where they come down onto it
    ((world && world.stairs) || []).forEach(st => {
      const cx = px((st.x0 + st.x1) / 2), cy = py((st.z0 + st.z1) / 2);
      g.font = 'bold 11px Courier New'; g.textAlign = 'center'; g.fillStyle = '#1f5a7a';
      if (st.lo === mapFloor) g.fillText('‚ñ≤', cx, cy + 4);
      else if (st.hi === mapFloor) g.fillText('‚ñº', cx, cy + 4);
    });
    if (mode === 'heist' && mapFloor === 0) { // the chest is the goal
      g.fillStyle = '#7a5a08'; g.font = 'bold 8px Courier New';
      g.fillText('‚ñ£ CHEST', px(-1.7), py(-4.0));
    }
    myTasks.forEach(t => {
      if (t.done) return;
      const s = STATIONS[t.id]; if (!s || stationFloor(s) !== mapFloor) return;
      const x = px(s.x), y = py(s.z);
      g.fillStyle = '#a85a10'; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.closePath(); g.fill();
      g.fillStyle = '#7a4610'; g.font = '7px Courier New';
      g.fillText(s.label.split(' ')[0] + (DUO_LABEL[t.id] ? '¬∑2' : ''), x, y - 7);
    });
    const yx = px(P.x), yy = py(P.z);
    if (myFloor() === mapFloor) { // you, solidly here
      g.fillStyle = '#0e7a7c'; g.beginPath(); g.arc(yx, yy, 4.5, 0, 7); g.fill();
      g.strokeStyle = '#0e7a7c'; g.lineWidth = 2; g.beginPath(); g.moveTo(yx, yy);
      g.lineTo(yx + Math.sin(P.yaw) * 11, yy - Math.cos(P.yaw) * 11); g.stroke();
    } else { // you, but on another floor: a faint echo
      g.strokeStyle = 'rgba(14,122,124,.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(yx, yy, 4.5, 0, 7); g.stroke();
      g.fillStyle = 'rgba(14,122,124,.7)'; g.font = '7px Courier New'; g.textAlign = 'center';
      g.fillText(myFloor() > mapFloor ? '(above)' : '(below)', yx, yy - 7);
    }
  }
  function toggleMap(v) {
    mapOpen = v == null ? !mapOpen : v;
    mapWrap.style.display = mapOpen ? 'flex' : 'none';
    if (mapOpen) { mapFloor = myFloor(); drawMap(); sfx.blip(); }
  }
  mapBtn.addEventListener('click', () => toggleMap());
  mapWrap.querySelector('#sbMapClose').addEventListener('click', () => toggleMap(false));
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'm') toggleMap(); });

  // ---------- THE MURDER MAP: the post-round reveal everyone screenshots ----------
  function drawRecap(recap, m) {
    let rc = over.querySelector('#sbRecap');
    if (!rc) {
      const wrap2 = el(`<div style="margin-top:12px; text-align:center;">
        <div style="font-family:'Courier New',monospace; font-size:11px; letter-spacing:3px; color:#ff6a5a;">THE MURDER MAP</div>
        <canvas id="sbRecap" width="440" height="240" style="max-width:92vw; margin-top:6px;"></canvas>
        <div style="font-family:'Courier New',monospace; font-size:8px; letter-spacing:1px; color:#8a7c62;">‚Äî the villain's route &nbsp; ‚úï where they got got &nbsp; ‚óè where it began</div>
      </div>`);
      const aw = over.querySelector('#sbAwards');
      if (aw && aw.parentNode) aw.parentNode.insertBefore(wrap2, aw.nextSibling);
      else over.appendChild(wrap2);
      rc = wrap2.querySelector('#sbRecap');
    }
    const g = rc.getContext('2d');
    parchment(g, rc.width, rc.height);
    const S = 6.4, oy = 22;
    const ox = f => 10 + f * 222;
    const px = (x, f) => ox(f) + (x + 13.5) * S;
    const py = z => oy + (z + 17.5) * S;
    const lvlOf = y => ((y || 0) > 1.8 ? 1 : 0); // attic events land on the upstairs panel
    [0, 1].forEach(f => {
      g.fillStyle = '#4a3820'; g.font = 'bold 9px Courier New'; g.textAlign = 'left';
      g.fillText(f === 0 ? 'GROUND' : 'UPSTAIRS', ox(f), 13);
      ((world && world.rooms) || []).filter(r => Math.min(r.lvl || 0, 1) === f).forEach(r => {
        g.fillStyle = 'rgba(122,96,58,.16)';
        g.fillRect(px(r.x0, f), py(r.z0), (r.x1 - r.x0) * S, (r.z1 - r.z0) * S);
        g.strokeStyle = '#5a3f22'; g.lineWidth = 1;
        g.strokeRect(px(r.x0, f), py(r.z0), (r.x1 - r.x0) * S, (r.z1 - r.z0) * S);
      });
      g.strokeStyle = 'rgba(150,26,16,.85)'; g.lineWidth = 1.6;
      g.beginPath();
      let pen = false;
      (recap.path || []).forEach(([x, z, y]) => {
        if (lvlOf(y) === f) { const X = px(x, f), Y = py(z); pen ? g.lineTo(X, Y) : g.moveTo(X, Y); pen = true; }
        else pen = false;
      });
      g.stroke();
      (recap.kills || []).forEach(([x, z, y]) => {
        if (lvlOf(y) !== f) return;
        const X = px(x, f), Y = py(z);
        g.strokeStyle = '#a81616'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(X - 4, Y - 4); g.lineTo(X + 4, Y + 4); g.moveTo(X + 4, Y - 4); g.lineTo(X - 4, Y + 4); g.stroke();
      });
    });
    if (recap.path && recap.path.length) {
      const [x, z, y] = recap.path[0];
      g.fillStyle = '#7a5a08'; g.beginPath(); g.arc(px(x, lvlOf(y)), py(z), 3, 0, 7); g.fill();
    }
  }

  // ---------- EMOTE WHEEL ----------
  const EMOTES = [
    { k: 'wave', label: 'WAVE', say: 'hi.' },
    { k: 'point', label: 'POINT', say: '‚òû YOU' },
    { k: 'accuse', label: 'ACCUSE', say: "J'ACCUSE!" },
    { k: 'dance', label: 'DANCE', say: '‚ô™ ‚ô´ ‚ô™' },
    { k: 'fart', label: 'FART', say: 'BRAAAAP' },
    { k: 'rofl', label: 'ROFL', say: 'AHAHAHA' },
  ];
  const emoteCss = document.createElement('style');
  emoteCss.textContent = `
    #sbEmote { position:fixed; right:86px; bottom:max(150px, calc(env(safe-area-inset-bottom) + 134px)); z-index:14;
      width:64px; height:64px; border-radius:50%; background:#1c130a; border:1px solid #5a4326; color:#ffd28a;
      font-family:'Courier New',monospace; font-size:10px; letter-spacing:1px; cursor:pointer; }
    #sbEmoteRow { position:fixed; right:12px; bottom:max(224px, calc(env(safe-area-inset-bottom) + 208px)); z-index:15;
      display:none; flex-direction:column; gap:6px; }
    #sbEmoteRow button { background:#1c130a; border:1px solid #5a4326; border-radius:6px; color:#ffd28a;
      font-family:'Courier New',monospace; font-size:11px; letter-spacing:2px; padding:8px 12px; cursor:pointer; text-align:right; }
    .sbEmoteBubble { position:fixed; z-index:23; font-family:'Courier New',monospace; font-size:15px; letter-spacing:2px;
      color:#111; background:#f5efdc; border:2px solid #111; border-radius:10px; padding:4px 9px;
      transform:translate(-50%,-100%); pointer-events:none; white-space:nowrap; }
  `;
  document.head.appendChild(emoteCss);
  const emoteBtn = el('<button id="sbEmote" class="sbui">EMOTE</button>');
  const emoteRow = el('<div id="sbEmoteRow"></div>');
  EMOTES.forEach(e => { const b = el(`<button data-k="${e.k}">${e.label}</button>`); b.addEventListener('click', () => doEmote(e.k)); emoteRow.appendChild(b); });
  document.body.appendChild(emoteBtn); document.body.appendChild(emoteRow);
  emoteBtn.addEventListener('click', () => { emoteRow.style.display = emoteRow.style.display === 'flex' ? 'none' : 'flex'; });
  addEventListener('keydown', e => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 6 && phase !== 'walk') doEmote(EMOTES[n - 1].k); });
  const emoteBubbles = new Map(); // id -> {el, until, wx, wy, wz}
  function doEmote(k) {
    emoteRow.style.display = 'none';
    sock.emit('3d-emote', { kind: k });
    playEmote(sock.id, k, P.x, P.z, P.y);
  }
  function playEmote(id, k, x, z, y = 0) {
    const e = EMOTES.find(m => m.k === k); if (!e) return;
    let bub = emoteBubbles.get(id);
    if (!bub) { const d = el('<div class="sbEmoteBubble"></div>'); document.body.appendChild(d); bub = { el: d }; emoteBubbles.set(id, bub); }
    bub.el.textContent = e.say; bub.el.style.display = 'block';
    bub.until = performance.now() + 2000; bub.wx = x; bub.wz = z;
    const pr = peers.get(id);
    if (pr && k === 'dance') pr.danceUntil = performance.now() + 2200; // full-body boogie on the rig
    if (k === 'fart') {
      sfx.fart(sfx.panTo(x, z)); fartCloud(x, z, true, y); pingRing(x, z, 0x8aa83a, y);
      const d = Math.hypot(P.x - x, P.z - z, P.y - y);
      if (d < 6 && !meDead && aliveIds.has(sock.id) && phase === 'playing') giggle = Math.min(1, giggle + 0.25);
    } else if (k === 'rofl') { sfx.laugh(); }
    else if (k === 'dance') { sfx.disco(); if (id === sock.id && Math.hypot(P.x - 8, P.z - 4.3) < 2.2 && Math.abs(P.y) < 1.5) award(1); } // dance by the jukebox, get a coin
    else sfx.blip();
  }

  let toastTimer = null;
  function toast(text, ms = 3200) {
    toastEl.textContent = text;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.style.display = 'none'), ms);
  }
  function spend(n) {
    coins -= n;
    localStorage.setItem('gd3_coins', String(coins));
    coinsEl.textContent = `COINS ${coins}`;
  }
  const roomNameAt = (x, z, y = 0) => {
    const rs = (window.GD3 && window.GD3.rooms) || [];
    const r = rs.find(r2 => x >= r2.x0 && x <= r2.x1 && z >= r2.z0 && z <= r2.z1
      && y >= (r2.y0 != null ? r2.y0 : -0.5) && y < (r2.y1 != null ? r2.y1 : 3.45));
    return r ? r.name : 'SOMEWHERE';
  };

  // ---------- sabotage effects ----------
  function applySab(kind, dur) {
    sab = { kind, until: Date.now() + dur };
    sfx.alarm();
    if (kind === 'lights') { window.GD3.lightsOut = true; toast('THE LIGHTS ARE OUT. STAY CALM. OR DO NOT.'); }
    if (kind === 'pipes') {
      window.GD3.world.puddles.forEach(p => (p.mesh.visible = true));
      toast('THE PIPES BURST. THE FLOOR IS SUSPICIOUSLY WET.');
    }
    if (kind === 'door') {
      if (!doorPlank) {
        doorPlank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.9 }));
        doorPlank.position.set(0, 0.55, -5); doorPlank.castShadow = true;
        scene.add(doorPlank);
      }
      doorPlank.visible = true;
      doorCollider = { minX: -1.2, maxX: 1.2, minZ: -5.25, maxZ: -4.75, top: 3.2 };
      window.GD3.world.colliders.push(doorCollider);
      toast('SOMETHING JAMMED THE DEN DOOR.');
    }
  }
  function endSab() {
    if (!sab) return;
    if (sab.kind === 'lights') window.GD3.lightsOut = false;
    if (sab.kind === 'pipes') window.GD3.world.puddles.forEach(p => (p.mesh.visible = false));
    if (sab.kind === 'door') {
      if (doorPlank) doorPlank.visible = false;
      const idx = window.GD3.world.colliders.indexOf(doorCollider);
      if (idx >= 0) window.GD3.world.colliders.splice(idx, 1);
      doorCollider = null;
    }
    sab = null;
    sabReadyLocal = Date.now() + 45000;
  }

  // ---------- hat shop ----------
  function renderShop() {
    const list = shop.querySelector('#sbHatList');
    const cur = localStorage.getItem('gd3_hat') || '';
    const rows = [['', { label: 'NO HAT (bold choice)', cost: 0 }], ...Object.entries(HATS)];
    list.innerHTML = '';
    rows.forEach(([id, h]) => {
      const owned = id === '' || ownedHats.includes(id);
      const row = el(`<div class="sbHatRow"><span class="nm2">${h.label}</span>
        <button>${id === cur ? 'WEARING' : owned ? 'WEAR' : `BUY (${h.cost})`}</button></div>`);
      const btn = row.querySelector('button');
      btn.disabled = id === cur || (!owned && coins < h.cost);
      btn.addEventListener('click', () => {
        if (!owned) {
          spend(h.cost);
          ownedHats.push(id);
          localStorage.setItem('gd3_hats', JSON.stringify(ownedHats));
          sfx.coin();
        }
        window.GD3.net.setHat(id);
        sfx.jingle();
        renderShop();
      });
      list.appendChild(row);
    });
  }
  hatsBtn.addEventListener('click', () => { renderShop(); shop.style.display = 'flex'; });
  shop.querySelector('#sbShopClose').addEventListener('click', () => (shop.style.display = 'none'));

  // ---------- cameras ----------
  let camIdx = -1;
  function showCam(i) {
    camIdx = i;
    const v = CAM_VIEWS[i];
    window.GD3.camView = v;
    window.GD3.freeze = true;
    camHud.style.display = 'block';
    camHud.querySelector('.lbl').textContent = 'CAM 0' + (i + 1) + ' ‚Äî ' + v.label;
  }
  function exitCam() {
    camIdx = -1;
    window.GD3.camView = null;
    window.GD3.freeze = false;
    camHud.style.display = 'none';
  }
  camsBtn.addEventListener('click', () => showCam(0));
  camHud.querySelector('#sbCamNext').addEventListener('click', () => showCam((camIdx + 1) % CAM_VIEWS.length));
  camHud.querySelector('#sbCamExit').addEventListener('click', exitCam);

  // ---------- imposter tools ----------
  sabBtn.addEventListener('click', () => { sabRow.style.display = sabRow.style.display === 'flex' ? 'none' : 'flex'; ventRow.style.display = 'none'; });
  sabRow.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    sock.emit('sb-sabotage', { kind: b.dataset.k });
    sabRow.style.display = 'none';
  }));
  ventBtn.addEventListener('click', () => {
    const near = VENTS.find(v => Math.hypot(P.x - v.x, P.z - v.z) < 1.6 && Math.abs(P.y - (v.y || 0)) < 1.5);
    if (!near) return;
    ventRow.innerHTML = '';
    VENTS.filter(v => v !== near).forEach(v => {
      const b = el(`<button>TO ${v.room}</button>`);
      b.addEventListener('click', () => {
        P.x = v.x; P.z = v.z; P.y = v.y || 0; P.vy = 0;
        ventReady = Date.now() + 10000;
        sfx.whoosh();
        ventRow.style.display = 'none';
      });
      ventRow.appendChild(b);
    });
    ventRow.style.display = 'flex';
    sabRow.style.display = 'none';
  });
  dragBtn.addEventListener('click', () => {
    if (dragging) { dragging = null; dragBtn.textContent = 'DRAG BODY'; return; }
    const b = nearestBody();
    if (b.id && b.d < 2.2) {
      dragging = b.id; dragBtn.textContent = 'DROP BODY'; sfx.whoosh();
      const m = bodies.get(b.id);
      if (m && m.userData.sim) m.userData.sim.active = false; // it stops tumbling once you grab it
    }
  });
  fixBtn.addEventListener('click', () => sock.emit('sb-fix'));
  hauntBtn.addEventListener('click', () => {
    if (Date.now() < hauntReady) return;
    hauntReady = Date.now() + 20000;
    sock.emit('sb-haunt');
  });

  // ---------- the ghost spook kit + mannequin possession ----------
  const spookCss = document.createElement('style');
  spookCss.textContent = `
    #sbSpookRow { position:fixed; left:12px; bottom:max(120px, calc(env(safe-area-inset-bottom) + 104px));
      z-index:14; display:none; flex-direction:column; gap:6px; }
    #sbSpookRow button { background:#101a2a; border:1px solid #2b4a8a; border-radius:6px; color:#9adcff;
      font-family:'Courier New',monospace; font-size:11px; letter-spacing:2px; padding:9px 12px; cursor:pointer; }
    #sbSpookRow button:disabled { opacity:.4; }
  `;
  document.head.appendChild(spookCss);
  const spookRow = el(`<div id="sbSpookRow">
    <button data-k="flicker">FLICKER THE LIGHTS</button>
    <button data-k="chill">COLD SPOT</button>
    <button data-k="slam">SLAM A DOOR</button>
    <button data-k="possess" id="sbPossess" style="border-color:#8a5a2b; color:#ffd28a;">POSSESS</button>
  </div>`);
  document.body.appendChild(spookRow);
  spookRow.querySelectorAll('button[data-k]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'possess') return togglePossess();
    if (Date.now() < spookReady) return;
    spookReady = Date.now() + 10000;
    sock.emit('sb-spook', { kind: k });
  }));
  const possessBtn = spookRow.querySelector('#sbPossess');
  function nearMannequin() {
    const ms = (world && world.mannequins) || [];
    for (let i = 0; i < ms.length; i++) {
      if (Math.hypot(P.x - ms[i].position.x, P.z - ms[i].position.z) < 2.2 && Math.abs(P.y - 7.4) < 1.2) return i;
    }
    return -1;
  }
  function togglePossess() {
    if (window.GD3.possess != null) return unpossess();
    const i = nearMannequin();
    if (i < 0) return;
    const m = world.mannequins[i];
    P.x = m.position.x; P.z = m.position.z; P.y = 7.4; P.vy = 0;
    window.GD3.possess = i;
    m.visible = false; // you don't see your own head from inside it
    sfx.spook();
    toast('you are the mannequin now. walk. slowly. for effect.', 3200);
  }
  function unpossess() {
    if (!window.GD3 || window.GD3.possess == null) return;
    const m = world && world.mannequins && world.mannequins[window.GD3.possess];
    if (m) { m.visible = true; m.position.x = P.x; m.position.z = P.z; m.userData.possessed = false; }
    window.GD3.possess = null;
  }
  sock.on('sb-spook', ({ kind, x, z, y }) => {
    if (kind === 'flicker') {
      if (window.GD3) { window.GD3.lightsOut = true; setTimeout(() => { if (!sab) window.GD3.lightsOut = false; }, 500); }
      sfx.blip();
      if (!meDead) toast('the lights just... blinked.', 1800);
    } else if (kind === 'chill') {
      const d = Math.hypot(P.x - x, P.z - z, P.y - (y || 0));
      if (d < 9 && !meDead) {
        sfx.spook(sfx.panTo(x, z));
        if (window.GD3) window.GD3.shake = 0.2;
        toast('a cold spot passes through you.', 2200);
      }
    } else if (kind === 'slam') {
      if (world && world.slamDoor) world.slamDoor(x, z);
    }
  });
  clenchBtn.addEventListener('pointerdown', e => { e.preventDefault(); clenchHeld = true; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => clenchBtn.addEventListener(ev, () => (clenchHeld = false)));
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'c') clenchHeld = true; });
  addEventListener('keyup', e => { if (e.key.toLowerCase() === 'c') clenchHeld = false; });

  // funny things fill the giggle meter
  addEventListener('gd-funny', e => {
    if (phase !== 'playing' || meDead || role === 'spectator' || !role) return;
    const dy = e.detail.y != null ? e.detail.y - (P.y + 1.2) : 0; // funny does not travel through floors
    const d = Math.hypot(P.x - e.detail.x, P.z - e.detail.z, dy);
    if (d < 7) giggle = Math.min(1, giggle + e.detail.v * (1 - d / 7));
  });

  function award(n) {
    if (houseRule && houseRule.id === 'payday') n *= 2; // PAYDAY night
    coins += n;
    localStorage.setItem('gd3_coins', String(coins));
    coinsEl.textContent = `COINS ${coins}`;
    const pop = el(`<div class="sbPop">+${n}</div>`);
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 1200);
    sfx.coin();
  }

  // ---------- chore mini-games ----------
  const SEQ_KEYS = ['W', 'A', 'S', 'D'];
  function openMini(task) {
    const s = STATIONS[task.id];
    mini = { task, type: s.mini, count: 0, hits: 0, seq: [], idx: 0, cursor: 0 };
    miniEl.querySelector('h3').textContent = s.label;
    const body = miniEl.querySelector('#sbMiniBody');
    if (s.mini === 'mash') {
      body.innerHTML = '<button id="sbMashBtn">SLAP</button><div id="sbMashBar"></div>';
      body.querySelector('#sbMashBtn').addEventListener('pointerdown', e => {
        e.preventDefault(); mini.count += 1; sfx.blip();
        if (mini.count >= 10) completeMini();
      });
    } else if (s.mini === 'timing') {
      body.innerHTML = '<div id="sbTimeBar"><div id="sbTimeZone"></div><div id="sbTimeCur"></div></div><button id="sbNowBtn">NOW! (0/3)</button>';
      body.querySelector('#sbNowBtn').addEventListener('click', () => {
        if (!mini) return;
        if (Math.abs(mini.cursor) < 0.24) {
          mini.hits += 1; sfx.blip();
          if (mini.hits >= 3) return completeMini();
          body.querySelector('#sbNowBtn').textContent = `NOW! (${mini.hits}/3)`;
        } else sfx.fail();
      });
    } else { // seq
      mini.seq = Array.from({ length: 5 }, () => SEQ_KEYS[(Math.random() * 4) | 0]);
      body.innerHTML = '<div id="sbSeq"></div><div id="sbSeqBtns">' +
        SEQ_KEYS.map(k => `<button data-k="${k}">${k}</button>`).join('') + '</div>';
      body.querySelectorAll('#sbSeqBtns button').forEach(b =>
        b.addEventListener('click', () => seqPress(b.dataset.k)));
      renderSeq();
    }
    miniEl.style.display = 'block';
    choreBtn.style.display = 'none';
  }
  function renderSeq() {
    const d = miniEl.querySelector('#sbSeq');
    if (d && mini) d.innerHTML = mini.seq.map((k, i) => `<span class="${i < mini.idx ? 'did' : ''}">${k}</span>`).join(' ');
  }
  function seqPress(k) {
    if (!mini || mini.type !== 'seq') return;
    if (k === mini.seq[mini.idx]) {
      mini.idx += 1; sfx.blip(); renderSeq();
      if (mini.idx >= mini.seq.length) completeMini();
    } else { mini.idx = 0; sfx.fail(); renderSeq(); }
  }
  addEventListener('keydown', e => {
    if (mini && mini.type === 'seq' && SEQ_KEYS.includes(e.key.toUpperCase())) seqPress(e.key.toUpperCase());
  });
  function duoBuddyPresent(id) {
    const spot = { ham: [1.3, -12.6], valve: [5.6, 13.1] }[id];
    if (!spot) return true;
    let ok = false;
    peers.forEach((pr, pid) => {
      if (pr.dead || !aliveIds.has(pid)) return;
      if (Math.hypot(pr.cx - spot[0], pr.cz - spot[1]) < 3.2 && Math.abs(pr.cy || 0) < 1.5) ok = true;
    });
    return ok;
  }
  function completeMini() {
    const task = mini.task;
    if (DUO_LABEL[task.id] && !duoBuddyPresent(task.id)) { // needs a warm body beside you
      closeMini();
      toast('NEED A BUDDY HERE TO LIFT IT.', 2200);
      sfx.fail();
      return;
    }
    closeMini();
    task.done = true;
    rings[task.id].visible = false;
    renderTasks();
    sfx.jingle();
    if (navigator.vibrate) navigator.vibrate([18, 40, 18]);
    award(10);
    if (role === 'crew') sock.emit('sb-task-done', { id: task.id });
  }
  function closeMini() { mini = null; miniEl.style.display = 'none'; }

  // ---------- station rings ----------
  const rings = {};
  Object.entries(STATIONS).forEach(([id, s]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xc9a24a, transparent: true, opacity: 0.75 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, (s.y || 0) + 0.06, s.z); ring.visible = false;
    scene.add(ring); rings[id] = ring;
  });

  // ---------- monster (MONSTER WAKES) ----------
  function buildMonsterEntity() {
    if (monster) return;
    monster = buildWalkMonster();
    monster.group.position.set(mwTgt.x, 0, mwTgt.z);
    scene.add(monster.group);
  }
  function clearMonster() { if (monster) { scene.remove(monster.group); monster = null; } }

  // ---------- heist item meshes ----------
  const ITEM_MESH = {
    skull: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8d4c6, roughness: 0.6, emissive: 0x332211, emissiveIntensity: 0.4 })); m.scale.set(0.95, 1.05, 1); return m; },
    ham: () => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.18, 6, 10), new THREE.MeshStandardMaterial({ color: 0xd88a8a, roughness: 0.6, emissive: 0x331111, emissiveIntensity: 0.4 })); m.rotation.z = Math.PI / 2; return m; },
    crown: () => { const g = new THREE.Group(); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0xd8a030, metalness: 0.8, roughness: 0.25, emissive: 0x443300, emissiveIntensity: 0.5 })); g.add(band); for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), band.material); const a = i / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.12, 0.09, Math.sin(a) * 0.12); g.add(sp); } return g; },
    orb: () => new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), new THREE.MeshStandardMaterial({ color: 0x8fa8ff, roughness: 0.15, emissive: 0x4455cc, emissiveIntensity: 0.9 })),
  };
  function makeItem(id, x, z, y = 0) {
    const mesh = ITEM_MESH[id] ? ITEM_MESH[id]() : new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8a030 }));
    const baseY = y + (id === 'orb' ? 1.1 : 0); // the orb sits on its pedestal
    mesh.position.set(x, baseY + 0.75, z);
    const glow = new THREE.PointLight(0xffd28a, 2.5, 3, 2); glow.position.set(x, baseY + 0.9, z); mesh.userData.glow = glow;
    scene.add(mesh, glow);
    items.set(id, { mesh, glow, state: 'spot', by: null, baseY });
  }
  function clearItems() { items.forEach(it => { scene.remove(it.mesh); scene.remove(it.glow); }); items.clear(); carrying = null; }

  // ---------- helpers ----------
  const CHAR_COLORS = { zoomy: '#2ad4d6', slurp: '#f090b8', gremlin: '#6fb838', wallfish: '#9a7ae0' };
  const nameOf = id => (id === sock.id ? myName() : (peers.get(id) || {}).name || '???');
  const charOf = id => (id === sock.id ? null : (peers.get(id) || {}).char) || 'zoomy';

  function renderTasks() {
    if (!myTasks.length) { tasksEl.style.display = 'none'; return; }
    const hdr = role === 'imposter' ? 'FAKE CHORES (for show)' : 'YOUR CHORES';
    tasksEl.innerHTML = `<div class="hdr">${hdr}</div>` + myTasks.map(t =>
      `<div class="${t.done ? 'done' : ''}">¬∑ ${STATIONS[t.id].label}</div>`).join('');
    tasksEl.style.display = 'block';
  }
  function setBar(p, total) {
    barWrap.style.display = total ? 'block' : 'none';
    barWrap.firstElementChild.style.width = total ? (100 * p / total) + '%' : '0%';
  }
  function showRole(imposter) {
    roleEl.className = 'sbui' + (imposter ? ' bad' : '');
    roleEl.querySelector('b').textContent = imposter ? 'YOU ARE THE SNEAKY BASTARD' : 'YOU ARE CREW';
    roleEl.querySelector('span').textContent = imposter
      ? 'kill them all. blend in. do fake chores. lie at meetings.'
      : 'do your chores. trust nobody. report bodies. vote smart.';
    roleEl.style.display = 'block';
    setTimeout(() => (roleEl.style.display = 'none'), 6000);
  }
  // ---------- kill juice ----------
  const flashEl = el('<div style="position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:26;"></div>');
  document.body.appendChild(flashEl);
  let flashT = null;
  function flash(op) {
    flashEl.style.transition = 'none'; flashEl.style.opacity = op;
    clearTimeout(flashT);
    flashT = setTimeout(() => { flashEl.style.transition = 'opacity .35s'; flashEl.style.opacity = 0; }, 40);
  }
  function burst(x, y, z) { // a comedic puff of feathers (and exactly one tooth)
    const grp = new THREE.Group(); grp.position.set(x, y + 0.9, z);
    const parts = [];
    for (let i = 0; i < 12; i++) {
      const tooth = i === 0;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(tooth ? 0.09 : 0.15, tooth ? 0.12 : 0.07),
        new THREE.MeshBasicMaterial({ color: tooth ? 0xfff8d8 : 0xf2ead8, side: THREE.DoubleSide, transparent: true }));
      const a = Math.random() * Math.PI * 2;
      parts.push({ m: p, vx: Math.cos(a) * (0.8 + Math.random()), vy: 1.6 + Math.random() * 1.6, vz: Math.sin(a) * (0.8 + Math.random()), rs: (Math.random() - 0.5) * 9 });
      grp.add(p);
    }
    scene.add(grp);
    let life = 0;
    const iv = setInterval(() => {
      life += 0.05;
      parts.forEach(pt => {
        pt.vy -= 4.2 * 0.05; // feathers fall like feathers
        pt.m.position.x += pt.vx * 0.05; pt.m.position.y += pt.vy * 0.05; pt.m.position.z += pt.vz * 0.05;
        pt.m.rotation.x += pt.rs * 0.05; pt.m.rotation.z += pt.rs * 0.03;
        pt.m.material.opacity = Math.max(0, 1 - life / 1.5);
      });
      if (life > 1.6) { clearInterval(iv); scene.remove(grp); }
    }, 50);
  }
  function spawnBody(victim, x, z, y = 0) {
    const rig = buildPlayerRig(charOf(victim));
    rig.g.position.set(x, y + 0.28, z);
    rig.g.rotation.z = Math.PI / 2; rig.g.rotation.y = Math.random() * 6;
    // knocked back with intent: the sim below bounces it, and stairs make it tumble
    const a = Math.random() * Math.PI * 2;
    rig.g.userData.sim = { vx: Math.cos(a) * 2.0, vy: 2.3, vz: Math.sin(a) * 2.0, spin: (Math.random() - 0.5) * 10, active: true, until: performance.now() + 4200 };
    scene.add(rig.g);
    bodies.set(victim, rig.g);
  }
  function bodyGroundAt(x, z, y) {
    let g = 0;
    const cs = (window.GD3 && window.GD3.world) ? window.GD3.world.colliders : [];
    for (const c of cs) {
      if (x > c.minX - 0.2 && x < c.maxX + 0.2 && z > c.minZ - 0.2 && z < c.maxZ + 0.2
        && c.top <= y + 0.06 && c.top > g) g = c.top;
    }
    return g;
  }
  function simBodies(dt) {
    bodies.forEach(m => {
      const s = m.userData.sim;
      if (!s || !s.active) return;
      if (performance.now() > s.until) { s.active = false; return; }
      s.vy -= 12 * dt;
      let feet = m.position.y - 0.28 + s.vy * dt;
      const nx = m.position.x + s.vx * dt, nz = m.position.z + s.vz * dt;
      // walls bounce the body back (loosely; it is a corpse, not a physicist)
      const cs = (window.GD3 && window.GD3.world) ? window.GD3.world.colliders : [];
      let bounced = false;
      for (const c of cs) {
        if (nx > c.minX - 0.2 && nx < c.maxX + 0.2 && nz > c.minZ - 0.2 && nz < c.maxZ + 0.2
          && feet < c.top - 0.05 && feet + 0.5 > (c.base || 0) && c.top - feet > 0.45) { bounced = true; break; }
      }
      if (bounced) { s.vx *= -0.4; s.vz *= -0.4; }
      else { m.position.x = nx; m.position.z = nz; }
      const g = bodyGroundAt(m.position.x, m.position.z, feet + 0.4);
      if (feet <= g) {
        feet = g;
        if (s.vy < -1.4) { // bounce down the steps, thump by thump
          s.vy = -s.vy * 0.35; s.vx *= 0.75; s.vz *= 0.75; s.spin *= 0.7;
          const d = Math.hypot(P.x - m.position.x, P.z - m.position.z, P.y - feet);
          if (d < 10) sfx.thump(Math.max(0.2, 0.7 - d * 0.06), sfx.panTo(m.position.x, m.position.z));
        } else {
          s.vy = 0; s.vx *= 0.86; s.vz *= 0.86;
          if (Math.hypot(s.vx, s.vz) < 0.25) { s.active = false; m.rotation.x = 0; m.rotation.z = Math.PI / 2; }
        }
      }
      m.position.y = feet + 0.28;
      if (s.active) { m.rotation.x += s.spin * dt * 0.5; m.rotation.y += s.spin * dt * 0.3; }
    });
  }
  function clearBodies() { bodies.forEach(m => scene.remove(m)); bodies.clear(); }
  function ghostVisibility() {
    peers.forEach(pr => {
      const hidden = pr.dead && !meDead;
      pr.rig.g.visible = !hidden;
      pr.tag.visible = !hidden;
    });
  }
  function die(how) {
    meDead = true; voiceCtl.meDead = true;
    tint.style.display = 'block';
    tint.style.background = 'rgba(200,20,20,.5)';
    setTimeout(() => { tint.style.background = 'rgba(40,50,70,.28)'; }, 450);
    deadEl.textContent = how === 'eject'
      ? 'YOU WERE LAUNCHED INTO THE YARD. HAUNT RESPONSIBLY.'
      : 'YOU ARE DEAD. HAUNT RESPONSIBLY.';
    deadEl.style.display = 'block';
    ghostVisibility();
  }
  function resetAll() {
    closeMini();
    endSab();
    exitCam();
    clearMonster();
    clearItems();
    mode = 'classic';
    giggle = 0; dragging = null; dragBtn.textContent = 'DRAG BODY';
    giggleEl.style.display = 'none';
    clenchBtn.style.display = 'none';
    [sabBtn, sabRow, ventBtn, ventRow, dragBtn, fixBtn, hauntBtn, grabBtn, deliverBtn, emoteRow].forEach(b => (b.style.display = 'none'));
    emoteBubbles.forEach(b => (b.el.style.display = 'none'));
    toggleMap(false);
    const aw = over.querySelector('#sbAwards');
    if (aw) aw.innerHTML = '';
    if (window.GD3) {
      window.GD3.slowMult = 1; window.GD3.discoUntil = 0; window.GD3.lightsOut = false;
      window.GD3.fogMult = 1; window.GD3.speedMult = 1; window.GD3.creakMult = 1; window.GD3.bloodmoon = false;
    }
    houseRule = null;
    unpossess();
    spookRow.style.display = 'none';
    phase = 'walk'; role = null; meDead = false; myTasks = []; votedFor = null;
    voiceCtl.meDead = false; voiceCtl.meeting = false; voiceCtl.deadSet.clear();
    aliveIds.clear(); clearBodies();
    peers.forEach(pr => { pr.dead = false; });
    ghostVisibility();
    Object.values(rings).forEach(r => (r.visible = false));
    [tasksEl, tint, deadEl, roleEl, over].forEach(d => (d.style.display = 'none'));
    meet.style.display = 'none';
    setBar(0, 0);
    if (window.GD3) window.GD3.freeze = false;
  }

  // ---------- meeting ui ----------
  function openMeeting(by, reason, alive) {
    exitCam();
    toggleMap(false);
    dragging = null; dragBtn.textContent = 'DRAG BODY';
    phase = 'meeting'; votedFor = null;
    voiceCtl.meeting = true;
    meetingEndsAt = Date.now() + 45000;
    clearBodies();
    if (window.GD3) window.GD3.freeze = true;
    if (aliveIds.has(sock.id)) { // gather the living around the button
      const idx = Math.max(0, alive.indexOf(sock.id));
      const a = (idx / Math.max(1, alive.length)) * Math.PI * 2;
      P.x = BUTTON_POS.x + Math.cos(a) * 1.6; P.z = BUTTON_POS.z + Math.sin(a) * 1.6;
      P.y = 0; P.vy = 0; // meetings happen at the den button, downstairs
      P.yaw = Math.atan2(BUTTON_POS.x - P.x, BUTTON_POS.z - P.z) + Math.PI;
    }
    meet.querySelector('#sbMeetWhy').textContent = reason === 'body'
      ? `${nameOf(by)} FOUND A BODY. awkward.` : `${nameOf(by)} SLAPPED THE PANIC BUTTON.`;
    meet.querySelector('#sbResult').textContent = '';
    const cands = meet.querySelector('#sbCands');
    cands.innerHTML = '';
    alive.forEach(id => {
      const row = el(`<div class="sbCand" data-id="${id}">
        <div class="dot" style="background:${CHAR_COLORS[charOf(id)] || '#888'}"></div>
        <div class="nm">${nameOf(id)}${id === sock.id ? ' (you)' : ''}</div>
        <span class="vt"></span><button ${aliveIds.has(sock.id) ? '' : 'disabled'}>VOTE</button></div>`);
      row.querySelector('button').addEventListener('click', () => vote(id));
      cands.appendChild(row);
    });
    meet.querySelector('#sbSkip').disabled = !aliveIds.has(sock.id);
    meet.style.display = 'flex';
  }
  function vote(who) {
    if (phase !== 'meeting' || votedFor || !aliveIds.has(sock.id)) return;
    votedFor = who;
    sock.emit('sb-vote', { who });
    meet.querySelectorAll('.sbCand button').forEach(b => (b.disabled = true));
    meet.querySelector('#sbSkip').disabled = true;
  }
  meet.querySelector('#sbSkip').addEventListener('click', () => vote('skip'));

  // ---------- socket events ----------
  sock.on('sb-role', ({ mode: m, imposter, tasks }) => {
    mode = m || 'classic';
    role = mode === 'monster' ? 'crew' : (imposter ? 'imposter' : 'crew');
    myTasks = (tasks || []).map(id => ({ id, done: false }));
    killReadyAt = Date.now() + KILL_CD;
    sfx.jingle();
    if (mode === 'monster') { roleEl.className = 'sbui'; roleEl.querySelector('b').textContent = 'THE MONSTER IS WAKING'; roleEl.querySelector('span').textContent = 'do every chore to put him back to sleep. do NOT laugh. he hears it.'; roleEl.style.display = 'block'; setTimeout(() => (roleEl.style.display = 'none'), 6000); }
    else if (mode === 'heist') { roleEl.className = 'sbui' + (imposter ? ' bad' : ''); roleEl.querySelector('b').textContent = imposter ? 'YOU ARE THE SNEAKY BASTARD' : 'THE HEIST IS ON'; roleEl.querySelector('span').textContent = imposter ? 'the crew is carrying treasure. relieve them of it. and their lives.' : 'carry all 4 treasures to the den chest. one is upstairs. survive.'; roleEl.style.display = 'block'; setTimeout(() => (roleEl.style.display = 'none'), 6000); }
    else showRole(imposter);
    renderTasks();
    myTasks.forEach(t => { if (rings[t.id]) rings[t.id].visible = true; });
  });
  sock.on('sb-begin', ({ mode: m, alive, total, items: its, rule }) => {
    mode = m || 'classic';
    phase = 'playing';
    aliveIds = new Set(alive);
    if (!aliveIds.has(sock.id)) role = 'spectator';
    setBar(0, total);
    startBtn.style.display = 'none'; modeBtn.style.display = 'none';
    if (mode === 'monster') { buildMonsterEntity(); voiceCtl.deadSet.clear(); }
    if (mode === 'heist' && its) { clearItems(); its.forEach(({ item, x, z, y }) => makeItem(item, x, z, y || 0)); }
    // TONIGHT'S HOUSE RULE: the house rolls the dice on every round
    houseRule = rule || null;
    if (window.GD3) {
      window.GD3.fogMult = rule && rule.id === 'fog' ? 2.0 : 1;
      window.GD3.speedMult = rule && rule.id === 'zoomies' ? 1.15 : 1;
      window.GD3.creakMult = rule && rule.id === 'creaky' ? 4 : 1;
      window.GD3.bloodmoon = !!(rule && rule.id === 'bloodmoon');
    }
    if (rule) setTimeout(() => toast("TONIGHT'S HOUSE RULE: " + rule.label, 4200), 1500);
  });
  sock.on('mw-pos', ({ x, z, y }) => { mwTgt = { x, z, y: y || 0 }; });
  sock.on('mw-roar', () => { sfx.spook(); if (window.GD3) window.GD3.shake = 0.35; toast('THE MONSTER HEARD THAT.', 2200); });
  sock.on('mw-caught', ({ id }) => {
    aliveIds.delete(id);
    sfx.sting();
    if (id === sock.id) { die('kill'); if (window.GD3) window.GD3.shake = 0.9; }
    else { const pr = peers.get(id); if (pr) pr.dead = true; ghostVisibility(); const d = Math.hypot(P.x - (monster ? monster.group.position.x : 0), P.z - (monster ? monster.group.position.z : 0)); if (d < 12 && window.GD3) window.GD3.shake = 0.4; }
    voiceCtl.deadSet.add(id);
  });
  sock.on('hs-grab', ({ item, by }) => {
    const it = items.get(item); if (!it) return;
    it.state = 'carried'; it.by = by;
    it.glow.visible = false;
    if (by === sock.id) { carrying = item; sfx.coin(); toast('YOU GRABBED THE ' + item.toUpperCase() + '. RUN.', 2400); }
  });
  sock.on('hs-drop', ({ item, x, z, y }) => {
    const it = items.get(item); if (!it) return;
    it.state = 'spot'; it.by = null; it.glow.visible = true;
    it.baseY = y || 0;
    it.mesh.position.set(x, it.baseY + 0.75, z); it.glow.position.set(x, it.baseY + 0.9, z);
    if (carrying === item) carrying = null;
  });
  sock.on('hs-score', ({ item, n, total }) => {
    const it = items.get(item);
    if (it) { it.state = 'chest'; it.mesh.visible = false; it.glow.visible = false; }
    if (carrying === item) carrying = null;
    setBar(n, total || 4); sfx.jingle();
    toast(`TREASURE ${n}/${total || 4} IN THE CHEST.`, 2600);
  });
  sock.on('house-xp', ({ xp, level }) => {
    const lvUp = level > houseLvl;
    houseXP = xp; houseLvl = level;
    houseHud.textContent = 'HOUSE LVL ' + level;
    if (world && world.applyHouseLevel) world.applyHouseLevel(level);
    if (lvUp) { sfx.fanfareGood(); toast('THE HOUSE LEVELED UP! NOW LEVEL ' + level + '.', 3600); }
  });
  sock.on('3d-shelf', () => { if (world && world.openShelf) world.openShelf(); });
  sock.on('3d-emote', ({ id, kind, x, z, y }) => { if (id !== sock.id) playEmote(id, kind, x, z, y || 0); });
  sock.on('sb-progress', ({ progress, total }) => setBar(progress, total));
  sock.on('sb-kill', ({ victim, x, z, y }) => {
    aliveIds.delete(victim);
    voiceCtl.deadSet.add(victim);
    spawnBody(victim, x, z, y || 0);
    burst(x, y || 0, z);
    const d = Math.hypot(P.x - x, P.z - z, P.y - (y || 0));
    if (victim === sock.id) {
      die('kill'); sfx.sting(); flash(0.55);
      if (navigator.vibrate) navigator.vibrate([60, 40, 90]);
      if (window.GD3) window.GD3.shake = 0.8;
    } else {
      if (d < 14) { sfx.sting(sfx.panTo(x, z)); flash(Math.max(0.08, 0.3 - d * 0.02)); if (window.GD3) window.GD3.shake = Math.max(0.15, 0.5 - d * 0.03); }
      if (d < 10 && !meDead && aliveIds.has(sock.id)) giggle = Math.min(1, giggle + 0.45); // nervous laughter is real
      const pr = peers.get(victim); if (pr) pr.dead = true; ghostVisibility();
      peers.forEach(w => { // every rig that saw it goes wide-eyed for a beat
        if (!w.dead && Math.hypot(w.cx - x, w.cz - z, (w.cy || 0) - (y || 0)) < 8) w.fearUntil = performance.now() + 2600;
      });
    }
    if (dragging === victim) { dragging = null; dragBtn.textContent = 'DRAG BODY'; }
  });

  sock.on('sb-laugh', ({ id, x, z, y }) => {
    const d = Math.hypot(P.x - x, P.z - z, P.y - (y || 0));
    if (id !== sock.id && d < 15) sfx.laugh(sfx.panTo(x, z));
    const pr = peers.get(id);
    if (pr) pr.tk = 3; // big mouth flap
    if (role === 'imposter' && id !== sock.id) toast(`A LAUGH. FROM ${roomNameAt(x, z, y || 0)}.`, 2600);
  });
  sock.on('sb-sab', ({ kind, dur }) => applySab(kind, dur));
  sock.on('sb-sab-end', endSab);
  sock.on('sb-drag', ({ victim, x, z, y }) => {
    const m = bodies.get(victim);
    if (m) {
      if (m.userData.sim) m.userData.sim.active = false;
      m.position.set(x, (y || 0) + 0.28, z);
      m.rotation.x = 0; m.rotation.z = Math.PI / 2;
    }
  });
  sock.on('sb-haunt', ({ x, z, y }) => {
    if (meDead) return;
    const d = Math.hypot(P.x - x, P.z - z, P.y - (y || 0));
    if (d < 10) { sfx.spook(sfx.panTo(x, z)); if (window.GD3) window.GD3.shake = 0.25; toast('something moved.', 1800); }
  });
  const FART_LINES = ['SOMEBODY RIPPED ONE IN ', 'A GOD-AWFUL SMELL FROM ', 'THAT CAME FROM ', 'WHO DID THAT. IT WAS ', 'THE STENCH IS COMING FROM '];
  const BURP_LINES = ['A MONSTROUS BURP FROM ', 'SOMEONE ROARED FROM BOTH ENDS IN ', 'GOT DAYUM. A BELCH FROM '];
  function pingRing(x, z, color, y = 0) { // a stink beacon on the floor ‚Äî reveals a location to everyone
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.05, z);
    scene.add(ring);
    let s = 0;
    const iv = setInterval(() => {
      s += 0.08; ring.scale.setScalar(1 + s * 2); ring.material.opacity = Math.max(0, 0.9 - s * 0.35);
      if (ring.material.opacity <= 0) { clearInterval(iv); scene.remove(ring); }
    }, 50);
  }
  function fartCloud(x, z, green, y = 0) {
    const grp = new THREE.Group(); grp.position.set(x, y + 0.4, z);
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18 + Math.random() * 0.14, 8, 6),
        new THREE.MeshStandardMaterial({ color: green ? 0x8aa83a : 0xb8a86a, transparent: true, opacity: 0.5,
          emissive: green ? 0x4a6a1a : 0x3a2a10, emissiveIntensity: 0.4 }));
      puff.position.set((Math.random() - 0.5) * 0.5, Math.random() * 0.5, (Math.random() - 0.5) * 0.5);
      grp.add(puff);
    }
    scene.add(grp);
    let life = 0;
    const iv = setInterval(() => {
      life += 0.05;
      grp.children.forEach(p => { p.position.y += 0.02; p.scale.multiplyScalar(1.02); p.material.opacity *= 0.94; });
      grp.rotation.y += 0.03;
      if (life > 2.4) { clearInterval(iv); scene.remove(grp); }
    }, 50);
  }
  sock.on('sb-event', ({ kind, x, z, y, id }) => {
    const nearHere = roomNameAt(x, z, y || 0);
    if (kind === 'snore') {
      sfx.snore();
      toast('THE MONSTER SNORES. LOUDLY. GREAT COVER FOR NOISE.', 2800);
      if (roomNameAt(P.x, P.z, P.y) === 'THE BASEMENT' && window.GD3) window.GD3.shake = 0.3;
    } else if (kind === 'gnomes' && window.GD3 && window.GD3.world) {
      window.GD3.world.gnomeOmen(x, z);
      toast('every gnome just slowly turned to look at... something.', 3200);
    } else if (kind === 'fart' || kind === 'burp') {
      if (kind === 'fart') sfx.fart(sfx.panTo(x, z)); else sfx.burp(sfx.panTo(x, z));
      fartCloud(x, z, kind === 'fart', y || 0);
      const pool = kind === 'fart' ? FART_LINES : BURP_LINES;
      const who = id === sock.id ? 'YOU (we all know)' : nearHere;
      toast(pool[Math.floor(Math.random() * pool.length)] + who + '.', 3000);
      // it reveals a location, like a stink beacon ‚Äî and it's contagiously funny nearby
      const d = Math.hypot(P.x - x, P.z - z, P.y - (y || 0));
      if (d < 8 && !meDead && aliveIds.has(sock.id)) giggle = Math.min(1, giggle + 0.3 * (1 - d / 8));
      pingRing(x, z, kind === 'fart' ? 0x8aa83a : 0xb8a86a, y || 0);
    } else if (kind === 'stink') {
      sfx.queef();
      fartCloud(0.6, 0.4, true); // the den cheese has turned
      toast('THE CHEESE IN THE DEN HAS ACHIEVED SENTIENCE. AND ODOR.', 3000);
      const d = Math.hypot(P.x - 0.6, P.z - 0.4);
      if (d < 8 && !meDead) giggle = Math.min(1, giggle + 0.25 * (1 - d / 8));
    } else if (kind === 'disco') {
      sfx.disco();
      toast('DISCO FEVER. THE JUKEBOX WILL NOT BE STOPPED.', 3400);
      if (window.GD3) window.GD3.discoUntil = performance.now() + 9000;
      if (!meDead && aliveIds.has(sock.id)) giggle = Math.min(1, giggle + 0.12);
    } else if (kind === 'quake') {
      sfx.quake();
      toast('THE HOUSE SHUDDERS. NOBODY KNOWS WHY. NOBODY ASKS.', 2800);
      if (window.GD3) window.GD3.shake = 0.7;
    } else if (kind === 'flicker') {
      if (window.GD3) { window.GD3.lightsOut = true; setTimeout(() => { if (!sab) window.GD3.lightsOut = false; }, 600); }
      sfx.blip();
      toast('the lights flicker. the house is thinking.', 2200);
    } else if (kind === 'stairs') {
      sfx.sting();
      if (window.GD3) window.GD3.shake = 0.5;
      toast('HE LEARNED THE STAIRS.', 4200);
    }
  });
  sock.on('sb-meeting', ({ by, reason, alive }) => {
    sfx.alarm();
    if (window.GD3) window.GD3.shake = 0.3;
    openMeeting(by, reason, alive);
  });
  sock.on('sb-voted', ({ by }) => {
    const row = meet.querySelector(`.sbCand[data-id="${by}"] .vt`);
    if (row) row.textContent = 'VOTED';
  });
  sock.on('sb-eject', ({ id, wasImposter }) => {
    const res = meet.querySelector('#sbResult');
    if (!id) res.textContent = 'NOBODY EJECTED. very brave. very useless.';
    else {
      if (wasImposter) sfx.fanfareGood(); else sfx.fail();
      res.textContent = `${nameOf(id)} WAS LAUNCHED INTO THE YARD. THEY WERE ${wasImposter ? 'THE SNEAKY BASTARD.' : 'A NORMAL IDIOT. oops.'}`;
      aliveIds.delete(id);
      voiceCtl.deadSet.add(id);
      if (id === sock.id) die('eject');
      else { const pr = peers.get(id); if (pr) pr.dead = true; ghostVisibility(); }
    }
  });
  sock.on('sb-resume', () => {
    setTimeout(() => {
      meet.style.display = 'none';
      voiceCtl.meeting = false;
      phase = 'playing';
      killReadyAt = Date.now() + KILL_CD;
      if (window.GD3) window.GD3.freeze = false;
    }, 2600);
  });
  sock.on('sb-over', ({ winner, mode: m, imposter, stats, recap }) => {
    endSab();
    dragging = null; dragBtn.textContent = 'DRAG BODY';
    exitCam();
    unpossess();
    phase = 'over';
    setTimeout(() => (meet.style.display = 'none'), 2600);
    voiceCtl.meeting = false;
    if (window.GD3) window.GD3.freeze = false;
    let title, sub;
    if (winner === 'monster') { title = 'THE MONSTER ATE EVERYONE'; sub = 'you should have stayed asleep too.'; }
    else if (m === 'monster') { title = 'BACK TO SLEEP'; sub = 'the chores are done. the monster returns to his chair.'; }
    else if (m === 'heist') { title = winner === 'crew' ? 'THE HEIST SUCCEEDS' : 'THE BASTARD KEPT THE LOOT'; sub = `it was ${nameOf(imposter)} all along.`; }
    else { title = winner === 'crew' ? 'THE CREW WINS' : 'THE SNEAKY BASTARD WINS'; sub = `it was ${nameOf(imposter)} all along.`; }
    over.querySelector('b').textContent = title;
    over.querySelector('span').textContent = sub;
    over.style.display = 'block';
    const iWon = winner === 'monster' ? false : (winner === 'crew') === (role !== 'imposter');
    if (iWon) sfx.fanfareGood(); else sfx.fanfareBad();
    if (winner === 'crew' && role === 'crew') award(30);
    if (winner === 'imposter' && role === 'imposter') award(50);
    // awards ceremony
    let aw = over.querySelector('#sbAwards');
    if (!aw) { aw = el('<div id="sbAwards"></div>'); over.appendChild(aw); }
    const top = obj => Object.entries(obj || {}).sort((a, b) => b[1] - a[1])[0];
    const lines = [];
    if (stats) {
      if (imposter) {
        const k = stats.kills[imposter] || 0;
        lines.push(`<b>THE BASTARD:</b> ${nameOf(imposter)} (${k} murder${k === 1 ? '' : 's'})`);
      }
      const tc = top(stats.tasks);
      if (tc) lines.push(`<b>${m === 'heist' ? 'TOP LOOTER' : 'CHORE CHAMPION'}:</b> ${nameOf(tc[0])} (${tc[1]} ${m === 'heist' ? 'hauls' : 'chores'})`);
      const lf = top(stats.laughs);
      if (lf) lines.push(`<b>COULD NOT HOLD IT:</b> ${nameOf(lf[0])} (${lf[1]} laugh bursts)`);
      if (stats.firstDeath) lines.push(`<b>SPEEDRAN DEATH:</b> ${nameOf(stats.firstDeath)}`);
    }
    aw.innerHTML = lines.join('<br>');
    if (recap && (recap.path.length || recap.kills.length)) drawRecap(recap, m); // after the awards exist
  });
  sock.on('sb-walk', resetAll);

  // ---------- per-frame ----------
  function nearestAlivePeer() {
    let best = null, bd = 1e9;
    peers.forEach((pr, id) => {
      if (pr.dead || !aliveIds.has(id)) return;
      const d = Math.hypot(P.x - pr.cx, P.z - pr.cz, P.y - (pr.cy || 0)); // no killing through the floor
      if (d < bd) { bd = d; best = id; }
    });
    return { id: best, d: bd };
  }
  function nearestBody() {
    let best = null, bd = 1e9;
    bodies.forEach((m, id) => {
      const d = Math.hypot(P.x - m.position.x, P.z - m.position.z, (P.y + 0.28) - m.position.y);
      if (d < bd) { bd = d; best = id; }
    });
    return { id: best, d: bd };
  }

  choreBtn.addEventListener('click', () => { if (nearTask && !mini) openMini(nearTask); });
  killBtn.addEventListener('click', () => {
    const n = nearestAlivePeer();
    if (n.id && n.d < 2.0) {
      sock.emit('sb-kill', { target: n.id }); killReadyAt = Date.now() + KILL_CD;
      if (navigator.vibrate) navigator.vibrate(50);
      if (window.GD3) window.GD3.shake = Math.max(window.GD3.shake, 0.35); // the lunge
    }
  });
  reportBtn.addEventListener('click', () => {
    const b = nearestBody();
    if (b.id && b.d < 2.8) sock.emit('sb-report', { victim: b.id });
  });
  panicBtn.addEventListener('click', () => sock.emit('sb-button'));
  startBtn.addEventListener('click', () => sock.emit('sb-start', { mode: pickMode }));
  grabBtn.addEventListener('click', () => {
    const near = nearestItem();
    if (near) sock.emit('hs-grab', { item: near });
  });
  deliverBtn.addEventListener('click', () => sock.emit('hs-deliver'));

  function nearestItem() {
    let best = null, bd = 2.2;
    items.forEach((it, id) => {
      if (it.state !== 'spot') return;
      const d = Math.hypot(P.x - it.mesh.position.x, P.z - it.mesh.position.z, P.y - (it.baseY || 0));
      if (d < bd) { bd = d; best = id; }
    });
    return best;
  }

  // chores: proximity scan + mini-game progress (living crew and diligent ghosts alike)
  function choreScanTick(t, dt) {
    nearTask = null;
    for (const tk of myTasks) {
      if (tk.done) continue;
      const s = STATIONS[tk.id];
      if (Math.hypot(P.x - s.x, P.z - s.z) < s.r && Math.abs(P.y - (s.y || 0)) < 1.6) { nearTask = tk; break; }
    }
    if (mini && (!nearTask || nearTask.id !== mini.task.id)) closeMini(); // wandered off mid-chore
    if (mini) {
      if (mini.type === 'mash') {
        mini.count = Math.max(0, mini.count - 2.2 * dt); // slack off and it drains
        const bar = miniEl.querySelector('#sbMashBar');
        const r = Math.max(0, Math.min(10, Math.round(mini.count)));
        if (bar) bar.textContent = '‚ñà'.repeat(r) + '‚ñë'.repeat(10 - r);
      } else if (mini.type === 'timing') {
        mini.cursor = Math.sin(t * 2.7);
        const cur = miniEl.querySelector('#sbTimeCur');
        if (cur) cur.style.left = (48 + mini.cursor * 44) + '%';
      }
      choreBtn.style.display = 'none';
    } else if (nearTask) {
      choreBtn.style.display = 'block';
      const duo = DUO_LABEL[nearTask.id];
      choreBtn.textContent = (duo ? 'DUO: ' : 'DO: ') + STATIONS[nearTask.id].label + (duo ? ' (needs a buddy)' : '');
    } else choreBtn.style.display = 'none';
  }

  tickers.push((t, dt) => {
    simBodies(dt); // corpses obey gravity, comedy, and staircases
    // mannequins with tenants: sync possessed bodies every frame, any phase
    if (world && world.mannequins) {
      world.mannequins.forEach((m, i) => { m.userData.possessed = (window.GD3 && window.GD3.possess === i); });
      peers.forEach(pr => {
        if (pr.pm >= 0 && world.mannequins[pr.pm]) {
          const m = world.mannequins[pr.pm];
          m.userData.possessed = true;
          m.position.x = Math.max(-12.4, Math.min(-3.6, pr.cx));
          m.position.z = Math.max(-16.4, Math.min(-5.6, pr.cz));
          m.rotation.y = pr.cyaw;
        }
      });
    }
    // start button + mode picker (host, walk phase, enough players for the picked mode)
    const modeMin = (MODES3D.find(m => m.id === pickMode) || {}).min || 3;
    const canStart = phase === 'walk' && isHost && houseCount >= modeMin;
    startBtn.style.display = (phase === 'walk' && isHost) ? 'block' : 'none';
    startBtn.disabled = !canStart;
    startBtn.textContent = canStart ? 'START ROUND' : `NEED ${modeMin} PLAYERS`;
    modeBtn.style.display = (phase === 'walk' && isHost) ? 'block' : 'none';
    hatsBtn.style.display = phase === 'walk' ? 'block' : 'none';
    mapBtn.style.display = (camIdx < 0 && phase !== 'meeting' && phase !== 'over') ? 'block' : 'none';
    if (mapOpen) drawMap();
    emoteBtn.style.display = (phase !== 'walk' || houseCount > 1) ? 'block' : 'none';
    camsBtn.style.display = (mode !== 'monster' && camIdx < 0 && !meDead && phase === 'playing' && Math.hypot(P.x - 4.6, P.z - 5.75) < 2.1 && Math.abs(P.y) < 1.5) ? 'block' : 'none';

    // float emote bubbles above whoever emoted
    if (camera) emoteBubbles.forEach((bub, id) => {
      if (!bub.until || performance.now() > bub.until) { bub.el.style.display = 'none'; return; }
      let wx = bub.wx, wz = bub.wz, wy = 2.1;
      if (id === sock.id) { wx = P.x; wz = P.z; }
      else { const pr = peers.get(id); if (pr) { wx = pr.cx; wz = pr.cz; wy = 2.1 + (pr.cy || 0); } }
      V3E.set(wx, wy, wz).project(camera);
      if (V3E.z < 1) { bub.el.style.display = 'block'; bub.el.style.left = (V3E.x * 0.5 + 0.5) * window.innerWidth + 'px'; bub.el.style.top = (-V3E.y * 0.5 + 0.5) * window.innerHeight + 'px'; }
      else bub.el.style.display = 'none';
    });

    // monster mode: interpolate the AI monster toward its target and animate it
    if (monster) {
      const g = monster.group;
      const dx = mwTgt.x - g.position.x, dz = mwTgt.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      g.position.x += dx * Math.min(1, dt * 6);
      g.position.z += dz * Math.min(1, dt * 6);
      g.position.y += ((mwTgt.y || 0) - g.position.y) * Math.min(1, dt * 6); // stairs, since house lvl 5
      if (dist > 0.05) { const want = Math.atan2(dx, dz); let d2 = want - g.rotation.y; while (d2 > Math.PI) d2 -= Math.PI * 2; while (d2 < -Math.PI) d2 += Math.PI * 2; g.rotation.y += d2 * Math.min(1, dt * 6); }
      monster.tick(t, dist > 0.06);
    }

    // heist: glow bob on loose treasures, carried item rides the carrier
    items.forEach((it, id) => {
      if (it.state === 'spot') { it.mesh.rotation.y += dt * 1.2; it.mesh.position.y = (it.baseY || 0) + 0.75 + Math.sin(t * 2 + it.mesh.position.x) * 0.06; }
      else if (it.state === 'carried') {
        const carrier = it.by === sock.id ? { x: P.x, z: P.z, yaw: P.yaw, y: (P.y || 0) } : (() => { const pr = peers.get(it.by); return pr ? { x: pr.cx, z: pr.cz, yaw: pr.cyaw, y: pr.cy || 0 } : null; })();
        if (carrier) { it.mesh.visible = true; it.mesh.position.set(carrier.x - Math.sin(carrier.yaw) * 0.1, carrier.y + 1.5, carrier.z - Math.cos(carrier.yaw) * 0.1); it.mesh.rotation.y = carrier.yaw; }
      }
    });

    // movement drag from clenching or flood puddles
    let slow = 1;
    const inRound = phase === 'playing' && role && role !== 'spectator' && !meDead;
    if (inRound && clenchHeld) slow *= 0.6;
    if (sab && sab.kind === 'pipes' && window.GD3.world) {
      for (const pd of window.GD3.world.puddles) {
        if (Math.hypot(P.x - pd.x, P.z - pd.z) < pd.r) { slow *= 0.55; break; }
      }
    }
    window.GD3.slowMult = slow;

    // the giggle meter: the house is trying to make you laugh
    if (inRound && aliveIds.has(sock.id)) {
      const talk = window.GD3.net.getTalk();
      if (talk >= 2) giggle += 0.11 * talk * dt;
      giggle = Math.max(0, giggle - (clenchHeld ? 0.5 : 0.03) * dt);
      if (giggle >= 1) {
        giggle = 0.35;
        sock.emit('sb-laugh');
        sfx.laugh();
        toast('YOU BURST OUT LAUGHING. EVERYONE HEARD.', 2400);
      }
      giggleEl.style.display = 'block';
      const gb = giggleEl.firstElementChild;
      gb.style.width = (giggle * 100) + '%';
      gb.style.background = giggle > 0.75 ? '#ff5a5a' : giggle > 0.45 ? '#ffb34d' : '#c9a24a';
      clenchBtn.style.display = 'block';
      clenchBtn.style.borderColor = clenchHeld ? '#ff5a5a' : '#c9a24a';
      clenchBtn.textContent = clenchHeld ? 'CLENCHING' : 'CLENCH';
      window.GD3.giggleFx = giggle; // the engine wobbles the camera with it
    } else { giggleEl.style.display = 'none'; clenchBtn.style.display = 'none'; window.GD3.giggleFx = 0; }

    // dead folks get to haunt
    hauntBtn.style.display = (phase === 'playing' && meDead) ? 'block' : 'none';
    if (meDead) {
      const cd = hauntReady - Date.now();
      hauntBtn.textContent = cd > 0 ? `HAUNT (${Math.ceil(cd / 1000)}s)` : 'HAUNT';
      hauntBtn.disabled = cd > 0;
    }

    const ghost = meDead && phase === 'playing';
    const ghostChores = ghost && role === 'crew' && mode !== 'heist'; // the dead still owe chores
    if (phase !== 'playing' || meDead || role === 'spectator') {
      [killBtn, reportBtn, panicBtn, sabBtn, ventBtn, dragBtn, fixBtn].forEach(b => (b.style.display = 'none'));
      if (!ghostChores) choreBtn.style.display = 'none';
      sabRow.style.display = 'none'; ventRow.style.display = 'none';
      if (mini && !ghostChores) closeMini();
      if (phase !== 'playing') { spookRow.style.display = 'none'; return; }
    }
    Object.values(rings).forEach(r => { if (r.visible) r.scale.setScalar(1 + Math.sin(t * 3) * 0.12); });
    // the afterlife control panel
    spookRow.style.display = ghost ? 'flex' : 'none';
    if (ghost) {
      const cd = spookReady - Date.now();
      spookRow.querySelectorAll('button[data-k]').forEach(b => {
        if (b.dataset.k === 'possess') {
          const on = window.GD3.possess != null;
          b.style.display = (on || nearMannequin() >= 0) ? 'block' : 'none';
          b.textContent = on ? 'UNPOSSESS' : 'POSSESS THE MANNEQUIN';
        } else b.disabled = cd > 0;
      });
      if (window.GD3.possess != null) { // a mannequin moves slowly. for effect.
        window.GD3.slowMult = Math.min(window.GD3.slowMult || 1, 0.35);
        P.x = Math.max(-12.4, Math.min(-3.6, P.x));
        P.z = Math.max(-16.4, Math.min(-5.6, P.z));
        const m = world.mannequins && world.mannequins[window.GD3.possess];
        if (m) { m.position.x = P.x; m.position.z = P.z; m.rotation.y = P.yaw; }
      }
    }
    if (meDead || role === 'spectator') {
      if (ghostChores) choreScanTick(t, dt);
      return;
    }

    // fix point for active sabotage (anyone alive can fix; the bastard just won't)
    const fx2 = sab && FIXES[sab.kind];
    if (fx2 && Math.hypot(P.x - fx2.x, P.z - fx2.z) < 2.1 && Math.abs(P.y) < 1.5) {
      fixBtn.style.display = 'block';
      fixBtn.textContent = 'FIX THE ' + fx2.label;
    } else fixBtn.style.display = 'none';

    // imposter kit: sabotage, vents, body dragging
    if (role === 'imposter') {
      const sabCd = sabReadyLocal - Date.now();
      sabBtn.style.display = 'block';
      sabBtn.disabled = !!sab || sabCd > 0;
      sabBtn.textContent = sab ? 'SABOTAGE (ACTIVE)' : sabCd > 0 ? `SABOTAGE (${Math.ceil(sabCd / 1000)}s)` : 'SABOTAGE';
      const nearVent = VENTS.find(v => Math.hypot(P.x - v.x, P.z - v.z) < 1.6 && Math.abs(P.y - (v.y || 0)) < 1.5);
      const ventCd = ventReady - Date.now();
      ventBtn.style.display = nearVent ? 'block' : 'none';
      if (nearVent) {
        ventBtn.disabled = ventCd > 0;
        ventBtn.textContent = ventCd > 0 ? `VENT (${Math.ceil(ventCd / 1000)}s)` : 'VENT';
      } else ventRow.style.display = 'none';
      const nb2 = nearestBody();
      dragBtn.style.display = (dragging || (nb2.id && nb2.d < 2.2)) ? 'block' : 'none';
      if (dragging) {
        const m = bodies.get(dragging);
        if (!m) { dragging = null; dragBtn.textContent = 'DRAG BODY'; }
        else {
          m.position.set(P.x + Math.sin(P.yaw) * 0.7, P.y + 0.28, P.z + Math.cos(P.yaw) * 0.7);
          if (Date.now() - lastDragEmit > 150) {
            lastDragEmit = Date.now();
            sock.emit('sb-drag', { victim: dragging, x: +m.position.x.toFixed(2), z: +m.position.z.toFixed(2), y: +P.y.toFixed(2) });
          }
        }
      }
    }

    // chore proximity + live mini-game (shared with the ghost path)
    choreScanTick(t, dt);

    // HEIST buttons
    if (mode === 'heist' && role !== 'imposter') {
      const nearI = nearestItem();
      grabBtn.style.display = (!carrying && nearI) ? 'block' : 'none';
      if (nearI) grabBtn.textContent = 'GRAB THE ' + nearI.toUpperCase();
      deliverBtn.style.display = (carrying && Math.hypot(P.x - (-1.7), P.z - (-4.35)) < 2.2 && Math.abs(P.y) < 1.5) ? 'block' : 'none';
    } else { grabBtn.style.display = 'none'; deliverBtn.style.display = 'none'; }

    // kill button (classic + heist bastard)
    if (role === 'imposter') {
      const n = nearestAlivePeer(), cd = killReadyAt - Date.now();
      if (n.id && n.d < 2.0) {
        killBtn.style.display = 'block';
        killBtn.textContent = cd > 0 ? `KILL (WAIT ${Math.ceil(cd / 1000)}s)` : `KILL ${nameOf(n.id)}`;
        killBtn.disabled = cd > 0;
      } else killBtn.style.display = 'none';
    }
    // report + panic (not in monster mode)
    if (mode !== 'monster') {
      const b = nearestBody();
      reportBtn.style.display = (b.id && b.d < 2.8) ? 'block' : 'none';
      if (b.id) reportBtn.textContent = `REPORT ${nameOf(b.id)}'S BODY`;
      panicBtn.style.display = (Math.hypot(P.x - BUTTON_POS.x, P.z - BUTTON_POS.z) < 2.4 && Math.abs(P.y) < 1.5) ? 'block' : 'none';
    } else { reportBtn.style.display = 'none'; panicBtn.style.display = 'none'; }
  });

  return {
    setHost(h) { isHost = h; },
    setCount(n) { houseCount = n; },
    setHouse(h) { if (!h) return; houseXP = h.xp || 0; houseLvl = h.level || 1; houseHud.textContent = 'HOUSE LVL ' + houseLvl; if (world && world.applyHouseLevel) world.applyHouseLevel(houseLvl); },
    debug: () => ({ phase, role, meDead, giggle: +giggle.toFixed(2), sab: sab && sab.kind, alive: [...aliveIds].map(id => nameOf(id)), tasks: myTasks, bodies: [...bodies.keys()] }),
    emitSab: k => sock.emit('sb-sabotage', { kind: k }),
    emitLaugh: () => sock.emit('sb-laugh'),
    emitStart: () => sock.emit('sb-start'),
    emitKill: id => sock.emit('sb-kill', { target: id }),
    emitTask: id => sock.emit('sb-task-done', { id }),
    emitPanic: () => sock.emit('sb-button'),
    emitVote: who => vote(who),
  };
}
