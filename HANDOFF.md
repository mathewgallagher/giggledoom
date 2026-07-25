# GIGGLEDOOM — 3D Rebuild (Three.js) — status doc

If a session ends mid-work, resume from here.
Owner intent (Mathew): graphics at the level of The Texas Chainsaw Massacre game
(reference: youtube.com/watch?v=IUe6GfbmUvs). True photoreal isn't reachable in a
phone browser; agreed path is a Three.js/WebGL rebuild: real 3D textured rooms,
dynamic lights + shadows, 3D characters, keeping ALL existing systems (socket.io
netcode, voice chat, mic-laugh, bots, tasks, cosmetics, coins).

## DONE 2026-07-22 (pass 2) — FULL 8-ROOM MAP "THE GIGGLEHOUSE" (verified, desktop + mobile)
Code now split into 3 modules (all in public/, all must ship together):
- `public/3d.js` — engine: renderer, FP controls (WASD + touch), collision, room
  detection + SNOOPED x/8 counter, ONE roaming shadow PointLight that lerps to the
  current room's key-light spot (color/intensity/pos), speaker-bubble system,
  window.GD3 debug {P, keys, rooms, go(name), freeze}.
- `public/3d-world.js` — buildWorld(): 16 procedural textures, wallRun() wall builder
  (per-room styles both sides, door gaps + lintels + jambs, colliders), floors/ceilings,
  all 8 rooms + props + tickers + speakers + per-room fill lights + flicker functions.
- `public/3d-chars.js` — primitive rigs: ZOOMY, MONSTER (asleep on folding chair, ZZZ
  sprites, breathing), GNOME, TEDDY (glowing eye), SKELETON (party hat, jaw drops),
  DUCK (incl. cursed variant), plus canvasPlane/signPlane helpers.
- `public/lib/three.module.min.js` + `public/lib/three.core.min.js` — Three.js r180
  vendored (NO CDN). BOTH files required or the page silently renders black.

THE ROOMS (each has a key light w/ its own flicker + a talking thing):
- THE DEN (spawn/hub): planks, wainscot, beams, swinging bulb, moon window (west wall),
  crates, table + cheese, rug, duck, EMERGENCY GIGGLE MEETING button (mode foreshadow),
  ZOOMY (8 lines).
- HALL OF PORTRAITS: red damask, carpet runner, candle sconces, 11 procedural ancestor
  portraits whose 3D googly pupils TRACK the player, fake MANAGEMENT door. Speaker: THE PORTRAITS.
- THE NURSERY: duck wallpaper + crayon scribbles, cold blue pulsing light, crib that
  rocks by itself and FREEZES when player within 3.5m, spinning mobile, TEDDY (speaker),
  RUN blocks, giant baby bottle.
- THE MEAT KITCHEN: greasy checker floor, grimy tile walls, buzzing fluoro, fridge w/
  FEED ME magnets (speaker), stove pot of bubbling green goo (emissive + rising bubbles
  + green light), counter + cleaver, sausage chain, hanging rubber chicken, floor vent.
- BATHROOM OF DOOM: green tiles, tub + duck armada + one CURSED black duck that alone
  rotates to face the player, dripping faucet, toilet, dark useless mirror + sign.
- THE DISCO CRYPT: stone walls, glowing disco ball + 3 orbiting colored SpotLights,
  coffins (one upright with amber eyes inside), SKELETON in party hat (speaker),
  jukebox, old confetti, vent.
- THE GNOME YARD: indoor night garden — grass, hedge walls, star/moon ceiling
  (MeshBasic), fireflies, dead tree, 12 gnomes that all slowly rotate to stare at the
  player (staggered speeds), GNORMAN on a throne (speaker).
- THE BASEMENT: dirt floor, concrete, hard-flicker bare bulb, chains, crates, THE
  MONSTER asleep on a tiny folding chair (3 amber eyes, ZZZ, breathing; speaker), break
  table + mug, BACK IN 5 sign, BREAK O CLOCK, SECURITY camera desk w/ 3 static-noise
  monitors (mode foreshadow).
Objective: SNOOP ALL 8 ROOMS → "HOUSE FULLY SNOOPED. YOU LIVE HERE NOW."
Verified: every room screenshot-toured, doorway traversal + wall collision exact,
zero console errors, mobile portrait layout good.

## PLANNED FLAGSHIP MULTIPLAYER MODE (Mathew's ask 2026-07-22): social deduction
"Our version of Among Us" using existing systems — hidden killer(s) among players
(seeker system generalized), tasks (already exist), proximity voice (already exists),
security cameras (desk built), vents (props built), emergency meeting button (built).
Own art/names only, nothing copied from Among Us. Name TBD (working: SNEAKY BASTARD MODE).
Build order: port multiplayer into 3D first, then this mode.

## DECISION MADE: side-by-side "3D beta"
2D game stays the main game at /; 3D lives at /3d.html until feature parity.
Later: add a "3D BETA" button in the 2D lobby linking to /3d.html.

## ALSO DONE 2026-07-22 (2D game, local only)
- Solo-explore wart FIXED: makeTask(p, room) now drops the 'taunt' task
  ("get close to the monster") when room.seekerId is null (solo). server.js:257.

## DONE 2026-07-22 (pass 3) — MULTIPLAYER WALKABOUT in the 3D house (verified, 2 clients)
- server.js: new self-contained `io.on('connection')` block for the 3D beta (events
  3d-join/3d-pos/3d-left, rooms3d Map keyed by house code, 16-player cap, reuses
  sanitizeName). ZERO contact with the 2D game state. Client pos relayed volatile.
- public/3d-net.js: join overlay (name, 4-char picker, house code, WALK ALONE fallback),
  peer manager (rigs + name tags + lerped movement + walk/idle anim), IN THE HOUSE
  counter, 10Hz pos sender (only when moved). Guards for io undefined (static hosting).
- public/3d-chars.js: buildPlayerRig(char) for zoomy/slurp/gremlin/wallfish (distinct
  silhouettes: hare ears+sneakers / pink chonk+tongue / bat ears+gold snaggle+tail /
  dome head+6 wiggling tentacles), shared animateRig (bob, shoulder-pivot arm swing,
  blinks), makeNameTag billboard.
