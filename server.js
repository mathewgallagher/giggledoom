// GIGGLEDOOM server. Rooms, rounds, seeker rotation, laugh judgment, quips, chaos events, tasks.
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
// the 3D house IS the game now; classic 2D lives on at /classic
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', '3d.html')));
app.get('/classic', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server, {
  connectionStateRecovery: { maxDisconnectionDuration: 90000 }, // phone locks survive 90s
});
const PORT = process.env.PORT || 3007;

const MAX_PLAYERS = 16;

const MODES = {
  classic:  { id: 'classic',  name: 'CLASSIC HUNT',  desc: 'The OG. Hide. Do not giggle.',                      hideTime: 20, seekTime: 180, seekerSpeed: 1.0,  micSens: 1.0, vision: 620 },
  speed:    { id: 'speed',    name: 'SPEED DEMON',   desc: 'Short round. Monster had six espressos.',           hideTime: 10, seekTime: 90,  seekerSpeed: 1.4,  micSens: 1.0, vision: 620 },
  trigger:  { id: 'trigger',  name: 'HAIR TRIGGER',  desc: 'Mic cranked to snitch levels. Breathe funny, die.', hideTime: 20, seekTime: 180, seekerSpeed: 1.0,  micSens: 2.2, vision: 620 },
  midnight: { id: 'midnight', name: 'MIDNIGHT MODE', desc: 'Everyone is basically blind. Good luck.',           hideTime: 20, seekTime: 210, seekerSpeed: 1.0,  micSens: 1.0, vision: 330 },
};

const PERKS = [
  { id: 'shoes',  emoji: '🥷', name: 'SILENT SHOES',  desc: 'Your footsteps make zero noise next round.' },
  { id: 'smoke',  emoji: '💨', name: 'SMOKE BOMB',    desc: 'One use: blind the monster for 4 seconds.' },
  { id: 'double', emoji: '🪆', name: 'BODY DOUBLE',   desc: 'One use: drop a decoy clone of yourself.' },
  { id: 'snack',  emoji: '🍗', name: 'MONSTER SNACK', desc: 'One use: throw a snack. Monster MUST stop and eat it.' },
];

// Base game is rated R now. After Dark makes it worse. On purpose.
const TAUNTS = [
  'COME OUT YOU LITTLE SHIT GOBLINS.',
  'I SMELL FEAR. AND CHEESE. MOSTLY CHEESE.',
  'GOT DAYUM, SOMEBODY IN HERE IS SWEATY AS HELL.',
  'I JUST WANT TO NIBBLE ONE. SINGULAR. TOE.',
  'YOUR CARDIO WILL NOT SAVE YOUR SOFT LITTLE BODY.',
  'I CAN HEAR YOUR HEARTBEAT AND FRANKLY IT IS PATHETIC.',
  'OLLY OLLY OXEN... DOOMED.',
  'MARCO. SAY POLO. I DARE YOU, COWARD.',
  'WHOEVER IS IN THE TOILET, I RESPECT IT. STILL GONNA EAT YOU.',
  'I CHECKED THE FRIDGE. TWICE. FOR SNACKS. AND BODIES.',
  'SOMEBODY FARTED AND I WILL FOLLOW THAT SMELL TO THE ENDS OF THE EARTH.',
  'RUN ALL YOU WANT. YOU ARE JUST MARINATING YOURSELF.',
  'WELL BUTTER MY BISCUIT, I SMELL A COWARD.',
  'THIS HOUSE IS UGLY AND SO ARE YOUR HIDING SKILLS.',
  'BACK IN MY DAY WE HID IN CAVES AND WE LIKED IT.',
  'I HAVE A BUNION OLDER THAN EVERY ONE OF YOU.',
  'SOMEONE JUST QUEEFED IN B FLAT. MAJESTIC.',
  'I HEARD A MOAN. WAS THAT FEAR OR FUN. EITHER WAY, MINE.',
  'CALL ME AN OVEN BECAUSE I AM PREHEATED AND YOU ARE A HOT POCKET.',
  'CLENCH ALL YOU WANT. IT ONLY SEASONS THE MEAT.',
  'I ALREADY KNOW WHICH ONE OF YOU CRIES FIRST. IT IS YOU. OBVIOUSLY YOU.',
  'THERE IS NO DOOR OUT. THERE NEVER WAS. WELCOME HOME.',
  'I WILL FIND YOU BY SMELL. AND FRANKLY, EASILY.',
  'DO NOT RUN TOWARD THE LIGHT. THE LIGHT IS ALSO ME.',
  'I HAVE SO MANY TEETH AND SO FEW MORALS.',
  'YOUR BONES WOULD MAKE A LOVELY WIND CHIME. HOLD STILL.',
];
const TAUNTS_DARK = [
  'I HAVE SEEN YOUR BROWSER HISTORY. THE BUSH WILL NOT SAVE YOU.',
  'COME OUT. I JUST WANT TO CUDDLE. AGGRESSIVELY. WITH TEETH.',
  'YOUR EX SAYS HI. WE ARE DATING NOW. IT IS SERIOUS. MEET YOUR NEW DADDY.',
  'I KNOW WHAT YOU DID IN THE PORTA POTTY, YOU ANIMAL.',
  'I AM GOING TO SNIFF YOU LIKE A TRUCK STOP CANDLE.',
  'STOP HIDING. WE MATCHED ON HINGE, REMEMBER? YOU SAID YOU LOVED LONG WALKS.',
  'I CAN HEAR YOU CLENCHING FROM HERE.',
  'THE LAST PERSON I CAUGHT SAID IT WAS THE BEST 4 SECONDS OF THEIR LIFE.',
  'YOUR THERAPIST TOLD ME EVERYTHING. EVERYTHING.',
  'WHEN I FIND YOU WE ARE SPOONING. I AM LITTLE SPOON. NO REFUNDS.',
  'THAT LAUNDRY PILE HAS SEEN THINGS. SO HAVE I. SO WILL YOU.',
  'WHOEVER QUEEFED: THE ACOUSTICS IN THIS HOUSE ARE INCREDIBLE.',
];

// Hider auto-quips: your own character snitches on you, out loud.
const QUIPS = [
  'who the FUCK smells like cheese?',
  'did somebody just fart? be honest.',
  'GOT DAYUM it is dusty in here.',
  'shhh shhh shhh SHUT UP he will hear us.',
  'my knees just popped louder than a gunshot.',
  'I am sweating like a sinner in church.',
  'it is colder than a witch\'s titty in here.',
  'well butter my biscuit, that monster is UGLY.',
  'if I die, clear my browser history.',
  'my stomach just growled... you son of a bitch.',
  'this is the worst hide and seek since Nam.',
  'I am not scared. I am just moist.',
  'somebody\'s deodorant gave up 20 minutes ago.',
  'hold my calls. I live in this bush now.',
  'lord give me the strength to not giggle.',
  'I have the knees of a much older man.',
  'back in my day a nickel bought you a whole sandwich AND a fistfight.',
  'I have not felt my legs since the Reagan administration.',
  'do NOT make me laugh, I just had a hip replaced.',
  'my prostate has better instincts than all of you.',
  'I keep my snacks where my dignity used to be.',
  'this reminds me of the war. every single thing reminds me of the war.',
  'somebody just moaned and I choose to believe it was the house settling.',
  'I have not made a good decision since 1997 and I will not start now.',
  'my knees sound like somebody stepping on a bag of chips.',
  'if I hold this fart in any longer I ascend to a higher plane.',
];
const QUIPS_DARK = [
  'did somebody just QUEEF? in THIS economy?',
  'it smells like feet and bad decisions in here.',
  'slap my ass and call me Sally, he is RIGHT THERE.',
  'I have hidden in worse places. do not ask. she knows.',
  'this closet has seen more action than my entire twenties.',
  'I would rather die than fart right now. I might do both.',
  'these are the same noises I make on a first date.',
  'whoever is breathing like that, we get it, you vape.',
  'whoever just moaned, that is NOT the assignment.',
  'I will pay anyone here fifty bucks to not make me laugh right now.',
  'my cheeks are clenched so hard I could crack a walnut.',
  'if I laugh I pee, and if I pee I die, so no promises.',
  'somebody in here is thinking about it. I can smell the horny AND the fear.',
];

