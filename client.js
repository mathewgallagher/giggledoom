/* GIGGLEDOOM client: rendering, physics, mic snitching, monster noises, quips, tasks, chaos, drip. */
'use strict';

// ---------- constants ----------
const CHARS = {
  zoomy:    { name: 'ZOOMY',       emoji: '🐇', speed: 4.2, size: 24, stepMs: 900,
              blurb: 'Fast as hell. Loud as hell. Those are clown shoes.',
              stat: 'SPEED 5/5 · STEALTH 1/5 · footsteps ping the monster' },
  slurp:    { name: 'BIG SLURP',   emoji: '🐖', speed: 2.4, size: 42, stepMs: 0,
              blurb: 'Completely silent. Completely spherical. A gentleman.',
              stat: 'SPEED 1/5 · STEALTH 4/5 · hiding spots visibly jiggle' },
  gremlin:  { name: 'LIL GREMLIN', emoji: '👺', speed: 3.1, size: 16, stepMs: 2500,
              blurb: 'Knee-height menace. Fits in spots nobody else can.',
              stat: 'SPEED 3/5 · STEALTH 3/5 · squeaky decoy + tiny spots' },
  wallfish: { name: 'WALLFISH',    emoji: '🦑', speed: 2.9, size: 26, stepMs: 2500,
              blurb: 'Sticks to walls, physically and morally.',
              stat: 'SPEED 2/5 · STEALTH 5/5 · hold still on a wall = near invisible' },
};
const SEEKER = { speed: 3.6, size: 46 };
// base body colours for the hand-drawn creatures (skins recolour these)
const CHAR_COL = { zoomy: '#37d6c6', slurp: '#ff93b0', gremlin: '#79d24d', wallfish: '#a06bff' };

// THE HOUSE. 7 rooms, 28 hiding spots, doors included free of charge.
const WORLD = { w: 2600, h: 1800 };
const WALLS = [
  { x: 0, y: 0, w: 2600, h: 30 }, { x: 0, y: 1770, w: 2600, h: 30 },
  { x: 0, y: 0, w: 30, h: 1800 }, { x: 2570, y: 0, w: 30, h: 1800 },
  // horizontal divider with door gaps
  { x: 30, y: 850, w: 350, h: 30 }, { x: 540, y: 850, w: 610, h: 30 },
  { x: 1330, y: 850, w: 250, h: 30 }, { x: 1740, y: 850, w: 410, h: 30 },
  { x: 2330, y: 850, w: 240, h: 30 },
  // top row verticals
  { x: 830, y: 30, w: 30, h: 320 }, { x: 830, y: 520, w: 30, h: 330 },
  { x: 1770, y: 30, w: 30, h: 320 }, { x: 1770, y: 520, w: 30, h: 330 },
  // bottom row verticals
  { x: 830, y: 880, w: 30, h: 320 }, { x: 830, y: 1370, w: 30, h: 400 },
  { x: 1500, y: 880, w: 30, h: 320 }, { x: 1500, y: 1370, w: 30, h: 400 },
  { x: 2000, y: 880, w: 30, h: 220 }, { x: 2000, y: 1270, w: 30, h: 500 },
];
// short = compass tag. wall/floor/ceil = per-room colours so each room reads distinct in first person.
const ROOMS = [
  { name: 'THE KITCHEN',                   short: 'KITCHEN',  x: 30,   y: 30,  w: 800, h: 820, tint: '#241a1a', wall: '#6e5138', floor: '#2b211a', ceil: '#171012' },
  { name: 'THE LIVING ROOM',               short: 'LIVING',   x: 860,  y: 30,  w: 910, h: 820, tint: '#20182c', wall: '#6a4a86', floor: '#241a30', ceil: '#140f1c' },
  { name: 'THE BEDROOM (LOCK THE DOOR)',   short: 'BEDROOM',  x: 1800, y: 30,  w: 770, h: 820, tint: '#2a1526', wall: '#9c4f7a', floor: '#2c1826', ceil: '#180d16' },
  { name: "THE GARAGE (DAD'S LAIR)",       short: 'GARAGE',   x: 30,   y: 880, w: 800, h: 890, tint: '#16181e', wall: '#465066', floor: '#1c2028', ceil: '#0e1014' },
  { name: 'THE BASEMENT (SUS)',            x: 860,  y: 880, w: 640, h: 890, short: 'BASEMENT', tint: '#141018', wall: '#3d3550', floor: '#17131e', ceil: '#0b090f' },
  { name: 'THE BATHROOM (COURTESY FLUSH)', short: 'BATHROOM', x: 1530, y: 880, w: 470, h: 890, tint: '#141e26', wall: '#3f7f96', floor: '#182630', ceil: '#0c161c' },
  { name: 'THE BACKYARD (HOA APPROVED)',   short: 'BACKYARD', x: 2030, y: 880, w: 540, h: 890, tint: '#14261a', wall: '#3c6b45', floor: '#16281c', ceil: '#0a1810' },
];
// decorative (non-interactive) props to furnish rooms so they don't feel empty.
const DECOR = [
  { x: 400, y: 250, e: '🍳', s: 62 }, { x: 300, y: 500, e: '🔪', s: 50 }, { x: 720, y: 430, e: '☕', s: 46 },
  { x: 1180, y: 300, e: '🪑', s: 66 }, { x: 1450, y: 520, e: '🖼️', s: 58 }, { x: 970, y: 480, e: '💡', s: 54 }, { x: 1300, y: 700, e: '🪴', s: 60 },
  { x: 2100, y: 300, e: '🪞', s: 62 }, { x: 2350, y: 520, e: '🧴', s: 46 }, { x: 2000, y: 480, e: '🕯️', s: 50 },
  { x: 300, y: 1200, e: '🛢️', s: 60 }, { x: 500, y: 1450, e: '🔧', s: 46 }, { x: 720, y: 1300, e: '🪜', s: 66 },
  { x: 1000, y: 1250, e: '🕯️', s: 48 }, { x: 1350, y: 1450, e: '🕸️', s: 54 }, { x: 1180, y: 1550, e: '⚰️', s: 70 },
  { x: 1620, y: 1250, e: '🪥', s: 44 }, { x: 1850, y: 1450, e: '🧼', s: 44 }, { x: 1780, y: 1300, e: '🪒', s: 42 },
  { x: 2150, y: 1200, e: '🌷', s: 52 }, { x: 2450, y: 1450, e: '🪴', s: 60 }, { x: 2250, y: 1550, e: '🦩', s: 66 },
];
// cap: 2 = two friends can cram in together (hide + try not to laugh, catch = both busted)
// secret: true = hidden until you wander close enough to discover it
const SPOTS = [
  { id: 'k1', x: 170,  y: 170,  emoji: '🗄️', label: 'The Fridge (Leftovers of the Damned)' },
  { id: 'k2', x: 620,  y: 150,  emoji: '🧀', label: 'Giant Cheese Wheel (Why)' },
  { id: 'k3', x: 150,  y: 720,  emoji: '🗑️', label: 'Trash. Home.' },
  { id: 'k4', x: 650,  y: 700,  emoji: '🍕', label: 'Pizza Box Tower', small: true },
  { id: 'l1', x: 1010, y: 160,  emoji: '🛋️', label: 'Couch Cushion Abyss', cap: 2 },
  { id: 'l2', x: 1620, y: 160,  emoji: '📺', label: 'Behind the TV (Cables of Doom)' },
  { id: 'l3', x: 1000, y: 710,  emoji: '🪴', label: 'Extremely Fake Plant' },
  { id: 'l4', x: 1630, y: 710,  emoji: '🧸', label: 'Emotional Support Teddy Pile', small: true },
  { id: 'b1', x: 1930, y: 160,  emoji: '🛏️', label: 'Under the Bed (Monsters Only)', cap: 2 },
  { id: 'b2', x: 2460, y: 160,  emoji: '🚪', label: 'The Closet (Come Out Eventually)', cap: 2 },
  { id: 'b3', x: 2450, y: 710,  emoji: '🧺', label: 'Laundry: Chair Edition' },
  { id: 'b4', x: 1930, y: 710,  emoji: '👠', label: 'Shoe Pile of a Thousand Regrets', small: true },
  { id: 'g1', x: 190,  y: 1060, emoji: '🚗', label: 'Under the Car (Oil Included)', cap: 2 },
  { id: 'g2', x: 660,  y: 1040, emoji: '🛞', label: 'Tire Fort' },
  { id: 'g3', x: 180,  y: 1660, emoji: '📦', label: "Boxes of Your Ex's Stuff" },
  { id: 'g4', x: 670,  y: 1660, emoji: '🧰', label: 'Toolbox (Dad Knows)', small: true },
  { id: 's1', x: 970,  y: 1040, emoji: '🕸️', label: 'Cobweb Corner (Free Spiders)' },
  { id: 's2', x: 1390, y: 1040, emoji: '🍷', label: 'Wine Rack of Poor Choices' },
  { id: 's3', x: 980,  y: 1660, emoji: '🧟', label: 'Creepy Mannequin Squad' },
  { id: 's4', x: 1390, y: 1660, emoji: '🎸', label: "Dad's Band Equipment (RIP)", small: true },
  { id: 't1', x: 1630, y: 1030, emoji: '🛁', label: 'Tub of Regret', cap: 2 },
  { id: 't2', x: 1910, y: 1030, emoji: '🚿', label: 'The Shower (Sing Quietly)', cap: 2 },
  { id: 't3', x: 1640, y: 1670, emoji: '🚽', label: 'The Toilet (Godspeed)' },
  { id: 't4', x: 1910, y: 1670, emoji: '🧻', label: 'TP Fort (Y2K Stockpile)', small: true },
  { id: 'y1', x: 2140, y: 1020, emoji: '🌳', label: 'Suspicious Bush (Classic)' },
  { id: 'y2', x: 2470, y: 1040, emoji: '⛺', label: 'Murder Tent', cap: 2 },
  { id: 'y3', x: 2150, y: 1660, emoji: '🍖', label: 'Behind the Grill (Smells Great)' },
  { id: 'y4', x: 2470, y: 1660, emoji: '🌻', label: 'Sunflower Witness Protection', small: true },
  // ---- SECRET spots (hidden until discovered) ----
  { id: 'x1', x: 90,   y: 430,  emoji: '🕳️', label: 'Loose Floorboard (SECRET)', secret: true },
  { id: 'x2', x: 1740, y: 430,  emoji: '🚪', label: 'Hidden Wall Nook (SECRET)', secret: true },
  { id: 'x3', x: 1180, y: 1710, emoji: '🔥', label: 'Behind the Water Heater (SECRET)', secret: true },
  { id: 'x4', x: 2540, y: 1300, emoji: '🗿', label: 'Hollow Garden Gnome (SECRET)', secret: true, small: true },
  { id: 'x5', x: 430,  y: 90,   emoji: '❄️', label: 'Deep Freezer (SECRET, Cold)', secret: true },
];
// non-hiding gag objects to bonk for a sound + one-time coin. pure easter eggs.
const EGGS = [
  { id: 'duck',  x: 380,  y: 260,  emoji: '🦆', label: 'Rubber Duck', sfx: 'squeak', line: '🦆 SQUEAK. that is it. that is the duck.' },
  { id: 'button',x: 430,  y: 1500, emoji: '🔴', label: 'DO NOT PRESS', sfx: 'airhorn', line: '🔴 you pressed it. of course you did.', chaos: true },
  { id: 'paint', x: 1300, y: 90,   emoji: '🖼️', label: 'Cursed Painting', sfx: 'spooky', line: '🖼️ the painting whispers your search history.' },
  { id: 'juke',  x: 1300, y: 1200, emoji: '📻', label: 'Haunted Jukebox', sfx: 'disco', line: '📻 the jukebox only plays ONE cursed song.' },
  { id: 'gnome', x: 2300, y: 950,  emoji: '🧄', label: 'Garlic Shrine', sfx: 'squelch', line: '🧄 you disturbed the garlic. bold.' },
  { id: 'phone', x: 780,  y: 1300, emoji: '☎️', label: 'Ancient Phone', sfx: 'burp', line: '☎️ it is for you. it is always for you.' },
];
const ROOM_CENTERS = [[430, 440], [1315, 440], [2185, 440], [430, 1325], [1180, 1325], [1765, 1325], [2300, 1325]];
const SPAWN_JITTER = [[0, 0], [130, 90], [-130, -90]];

const HATS = [
  { e: '',   name: 'BALD & PROUD', cost: 0 },
  { e: '🧢', name: 'DAD CAP', cost: 6 },
  { e: '🎩', name: 'FANCY LAD', cost: 8 },
  { e: '🎀', name: 'PRECIOUS', cost: 8 },
  { e: '🍳', name: 'BREAKFAST', cost: 9 },
  { e: '🤠', name: 'YEEHAW', cost: 10 },
  { e: '🪖', name: 'TACTICOOL', cost: 12 },
  { e: '🧻', name: 'MUMMY BUDGET', cost: 14 },
  { e: '💩', name: 'THE HUMBLER', cost: 15 },
  { e: '🦄', name: 'MAJESTIC', cost: 18 },
  { e: '👑', name: 'ACTUAL ROYALTY', cost: 25 },
  { e: '🍆', name: 'THE EGGPLANT', cost: 20, adult: true },
  { e: '🩲', name: 'EMERGENCY UNDIES', cost: 16, adult: true },
];
const UPS = [
  { id: 'gym',   e: '🏋️', name: 'GYM RAT',    desc: '+4% run speed per level', cost: [12, 20, 30] },
  { id: 'yoga',  e: '🧘', name: 'HOT YOGA',   desc: '8% smaller body per level', cost: [14, 24] },
  { id: 'poker', e: '😐', name: 'POKER FACE', desc: 'laugh detector 15% more forgiving per level', cost: [15, 25, 35] },
  { id: 'greed', e: '🤑', name: 'CAPITALISM', desc: '+1 bonus coin on every task', cost: [20] },
];