- 3d.html loads /socket.io/socket.io.js (classic script) before the module.
- VERIFIED with two pane tabs: MATHEW (zoomy) + GREMBO (gremlin) in code HOUSE —
  both saw each other's rig + name tag, live position sync (teleport propagated),
  IN THE HOUSE: 2 on both, zero client/server errors.
- DONE same day (pass 4) — PROXIMITY VOICE in 3D:
  - server.js: '3d-rtc' signaling relay (validates target is in the same house) +
    talk-level `t` field on 3d-pos packets.
  - public/3d-voice.js: WebRTC mesh (initiator = lower socket id, STUN only, no TURN),
    auto-connect when peers within 9m / drop beyond 13m (hysteresis), per-peer audio
    graph (MediaStreamSource → lowpass BiquadFilter → GainNode), gain = (1-d/7m)^2,
    wall-muffle via segment-vs-collider raycast (lowpass 520Hz + 0.4x gain when a wall
    blocks the line, doorways stay clear), iOS muted-audio-element workaround, mic
    OPTIONAL (denied = silent ghost, recvonly), own-mic analyser → talk level 0-3.
  - 3d-net.js: MIC LIVE / MIC MUTED / NO MIC (SILENT GHOST) button bottom-right,
    talk level rides pos packets → remote rigs' mouths flap (R.mouth scale).
  - VERIFIED in pane (mic blocked there): both tabs' RTCPeerConnection reached
    "connected" via the relay; mute chip reflects mic state; zero errors.
  - NEEDS MATHEW: real 2-device audio test (like the 2D one). NOTE: mic requires
    HTTPS or localhost — phone-via-LAN-IP over http will NOT get a mic prompt; test
    voice on the deployed Render site (https) or two browsers on the laptop.
- DONE same day (pass 5) — SNEAKY BASTARD MODE v1 (social deduction, fully playable):
  - server.js: games3d state per house. Events: sb-start (host only, 2+ players, random
    imposter, 4 chores each from 8, imposter chores are fake), sb-kill (server validates
    imposter + 2.2m range + 25s cooldown; body recorded), sb-report (3.2m of a body),
    sb-button (must stand at the den panic button), sb-vote (majority ejects, ties skip,
    early tally when all alive voted, 45s timer), sb-task-done (assigned + crew only,
    global progress). Wins: tasks complete / imposter ejected / crew <= 1 / imposter
    disconnects. sb-over reveals the bastard; auto-reset to walkabout 9s later.
  - public/3d-game.js: role banners, chore list HUD + top progress bar, 8 glowing chore
    stations mapped to world props (hold-to-complete), contextual KILL (cooldown label)/
    REPORT/PANIC buttons, meeting overlay w/ vote cards + VOTED marks + skip + result,
    bodies (rig lying at kill spot), death tint + ghost mode (dead hidden from living,
    visible to dead), spectator handling for mid-round joiners, full reset on sb-walk.
  - 3d-voice.js gating: dead are silent to the living, the dead hear everything,
    meetings put all living voices at full volume regardless of distance.
  - VERIFIED end-to-end (browser + headless socket.io-client bots, zero server errors):
    roles/fake chores, task progress, kill via the real KILL button, all four win paths
    (tasks not exercised to 100 percent but accounting verified; kills, ejection,
    both disconnect attritions), panic-button proximity rejection + acceptance,
    meeting + voting + early tally + imposter reveal + auto reset.
  - Polish backlog: body mesh + meeting overlay not visually screenshotted (logic
    verified), name uniqueness per house not enforced (duplicates allowed), cameras
    desk not yet interactive, no vents travel, no sabotages, kill has no animation.
- DONE same day (pass 6) — MEAT PASS (verticality, hideables, mini-games, juice):
  - JUMP + gravity in 3d.js: colliders now carry a `top` height; you can stand on any
    prop with a reachable top (crates, tables, coffins, jukebox, teddy, the sleeping
    monster). Parkour chains via crate stacks. Space / round JUMP button. y syncs over
    the net (3d-pos has y; rigs float at altitude).
  - HIDEABLES (engine-level, work in walkabout AND rounds): hollow props w/ ajar doors,
    HIDE IN / GET OUT button within 1.5m — THE FRIDGE (kitchen), THE WARDROBE (nursery),
    THE STANDING COFFIN (crypt), THE GNOME SHED (yard, gnome on roof). Real geometric
    hiding: others only see you through the door crack. world.hideys drives it.
  - MINI-GAME CHORES (3d-game.js) replace hold-to-complete: mash (tap fast, drains if
    you slack: cheese/gnome/crib), timing (hit the gold zone 3x: flush/clock/portrait),
    sequence (press shown W/A/S/D keys in order, wrong key resets: fridge/coffin).
    On-screen buttons for mobile, keyboard for desktop.
  - COINS: +10 per chore, +30 crew win (crew), +50 bastard win (bastard); persisted in
    localStorage gd3_coins; COINS counter HUD + floaty +N popups. Future: hat shop.
  - SFX (new public/3d-sfx.js, pure WebAudio synth, no files): task blips/jingle, coin,
    jump boing, hide whoosh, kill sting, meeting alarm, win/lose fanfares, fail buzz.
    Camera SHAKE on kills near you and meeting start (GD3.shake).
  - NEW FURNITURE: den sofa + bookshelf, hall grandfather clock (swinging pendulum),
    kitchen prep table + ham, nursery rocking horse (never stops rocking), crypt
    candelabras + bone pile, yard stump, basement shelf rack + boiler.
  - VERIFIED: standing on crate stack at exactly y=1.80, fridge hide in/out + interior
    sightline, mash chore completed → server PROGRESS 1/4, coins awarded + persisted
    (task +10, imposter-win +50), zero console/server errors. Wardrobe/coffin/shed use
    the same pattern as the fridge (visuals unscreenshotted).
