// SKYLANE: Archipelago Courier — constants, islands, rings and the mission.
// All names, places and numbers are original to this game.
// Units: metres, seconds, radians. Heading 0 faces north (-z), grows clockwise.

export const GAME_TITLE = 'SKYLANE';
export const GAME_SUBTITLE = 'Archipelago Courier';
export const PLANE_NAME = 'Kestrel-9';
export const BEST_KEY = 'skylane-best-score';

// Flight envelope of the Kestrel-9 courier plane.
export const FLIGHT = {
  minSpeed: 38, // m/s — below this the wing quits
  stallSpeed: 48,
  cruiseSpeed: 95,
  maxSpeed: 185,
  accelRate: 22, // m/s per second towards the throttle target
  maxPitch: 0.45, // radians, nose up/down
  maxRoll: 1.05, // radians of bank
  pitchRate: 1.4, // radians per second of stick
  rollRate: 2.2,
  turnRate: 0.3, // heading change per radian of bank, scaled by speed
  climbBleed: 9, // speed lost per second at full climb
  fuelBurnBase: 0.16, // fuel units per second at idle
  fuelBurnThrottle: 0.34, // extra fuel units per second at full throttle
  fuelStart: 100,
  fuelPerRing: 14, // courier pickup tops the tank up at every ring
  cameraDistance: 19,
  cameraHeight: 5.5,
};

// The archipelago. peak is the summit height in metres, r the island radius.
// hue tints each island's grass so the sea reads as a real place.
export const ISLANDS = [
  { name: 'Kestrel Isle', x: 0, z: -2600, r: 720, peak: 64, hue: 96 },
  { name: 'Gull Rock', x: 640, z: -1400, r: 360, peak: 148, hue: 88 },
  { name: 'Tern Cay', x: -720, z: -900, r: 310, peak: 92, hue: 104 },
  { name: 'Heron Bay', x: -920, z: 620, r: 460, peak: 112, hue: 78 },
  { name: 'Osprey Point', x: 820, z: 420, r: 390, peak: 164, hue: 92 },
  { name: 'Lantern Reef', x: 1250, z: -2250, r: 290, peak: 72, hue: 110 },
  { name: 'Meridian Atoll', x: -1450, z: -2050, r: 520, peak: 54, hue: 84 },
  { name: 'Drift Shoal', x: 1500, z: 900, r: 240, peak: 38, hue: 100 },
];

// Kestrel Field: the one runway in the archipelago, on Kestrel Isle.
// The strip runs north-south; land heading north, gear down, slow and level.
export const RUNWAY = {
  name: 'Kestrel Field',
  x: 0,
  zNear: -2280, // southern threshold (approach from the south)
  zFar: -2920,
  halfWidth: 26,
  y: 27, // flattened strip height
};

// The Ring Run: eight sky rings in one sortie, then land at Kestrel Field.
export const RINGS = [
  { x: 0, z: 780, y: 320, r: 34 },
  { x: 320, z: 80, y: 345, r: 34 },
  { x: -420, z: -620, y: 305, r: 32 },
  { x: 220, z: -1180, y: 360, r: 34 },
  { x: -330, z: -1720, y: 320, r: 32 },
  { x: 140, z: -2050, y: 300, r: 32 },
  { x: -60, z: -2320, y: 235, r: 30 },
  { x: 0, z: -2560, y: 190, r: 30 },
];

export const MISSION = {
  name: 'Ring Run',
  rings: RINGS.length,
  ringScore: 500,
  landingScore: 1000,
  timePar: 300, // seconds — beat par for a time bonus
  timeBonusRate: 10, // points per second under par
};

export const START = {
  x: 0,
  y: 350,
  z: 1560,
  heading: 0, // north, straight at ring 1
  speed: 92,
  throttle: 0.62,
};