// Skins are now recolours of the hand-drawn creature. skin value = a hex colour ('' = the
// character's default colour). Unlock = that character's level. Same palette set for all four.
const SKIN_PALETTES = [
  { c: '',        n: 'CLASSIC',      lvl: 0 },
  { c: '#8dff3a', n: 'TOXIC',        lvl: 1 },
  { c: '#ff6ad5', n: 'BUBBLEGUM',    lvl: 1 },
  { c: '#ffcf40', n: 'GOLD RUSH',    lvl: 2 },
  { c: '#ff3b3b', n: 'DEMON',        lvl: 3 },
  { c: '#4d6bff', n: 'DEEP VOID',    lvl: 4 },
  { c: '#e9f0ff', n: 'GHOST',        lvl: 5 },
  { c: '#20242e', n: 'SHADOW',       lvl: 5 },
  { c: '#c96ba0', n: 'CURSED FLESH', lvl: 2, adult: true },
];
const CHAR_SKINS = { zoomy: SKIN_PALETTES, slurp: SKIN_PALETTES, gremlin: SKIN_PALETTES, wallfish: SKIN_PALETTES };
// Props (held beside character). Unlock = selected character's level.
const ACCESSORIES = [
  {e:'',n:'NOTHING',lvl:0},
  {e:'🪄',n:'MAGIC WAND',lvl:1},
  {e:'🗡️',n:'TINY SWORD',lvl:2},
  {e:'🎈',n:'SAD BALLOON',lvl:3},
  {e:'🔥',n:'HANDS OF FLAME',lvl:4},
  {e:'🏆',n:'PARTICIPATION',lvl:5},
  {e:'🍌',n:'SUS BANANA',lvl:1,adult:true},
  {e:'🍆',n:'THE WAND (18+)',lvl:2,adult:true},
  {e:'🩲',n:'LUCKY DRAWERS',lvl:3,adult:true},
];
// Auras (particle trail). Unlock = selected character's level.
const AURAS = [
  {id:'',n:'NONE',color:null,g:'🚫',lvl:0},
  {id:'gold',n:'GOLD',color:'#ffe14d',g:'🟡',lvl:1},
  {id:'toxic',n:'TOXIC',color:'#52ffa8',g:'🟢',lvl:2},
  {id:'royal',n:'ROYAL',color:'#b28aff',g:'🟣',lvl:3},
  {id:'fire',n:'FIRE',color:'#ff5470',g:'🔴',lvl:4},
  {id:'rainbow',n:'RAINBOW',color:'rainbow',g:'🌈',lvl:5},
  {id:'sweat',n:'SUS MIST',color:'#7fd4ff',g:'💧',lvl:2,adult:true},
];
const AURA_COLOR = {};
AURAS.forEach(a => (AURA_COLOR[a.id] = a.color));

// Seeker unlockable abilities, gated by ACCOUNT level.
const SEEKER_ABILITIES = { flash: 0, lurk: 1, disguise: 2 };

// ROOM BOTS: one creepy resident per room. You ONLY hear the bot of the room you're standing
// in (played locally, so no wall-of-voices). Lines are dark / scary / crude / out of pocket.
// Held to: no slurs, no minors, no targeting real protected groups.
const ROOM_BOTS = [
  { room: 'THE KITCHEN',                   x: 130,  y: 780,  name: 'GREASE GOBLIN',   pitch: 0.7 },
  { room: 'THE LIVING ROOM',               x: 920,  y: 780,  name: 'COUCH WRAITH',    pitch: 0.5 },
  { room: 'THE BEDROOM (LOCK THE DOOR)',   x: 1860, y: 780,  name: 'THE THING UNDER', pitch: 0.35 },
  { room: "THE GARAGE (DAD'S LAIR)",       x: 120,  y: 1700, name: 'OIL DADDY',       pitch: 0.55 },
  { room: 'THE BASEMENT (SUS)',            x: 920,  y: 1700, name: 'BASEMENT BILL',   pitch: 0.3 },
  { room: 'THE BATHROOM (COURTESY FLUSH)', x: 1580, y: 1700, name: 'THE PLUMBER',     pitch: 0.6 },
  { room: 'THE BACKYARD (HOA APPROVED)',   x: 2100, y: 1700, name: 'HOA PRESIDENT',   pitch: 0.75 },
];
const BOT_LINES = [
  'i can hear your heartbeat. it is going too fast. it is going to give out. good.',
  'you smell like fear and off-brand body spray. i am into it.',
  'the last one who hid in here is still in the walls. wave hello.',
  'do you ever think about how little is actually holding your skin on?',
  'i watched you get ready today. that was the outfit? for dying?',
  'statistically one of you is not making it to breakfast. i have a favorite.',
  'smile for me. wider. WIDER. keep going until something tears.',
  'the monster is hungry AND lonely tonight. terrible combination for you.',
  'your ex is doing great, by the way. thriving. without you. anyway.',
  'i am not saying you are going to die in here, i am promising it.',
  'somebody in this room has to pee so bad and it is HILARIOUS to me.',
  'be honest, if the monster bought you dinner first, would that be so bad?',
  'i counted your ribs while you were breathing. you have a spare. i will take it.',
  'your search history flashed before my eyes and honestly you should be caught.',
  'i can smell exactly who forgot deodorant and i have already told the monster.',
  'when it grabs you, go limp. it likes a challenge and you will lose either way.',
  'you are hiding SO well. said no one. i can see your whole entire ass.',
  'that noise you just held in? i felt that in my soul. let it out. i dare you.',
  'nobody is coming to save you. i checked. they are all hiding worse than you.',
  'i want you to know the carpet in here has seen unspeakable things.',
  'giggle. just a little one. it will not hurt. it will hurt so much.',
  'you and me, we could run away together. i am kidding. you cannot run.',
  'the walls are thin and your dignity is thinner.',
  'somebody in here is thinking something nasty and the monster can taste it.',
];

const CAUGHT_LINES = [
  'YOU GOT YOINKED', 'ABSOLUTELY DEVOURED', 'SKILL ISSUE', 'THE MONSTER SAYS THANKS FOR THE MEAL',
  'YOU ARE SOUP NOW', 'CAUGHT IN 4K', 'NATURE IS HEALING', 'GOT DAYUM, GOT GOT',
];
const BLIND_LINES = [
  'One... two... I am so hungry...', 'Skip a few...', 'Do numbers even go this high...',
  'I can already smell someone...', 'Somebody picked the toilet. Bold.', 'Almost done counting. Or am I.',
];

// ---------- state ----------
const G = {
  screen: 'home', myId: null, code: null, room: null, modes: {}, perksList: [],
  ents: {},
  me: { x: 1300, y: 650 },
  mySpot: null, ghost: false, perkUsed: false, myQuip: null,
  joy: { on: false, bx: 0, by: 0, x: 0, y: 0 }, keys: {},
  pings: [], decoys: [], clones: [], snacks: [], loot: [],
  stunUntil: 0, eatUntil: 0, sprintUntil: 0,
  zoomUntil: 0, vanishUntil: 0, muteUntil: 0,
  lightsUntil: 0, quakeUntil: 0, discoUntil: 0, cheese: null,
  juice: 0, task: null, taskProg: 0,
  cds: { ability: 0, sprint: 0, check: 0, haunt: 0, catch: 0, flash: 0, lurk: 0, disguise: 0 },
  flashOn: false, lurkUntil: 0, disguise: null,
  facing: 0, shakeUntil: 0, shakeMag: 0, eggCd: {},
  camoTimer: 0, lastStep: 0, roarFlash: 0, monsterHue: 300,
  cam: { x: 1300, y: 650 }, lastPhase: 'lobby', timeLeft: 0,
  mic: { ok: false, tried: false, rms: 0, base: 0.01, hot: [], lastLaugh: 0, lastTalk: 0 },
  posTimer: null, ambientTimer: null, chickenTimer: null,
  endData: null, xpGain: null,
};
function shake(mag, ms) { G.shakeMag = mag; G.shakeUntil = now() + ms; }

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const now = () => performance.now();
const hash = s => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0);
const store = {
  get coins() { return +(localStorage.getItem('gd_coins') || 0); },
  set coins(v) { localStorage.setItem('gd_coins', v); },
  get owned() { try { return JSON.parse(localStorage.getItem('gd_owned') || '[""]'); } catch { return ['']; } },
  set owned(v) { localStorage.setItem('gd_owned', JSON.stringify(v)); },
  get hat() { return localStorage.getItem('gd_hat') || ''; },
  set hat(v) { localStorage.setItem('gd_hat', v); },
  get name() { return localStorage.getItem('gd_name') || ''; },
  set name(v) { localStorage.setItem('gd_name', v); },
  get ups() { try { return JSON.parse(localStorage.getItem('gd_ups') || '{}'); } catch { return {}; } },
  set ups(v) { localStorage.setItem('gd_ups', JSON.stringify(v)); },
  get xp() { try { return JSON.parse(localStorage.getItem('gd_xp') || '{}'); } catch { return {}; } },
  set xp(v) { localStorage.setItem('gd_xp', JSON.stringify(v)); },
  get equip() { try { return JSON.parse(localStorage.getItem('gd_equip') || '{}'); } catch { return {}; } },
  set equip(v) { localStorage.setItem('gd_equip', JSON.stringify(v)); },
  get adult() { return localStorage.getItem('gd_adult') === '1'; },
  set adult(v) { localStorage.setItem('gd_adult', v ? '1' : '0'); },
  get found() { try { return JSON.parse(localStorage.getItem('gd_found') || '{}'); } catch { return {}; } },
  set found(v) { localStorage.setItem('gd_found', JSON.stringify(v)); },
};
const SECRET_TOTAL = 5 + 6; // secret spots + easter eggs
function markFound(id, coins) {
  const f = store.found;
  if (f[id]) return false;
  f[id] = 1; store.found = f;
  if (coins) store.coins = store.coins + coins;
  return true;
}
const upLvl = id => store.ups[id] || 0;
const charXp = id => (store.xp[id] || 0);
const charLevel = id => Math.floor(Math.sqrt(charXp(id) / 30));
const totalXp = () => Object.values(store.xp).reduce((a, b) => a + b, 0);
const accLevel = () => Math.floor(Math.sqrt(totalXp() / 80));
function xpToNext(id) {
  const lvl = charLevel(id);
  const next = (lvl + 1) * (lvl + 1) * 30;
  const cur = lvl * lvl * 30;
  return { have: charXp(id) - cur, need: next - cur };
}
function addXp(id, amt) {
  const x = store.xp; x[id] = (x[id] || 0) + amt; store.xp = x;
}
function equipFor(charId) {
  const e = store.equip[charId] || {};
  return { skin: e.skin || '', acc: e.acc || '', aura: e.aura || '' };
}
function seekerUnlocked(ability) { return accLevel() >= (SEEKER_ABILITIES[ability] || 0); }

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  G.screen = id;
}
function myMeta() { return G.room ? G.room.players.find(p => p.id === G.myId) : null; }
function amSeeker() { return G.room && G.room.seekerId === G.myId; }
function mode() { return (G.room && G.modes[G.room.mode]) || { hideTime: 20, seekTime: 180, seekerSpeed: 1, micSens: 1, vision: 620 }; }
function seekerEnt() {
  if (!G.room || !G.room.seekerId) return null;
  return G.room.seekerId === G.myId ? G.me : G.ents[G.room.seekerId];
}
function roomAt(x, y) { return ROOMS.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h); }

// ---------- socket ----------
const socket = io();

function enterRoom(res, name) {
  G.myId = res.id; G.code = res.code;
  G.modes = {}; res.modes.forEach(m => (G.modes[m.id] = m));
  G.perksList = res.perks;
  store.name = name;
  sendCosmetic('zoomy');
  show('lobby');
}
function sendCosmetic(charId) {
  const eq = equipFor(charId);
  socket.emit('cosmetic', { hat: store.hat, skin: eq.skin, acc: eq.acc, aura: eq.aura });
}

socket.on('room', snap => {
  const prev = G.lastPhase;
  G.room = snap;
  G.timeLeft = snap.timeLeft;
  if (G.myId && G.ents[G.myId]) delete G.ents[G.myId]; // snapshot can beat the join ack
  for (const p of snap.players) {
    if (!G.myId || p.id === G.myId) continue;
    if (!G.ents[p.id]) G.ents[p.id] = { x: 1300, y: 650, tx: 1300, ty: 650, spot: null, camo: false, caught: p.caught };
    G.ents[p.id].caught = p.caught;
  }
  for (const id of Object.keys(G.ents)) if (!snap.players.find(p => p.id === id)) delete G.ents[id];

  if (snap.phase !== prev) {
    G.lastPhase = snap.phase;
    if (snap.phase === 'hiding') startLocalRound();
    else if (snap.phase === 'seek') startSeekPhase();
    else if (snap.phase === 'lobby') { stopGameLoops(); show('lobby'); }
  }
  if (G.screen === 'lobby') renderLobby();
  updateHud();
});

socket.on('tick', ({ timeLeft, phase }) => {
  G.timeLeft = timeLeft;
  updateHud();
  if (phase === 'hiding' && amSeeker()) {
    $('blindCount').textContent = timeLeft <= 3 ? `${timeLeft}... READY OR NOT...` : BLIND_LINES[timeLeft % BLIND_LINES.length];
  }
  if (phase === 'end') $('autoNext').textContent = `next round auto-starts in ${timeLeft}s`;
});

socket.on('pos', d => {
  if (d.id === G.myId) return;
  const e = G.ents[d.id] || (G.ents[d.id] = { x: d.x, y: d.y, tx: d.x, ty: d.y });
  e.tx = d.x; e.ty = d.y; e.spot = d.spot; e.camo = d.camo; e.vz = d.vz;
  e.dg = d.dg || null; e.dgn = d.dgn || ''; e.lurk = !!d.lurk; e.tk = d.tk || 0; e.caught = d.caught;
});

socket.on('msg', ({ text }) => { feed(text); lobbyLog(text); });

socket.on('ping', p => {
  G.pings.push({ ...p, t: now() });
  if (p.kind === 'laugh' && p.id && G.ents[p.id]) G.ents[p.id].laughUntil = now() + 1800;
  const d = dist(p, G.me);
  const v = clamp(1 - d / 1100, 0.05, 1);
  if (p.kind === 'laugh') sfx.cackle(v);
  else if (p.kind === 'steps') sfx.blip(v * 0.5);
  else if (p.kind === 'talk') sfx.blip(v * 0.4);
  else if (p.kind === 'ghost') sfx.spooky(v);
  else if (p.kind === 'monstergiggle') sfx.cackle(v);
  else if (p.kind === 'chicken') sfx.squeak(v * 0.6);
  else if (p.kind === 'quip') sfx.blip(v * 0.3);
});