- DONE same day (pass 7) — DECOR PASS ("10X the rooms", rated R, filled spaces):
  New shared decor kit in 3d-world.js (put/boxAt/cylAt/sphAt/wallSign/waterJet/dripper/
  cobweb/rat). Per room:
  - DEN: fireplace w/ animated fire + flickering glow light + mantel (climbable) +
    stockings (GARY?/NO), Big Mouth Billy fish plaque (tail goes off randomly),
    LIVE LAUGH LURK + EMPLOYEE OF THE MONTH posters, pizza-box tower, newspaper stacks,
    REGRET JUICE bottles, open bear trap labeled FREE HUGS (STAND HERE), cobwebs.
  - HALL: brass velvet-rope museum barriers, SIR CLOGSWORTH suit of armor holding a
    plunger, DO NOT LICK THE PORTRAITS, one portrait turned backwards (HE KNOWS WHAT
    HE DID), glowing eyes in a wall crack (do not feed the wall).
  - KITCHEN: RUNNING sink (waterJet) + leaking ceiling pipe dripping into bucket,
    two dish towers (one climbable), CREAM OF BEEF can pyramid, garbage pile w/
    orbiting flies, utensil rack, KNOW YOUR MONSTER butcher chart (SNUGGLE/BRISKET/
    REGION OF MYSTERY), DAYS SINCE LAST INCIDENT: -3, GRADE F (FANTASTIC), a RAT
    on patrol.
  - BATHROOM: RUNNING shower (3 jets + wet floor) + tub faucet running, TP pyramid
    to 2.1m (climbable, THE THRONE OF SOFTNESS), plunger collection (THE BOYS),
    open medicine cabinet + spilled LAUGH SUPPRESSANTS (EXPIRED 1997), goo handprints,
    THE DRAIN THING (animated hair creature w/ googly eyes, SPEAKER: "i live here now").
  - NURSERY: JACK-IN-THE-BOX that cranks itself and POPS when you come within 2.2m
    (sting + camera shake, re-arms when you leave), climbable block tower, stuffed
    pile, second teddy facing the corner (HE BIT FIRST), crayon family mural w/ one
    member scribbled out, BABY'S FIRST WORDS: "BEHIND YOU", GERALD growth chart to
    GERALD NOW.
  - CRYPT: DJ BONES (second skeleton, bobbing, SPEAKER) at a real booth w/ spinning
    turntables, TWO speaker stacks to 2.6m that pulse on the beat (climbable),
    flickering CRYPT NITE neon, skull niche shelf (one wears sunglasses), 3 crude
    tombstones (HERE LIES GARY... / RESERVED (FOR YOU) / DO NOT DIG), solo cups.
  - YARD: FOUNTAIN OF THE GNOME KING (stone gnome statue peeing into the basin,
    DO NOT DRINK. HE AIMS.), grill w/ suspicious meat + GNOME ROAST 2026 banner,
    flamingo flock (one down), SCARECROW w/ crow (SPEAKER), bug zapper that flashes,
    firewood pile (climbable), glowing mushroom ring.
  - BASEMENT: pegboard w/ MISSING tool outlines (only a rubber duck hangs), ceiling
    pipes w/ two drips + slowly spinning valve, XMAS/XMAS?/TEETH box stack to 2.6m
    (climbable), paint can pyramid, washer+dryer (washer shakes violently, DO NOT
    OPEN), furnace grate glow, DAYS ON BREAK tally wall, monster family photo
    (MY BOYS), second RAT.
  3 new speakers (DRAIN THING, DJ BONES, SCARECROW). Verified per-room screenshots,
  zero console errors. PERF NOTE: ~300 new meshes, all shadow casters; if low phones
  chug, first lever is turning castShadow off on small decor.
- DONE same day (pass 8) — GAMEPLAY WAVE ("all of the above"):
  - GIGGLE METER (the identity mechanic): fills from loud mic input (talkLevel) AND
    nearby funny events via 'gd-funny' CustomEvents (speaker bubbles, fish plaque,
    jack-in-the-box pop, witnessed kills +0.45). CLENCH button/C key drains it but
    slows you to 60%. At full: forced laugh burst — sb-laugh broadcast, everyone
    within 15m hears synth laugh, mouth flaps, the BASTARD gets a toast naming your
    room. Laugh counts feed round stats.
  - SABOTAGES (imposter, 45s shared cooldown, server-validated): LIGHTS OUT 25s
    (hemisphere+fills+shadow crushed, everyone gets a camera-follow flashlight cone),
    BURST PIPES 30s (flood puddles in kitchen/bath slow movement 45%), JAM DEN DOOR
    15s (plank + temp collider). Crew fixes at FUSES (basement west wall, new prop) or
    boiler VALVE via FIX button (sb-fix, server checks distance). Meetings end sabs.
  - VENTS work (imposter): near any of the 3 vents → VENT button → pick destination →
    teleport, 10s cooldown (client-enforced).
  - BODY DRAGGING (imposter): DRAG/DROP toggle near a corpse; body follows behind,
    synced via sb-drag (server range-checks); stuff bodies into hideables.
  - GHOST HAUNTS: dead players get HAUNT (20s cd, server tracked) — living players
    within 10m get a spook sound + shake + "something moved." toast.
  - SECURITY CAMERAS work: near the basement desk → CAMERAS → view swaps between 3
    fixed vantages (DEN/HALL/YARD) w/ scanline overlay + CAM label; body stays at
    the desk (suspicious by design). NEXT/EXIT buttons.
  - HOUSE EVENTS (server interval 50-75s during rounds): monster SNORE (cover noise
    toast + basement shake) and once per game the GNOME OMEN — every gnome turns
    toward the bastard's position for 2s (world.gnomeOmen). Cryptic tell.
  - SPRINT: shift / RUN button, 1.55x speed, stamina bar drains/regens (engine).
  - AWARDS on game over (server stats): THE BASTARD (kill count), CHORE CHAMPION,
    COULD NOT HOLD IT (laugh bursts), SPEEDRAN DEATH. Rendered under the win banner.
  - HAT SHOP ("THE HAT HOLE", walk phase): party cone 50 / traffic cone 75 / top hat
    100 / propeller 125 (spins) / halo 150 (hovers) / crown 200. Coins spend+persist
    (gd3_hats, gd3_hat), hats render on rigs' heads and sync via 3d-hat event.
  - VERIFIED in pane: hat buy/equip/persist (60→10 coins), camera views + HUD,
    giggle meter fed by jack-in-the-box (0.24), crew sabotage REJECTED server-side,
    lights-out + flashlight visual, zero console/server errors.
  - NEEDS LIVE PLAYTEST (code paths follow validated patterns but weren't driven
    multi-client): vents, body drag sync, haunts, awards render, house events, laugh
    burst end-to-end with real mics.