// Gamertag quips: {tag} = a random OTHER player, {me} = speaker, {monster} = the seeker's name.
const QUIPS_TAG = [
  '{tag}, I swear to god if that smell is you.',
  'was that {tag}? that was DEFINITELY {tag}.',
  '{tag} better not get me caught, I mean it.',
  'if {tag} laughs I am taking them down WITH me.',
  '{tag} is breathing like a phone sex hotline over there.',
  'psst {tag}... {tag}... he is right behind you lmao.',
  'not {tag} hiding in the worst spot AGAIN.',
  '{tag} owes me twenty bucks and now they gonna die too.',
  'I can hear {tag} sweating from here.',
  '{monster} is gonna eat {tag} first and honestly? deserved.',
  '{tag} smells like a wet dog at a bus station.',
  'whoever taught {tag} to hide should be in prison.',
];
const QUIPS_TAG_DARK = [
  '{tag} did NOT shower before this. I can tell.',
  'if I die a virgin because of {tag} I will haunt them.',
  '{tag} and {monster} would honestly make a cute couple.',
  'was that a fart or is {tag} just built like that?',
  '{tag} please stop, this is a family game. it is not, but still.',
  'I have seen {tag} naked and the monster deserves better.',
];

const MONSTER_FIRST = ['GLORBO', 'SLURPO', 'CHUNGO', 'HONKLORD', 'WETSOCK', 'GRIMBUS', 'MOISTOPHER', 'BLORT', 'SQUELCH', 'GRUNKLE', 'DRIBBLES', 'CLOMPUS', 'FARTHOLOMEW', 'GRUNTILDA'];
const MONSTER_LAST = ['THE MOIST', 'THE UNEMPLOYED', 'DESTROYER OF PANTS', 'THE MILDLY DAMP', 'THE TAX AUDITOR', 'WHO SMELLS YOU', 'THE UNWASHED', 'OF THE HOA', 'THE TOE COLLECTOR', 'ESQUIRE', 'THE ALLEGEDLY REFORMED', 'THE HR VIOLATION', 'THE CHEESE SNIFFER', 'YOUR SLEEP PARALYSIS DEMON'];

// mirror of client map data needed for tasks (ids + labels only)
const SPOT_INFO = [
  ['k1', 'The Fridge (Leftovers of the Damned)'], ['k2', 'Giant Cheese Wheel (Why)'], ['k3', 'Trash. Home.'], ['k4', 'Pizza Box Tower'],
  ['l1', 'Couch Cushion Abyss'], ['l2', 'Behind the TV (Cables of Doom)'], ['l3', 'Extremely Fake Plant'], ['l4', 'Emotional Support Teddy Pile'],
  ['b1', 'Under the Bed (Monsters Only)'], ['b2', 'The Closet (Come Out Eventually)'], ['b3', 'Laundry: Chair Edition'], ['b4', 'Shoe Pile of a Thousand Regrets'],
  ['g1', 'Under the Car (Oil Included)'], ['g2', 'Tire Fort'], ['g3', "Boxes of Your Ex's Stuff"], ['g4', 'Toolbox (Dad Knows)'],
  ['s1', 'Cobweb Corner (Free Spiders)'], ['s2', 'Wine Rack of Poor Choices'], ['s3', 'Creepy Mannequin Squad'], ['s4', "Dad's Band Equipment (RIP)"],
  ['t1', 'Tub of Regret'], ['t2', 'The Shower (Sing Quietly)'], ['t3', 'The Toilet (Godspeed)'], ['t4', 'TP Fort (Y2K Stockpile)'],
  ['y1', 'Suspicious Bush (Classic)'], ['y2', 'Murder Tent'], ['y3', 'Behind the Grill (Smells Great)'], ['y4', 'Sunflower Witness Protection'],
];
const ROOM_NAMES = ['THE KITCHEN', 'THE LIVING ROOM', 'THE BEDROOM (LOCK THE DOOR)', "THE GARAGE (DAD'S LAIR)", 'THE BASEMENT (SUS)', 'THE BATHROOM (COURTESY FLUSH)', 'THE BACKYARD (HOA APPROVED)'];

const EVENTS = ['fart', 'queef', 'moan', 'burp', 'cheese', 'lights', 'quake', 'disco'];
const BODILY = ['fart', 'queef', 'moan', 'burp']; // reveal a random hider's location via a cursed noise

const rooms = new Map();

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makeCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
  return rooms.has(s) ? makeCode() : s;
}

// Names get spoken aloud via text-to-speech, so keep out slurs and obvious contact info.
const BANNED = ['nigg', 'fagg', 'retard', 'kike', 'spic', 'chink', 'tranny', 'rape', 'kys', 'kill yourself'];
const GOOFY_FALLBACK = ['GOBLIN', 'GAS LEAK', 'MYSTERY MEAT', 'CROTCH GOBLIN', 'DAMP LARRY', 'SIR STINKS', 'BEAN MACHINE', 'WET NUGGET'];
function sanitizeName(raw) {
  let n = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 14).toUpperCase();
  const flat = n.toLowerCase().replace(/[^a-z]/g, '');
  if (!n || BANNED.some(b => flat.includes(b)) || /\d{5,}/.test(n)) {
    return GOOFY_FALLBACK[Math.floor(Math.random() * GOOFY_FALLBACK.length)];
  }
  return n;
}

function resolveQuip(room, speaker) {
  const others = [...room.players.values()].filter(p => p.id !== speaker.id);
  const useTag = others.length && Math.random() < 0.55;
  let text;
  if (useTag) {
    const pool = room.afterDark ? QUIPS_TAG.concat(QUIPS_TAG_DARK) : QUIPS_TAG;
    text = rand(pool);
  } else {
    const pool = room.afterDark ? QUIPS.concat(QUIPS_DARK) : QUIPS;
    text = rand(pool);
  }
  const tag = others.length ? rand(others).name : speaker.name;
  return text.replace(/\{tag\}/g, tag).replace(/\{me\}/g, speaker.name).replace(/\{monster\}/g, room.monsterName || 'THE MONSTER');
}

function snapshot(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    mode: room.mode,
    afterDark: room.afterDark,
    phase: room.phase,
    round: room.round,
    monsterName: room.monsterName,
    seekerId: room.seekerId,
    timeLeft: room.timeLeft,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, char: p.char, hat: p.hat, skin: p.skin, acc: p.acc, aura: p.aura, coins: p.coins,
      isSeeker: p.id === room.seekerId, caught: p.caught, perk: p.perk, beenSeeker: p.beenSeeker,
    })),
  };
}
function sync(room) { io.to(room.code).emit('room', snapshot(room)); }
function msg(room, text) { io.to(room.code).emit('msg', { text }); }

function makeRoom(hostId) {
  const room = {
    code: makeCode(),
    hostId,
    mode: 'classic',
    afterDark: false,
    players: new Map(),
    phase: 'lobby',
    round: 0,
    seekerId: null,
    monsterName: '',
    caughtOrder: [],
    timeLeft: 0,
    tickN: 0,
    interval: null,
    winnerId: null,
  };
  rooms.set(room.code, room);
  room.interval = setInterval(() => tick(room), 1000);
  return room;
}

function destroyRoom(room) {
  clearInterval(room.interval);
  rooms.delete(room.code);
}

function alive(room) {
  return [...room.players.values()].filter(p => p.id !== room.seekerId && !p.caught && !p.late);
}

// ---------- tasks ----------
function makeTask(p, room) {
  const types = ['touch', 'camp', 'silence', 'loot'];
  if (room && room.seekerId) types.push('taunt');
  const type = rand(types);
  const t = { type, seq: p.taskSeq };
  if (type === 'touch') {
    const [id, label] = rand(SPOT_INFO);
    t.spotId = id;
    t.desc = `Go slap: ${label}`;
  } else if (type === 'camp') {
    t.room = rand(ROOM_NAMES);
    t.desc = `Loiter in ${t.room} for 10s`;
  } else if (type === 'silence') {
    t.desc = 'TOTAL silence for 20s. Not a peep.';
  } else if (type === 'taunt') {
    t.desc = 'Get close to the monster. Survive 5s. Danger pay.';
  } else {
    t.desc = 'Collect 3 shinies (only you can see them)';
  }
  return t;
}
function sendTask(room, p) {
  p.taskSeq = (p.taskSeq || 0) + 1;
  p.task = makeTask(p, room);
  io.to(p.id).emit('task', p.task);
}