socket.on('quip', ({ id, name, text }) => {
  const bubble = { text, until: now() + 4500 };
  if (id === G.myId) { G.myQuip = bubble; feed('🗣️ Your character just said that OUT LOUD. Snitch.'); }
  else if (G.ents[id]) G.ents[id].quip = bubble;
  const src = id === G.myId ? G.me : G.ents[id];
  const d = src ? dist(src, G.me) : 9999;
  if (d < 950) speakQuip(text, id, clamp(1 - d / 1000, 0.25, 1));
});

const BODILY_FX = {
  fart:  { emoji: '💨', sfx: 'fart',  mine: '💨 YOU just ripped one. Audibly. Everyone knows.', them: n => `💨 ${n} FARTED. The monster heard THAT.` },
  queef: { emoji: '🍑', sfx: 'queef', mine: '🍑 THAT came from YOU. There is no coming back.', them: n => `🍑 ${n} QUEEFED. In this economy?? The monster is intrigued.` },
  moan:  { emoji: '😩', sfx: 'moan',  mine: '😩 YOU moaned. Out loud. We all heard. Live with it.', them: n => `😩 ${n} let out a MOAN. Nobody knows why. The monster does now.` },
  burp:  { emoji: '🫧', sfx: 'burp',  mine: '🫧 YOU burped like a dying walrus. Position revealed.', them: n => `🫧 ${n} BURPED loud enough to shake the drywall.` },
};
socket.on('event', ev => {
  const t = now();
  if (BODILY_FX[ev.type]) {
    const fx = BODILY_FX[ev.type];
    G.pings.push({ x: ev.x, y: ev.y, kind: ev.type === 'fart' ? 'fart' : 'quip', t, glyph: fx.emoji });
    const d = Math.hypot(ev.x - G.me.x, ev.y - G.me.y);
    sfx[fx.sfx](clamp(1 - d / 1400, 0.2, 1));
    feed(ev.id === G.myId ? fx.mine : fx.them(ev.name));
  } else if (ev.type === 'cheese') {
    G.cheese = { id: ev.id, until: t + 12000 };
    feed(ev.id === G.myId ? '🧀 YOU smell like cheese. The stench is VISIBLE.' : `🧀 ${ev.name} smells like cheese. Visibly.`);
  } else if (ev.type === 'lights') {
    G.lightsUntil = t + 8000;
    feed('💡 LIGHTS OUT. Somebody licked a fuse.');
    sfx.spooky(0.7);
  } else if (ev.type === 'quake') {
    G.quakeUntil = t + 6000;
    feed('🌋 EARTHQUAKE. Every spot is jiggling. Trust nothing.');
    sfx.roar(0.35);
    shake(5, 6000);
  } else if (ev.type === 'disco') {
    G.discoUntil = t + 6000;
    feed('🪩 MANDATORY DISCO. Dance, fools.');
    for (let i = 0; i < 8; i++) sfx.blip(0.5);
  }
});

socket.on('task', t => {
  G.task = t; G.taskProg = 0; G.loot = [];
  if (t.type === 'loot') {
    for (let i = 0; i < 3; i++) {
      const s = SPOTS[Math.floor(Math.random() * SPOTS.length)];
      G.loot.push({
        x: clamp(s.x + (Math.random() * 280 - 140), 70, WORLD.w - 70),
        y: clamp(s.y + (Math.random() * 280 - 140), 70, WORLD.h - 70),
        got: false,
      });
    }
  }
  $('taskBar').classList.remove('hidden');
  $('taskText').textContent = '📋 ' + t.desc;
  $('taskProg').textContent = '+2🪙 +1⚡';
});

socket.on('taskDone', ({ id, name }) => {
  if (id === G.myId) {
    G.juice = Math.min(5, G.juice + 1);
    store.coins = store.coins + 2 + upLvl('greed');
    sfx.squeak(0.8);
    feed(`✅ TASK DONE. +${2 + upLvl('greed')}🪙 +1⚡`);
    updateBoosts();
  } else if (Math.random() < 0.3) {
    feed(`${name} did something useful while hiding. Gross.`);
  }
});

socket.on('caught', ({ id, how }) => {
  sfx.chomp(0.9);
  shake(id === G.myId ? 12 : 5, 450);
  if (G.ents[id]) { G.ents[id].caught = true; G.ents[id].spot = null; }
  if (id === G.myId) {
    G.ghost = true; G.mySpot = null; G.task = null;
    $('taskBar').classList.add('hidden');
    const line = how === 'laugh' ? 'YOU DIED LAUGHING 😂⚰️' : CAUGHT_LINES[Math.floor(Math.random() * CAUGHT_LINES.length)];
    const b = $('caughtBanner');
    b.textContent = line + '\nYou are a ghost now. Be annoying.';
    b.classList.remove('hidden');
    setTimeout(() => b.classList.add('hidden'), 3500);
    updateButtons();
  }
});

socket.on('whiff', ({ spotId }) => {
  const s = SPOTS.find(x => x.id === spotId);
  if (s) G.pings.push({ x: s.x, y: s.y, kind: 'whiff', t: now() });
  sfx.fart(0.8);
  if (amSeeker()) { G.stunUntil = now() + 1800; feed('EMPTY. You feel embarrassment. And gas.'); }
});

socket.on('roar', () => {
  const s = seekerEnt();
  const v = s ? clamp(1 - dist(s, G.me) / 1800, 0.15, 1) : 0.5;
  sfx.roar(v);
  G.roarFlash = now();
  shake(6 * v, 400);
});

socket.on('taunt', ({ text }) => {
  speak(text);
  const b = $('bubble');
  b.textContent = '👹 ' + text;
  b.classList.remove('hidden');
  setTimeout(() => b.classList.add('hidden'), 4500);
});

socket.on('ability', a => {
  if (a.type === 'decoy') { G.decoys.push({ x: a.x, y: a.y, until: now() + 4000 }); sfx.squeak(0.8); G.pings.push({ x: a.x, y: a.y, kind: 'decoy', t: now() }); }
  if (a.type === 'airhorn') { const s = seekerEnt(); sfx.airhorn(s ? clamp(1 - dist(s, G.me) / 1500, 0.2, 1) : 0.6); }
  if (a.type === 'double') G.clones.push({ id: a.cloneId, x: a.x, y: a.y, char: a.char, hat: a.hat, name: a.name });
  if (a.type === 'clonepop') {
    G.clones = G.clones.filter(c => c.id !== a.cloneId);
    sfx.fart(0.9); feed('The monster viciously attacked a DECOY. Embarrassing.');
  }
  if (a.type === 'smoke') {
    G.pings.push({ x: a.x, y: a.y, kind: 'smoke', t: now() });
    if (amSeeker() && dist(a, G.me) < 650) {
      $('smokeOverlay').classList.remove('hidden');
      setTimeout(() => $('smokeOverlay').classList.add('hidden'), 4000);
      feed('SMOKE BOMB! You see nothing. You smell everything.');
    }
  }
  if (a.type === 'snack') {
    G.snacks.push({ x: a.x, y: a.y, until: now() + 6000 });
    if (amSeeker() && dist(a, G.me) < 450) {
      G.eatUntil = now() + 3000;
      sfx.munch(1); feed('A SNACK?? You are contractually obligated to eat it. (3s)');
    }
  }
});

socket.on('roundEnd', data => {
  G.endData = data;
  stopGameLoops();
  const myCoins = data.coins[G.myId] || 0;
  if (myCoins) store.coins = store.coins + myCoins;
  // XP: leveling the character you just played
  const myMetaP = (data.ranking.find(r => r.id === G.myId)) || null;
  const playedChar = (myMeta() && myMeta().char) || 'zoomy';
  const before = accLevel(), beforeC = charLevel(playedChar);
  let gain = 18;
  if (myMetaP && myMetaP.survived) gain += 22;
  const place = data.ranking.findIndex(r => r.id === G.myId);
  if (place === 0) gain += 15; else if (place === 1) gain += 8; else if (place === 2) gain += 5;
  addXp(playedChar, gain);
  renderHomeLevel();
  G.xpGain = { char: playedChar, gain, leveled: charLevel(playedChar) > beforeC, acctUp: accLevel() > before };
  renderEnd(data);
  show('end');
});

// ---------- home ----------
$('nameInput').value = store.name;
renderHomeLevel();
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) $('codeInput').value = urlRoom.toUpperCase();

function getName() {
  const n = $('nameInput').value.trim();
  if (!n) { $('nameInput').placeholder = 'NAME. REQUIRED. NOW.'; $('nameInput').focus(); return null; }
  return n;
}
$('btnCreate').onclick = () => {
  const n = getName(); if (!n) return;
  unlockAudio();
  socket.emit('create', { name: n, hat: store.hat }, res => enterRoom(res, n));
};
$('btnJoin').onclick = () => {
  const n = getName(); if (!n) return;
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length !== 4) { $('codeInput').value = ''; $('codeInput').placeholder = 'CODE'; return; }
  unlockAudio();
  socket.emit('join', { code, name: n, hat: store.hat }, res => {
    if (!res.ok) { alert(res.err); return; }
    enterRoom(res, n);
  });
};

// ---------- lobby ----------
function renderLobby() {
  const r = G.room; if (!r) return;
  $('lobbyCode').textContent = r.code;
  const meMeta = myMeta();
  const host = r.hostId === G.myId;

  const cg = $('charGrid'); cg.innerHTML = '';
  for (const [id, c] of Object.entries(CHARS)) {
    const b = document.createElement('button');
    b.className = 'char-card' + (meMeta && meMeta.char === id ? ' sel' : '');
    const tint = equipFor(id).skin;
    b.innerHTML = `<canvas class="char-canvas" width="120" height="120" data-creature="${id}" data-tint="${(tint && tint[0] === '#') ? tint : ''}"></canvas><b>${c.name}</b><small>${c.blurb}</small><span class="stat">${c.stat}</span>`;
    b.onclick = () => { unlockAudio(); socket.emit('char', id); sendCosmetic(id); };
    cg.appendChild(b);
  }
  paintPreviews(now());

  $('hostSettings').style.display = host ? '' : 'none';
  const mg = $('modeGrid'); mg.innerHTML = '';
  for (const m of Object.values(G.modes)) {
    const b = document.createElement('button');
    b.className = 'mode-card' + (r.mode === m.id ? ' sel' : '');
    b.innerHTML = `<b>${m.name}</b><small>${m.desc}</small>`;
    b.onclick = () => socket.emit('settings', { mode: m.id });
    mg.appendChild(b);
  }
  $('afterDarkToggle').checked = r.afterDark;
  $('afterDarkToggle').onchange = e => socket.emit('settings', { afterDark: e.target.checked });

  const pl = $('playerList'); pl.innerHTML = '';
  for (const p of r.players) {
    const row = document.createElement('div');
    row.className = 'player-row';
    const c = CHARS[p.char] || CHARS.zoomy;
    const tags = [];
    if (p.id === r.hostId) tags.push('<span class="tag host">HOST</span>');
    if (p.perk) tags.push(`<span class="tag perk">${(G.perksList.find(x => x.id === p.perk) || {}).emoji || ''} PERK</span>`);
    tags.push(`<span class="tag">🪙 ${p.coins}</span>`);
    row.innerHTML = `<span class="pe">${c.emoji}${p.hat || ''}</span> ${p.name}${p.id === G.myId ? ' (you)' : ''}<span class="tags">${tags.join('')}</span>`;
    pl.appendChild(row);
  }

  $('btnStart').style.display = host ? '' : 'none';
}

$('btnShare').onclick = async () => {
  const url = `${location.origin}/?room=${G.code}`;
  const text = `GIGGLEDOOM 👹 get in here. Room ${G.code}: ${url}`;
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); $('btnShare').textContent = '✅ COPIED'; setTimeout(() => ($('btnShare').textContent = '📤 COPY INVITE'), 1500); }
  } catch {}
};
$('btnStart').onclick = () => { unlockAudio(); initMic(); socket.emit('start'); };
$('btnNext').onclick = () => socket.emit('next');

function lobbyLog(text) {
  const el = $('lobbyLog');
  const d = document.createElement('div');
  d.textContent = '· ' + text;
  el.prepend(d);
  while (el.children.length > 12) el.lastChild.remove();
}

// ---------- shop ----------
function renderShop() {
  $('coinCount').textContent = `🪙 ${store.coins}`;
  const grid = $('shopGrid'); grid.innerHTML = '';
  const owned = store.owned;
  for (const h of HATS) {
    if (h.adult && !(G.room && G.room.afterDark)) continue;
    const isOwned = owned.includes(h.e);
    const equipped = store.hat === h.e;
    const afford = store.coins >= h.cost;
    const b = document.createElement('button');
    b.className = 'shop-item' + (equipped ? ' equipped' : isOwned ? ' owned' : afford ? '' : ' locked');
    b.innerHTML = `<span class="he">${h.e || '🧑‍🦲'}</span><b>${h.name}</b><small>${equipped ? 'EQUIPPED' : isOwned ? 'tap to equip' : `🪙 ${h.cost}`}</small>`;
    b.onclick = () => {
      if (!isOwned) {
        if (!afford) return;
        store.coins = store.coins - h.cost;
        store.owned = [...owned, h.e];
      }
      store.hat = h.e;
      socket.emit('hat', h.e);
      renderShop();
    };
    grid.appendChild(b);
  }

  const ug = $('upGrid'); ug.innerHTML = '';
  for (const u of UPS) {
    const lvl = upLvl(u.id);
    const maxed = lvl >= u.cost.length;
    const cost = maxed ? null : u.cost[lvl];
    const afford = !maxed && store.coins >= cost;
    const b = document.createElement('button');
    b.className = 'up-row' + (maxed ? ' maxed' : '');
    b.innerHTML = `<span class="ue">${u.e}</span><span class="ub"><b>${u.name}</b><small>${u.desc}</small><span class="pips">${'●'.repeat(lvl)}${'○'.repeat(u.cost.length - lvl)}</span></span><span class="ucost">${maxed ? 'MAXED' : `🪙 ${cost}`}</span>`;
    b.onclick = () => {
      if (maxed || !afford) return;
      store.coins = store.coins - cost;
      const ups = store.ups; ups[u.id] = lvl + 1; store.ups = ups;
      renderShop();
    };
    ug.appendChild(b);
  }
}
function openShop() { renderShop(); $('shop').classList.remove('hidden'); }
$('btnDrip').onclick = openShop;
$('btnDrip2').onclick = openShop;
$('btnShopHome').onclick = openShop;
$('btnCloseShop').onclick = () => $('shop').classList.add('hidden');