- DONE same day (pass 9) — SOCIAL/CO-OP WAVE (all six of Mathew's asks):
  1. TWO-PERSON HIDEYS + WHISPER: wardrobe/shed/hot-tub now cap:2 (two slots inX/inZ +
     in2X/in2Z; engine picks the free slot). 3d-voice.js: sharing a hidey = full-clear
     whisper only to your co-hider; muffled (0.25) to/from anyone hidden elsewhere.
     P.hidden.id rides the 3d-pos packet (field `h`).
  2. DUO CHORES: LIFT THE HAM (kitchen) + CRANK THE BOILER (basement) need a 2nd living
     crew within 3.2m. Server SB_DUO validates; client duoBuddyPresent() gates completion
     so local state can't desync. Chore button shows "DUO: ... (needs a buddy)".
  3. THE MONSTER WAKES (co-op, no traitor, works with 1+ players): server AI monster
     with a waypoint graph (MW_NODES/MW_EDGES, BFS pathing through doorways), 250ms tick,
     chases nearest un-hidden living player, 1.3m chomp, LAUGHING lures it (12s, faster).
     Crew wins by finishing all chores; monster wins by eating everyone. Client
     buildWalkMonster() upright striding rig (3d-chars.js), interpolates mw-pos.
     VERIFIED end-to-end solo: monster woke, pathed basement→me, ate me, co-op loss +
     awards fired.
  4. THE HEIST: carry skull/ham/crown (glowing, spin) to the den LOOT CHEST; hand-offs,
     visible on carrier's back, dropped where a carrier dies; 3 delivered = crew win,
     bastard hunts carriers. Server hs-grab/hs-deliver/hs-drop/hs-score (range-checked).
     VERIFIED w/ 2 bots: grabbed skull in crypt, carried to den, delivered → bar 1/3.
  5. THE SNUG: secret room behind the den bookshelf (wall gap at den +x z[-2.2,-1.0]),
     stone room w/ bench, candles, warm light, "members only" sign. Always enterable.
  6. HOUSE LEVELS (shared progression per house code): houseXP earns from chores(+2),
     heist deliveries(+3), round-end(+10). HOUSE_LEVELS thresholds; HUD "HOUSE LVL n".
     Level 2 = fancy gold rug; Level 3 = HOT TUB unlocks in the yard (also a 2-person
     hidey). world.applyHouseLevel(lv). XP is in-memory (resets on server restart).
  Also: mode picker on the lobby (SNEAKY BASTARD / THE MONSTER WAKES / THE HEIST) with
  per-mode min players; awards screen adapts per mode (no bastard line in co-op, TOP
  LOOTER in heist).
  VERIFIED: monster mode full loop, heist grab/carry/deliver, mode picker, house HUD,
  new decor (fountain visible through doorway), zero console/server errors.
  NEEDS LIVE PLAYTEST: whisper audio (mic-gated in pane), duo chores w/ 2 humans,
  full heist win, house level-up crossing a threshold, hot tub unlock.
- DONE same day (pass 10) — CHAOS & COMEDY wave (making the rated-R stuff DYNAMIC):
  - HOUSE CHAOS EVENTS now fire every ~22-40s during any round (was 50-75s, snore-only):
    FART (picks a random living player, spawns a green cloud + floor ping-ring AT their
    spot = loud wet location reveal, nearby giggle spike, crude toast "SOMEBODY RIPPED
    ONE IN THE KITCHEN"), BURP (same, brown), STINK (den cheese turns, sentient-odor
    toast), DISCO (jukebox blasts, whole house hue-throbs 9s via GD3.discoUntil, giggle
    rises), QUAKE (house-wide camera shake + rumble), FLICKER (brief lights-out blip),
    plus the existing SNORE + once-per-game GNOME OMEN. Server picks + broadcasts sb-event;
    client fartCloud()/pingRing()/toasts in 3d-game.js, disco tint in 3d.js.
  - EMOTE WHEEL: EMOTE button + 1-6 hotkeys. WAVE/POINT/ACCUSE/DANCE/FART/ROFL. Emits
    3d-emote (server relays), shows a floating word bubble above the emoter's rig
    (projected via camera). FART emote = real fart cloud + ring + nearby giggle (a
    weapon AND a taunt). DANCE by the jukebox pays a coin. ROFL plays the laugh sfx.
  - New synth SFX: fart, queef, burp, quake rumble, disco beat, record scratch.
  - Denser crude one-liners on THE FRIDGE + THE MONSTER speaker pools (casserole with
    opinions, ate-a-guy-named-kevin, etc). Boundary held: gross/absurd/dark, no slurs.
  - VERIFIED: fart emote fired the giggle hook (+0.25) with zero errors; monster mode
    full loop ran again clean. Cloud/ring visuals are ~2s and the pane's screenshot
    latency keeps missing them, but the code path is confirmed (giggle spike + no errors).
  NEEDS LIVE PLAYTEST: the timed chaos events landing mid-round with humans, emote
  bubbles over other players, disco/quake feel.
- DONE same day (pass 11) — MAP: toggle-able floorplan overlay (MAP button top-center
  + M key), canvas-drawn in 3d-game.js from world.rooms. Shows all 8 rooms to correct
  scale/position + labels, a live cyan "you are here" dot w/ facing wedge, orange
  diamond markers on YOUR chore rooms (labeled, ·2 suffix for duo chores), and the
  heist CHEST marker in heist mode. DELIBERATELY shows NO other players / monster /
  killer — legend says "nobody else is on this map. trust no one." (a live position
  tracker would kill the tension in every mode; task-locator only, Among-Us style).
  Auto-closes on meeting/round-end/reset. VERIFIED in browser: full floorplan renders,
  you-are-here dot correct in the DEN, zero console errors. Task markers draw from
  myTasks during a round (unscreenshotted but same data proven in prior passes).
- NOT YET: classic hide-and-seek (mic-laugh-to-die) variant, ghost chore,
  group photo at awards, name uniqueness.
- DONE 2026-07-23 (pass 12) — THE HOUSE GREW: 3 FLOORS, 15 ROOMS ("make the map
  larger and multiple levels"):
  - ENGINE (3d.js): colliders now carry optional `base` (bottom) so upper-story
    geometry ignores the floor below; blocks()/groundAt() are y-aware; STEP=0.42
    auto step-up (stairs walk like FPS stairs, no jumping) + snap-down glue for
    descending; roomAt(x,z,y) with per-room y0/y1; hideys support y + `crouch`
    (camera drops to 0.45 eye height); CSS vignette + faint scanline grain
    overlay (z-index 5, under HUD); speakers only talk to your floor; GD3.go()
    sets y.
  - WORLD (3d-world.js): wallRun/floorRect/ceilRect take a lift/y param; slab()
    = walkable upper floor collider (base y-0.5). UPSTAIRS at y=3.7 over the
    north wing + den + crypt: THE LANDING (runner, bad-ancestor portraits,
    dead ferns, THE BANNISTER speaker), MASTER BEDCHAMBER (four-poster w/
    breathing lump, UNDER-THE-BED crouch hidey, no-reflection vanity, THE BED
    speaker), LIBRARY OF LIES (book-spine shelf walls, screaming book that
    swells when approached, climbable stacks, spinning globe, A BOOK speaker),
    THE TROPHY ROOM (mounted elk / whole taxidermied gnome "CAUGHT STARING
    2019" / duck "IT QUACKED ONCE" / empty plaque "RESERVED: YOU (SOON)", bear
    rug, PARTICIPATION trophies, empty gun cabinet, MOUNTED ELK speaker),
    THE GAME ROOM (billiards, 2 arcade cabinets w/ GIGGLE INVADERS + blinking
    screen, dartboard, 16-aces card table, casino carpet, 4th VENT, ARCADE
    CABINET speaker), THE OBSERVATORY (star-dome ceiling w/ moon, brass
    telescope, animated orrery, orb pedestal, THE TELESCOPE speaker).
    ATTIC at y=7.4 over the west wing: rafters, labeled box stacks (climbable),
    2 tracking mannequins + THE WALKER (creeps closer only while unwatched,
    shuffles home when you leave — uses GD3.P.yaw), sheet ghost, self-rocking
    chair, STEAMER TRUNK crouch hidey, leaning paintings, THE MANNEQUINS
    speaker. GRAND STAIRCASE in the hall SW corner (solid flight, brass
    banister, guarded stairwell w/ balusters, 6-candle chandelier w/ sway +
    flicker over the open well, fascia; hall ceiling cut). SERVANT STAIRS to
    the attic INSIDE the master bedchamber along its east wall (hole cut in
    master ceiling/attic floor, guards + exit gaps). Moon windows (master W,
    landing E, game room W, attic N tiny) w/ moonlight spill. Dust field now
    covers 0..9.6y w/ 850 motes. rooms[] = 15 entries w/ y0/y1/floorY/lvl;
    return adds stairs[] footprints + levels[] meta; heist.items gains
    orb [12.5, 2.2, 3.7].
  - GAME (3d-game.js): 6 new chores (bed=MAKE THE BED timing, books=RESHELVE
    THE LIES seq, trophy=POLISH THE ELK mash, darts=LOSE AT DARTS timing,
    stars=ALIGN THE STARS seq, sheets=FOLD THE ANGRY SHEETS mash) w/ station
    y + y-gated proximity; 4th vent GAME ROOM (vents teleport sets y); 4th
    security cam LANDING; multi-floor MAP: GROUND/UPSTAIRS/ATTIC tabs,
    auto-opens on your floor, ▲▼ stair markers, chore markers per floor,
    you-dot solid on your floor / hollow "(above)/(below)" otherwise; bodies
    spawn/drag/report at correct y; fart clouds/ping rings/emote bubbles at y;
    heist orb mesh (glowing blue) + baseY item handling + total from server;
    meetings teleport includes y=0; panic/cams/deliver/fixes/duo gated to
    ground floor; kill/report/gd-funny distances are 3D. 3d-net squishes rigs
    flat (scale .28) for peers hidden in underbed/trunk.
  - SERVER (server.js): d3() helper; 3D range checks on kill/report/drag/grab;
    deliver/button/fix/duo-helper require ground (y<1.5); bodies + kills +
    laughs + haunts + emotes + fart events + drops carry y; y clamp 0→11;
    SB_TASKS += 6 new ids; HS_ITEMS[orb]=[12.5,2.2,3.7], heist total =
    item count (4), hs-score sends total; MONSTER can't climb: ignores
    targets/chomps above y 1.8, upstairs laughs don't lure ("he waits").
  - VOICE (3d-voice.js): 3D distance falloff; |dy|>2.2 = blocked (floor
    muffle, 520Hz lowpass).
  - 3d.html: objective text now "SNOOP ALL 15 ROOMS. YES, FIFTEEN NOW."
  - VERIFIED (pane, freeze-teleport + screenshots, zero console/server
    errors): all 7 new rooms toured; WALKED the grand stairs bottom→top
    (y profile exact) and master→attic flight (arrived THE ATTIC, snoop
    counter 8/15→ticking); under-bed hide (floor-slit crouch view + THE BED
    line fired); multi-floor map w/ correct dot/stairs; mannequins already
    face you on arrival. Bot test (scratchpad gd-orb-test.js): ground grab
    under orb REJECTED, upstairs grab OK, deliver-from-above REJECTED,
    ground deliver 1/4 w/ total 4. NEEDS LIVE MULTI-DEVICE PLAYTEST: rounds
    with upstairs chores, vent-to-upstairs flow, body drag across floors,
    voice floor-muffle feel, walker mannequin with a real second player.
  - LAYOUT NOTE for future edits: grand stairwell hole in the LANDING floor =
    x[-12.9,-8.5] z[-6.7,-5]; attic hatch hole = x[-4.6,-3.05] z[-13.55,-10.45]
    (in MASTER ceiling + attic floor). Slabs are per-room; cut new holes by
    splitting the floorRect+slab pair, never by deleting a whole room slab.
    First attic-stair placement (landing west end) DEADLOCKED the landing NW
    corner against the grand-stair exit — that's why the attic stairs live in
    the bedroom. Check exit paths against BOTH stair footprints before moving
    either.

- DONE 2026-07-23 (pass 13) — THE JUICE PASS ("improve graphics + gameplay feeling,
  do all of the above"):
  - GRAPHICS:
    - BLOOM: vendored three postprocessing (public/lib/postprocessing/ +
      public/lib/shaders/, three upgraded r180→0.185.1 — BOTH lib builds
      replaced). Composer chain RenderPass→UnrealBloomPass(480px, str .5,
      thresh .8)→OutputPass in 3d.js. Every emissive glows (moon, neon,
      arcade screens, monster eyes, orrery sun, chandelier flames).
    - POTATO MODE: fps sampled after 8s; under 42fps → bloom off + pixelRatio
      1.25 + a toast. One-way, per-session.
    - NORMAL MAPS: Sobel over each procedural texture's own luminance,
      cached per source (normalFor() in 3d-world.js), wired into mat() —
      walls/floors catch the roaming light dimensionally.
    - CONTACT SHADOWS: blobUnder() in put() — bbox-fitted radial-gradient
      blob under every prop whose bottom sits within 0.14 of a floor
      (0/3.7/7.4). Peer rigs get one in 3d-net (rigBlob()).
    - MOON GOBOS: SpotLight w/ 4-pane cookie at every moonWindow() —
      real moonlight patches on the floorboards.
    - PER-ROOM FOG: ROOM_FOG table in 3d.js, color+density crossfade
      (kitchen sickly green, nursery cold blue, attic chewable dust...).
  - FEEL:
    - FOOTSTEPS: own steps ride the bob cycle, surface per room (SURF table:
      wood/tile/stone/dirt/grass/carpet), sprint louder; wood has creak
      chance (attic 22%), rare LOUD board bumps nearby giggle meters.
    - CEILING CREAKS (the flagship): peers walking ONE FLOOR ABOVE you are
      audible as low creak-thumps (3d-net step loop: dy 2..5.4, dh<7);
      same-floor steps positional, below-floor muffled thuds. A whole new
      information layer for social deduction.
    - MOVEMENT: velocity inertia (accel 13/decel 17), landing camera dip +
      thump sfx + vibration scaled by fall speed, sprint FOV kick (72→78),
      strafe camera roll, footstep cadence follows real speed.
    - AUDIO BUS: 3d-sfx.js rebuilt — master→dry+convolver(generated 1.4s IR),
      per-room wetness (sfx.setVerb, ROOM_VERB in 3d.js); ROOM-TONE AMBIENCE
      loops (basement hum, crypt/observatory drone, attic/yard wind, nursery
      self-playing music box, default house breath) crossfaded via
      sfx.ambience() every frame.
    - GIGGLE SCREEN FX: GD3.giggleFx (set by 3d-game) wobbles camera roll+
      pitch above 0.6, snorts above 0.75.
    - DOORS: 8 hinged creaky leaves (hall→nursery/kitchen/bath, den→basement,
      landing→master/library/trophy, game↔observatory). Swing open for anyone
      near (self + peers via GD3.net.peers), rest ajar, no colliders ever —
      pure sightline+sound. doorCreak/doorShut sfx w/ distance volume.
    - KILL JUICE: white flash frame (dist-scaled), killer lunge shake +
      haptic, feather burst + exactly one tooth at the kill spot, victim
      big flash + vibration pattern; chore-complete haptic.
    - BODY PHYSICS: corpses spawn with knockback velocity + spin; client sim
      (simBodies in 3d-game) with gravity, wall bounce, bounce-per-step
      thumps — bodies ROLL DOWN THE STAIRS. Sim stops on drag/sb-drag or
      after 4.2s (wall-clock: in the rAF-starved pane a body can freeze
      mid-air — real browsers are fine).
    - HE LEARNED THE STAIRS: MW graph got [x,z,y] nodes (stairB/stairT +
      6 upstairs rooms + door nodes), monster y interpolates along paths,
      chomp is |dy|<1.6. Gated on house level >= MW_STAIR_LEVEL (5; env
      GD_STAIR_LVL overrides for testing). Round-start announcement
      sb-event {kind:'stairs'} → "HE LEARNED THE STAIRS." toast + sting.
      Attic (y>5.5) remains his blind spot; laugh-lure works on any floor
      he can reach. Upstairs laughs don't lure a stair-less monster.
  - VERIFIED (pane, zero console/server errors): door swings open on
    approach (nursery door screenshot), damask/plank normal maps visibly
    catch light, gobo moonlight grid on master floorboards, bloom on moon/
    sconces/monster eyes, upstairs chores dealt into rounds (MAKE THE BED /
    POLISH THE ELK / RESHELVE THE LIES on HUD). Bot-verified: staircase
    kill spawns tumbling body (gd-tumble-test.js — browser host emitStart,
    bots kill mid-flight); monster stair test on :3117 w/ GD_STAIR_LVL=1
    (gd-monster-stairs-test.js): stairs toast fired, mw-pos y hit 3.70,
    bot eaten upstairs — all PASS.
  - NEEDS LIVE PLAYTEST (audio is pane-blind): footstep/creak mix levels,
    ceiling-creak volume curve, ambience loudness, reverb wetness, door
    creak spam in crowded lobbies, giggle wobble intensity, bloom strength
    on real phones (potato mode should catch weak ones).
  - PERF NOTE: +4 gobo spotlights joined the forward-light loop and normal
    maps double texture samplers — if real phones chug even in potato mode,
    next levers: drop gobo spots to 2, normalScale 0 on walls (keep floors),
    merge static room geometry (never attempted, big refactor).

- DONE 2026-07-24 (pass 14) — LAUNCH-READINESS PASS (Mathew: "do all of these",
  items 4-10 of the improvement list):
  - FRONT DOOR: `/` now serves 3d.html, `/classic` serves the 2D game
    (routes in server.js before static). 2D home got a big "ENTER THE 3D
    GIGGLEHOUSE" button; 3D join card links to /classic.
  - RELIABILITY: socket.io connectionStateRecovery (90s) — a locked phone
    resumes with the same socket id; connection-handler restores code3d from
    socket.data and cancels the pending removal. Disconnects now get a GRACE
    WINDOW (45s mid-round / 8s walkabout) via pending3d + removePlayer3d()
    instead of instant attrition. Client shows RECONNECTING overlay; expired
    sessions reload clean. DUPLICATE NAMES get ·2/·3 suffixes (bot-verified:
    BLOB + BLOB·2). HOUSE XP persists to housexp.json (debounced write,
    gitignored; survives restarts, not redeploys).
  - STEREO PANNING: tone()/noise() take pan; sfx.listener fed by the engine
    each frame + sfx.panTo(x,z) (right vector = (cos yaw, -sin yaw)). Panned:
    peer steps/ceiling creaks, doors, kills, laughs, haunts, farts/burps,
    body-tumble thumps. VOICE: per-peer StereoPanner (centered in meetings/
    when dead) + shared generated-IR convolver (wet 0.12) in 3d-voice.
  - ROUND VARIETY: heist items each have 3 candidate spawn spots (random per
    round); chore pool = random 10 of 16 per night; TONIGHT'S HOUSE RULE in
    sb-begin (3/8 nights normal): PEA SOUP (fog x2), ZOOMIES (speed 1.15),
    CREAKY BONES (creak x4), BLOOD MOON (dim red hemi), PAYDAY (coins x2) —
    client applies via GD3.fogMult/speedMult/creakMult/bloodmoon + award()
    doubling; toast announces; resetAll clears. Verified live: CREAKY BONES
    toast delivered to all clients.
  - MURDER MAP: server samples villain (imposter or monster) pos every 2s
    into g.recap.path (cap 400) + kill spots; ships in sb-over. Client
    drawRecap() renders GROUND + UPSTAIRS mini floorplans under the awards:
    red route, ✕ kills, ● start (attic events fold into the upstairs panel).
    BUG FIXED during verify: drawRecap must run AFTER the awards render
    (sbAwards is created lazily) — call sits at the END of the sb-over
    handler now. Verified on-screen with a real round.
  - GHOST AFTERLIFE: dead crew keep their chore list and their completions
    COUNT (server drops the alive check on sb-task-done; imposter still
    excluded; duo helpers must be living). choreScanTick() extracted and
    shared by living + ghost tick paths. SPOOK KIT (10s shared cd,
    sb-spook relay, dead only): FLICKER THE LIGHTS (house-wide 500ms),
    COLD SPOT (9m spook+shake+toast), SLAM A DOOR (world.slamDoor whips the
    nearest door open then bangs it shut). MANNEQUIN POSSESSION: dead player
    near an attic mannequin gets POSSESS — camera into the mannequin (own
    mesh hidden locally), slow clamped-to-attic movement, `pm` field on
    3d-pos relays it; other clients drive world.mannequins[pm] from the
    ghost's position (tracking ticker skips possessed ones). All verified:
    spooks relayed to bots, pm broadcast seen, ghost chores counted 3/16,
    possession first-person screenshotted.
  - CHARACTER GLOW-UP: per-char walk personality in animateRig (zoomy
    bounces f10, slurp waddles + R.waddle applied over the net lean,
    gremlin skitters f12.5 big arms, wallfish glides + wigglier tentacles);
    EYEBROWS per char (gremlin angry, slurp worried, zoomy keen); 4 new
    hats: PLUNGER 90 / VIKING HORNS 140 / CHEF TOQUE 175 / GNOME CAP 250.
  - Files touched: server.js, 3d.js, 3d-world.js, 3d-game.js, 3d-net.js,
    3d-voice.js, 3d-sfx.js, 3d-chars.js, index.html, .gitignore. No new
    files (housexp.json is runtime-generated).
  - NEEDS LIVE PLAYTEST: phone-lock reconnect on a real device, voice pan/
    reverb feel, possession scare factor with real victims, house-rule
    balance, ghost chore etiquette.

- DONE 2026-07-24 (pass 15) — THE BEAUTY PASS (all 9 approved items, both stages,
  everything verified on-screen with zero console/server errors):
  - STAGE A (rendering/materials):
    1. MSAA REGRESSION FIXED: composer now gets a multisampled target —
       `new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType })`
       then `composer.setSize(...)` right after construction (constructor treats a
       passed target's dims as logical px — build at 1x1 and size it properly).
       EffectComposer.setSize preserves `samples`, so resize is safe. POTATO path:
       samples=0 on BOTH renderTargets + `.dispose()` (forces FBO rebuild without
       MSAA), `composer.setPixelRatio(1.25 cap)` so the internal buffers actually
       shrink (they never did before), and `world.potato()` (see item 7). Verified
       live: samples 4 on both buffers, runtime 0↔4 A/B toggle renders clean.
    2. ROUGHNESS MAPS: roughFor(srcTex) in 3d-world.js, cached per source like
       normalFor — wear = inverse luminance (bright worn wood goes shiny) + 7
       large radial blotches (55% shiny scuffs / 45% matte dust). Wired into mat()
       as material.roughnessMap (roughness stays the multiplier; GREEN channel is
       what three samples). plankTex got a size param (default 1024 — den/pale/
       hall/attic floors), checkerTex + bathTileTex bumped to 1024. Floors now
       show worn shiny paths under the roaming light.
    3. FAKE AO SKIRTS in facePiece(): every floor-touching span gets a 0.55m
       gradient strip lying on the floor (dark edge at the wall) and every
       ceiling-reaching span (lintels too) gets a 0.42m corner strip. One shared
       16x64 gradient tex, renderOrder 1, depthWrite false — blob-shadow pattern.
       IMPORTANT: strips are added AFTER facePiece's shadow traverse so they never
       cast/receive (a transparent plane casting a solid shadow is a bad time).
    4. GEOMETRY DIGNITY: vendored lib/geometries/RoundedBoxGeometry.js (imports
       'three' — the 3d.html importmap resolves it; SHIP LIST GREW, re-upload the
       whole lib/ folder). rbox(w,h,d,r) helper clamps radius to 45% of the
       smallest dim; rboxAt() joins boxAt. ~27 meshes swapped: sofa (6 pieces),
       fridge door, both lying coffins, upright-coffin lid, wardrobe doors,
       grandfather-clock body, prep-table top, steamer trunk body+lid, four-poster
       (deck/mattress/pillows/breathing lump), billiards felt+frame, both arcade
       cabinets. CROWN MOLDING (rounded strip 0.1x0.14 at H-0.08) rings den, hall,
       landing, master — hall runs skip the grand-stair void (west of x -8.5 /
       south of z -6.7), master's east wall splits around the attic hatch.
    5. COLOR GRADE: gradePass (ShaderPass, uniforms contrast/saturation/tint)
       between bloom and OutputPass. ROOM_GRADE table lerped in tick exactly like
       ROOM_FOG (kitchen grease-green desat, attic sepia, crypt oversaturated,
       basement crushed amber...). BLOOD MOON now goes through the grade
       (BLOOD_GRADE [1.16, .62, 0xff9a86]); the old red hemi hack was replaced
       with a neutral dim (0x565055) — red comes from the grade. GD3.grade +
       GD3.composer exposed for debugging. Verified: uniforms lerp per room on
       screen, blood moon A/B screenshotted.
  - STAGE B (life + UI):
    6. REACTIVE FACES: buildPlayerRig keeps refs now (R.brows w/ baseline pos/rot
       in userData, eye.userData.lid replaces the old scale-memory hack — slurp
       lids survive expressions). animateRig reads R.fear (0..1), R.talk (0..3),
       R.dead: fear pops eye scale +50% / raises+flattens brows / shrinks pupils;
       talk narrows pupils; dead = half-lidded eyes, drooped sad brows, dull
       pupils. 3d-net feeds rig fields from wire state each frame (pr.tk,
       pr.dead, pr.fearUntil w/ 2.6s decay); 3d-game's sb-kill handler sets
       fearUntil on every living rig within 8m of the kill. No new netcode.
       BOT-VERIFIED: FACEBOT gremlin screenshotted in all three states.
    7. PRACTICALS + HERO SHADOWS: flameGlow() additive sprites (shared 64px
       radial tex, flicker ticker) on hall sconces (4), crypt candelabras (6),
       stairwell chandelier (6), den fireplace mouth (1 big); 9 ember sprites
       rise and die inside the den firebox; green arcGlow PointLight stutters at
       the arcade cabinets. HERO SHADOWS: heroShadow() upgraded the existing den
       fireplace fglow + stairwell chLight to castShadow w/ 512 maps (crate
       stacks throw real dancing shadows now). Refs live in world.heroLights;
       world.potato() strips castShadow at runtime — 3d.js potato calls it.
    8. WINDOW PARALLAX: moonWindow() rebuilt — four stacked layers (starsOnly
       opaque at z-0.06, moon disc -0.048, drifting clouds -0.036 w/ slow
       UV-scroll, bare recursive-branch tree -0.022) whose texture offsets slide
       with the viewer (ticker: window-local eye pos, gains .02/.07/.11/.2 —
       tree moves most). Clamp wrapping on moon/tree, repeat on stars/clouds.
       Applies to all 4 upstairs windows AND the den west window (old flat-glass
       den window block replaced; its moonWindow call lives with the upstairs
       calls because darkM doesn't exist yet at the old site — TDZ). Verified:
       two-angle A/B shows moon sliding behind the frame bar, tree shifting
       independently.
    9. UI SKIN: public/fonts/SpecialElite.woff2 vendored (OFL, 61KB, no CDN;
       SHIP LIST GREW — new fonts/ folder). @font-face in 3d.html; Special Elite
       on the HUD title, objective bar, speaker bubbles, join-card h1, ENTER
       button, role banner, game-over banner, meeting h2, map h3, START ROUND.
       Wood-gradient + brass-border + inset-highlight treatment on .gdCtl, .sbBtn,
       join card, meeting card, map card (#gdJoin/#sbStart are brass). M-map and
       MURDER MAP draw on parchment() (mottled stains + scorched edge vignette)
       with re-inked colors (ink-brown rooms/labels, teal you-dot, dried-blood
       route/kill marks). Verified on-screen.
  - VERIFIED on :3057 (another session's server squatted :3007 — added a
    "giggledoom-3057" launch.json config in the concierge project: env PORT=3057).
    Full screenshot tour, MSAA A/B, blood-moon A/B, parallax A/B, parchment map,
    bot face test. Zero console/server errors throughout.
  - NEEDS LIVE PLAYTEST: hero-shadow fps on real phones (potato strips them),
    flame-sprite density taste check, parallax feel while walking (pane can't
    walk), Special Elite readability on small screens, fear-face visibility in
    real kill chaos.
DECIDED AGAINST (for now): full toon-shader/outline rebrand — revisit only after
   real playtests.

## SHIP LIST — Mathew uploads to GitHub (web upload), Render auto-deploys ~3min
1. `server.js` → repo ROOT (solo explore + taunt fix + 3D walkabout events)
2. `public/client.js` → INTO public/ (solo explore client)
3. `public/3d.html`, `public/3d.js`, `public/3d-world.js`, `public/3d-chars.js`,
   `public/3d-net.js`, `public/3d-voice.js`, `public/3d-game.js`, `public/3d-sfx.js` → INTO public/
4. `public/lib/` → INTO public/ (drag the WHOLE lib folder; the GitHub uploader keeps
   folder structure). AS OF PASS 13 lib is BIGGER: both `three*.min.js` files were
   REPLACED (upgraded to 0.185.1) and there are two NEW subfolders,
   `lib/postprocessing/` (7 files) and `lib/shaders/` (3 files) — bloom dies without
   them and the page won't boot (import errors). AS OF PASS 15 there is a THIRD new
   subfolder, `lib/geometries/` (RoundedBoxGeometry.js) — the world won't build
   without it. Re-upload the whole folder.
5. `public/fonts/` → INTO public/ (NEW IN PASS 15: SpecialElite.woff2 — the UI face;
   page still works without it, just falls back to Courier).
Then the 3D beta is live at giggledoom.onrender.com/3d.html (unlinked page).
package.json now lists `three` as a dep — NOT needed by the server; uploading it is
optional/harmless.

## Next 3D milestones (port order proposal)
1. Multiplayer: drive the 3D scene from existing socket.io pos packets (other players
   as ZOOMY-style rigs per character, monster rig already built)
2. Hiding spots + interaction, minimap, HUD port (health/stamina TCM-style bars)
3. Voice chat + mic-laugh (unchanged netcode, positional audio from 3D distances)
4. Bots + tasks + cosmetics (hats as attachments on head group)
5. SNEAKY BASTARD MODE (social deduction): hidden killer role, camera desk usable,
   meeting button callable, task list, voting UI

## Gotchas for a fresh session
- Browser pane STARVES requestAnimationFrame: frames only advance during screenshot
  captures. Movement/timers look frozen — NOT a game bug; real browsers are fine.
  Drive tests via window.GD3 teleports + repeated screenshots.
- Pane blocks mic (2D game): `G.mic.ok=true; updateMicGate()` bypass.
- Local server: launch.json config "giggledoom" (or `node ~/Desktop/giggledoom/server.js`).
  A STALE node process from a crashed session can squat :3007 AND carry a macOS TCC
  file-permission block (EPERM on every request → 500s). Fix: kill it, start fresh.
- GitHub upload: frontend files must go INSIDE the public folder (repo root copies
  of old files still sit there; harmless, pending cleanup).
- sh() in art.js must return HEX (rgb() strings break rgba()) — 2D game only.
