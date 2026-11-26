// Keyboard + mouse input. Arrows / WASD fly the plane, Shift/Ctrl work the
// throttle, the mouse steers while it moves, Space is the airbrake.
// Enter confirms, P pauses, R restarts, G drops the gear, M mutes.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_GEAR = 'gear';
export const ACTION_MUTE = 'mute';

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  KeyR: ACTION_RESTART,
  KeyG: ACTION_GEAR,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const keys = new Set();
  const queue = [];
  const mouse = { x: 0, y: 0, active: false, lastMove: -10 };
  let time = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    const action = KEY_ACTIONS[e.code];
    if (action) {
      queue.push(action);
      e.preventDefault();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width;
    mouse.y = (e.clientY - rect.top) / rect.height;
    mouse.active = true;
    mouse.lastMove = time;
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.active = false;
  });

  function axis(neg, pos) {
    return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
  }

  return {
    // Read once per frame: pitch/roll stick, throttle delta, brake, mouse.
    read(dt) {
      time += dt;
      // Mouse steering fades out two seconds after the last move.
      const mouseActive = mouse.active && time - mouse.lastMove < 2;
      const mouseSteer = mouseActive
        ? {
            active: true,
            roll: clamp((mouse.x - 0.5) * 2.4, -1, 1),
            pitch: clamp((0.5 - mouse.y) * 2.2, -1, 1),
          }
        : { active: false, pitch: 0, roll: 0 };
      return {
        // Stick back (Up / W) climbs; stick forward dives.
        pitch: axis('ArrowDown', 'ArrowUp') || axis('KeyS', 'KeyW'),
        roll: axis('ArrowLeft', 'ArrowRight') || axis('KeyA', 'KeyD'),
        throttleDelta:
          (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 0.55 : 0) -
          (keys.has('ControlLeft') || keys.has('ControlRight') ? 0.55 : 0),
        brake: keys.has('Space'),
        mouse: mouseSteer,
      };
    },
    // Test / automation hook: press a key without a real keyboard.
    press(code) {
      keys.add(code);
      const action = KEY_ACTIONS[code];
      if (action) queue.push(action);
    },
    release(code) {
      keys.delete(code);
    },
    takeActions() {
      return queue.splice(0, queue.length);
    },
  };
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
