// GIGGLEDOOM 3D proximity voice: WebRTC mesh over the '3d-rtc' relay.
// Distance falloff in meters, lowpass muffle when a wall blocks the line of sound.
// Mic optional: no mic = silent ghost (recvonly). STUN only, same as the 2D game.

const OPEN_DIST = 9;    // start a connection when closer than this
const CLOSE_DIST = 13;  // tear it down beyond this (hysteresis)
const REF_DIST = 7;     // gain = (1 - d/REF)^2, clamped
const RTC_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export function initVoice({ sock, peers, P, colliders, onStatus, voiceCtl, getHidey }) {
  const ctl = voiceCtl || { meDead: false, meeting: false, deadSet: new Set() };
  const myHidey = () => (getHidey ? getHidey() : '');
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = AC ? new AC() : null;
  let micStream = null, micDenied = false, muted = false;
  let analyser = null, analyserData = null;

  // ---------- mic (optional) ----------
  async function ensureMic() {
    if (micStream || micDenied) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (ctx) {
        const src = ctx.createMediaStreamSource(micStream);
        analyser = ctx.createAnalyser(); analyser.fftSize = 512;
        analyserData = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser);
      }
      onStatus && onStatus('mic');
      // late mic: add the track to every open connection
      peers.forEach(pr => {
        if (pr.pc && micStream) micStream.getTracks().forEach(tr => pr.pc.addTrack(tr, micStream));
      });
    } catch (e) {
      micDenied = true;
      onStatus && onStatus('nomic');
    }
  }
  ensureMic();

  // talk level 0-3 from own mic rms (sent in pos packets for mouth flaps)
  function talkLevel() {
    if (!analyser || muted) return 0;
    analyser.getByteTimeDomainData(analyserData);
    let sum = 0;
    for (let i = 0; i < analyserData.length; i += 4) { const v = (analyserData[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / (analyserData.length / 4));
    return rms > 0.2 ? 3 : rms > 0.09 ? 2 : rms > 0.035 ? 1 : 0;
  }

  // shared room reverb for all voices: a generated impulse, subtle wet
  let voiceVerb = null, voiceVerbIn = null;
  function ensureVerb() {
    if (voiceVerb || !ctx) return;
    voiceVerb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.1);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    voiceVerb.buffer = ir;
    voiceVerbIn = ctx.createGain(); voiceVerbIn.gain.value = 0.12;
    voiceVerbIn.connect(voiceVerb); voiceVerb.connect(ctx.destination);
  }

  // ---------- per-peer audio graph ----------
  function makeAudio(pr, stream) {
    // iOS needs a live (muted) element or WebRTC audio never flows
    const el = document.createElement('audio');
    el.autoplay = true; el.muted = true; el.srcObject = stream; el.setAttribute('playsinline', '');
    document.body.appendChild(el);
    pr.audioEl = el;
    if (!ctx) return;
    ensureVerb();
    const src = ctx.createMediaStreamSource(stream);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 20000;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filter); filter.connect(gain);
    if (ctx.createStereoPanner) { // voices come from a direction now
      const pan = ctx.createStereoPanner();
      gain.connect(pan); pan.connect(ctx.destination);
      pr.vcPan = pan;
    } else gain.connect(ctx.destination);
    if (voiceVerbIn) gain.connect(voiceVerbIn); // a touch of the house on every voice
    pr.vcFilter = filter; pr.vcGain = gain;
  }

  function killAudio(pr) {
    if (pr.audioEl) { pr.audioEl.srcObject = null; pr.audioEl.remove(); pr.audioEl = null; }
    if (pr.vcGain) { try { pr.vcGain.disconnect(); } catch (e) {} pr.vcGain = null; pr.vcFilter = null; pr.vcPan = null; }
  }

  // ---------- mesh ----------
  function makePC(id, pr, initiator) {
    const pc = new RTCPeerConnection(RTC_CFG);
    pr.pc = pc; pr.vcState = 'connecting';
    if (micStream) micStream.getTracks().forEach(tr => pc.addTrack(tr, micStream));
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.ontrack = ev => makeAudio(pr, ev.streams[0] || new MediaStream([ev.track]));
    pc.onicecandidate = ev => { if (ev.candidate) sock.emit('3d-rtc', { to: id, data: { c: ev.candidate } }); };
    pc.onconnectionstatechange = () => {
      pr.vcState = pc.connectionState;
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) dropPC(pr);
    };
    if (initiator) {
      pc.onnegotiationneeded = async () => {
        try {
          await pc.setLocalDescription(await pc.createOffer());
          sock.emit('3d-rtc', { to: id, data: { sdp: pc.localDescription } });
        } catch (e) {}
      };
    }
    return pc;
  }

  function dropPC(pr) {
    if (pr.pc) { try { pr.pc.close(); } catch (e) {} pr.pc = null; }
    pr.vcState = 'off';
    killAudio(pr);
  }

  sock.on('3d-rtc', async ({ from, data }) => {
    const pr = peers.get(from);
    if (!pr || !data) return;
    let pc = pr.pc;
    try {
      if (data.sdp) {
        if (!pc) pc = makePC(from, pr, false);
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          await pc.setLocalDescription(await pc.createAnswer());
          sock.emit('3d-rtc', { to: from, data: { sdp: pc.localDescription } });
        }
      } else if (data.c && pc) {
        await pc.addIceCandidate(data.c);
      }
    } catch (e) {}
  });

  // wall check: does the segment me->peer cross any wall collider box (2D, XZ plane)
  function wallBetween(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    for (const c of colliders) {
      // skip thin prop boxes only walls matter much, but props muffling is fine too
      let t0 = 0, t1 = 1;
      const p = [-dx, dx, -dz, dz];
      const q = [x0 - c.minX, c.maxX - x0, z0 - c.minZ, c.maxZ - z0];
      let hit = true;
      for (let i = 0; i < 4; i++) {
        if (Math.abs(p[i]) < 1e-9) { if (q[i] < 0) { hit = false; break; } }
        else {
          const r = q[i] / p[i];
          if (p[i] < 0) { if (r > t1) { hit = false; break; } if (r > t0) t0 = r; }
          else { if (r < t0) { hit = false; break; } if (r < t1) t1 = r; }
        }
      }
      if (hit && t0 < t1 && t0 > 0.02 && t0 < 0.98) return true;
    }
    return false;
  }

  // ---------- spatial tick: call every frame ----------
  function tick(dt) {
    if (ctx && ctx.state === 'suspended') ctx.resume(); // browsers suspend until a gesture
    peers.forEach((pr, id) => {
      const dy = (P.y || 0) - (pr.cy || 0);
      const d = Math.hypot(P.x - pr.cx, P.z - pr.cz, dy);
      const shouldConnect = d < OPEN_DIST;
      if (shouldConnect && !pr.pc && sock.id < id) makePC(id, pr, true);
      if (!shouldConnect && pr.pc && d > CLOSE_DIST) dropPC(pr);
      if (pr.vcGain) {
        const peerDead = ctl.deadSet.has(id);
        let blocked = wallBetween(P.x, P.z, pr.cx, pr.cz);
        if (Math.abs(dy) > 2.2) blocked = true; // a whole floor between you: muffled thumps
        let target = Math.min(1, Math.pow(Math.max(0, 1 - d / REF_DIST), 2) * (blocked ? 0.4 : 1));
        const mh = myHidey(), sharing = mh && pr.hidey === mh;
        if (sharing) { target = 1; blocked = false; } // cheek to cheek in the fridge: crystal clear whispers
        else if (mh || pr.hidey) target = Math.min(target, 0.25); // muffled to/from anyone tucked away elsewhere
        if (ctl.meeting && !peerDead) { target = 1; blocked = false; } // everyone at the table
        if (ctl.meDead) { target = Math.max(target, 0.85); blocked = false; } // the dead hear all
        else if (peerDead) target = 0; // ghosts are silent to the living
        const g = pr.vcGain.gain;
        g.value += (target - g.value) * Math.min(1, dt * 8);
        const f = pr.vcFilter.frequency;
        const targetF = blocked ? 520 : 20000;
        f.value += (targetF - f.value) * Math.min(1, dt * 6);
        if (pr.vcPan) { // which ear: right vector for our yaw is (cos, -sin)
          const dx = pr.cx - P.x, dz = pr.cz - P.z, dh = Math.hypot(dx, dz);
          const want = (ctl.meeting || ctl.meDead || dh < 0.4) ? 0
            : Math.max(-1, Math.min(1, (dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw)) / dh)) * 0.8;
          pr.vcPan.pan.value += (want - pr.vcPan.pan.value) * Math.min(1, dt * 8);
        }
      }
    });
  }

  function setMuted(m) {
    muted = m;
    if (micStream) micStream.getAudioTracks().forEach(tr => (tr.enabled = !m));
  }

  return {
    tick, talkLevel, setMuted,
    isMuted: () => muted,
    hasMic: () => !!micStream,
    drop: pr => dropPC(pr),
    debug: () => {
      const out = {};
      peers.forEach((pr, id) => (out[id.slice(0, 5)] = pr.vcState || 'off'));
      return { mic: micStream ? 'yes' : micDenied ? 'denied' : 'pending', peers: out };
    },
  };
}