function startRound(room) {
  if (room.players.size < 1) return;
  room.round++;
  const all = [...room.players.values()];
  const solo = all.length === 1;
  if (solo) {
    // SOLO EXPLORE: no monster, wander the house, do tasks, meet the bots.
    room.seekerId = null;
    room.monsterName = 'THE MONSTER (ON BREAK)';
  } else {
    let candidates = all.filter(p => !p.beenSeeker);
    if (candidates.length === 0) { all.forEach(p => (p.beenSeeker = false)); candidates = all; }
    const seeker = rand(candidates);
    seeker.beenSeeker = true;
    room.seekerId = seeker.id;
    room.monsterName = `${rand(MONSTER_FIRST)} ${rand(MONSTER_LAST)}`;
  }
  room.caughtOrder = [];
  room.winnerId = null;
  room.tickN = 0;
  all.forEach(p => { p.caught = false; p.late = false; p.spot = null; p.taskSeq = 0; p.task = null; p.lastTaskAt = 0; });
  room.phase = 'hiding';
  room.timeLeft = solo ? 3 : MODES[room.mode].hideTime;
  sync(room);
  msg(room, solo
    ? 'SOLO EXPLORE: the monster is on its lunch break. Wander. Snoop. Bother the staff.'
    : `ROUND ${room.round}: ${room.players.get(room.seekerId).name} has transformed into ${room.monsterName}. HIDE, IDIOTS.`);
}

function endRound(room) {
  room.phase = 'end';
  room.timeLeft = 30;
  const survivors = shuffle(alive(room));
  const caughtPlayers = room.caughtOrder
    .map(id => room.players.get(id))
    .filter(Boolean)
    .reverse();
  const ranking = [...survivors.map(p => ({ id: p.id, name: p.name, char: p.char, survived: true })),
    ...caughtPlayers.map(p => ({ id: p.id, name: p.name, char: p.char, survived: false }))];
  const coins = {};
  const payouts = [6, 4, 3];
  ranking.forEach((r, i) => { coins[r.id] = payouts[i] || 1; });
  const seeker = room.players.get(room.seekerId);
  if (seeker) coins[seeker.id] = 1 + 2 * room.caughtOrder.length;
  for (const [id, amt] of Object.entries(coins)) {
    const p = room.players.get(id);
    if (p) p.coins += amt;
  }
  room.players.forEach(p => { p.perk = null; });
  room.winnerId = ranking.length ? ranking[0].id : null;
  const perkOptions = shuffle(PERKS).slice(0, 3);
  io.to(room.code).emit('roundEnd', { ranking, coins, winnerId: room.winnerId, perkOptions });
  sync(room);
}

function catchPlayer(room, p, how, silent) {
  if (room.phase !== 'seek' || p.caught || p.id === room.seekerId) return;
  p.caught = true;
  p.spot = null;
  room.caughtOrder.push(p.id);
  io.to(room.code).emit('caught', { id: p.id, how });
  if (!silent) {
    const line = how === 'laugh'
      ? `${p.name} LITERALLY DIED LAUGHING. Pathetic. Incredible.`
      : how === 'check'
        ? `${p.name} was YANKED out of their hiding spot like a stubborn weed.`
        : `${p.name} got absolutely YOINKED.`;
    msg(room, line);
  }
  if (alive(room).length === 0) endRound(room);
}

function fireEvent(room) {
  const hiders = alive(room);
  const type = rand(EVENTS);
  const payload = { type };
  const locational = BODILY.includes(type) || type === 'cheese';
  if (locational && hiders.length) {
    const t = rand(hiders);
    payload.id = t.id; payload.name = t.name; payload.x = t.x; payload.y = t.y;
  } else if (locational) {
    payload.type = 'quake';
  }
  io.to(room.code).emit('event', payload);
}

function tick(room) {
  if (room.phase === 'lobby') return;
  room.timeLeft--;
  room.tickN++;
  io.to(room.code).emit('tick', { timeLeft: room.timeLeft, phase: room.phase });

  if (room.phase === 'hiding') {
    if (room.timeLeft <= 0) {
      room.phase = 'seek';
      room.timeLeft = MODES[room.mode].seekTime;
      room.tickN = 0;
      sync(room);
      msg(room, `${room.monsterName} IS AWAKE. SHUT. UP.`);
      io.to(room.code).emit('roar');
      alive(room).forEach(p => sendTask(room, p));
    }
  } else if (room.phase === 'seek') {
    const n = room.tickN;
    if (room.seekerId && n % 16 === 0) io.to(room.code).emit('roar');
    // the monster speaks occasionally (ONE global voice). room bots (client-side) carry the
    // rest of the comedy, so we no longer spam a spoken line per hider.
    if (room.seekerId && n % 19 === 7) {
      const pool = room.afterDark ? TAUNTS_DARK.concat(TAUNTS) : TAUNTS;
      io.to(room.code).emit('taunt', { text: rand(pool) });
    }
    if (n % 42 === 20) fireEvent(room);
    if (room.timeLeft <= 0) {
      msg(room, 'TIME! The survivors emerge, smug and unbitten.');
      endRound(room);
    }
  } else if (room.phase === 'end') {
    if (room.timeLeft <= 0) {
      if (room.players.size >= 2) startRound(room);
      else { room.phase = 'lobby'; sync(room); }
    }
  }
}

