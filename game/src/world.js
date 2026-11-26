// The archipelago: islands, sea, runway, rings, clouds and the trade winds.
// Terrain height is a sum of smooth island hills, flattened at the runway so
// a landing reads as a landing instead of a hillside scrape.

import { ISLANDS, RINGS, RUNWAY } from './config.js';
import { range } from './random.js';

export function createWorld(random) {
  const islands = ISLANDS.map((isle) => ({
    ...isle,
    // Two or three summit cones per island so the silhouette is a ridge,
    // not a single triangle. On Kestrel Isle the cones stay clear of the
    // runway strip, so the strip reads as a strip, not a hillside.
    peaks: Array.from({ length: isle.r > 400 ? 3 : 2 }, (_, i) => {
      let dx = range(random, -isle.r * 0.32, isle.r * 0.32);
      const dz = range(random, -isle.r * 0.32, isle.r * 0.32);
      if (isle.name === 'Kestrel Isle' && Math.abs(dx) < 220) {
        dx = dx < 0 ? -range(random, 240, 320) : range(random, 240, 320);
      }
      return {
        dx,
        dz,
        h: isle.peak * range(random, 0.72, 1),
        w: isle.r * range(random, 0.34, 0.52),
      };
    }),
  }));

  const rings = RINGS.map((ring, i) => ({ ...ring, index: i, passed: false }));

  const clouds = Array.from({ length: 46 }, () => ({
    x: range(random, -3200, 3200),
    z: range(random, -3400, 2600),
    y: range(random, 520, 780),
    s: range(random, 90, 260),
    drift: range(random, 2, 7),
  }));

  return { islands, rings, clouds, runway: RUNWAY, time: 0 };
}

export function terrainHeight(world, x, z) {
  const r = world.runway;
  // Kestrel Field is graded flat: the runway strip and its shoulders.
  if (
    Math.abs(x - r.x) < r.halfWidth + 90 &&
    z > r.zFar - 90 &&
    z < r.zNear + 90
  ) {
    return r.y;
  }
  let h = 0;
  for (const isle of world.islands) {
    const dx = x - isle.x;
    const dz = z - isle.z;
    const d2 = dx * dx + dz * dz;
    const sigma = isle.r * 0.55;
    h += isle.peak * Math.exp(-d2 / (2 * sigma * sigma));
  }
  return h;
}

export function isOverRunway(world, x, z) {
  const r = world.runway;
  return Math.abs(x - r.x) < r.halfWidth && z > r.zFar && z < r.zNear;
}

// The trade winds: a slow, honest gust that pushes the plane sideways and
// shows on the HUD, so holding a heading is a decision, not a given.
export function windAt(world, t) {
  return {
    x: Math.sin(t * 0.11) * 6 + Math.sin(t * 0.031 + 1.7) * 4,
    z: Math.cos(t * 0.07 + 0.6) * 5 + Math.sin(t * 0.043) * 3,
    label:
      Math.sin(t * 0.11) > 0 ? 'Trade winds E' : 'Trade winds W',
  };
}

export function stepWorld(world, dt) {
  world.time += dt;
  for (const cloud of world.clouds) {
    cloud.x += cloud.drift * dt;
    if (cloud.x > 3400) cloud.x = -3400;
  }
}
