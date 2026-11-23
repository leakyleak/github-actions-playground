import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Convert an HTMLImageElement to a base64 JPEG data URL
function imageToDataUrl(img, quality = 0.92) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return c.toDataURL('image/jpeg', quality);
}

// Export a 100% self-contained single-file HTML for the active Photo+ Deconstructed Rig
export function exportPortablePhotoHtml(rig) {
  if (!rig || !rig.loaded || !rig.image) {
    throw new Error('Photo+ rig image not loaded yet.');
  }

  const plateDataUrl = imageToDataUrl(rig.image, 0.92);
  const rigDataCopy = {
    ...rig.data,
    plateUrl: plateDataUrl
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${rig.data.name} — Portable Photo+ Rig</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #090e16; font-family: system-ui, sans-serif; color: #f4f7fc; }
    canvas { display: block; width: 100%; height: 100%; }
    .hud { position: fixed; bottom: 12px; left: 12px; right: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 10px 14px; border-radius: 10px; background: rgba(10,15,24,0.78); border: 1px solid rgba(255,255,255,0.14); backdrop-filter: blur(10px); font-size: 12px; }
    .hud label { display: flex; align-items: center; gap: 6px; }
    .hud input[type="range"] { width: 90px; accent-color: #f5a550; }
    .hud button { padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(255,198,122,0.5); background: rgba(245,165,80,0.22); color: #fff6e6; cursor: pointer; font-size: 12px; }
    .hud button.off { opacity: 0.45; }
  </style>
</head>
<body>
  <canvas id="c"></canvas>
  <div class="hud">
    <strong>${rig.data.name}</strong>
    <label>Time <input id="tod" type="range" min="0" max="100" value="36" /></label>
    <label>Windows <input id="lit" type="range" min="5" max="90" value="42" /></label>
    <label>Traffic <input id="spd" type="range" min="0" max="250" value="100" /></label>
    <button id="dbg" class="off">Mask &amp; Spline Overlay</button>
  </div>
  <script>
    // Calibrated Photo+ Rig Data (perspective building quads, exclusion masks & highway lane splines)
    const RIG_DATA = ${JSON.stringify(rigDataCopy)};

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    function mulberry32(seed) {
      let a = seed >>> 0;
      return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function bilerpQuad(q, u, v) {
      return [lerp(lerp(q[0][0], q[1][0], u), lerp(q[3][0], q[2][0], u), v), lerp(lerp(q[0][1], q[1][1], u), lerp(q[3][1], q[2][1], u), v)];
    }
    function pointInPolygon(px, py, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
      }
      return inside;
    }
    function sampleLane(waypoints, lanesPerSide, laneIndex, sRaw) {
      const s = clamp(sRaw, 0, 1);
      const perspT = Math.pow(s, 1.55);
      const y = lerp(waypoints[0][0], waypoints[waypoints.length - 1][0], perspT);
      let seg = 0;
      for (let i = 0; i < waypoints.length - 1; i++) { if (y >= waypoints[i][0] && y <= waypoints[i + 1][0]) { seg = i; break; } }
      const A = waypoints[seg], B = waypoints[seg + 1];
      const f = clamp((y - A[0]) / Math.max(1e-5, B[0] - A[0]), 0, 1);
      const lxAt = (wp) => laneIndex < lanesPerSide ? lerp(wp[1], wp[2], (laneIndex + 0.5) / lanesPerSide) : lerp(wp[2], wp[3], (laneIndex - lanesPerSide + 0.5) / lanesPerSide);
      const xA = lxAt(A), xB = lxAt(B);
      return { x: lerp(xA, xB, f), y, dx: xB - xA, dy: B[0] - A[0], depth: perspT };
    }

    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; };
    addEventListener('resize', resize); resize();

    // Build clipped windows & spline vehicles
    const rand = mulberry32(8821);
    const windows = [];
    for (const b of RIG_DATA.buildings) {
      for (let r = 0; r < b.rows; r++) {
        const floorBias = rand() < b.cluster ? 0.25 + rand() * 0.45 : rand() * 0.25;
        for (let c = 0; c < b.cols; c++) {
          const u0 = (c + b.padX * 0.5) / b.cols, u1 = (c + 1 - b.padX * 0.5) / b.cols;
          const v0 = (r + b.padY * 0.5) / b.rows, v1 = (r + 1 - b.padY * 0.5) / b.rows;
          const [cx, cy] = bilerpQuad(b.quad, (u0 + u1) * 0.5, (v0 + v1) * 0.5);
          if ((RIG_DATA.exclusionPolygons || []).some((ex) => pointInPolygon(cx, cy, ex))) continue;
          const cp = rand();
          const rgb = cp < 0.64 ? [255, 220, 138] : cp < 0.84 ? [255, 178, 86] : [190, 235, 255];
          windows.push({ corners: [bilerpQuad(b.quad, u0, v0), bilerpQuad(b.quad, u1, v0), bilerpQuad(b.quad, u1, v1), bilerpQuad(b.quad, u0, v1)], threshold: clamp(rand() * 0.72 + (1 - floorBias) * 0.28, 0.02, 0.98), rgb, intensity: 0.72 + rand() * 0.38 });
        }
      }
    }
    const vehicles = [];
    const totalLanes = RIG_DATA.lanesPerSide * 2;
    const cols = ['#1e242d', '#38424f', '#8b939c', '#e5a922', '#c8cdd2', '#4f2121'];
    for (let lane = 0; lane < totalLanes; lane++) {
      const incoming = lane < RIG_DATA.lanesPerSide;
      for (let k = 0; k < 7; k++) vehicles.push({ lane, incoming, s: (k + rand() * 0.7) / 7, speed: (0.095 + (lane % RIG_DATA.lanesPerSide) * 0.022) * (0.9 + rand() * 0.2), color: rand() < 0.28 ? '#e5a922' : cols[Math.floor(rand() * cols.length)] });
    }

    let tod = 0.36, litRatio = 0.42, trafficSpeed = 1.0, showDebug = false, mx = 0, my = 0;
    document.getElementById('tod').oninput = (e) => tod = e.target.value / 100;
    document.getElementById('lit').oninput = (e) => litRatio = e.target.value / 100;
    document.getElementById('spd').oninput = (e) => trafficSpeed = e.target.value / 100;
    const dbgBtn = document.getElementById('dbg');
    dbgBtn.onclick = () => { showDebug = !showDebug; dbgBtn.classList.toggle('off', !showDebug); };
    addEventListener('pointermove', (e) => { mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1; });

    const img = new Image();
    img.src = RIG_DATA.plateUrl;
    img.onload = () => {
      let last = performance.now();
      function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min((now - last) * 0.001, 0.05); last = now;
        const w = canvas.width, h = canvas.height;
        const aspect = img.width / img.height, vAspect = w / h;
        const drawW = vAspect > aspect ? w * 1.04 : h * 1.04 * aspect;
        const drawH = drawW / aspect;
        const ox = (w - drawW) * 0.5 - mx * (drawW - w) * 0.4;
        const oy = (h - drawH) * 0.5 - my * (drawH - h) * 0.4;
        const toScr = (nx, ny) => [ox + nx * drawW, oy + ny * drawH];
        const night = clamp((tod - 0.15) / 0.85, 0, 1);

        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.filter = \`brightness(\${lerp(1.06, 0.44, night).toFixed(2)}) contrast(1.06)\`;
        ctx.drawImage(img, ox, oy, drawW, drawH);
        ctx.restore();

        // Clipped perspective windows
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const effLit = clamp(litRatio + night * 0.22, 0.04, 0.94);
        for (const win of windows) {
          if (win.threshold > effLit) continue;
          const pts = win.corners.map(([x, y]) => toScr(x, y));
          ctx.fillStyle = \`rgba(\${win.rgb[0]},\${win.rgb[1]},\${win.rgb[2]},\${clamp(win.intensity * (0.4 + 0.85 * night), 0.1, 0.95).toFixed(2)})\`;
          ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        // Perspective spline traffic
        for (const v of vehicles) {
          v.s = (v.s + (v.incoming ? 1 : -1) * v.speed * trafficSpeed * dt + 1) % 1;
        }
        const sorted = vehicles.map((v) => ({ v, s: sampleLane(RIG_DATA.highwayWaypoints, RIG_DATA.lanesPerSide, v.lane, v.s) })).sort((a, b) => a.s.y - b.s.y);
        for (const { v, s } of sorted) {
          const [sx, sy] = toScr(s.x, s.y);
          const tLen = Math.hypot(s.dx * drawW, s.dy * drawH) || 1;
          const ux = (s.dx * drawW) / tLen, uy = (s.dy * drawH) / tLen, px = -uy, py = ux;
          const sc = lerp(RIG_DATA.vehicleScaleFar, RIG_DATA.vehicleScaleNear, s.depth) * (drawW / 1376);
          const fL = 13.5 * sc, hW = 7.8 * sc;
          ctx.fillStyle = v.color;
          ctx.beginPath();
          ctx.moveTo(sx + ux * fL - px * hW, sy + uy * fL - py * hW);
          ctx.lineTo(sx + ux * fL + px * hW, sy + uy * fL + py * hW);
          ctx.lineTo(sx - ux * fL + px * hW, sy - uy * fL + py * hW);
          ctx.lineTo(sx - ux * fL - px * hW, sy - uy * fL - py * hW);
          ctx.closePath(); ctx.fill();

          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (const side of [-0.65, 0.65]) {
            const lx = sx + ux * fL * 0.9 + px * hW * side, ly = sy + uy * fL * 0.9 + py * hW * side;
            ctx.fillStyle = v.incoming ? 'rgba(255,244,210,0.88)' : 'rgba(255,40,24,0.85)';
            ctx.beginPath(); ctx.arc(lx, ly, Math.max(2, 5.2 * sc), 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }

        if (showDebug) {
          ctx.save();
          for (const b of RIG_DATA.buildings) {
            const pts = b.quad.map(([x, y]) => toScr(x, y));
            ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
            ctx.strokeStyle = 'rgba(255,215,40,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
          }
          for (let l = 0; l < totalLanes; l++) {
            ctx.beginPath();
            for (let k = 0; k <= 24; k++) { const sp = sampleLane(RIG_DATA.highwayWaypoints, RIG_DATA.lanesPerSide, l, k / 24); const [x, y] = toScr(sp.x, sp.y); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
            ctx.strokeStyle = l < RIG_DATA.lanesPerSide ? '#00f0ff' : '#ff4b4b'; ctx.lineWidth = 2; ctx.stroke();
          }
          ctx.restore();
        }
      }
      requestAnimationFrame(frame);
    };
  </script>
</body>
</html>`;

  const filename = rig.data.id === 'bridge_photo' ? 'nyc_bridge_alive_portable.html' : 'nyc_street_alive_portable.html';
  triggerDownload(new Blob([html], { type: 'text/html' }), filename);
}

// Export a Three.js 3D scene group as a binary .glb file using GLTFExporter
export async function exportSceneGlb(sourceGroup, filename = 'nyc_3d_scene.glb') {
  const exporter = new GLTFExporter();

  // Build an export-safe clone where ShaderMaterial meshes get standard PBR fallback materials
  // so GLTFExporter produces a clean, 100% spec-compliant .glb for Claude / Blender / Three.js
  const exportGroup = sourceGroup.clone(true);
  const fallbackGlassMat = new THREE.MeshStandardMaterial({
    color: 0x2d5168,
    roughness: 0.22,
    metalness: 0.72
  });
  const fallbackWaterMat = new THREE.MeshStandardMaterial({
    color: 0x1a384c,
    roughness: 0.12,
    metalness: 0.85
  });

  const toRemove = [];
  exportGroup.traverse((obj) => {
    if (obj.isSprite || obj.isLineSegments || obj.isLine) {
      // Keep structural lines/sprites only if standard, skip custom shader additive glow sprites
      if (obj.material && obj.material.isShaderMaterial) {
        toRemove.push(obj);
      }
      return;
    }
    if (obj.isMesh && obj.material && obj.material.isShaderMaterial) {
      // Skip invisible/custom billboard glow quad
      if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.aPosSize) {
        toRemove.push(obj);
      } else if (obj.geometry && obj.geometry.type === 'PlaneGeometry' && obj.position.y === 0) {
        obj.material = fallbackWaterMat;
      } else {
        obj.material = fallbackGlassMat;
      }
    }
  });
  toRemove.forEach((o) => o.parent && o.parent.remove(o));

  const buffer = await new Promise((resolve, reject) => {
    exporter.parse(
      exportGroup,
      (res) => resolve(res),
      (err) => reject(err),
      { binary: true }
    );
  });

  triggerDownload(new Blob([buffer], { type: 'model/gltf-binary' }), filename);
}