// ---------- locker ----------
let lockerChar = 'zoomy';
function openLocker() { lockerChar = (myMeta() && myMeta().char) || lockerChar; renderLocker(); $('locker').classList.remove('hidden'); }
$('btnLocker').onclick = openLocker;
$('btnLockerHome').onclick = openLocker;
$('btnCloseLocker').onclick = () => $('locker').classList.add('hidden');
$('adultConfirm').onchange = e => { store.adult = e.target.checked; renderLocker(); };

function renderLocker() {
  const showAdult = store.adult;
  $('adultConfirm').checked = showAdult;
  $('lockerLevel').textContent = `ACCT LVL ${accLevel()}`;

  const eq = equipFor(lockerChar);
  const tint = (eq.skin && eq.skin[0] === '#') ? eq.skin : '';
  const tabs = $('lockerTabs'); tabs.innerHTML = '';
  for (const [id, c] of Object.entries(CHARS)) {
    const b = document.createElement('button');
    b.className = 'locker-tab' + (lockerChar === id ? ' sel' : '');
    const tt = (equipFor(id).skin && equipFor(id).skin[0] === '#') ? equipFor(id).skin : '';
    b.innerHTML = `<canvas class="lt-canvas" width="56" height="56" data-creature="${id}" data-tint="${tt}"></canvas><b>${c.name}</b><small>LVL ${charLevel(id)}</small>`;
    b.onclick = () => { lockerChar = id; renderLocker(); };
    tabs.appendChild(b);
  }

  const c = CHARS[lockerChar];
  const lvl = charLevel(lockerChar);
  const prog = xpToNext(lockerChar);
  $('lockerCard').innerHTML =
    `<canvas class="lc-canvas" width="120" height="120" data-creature="${lockerChar}" data-tint="${tint}" data-hat="${eq.acc || ''}"></canvas>
     <div class="lc-info"><b>${c.name} — LVL ${lvl}</b>
     <div class="xpbar"><div class="xpfill" style="width:${Math.floor(100 * prog.have / prog.need)}%"></div></div>
     <small>${prog.have}/${prog.need} XP to LVL ${lvl + 1} · play this character to level up</small></div>`;

  // SKINS = colour swatches
  const sg = $('skinGrid'); sg.innerHTML = '';
  for (const it of SKIN_PALETTES) {
    if (it.adult && !showAdult) continue;
    const locked = it.lvl > lvl;
    const swatch = it.c || CHAR_COL[lockerChar];
    const b = document.createElement('button');
    b.className = 'cos-item' + (eq.skin === it.c ? ' sel' : '') + (locked ? ' locked' : '') + (it.adult ? ' adult' : '');
    b.innerHTML = `<span class="cse" style="display:inline-block;width:26px;height:26px;border-radius:50%;background:${swatch};border:2px solid #0006"></span><b>${it.n}</b>${locked ? `<small>🔒 LVL ${it.lvl}</small>` : it.adult ? '<small>18+</small>' : ''}${locked ? '<span class="lockbadge">🔒</span>' : ''}`;
    b.onclick = () => { if (locked) return; eq.skin = it.c; saveEquip(); sendCosmetic(lockerChar); renderLocker(); };
    sg.appendChild(b);
  }

  const mkGrid = (grid, items, current, getVal, getGlyph, apply) => {
    grid.innerHTML = '';
    for (const it of items) {
      if (it.adult && !showAdult) continue;
      const locked = it.lvl > lvl;
      const b = document.createElement('button');
      const isSel = current === getVal(it);
      b.className = 'cos-item' + (isSel ? ' sel' : '') + (locked ? ' locked' : '') + (it.adult ? ' adult' : '');
      b.innerHTML = `<span class="cse">${getGlyph(it) || '🚫'}</span><b>${it.n}</b>${locked ? `<small>🔒 LVL ${it.lvl}</small>` : it.adult ? '<small>18+</small>' : ''}${locked ? '<span class="lockbadge">🔒</span>' : ''}`;
      b.onclick = () => { if (locked) return; apply(it); saveEquip(); sendCosmetic(lockerChar); renderLocker(); };
      grid.appendChild(b);
    }
  };
  mkGrid($('accGrid'), ACCESSORIES, eq.acc, it => it.e, it => it.e, it => (eq.acc = it.e));
  mkGrid($('auraGrid'), AURAS, eq.aura, it => it.id, it => it.g, it => (eq.aura = it.id));
  paintPreviews(now());

  function saveEquip() { const all = store.equip; all[lockerChar] = { skin: eq.skin, acc: eq.acc, aura: eq.aura }; store.equip = all; }
}

function renderHomeLevel() {
  const el = $('homeLevel');
  if (el) el.textContent = `LVL ${accLevel()} · 🪙 ${store.coins}`;
}

// ---------- round lifecycle ----------
function startLocalRound() {
  G.pings = []; G.decoys = []; G.clones = []; G.snacks = []; G.loot = [];
  G.mySpot = null; G.ghost = !!(myMeta() && myMeta().caught); G.perkUsed = false;
  G.stunUntil = 0; G.eatUntil = 0; G.sprintUntil = 0; G.camoTimer = 0;
  G.zoomUntil = 0; G.vanishUntil = 0; G.muteUntil = 0;
  G.lightsUntil = 0; G.quakeUntil = 0; G.discoUntil = 0; G.cheese = null;
  G.juice = 0; G.task = null; G.taskProg = 0; G.myQuip = null;
  G.flashOn = false; G.lurkUntil = 0; G.disguise = null;
  G.cds = { ability: 0, sprint: 0, check: 0, haunt: 0, catch: 0, flash: 0, lurk: 0, disguise: 0 };
  $('btnFlash').classList.remove('active');
  G.monsterHue = hash(G.room.monsterName || 'X') % 360;
  $('caughtBanner').classList.add('hidden');
  $('smokeOverlay').classList.add('hidden');
  $('taskBar').classList.add('hidden');
  if (amSeeker()) {
    G.me.x = 1300; G.me.y = 650;
    $('seekerBlind').classList.remove('hidden');
  } else {
    const idx = Math.max(0, G.room.players.filter(p => !p.isSeeker).findIndex(p => p.id === G.myId));
    const [cx, cy] = ROOM_CENTERS[idx % ROOM_CENTERS.length];
    const [jx, jy] = SPAWN_JITTER[Math.floor(idx / ROOM_CENTERS.length) % SPAWN_JITTER.length];
    G.me.x = cx + jx; G.me.y = cy + jy;
    $('seekerBlind').classList.add('hidden');
  }
  G.cam.x = G.me.x; G.cam.y = G.me.y;
  show('game');
  resizeCanvas();
  initMic();
  if (!G.posTimer) G.posTimer = setInterval(sendPos, 66);
  updateButtons(); updateBoosts(); updateHud();
}

function startSeekPhase() {
  $('seekerBlind').classList.add('hidden');
  if (!G.ambientTimer) G.ambientTimer = setInterval(() => {
    if (!G.room || G.room.phase !== 'seek') return;
    const s = seekerEnt();
    if (s && Math.random() < 0.6) sfx.honk(clamp(1 - dist(s, G.me) / 1500, 0.06, 0.7));
  }, 8000);
  updateButtons(); updateBoosts(); updateHud();
}

function stopGameLoops() {
  clearInterval(G.posTimer); G.posTimer = null;
  clearInterval(G.ambientTimer); G.ambientTimer = null;
  $('reticle').classList.add('hidden');
}

function renderEnd(data) {
  let title = `ROUND ${G.room ? G.room.round : ''} RESULTS`;
  if (G.xpGain) {
    const cn = (CHARS[G.xpGain.char] || {}).name || '';
    title += ` · +${G.xpGain.gain} XP`;
    if (G.xpGain.leveled) title += ` · ${cn} LEVELED UP!`;
    else if (G.xpGain.acctUp) title += ' · ACCOUNT LEVEL UP!';
  }
  $('endTitle').textContent = title;
  const medals = ['🥇', '🥈', '🥉'];
  const rk = $('ranking'); rk.innerHTML = '';
  data.ranking.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'rank-row' + (r.survived ? '' : ' dead');
    const c = CHARS[r.char] || CHARS.zoomy;
    row.innerHTML = `<span class="medal">${medals[i] || '💀'}</span> ${c.emoji} ${r.name} ${r.survived ? '<span class="tag" style="background:#0d5a3a">SURVIVED</span>' : ''}<span class="coins">+🪙 ${data.coins[r.id] || 0}</span>`;
    rk.appendChild(row);
  });
  const seekerMeta = G.room && G.room.players.find(p => p.isSeeker);
  if (seekerMeta) {
    const row = document.createElement('div');
    row.className = 'rank-row';
    row.innerHTML = `<span class="medal">👹</span> ${seekerMeta.name} (the monster) <span class="coins">+🪙 ${data.coins[seekerMeta.id] || 0}</span>`;
    rk.appendChild(row);
  }
  const winner = data.ranking[0];
  if (data.winnerId === G.myId) {
    $('perkPick').classList.remove('hidden');
    $('perkWait').classList.add('hidden');
    const pg = $('perkGrid'); pg.innerHTML = '';
    for (const p of data.perkOptions) {
      const b = document.createElement('button');
      b.className = 'perk-card';
      b.innerHTML = `<span class="pe">${p.emoji}</span><div><b>${p.name}</b><small>${p.desc}</small></div>`;
      b.onclick = () => { socket.emit('perk', { perkId: p.id }); $('perkPick').classList.add('hidden'); };
      pg.appendChild(b);
    }
  } else {
    $('perkPick').classList.add('hidden');
    $('perkWait').classList.remove('hidden');
    $('perkWait').textContent = winner ? `${winner.name} is choosing a cheat perk for next round...` : '';
  }
  $('btnNext').classList.toggle('hidden', !(G.room && G.room.hostId === G.myId));
}

// ---------- input ----------
const cv = $('cv'), ctx = cv.getContext('2d');
let SC = 1, DPR = 1;
function resizeCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = innerWidth * DPR; cv.height = innerHeight * DPR;
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  SC = clamp(Math.min(innerWidth, innerHeight) / 640, 0.55, 1.3);
}
addEventListener('resize', resizeCanvas);
resizeCanvas();

const LOOK_SENS = 0.006;
const joyZone = $('joyZone');
joyZone.addEventListener('pointerdown', e => {
  G.joy.on = true; G.joy.bx = e.clientX; G.joy.by = e.clientY; G.joy.x = 0; G.joy.y = 0;
  joyZone.setPointerCapture(e.pointerId);
});
joyZone.addEventListener('pointermove', e => {
  if (!G.joy.on) return;
  const dx = e.clientX - G.joy.bx, dy = e.clientY - G.joy.by;
  const d = Math.hypot(dx, dy) || 1, m = Math.min(d, 55);
  G.joy.x = (dx / d) * (m / 55); G.joy.y = (dy / d) * (m / 55);
});
const joyEnd = () => { G.joy.on = false; G.joy.x = 0; G.joy.y = 0; };
joyZone.addEventListener('pointerup', joyEnd);
joyZone.addEventListener('pointercancel', joyEnd);

// right-side drag = turn the camera (first person look)
const lookZone = $('lookZone');
let lookId = null, lookX = 0;
lookZone.addEventListener('pointerdown', e => { lookId = e.pointerId; lookX = e.clientX; lookZone.setPointerCapture(e.pointerId); });
lookZone.addEventListener('pointermove', e => {
  if (e.pointerId !== lookId) return;
  G.facing += (e.clientX - lookX) * LOOK_SENS;
  lookX = e.clientX;
});
const lookEnd = e => { if (e.pointerId === lookId) lookId = null; };
lookZone.addEventListener('pointerup', lookEnd);
lookZone.addEventListener('pointercancel', lookEnd);

addEventListener('keydown', e => (G.keys[e.key.toLowerCase()] = true));
addEventListener('keyup', e => (G.keys[e.key.toLowerCase()] = false));

// local-space movement: y = forward/back, x = strafe (converted to world via facing in step)
function inputVec() {
  let x = G.joy.x, y = G.joy.y;
  if (G.keys['w']) y -= 1;
  if (G.keys['s']) y += 1;
  if (G.keys['a']) x -= 1;
  if (G.keys['d']) x += 1;
  const d = Math.hypot(x, y);
  return d > 1 ? { x: x / d, y: y / d } : { x, y };
}
function turnFromKeys(dt) {
  if (G.keys['arrowleft']) G.facing -= 0.045 * dt;
  if (G.keys['arrowright']) G.facing += 0.045 * dt;
}

