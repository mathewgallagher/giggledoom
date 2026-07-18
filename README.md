# GIGGLEDOOM 👹

Multiplayer hide and seek for phones, up to **16 players**. One player becomes a randomly
generated monster (GRUNTILDA THE MILDLY DAMP, HONKLORD ESQUIRE, etc.) that hunts everyone
else through a 7-room house. Your microphone is live the whole round. If you laugh and the
monster is close enough, you die instantly.

**Rated R.** The game curses, your character randomly yells things like "who the FUCK smells
like cheese?" out loud through your phone, and the After Dark toggle makes it filthier.
This is a personal side project, unrelated to any company.

## Run it

```bash
cd giggledoom
npm install
npm start
```

Game runs at http://localhost:3007

## Get a link your friends can open on their phones

The mic only works over HTTPS (or localhost), so use a tunnel or a real deploy.

**Fastest (game night, no account):**
```bash
npm start
# in a second terminal:
npx localtunnel --port 3007
```
Send everyone the https URL it prints.

**Permanent (free tier):** deploy to Render / Railway / Fly.
- Build command: `npm install`
- Start command: `node server.js`
- It respects the `PORT` env var automatically.

## The house

Seven rooms, each with its own hiding objects (28 total): THE KITCHEN (fridge, giant cheese
wheel, trash, pizza boxes), THE LIVING ROOM (couch cushions, behind the TV, fake plant, teddy
pile), THE BEDROOM (under the bed, closet, laundry chair, shoe pile), THE GARAGE (under the
car, tire fort, boxes of your ex's stuff, toolbox), THE BASEMENT (cobwebs, wine rack, creepy
mannequins, dad's band gear), THE BATHROOM (tub, shower, the toilet, TP fort), and THE
BACKYARD (bush, murder tent, grill, sunflowers). Small spots are LIL GREMLIN only.

## How to play

- Create a lobby, share the invite link (room code baked in). 2 to 16 players.
- Characters: 🐇 ZOOMY (fast, loud), 🐖 BIG SLURP (silent, spherical, spots jiggle),
  👺 LIL GREMLIN (tiny spots + squeaky decoy), 🦑 WALLFISH (wall camo).
- Modes: CLASSIC HUNT, SPEED DEMON, HAIR TRIGGER (ultra-sensitive mic), MIDNIGHT MODE.
- 🔞 AFTER DARK: filthier monster taunts, filthier quips, two cursed hats in the store.
- Mic is hot all round: talking pings, laughing near the monster kills you.
- **Your character snitches**: every few seconds a random hider's character says something
  out loud (fart accusations, queef inquiries, GOT DAYUM, old sayings) and it pings your
  location. Pray it isn't you.
- **Chaos events** every ~30s: somebody audibly farts (location revealed), somebody visibly
  smells like cheese, lights out, earthquake (every spot jiggles), mandatory disco.
- **Hider tasks** while you hide: slap a specific object, loiter in a room, keep total
  silence 20s, get close to the monster and survive, collect shinies. Each pays +2🪙 and
  +1⚡ juice.
- **Boosts** (cost 1⚡ each): 🏃 ZOOMIES speed burst, 🫥 GHOST PEPPER invisibility,
  🤐 DUCT TAPE mic immunity.
- Monster checks hiding spots. Empty = fart + stun. Occupied = you're soup. Caught players
  become ghosts who can HAUNT survivors.
- Round winner picks a cheat perk (silent shoes, smoke bomb, body double, monster snack).
  Top 3 earn coins. New random monster each round.
- **DRIP STORE**: hats (do nothing, are everything) + PERMANENT UPGRADES that persist on
  your phone: 🏋️ GYM RAT (+speed), 🧘 HOT YOGA (smaller body), 😐 POKER FACE (more
  forgiving laugh detector), 🤑 CAPITALISM (+1 coin per task).

## Secrets, easter eggs, and two-person hiding

- **Two-person spots** (couch, under the bed, closet, tub, shower, car, murder tent) fit two
  friends at once so you can hide together and try not to crack up. The catch: if the monster
  checks that spot, EVERYONE crammed in there gets busted at the same time.
- **Secret hiding spots** (loose floorboard, hidden wall nook, behind the water heater, hollow
  garden gnome, deep freezer) are invisible until you wander close and discover them. First
  discovery pays coins and counts toward your secrets-found tally.
- **Easter eggs** to bonk around the map: a rubber duck, a "DO NOT PRESS" button (it triggers
  chaos, obviously), a cursed painting, a haunted jukebox, a garlic shrine, an ancient phone.
  First find of each pays coins.

## The world (first person)

You move through a real 7-room house in first person: a textured floor that slides under you
as you walk (so you can always tell you're moving), walls colored per room (wood kitchen,
purple living room, teal bathroom, etc.) with baseboards and crown molding, and furniture in
every room so nothing feels empty. A tag in the top-left always shows which room you're in and
which way you're facing, and the minimap shows a facing wedge.

## Voice, the mic, and the noise rules

- **Proximity voice chat is built in** (R.E.P.O. style). Your live voice comes out of your
  character: friends near you hear you clearly, far away you fade out, and through a wall you
  sound muffled. The monster hunts by listening for whispers and giggles. Voice is peer-to-peer
  between the players in your room only — never recorded, never stored, never touches the server.
  Dead players' voices can't be heard by the living (ghosts hear everyone).
- **The mic is mandatory the entire time.** A full-screen "MIC REQUIRED" gate blocks play until
  it's allowed.
- **Only laughing gets you caught.** Talking and whispering carry as voice (so the monster can
  hear you), but the game itself only punishes an actual laugh near the monster.
- **Your character's face is live**: its mouth flaps when you talk and flies open with tears
  when you laugh, visible to anyone looking at you.
- Note: voice uses direct peer-to-peer connections (STUN). On some very restrictive networks a
  pair of players may fail to connect voice; the game still works, they just won't hear each
  other. Keep a group call as backup for that rare case.

## The comedy: room bots

Instead of a chaotic wall of voices, each room has ONE resident "bot" — a floating, glowing,
horned creep (the GREASE GOBLIN in the kitchen, BASEMENT BILL downstairs, THE THING UNDER in
the bedroom, etc.). You only ever hear the bot in the room you're standing in, so it's never
overwhelming. They talk to you (and sometimes name your friends) with dark, scary, deeply
out-of-pocket lines designed to make you crack. The monster still throws the occasional global
taunt, and cursed bodily-noise events (fart/queef/moan/burp) still fire, but less often.

Note: it's vulgar, gross-out, and genuinely edgy, but it does not include racist or homophobic
material or slurs — names spoken aloud are still filtered for those.

## Character leveling + the LOCKER

- Every character (ZOOMY / BIG SLURP / LIL GREMLIN / WALLFISH) earns its own XP whenever you
  play it. Surviving and placing top 3 pay bonus XP.
- The four characters are hand-drawn, animated creatures (not emoji): ZOOMY the twitchy
  antenna speedster in clown sneakers, BIG SLURP the smug pink chonk, LIL GREMLIN the
  goblin, and WALLFISH the wall-crawling squid. They walk, bob, and blink.
- Leveling a character unlocks, for THAT character: **skins** (color recolors like Toxic,
  Bubblegum, Gold Rush, Demon, Void, Ghost, Shadow), held **props** (magic wand, tiny sword,
  flames), and **auras** (gold, toxic, royal, fire, rainbow particle trails). Mix and match
  in the LOCKER, which shows a live animated preview of your character.
- 18+ cosmetics (wands and worse) are hidden behind a "I am 18+" toggle in the locker.
- Your total XP is your ACCOUNT LEVEL, which unlocks the seeker's toys.

## Seeker upgrades

When you're the monster, unlocked by account level:
- 🔦 **FLASHLIGHT** (always): trade your wide dim vision for a long bright beam cone in the
  direction you're facing. See far, but only ahead.
- 🌫️ **LURK** (acct lvl 1): go near-invisible to hiders for 5s. No roar arrow points at you.
  Sneak up and grab someone.
- 🎭 **DISGUISE** (acct lvl 2): for 8s you appear to hiders as a random innocent hider with a
  fake name (CHAD, KAREN...). Walk right up to your friends and betray them.

## Gamertag trash talk

The auto-quips now name names. A random hider's character will yell things like "I can hear
{friend} sweating from here" or "{monster} is gonna eat {friend} first and honestly? deserved"
— using the real gamertags in the room, spoken aloud. Because names are spoken, they're run
through a slur/contact-info filter and replaced with a goofy fallback (MYSTERY MEAT, DAMP
LARRY) if they trip it.

## Is it safe / what's protected

- The in-game mic is analyzed **locally in your browser** for loudness only. Audio is never
  recorded, stored, or sent to other players or any server.
- No accounts, no logins, no personal data collected. Coins, cosmetics, and levels live only
  in each player's own browser (localStorage). Rooms are in-memory and vanish when empty, so
  there's essentially no data to breach.
- Anyone with the link + 4-char room code can join, so **keep the link inside your group** —
  don't post it publicly. There's no age verification beyond a self-attested 18+ checkbox and
  the host's AFTER DARK toggle, so only play the adult stuff with adults you know.
- If you deploy it to a public host, check that host's acceptable-use policy about adult
  content, and consider that a fully public URL has no rate limiting (fine for friends,
  not meant to be a public service).

## Notes

- No mic permission = CHICKEN MODE: you cluck randomly and everyone hears it. Allow the mic.
- Voice chat isn't built in; run a group FaceTime/Discord on the side. The in-game mic is only
  the laugh snitch, it never transmits your audio to other players.
- Rooms vanish when the last player leaves. Nothing is stored server-side; coins, hats, and
  upgrades live in each player's own browser.
