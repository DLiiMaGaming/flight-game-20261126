// SKYLANE: Archipelago Courier — boot and the one loop.
// Input is read every frame, the world advances in fixed 1/60 s steps, and
// the renderer paints what is there. Screens: title, play, paused, over.
// ?seed=N fixes the world. ?shot=cover|rings|runway|islands stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, FLIGHT, MISSION, RUNWAY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, isOverRunway, stepWorld, terrainHeight, windAt } from './world.js';
import { ACTION_CONFIRM, ACTION_GEAR, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createPlane, headingDegrees, knots, resetPlane, stepPlane } from './plane.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const plane = createPlane();
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

const state = {
  world,
  plane,
  screen: 'title',
  time: 0,
  elapsed: 0,
  score: 0,
  ringsCleared: 0,
  nextRing: 0,
  messages: [],
  wind: windAt(world, 0),
  best: readBest(),
  result: null,
  pullUp: false,
  muted: false,
};

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // A private window still flies.
  }
}

function say(text, big = false, color = '#eaf6ff', seconds = 2.6) {
  state.messages.push({ text, big, color, until: state.time + seconds });
  if (state.messages.length > 3) state.messages.shift();
}

function startSortie() {
  resetPlane(plane);
  for (const ring of world.rings) ring.passed = false;
  state.score = 0;
  state.ringsCleared = 0;
  state.nextRing = 0;
  state.elapsed = 0;
  state.messages = [];
  state.result = null;
  state.pullUp = false;
  state.screen = 'play';
  audio.unlock();
  say('RING RUN — FLY THE 8 RINGS, THEN LAND AT KESTREL FIELD', false, '#ffb84d', 4);
  status.textContent = 'Flying the Ring Run. Eight rings, then land at Kestrel Field.';
}

function endSortie(won, title, detail) {
  const timeBonus = won ? Math.max(0, Math.round((MISSION.timePar - state.elapsed) * MISSION.timeBonusRate)) : 0;
  const score = state.ringsCleared * MISSION.ringScore + (won ? MISSION.landingScore : 0) + timeBonus;
  state.score = score;
  state.result = { won, title, detail, rings: state.ringsCleared, timeBonus, score };
  if (score > state.best) {
    state.best = score;
    saveBest(score);
  }
  state.screen = 'over';
  plane.onGround = won;
  status.textContent = `${title}. Score ${score}.`;
  if (won) audio.land();
  else audio.crash();
}

function checkRings() {
  if (state.nextRing >= MISSION.rings) return;
  const ring = world.rings[state.nextRing];
  const d = Math.hypot(ring.x - plane.x, ring.y - plane.y, ring.z - plane.z);
  if (d < ring.r) {
    ring.passed = true;
    state.ringsCleared += 1;
    state.nextRing += 1;
    state.score += MISSION.ringScore;
    plane.fuel = Math.min(100, plane.fuel + FLIGHT.fuelPerRing);
    audio.ring();
    say(`RING ${state.ringsCleared} CLEAR  +${MISSION.ringScore}`, true, '#7dff9e');
    if (state.nextRing >= MISSION.rings) {
      say('ALL RINGS CLEAR — LAND AT KESTREL FIELD', false, '#ffb84d', 4);
      status.textContent = 'All rings clear. Land at Kestrel Field, gear down, slow and level.';
    }
  }
}

function checkLandingAndCrash() {
  const ground = terrainHeight(world, plane.x, plane.z);
  const overStrip = isOverRunway(world, plane.x, plane.z);
  // A landing: on the strip, gear down, slow, level, gentle descent.
  if (
    overStrip &&
    plane.y <= RUNWAY.y + 3 &&
    plane.gearDown &&
    plane.speed < 80 &&
    plane.verticalSpeed > -10 &&
    Math.abs(plane.roll) < 0.3
  ) {
    plane.y = RUNWAY.y;
    endSortie(true, 'DELIVERED', 'Kestrel-9 down safe at Kestrel Field. The courier run is complete.');
    return;
  }
  if (plane.y <= ground + 1.5) {
    plane.y = ground + 1.5;
    if (ground <= 2) {
      endSortie(false, 'DITCHED', 'Down in the Meridian swell — the sea keeps the plane.');
    } else {
      endSortie(false, 'TERRAIN STRIKE', `Clipped the ridge at ${Math.round(plane.y * 3.281)} ft. The mountains win this one.`);
    }
    return;
  }
  if (plane.fuel <= 0 && plane.speed < 30 && plane.y < 40) {
    endSortie(false, 'OUT OF FUEL', 'The tanks ran dry over open water. Plan the fuel, not just the route.');
  }
}