// ---------- buttons ----------
function spotOccupants(id) { return Object.values(G.ents).filter(e => e.spot === id && !e.caught).length; }
function nearestFreeSpot() {
  const meta = myMeta();
  const isGremlin = meta && meta.char === 'gremlin';
  let best = null, bd = 75;
  for (const s of SPOTS) {
    if (s.small && !isGremlin) continue;
    if (spotOccupants(s.id) >= (s.cap || 1)) continue; // full (shared spots hold 2)
    const d = dist(s, G.me);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function nearestSpot() {
  let best = null, bd = 95;
  for (const s of SPOTS) { const d = dist(s, G.me); if (d < bd) { bd = d; best = s; } }
  return best;
}

function updateButtons() {
  const meta = myMeta();
  const seek = G.room && (G.room.phase === 'seek' || G.room.phase === 'hiding');
  const aliveHider = seek && !amSeeker() && !G.ghost;
  $('btnAction').classList.toggle('hidden', !aliveHider);
  $('btnAbility').classList.toggle('hidden', !(aliveHider && meta && meta.char === 'gremlin'));
  const perk = meta && meta.perk;
  $('btnPerk').classList.toggle('hidden', !(aliveHider && perk && perk !== 'shoes' && !G.perkUsed && G.room.phase === 'seek'));
  if (perk) {
    const labels = { smoke: '💨 SMOKE', double: '🪆 CLONE', snack: '🍗 SNACK' };
    $('btnPerk').textContent = labels[perk] || '🎁 PERK';
  }
  const seekerActive = amSeeker() && G.room.phase === 'seek';
  $('btnCheck').classList.toggle('hidden', !seekerActive);
  $('btnSprint').classList.toggle('hidden', !seekerActive);
  $('btnFlash').classList.toggle('hidden', !(seekerActive && seekerUnlocked('flash')));
  $('btnLurk').classList.toggle('hidden', !(seekerActive && seekerUnlocked('lurk')));
  $('btnDisguise').classList.toggle('hidden', !(seekerActive && seekerUnlocked('disguise')));
  $('btnHaunt').classList.toggle('hidden', !(seek && G.ghost));
  $('boostRow').classList.toggle('hidden', !(G.room && G.room.phase === 'seek' && !amSeeker() && !G.ghost));
  $('taskBar').classList.toggle('hidden', !(G.task && G.room && G.room.phase === 'seek' && !amSeeker() && !G.ghost));
}

function updateBoosts() {
  $('juiceChip').textContent = `⚡${G.juice}`;
  const t = now();
  $('boostZoom').disabled = G.juice < 1 && t > G.zoomUntil;
  $('boostVanish').disabled = G.juice < 1 && t > G.vanishUntil;
  $('boostMute').disabled = G.juice < 1 && t > G.muteUntil;
  $('boostZoom').classList.toggle('active', t < G.zoomUntil);
  $('boostVanish').classList.toggle('active', t < G.vanishUntil);
  $('boostMute').classList.toggle('active', t < G.muteUntil);
}
$('boostZoom').onclick = () => {
  if (G.juice < 1 || now() < G.zoomUntil) return;
  G.juice--; G.zoomUntil = now() + 4000;
  feed('🏃 ZOOMIES! (4s)'); sfx.blip(0.8); updateBoosts();
};
$('boostVanish').onclick = () => {
  if (G.juice < 1 || now() < G.vanishUntil) return;
  G.juice--; G.vanishUntil = now() + 4000;
  feed('🫥 GHOST PEPPER! Invisible (4s)'); sfx.spooky(0.6); updateBoosts();
};
$('boostMute').onclick = () => {
  if (G.juice < 1 || now() < G.muteUntil) return;
  G.juice--; G.muteUntil = now() + 10000;
  feed('🤐 DUCT TAPE! Mic cannot snitch (10s)'); sfx.blip(0.8); updateBoosts();
};

$('btnAction').onclick = () => {
  if (G.mySpot) { G.mySpot = null; $('btnAction').textContent = '🫥 HIDE'; return; }
  const s = nearestFreeSpot();
  if (!s) { feed('No free hiding spot close enough. Keep waddling.'); return; }
  G.mySpot = s.id; G.me.x = s.x; G.me.y = s.y;
  $('btnAction').textContent = '🚪 LEAVE';
  feed(`You crammed yourself into: ${s.label}`);
};
$('btnAbility').onclick = () => {
  if (now() < G.cds.ability) return;
  G.cds.ability = now() + 12000;
  const a = Math.random() * Math.PI * 2;
  socket.emit('ability', { type: 'decoy', x: clamp(G.me.x + Math.cos(a) * 320, 60, WORLD.w - 60), y: clamp(G.me.y + Math.sin(a) * 320, 60, WORLD.h - 60) });
};
$('btnPerk').onclick = () => {
  const meta = myMeta(); if (!meta || !meta.perk || G.perkUsed) return;
  G.perkUsed = true;
  if (meta.perk === 'smoke') socket.emit('ability', { type: 'smoke', x: G.me.x, y: G.me.y });
  if (meta.perk === 'double') socket.emit('ability', { type: 'double', cloneId: G.myId + '-' + Math.floor(now()), x: G.me.x, y: G.me.y, char: meta.char, hat: meta.hat, name: meta.name });
  if (meta.perk === 'snack') {
    const s = seekerEnt() || G.me;
    const a = Math.atan2(s.y - G.me.y, s.x - G.me.x);
    socket.emit('ability', { type: 'snack', x: clamp(G.me.x + Math.cos(a) * 350, 60, WORLD.w - 60), y: clamp(G.me.y + Math.sin(a) * 350, 60, WORLD.h - 60) });
  }
  updateButtons();
};
$('btnCheck').onclick = () => {
  if (now() < G.cds.check) return;
  const s = nearestSpot();
  if (!s) { feed('Nothing to check here. Sniff harder.'); return; }
  G.cds.check = now() + 1000;
  socket.emit('check', { spotId: s.id });
};
$('btnSprint').onclick = () => {
  if (now() < G.cds.sprint) return;
  G.cds.sprint = now() + 7000;
  G.sprintUntil = now() + 1800;
  socket.emit('ability', { type: 'airhorn' });
};
$('btnHaunt').onclick = () => {
  if (now() < G.cds.haunt) return;
  G.cds.haunt = now() + 25000;
  socket.emit('haunt');
};
$('btnFlash').onclick = () => {
  G.flashOn = !G.flashOn;
  $('btnFlash').classList.toggle('active', G.flashOn);
  feed(G.flashOn ? '🔦 Flashlight ON. Long beam, tunnel vision.' : '🔦 Flashlight off.');
};
$('btnLurk').onclick = () => {
  if (now() < G.cds.lurk) return;
  G.cds.lurk = now() + 16000;
  G.lurkUntil = now() + 5000;
  feed('🌫️ LURKING. Invisible to hiders (5s). Sneak up.');
};
$('btnDisguise').onclick = () => {
  if (now() < G.cds.disguise) return;
  G.cds.disguise = now() + 20000;
  const chars = Object.keys(CHARS);
  const dc = chars[Math.floor(Math.random() * chars.length)];
  const fakeNames = ['DAVE', 'KAREN', 'CHAD', 'BECCA', 'GARY', 'TODD', 'STACY'];
  G.disguise = { char: dc, name: fakeNames[Math.floor(Math.random() * fakeNames.length)], until: now() + 8000 };
  feed('🎭 DISGUISED as a hider (8s). Go betray someone.');
};

// ---------- physics ----------
function collideWalls(p, r) {
  let touched = false;
  for (const w of WALLS) {
    const cx = clamp(p.x, w.x, w.x + w.w);
    const cy = clamp(p.y, w.y, w.y + w.h);
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      touched = true;
      const d = Math.sqrt(d2);
      if (d < 0.01) { p.y = w.y - r - 0.1; continue; }
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
    }
  }
  p.x = clamp(p.x, 45, WORLD.w - 45);
  p.y = clamp(p.y, 45, WORLD.h - 45);
  return touched;
}

function taskFrame(dtms) {
  if (!G.task || !G.room || G.room.phase !== 'seek' || amSeeker() || G.ghost) return;
  const t = G.task;
  let done = false, progText = '+2🪙 +1⚡';
  if (t.type === 'touch') {
    const s = SPOTS.find(x => x.id === t.spotId);
    if (s && dist(s, G.me) < 75) done = true;
  } else if (t.type === 'camp') {
    const r = ROOMS.find(x => x.name === t.room);
    if (r && G.me.x >= r.x && G.me.x <= r.x + r.w && G.me.y >= r.y && G.me.y <= r.y + r.h) G.taskProg += dtms;
    else G.taskProg = 0;
    progText = `${Math.min(100, Math.floor(G.taskProg / 100))}%`;
    if (G.taskProg >= 10000) done = true;
  } else if (t.type === 'silence') {
    const sens = mode().micSens || 1;
    const talkThresh = Math.max(0.035 / sens, G.mic.base * 2.8);
    if (!G.mic.ok || G.mic.rms < talkThresh) G.taskProg += dtms;
    else G.taskProg = 0;
    progText = `${Math.min(100, Math.floor(G.taskProg / 200))}%`;
    if (G.taskProg >= 20000) done = true;
  } else if (t.type === 'taunt') {
    const s = seekerEnt();
    if (s && dist(s, G.me) < 380) G.taskProg += dtms;
    else G.taskProg = 0;
    progText = `${Math.min(100, Math.floor(G.taskProg / 50))}%`;
    if (G.taskProg >= 5000) done = true;
  } else if (t.type === 'loot') {
    for (const l of G.loot) if (!l.got && dist(l, G.me) < 55) { l.got = true; sfx.blip(0.9); }
    const got = G.loot.filter(l => l.got).length;
    progText = `${got}/3`;
    if (got >= 3) done = true;
  }
  $('taskProg').textContent = progText;
  if (done) {
    socket.emit('task:done', { seq: t.seq });
    G.task = null; G.taskProg = 0;
    $('taskText').textContent = '📋 nice. next task incoming...';
    $('taskProg').textContent = '';
  }
}

let lastFrame = now();
function step() {
  const t = now();
  const dt = clamp((t - lastFrame) / 16.67, 0.5, 3);
  lastFrame = t;
  if (G.screen !== 'game' || !G.room) return;
  turnFromKeys(dt);

  const meta = myMeta();
  const c = CHARS[(meta && meta.char) || 'zoomy'];
  const phase = G.room.phase;
  let spd, size;
  if (G.ghost) { spd = 4.6; size = 20; }
  else if (amSeeker()) { spd = SEEKER.speed * mode().seekerSpeed * (t < G.sprintUntil ? 1.75 : 1); size = SEEKER.size; }
  else {
    spd = c.speed * (1 + 0.04 * upLvl('gym')) * (t < G.zoomUntil ? 1.6 : 1);
    size = c.size * (1 - 0.08 * upLvl('yoga'));
  }

  const frozen = G.mySpot || t < G.stunUntil || t < G.eatUntil || (amSeeker() && phase === 'hiding');
  const jv = frozen ? { x: 0, y: 0 } : inputVec();
  // convert local (forward/strafe) to world using camera facing
  const fwd = -jv.y, strafe = jv.x;
  const v = {
    x: Math.cos(G.facing) * fwd + Math.cos(G.facing + Math.PI / 2) * strafe,
    y: Math.sin(G.facing) * fwd + Math.sin(G.facing + Math.PI / 2) * strafe,
  };
  G.me.x += v.x * spd * dt;
  G.me.y += v.y * spd * dt;
  const moving = Math.hypot(v.x, v.y) > 0.15;
  let touched = false;
  if (!G.ghost) touched = collideWalls(G.me, size);
  // store my own bob/anim phase for rendering squash-stretch
  G.moving = moving;

  // wallfish camo: still + touching a wall
  if (meta && meta.char === 'wallfish' && !amSeeker() && !G.ghost) {
    if (!moving && touched) G.camoTimer += dt * 16.67;
    else if (moving) G.camoTimer = 0;
    G.myCamo = G.camoTimer > 600;
  } else G.myCamo = false;

  // (footstep/talk noise pings removed by design: ONLY laughing exposes you)

  // seeker touch-catch
  if (amSeeker() && phase === 'seek' && t > G.cds.catch && t > G.eatUntil && t > G.stunUntil) {
    for (const [id, e] of Object.entries(G.ents)) {
      if (e.caught || e.spot) continue;
      const p = G.room.players.find(x => x.id === id);
      if (!p || p.isSeeker) continue;
      const their = (CHARS[p.char] || CHARS.zoomy).size;
      if (dist(e, G.me) < size + their) { G.cds.catch = t + 600; socket.emit('catch', { id }); break; }
    }
    for (const cl of G.clones) {
      if (dist(cl, G.me) < size + 26) { socket.emit('ability', { type: 'clonepop', cloneId: cl.id }); G.clones = G.clones.filter(x => x.id !== cl.id); }
    }
    for (const sn of G.snacks) {
      if (t < sn.until && dist(sn, G.me) < size + 30 && t > G.eatUntil) {
        G.eatUntil = t + 3000; sn.until = t; sfx.munch(1); feed('SNACK ACQUIRED. Eating. Cannot move. Worth it.');
      }
    }
  }

  // interpolate others
  for (const e of Object.values(G.ents)) {
    e.x += ((e.tx ?? e.x) - e.x) * 0.25 * dt;
    e.y += ((e.ty ?? e.y) - e.y) * 0.25 * dt;
  }
  // camera
  G.cam.x += (G.me.x - G.cam.x) * 0.12 * dt;
  G.cam.y += (G.me.y - G.cam.y) * 0.12 * dt;

  // dynamic action button label
  if (!amSeeker() && !G.ghost && (phase === 'seek' || phase === 'hiding')) {
    if (!G.mySpot) {
      const s = nearestFreeSpot();
      $('btnAction').textContent = s ? `🫥 HIDE (${s.emoji})` : '🫥 HIDE';
      $('btnAction').classList.toggle('cd', !s);
    }
  }
  cdStyle('btnAbility', G.cds.ability, t); cdStyle('btnSprint', G.cds.sprint, t);
  cdStyle('btnCheck', G.cds.check, t); cdStyle('btnHaunt', G.cds.haunt, t);
  cdStyle('btnLurk', G.cds.lurk, t); cdStyle('btnDisguise', G.cds.disguise, t);

  taskFrame(dt * 16.67);
  worldFx(t);
  botSpeak(t);
  micFrame();
  render(t);
}
function cdStyle(id, until, t) { $(id).classList.toggle('cd', t < until); }

// easter-egg bonks + secret hiding-spot discovery
function worldFx(t) {
  if (!G.room || (G.room.phase !== 'seek' && G.room.phase !== 'hiding') || G.ghost || G.mySpot) return;
  for (const egg of EGGS) {
    if (dist(egg, G.me) >= 72) continue;
    if ((G.eggCd[egg.id] || 0) > t) continue;
    G.eggCd[egg.id] = t + 12000;
    (sfx[egg.sfx] || sfx.blip)(0.9);
    const first = markFound(egg.id, 4);
    feed(egg.line + (first ? ' (+4🪙 first find!)' : ''));
    if (egg.chaos) { G.discoUntil = t + 3000; shake(6, 400); }
    if (first) feed(`🔎 secrets found: ${Object.keys(store.found).length}/${SECRET_TOTAL}`);
  }
  for (const s of SPOTS) {
    if (!s.secret) continue;
    if (dist(s, G.me) < 120 && markFound(s.id, 5)) {
      sfx.squeak(1); shake(3, 300);
      feed(`🔓 SECRET SPOT FOUND: ${s.label} (+5🪙)`);
      feed(`🔎 secrets found: ${Object.keys(store.found).length}/${SECRET_TOTAL}`);
    }
  }
}

function sendPos() {
  if (G.screen !== 'game' || !G.room) return;
  const t = now();
  const dg = amSeeker() && G.disguise && t < G.disguise.until;
  socket.emit('pos', {
    x: Math.round(G.me.x), y: Math.round(G.me.y), spot: G.mySpot, camo: !!G.myCamo, vz: t < G.vanishUntil,
    dg: dg ? G.disguise.char : null, dgn: dg ? G.disguise.name : '', lurk: amSeeker() && t < G.lurkUntil,
    tk: G.talkLvl || 0,
  });
}

// ---------- raycasting ----------
const PING_EMOJI = { laugh: '😂', talk: '🗣️', steps: '👟', ghost: '👻', decoy: '🔊', whiff: '💨', chicken: '🐔', smoke: '💨', monstergiggle: '👹', quip: '🗣️', fart: '💨' };
const WALL_H = 150;
const FOV = Math.PI / 3;

function castRay(ox, oy, dx, dy) {
  let best = Infinity, side = 0;
  const invx = dx !== 0 ? 1 / dx : 1e9;
  const invy = dy !== 0 ? 1 / dy : 1e9;
  for (const wl of WALLS) {
    const tx1 = (wl.x - ox) * invx, tx2 = (wl.x + wl.w - ox) * invx;
    const tmnx = Math.min(tx1, tx2), tmxx = Math.max(tx1, tx2);
    const ty1 = (wl.y - oy) * invy, ty2 = (wl.y + wl.h - oy) * invy;
    const tmny = Math.min(ty1, ty2), tmxy = Math.max(ty1, ty2);
    const tmin = Math.max(tmnx, tmny), tmax = Math.min(tmxx, tmxy);
    if (tmax >= Math.max(tmin, 0) && tmin >= 0 && tmin < best) { best = tmin; side = tmnx > tmny ? 0 : 1; }
  }
  return { dist: best, side };
}

// ---------- render (first person) ----------
function render(t) {
  const w = cv.width, h = cv.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'left';
  const disco = t < G.discoUntil;
  const facing = G.facing;
  const proj = (w / 2) / Math.tan(FOV / 2);

  let shy = 0, shx = 0;
  if (t < G.shakeUntil) {
    const k = G.shakeMag * ((G.shakeUntil - t) / 300);
    shx = Math.sin(t / 17) * k * DPR; shy = Math.cos(t / 13) * k * DPR;
  }
  const bob = (G.moving && !G.mySpot && !frozenView()) ? Math.sin(t / 130) * h * 0.006 : 0;
  const horizon = h * 0.52 + bob + shy;

  let viewDist;
  if (G.ghost) viewDist = 1500;
  else if (amSeeker()) viewDist = G.flashOn ? 1250 : 560;
  else viewDist = Math.max(300, mode().vision * 0.72); // R.E.P.O. dark: your lantern pool is your world
  if (t < G.lightsUntil) viewDist *= 0.5;

  const rmHere = roomAt(G.me.x, G.me.y);
  // room + compass HUD
  const COMPASS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const dirIx = ((Math.round(((facing % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8) + 8) % 8;
  $('roomName').textContent = rmHere ? (rmHere.short || rmHere.name) : 'THE VOID';
  $('compass').textContent = '· facing ' + COMPASS[dirIx];
  // ceiling: dark gradient tinted by current room
  const cg = ctx.createLinearGradient(0, 0, 0, horizon);
  cg.addColorStop(0, '#05030a'); cg.addColorStop(1, rmHere ? rmHere.ceil : '#160f24');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, w, horizon + 1);
  ctx.fillStyle = '#050208'; ctx.fillRect(0, horizon, w, h - horizon);

  // ---- floor casting: a real textured floor that slides under you as you move ----
  const dirX = Math.cos(facing), dirY = Math.sin(facing);
  const planeMag = Math.tan(FOV / 2);
  const planeX = -dirY * planeMag, planeY = dirX * planeMag;
  const ray0x = dirX - planeX, ray0y = dirY - planeY;
  const ray1x = dirX + planeX, ray1y = dirY + planeY;
  const CELL = 128;
  const FLOORSTEP = Math.max(3, Math.round(4 * DPR));
  const FCOL = Math.max(4, Math.round(8 * DPR));
  for (let y = Math.ceil(horizon) + 1; y < h; y += FLOORSTEP) {
    const p = y - horizon;
    const d = (WALL_H * 0.5 * proj) / p;               // perpendicular world distance for this row
    if (d > viewDist * 1.1) continue;
    const fog = clamp(1 - d / (viewDist * 1.05), 0, 1);
    const fx0 = G.me.x + ray0x * d, fy0 = G.me.y + ray0y * d;
    const stepX = (ray1x - ray0x) * d / w, stepY = (ray1y - ray0y) * d / w;
    for (let x = 0; x < w; x += FCOL) {
      const wx = fx0 + stepX * x, wy = fy0 + stepY * x;
      const rmF = roomAt(wx, wy);
      const chk = ((Math.floor(wx / CELL) + Math.floor(wy / CELL)) & 1);
      let base = rmF ? rmF.floor : '#141018';
      // checker: brighten/darken alternating cells
      const bd = chk ? 16 : -10;
      const col = shade(base, Math.round(bd));
      ctx.globalAlpha = 0.12 + 0.88 * fog;
      ctx.fillStyle = col;
      ctx.fillRect(x + shx, y, FCOL + 1, FLOORSTEP + 1);
    }
  }
  ctx.globalAlpha = 1;

  // walls via raycast (coloured by the room they belong to, with baseboard + crown trim)
  const COL = Math.max(2, Math.round(3 * DPR));
  const nCols = Math.ceil(w / COL) + 1;
  const zbuf = new Float32Array(nCols);
  for (let i = 0; i < nCols; i++) {
    const x = i * COL;
    const a = facing - FOV / 2 + (x / w) * FOV;
    const ca = Math.cos(a), sa = Math.sin(a);
    const hit = castRay(G.me.x, G.me.y, ca, sa);
    let perp = hit.dist * Math.cos(a - facing);
    if (!isFinite(perp) || perp <= 0) perp = Infinity;
    zbuf[i] = perp;
    if (!isFinite(perp) || perp > viewDist) continue;
    const sliceH = (WALL_H * proj) / perp;
    const top = horizon - sliceH / 2;
    const shd = clamp(1 - perp / viewDist, 0.03, 1) * (hit.side ? 0.68 : 0.92);
    const rmW = roomAt(G.me.x + ca * (hit.dist - 4), G.me.y + sa * (hit.dist - 4));
    const wcol = rmW ? rmW.wall : '#5a3f84';
    ctx.fillStyle = disco ? `hsl(${(t / 4 + x) % 360},55%,${Math.floor(42 * shd)}%)` : shade(wcol, Math.round((shd - 1) * 150));
    ctx.fillRect(x + shx, top, COL + 1, sliceH);
    // crown (top) + baseboard (bottom) trim for architectural read
    ctx.fillStyle = shade(wcol, Math.round(30 * shd - 10));
    ctx.fillRect(x + shx, top, COL + 1, Math.max(2, sliceH * 0.05));
    ctx.fillStyle = shade(wcol, Math.round(-70 * shd - 20));
    ctx.fillRect(x + shx, top + sliceH * 0.86, COL + 1, Math.max(2, sliceH * 0.14));
  }

  // gather billboards
  const sprites = [];
  const push = (x, y, glyph, size, alpha, label, labelColor, extra) => sprites.push({ x, y, glyph, size, alpha, label, labelColor, extra: extra || {} });
  for (const d of DECOR) push(d.x, d.y, d.e, d.s, 1, '', '', { decor: true });
  for (const b of ROOM_BOTS) {
    const idx = ROOM_BOTS.indexOf(b);
    const active = b.room === (rmHere && rmHere.name);
    const quip = (active && G.botSay && G.botSay.idx === idx && t < G.botSay.until) ? { text: G.botSay.text, until: G.botSay.until } : null;
    push(b.x, b.y, '', 120, 1, b.name, active ? '#ff6ad5' : 'rgba(255,150,210,0.5)', { bot: true, active, botIdx: idx, quip });
  }
  for (const sp of SPOTS) {
    if (sp.secret && !store.found[sp.id] && dist(sp, G.me) > 150) continue; // hidden until discovered/near
    const occ = spotOccupants(sp.id);
    const reach = !amSeeker() && !G.ghost && !G.mySpot && dist(sp, G.me) < 90 && (!sp.small || (myMeta() && myMeta().char === 'gremlin')) && occ < (sp.cap || 1);
    let label = sp.label;
    if (sp.cap > 1) label += ` [${occ}/${sp.cap} 👥]`;
    push(sp.x, sp.y, sp.emoji, sp.small ? 78 : 110, 1, label, reach ? '#52ffa8' : sp.secret ? '#ffd84d' : 'rgba(255,255,255,0.55)', { ground: true });
  }
  for (const egg of EGGS) push(egg.x, egg.y, egg.emoji, 66, 1, egg.label, store.found[egg.id] ? '#8affc1' : 'rgba(255,255,255,0.5)', { egg: true });
  for (const l of G.loot) if (!l.got) push(l.x, l.y, '✨', 46, 0.9, '', '', {});
  for (const d of G.decoys) if (t < d.until) push(d.x, d.y, '🐿️', 66, 1, '', '', {});
  for (const sn of G.snacks) if (t < sn.until) push(sn.x, sn.y, '🍗', 70, 1, '', '', {});
  G.decoys = G.decoys.filter(d => t < d.until);
  G.snacks = G.snacks.filter(sn => t < sn.until);
  const tintOf = v => (typeof v === 'string' && v[0] === '#') ? v : ''; // ignore old emoji skins
  for (const cl of G.clones) push(cl.x, cl.y, '', 150, 1, cl.name, '#fff', { creature: cl.char, tint: tintOf(cl.skin), hat: cl.hat, moving: false });
  for (const [id, e] of Object.entries(G.ents)) {
    const p = G.room.players.find(x => x.id === id);
    if (!p) continue;
    const movingE = Math.hypot((e.tx ?? e.x) - e.x, (e.ty ?? e.y) - e.y) > 1.2;
    if (e.caught) { if (G.ghost) push(e.x, e.y, '', 88, 0.6, p.name, '#cfffea', { ghostArt: true, seed: hash(id) % 9 }); continue; }
    if (e.spot) continue;
    if (p.isSeeker) {
      if (e.dg && !amSeeker()) push(e.x, e.y, '', 150, 1, e.dgn || '???', '#fff', { creature: e.dg, moving: movingE, quip: e.quip });
      else { let a = 1; if (e.lurk && !amSeeker() && !G.ghost) a = 0.12; push(e.x, e.y, '', 175, a, G.room.monsterName, '#ff8bb0', { monster: true, quip: e.quip }); }
      continue;
    }
    let a = 1;
    if (e.vz) a = amSeeker() ? 0.05 : 0.3; else if (e.camo) a = amSeeker() ? 0.1 : 0.5;
    const cheesy = G.cheese && G.cheese.id === id && t < G.cheese.until;
    if (cheesy) a = Math.max(a, 0.95);
    const skE = seekerEnt();
    const fearE = !!(skE && !p.isSeeker && dist(skE, e) < 450);
    push(e.x, e.y, '', 155, a, p.name, '#fff', { creature: p.char, tint: tintOf(p.skin), hat: p.hat, acc: p.acc, auraId: p.aura, moving: movingE, cheesy, quip: e.quip, talk: e.tk || 0, laugh: t < (e.laughUntil || 0), fear: fearE, seed: hash(id) % 9 });
  }
  for (const pg of G.pings) { const age = (t - pg.t) / 1000; if (age > 2.2) continue; push(pg.x, pg.y, PING_EMOJI[pg.kind] || '🔊', 52, clamp(1 - age / 2.2, 0, 1), '', '', { ping: true }); }
  G.pings = G.pings.filter(p => (t - p.t) / 1000 < 2.5);

  // project + depth sort
  const draw = [];
  for (const spr of sprites) {
    const dx = spr.x - G.me.x, dy = spr.y - G.me.y;
    const dE = Math.hypot(dx, dy);
    let ang = Math.atan2(dy, dx) - facing;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (Math.abs(ang) > FOV / 2 + 0.4) continue;
    const perp = dE * Math.cos(ang);
    if (perp <= 10 || perp > viewDist) continue;
    spr.sx = w / 2 + Math.tan(ang) * proj + shx;
    spr.perp = perp;
    draw.push(spr);
  }
  draw.sort((a, b) => b.perp - a.perp);
  ctx.textAlign = 'center';
  for (const spr of draw) {
    const col = clamp(Math.round(spr.sx / COL), 0, nCols - 1);
    if (zbuf[col] < spr.perp - 6) continue; // occluded by wall
    // keep characters solid up close/mid, only fade near the far edge of view
    const fog = spr.perp < viewDist * 0.5 ? 1 : clamp(1 - (spr.perp - viewDist * 0.5) / (viewDist * 0.5), 0.12, 1);
    const fontPx = clamp((spr.size * proj) / spr.perp, 6, h * 2);
    const yFeet = horizon + ((WALL_H * 0.5) * proj) / spr.perp;
    if (spr.extra.creature) {
      // hand-drawn animated character
      drawCreature(spr.sx, yFeet, fontPx, spr.extra.creature, t, {
        alpha: spr.alpha * fog, tint: spr.extra.tint, hat: spr.extra.hat, acc: spr.extra.acc,
        auraId: spr.extra.auraId, moving: spr.extra.moving, talk: spr.extra.talk, laugh: spr.extra.laugh,
        fear: spr.extra.fear, seed: spr.extra.seed,
      });
      if (spr.extra.cheesy) { ctx.globalAlpha = spr.alpha * fog; ctx.textAlign = 'center'; ctx.font = `${fontPx * 0.28}px serif`; ctx.fillText('🧀', spr.sx, yFeet - fontPx * 1.0); }
    } else if (spr.extra.monster) {
      artMonster(ctx, spr.sx, yFeet, fontPx, t, G.monsterHue, { alpha: spr.alpha * fog, roar: t - G.roarFlash < 900 });
    } else if (spr.extra.ghostArt) {
      artGhost(ctx, spr.sx, yFeet, fontPx, t, { alpha: spr.alpha * fog, seed: spr.extra.seed });
    } else if (spr.extra.bot) {
      drawBot(spr.sx, yFeet - fontPx * 0.5, fontPx, t, spr.extra.active, spr.extra.botIdx);
    } else {
      ctx.globalAlpha = spr.alpha * fog;
      ctx.font = `${fontPx}px serif`;
      ctx.fillText(spr.glyph, spr.sx, yFeet);
      if (spr.extra.hat) { ctx.font = `${fontPx * 0.6}px serif`; ctx.fillText(spr.extra.hat, spr.sx, yFeet - fontPx * 0.82); }
    }
    if (spr.label) {
      ctx.globalAlpha = fog;
      ctx.font = `bold ${clamp(fontPx * 0.14, 9, 22)}px sans-serif`;
      ctx.fillStyle = spr.labelColor;
      ctx.fillText(spr.label, spr.sx, yFeet - fontPx * 1.0);
    }
    if (spr.extra.quip && t < spr.extra.quip.until) {
      ctx.globalAlpha = fog;
      ctx.font = `bold ${clamp(fontPx * 0.13, 10, 18)}px sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText('💬 ' + spr.extra.quip.text.slice(0, 40), spr.sx, yFeet - fontPx * 1.25);
    }
    ctx.globalAlpha = 1;
  }

  // reticle for seeker (aim helper)
  $('reticle').classList.toggle('hidden', !(amSeeker() && G.room.phase === 'seek' && !G.mySpot));

  // warm lantern glow: your personal pool of light (R.E.P.O. style)
  if (!G.ghost) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lr = Math.min(w, h) * (amSeeker() && G.flashOn ? 0.32 : 0.46);
    const lg2 = ctx.createRadialGradient(w / 2, h * 0.60, lr * 0.12, w / 2, h * 0.60, lr);
    lg2.addColorStop(0, 'rgba(255,178,92,0.15)');
    lg2.addColorStop(0.6, 'rgba(255,150,70,0.06)');
    lg2.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = lg2;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // vignette
  ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.33, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.66)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

  if (disco) {
    ctx.globalAlpha = 0.07 + 0.05 * Math.sin(t / 60);
    ctx.fillStyle = `hsl(${(t / 3) % 360}, 100%, 60%)`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // hidden-in-a-spot overlay
  if (G.mySpot) {
    ctx.fillStyle = 'rgba(3,1,7,0.82)';
    ctx.fillRect(0, 0, w, h);
    const label = (SPOTS.find(sp => sp.id === G.mySpot) || {}).label || 'a spot';
    ctx.globalAlpha = 1; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe14d'; ctx.font = `bold ${22 * DPR}px sans-serif`;
    ctx.fillText('🫥 HIDING IN', w / 2, h / 2 - 18 * DPR);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${16 * DPR}px sans-serif`;
    ctx.fillText(label.toUpperCase(), w / 2, h / 2 + 8 * DPR);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `${12 * DPR}px sans-serif`;
    ctx.fillText('do not laugh. tap LEAVE to bolt.', w / 2, h / 2 + 34 * DPR);
  }

  // seeker-direction indicator for hiders (edge arrow)
  if (!amSeeker() && !G.mySpot && t - G.roarFlash < 2500) {
    const sk = seekerEnt();
    if (sk && !sk.lurk) {
      let ang = Math.atan2(sk.y - G.me.y, sk.x - G.me.x) - facing;
      while (ang > Math.PI) ang -= 2 * Math.PI;
      while (ang < -Math.PI) ang += 2 * Math.PI;
      const edgeX = clamp(w / 2 + Math.tan(clamp(ang, -1.3, 1.3)) * proj, 40 * DPR, w - 40 * DPR);
      const behind = Math.abs(ang) > FOV / 2;
      const pulse = 0.55 + 0.45 * Math.sin(t / 80);
      // glowing threat marker: two hot eyes inside a warning wedge
      ctx.globalAlpha = pulse;
      const my2 = 96 * DPR, sc2 = DPR;
      const gl = ctx.createRadialGradient(edgeX, my2, 2, edgeX, my2, 26 * sc2);
      gl.addColorStop(0, 'rgba(255,90,60,0.85)'); gl.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(edgeX, my2, 26 * sc2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath(); ctx.arc(edgeX - 7 * sc2, my2, 4 * sc2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(edgeX + 7 * sc2, my2, 4 * sc2, 0, Math.PI * 2); ctx.fill();
      if (behind) { // direction chevron
        const dxc = ang > 0 ? 1 : -1;
        ctx.strokeStyle = 'rgba(255,120,90,0.95)'; ctx.lineWidth = 4 * sc2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(edgeX + dxc * 18 * sc2, my2 - 8 * sc2);
        ctx.lineTo(edgeX + dxc * 26 * sc2, my2);
        ctx.lineTo(edgeX + dxc * 18 * sc2, my2 + 8 * sc2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  drawMinimap(t, w, h);

  // joystick knob
  if (G.joy.on) {
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * DPR;
    ctx.beginPath(); ctx.arc(G.joy.bx * DPR, G.joy.by * DPR, 55 * DPR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc((G.joy.bx + G.joy.x * 45) * DPR, (G.joy.by + G.joy.y * 45) * DPR, 22 * DPR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function frozenView() {
  const t = now();
  return t < G.stunUntil || t < G.eatUntil || (amSeeker() && G.room && G.room.phase === 'hiding');
}

function drawMinimap(t, w, h) {
  const mw = 170 * DPR, mh = mw * (WORLD.h / WORLD.w);
  const mx = w - mw - 10 * DPR, my = 52 * DPR;
  const k = mw / WORLD.w;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = 'rgba(10,5,18,0.85)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#553387';
  for (const wall of WALLS) ctx.fillRect(mx + wall.x * k, my + wall.y * k, Math.max(1.5, wall.w * k), Math.max(1.5, wall.h * k));
  // pings
  ctx.fillStyle = '#ffe14d';
  for (const p of G.pings) if (t - p.t < 2500) { ctx.beginPath(); ctx.arc(mx + p.x * k, my + p.y * k, 2.5 * DPR, 0, Math.PI * 2); ctx.fill(); }
  // seeker (during roar, or if I am seeker/ghost)
  const sk = seekerEnt();
  if (sk && (amSeeker() || G.ghost || t - G.roarFlash < 2500)) {
    ctx.fillStyle = '#ff5470';
    ctx.beginPath(); ctx.arc(mx + sk.x * k, my + sk.y * k, 4 * DPR, 0, Math.PI * 2); ctx.fill();
  }
  // everyone, for ghosts
  if (G.ghost) {
    ctx.fillStyle = '#8affc1';
    for (const e of Object.values(G.ents)) if (!e.caught) { ctx.beginPath(); ctx.arc(mx + e.x * k, my + e.y * k, 3 * DPR, 0, Math.PI * 2); ctx.fill(); }
  }
  // me + facing wedge
  const mex = mx + G.me.x * k, mey = my + G.me.y * k;
  ctx.strokeStyle = 'rgba(255,225,77,0.7)'; ctx.lineWidth = 2 * DPR;
  ctx.beginPath(); ctx.moveTo(mex, mey);
  ctx.lineTo(mex + Math.cos(G.facing) * 16 * DPR, mey + Math.sin(G.facing) * 16 * DPR); ctx.stroke();
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath(); ctx.arc(mex, mey, 4 * DPR, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBubble(x, y, text) {
  const short = text.length > 46 ? text.slice(0, 44) + '…' : text;
  ctx.font = 'bold 13px sans-serif';
  const tw = ctx.measureText(short).width;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.roundRect(x - tw / 2 - 10, y - 16, tw + 20, 24, 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 5, y + 8); ctx.lineTo(x + 5, y + 8); ctx.lineTo(x, y + 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#12081f';
  ctx.fillText(short, x, y + 1);
}

function drawStink(x, y, t) {
  ctx.font = '22px serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText('🧀', x + Math.sin(t / 300) * 8, y - 52 - (t / 100) % 10);
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#b8d44a'; ctx.lineWidth = 2;
  for (const off of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(x + off, y - 20);
    ctx.quadraticCurveTo(x + off + Math.sin(t / 120 + off) * 6, y - 38, x + off, y - 50);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawAura(x, y, auraId, t, alpha) {
  const col = AURA_COLOR[auraId];
  if (!col) return;
  for (let i = 0; i < 4; i++) {
    const a = t / 320 + i * (Math.PI / 2);
    const rr = 30 + Math.sin(t / 180 + i) * 5;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.7;
    ctx.globalAlpha = alpha * 0.65;
    ctx.fillStyle = col === 'rainbow' ? `hsl(${(t / 4 + i * 90) % 360},100%,62%)` : col;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = alpha;
}

function drawPlayer(x, y, c, name, hat, alpha, isMe, t, cos) {
  cos = cos || {};
  const emoji = cos.skin || c.emoji;
  const bob = Math.sin(t / 150 + x * 0.05) * 2;
  const sq = cos.moving ? 1 + Math.sin(t / 70) * 0.09 : 1;
  // shadow
  ctx.globalAlpha = alpha * 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, y + c.size * 0.72, c.size * 0.78, c.size * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha;
  if (cos.aura) drawAura(x, y + bob, cos.aura, t, alpha);
  // body (with squash-stretch anchored at feet)
  ctx.save();
  ctx.translate(x, y + bob + c.size * 0.6);
  ctx.scale(1 / sq, sq);
  ctx.font = `${c.size * 1.9}px serif`;
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
  if (cos.acc) { ctx.font = `${c.size * 1.15}px serif`; ctx.fillText(cos.acc, x + c.size * 0.95, y + bob + c.size * 0.2); }
  if (hat) { ctx.font = `${c.size * 1.1}px serif`; ctx.fillText(hat, x, y + bob - c.size * 0.9); }
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = isMe ? '#ffe14d' : 'rgba(255,255,255,0.85)';
  ctx.fillText(name, x, y - c.size - (hat ? 22 : 8));
  ctx.globalAlpha = 1;
}

// ---------- hand-drawn creatures ----------
function shade(hex, amt) {
  let h = (hex || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgb(${clamp(r + amt, 0, 255) | 0},${clamp(g + amt, 0, 255) | 0},${clamp(b + amt, 0, 255) | 0})`;
}
const HEAD_TOP = { zoomy: -100, slurp: -86, gremlin: -74, wallfish: -96 };
const CREATURE_MOUTH = { zoomy: [0, -78], slurp: [0, -40], gremlin: [0, -46], wallfish: [0, -54] };
const CREATURE_EYES = { zoomy: -88, slurp: -50, gremlin: -58, wallfish: -70 };
function cEye(g, x, y, rw, rh, lx, ly, pr) {
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, 7); g.fill();
  g.fillStyle = '#0b0b14';
  g.beginPath(); g.arc(x + lx, y + ly, pr, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.arc(x + lx - pr * 0.4, y + ly - pr * 0.4, pr * 0.35, 0, 7); g.fill();
}
function limb(g, x1, y1, x2, y2, w, col) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}
function blob(g, pts, fill) {
  g.fillStyle = fill; g.beginPath();
  for (let i = 0; i < pts.length; i++) { const [px, py] = pts[i]; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath(); g.fill();
}

// Delegates to the hand-painted art engine in art.js (no emojis). Keeps the old signature
// so the FP renderer, lobby cards, and locker previews all use the same rigs.
function drawCreature(cx, feetY, h, charId, t, o, g) {
  artCreature(g || ctx, cx, feetY, h, charId, t, o || {});
}

// preview canvases in the lobby/locker: <canvas data-creature="zoomy" data-tint="#..">
function paintPreviews(t) {
  document.querySelectorAll('canvas[data-creature]').forEach(cn => {
    if (!cn.isConnected || cn.offsetParent === null) return;
    const g = cn.getContext('2d');
    const w = cn.width, h = cn.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    drawCreature(w / 2, h * 0.92, h * 0.82, cn.dataset.creature, t, {
      tint: cn.dataset.tint || '', hat: cn.dataset.hat || '', moving: cn.dataset.moving === '1',
    }, g);
  });
}
setInterval(() => { if (G.screen === 'lobby' || !$('locker').classList.contains('hidden')) paintPreviews(now()); }, 40);

// the room bot: a floating creepy jester head bolted to each room. glows + yaps when active.
function drawBot(cx, cy, size, t, active, idx) {
  const s = size / 90, bobv = Math.sin(t / 320 + idx) * 6;
  ctx.save(); ctx.translate(cx, cy + bobv * s); ctx.scale(s, s);
  if (active) { ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t / 200); ctx.fillStyle = '#ff3ba3'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = '#ff3ba3';
  ctx.beginPath(); ctx.moveTo(-20, -22); ctx.lineTo(-32, -48); ctx.lineTo(-6, -30); ctx.fill();
  ctx.beginPath(); ctx.moveTo(20, -22); ctx.lineTo(32, -48); ctx.lineTo(6, -30); ctx.fill();
  ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(-32, -48, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(32, -48, 4, 0, 7); ctx.fill();
  const rg = ctx.createRadialGradient(-8, -8, 4, 0, 0, 34);
  rg.addColorStop(0, '#48123a'); rg.addColorStop(1, '#14041a'); ctx.fillStyle = rg;
  ctx.beginPath(); ctx.arc(0, 0, 32, 0, 7); ctx.fill();
  ctx.fillStyle = active ? '#ff5470' : '#7a2f4a';
  ctx.beginPath(); ctx.arc(-11, -5, 6.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(11, -5, 6.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-11, -5, 2.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(11, -5, 2.5, 0, 7); ctx.fill();
  const mo = active ? 3 + Math.abs(Math.sin(t / 110)) * 7 : 2.5;
  ctx.fillStyle = '#120008'; ctx.beginPath(); ctx.ellipse(0, 13, 16, mo + 4, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 6 - 2, 13); ctx.lineTo(i * 6 + 2, 13); ctx.lineTo(i * 6, 13 + mo + 3); ctx.fill(); }
  ctx.restore();
}

function speakBot(text, pitch) {
  try { const u = new SpeechSynthesisUtterance(text); u.pitch = pitch; u.rate = 0.92; u.volume = 1; speechSynthesis.speak(u); } catch {}
}
// only the bot of the room YOU are standing in talks, and only one at a time -> no voice soup
function botSpeak(t) {
  if (!G.room || (G.room.phase !== 'seek' && G.room.phase !== 'hiding')) return;
  const rm = roomAt(G.me.x, G.me.y); if (!rm) return;
  const bi = ROOM_BOTS.findIndex(b => b.room === rm.name); if (bi < 0) return;
  if (t < (G.botNext || 0)) return;
  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) { G.botNext = t + 2500; return; }
  G.botNext = t + 9000 + Math.random() * 6000;
  const bot = ROOM_BOTS[bi];
  let line = BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)];
  const here = G.room.players.filter(p => p.id !== G.myId && !p.caught && !p.isSeeker);
  if (here.length && Math.random() < 0.35) line = line.replace(/\byou\b/i, here[Math.floor(Math.random() * here.length)].name);
  speakBot(line, bot.pitch);
  G.botSay = { idx: bi, text: line, until: t + 5200 };
  feed('👺 ' + bot.name + ': ' + line);
}

function drawMonster(x, y, t) {
  const wob = Math.sin(t / 120) * 5;
  const r = 52 + Math.sin(t / 200) * 4;
  const hue = G.monsterHue;
  const grad = ctx.createRadialGradient(x, y, 10, x, y, r + 10);
  grad.addColorStop(0, `hsl(${hue}, 90%, 60%)`);
  grad.addColorStop(1, `hsl(${hue}, 90%, 30%)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const rr = r + Math.sin(a * 5 + t / 150) * 7;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  for (const off of [-18, 18]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + off + wob / 2, y - 14, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(x + off + Math.sin(t / 90 + off) * 5, y - 14 + Math.cos(t / 70) * 4, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 12 - 5, y + 16); ctx.lineTo(x + i * 12 + 5, y + 16); ctx.lineTo(x + i * 12, y + 28);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(160,240,255,0.7)';
  ctx.beginPath(); ctx.arc(x + 20, y + 30 + (t / 30) % 14, 4, 0, Math.PI * 2); ctx.fill();
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#ff8bb0';
  ctx.fillText(G.room.monsterName || 'THE MONSTER', x, y - r - 14);
  if (G.room.phase === 'hiding') { ctx.font = '30px serif'; ctx.fillText('😴', x, y - r - 40); }
}

// ---------- HUD ----------
function updateHud() {
  if (!G.room) return;
  const m = Math.floor(Math.max(0, G.timeLeft) / 60), sec = Math.max(0, G.timeLeft) % 60;
  $('hudTimer').textContent = `${m}:${String(sec).padStart(2, '0')}`;
  $('hudMonster').textContent = G.room.monsterName || '';
  const phase = G.room.phase;
  let label = '';
  if (G.ghost) label = '👻 DEAD (be annoying)';
  else if (amSeeker()) label = phase === 'hiding' ? '🙈 COUNTING' : '🍴 FEAST';
  else label = phase === 'hiding' ? '🏃 HIDE!!' : '🤫 DO NOT LAUGH';
  $('hudPhase').textContent = label;
}

function feed(text) {
  if (G.screen !== 'game') return;
  const el = $('feed');
  const d = document.createElement('div');
  d.className = 'feed-item';
  d.textContent = text;
  el.appendChild(d);
  while (el.children.length > 4) el.firstChild.remove();
  setTimeout(() => d.remove(), 6000);
}

// ---------- mic ----------
let audioCtx = null, analyser = null, micData = null;
async function initMic(force) {
  if (G.mic.ok) return;
  if (G.mic.tried && !force) return;
  G.mic.tried = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    micData = new Float32Array(analyser.fftSize);
    G.mic.ok = true;
    VC.stream = stream; // proximity voice uses the same mandatory mic
    $('micLabel').textContent = '🎤';
    updateMicGate();
  } catch (e) {
    G.mic.ok = false;
    $('micLabel').textContent = '🚫';
    updateMicGate();
  }
}
// mic is mandatory: block the game view until it's granted
function updateMicGate() {
  const need = G.screen === 'game' && !G.mic.ok;
  $('micGate').classList.toggle('hidden', !need);
}
$('btnEnableMic').onclick = () => { unlockAudio(); initMic(true); };
setInterval(updateMicGate, 500);

// ---------- proximity voice chat ----------
// Real voices, peer-to-peer, fading with distance and muffled through walls.
// Connections open only to players within earshot (distance-gated mesh, hysteresis),
// so even a 16-player room stays cheap. No audio is ever stored or sent to the server.
const VC = { stream: null, peers: {} };
const VOICE_OPEN = 1150, VOICE_CLOSE = 1450, VOICE_REF = 950;
const RTC_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function vcPeer(id, initiator) {
  if (VC.peers[id]) return VC.peers[id];
  const pc = new RTCPeerConnection(RTC_CFG);
  const P = { pc, gain: null, filter: null, audioEl: null, linked: false };
  VC.peers[id] = P;
  if (VC.stream) VC.stream.getAudioTracks().forEach(tr => pc.addTrack(tr, VC.stream));
  else pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.onicecandidate = e => { if (e.candidate) socket.emit('rtc', { to: id, data: { candidate: e.candidate } }); };
  pc.ontrack = e => {
    const stream = e.streams[0] || new MediaStream([e.track]);
    // iOS/Safari: a live (muted) audio element is required for WebRTC audio to flow into WebAudio
    const a = new Audio(); a.srcObject = stream; a.muted = true; a.playsInline = true; a.play().catch(() => {});
    P.audioEl = a;
    unlockAudio();
    const src = audioCtx.createMediaStreamSource(stream);
    const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 18000;
    const gain = audioCtx.createGain(); gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    P.gain = gain; P.filter = filter;
    if (!P.linked) {
      P.linked = true;
      const p = G.room && G.room.players.find(x => x.id === id);
      if (p) feed(`🎙️ voice linked: ${p.name}`);
    }
  };
  if (initiator) {
    pc.onnegotiationneeded = async () => {
      try {
        await pc.setLocalDescription(await pc.createOffer());
        socket.emit('rtc', { to: id, data: { sdp: pc.localDescription } });
      } catch {}
    };
  }
  return P;
}
function vcClose(id) {
  const P = VC.peers[id];
  if (!P) return;
  try { P.pc.close(); } catch {}
  if (P.audioEl) { P.audioEl.srcObject = null; }
  delete VC.peers[id];
}
socket.on('rtc', async ({ from, data }) => {
  try {
    const P = vcPeer(from, false);
    if (data.sdp) {
      await P.pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === 'offer') {
        await P.pc.setLocalDescription(await P.pc.createAnswer());
        socket.emit('rtc', { to: from, data: { sdp: P.pc.localDescription } });
      }
    } else if (data.candidate) {
      await P.pc.addIceCandidate(data.candidate);
    }
  } catch {}
});
function voiceGainFor(p, e) {
  // living players never hear ghosts; ghosts hear everybody (quietly, everywhere-ish)
  if (!G.ghost && p.caught) return { g: 0, muffle: false };
  const d = dist(e, G.me);
  let g = clamp(1 - d / VOICE_REF, 0, 1); g *= g;
  let muffle = false;
  if (g > 0.01) {
    const dx = e.x - G.me.x, dy = e.y - G.me.y;
    const hit = castRay(G.me.x, G.me.y, dx / (d || 1), dy / (d || 1));
    if (hit.dist < d - 20) { muffle = true; g *= 0.35; }
  }
  if (G.ghost) g = Math.max(g * 0.9, 0.1);
  return { g, muffle };
}
function voiceTick() {
  if (!G.room || G.screen !== 'game' || !G.myId) {
    for (const id of Object.keys(VC.peers)) vcClose(id);
    return;
  }
  for (const p of G.room.players) {
    if (p.id === G.myId) continue;
    const e = G.ents[p.id];
    const d = e ? dist(e, G.me) : Infinity;
    const has = !!VC.peers[p.id];
    if (!has && d < VOICE_OPEN) vcPeer(p.id, G.myId < p.id);
    else if (has && d > VOICE_CLOSE) vcClose(p.id);
    const P = VC.peers[p.id];
    if (P && P.gain && e) {
      const { g, muffle } = voiceGainFor(p, e);
      const t0 = audioCtx.currentTime;
      P.gain.gain.setTargetAtTime(g, t0, 0.15);
      P.filter.frequency.setTargetAtTime(muffle ? 550 : 18000, t0, 0.15);
    }
  }
  for (const id of Object.keys(VC.peers)) {
    if (!G.room.players.find(p => p.id === id)) vcClose(id);
  }
}
setInterval(voiceTick, 400);

function micFrame() {
  if (!G.mic.ok || !analyser) return;
  analyser.getFloatTimeDomainData(micData);
  let sum = 0;
  for (let i = 0; i < micData.length; i++) sum += micData[i] * micData[i];
  const rms = Math.sqrt(sum / micData.length);
  G.mic.rms = rms;
  const sens = mode().micSens || 1;
  if (rms < G.mic.base * 2.5 + 0.01) G.mic.base = G.mic.base * 0.997 + rms * 0.003;
  $('micFill').style.width = `${clamp(rms * 900, 0, 100)}%`;
  // talk level 0-3 drives your creature's mouth (everyone sees you yapping)
  G.talkLvl = rms > G.mic.base * 4 + 0.05 ? 3 : rms > G.mic.base * 3 + 0.028 ? 2 : rms > G.mic.base * 2.2 + 0.015 ? 1 : 0;

  const t = now();
  if (t < G.muteUntil) { $('micLabel').textContent = '🤐'; return; }
  $('micLabel').textContent = '🎤';
  const inRound = G.room && G.room.phase === 'seek' && !G.ghost && G.screen === 'game';
  const poker = 1 + 0.15 * upLvl('poker');
  // ONLY sustained laughter matters. talking/breathing/whispering does nothing.
  const laughThresh = Math.max(0.07 / sens, G.mic.base * 5) * poker;
  G.mic.hot.push(rms > laughThresh ? 1 : 0);
  if (G.mic.hot.length > 10) G.mic.hot.shift();
  const hotCount = G.mic.hot.reduce((a, b) => a + b, 0);

  if (inRound && hotCount >= 5 && t - G.mic.lastLaugh > 3500) {
    G.mic.lastLaugh = t;
    G.mic.hot = [];
    socket.emit('laugh');
    if (!amSeeker()) feed('😂 YOU LAUGHED. The mic heard it. It always hears it.');
  }
}

// ---------- sfx ----------
function unlockAudio() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  try { speechSynthesis.resume(); } catch {}
}
addEventListener('pointerdown', unlockAudio, { once: true });

function tone(type, f0, f1, dur, vol, when = 0) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + when;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noiseBurst(dur, vol, freq, when = 0) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + when;
  const len = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = audioCtx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(audioCtx.destination);
  src.start(t0);
}
const sfx = {
  honk: v => { tone('sawtooth', 130, 70, 0.35, 0.25 * v); tone('square', 65, 40, 0.35, 0.12 * v); },
  roar: v => { noiseBurst(1.1, 0.35 * v, 300); tone('sawtooth', 60, 30, 1.1, 0.35 * v); tone('sawtooth', 90, 45, 1.1, 0.2 * v); },
  cackle: v => { for (let i = 0; i < 6; i++) tone('square', 500 + Math.random() * 400, 300, 0.09, 0.14 * v, i * 0.11); },
  squeak: v => { tone('sine', 900, 1500, 0.12, 0.2 * v); tone('sine', 1200, 1800, 0.1, 0.15 * v, 0.15); },
  fart: v => { tone('sawtooth', 90, 45, 0.55, 0.3 * v); noiseBurst(0.5, 0.1 * v, 250); },
  chomp: v => { noiseBurst(0.12, 0.4 * v, 900); tone('sine', 150, 60, 0.2, 0.35 * v); },
  airhorn: v => { tone('sawtooth', 466, 460, 0.8, 0.22 * v); tone('sawtooth', 470, 464, 0.8, 0.22 * v); },
  blip: v => tone('sine', 600, 500, 0.08, 0.15 * v),
  munch: v => { for (let i = 0; i < 3; i++) { noiseBurst(0.1, 0.3 * v, 800, i * 0.35); tone('sine', 140, 70, 0.15, 0.25 * v, i * 0.35); } },
  spooky: v => { tone('sine', 420, 280, 1.0, 0.2 * v); tone('sine', 425, 285, 1.0, 0.15 * v, 0.1); },
  // the cursed noise cabinet
  queef: v => { tone('sine', 700, 1300, 0.14, 0.16 * v); tone('sine', 900, 1500, 0.1, 0.12 * v, 0.12); noiseBurst(0.12, 0.06 * v, 1400); },
  moan: v => { tone('sine', 240, 340, 0.5, 0.18 * v); tone('sine', 300, 210, 0.6, 0.14 * v, 0.4); tone('sine', 260, 360, 0.4, 0.12 * v, 0.9); },
  burp: v => { tone('sawtooth', 150, 70, 0.4, 0.28 * v); noiseBurst(0.35, 0.12 * v, 400); },
  squelch: v => { tone('sine', 320, 120, 0.25, 0.2 * v); noiseBurst(0.2, 0.14 * v, 500); },
};

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.toLowerCase());
    u.pitch = 0.1 + Math.random() * 0.4;
    u.rate = 0.8 + Math.random() * 0.25;
    u.volume = 1;
    speechSynthesis.speak(u);
  } catch {}
}
function speakQuip(text, id, vol) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = 0.9 + (hash(id) % 10) / 10;
    u.rate = 1.0 + (hash(id) % 4) / 20;
    u.volume = vol;
    speechSynthesis.speak(u);
  } catch {}
}

// home logo: a live painted monster whose colour slowly shifts
setInterval(() => {
  const cn = $('logoCanvas');
  if (!cn || G.screen !== 'home') return;
  const g = cn.getContext('2d');
  g.clearRect(0, 0, cn.width, cn.height);
  artMonster(g, cn.width / 2, cn.height - 8, 130, now(), (now() / 40) % 360, { roar: Math.sin(now() / 2400) > 0.55 });
}, 50);

function rafLoop() { step(); requestAnimationFrame(rafLoop); }
requestAnimationFrame(rafLoop);
// fallback driver: browsers throttle/suspend rAF on dimmed or hidden screens
setInterval(() => { if (now() - lastFrame > 200) step(); }, 66);
