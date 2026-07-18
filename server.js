// GIGGLEDOOM server. Rooms, rounds, seeker rotation, laugh judgment, quips, chaos events, tasks.
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server);
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
function makeTask(p) {
  const type = rand(['touch', 'camp', 'silence', 'taunt', 'loot']);
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
  p.task = makeTask(p);
  io.to(p.id).emit('task', p.task);
}

function startRound(room) {
  if (room.players.size < 2) { msg(room, 'Need at least 2 goblins to start.'); return; }
  room.round++;
  const all = [...room.players.values()];
  let candidates = all.filter(p => !p.beenSeeker);
  if (candidates.length === 0) { all.forEach(p => (p.beenSeeker = false)); candidates = all; }
  const seeker = rand(candidates);
  seeker.beenSeeker = true;
  room.seekerId = seeker.id;
  room.monsterName = `${rand(MONSTER_FIRST)} ${rand(MONSTER_LAST)}`;
  room.caughtOrder = [];
  room.winnerId = null;
  room.tickN = 0;
  all.forEach(p => { p.caught = false; p.late = false; p.spot = null; p.taskSeq = 0; p.task = null; p.lastTaskAt = 0; });
  room.phase = 'hiding';
  room.timeLeft = MODES[room.mode].hideTime;
  sync(room);
  msg(room, `ROUND ${room.round}: ${seeker.name} has transformed into ${room.monsterName}. HIDE, IDIOTS.`);
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
    if (n % 12 === 0) io.to(room.code).emit('roar');
    if (n % 13 === 6) {
      const pool = room.afterDark ? TAUNTS_DARK.concat(TAUNTS) : TAUNTS;
      io.to(room.code).emit('taunt', { text: rand(pool) });
    }
    if (n % 8 === 3) {
      const hiders = alive(room);
      if (hiders.length) {
        const p = rand(hiders);
        io.to(room.code).emit('quip', { id: p.id, name: p.name, text: resolveQuip(room, p) });
        io.to(room.code).emit('ping', { x: p.x, y: p.y, kind: 'quip', id: p.id });
      }
    }
    if (n % 30 === 17) fireEvent(room);
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
      dg: d.dg || null, dgn: (d.dgn || '').slice(0, 14), lurk: !!d.lurk, caught: me.caught,
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

server.listen(PORT, () => console.log(`GIGGLEDOOM lurking on http://localhost:${PORT}`));