io.on('connection', socket => {
  let room = null;
  let me = null;

  function joinRoom(r, name, hat) {
    room = r;
    me = {
      id: socket.id,
      name: sanitizeName(name),
      char: 'zoomy',
      hat: String(hat || '').slice(0, 4),
      skin: '', acc: '', aura: '',
      x: 1300, y: 650, spot: null, camo: false,
      caught: false, late: false, beenSeeker: false, coins: 0, perk: null,
      taskSeq: 0, task: null, lastTaskAt: 0,
    };
    if (room.phase !== 'lobby' && room.phase !== 'end') { me.caught = true; me.late = true; }
    room.players.set(me.id, me);
    socket.join(room.code);
    sync(room);
    if (me.late) msg(room, `${me.name} joined mid-round as a ghost. Spooky. Rude.`);
    else msg(room, `${me.name} slithered into the lobby.`);
  }

  socket.on('create', ({ name, hat }, cb) => {
    const r = makeRoom(socket.id);
    joinRoom(r, name, hat);
    cb({ ok: true, code: r.code, id: socket.id, modes: Object.values(MODES), perks: PERKS });
  });

  socket.on('join', ({ code, name, hat }, cb) => {
    const r = rooms.get(String(code || '').toUpperCase().trim());
    if (!r) return cb({ ok: false, err: 'Room not found. Typo? Betrayal?' });
    if (r.players.size >= MAX_PLAYERS) return cb({ ok: false, err: `Room is full (${MAX_PLAYERS} max).` });
    joinRoom(r, name, hat);
    cb({ ok: true, code: r.code, id: socket.id, modes: Object.values(MODES), perks: PERKS });
  });

  socket.on('char', charId => {
    if (!me || !room || room.phase === 'hiding' || room.phase === 'seek') return;
    if (['zoomy', 'slurp', 'gremlin', 'wallfish'].includes(charId)) { me.char = charId; sync(room); }
  });

  socket.on('cosmetic', ({ hat, skin, acc, aura }) => {
    if (!me || !room) return;
    if (typeof hat === 'string') me.hat = hat.slice(0, 4);
    if (typeof skin === 'string') me.skin = skin.slice(0, 4);
    if (typeof acc === 'string') me.acc = acc.slice(0, 4);
    if (typeof aura === 'string') me.aura = aura.slice(0, 12);
    sync(room);
  });

  socket.on('hat', hat => {
    if (!me || !room) return;
    me.hat = String(hat || '').slice(0, 4);
    sync(room);
  });

  socket.on('settings', ({ mode, afterDark }) => {
    if (!room || socket.id !== room.hostId || room.phase === 'hiding' || room.phase === 'seek') return;
    if (mode && MODES[mode]) room.mode = mode;
    if (typeof afterDark === 'boolean') room.afterDark = afterDark;
    sync(room);
  });

  socket.on('start', () => {
    if (!room || socket.id !== room.hostId) return;
    if (room.phase === 'lobby' || room.phase === 'end') startRound(room);
  });

  socket.on('next', () => {
    if (!room || socket.id !== room.hostId || room.phase !== 'end') return;
    startRound(room);
  });

  socket.on('pos', d => {
    if (!me || !room) return;
    me.x = +d.x || 0; me.y = +d.y || 0;
    me.spot = d.spot || null; me.camo = !!d.camo;
    socket.volatile.to(room.code).emit('pos', {
      id: me.id, x: me.x, y: me.y, spot: me.spot, camo: me.camo, vz: !!d.vz,
      dg: d.dg || null, dgn: (d.dgn || '').slice(0, 14), lurk: !!d.lurk, tk: Math.min(3, Math.max(0, +d.tk || 0)), caught: me.caught,
    });
  });

  socket.on('noise', ({ kind }) => {
    if (!me || !room || room.phase !== 'seek') return;
    io.to(room.code).emit('ping', { x: me.x, y: me.y, kind: kind || 'talk', id: me.id });
  });

  socket.on('laugh', () => {
    if (!me || !room || room.phase !== 'seek') return;
    if (me.id === room.seekerId) { io.to(room.code).emit('ping', { x: me.x, y: me.y, kind: 'monstergiggle', id: me.id }); return; }
    if (me.caught) return;
    const seeker = room.players.get(room.seekerId);
    const d = seeker ? Math.hypot(me.x - seeker.x, me.y - seeker.y) : Infinity;
    if (d < 430) {
      catchPlayer(room, me, 'laugh');
    } else {
      io.to(room.code).emit('ping', { x: me.x, y: me.y, kind: 'laugh', id: me.id });
      msg(room, `Someone CACKLED in the distance. ${room.monsterName} is interested.`);
    }
  });

  socket.on('catch', ({ id }) => {
    if (!me || !room || socket.id !== room.seekerId) return;
    const target = room.players.get(id);
    if (!target || target.caught || target.spot) return;
    const d = Math.hypot(me.x - target.x, me.y - target.y);
    if (d < 130) catchPlayer(room, target, 'grab');
  });

  socket.on('check', ({ spotId }) => {
    if (!me || !room || socket.id !== room.seekerId || room.phase !== 'seek') return;
    // shared spots can hold more than one goblin: bust everyone crammed in there
    const occupants = [...room.players.values()].filter(p => p.spot === spotId && !p.caught);
    if (occupants.length) {
      const many = occupants.length > 1;
      occupants.forEach((p, i) => catchPlayer(room, p, 'check', many && i > 0));
      if (many) msg(room, `${occupants.length} idiots were spooning in one hiding spot. All busted.`);
    } else {
      io.to(room.code).emit('whiff', { spotId });
    }
  });

  socket.on('ability', payload => {
    if (!me || !room || room.phase !== 'seek') return;
    io.to(room.code).emit('ability', { id: me.id, ...payload });
  });

  // WebRTC signaling relay for proximity voice: forwards offers/answers/ICE between roommates.
  socket.on('rtc', ({ to, data }) => {
    if (!me || !room || !to || !data) return;
    if (!room.players.has(to)) return;
    io.to(to).emit('rtc', { from: me.id, data });
  });

  socket.on('task:done', ({ seq }) => {
    if (!me || !room || room.phase !== 'seek' || me.caught || me.id === room.seekerId) return;
    if (!me.task || seq !== me.taskSeq) return;
    const t = Date.now();
    if (t - me.lastTaskAt < 8000) return;
    me.lastTaskAt = t;
    me.coins += 2;
    io.to(room.code).emit('taskDone', { id: me.id, name: me.name });
    sendTask(room, me);
  });

  socket.on('perk', ({ perkId }) => {
    if (!me || !room || room.phase !== 'end' || me.id !== room.winnerId) return;
    if (!PERKS.find(p => p.id === perkId)) return;
    me.perk = perkId;
    sync(room);
    msg(room, `${me.name} won a cheat perk: ${PERKS.find(p => p.id === perkId).name}. Cowardice, rewarded.`);
  });

  socket.on('haunt', () => {
    if (!me || !room || room.phase !== 'seek' || !me.caught) return;
    const targets = alive(room);
    if (!targets.length) return;
    const t = rand(targets);
    io.to(room.code).emit('ping', { x: t.x, y: t.y, kind: 'ghost', id: t.id });
    msg(room, `A dead player's ghost GIGGLED near ${t.name}. Friendship is over.`);
  });

  socket.on('disconnect', () => {
    if (!room || !me) return;
    room.players.delete(me.id);
    msg(room, `${me.name} rage quit (or their phone died, sure).`);
    if (room.players.size === 0) { destroyRoom(room); return; }
    if (room.hostId === me.id) {
      room.hostId = [...room.players.keys()][0];
      msg(room, `${room.players.get(room.hostId).name} is the new host. Power corrupts.`);
    }
    if ((room.phase === 'hiding' || room.phase === 'seek') && me.id === room.seekerId) {
      msg(room, 'The MONSTER left?? Round over, everyone survives by default.');
      endRound(room);
    } else if (room.phase === 'seek' && alive(room).length === 0) {
      endRound(room);
    }
    sync(room);
  });
});

// ---------- 3D BETA: Gigglehouse walkabout (fully separate from the 2D game state) ----------
const rooms3d = new Map(); // code -> Map<socketId, {id, name, char, x, z, yaw}>
const CHARS3D = ['zoomy', 'slurp', 'gremlin', 'wallfish'];

// ---------- SNEAKY BASTARD MODE (social deduction in the Gigglehouse) ----------
const games3d = new Map(); // code -> game state
const SB_TASKS = ['cheese', 'fridge', 'flush', 'clock', 'coffin', 'gnome', 'crib', 'portrait', 'ham', 'valve',
  'bed', 'books', 'trophy', 'darts', 'stars', 'sheets']; // last six live on the upper floors
const SB_DUO = { ham: [1.3, -12.6], valve: [5.6, 13.1] }; // chores that need a second idiot nearby
// 3D distance: the house has floors now; nobody kills/reports/grabs through a ceiling
const d3 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z, (a.y || 0) - (b.y || 0));
const SB_KILL_COOLDOWN = 25000, SB_MEETING_MS = 45000, SB_TASKS_EACH = 4;
const sbRoom = code => '3d:' + code;

// house progression + the secret shelf, per house code.
// XP persists to a JSON file so a server restart doesn't wipe the family home.
// (survives restarts; a redeploy on ephemeral disk still resets it — good enough for now)
const fs = require('fs');
const XP_FILE = path.join(__dirname, 'housexp.json');
const houseXP = new Map(), houseShelf = new Map();
try {
  Object.entries(JSON.parse(fs.readFileSync(XP_FILE, 'utf8'))).forEach(([k, v]) => houseXP.set(k, v));
  console.log(`house xp loaded for ${houseXP.size} houses`);
} catch { /* first boot, nothing saved yet */ }
let xpSaveT = null;
function saveXP() {
  clearTimeout(xpSaveT);
  xpSaveT = setTimeout(() => {
    fs.writeFile(XP_FILE, JSON.stringify(Object.fromEntries(houseXP)), () => {});
  }, 1500);
}
const HOUSE_LEVELS = [0, 50, 120, 220, 350, 520, 740, 1000];
const houseLevel = xp => { let l = 1; HOUSE_LEVELS.forEach((th, i) => { if (xp >= th) l = i + 1; }); return l; };
function addHouseXP(code, n) {
  const xp = (houseXP.get(code) || 0) + n;
  houseXP.set(code, xp);
  saveXP();
  io.to(sbRoom(code)).emit('house-xp', { xp, level: houseLevel(xp) });
}

