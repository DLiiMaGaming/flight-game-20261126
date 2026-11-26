// The Kestrel-9 flight model: throttle, pitch, bank, stall and fuel.
// Nothing here is a cheat — speed bleeds in a climb, a steep bank turns the
// nose, and below stall speed the wing quits and the nose drops.

import { FLIGHT, START } from './config.js';

export function createPlane() {
  return {
    x: START.x,
    y: START.y,
    z: START.z,
    heading: START.heading,
    pitch: 0,
    roll: 0,
    speed: START.speed,
    throttle: START.throttle,
    fuel: FLIGHT.fuelStart,
    gearDown: false,
    verticalSpeed: 0,
    stalled: false,
    onGround: false,
  };
}

export function resetPlane(plane) {
  const fresh = createPlane();
  Object.assign(plane, fresh);
}

// input: { pitch: -1..1 (stick back = climb), roll: -1..1, throttleDelta,
//          brake: bool, mouse: {active, pitch, roll} | null }
export function stepPlane(plane, input, wind, dt) {
  if (plane.onGround) return;

  // Stick: keyboard first, mouse steering blends in while it is moving.
  let pitchTarget = input.pitch * FLIGHT.maxPitch;
  let rollTarget = input.roll * FLIGHT.maxRoll;
  if (input.mouse && input.mouse.active) {
    pitchTarget = input.mouse.pitch * FLIGHT.maxPitch;
    rollTarget = input.mouse.roll * FLIGHT.maxRoll;
  }

  const pitchRate = input.mouse && input.mouse.active ? 1.1 : FLIGHT.pitchRate;
  plane.pitch += clamp(pitchTarget - plane.pitch, -pitchRate * dt, pitchRate * dt);
  plane.roll += clamp(rollTarget - plane.roll, -FLIGHT.rollRate * dt, FLIGHT.rollRate * dt);
  plane.roll = clamp(plane.roll, -FLIGHT.maxRoll, FLIGHT.maxRoll);
  plane.pitch = clamp(plane.pitch, -FLIGHT.maxPitch, FLIGHT.maxPitch);

  // Throttle: shift up, ctrl down; brake bleeds speed fast.
  plane.throttle = clamp(plane.throttle + input.throttleDelta * dt, 0, 1);
  const targetSpeed =
    FLIGHT.minSpeed + plane.throttle * (FLIGHT.maxSpeed - FLIGHT.minSpeed);
  let speed = plane.speed + (targetSpeed - plane.speed) * Math.min(1, FLIGHT.accelRate / 120 * dt * 10);
  // Climb costs speed; a dive buys it back. Brake costs a lot.
  speed -= Math.sin(plane.pitch) * FLIGHT.climbBleed * dt;
  if (input.brake) speed -= 34 * dt;
  plane.speed = clamp(speed, 0, FLIGHT.maxSpeed + 12);

  // Stall: below stall speed the nose drops no matter what the stick says.
  plane.stalled = plane.speed < FLIGHT.stallSpeed;
  if (plane.stalled) {
    plane.pitch = Math.max(plane.pitch - 0.5 * dt, -0.35);
  }

  // Bank turns the nose; the turn tightens with speed.
  plane.heading +=
    -Math.sin(plane.roll) * FLIGHT.turnRate * (plane.speed / FLIGHT.cruiseSpeed) * dt;

  const fx = Math.sin(plane.heading);
  const fz = -Math.cos(plane.heading);
  const windPush = 1 - Math.min(0.6, plane.speed / 300);
  plane.x += (fx * plane.speed + wind.x * windPush) * dt;
  plane.z += (fz * plane.speed + wind.z * windPush) * dt;

  plane.verticalSpeed = plane.speed * Math.sin(plane.pitch);
  plane.y += plane.verticalSpeed * dt;
  if (plane.y < 1) plane.y = 1;

  // Fuel: idle sips, full throttle drinks.
  plane.fuel -= (FLIGHT.fuelBurnBase + FLIGHT.fuelBurnThrottle * plane.throttle) * dt;
  if (plane.fuel < 0) plane.fuel = 0;
}

export function knots(speedMs) {
  return Math.round(speedMs * 1.944);
}

export function feet(metres) {
  return Math.round(metres * 3.281);
}

export function headingDegrees(heading) {
  const deg = ((heading * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
