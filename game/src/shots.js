// Screenshot staging: ?shot=cover|rings|runway|islands (&seed=N) parks the
// Kestrel-9 in a real, playable pose and paints the frame twice, exactly the
// way the starter stages its shots. Every screenshot is a live render of
// this game's own code — never edited, composited or borrowed.

import { MISSION } from './config.js';

const SHOTS = {
  // Cover: on the run to ring 1, the ring ahead-left, islands left and right.
  cover: { x: 140, y: 320, z: 1120, heading: -0.12, pitch: 0.02, roll: 0.08, speed: 128, throttle: 0.72, rings: 0, score: 0, elapsed: 42 },
  // Threading ring 3 low over Tern Cay, two rings already banked.
  rings: { x: -360, y: 308, z: -470, heading: -0.15, pitch: -0.02, roll: -0.12, speed: 142, throttle: 0.8, rings: 2, score: 1000, elapsed: 118 },
  // Final approach to Kestrel Field, gear down, strip dead ahead.
  runway: { x: 80, y: 150, z: -1620, heading: -0.05, pitch: -0.08, roll: 0.02, speed: 68, throttle: 0.3, gearDown: true, rings: 8, score: 4000, elapsed: 262 },
  // Low over the Meridian swell, ring 5 dead ahead, Gull Rock's ridge right.
  islands: { x: -700, y: 260, z: -1720, heading: 1.57, pitch: 0.02, roll: 0.15, speed: 118, throttle: 0.66, rings: 4, score: 2000, elapsed: 171 },
};

export const SHOT_NAMES = Object.keys(SHOTS);

export function stageShot(state, name) {
  const shot = SHOTS[name];
  if (!shot) return false;
  const plane = state.plane;
  plane.x = shot.x;
  plane.y = shot.y;
  plane.z = shot.z;
  plane.heading = shot.heading;
  plane.pitch = shot.pitch;
  plane.roll = shot.roll;
  plane.speed = shot.speed;
  plane.throttle = shot.throttle;
  plane.gearDown = !!shot.gearDown;
  plane.fuel = 78;
  plane.verticalSpeed = plane.speed * Math.sin(plane.pitch);
  plane.stalled = false;
  state.ringsCleared = shot.rings;
  state.nextRing = shot.rings;
  state.score = shot.score;
  state.elapsed = shot.elapsed;
  state.screen = 'play';
  state.messages = [];
  if (name === 'cover') {
    state.messages.push({ text: 'RING RUN — 8 RINGS TO KESTREL FIELD', big: false, color: '#eaf6ff' });
  }
  if (name === 'rings') {
    state.messages.push({ text: 'RING 3 CLEAR  +500', big: true, color: '#7dff9e' });
  }
  if (name === 'runway') {
    state.messages.push({ text: 'FINAL — GEAR DOWN, KESTREL FIELD AHEAD', big: false, color: '#eaf6ff' });
  }
  if (name === 'islands') {
    state.messages.push({ text: 'RING 5 CLEAR  +500', big: true, color: '#7dff9e' });
  }
  for (let i = 0; i < shot.rings; i++) state.world.rings[i].passed = true;
  state.pullUp = false;
  return true;
}

export function shotList() {
  return MISSION.rings;
}