// MONSTER WAKES: waypoint graph so the monster walks through doors, not walls.
// nodes are [x, z, y]; at house level 5+ HE LEARNS THE STAIRS and the upstairs
// nodes come into play. the attic stays his blind spot. forever. probably.
const MW_STAIR_LEVEL = +process.env.GD_STAIR_LVL || 5; // env override is for local testing only
const MW_NODES = {
  den: [0, 0, 0], hall: [-1.5, -7, 0], nursery: [-8, -13, 0], kitchen: [1, -13, 0], bath: [7.5, -13, 0],
  crypt: [11.5, 0, 0], yard: [-2, 9.5, 0], base: [7.5, 9.5, 0],
  dHallDen: [0, -5, 0], dHallNur: [-8.2, -9, 0], dHallKit: [1, -9, 0], dHallBath: [7.2, -9, 0], dHallCrypt: [8.75, -5, 0],
  dDenCrypt: [7, 0, 0], dDenYard: [-2.2, 5, 0], dDenBase: [4.8, 5, 0], dYardBase: [3, 9.3, 0], dCryptBase: [9.8, 5, 0],
  stairB: [-9.2, -5.85, 0], stairT: [-12.4, -6.2, 3.7],
  landing: [-1.5, -7, 3.7], master2: [-8, -13, 3.7], library: [0.5, -13, 3.7],
  trophy2: [7, -13, 3.7], game: [0, 0, 3.7], obs: [11.5, 0, 3.7],
  dLandMaster: [-8.2, -9, 3.7], dLandLib: [1, -9, 3.7], dLandTrophy: [7.2, -9, 3.7],
  dLandGame: [0, -5, 3.7], dGameObs: [7, 0, 3.7],
};
const MW_EDGES = {
  den: ['dHallDen', 'dDenCrypt', 'dDenYard', 'dDenBase'],
  hall: ['dHallDen', 'dHallNur', 'dHallKit', 'dHallBath', 'dHallCrypt', 'stairB'],
  nursery: ['dHallNur'], kitchen: ['dHallKit'], bath: ['dHallBath'],
  crypt: ['dHallCrypt', 'dDenCrypt', 'dCryptBase'],
  yard: ['dDenYard', 'dYardBase'], base: ['dDenBase', 'dYardBase', 'dCryptBase'],
  stairB: ['stairT'], stairT: ['landing'],
  landing: ['dLandMaster', 'dLandLib', 'dLandTrophy', 'dLandGame'],
  master2: ['dLandMaster'], library: ['dLandLib'], trophy2: ['dLandTrophy'],
  game: ['dLandGame', 'dGameObs'], obs: ['dGameObs'],
};
Object.entries(MW_EDGES).forEach(([room, doors]) => doors.forEach(d => {
  MW_EDGES[d] = MW_EDGES[d] || [];
  if (!MW_EDGES[d].includes(room)) MW_EDGES[d].push(room);
}));
const ROOMS3D = [
  ['den', -7, -5, 7, 5], ['hall', -13, -9, 10, -5], ['nursery', -13, -17, -3, -9],
  ['kitchen', -3, -17, 5, -9], ['bath', 5, -17, 10, -9], ['crypt', 7, -5, 16, 5],
  ['yard', -7, 5, 3, 14], ['base', 3, 5, 12, 14],
];
const ROOMS3D_UP = [
  ['landing', -13, -9, 10, -5], ['master2', -13, -17, -3, -9], ['library', -3, -17, 4, -9],
  ['trophy2', 4, -17, 10, -9], ['game', -7, -5, 7, 5], ['obs', 7, -5, 16, 5],
];
const roomOf = (x, z, y = 0) => {
  const table = y > 1.8 ? ROOMS3D_UP : ROOMS3D;
  const r = table.find(([, x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
  return r ? r[0] : (y > 1.8 ? 'landing' : 'den');
};
function mwPath(fromRoom, toRoom) { // BFS over the tiny graph
  if (fromRoom === toRoom) return [];
  const prev = { [fromRoom]: null }, q = [fromRoom];
  while (q.length) {
    const n = q.shift();
    for (const m of (MW_EDGES[n] || [])) {
      if (m in prev) continue;
      prev[m] = n; q.push(m);
      if (m === toRoom) { const path = []; let c = toRoom; while (prev[c]) { path.unshift(c); c = prev[c]; } return path; }
    }
  }
  return [];
}
const HIDEYS3D = [[-2.3, -16.42], [-12.58, -11.5], [15.45, -3.6], [-6.0, 7.3], [-5.2, 9.8]];
const mwHidden = p => HIDEYS3D.some(([hx, hz]) => Math.hypot(p.x - hx, p.z - hz) < 0.9);

// HEIST: treasures and the loot chest. each item has candidate spawn spots ([x, z, y])
// so no two heists start alike; the orb always waits somewhere upstairs.
const HS_ITEMS = {
  skull: [[12.7, 3.5, 0], [14.6, -3.2, 0], [8.4, -3.6, 0]],
  ham: [[1.15, -12.6, 0], [3.6, -15.6, 0], [-1.6, -10.4, 0]],
  crown: [[-1.8, 11.3, 0], [-5.6, 12.6, 0], [1.6, 7.4, 0]],
  orb: [[12.5, 2.2, 3.7], [14.6, 3.9, 3.7], [8.6, -3.4, 3.7]],
};
const HS_CHEST = [-1.7, -4.35];
// TONIGHT'S HOUSE RULE: most nights are normal; some nights the house has opinions
const HOUSE_RULES = [
  null, null, null,
  { id: 'fog', label: 'PEA SOUP — the fog is personal tonight' },
  { id: 'zoomies', label: 'ZOOMIES — everyone is 15% faster' },
  { id: 'creaky', label: 'CREAKY BONES — the floors snitch louder' },
  { id: 'bloodmoon', label: 'BLOOD MOON — the lights hate you' },
  { id: 'payday', label: 'PAYDAY — double coins' },
];

function sbWin(code, winner) {
  const g = games3d.get(code);
  if (!g || g.phase === 'over') return;
  g.phase = 'over';
  clearTimeout(g.meetingTimer);
  clearTimeout(g.sabTimer);
  clearInterval(g.eventTimer);
  clearInterval(g.recapTimer);
  if (g.monster) clearInterval(g.monster.timer);
  addHouseXP(code, 10);
  io.to(sbRoom(code)).emit('sb-over', { winner, mode: g.mode, imposter: g.imposter, recap: g.recap, stats: {
    kills: g.stats.kills, tasks: g.stats.tasks, laughs: g.stats.laughs, firstDeath: g.stats.firstDeath,
  } });
  g.overTimer = setTimeout(() => { games3d.delete(code); io.to(sbRoom(code)).emit('sb-walk'); }, 12000);
}
function sbEndSab(code) {
  const g = games3d.get(code);
  if (!g || !g.sab) return;
  clearTimeout(g.sabTimer);
  g.sab = null;
  io.to(sbRoom(code)).emit('sb-sab-end');
}
function sbCheckWins(code) {
  const g = games3d.get(code);
  if (!g || g.phase === 'over') return true;
  if (g.mode === 'monster') {
    if (g.progress >= g.total) { sbWin(code, 'crew'); return true; }
    if (g.alive.size === 0) { sbWin(code, 'monster'); return true; }
    return false;
  }
  const crewAlive = [...g.alive].filter(id => id !== g.imposter).length;
  if (!g.alive.has(g.imposter)) { sbWin(code, 'crew'); return true; }
  if (crewAlive <= 1) { sbWin(code, 'imposter'); return true; }
  if (g.progress >= g.total) { sbWin(code, 'crew'); return true; }
  return false;
}
function sbStartMeeting(code, by, reason) {
  const g = games3d.get(code);
  if (!g || g.phase !== 'playing') return;
  g.phase = 'meeting';
  g.votes = new Map();
  g.bodies.clear();
  sbEndSab(code);
  io.to(sbRoom(code)).emit('sb-meeting', { by, reason, alive: [...g.alive] });
  g.meetingTimer = setTimeout(() => sbTally(code), SB_MEETING_MS);
}
function sbTally(code) {
  const g = games3d.get(code);
  if (!g || g.phase !== 'meeting') return;
  clearTimeout(g.meetingTimer);
  const counts = {};
  g.votes.forEach(v => (counts[v] = (counts[v] || 0) + 1));
  let best = 'skip', bestN = counts.skip || 0, tie = false;
  Object.entries(counts).forEach(([who, n]) => {
    if (who === 'skip') return;
    if (n > bestN) { best = who; bestN = n; tie = false; }
    else if (n === bestN && who !== best) tie = true;
  });
  const ejected = (best !== 'skip' && !tie && bestN > 0) ? best : null;
  if (ejected) g.alive.delete(ejected);
  io.to(sbRoom(code)).emit('sb-eject', {
    id: ejected, wasImposter: ejected === g.imposter, counts,
  });
  if (!sbCheckWins(code)) {
    g.phase = 'playing';
    g.killAt = Date.now(); // fresh kill cooldown after every meeting
    io.to(sbRoom(code)).emit('sb-resume');
  }
}
io.on('connection', socket => {
  // a phone that locked its screen comes back with the same socket id and its
  // house restored (connectionStateRecovery) — cancel its scheduled removal
  let code3d = (socket.recovered && socket.data.code3d) || null;
  if (socket.recovered && pending3d.has(socket.id)) {
    clearTimeout(pending3d.get(socket.id));
    pending3d.delete(socket.id);
  }
  socket.on('3d-join', ({ name, char, code, hat }, cb) => {
    if (code3d) return;
    const clean = String(code || 'HOUSE').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'HOUSE';
    let r = rooms3d.get(clean);
    if (!r) { r = new Map(); rooms3d.set(clean, r); }
    if (r.size >= 16) { cb && cb({ ok: false, err: 'HOUSE FULL (16). TOO POPULAR.' }); return; }
    code3d = clean;
    socket.data.code3d = clean;
    let nm = sanitizeName(name);
    for (let n = 2; [...r.values()].some(q => q.name === nm); n++) nm = sanitizeName(name) + '·' + n; // no twins
    const p = {
      id: socket.id,
      name: nm,
      char: CHARS3D.includes(char) ? char : 'zoomy',
      hat: String(hat || '').replace(/[^a-z]/g, '').slice(0, 16),
      x: -3.4 + (Math.random() * 2 - 1),
      z: 2.6 + (Math.random() * 1.6 - 0.8),
      yaw: -0.62,
    };
    r.set(socket.id, p);
    socket.join('3d:' + code3d);
    const g = games3d.get(code3d);
    const hx = houseXP.get(code3d) || 0;
    cb && cb({
      ok: true, code: code3d, you: p, players: [...r.values()],
      hostId: [...r.keys()][0],
      game: g ? { phase: g.phase, mode: g.mode, progress: g.progress, total: g.total } : null,
      house: { xp: hx, level: houseLevel(hx), shelf: !!houseShelf.get(code3d) },
    });
    socket.to('3d:' + code3d).emit('3d-joined', p);
  });

  // ----- SNEAKY BASTARD MODE events -----
  socket.on('sb-start', payload => {
    const r = code3d && rooms3d.get(code3d);
    if (!r || games3d.has(code3d)) return;
    if ([...r.keys()][0] !== socket.id) return; // host only
    const mode = ['classic', 'monster', 'heist'].includes(payload && payload.mode) ? payload.mode : 'classic';
    const ids = [...r.keys()];
    if (mode === 'monster' ? ids.length < 1 : ids.length < 2) return;
    const imposter = mode === 'monster' ? null : ids[Math.floor(Math.random() * ids.length)];
    const g = {
      mode, phase: 'playing', imposter, alive: new Set(ids),
      tasks: new Map(), done: new Set(), progress: 0,
      total: mode === 'heist' ? Object.keys(HS_ITEMS).length : SB_TASKS_EACH * Math.max(1, ids.length - (imposter ? 1 : 0)),
      killAt: Date.now(), bodies: new Map(),
      votes: new Map(), meetingTimer: null, overTimer: null,
      sab: null, sabReady: 0, sabTimer: null,
      stats: { kills: {}, tasks: {}, laughs: {}, firstDeath: null },
      omenUsed: false, eventTimer: null,
      monster: mode === 'monster' ? { x: 7.5, z: 11.5, path: [], targetRoom: null, lure: null, lureUntil: 0, timer: null, n: 0 } : null,
      items: mode === 'heist'
        ? Object.fromEntries(Object.keys(HS_ITEMS).map(k => {
            const [x, z, y] = rand(HS_ITEMS[k]); // fresh hiding spot every heist
            return [k, { state: 'spot', x, z, y: y || 0, by: null }];
          }))
        : null,
      rule: rand(HOUSE_RULES),
      recap: { path: [], kills: [] }, // the murder map remembers everything
    };
    g.eventTimer = setInterval(() => { // the house acts up: gross-out chaos, on a timer
      const g2 = games3d.get(code3d);
      if (!g2 || g2.phase !== 'playing') return;
      const r2 = rooms3d.get(code3d);
      // fart/stink/disco/quake/flicker/burp fire in every mode; snore + gnome omen are situational
      const kinds = ['fart', 'stink', 'disco', 'quake', 'flicker', 'burp', 'snore'];
      if (!g2.omenUsed && g2.imposter) kinds.push('gnomes');
      const kind = rand(kinds);
      if (kind === 'gnomes') {
        g2.omenUsed = true;
        const imp = r2 && r2.get(g2.imposter);
        if (imp) io.to(sbRoom(code3d)).emit('sb-event', { kind, x: imp.x, z: imp.z });
      } else if (kind === 'fart' || kind === 'burp') {
        // pick a random living victim; their location gets loudly, wetly revealed
        const living = [...g2.alive].map(id => r2 && r2.get(id)).filter(Boolean);
        const who = living.length ? rand(living) : null;
        io.to(sbRoom(code3d)).emit('sb-event', { kind, x: who ? who.x : 0, z: who ? who.z : 0, y: who ? who.y || 0 : 0, id: who ? who.id : null });
      } else io.to(sbRoom(code3d)).emit('sb-event', { kind });
    }, 22000 + Math.random() * 18000); // way more often than before
    const pool = shuffle([...SB_TASKS]).slice(0, 10); // tonight's chores: a rotating subset
    ids.forEach(id => {
      const mine = mode === 'heist' ? [] : shuffle([...pool]).slice(0, SB_TASKS_EACH);
      g.tasks.set(id, mine);
      io.to(id).emit('sb-role', { mode, imposter: id === imposter, tasks: mine, total: g.total });
    });
    games3d.set(code3d, g);
    // the murder map: sample the villain's position every 2s
    g.recapTimer = setInterval(() => {
      const g2 = games3d.get(code3d);
      if (!g2 || g2.phase !== 'playing' || g2.recap.path.length >= 400) return;
      const r2 = rooms3d.get(code3d);
      let px = null;
      if (g2.monster) px = g2.monster;
      else if (g2.imposter) px = r2 && r2.get(g2.imposter);
      if (px) g2.recap.path.push([+px.x.toFixed(1), +px.z.toFixed(1), +(px.y || 0).toFixed(1)]);
    }, 2000);
    io.to(sbRoom(code3d)).emit('sb-begin', {
      mode, alive: ids, total: g.total,
      items: g.items ? Object.entries(g.items).map(([k, v]) => ({ item: k, x: v.x, z: v.z, y: v.y || 0 })) : null,
      rule: g.rule,
    });
    if (mode === 'monster') {
      const canClimb = houseLevel(houseXP.get(code3d) || 0) >= MW_STAIR_LEVEL;
      g.monster.canClimb = canClimb;
      if (canClimb) setTimeout(() => io.to(sbRoom(code3d)).emit('sb-event', { kind: 'stairs' }), 4000);
      g.monster.timer = setInterval(() => {
        const g2 = games3d.get(code3d), r2 = rooms3d.get(code3d);
        if (!g2 || !g2.monster || g2.phase !== 'playing' || !r2) return;
        const M = g2.monster, now = Date.now();
        M.y = M.y || 0;
        let tx = null, tz = null, ty = 0;
        if (M.lure && now < M.lureUntil) { tx = M.lure.x; tz = M.lure.z; ty = M.lure.y || 0; }
        else {
          let bd = 1e9;
          for (const id of g2.alive) {
            const p2 = r2.get(id);
            if (!p2 || mwHidden(p2)) continue;
            const py = p2.y || 0;
            if (py > 5.5) continue; // the attic is his blind spot. the mannequins have a treaty.
            if (py > 1.8 && !canClimb) continue; // he cannot climb stairs. yet.
            const d = Math.hypot(M.x - p2.x, M.z - p2.z, M.y - py);
            if (d < bd) { bd = d; tx = p2.x; tz = p2.z; ty = py; }
          }
        }
        if (tx == null) { M.path = []; return; } // everyone is hiding or above him. he waits. patiently.
        const myRoom = roomOf(M.x, M.z, M.y), tgtRoom = roomOf(tx, tz, ty);
        if (tgtRoom !== M.targetRoom || (!M.path.length && myRoom !== tgtRoom)) {
          M.targetRoom = tgtRoom;
          M.path = mwPath(myRoom, tgtRoom).map(n => MW_NODES[n]);
        }
        let gx = tx, gz = tz, gy = ty;
        if (myRoom !== tgtRoom && M.path.length) [gx, gz, gy] = M.path[0];
        const dx = gx - M.x, dz = gz - M.z, d2 = Math.hypot(dx, dz) || 1;
        const sp = (M.lure && now < M.lureUntil ? 3.1 : 2.3) * 0.25;
        M.x += (dx / d2) * Math.min(sp, d2);
        M.z += (dz / d2) * Math.min(sp, d2);
        const dy3 = (gy || 0) - M.y;
        M.y += Math.sign(dy3) * Math.min(Math.abs(dy3), sp * 1.1); // stairs are just a slope to him now
        if (M.path.length && Math.hypot(M.path[0][0] - M.x, M.path[0][1] - M.z) < 0.6) M.path.shift();
        for (const id of [...g2.alive]) {
          const p2 = r2.get(id);
          if (p2 && !mwHidden(p2) && Math.abs((p2.y || 0) - M.y) < 1.6 && Math.hypot(M.x - p2.x, M.z - p2.z) < 1.3) {
            g2.alive.delete(id);
            if (!g2.stats.firstDeath) g2.stats.firstDeath = id;
            g2.recap.kills.push([+p2.x.toFixed(1), +p2.z.toFixed(1), +(p2.y || 0).toFixed(1)]);
            io.to(sbRoom(code3d)).emit('mw-caught', { id });
            if (g2.alive.size === 0) { sbWin(code3d, 'monster'); return; }
          }
        }
        if ((M.n = (M.n + 1) % 2) === 0)
          io.to(sbRoom(code3d)).volatile.emit('mw-pos', { x: +M.x.toFixed(2), z: +M.z.toFixed(2), y: +M.y.toFixed(2) });
      }, 250);
    }
  });

  // ----- HEIST events -----
  socket.on('hs-grab', ({ item }) => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.mode !== 'heist' || g.phase !== 'playing' || !g.alive.has(socket.id)) return;
    if (socket.id === g.imposter) return; // the bastard steals lives, not loot
    const it = g.items && g.items[item], p = r.get(socket.id);
    if (!it || it.state !== 'spot' || !p || d3(p, it) > 2.6) return;
    it.state = 'carried'; it.by = socket.id;
    io.to(sbRoom(code3d)).emit('hs-grab', { item, by: socket.id });
  });
  socket.on('hs-deliver', () => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.mode !== 'heist' || g.phase !== 'playing') return;
    const p = r.get(socket.id);
    if (!p || Math.hypot(p.x - HS_CHEST[0], p.z - HS_CHEST[1]) > 2.2 || (p.y || 0) > 1.5) return;
    const entry = Object.entries(g.items).find(([, v]) => v.state === 'carried' && v.by === socket.id);
    if (!entry) return;
    entry[1].state = 'chest';
    g.progress++;
    g.stats.tasks[socket.id] = (g.stats.tasks[socket.id] || 0) + 1;
    addHouseXP(code3d, 3);
    io.to(sbRoom(code3d)).emit('hs-score', { item: entry[0], by: socket.id, n: g.progress, total: g.total });
    sbCheckWins(code3d);
  });

  socket.on('3d-shelf', () => {
    if (!code3d) return;
    houseShelf.set(code3d, true);
    socket.to(sbRoom(code3d)).emit('3d-shelf');
  });

  socket.on('3d-emote', ({ kind }) => {
    const r = code3d && rooms3d.get(code3d);
    const p = r && r.get(socket.id);
    if (!p) return;
    const ok = ['wave', 'point', 'accuse', 'dance', 'fart', 'rofl'];
    if (!ok.includes(kind)) return;
    io.to(sbRoom(code3d)).emit('3d-emote', { id: socket.id, kind, x: p.x, z: p.z, y: p.y || 0 });
  });

  socket.on('sb-kill', ({ target }) => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.phase !== 'playing') return;
    if (socket.id !== g.imposter || !g.alive.has(socket.id) || !g.alive.has(target)) return;
    if (Date.now() - g.killAt < SB_KILL_COOLDOWN) return;
    const killer = r.get(socket.id), victim = r.get(target);
    if (!killer || !victim || d3(killer, victim) > 2.2) return; // 3D: no stabbing through the ceiling
    g.killAt = Date.now();
    g.alive.delete(target);
    g.recap.kills.push([+victim.x.toFixed(1), +victim.z.toFixed(1), +(victim.y || 0).toFixed(1)]);
    g.bodies.set(target, { x: victim.x, z: victim.z, y: victim.y || 0, char: victim.char, name: victim.name });
    g.stats.kills[socket.id] = (g.stats.kills[socket.id] || 0) + 1;
    if (!g.stats.firstDeath) g.stats.firstDeath = target;
    if (g.items) { // heist: the dead drop their loot where they fell
      const held = Object.entries(g.items).find(([, v]) => v.state === 'carried' && v.by === target);
      if (held) {
        held[1].state = 'spot'; held[1].x = victim.x; held[1].z = victim.z; held[1].y = victim.y || 0; held[1].by = null;
        io.to(sbRoom(code3d)).emit('hs-drop', { item: held[0], x: victim.x, z: victim.z, y: victim.y || 0 });
      }
    }
    io.to(sbRoom(code3d)).emit('sb-kill', { victim: target, x: victim.x, z: victim.z, y: victim.y || 0 });
    sbCheckWins(code3d);
  });

  socket.on('sb-laugh', () => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.phase !== 'playing' || !g.alive.has(socket.id)) return;
    const p = r.get(socket.id);
    if (!p) return;
    g.stats.laughs[socket.id] = (g.stats.laughs[socket.id] || 0) + 1;
    // a laugh is a dinner bell — reachable floors only (stairs need house lvl 5, attic never)
    if (g.monster && (p.y || 0) < 5.5 && ((p.y || 0) < 1.8 || g.monster.canClimb)) {
      g.monster.lure = { x: p.x, z: p.z, y: p.y || 0 };
      g.monster.lureUntil = Date.now() + 12000;
      io.to(sbRoom(code3d)).emit('mw-roar');
    }
    io.to(sbRoom(code3d)).emit('sb-laugh', { id: socket.id, x: p.x, z: p.z, y: p.y || 0 });
  });

  socket.on('sb-sabotage', ({ kind }) => {
    const g = games3d.get(code3d);
    if (!g || g.phase !== 'playing' || !g.imposter || socket.id !== g.imposter || !g.alive.has(socket.id)) return;
    if (g.sab || Date.now() < g.sabReady) return;
    const DUR = { lights: 25000, pipes: 30000, door: 15000 };
    if (!DUR[kind]) return;
    g.sab = { kind, until: Date.now() + DUR[kind] };
    g.sabReady = Date.now() + 45000;
    io.to(sbRoom(code3d)).emit('sb-sab', { kind, dur: DUR[kind] });
    g.sabTimer = setTimeout(() => sbEndSab(code3d), DUR[kind]);
  });

  socket.on('sb-fix', () => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.phase !== 'playing' || !g.sab || !g.alive.has(socket.id)) return;
    const FIX = { lights: [3.15, 9.0], pipes: [5.15, 12.9] };
    const fp = FIX[g.sab.kind];
    if (!fp) return; // door jam auto-expires
    const p = r.get(socket.id);
    if (!p || Math.hypot(p.x - fp[0], p.z - fp[1]) > 2.2 || (p.y || 0) > 1.5) return;
    sbEndSab(code3d);
  });

  socket.on('sb-drag', ({ victim, x, z, y }) => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.phase !== 'playing' || socket.id !== g.imposter) return;
    const body = g.bodies.get(victim), me3 = r.get(socket.id);
    if (!body || !me3 || d3(me3, body) > 3.5) return;
    body.x = Math.max(-12.6, Math.min(15.6, +x || 0));
    body.z = Math.max(-16.6, Math.min(13.6, +z || 0));
    body.y = Math.max(0, Math.min(11, +y || 0));
    socket.to(sbRoom(code3d)).volatile.emit('sb-drag', { victim, x: body.x, z: body.z, y: body.y });
  });

  socket.on('3d-hat', ({ hat }) => {
    const r = code3d && rooms3d.get(code3d);
    const p = r && r.get(socket.id);
    if (!p) return;
    p.hat = String(hat || '').replace(/[^a-z]/g, '').slice(0, 16);
    socket.to('3d:' + code3d).emit('3d-hat', { id: socket.id, hat: p.hat });
  });

  socket.on('sb-haunt', () => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.phase !== 'playing' || g.alive.has(socket.id)) return; // dead only
    const p = r.get(socket.id);
    if (!p || Date.now() < (p.hauntAt || 0)) return;
    p.hauntAt = Date.now() + 20000;
    io.to(sbRoom(code3d)).emit('sb-haunt', { x: p.x, z: p.z, y: p.y || 0 });
  });

  // the ghost spook kit: flicker the lights, chill the air, slam a door. dead only.
  socket.on('sb-spook', ({ kind }) => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.phase !== 'playing' || g.alive.has(socket.id)) return;
    if (!['flicker', 'chill', 'slam'].includes(kind)) return;
    const p = r.get(socket.id);
    if (!p || Date.now() < (p.spookAt || 0)) return;
    p.spookAt = Date.now() + 10000;
    io.to(sbRoom(code3d)).emit('sb-spook', { kind, x: p.x, z: p.z, y: p.y || 0 });
  });

  socket.on('sb-report', ({ victim }) => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.mode === 'monster' || g.phase !== 'playing' || !g.alive.has(socket.id)) return;
    const body = g.bodies.get(victim), me3 = r.get(socket.id);
    if (!body || !me3 || d3(me3, body) > 3.2) return;
    sbStartMeeting(code3d, socket.id, 'body');
  });

  socket.on('sb-button', () => {
    const r = code3d && rooms3d.get(code3d), g = games3d.get(code3d);
    if (!r || !g || g.mode === 'monster' || g.phase !== 'playing' || !g.alive.has(socket.id)) return;
    const me3 = r.get(socket.id);
    if (!me3 || Math.hypot(me3.x + 5.6, me3.z - 3.6) > 2.6 || (me3.y || 0) > 1.5) return; // must be at the button
    sbStartMeeting(code3d, socket.id, 'button');
  });

  socket.on('sb-vote', ({ who }) => {
    const g = games3d.get(code3d);
    if (!g || g.phase !== 'meeting' || !g.alive.has(socket.id) || g.votes.has(socket.id)) return;
    if (who !== 'skip' && !g.alive.has(who)) return;
    g.votes.set(socket.id, who);
    io.to(sbRoom(code3d)).emit('sb-voted', { by: socket.id, n: g.votes.size, of: g.alive.size });
    if (g.votes.size >= g.alive.size) sbTally(code3d);
  });

  socket.on('sb-task-done', ({ id }) => {
    const g = games3d.get(code3d);
    // the dead may still do chores. it keeps them off the streets.
    if (!g || g.phase !== 'playing' || g.mode === 'heist') return;
    if (g.imposter && socket.id === g.imposter) return; // fake chores don't count, bastard
    const mine = g.tasks.get(socket.id) || [];
    const key = socket.id + ':' + id;
    if (!mine.includes(id) || g.done.has(key)) return;
    if (SB_DUO[id]) { // duo chores need a second living player standing right there
      const r = rooms3d.get(code3d);
      const [dx2, dz2] = SB_DUO[id];
      const helper = r && [...g.alive].some(pid => {
        if (pid === socket.id || pid === g.imposter) return false;
        const pp = r.get(pid);
        return pp && Math.hypot(pp.x - dx2, pp.z - dz2) < 3.2 && (pp.y || 0) < 1.5;
      });
      if (!helper) return;
    }
    g.done.add(key);
    g.progress++;
    g.stats.tasks[socket.id] = (g.stats.tasks[socket.id] || 0) + 1;
    addHouseXP(code3d, 2);
    io.to(sbRoom(code3d)).emit('sb-progress', { progress: g.progress, total: g.total });
    sbCheckWins(code3d);
  });
  socket.on('3d-pos', d => {
    const r = code3d && rooms3d.get(code3d);
    const p = r && r.get(socket.id);
    if (!p || !d) return;
    p.x = +d.x || 0; p.z = +d.z || 0; p.yaw = +d.yaw || 0;
    p.y = Math.min(11, Math.max(0, +d.y || 0)); // three floors now: ground 0, upstairs 3.7, attic 7.4
    p.t = Math.min(3, Math.max(0, (+d.t || 0) | 0)); // talk level for mouth flaps
    p.pm = (d.pm === 0 || d.pm === 1) ? d.pm : -1;  // which attic mannequin this ghost is wearing
    socket.to('3d:' + code3d).volatile.emit('3d-pos', { id: socket.id, x: p.x, z: p.z, y: p.y, yaw: p.yaw, t: p.t, pm: p.pm });
  });
  socket.on('3d-rtc', ({ to, data }) => {
    const r = code3d && rooms3d.get(code3d);
    if (!r || !to || !data || !r.has(to)) return; // only relay inside the same house
    io.to(to).emit('3d-rtc', { from: socket.id, data });
  });
  socket.on('disconnect', () => {
    const code = code3d;
    const r = code && rooms3d.get(code);
    if (!r || !r.has(socket.id)) return;
    // grace window: a locked phone gets time to come back (mid-round: 45s;
    // walkabout: 8s so leavers don't haunt the lobby as statues)
    const g0 = games3d.get(code);
    const grace = (g0 && g0.phase !== 'over' && g0.alive.has(socket.id)) ? 45000 : 8000;
    const sid = socket.id;
    pending3d.set(sid, setTimeout(() => { pending3d.delete(sid); removePlayer3d(sid, code); }, grace));
  });
});
const pending3d = new Map(); // socket id -> scheduled removal timer
function removePlayer3d(sid, code) {
  const r = rooms3d.get(code);
  if (!r || !r.has(sid)) return;
  r.delete(sid);
  io.to('3d:' + code).emit('3d-left', { id: sid, hostId: [...r.keys()][0] || null });
  const g = games3d.get(code);
  if (g && g.phase !== 'over' && g.alive.has(sid)) {
    g.alive.delete(sid);
    g.votes.delete(sid);
    if (sid === g.imposter) sbWin(code, 'crew');
    else if (!sbCheckWins(code) && g.phase === 'meeting' && g.votes.size >= g.alive.size) sbTally(code);
  }
  if (r.size === 0) {
    rooms3d.delete(code);
    const g2 = games3d.get(code);
    if (g2) {
      clearTimeout(g2.meetingTimer); clearTimeout(g2.overTimer);
      clearTimeout(g2.sabTimer); clearInterval(g2.eventTimer);
      clearInterval(g2.recapTimer);
      if (g2.monster) clearInterval(g2.monster.timer);
      games3d.delete(code);
    }
  }
}

server.listen(PORT, () => console.log(`GIGGLEDOOM lurking on http://localhost:${PORT}`));