function step(dt) {
  state.time += dt;
  if (state.screen === 'title') {
    // Attract mode: the camera drifts over the start of the run.
    plane.heading = Math.sin(state.time * 0.07) * 0.5;
    plane.pitch = Math.sin(state.time * 0.11) * 0.05;
    plane.roll = Math.sin(state.time * 0.09) * 0.12;
    stepWorld(world, dt);
    return;
  }
  if (state.screen !== 'play') {
    stepWorld(world, dt);
    return;
  }
  state.elapsed += dt;
  const control = input.read(dt);
  if (plane.fuel <= 0) control.throttleDelta = Math.min(0, control.throttleDelta);
  const wind = windAt(world, state.time);
  state.wind = wind;
  stepPlane(plane, control, wind, dt);
  stepWorld(world, dt);
  audio.engine(plane.throttle, plane.speed / FLIGHT.maxSpeed);

  // Terrain ahead: warn early, not at the rock face.
  const aheadX = plane.x + Math.sin(plane.heading) * 320;
  const aheadZ = plane.z - Math.cos(plane.heading) * 320;
  const aheadGround = terrainHeight(world, aheadX, aheadZ);
  state.pullUp = plane.y < aheadGround + 70 && plane.verticalSpeed < 2;

  checkRings();
  checkLandingAndCrash();
  state.messages = state.messages.filter((m) => m.until > state.time);
}

function handleActions() {
  for (const action of input.takeActions()) {
    if (action === ACTION_CONFIRM) {
      if (state.screen === 'title') startSortie();
      else if (state.screen === 'over') startSortie();
      audio.unlock();
    } else if (action === ACTION_PAUSE) {
      if (state.screen === 'play') state.screen = 'paused';
      else if (state.screen === 'paused') state.screen = 'play';
    } else if (action === ACTION_RESTART) {
      startSortie();
    } else if (action === ACTION_GEAR) {
      if (state.screen === 'play') {
        plane.gearDown = !plane.gearDown;
        say(plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', false, '#ffb84d', 1.6);
      }
    } else if (action === ACTION_MUTE) {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    }
  }
}

// Test / playtest hook: the live numbers, nothing secret.
window.__game = {
  get screen() {
    return state.screen;
  },
  get score() {
    return state.score;
  },
  get rings() {
    return state.ringsCleared;
  },
  get speedKnots() {
    return knots(plane.speed);
  },
  get altitudeFeet() {
    return Math.round(plane.y * 3.281);
  },
  get heading() {
    return Math.round(headingDegrees(plane.heading));
  },
  get fuel() {
    return Math.round(plane.fuel);
  },
  get x() {
    return Math.round(plane.x);
  },
  get y() {
    return Math.round(plane.y);
  },
  get z() {
    return Math.round(plane.z);
  },
  get pitch() {
    return plane.pitch;
  },
  get roll() {
    return plane.roll;
  },
  get target() {
    const r = world.rings[state.nextRing];
    return r ? { x: r.x, y: r.y, z: r.z, r: r.r } : null;
  },
  get gear() {
    return plane.gearDown;
  },
  get seed() {
    return seed;
  },
  press(code) {
    input.press(code);
  },
  release(code) {
    input.release(code);
  },
  start() {
    startSortie();
  },
};

if (shot) {
  // Staged screenshot: park the plane, paint twice, signal readiness.
  state.screen = 'play';
  if (stageShot(state, shot)) {
    renderer.draw(state);
    renderer.draw(state);
    window.__shotReady = true;
  } else {
    window.__shotReady = false;
    window.__shotError = `unknown shot "${shot}"`;
  }
} else {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    handleActions();
    acc += elapsed;
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
    }
    renderer.draw(state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
