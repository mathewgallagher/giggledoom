# Putting GIGGLEDOOM on a permanent link

Goal: one link like `https://giggledoom.onrender.com` that works anytime, from
anywhere, with your Mac off. The code is already committed to a local git repo and
includes `render.yaml`, so a host can configure itself automatically.

Everything below is free and needs no credit card. Your only job is two quick
signups (GitHub + Render). I can walk you through each screen live if you tell me
when you're on it.

## Step 1 — Get the code onto GitHub (the code's home base)

**Easiest, no terminal:**
1. Go to https://github.com and make a free account (or log in).
2. Click the **+** (top right) → **New repository**.
3. Name it `giggledoom`, leave it **Public**, click **Create repository**.
4. On the next page click the link **"uploading an existing file"**.
5. In Finder open the `giggledoom` folder. Select these and drag them into the
   browser: `server.js`, `package.json`, `package-lock.json`, `render.yaml`,
   `README.md`, `.gitignore`, and the whole `public` folder.
   **Do NOT upload `node_modules`** (it's huge and rebuilds automatically).
6. Click **Commit changes**.

## Step 2 — Deploy on Render (the thing that runs it 24/7)

1. Go to https://render.com and **Sign up with GitHub** (one click, links the two).
2. Click **New +** → **Blueprint**.
3. Pick your `giggledoom` repo. Render reads `render.yaml` and fills everything in.
4. Click **Apply** / **Create**. Wait ~2-3 minutes for the first build.
5. When it's live you'll get a URL like `https://giggledoom.onrender.com`.
   **That's the link you send your friends.**

## How your friends join

Send them the URL. They open it on their phone, type a name, allow the mic, and
either create a lobby or punch in your 4-letter room code. Up to 16 players.

## Good to know

- **Free tier sleeps.** After ~15 minutes with nobody on it, Render puts the app to
  sleep. The next person to open the link waits ~30-60 seconds while it wakes up,
  then it's instant for everyone. While people are playing it never sleeps.
- **Mic needs HTTPS** — Render gives you https automatically, so laugh detection
  works (unlike a plain local link).
- **Nothing is stored.** Rooms live in memory and vanish when empty; coins, levels,
  and cosmetics live on each player's own phone.
- **Updates:** if we change the game later, re-upload the changed files to GitHub
  (or push) and Render redeploys on its own.

## Alternative host (Railway)

If you'd rather use Railway: sign up at https://railway.app with GitHub, click
**New Project → Deploy from GitHub repo → giggledoom**. It auto-detects Node and
runs `node server.js`. Same result, slightly different free-tier limits.
