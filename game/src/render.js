// The chase-view renderer: sky, sea, islands, rings, runway, clouds and the
// Kestrel-9 herself, plus every lit instrument on the HUD. Pure canvas 2D —
// no library, no network, the same pixels every run for a given seed.

import { FLIGHT, GAME_SUBTITLE, GAME_TITLE, MISSION, PLANE_NAME } from './config.js';
import { feet, headingDegrees, knots } from './plane.js';

const AMBER = '#ffb84d';
const GREEN = '#7dff9e';
const PANEL = 'rgba(8, 18, 28, 0.72)';
const INK = '#eaf6ff';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- camera & projection ----
  function camera(plane) {
    const fov = (70 * Math.PI) / 180;
    const focal = H / 2 / Math.tan(fov / 2);
    const h = plane.heading;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    const pitch = plane.pitch * 0.6;
    return {
      focal,
      cx: plane.x - fx * FLIGHT.cameraDistance,
      cy: plane.y + FLIGHT.cameraHeight,
      cz: plane.z - fz * FLIGHT.cameraDistance,
      fx,
      fz,
      rx: Math.cos(h),
      rz: Math.sin(h),
      cp: Math.cos(pitch),
      sp: Math.sin(pitch),
      pitch,
      roll: plane.roll * 0.35,
    };
  }

  function project(cam, x, y, z) {
    const dx = x - cam.cx;
    const dy = y - cam.cy;
    const dz = z - cam.cz;
    const f = dx * cam.fx + dz * cam.fz;
    const r = dx * cam.rx + dz * cam.rz;
    const f2 = f * cam.cp + dy * cam.sp;
    const u2 = -f * cam.sp + dy * cam.cp;
    if (f2 < 3) return null;
    return {
      x: W / 2 + (r / f2) * cam.focal,
      y: H / 2 - (u2 / f2) * cam.focal,
      f: f2,
      scale: cam.focal / f2,
    };
  }

  function horizonY(cam) {
    return H / 2 + Math.tan(cam.pitch) * cam.focal;
  }

  // ---- sky, sea, sun ----
  function drawSky(cam, time) {
    const hy = horizonY(cam);
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(hy, 1));
    g.addColorStop(0, '#5ea0dd');
    g.addColorStop(0.55, '#8fc3e8');
    g.addColorStop(1, '#d8ecf7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, Math.max(hy + 1, 0));

    // Sun: fixed in the world, north-east and high.
    const sun = project(cam, cam.cx + 0.55 * 6000, cam.cy + 0.3 * 6000, cam.cz - 0.75 * 6000);
    if (sun && sun.y > -80 && sun.y < H + 80) {
      const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 130);
      glow.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 226, 150, 0.55)');
      glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - 130, sun.y - 130, 260, 260);
      ctx.fillStyle = '#fff7d6';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sea below the horizon, tilted with the bank.
    const tilt = -cam.roll;
    const y0 = hy;
    const yL = y0 + Math.tan(tilt) * (W / 2);
    const yR = y0 - Math.tan(tilt) * (W / 2);
    ctx.beginPath();
    ctx.moveTo(-4, yL);
    ctx.lineTo(W + 4, yR);
    ctx.lineTo(W + 4, H + 4);
    ctx.lineTo(-4, H + 4);
    ctx.closePath();
    const sea = ctx.createLinearGradient(0, y0, 0, H);
    sea.addColorStop(0, '#3f8ab5');
    sea.addColorStop(0.4, '#24709c');
    sea.addColorStop(1, '#14486b');
    ctx.fillStyle = sea;
    ctx.fill();

    // Haze band hugging the horizon so the sea meets the sky softly.
    ctx.fillStyle = 'rgba(216, 236, 247, 0.35)';
    ctx.fillRect(0, y0 - 6, W, 12);
    void time;
  }

  // ---- terrain features ----
  function drawIsland(cam, isle) {
    const ground = project(cam, isle.x, 0, isle.z);
    if (!ground || ground.f > 9000) return;
    if (ground.x < -ground.scale * 2 || ground.x > W + ground.scale * 2) return;
    const s = ground.scale * isle.r;
    if (s < 2) return;
    const squash = 0.3;
    // Sand ring, then grass raised into a low dome, then the ridge of peaks.
    ctx.fillStyle = '#e8d5a4';
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, s, s * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    const dome = project(cam, isle.x, isle.peak * 0.22, isle.z);
    const gy = dome ? dome.y : ground.y - s * 0.05;
    ctx.fillStyle = `hsl(${isle.hue}, 42%, 42%)`;
    ctx.beginPath();
    ctx.ellipse(ground.x, gy, s * 0.8, s * 0.8 * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const peak of isle.peaks) {
      const apex = project(cam, isle.x + peak.dx, peak.h, isle.z + peak.dz);
      const b1 = project(cam, isle.x + peak.dx - peak.w, 0, isle.z + peak.dz);
      const b2 = project(cam, isle.x + peak.dx + peak.w, 0, isle.z + peak.dz);
      if (!apex || !b1 || !b2) continue;
      ctx.fillStyle = `hsl(${isle.hue}, 38%, 30%)`;
      ctx.beginPath();
      ctx.moveTo(b1.x, b1.y);
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.closePath();
      ctx.fill();
      // Shade the lee side so the cone reads as solid, not flat.
      ctx.fillStyle = `hsla(${isle.hue}, 38%, 20%, 0.55)`;
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.lineTo((apex.x + b2.x) / 2, (apex.y + b2.y) / 2 + (b1.y - apex.y) * 0.1);
      ctx.closePath();
      ctx.fill();
      // Snow on the tall summits.
      if (peak.h > 120) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.moveTo(apex.x, apex.y);
        ctx.lineTo(apex.x - (apex.x - b1.x) * 0.22, apex.y + (b1.y - apex.y) * 0.22);
        ctx.lineTo(apex.x + (b2.x - apex.x) * 0.22, apex.y + (b2.y - apex.y) * 0.22);
        ctx.closePath();
        ctx.fill();
      }
    }
    // The island's name, once you are close enough to read it.
    if (ground.f < 2600 && s > 26) {
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(isle.name.toUpperCase(), ground.x, ground.y - s * 0.42);
      ctx.shadowBlur = 0;
    }
  }

  function drawRunway(cam, runway) {
    const pts = [
      project(cam, runway.x - runway.halfWidth, runway.y, runway.zNear),
      project(cam, runway.x + runway.halfWidth, runway.y, runway.zNear),
      project(cam, runway.x + runway.halfWidth, runway.y, runway.zFar),
      project(cam, runway.x - runway.halfWidth, runway.y, runway.zFar),
    ];
    if (pts.some((p) => !p)) return;
    ctx.fillStyle = '#565d66';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    // White edge lines so the strip reads against the grass at any angle.
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.moveTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const z0 = runway.zNear - ((runway.zNear - runway.zFar) * i) / 8;
      const z1 = runway.zNear - ((runway.zNear - runway.zFar) * (i + 0.5)) / 8;
      const a = project(cam, runway.x, runway.y + 0.4, z0);
      const b = project(cam, runway.x, runway.y + 0.4, z1);
      if (a && b) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();
    // Edge lights, lit amber.
    ctx.fillStyle = AMBER;
    for (let i = 0; i <= 8; i++) {
      const z = runway.zNear - ((runway.zNear - runway.zFar) * i) / 8;
      for (const side of [-1, 1]) {
        const p = project(cam, runway.x + side * runway.halfWidth, runway.y + 1, z);
        if (p) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Offset to the side of the strip so the label never hides behind the tail.
    const label = project(cam, runway.x + 150, runway.y + 1, runway.zFar + 90);
    if (label && label.f < 4000) {
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 5;
      ctx.fillText('KESTREL FIELD', label.x, label.y - 10);
      ctx.shadowBlur = 0;
    }
  }

  function drawRing(cam, ring, state) {
    const p = project(cam, ring.x, ring.y, ring.z);
    if (!p || p.f > 9000) return;
    const rx = p.scale * ring.r;
    if (rx < 3) return;
    const isNext = ring.index === state.nextRing;
    const isPassed = ring.passed;
    ctx.save();
    if (isNext) {
      ctx.shadowColor = '#ffb020';
      ctx.shadowBlur = 22 + Math.sin(state.time * 5) * 8;
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = Math.max(3, rx * 0.1);
    } else if (isPassed) {
      ctx.strokeStyle = 'rgba(125, 255, 158, 0.55)';
      ctx.lineWidth = Math.max(2, rx * 0.06);
    } else {
      ctx.strokeStyle = 'rgba(127, 212, 255, 0.6)';
      ctx.lineWidth = Math.max(2, rx * 0.06);
    }
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, rx * 0.94, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 0.82, rx * 0.78, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Ring number and distance for the next one.
    if (isNext) {
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd98a';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 5;
      const d = Math.round(
        Math.hypot(ring.x - state.plane.x, ring.y - state.plane.y, ring.z - state.plane.z),
      );
      ctx.fillText(`RING ${ring.index + 1} — ${d} m`, p.x, p.y - rx - 10);
      ctx.shadowBlur = 0;
    } else if (!isPassed && rx > 18) {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(220, 240, 255, 0.9)';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(`${ring.index + 1}`, p.x, p.y - rx - 6);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawCloud(cam, cloud) {
    const p = project(cam, cloud.x, cloud.y, cloud.z);
    if (!p || p.f > 12000) return;
    const s = p.scale * cloud.s;
    if (s < 4) return;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    for (const [ox, oy, r] of [
      [0, 0, 0.55],
      [-0.5, 0.12, 0.4],
      [0.5, 0.1, 0.42],
      [-0.15, -0.22, 0.38],
      [0.28, -0.18, 0.34],
    ]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * s, p.y + oy * s, r * s, r * s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- the plane, drawn from behind in screen space ----
  function drawPlane(plane, time) {
    const px = W / 2;
    const py = H * 0.64 - plane.pitch * 60;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1.28, 1.28);
    ctx.rotate(-plane.roll * 0.45);
    const flex = Math.sin(time * 2.2) * 1.5;
    // Wings with orange tips and lit nav lights.
    ctx.fillStyle = '#f5ead2';
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, 6);
    ctx.lineTo(-168, 26 + flex);
    ctx.lineTo(-172, 40 + flex);
    ctx.lineTo(-16, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, 6);
    ctx.lineTo(168, 26 - flex);
    ctx.lineTo(172, 40 - flex);
    ctx.lineTo(16, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8641c';
    ctx.fillRect(-172, 26 + flex, 14, 14);
    ctx.fillRect(158, 26 - flex, 14, 14);
    // Nav lights: red left, green right, white strobe blinking on the tail.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-176, 33 + flex, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2eff5e';
    ctx.beginPath();
    ctx.arc(176, 33 - flex, 4, 0, Math.PI * 2);
    ctx.fill();
    if (Math.floor(time * 1.6) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, -66, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Tail fin and horizontal stabiliser.
    ctx.fillStyle = '#0e7c7b';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(0, -68);
    ctx.lineTo(14, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f5ead2';
    ctx.beginPath();
    ctx.moveTo(-52, -6);
    ctx.lineTo(52, -6);
    ctx.lineTo(40, 8);
    ctx.lineTo(-40, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Fuselage: the view from the chase camera.
    ctx.fillStyle = '#f5ead2';
    ctx.beginPath();
    ctx.ellipse(0, 8, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0e7c7b';
    ctx.fillRect(-26, 2, 52, 7);
    ctx.fillStyle = '#1c2733';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SKYLANE 09', 0, 16);
    ctx.fillStyle = '#e8641c';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.fillText('PK-SKY', 0, 27);
    // Landing gear, down only when the pilot asks for it.
    if (plane.gearDown) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, 34);
      ctx.lineTo(-16, 48);
      ctx.moveTo(16, 34);
      ctx.lineTo(16, 48);
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-16, 50, 5, 0, Math.PI * 2);
      ctx.arc(16, 50, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSpeedLines(plane) {
    if (plane.speed < 115) return;
    const a = Math.min(0.5, (plane.speed - 115) / 160);
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + 0.35;
      const r0 = Math.min(W, H) * 0.42;
      const r1 = r0 + 26 + ((i * 37) % 40);
      const x0 = W / 2 + Math.cos(ang) * r0;
      const y0 = H * 0.55 + Math.sin(ang) * r0;
      const x1 = W / 2 + Math.cos(ang) * r1;
      const y1 = H * 0.55 + Math.sin(ang) * r1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  // ---- HUD ----
  function panel(x, y, w, h) {
    ctx.fillStyle = PANEL;
    ctx.strokeStyle = 'rgba(255, 184, 77, 0.45)';
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCompass(headingDeg) {
    const cx = W / 2;
    const y = 14;
    const w = Math.min(460, W - 40);
    panel(cx - w / 2, y, w, 44);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w / 2, y, w, 44);
    ctx.clip();
    const pxPerDeg = 2.2;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 15) {
      const deg = Math.round((headingDeg + d + 360) % 360);
      const x = cx + d * pxPerDeg;
      const major = deg % 45 === 0;
      ctx.strokeStyle = major ? AMBER : 'rgba(234,246,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(x, y + 30);
      ctx.lineTo(x, y + (major ? 18 : 24));
      ctx.stroke();
      if (major) {
        const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg).padStart(3, '0');
        ctx.fillStyle = INK;
        ctx.fillText(label, x, y + 14);
      }
    }
    ctx.restore();
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(cx, y + 42);
    ctx.lineTo(cx - 6, y + 34);
    ctx.lineTo(cx + 6, y + 34);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(String(Math.round(headingDeg)).padStart(3, '0') + '°', cx, y + 40 - 26 + 40);
  }

  function drawGauge(x, y, label, value, unit, max, warn) {
    panel(x, y, 148, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(234,246,255,0.65)';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(label, x + 12, y + 18);
    ctx.fillStyle = warn ? '#ff6b5e' : INK;
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText(String(value), x + 12, y + 52);
    ctx.fillStyle = 'rgba(234,246,255,0.65)';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(unit, x + 12, y + 70);
    // Arc needle.
    const cx = x + 116;
    const cy = y + 56;
    ctx.strokeStyle = 'rgba(234,246,255,0.25)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    ctx.strokeStyle = warn ? '#ff6b5e' : GREEN;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, Math.PI * 0.75, Math.PI * 0.75 + (Math.PI * 1.5 * Math.min(1, max ? value / max : 0)), false);
    ctx.stroke();
  }

  function drawAttitude(plane, x, y) {
    const r = 62;
    panel(x - 8, y - 8, r * 2 + 16, r * 2 + 16);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-plane.roll);
    ctx.translate(0, plane.pitch * 90);
    ctx.fillStyle = '#6fb3e8';
    ctx.fillRect(-r - 4, -r - 90, r * 2 + 8, r + 90);
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(-r - 4, 0, r * 2 + 8, r + 90);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (const p of [-0.3, -0.15, 0.15, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(-18, p * 90);
      ctx.lineTo(18, p * 90);
      ctx.stroke();
    }
    ctx.restore();
    // Fixed aircraft symbol.
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 26, y);
    ctx.lineTo(x - 8, y);
    ctx.lineTo(x, y - 6);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x + 26, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(234,246,255,0.65)';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', x, y + r + 12);
  }

  function drawBars(state) {
    const plane = state.plane;
    const x = W - 178;
    const y = H - 108;
    panel(x, y, 160, 92);
    ctx.textAlign = 'left';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(234,246,255,0.65)';
    ctx.fillText('FUEL', x + 12, y + 18);
    ctx.fillStyle = plane.fuel < 25 ? '#ff6b5e' : GREEN;
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(plane.fuel)}%`, x + 108, y + 19);
    bar(x + 12, y + 26, 136, 10, plane.fuel / 100, plane.fuel < 25 ? '#ff6b5e' : GREEN);
    ctx.fillStyle = 'rgba(234,246,255,0.65)';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('THROTTLE', x + 12, y + 52);
    ctx.fillStyle = INK;
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, x + 108, y + 53);
    bar(x + 12, y + 60, 136, 10, plane.throttle, AMBER);
  }

  function bar(x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(x, y, w, h, 4);
    ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = color;
      roundRect(x, y, Math.max(4, w * Math.min(1, frac)), h, 4);
      ctx.fill();
    }
  }

  function drawHud(state) {
    const plane = state.plane;
    const hd = headingDegrees(plane.heading);
    drawCompass(hd);

    // Mission banner, top-left.
    panel(16, 14, 300, 64);
    ctx.textAlign = 'left';
    ctx.fillStyle = AMBER;
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(`${MISSION.name.toUpperCase()} — ${PLANE_NAME}`, 28, 34);
    ctx.fillStyle = INK;
    ctx.font = '600 12px system-ui, sans-serif';
    const next = state.nextRing < MISSION.rings
      ? `Next: ring ${state.nextRing + 1} of ${MISSION.rings}`
      : 'All rings clear — land at Kestrel Field';
    ctx.fillText(next, 28, 54);
    ctx.fillStyle = 'rgba(234,246,255,0.65)';
    ctx.fillText(state.wind.label, 28, 70);

    // Score and timer, top-right, on their own lit panel.
    panel(W - 216, 14, 200, 64);
    ctx.textAlign = 'right';
    ctx.fillStyle = AMBER;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(`SCORE ${state.score}`, W - 28, 38);
    ctx.fillStyle = INK;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(`TIME ${fmtTime(state.elapsed)}   RINGS ${state.ringsCleared}/${MISSION.rings}`, W - 28, 58);
    ctx.fillStyle = 'rgba(234,246,255,0.6)';
    ctx.fillText(`BEST ${state.best}`, W - 28, 72);

    // Instruments.
    drawGauge(16, 96, 'AIRSPEED', knots(plane.speed), 'KIAS', 200, plane.stalled);
    drawGauge(W - 164, 96, 'ALTITUDE', feet(plane.y), 'FT', 1200, plane.y < 60 && plane.speed > 60);
    // Climb, heading and gear on a sub-panel under the altimeter.
    panel(W - 164, 196, 148, 64);
    const vs = Math.round(plane.verticalSpeed * 196.85);
    ctx.textAlign = 'left';
    ctx.fillStyle = vs >= 0 ? GREEN : '#ffb84d';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(`V/S ${vs >= 0 ? '+' : ''}${vs} FPM`, W - 152, 216);
    ctx.fillStyle = 'rgba(234,246,255,0.75)';
    ctx.fillText(`HDG ${String(Math.round(hd)).padStart(3, '0')}°`, W - 152, 236);
    ctx.fillText(plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', W - 152, 254);

    drawAttitude(plane, 86, H - 92);
    drawBars(state);

    // Centre messages and warnings.
    let my = H * 0.3;
    for (const msg of state.messages) {
      ctx.font = msg.big ? '700 30px system-ui, sans-serif' : '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = msg.color || INK;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 8;
      ctx.fillText(msg.text, W / 2, my);
      ctx.shadowBlur = 0;
      my += msg.big ? 40 : 26;
    }
    if (plane.stalled && state.screen === 'play') {
      blinkText('STALL — NOSE DOWN, POWER UP', H * 0.22, '#ff6b5e', state.time);
    }
    if (plane.fuel < 25 && plane.fuel > 0 && state.screen === 'play') {
      blinkText('LOW FUEL', H * 0.26, '#ff6b5e', state.time);
    }
    if (state.pullUp && state.screen === 'play') {
      blinkText('PULL UP', H * 0.22, '#ff6b5e', state.time);
    }
  }

  function blinkText(text, y, color, time) {
    if (Math.floor(time * 2.4) % 2 === 0) return;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText(text, W / 2, y);
    ctx.shadowBlur = 0;
  }

  // ---- screens ----
  function drawTitle(state) {
    ctx.fillStyle = 'rgba(6, 16, 26, 0.45)';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 84px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18;
    ctx.fillText(GAME_TITLE, cx, H * 0.3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = AMBER;
    ctx.font = '600 26px system-ui, sans-serif';
    ctx.fillText(GAME_SUBTITLE, cx, H * 0.3 + 40);
    ctx.fillStyle = INK;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText('Fly the Ring Run: 8 sky rings across 7 islands, then bring her home', cx, H * 0.3 + 78);
    ctx.fillText('to Kestrel Field. Mind the fuel, mind the mountains, mind the wind.', cx, H * 0.3 + 104);

    const bw = 560;
    const bx = cx - bw / 2;
    const by = H * 0.3 + 140;
    panel(bx, by, bw, 132);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = '600 15px system-ui, sans-serif';
    const lines = [
      'ARROWS / WASD — pitch and bank      SHIFT / CTRL — throttle',
      'MOUSE — steer while it moves        SPACE — airbrake',
      'G — landing gear    P — pause    R — restart    M — mute',
      'Land slow, level and gear-down on the strip at Kestrel Field.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, bx + 24, by + 32 + i * 26));

    ctx.textAlign = 'center';
    ctx.fillStyle = AMBER;
    ctx.font = '700 22px system-ui, sans-serif';
    const blink = Math.floor(state.time * 1.4) % 2 === 0;
    if (blink) ctx.fillText('PRESS ENTER TO FLY', cx, by + 172);
    if (state.best > 0) {
      ctx.fillStyle = 'rgba(234,246,255,0.8)';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(`BEST SCORE ${state.best}`, cx, by + 200);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(6, 16, 26, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = '700 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', W / 2, H / 2 - 8);
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText('Press P to keep flying — R restarts the sortie', W / 2, H / 2 + 28);
  }

  function drawOver(state) {
    ctx.fillStyle = 'rgba(6, 16, 26, 0.55)';
    ctx.fillRect(0, 0, W, H);
    const r = state.result;
    const cx = W / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = r.won ? GREEN : '#ff6b5e';
    ctx.font = '700 52px system-ui, sans-serif';
    ctx.fillText(r.title, cx, H * 0.3);
    ctx.fillStyle = INK;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(r.detail, cx, H * 0.3 + 36);
    const bw = 460;
    const bx = cx - bw / 2;
    const by = H * 0.3 + 70;
    panel(bx, by, bw, 150);
    ctx.textAlign = 'left';
    ctx.font = '600 16px system-ui, sans-serif';
    const rows = [
      ['Rings cleared', `${r.rings} × ${MISSION.ringScore} = ${r.rings * MISSION.ringScore}`],
      ['Landing', r.won ? `${MISSION.landingScore}` : '0'],
      ['Time bonus', `${r.timeBonus}`],
      ['SCORE', `${r.score}`],
    ];
    rows.forEach(([k, v], i) => {
      ctx.fillStyle = i === 3 ? AMBER : INK;
      ctx.font = i === 3 ? '700 18px system-ui, sans-serif' : '600 16px system-ui, sans-serif';
      ctx.fillText(k, bx + 24, by + 34 + i * 32);
      ctx.textAlign = 'right';
      ctx.fillText(v, bx + bw - 24, by + 34 + i * 32);
      ctx.textAlign = 'left';
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = AMBER;
    ctx.font = '700 20px system-ui, sans-serif';
    if (Math.floor(state.time * 1.4) % 2 === 0) {
      ctx.fillText('PRESS R TO FLY AGAIN', cx, by + 190);
    }
  }

  // ---- main draw ----
  function draw(state) {
    const cam = camera(state.plane);
    drawSky(cam, state.time);

    // Collect features far-to-near so the near ones paint over the far ones.
    const features = [];
    for (const isle of state.world.islands) {
      const p = project(cam, isle.x, 0, isle.z);
      if (p) features.push({ f: p.f, draw: () => drawIsland(cam, isle) });
    }
    const runwayP = project(cam, state.world.runway.x, state.world.runway.y, (state.world.runway.zNear + state.world.runway.zFar) / 2);
    // The strip paints after the island it sits on, so it is never buried.
    if (runwayP) features.push({ f: runwayP.f - 150, draw: () => drawRunway(cam, state.world.runway) });
    for (const ring of state.world.rings) {
      const p = project(cam, ring.x, ring.y, ring.z);
      if (p) features.push({ f: p.f, draw: () => drawRing(cam, ring, state) });
    }
    for (const cloud of state.world.clouds) {
      const p = project(cam, cloud.x, cloud.y, cloud.z);
      if (p) features.push({ f: p.f, draw: () => drawCloud(cam, cloud) });
    }
    features.sort((a, b) => b.f - a.f);
    for (const feat of features) feat.draw();

    if (state.screen !== 'title') drawPlane(state.plane, state.time);
    drawSpeedLines(state.plane);

    if (state.screen === 'title') drawTitle(state);
    else if (state.screen === 'paused') drawPaused();
    else if (state.screen === 'over') drawOver(state);
    if (state.screen !== 'title') drawHud(state);

    // Soft vignette so the frame reads as a cockpit view, not a flat picture.
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  return { draw, resize, getSize: () => ({ W, H }) };
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
