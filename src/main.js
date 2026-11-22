import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  NoiseEffect,
  BlendFunction
} from 'postprocessing';

import { loadAllAssets, createGlowSpriteTexture } from './utils/assets.js';
import { getAtmosphere, clamp, lerp } from './utils/rng.js';
import { createSkyLayer } from './layers/skyLayer.js';
import { createFarSkylineLayer } from './layers/farSkylineLayer.js';
import { createMidCityLayer } from './layers/midCityLayer.js';
import { createStreetCanyonLayer, createTenementWindowMaterial } from './layers/streetCanyonLayer.js';
import { createForegroundFrameLayer } from './layers/foregroundFrameLayer.js';

function createDepthSliceGuides() {
  const group = new THREE.Group();
  const addLine = (a, b, color) => {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...a),
      new THREE.Vector3(...b)
    ]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 });
    group.add(new THREE.Line(geom, mat));
  };
  const addPlane = (z, w, h, color) => {
    addLine([-w, 0.2, z], [w, 0.2, z], color);
    addLine([-w, 0.2, z], [-w, h, z], color);
    addLine([w, 0.2, z], [w, h, z], color);
    addLine([-w, h, z], [w, h, z], color);
  };

  // Window camera frustum indicator at (0, 17.5, 2)
  const cam = [0, 17.5, 2.0];
  const corners = [[-16, 4, -18], [16, 4, -18], [16, 26, -18], [-16, 26, -18]];
  corners.forEach((p, i) => {
    addLine(cam, p, 0xffe494);
    addLine(p, corners[(i + 1) % 4], 0xffe494);
  });

  // 5 Layer distance planes
  addPlane(-10, 22, 36, 0xff7b54);   // 5 Foreground Frame (~10m)
  addPlane(-142, 28, 30, 0xffc454);  // 4 Street Canyon end (142m)
  addPlane(-325, 220, 120, 0x5cd4ff); // 3 Mid City back (325m)
  addPlane(-485, 340, 220, 0x829eff); // 2 Far Skyline arc (485m)

  group.visible = false;
  return group;
}

async function init() {
  const canvas = document.getElementById('glCanvas');
  const loaderEl = document.getElementById('loader');
  const statsBadge = document.getElementById('statsBadge');
  const hintBadge = document.getElementById('hintBadge');
  const sliceHint = document.getElementById('sliceHint');

  // 1. Renderer (HDR pipeline; SMAA handles antialiasing cleanly in EffectComposer)
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // Handled in postprocessing ToneMappingEffect

  // 2. Scene & Fog
  const scene = new THREE.Scene();
  const sceneFog = new THREE.FogExp2(0xd9a88a, 0.0020);
  scene.fog = sceneFog;

  // 3. Camera & OrbitControls (active in Depth Slice mode)
  const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.5, 1800);
  camera.position.set(0, 17.5, 2.0);
  camera.lookAt(0, 16.0, -120);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.set(0, 40, -215);
  controls.minDistance = 120;
  controls.maxDistance = 680;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.enabled = false;

  // 4. Load Poly Haven CC0 HDRI & PBR Textures
  const assets = await loadAllAssets(renderer);
  const glowTex = createGlowSpriteTexture();
  scene.environment = assets.envMap;

  // 5. Twilight Lighting Rig (Sky Hemisphere + Backlight Sun + Warm Street Canyon Bounce)
  const hemiLight = new THREE.HemisphereLight(0x467996, 0x4a2916, 1.35);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffa663, 1.05);
  sunLight.position.set(-45, 52, -220);
  scene.add(sunLight);

  // Subtle warm sodium-vapor bounce lights down the street canyon so PBR brick normal maps pop!
  const streetLights = [];
  for (const lz of [-22, -52, -86, -120]) {
    const pl = new THREE.PointLight(0xff8c38, 28, 38, 1.6);
    pl.position.set(0, 5.5, lz);
    scene.add(pl);
    streetLights.push(pl);
  }

  // 6. Build the 5 Real-Distance Layers
  const tenementWin = createTenementWindowMaterial(assets.hdriEquirect);
  const skyLayer = createSkyLayer(assets.hdriEquirect);
  const farSkylineLayer = createFarSkylineLayer(glowTex);
  const midCityLayer = createMidCityLayer(assets.hdriEquirect);
  const streetLayer = createStreetCanyonLayer(assets, glowTex, tenementWin);
  const frameLayer = createForegroundFrameLayer(assets, tenementWin);
  const sliceGuides = createDepthSliceGuides();

  scene.add(
    skyLayer.group,
    farSkylineLayer.group,
    midCityLayer.group,
    streetLayer.group,
    frameLayer.group,
    sliceGuides
  );

  // 7. Cinematic Post-Processing Pipeline (SMAA + Mipmap Blur Bloom + ACES Filmic + Vignette + Subtle Grain)
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  const smaaEffect = new SMAAEffect({ preset: SMAAPreset.HIGH });
  const bloomEffect = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: 0.92,
    luminanceSmoothing: 0.28,
    intensity: 0.72,
    radius: 0.68
  });
  const toneMappingEffect = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const vignetteEffect = new VignetteEffect({ eskil: false, offset: 0.24, darkness: 0.44 });
  const noiseEffect = new NoiseEffect({ blendFunction: BlendFunction.SOFT_LIGHT });
  noiseEffect.blendMode.opacity.value = 0.045;

  composer.addPass(
    new EffectPass(camera, smaaEffect, bloomEffect, toneMappingEffect, vignetteEffect, noiseEffect)
  );

  // 8. State & UI Bindings
  const state = {
    tod: 0.36,
    fogScale: 1.0,
    litRatio: 0.32,
    bloomScale: 1.0,
    trafficSpeed: 1.0,
    exposure: 1.08,
    mode: 'window', // 'window' | 'slice'
    autoSway: true,
    mouseX: 0,
    mouseY: 0,
    mouseActive: false,
    curParX: 0,
    curParY: 0,
    modeBlend: 0
  };

  const layerMap = {
    sky: skyLayer.group,
    skyline: farSkylineLayer.group,
    mid: midCityLayer.group,
    street: streetLayer.group,
    frame: frameLayer.group
  };

  const slTod = document.getElementById('slTod');
  const slFog = document.getElementById('slFog');
  const slLit = document.getElementById('slLit');
  const slBloom = document.getElementById('slBloom');
  const slTraffic = document.getElementById('slTraffic');
  const slExp = document.getElementById('slExp');

  const valTod = document.getElementById('valTod');
  const valFog = document.getElementById('valFog');
  const valLit = document.getElementById('valLit');
  const valBloom = document.getElementById('valBloom');
  const valTraffic = document.getElementById('valTraffic');
  const valExp = document.getElementById('valExp');

  const todLabel = (v) => (v < 0.20 ? 'Sunset' : v < 0.54 ? 'Twilight' : v < 0.84 ? 'Dusk' : 'Night');

  slTod.addEventListener('input', () => {
    state.tod = slTod.value / 100;
    valTod.textContent = todLabel(state.tod);
  });
  slFog.addEventListener('input', () => {
    state.fogScale = slFog.value / 100;
    valFog.textContent = `${slFog.value}%`;
  });
  slLit.addEventListener('input', () => {
    state.litRatio = slLit.value / 100;
    valLit.textContent = `${slLit.value}%`;
  });
  slBloom.addEventListener('input', () => {
    state.bloomScale = slBloom.value / 100;
    valBloom.textContent = `${slBloom.value}%`;
  });
  slTraffic.addEventListener('input', () => {
    state.trafficSpeed = slTraffic.value / 100;
    valTraffic.textContent = `${state.trafficSpeed.toFixed(1)}×`;
  });
  slExp.addEventListener('input', () => {
    state.exposure = slExp.value / 100;
    valExp.textContent = state.exposure.toFixed(2);
  });

  const btnWindow = document.getElementById('btnWindow');
  const btnSlice = document.getElementById('btnSlice');
  const btnSway = document.getElementById('btnSway');

  const sliceStartPos = new THREE.Vector3(295, 162, 22);
  const sliceTarget = new THREE.Vector3(0, 40, -215);

  function setMode(m) {
    state.mode = m;
    btnWindow.classList.toggle('active', m === 'window');
    btnSlice.classList.toggle('active', m === 'slice');
    sliceHint.classList.toggle('hidden', m !== 'slice');
    hintBadge.textContent = m === 'window' ? 'Move cursor for rooftop parallax' : 'Inspecting 5 depth layers';
    if (m === 'slice') {
      camera.position.copy(sliceStartPos);
      controls.target.copy(sliceTarget);
      controls.enabled = true;
      controls.update();
      sliceGuides.visible = true;
    } else {
      controls.enabled = false;
      sliceGuides.visible = false;
    }
  }

  btnWindow.addEventListener('click', () => setMode('window'));
  btnSlice.addEventListener('click', () => setMode('slice'));
  btnSway.addEventListener('click', () => {
    state.autoSway = !state.autoSway;
    btnSway.classList.toggle('active', state.autoSway);
  });

  document.querySelectorAll('.layer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.layer;
      const obj = layerMap[key];
      obj.visible = !obj.visible;
      btn.classList.toggle('active', obj.visible);
      btn.classList.toggle('off', !obj.visible);
    });
  });

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    state.mouseY = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    state.mouseActive = true;
  });
  canvas.addEventListener('pointerleave', () => {
    state.mouseActive = false;
  });

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
  });

  // Hide loading overlay
  loaderEl.classList.add('done');

  // 9. Animation Loop
  const atm = getAtmosphere(state.tod);
  let lastNow = performance.now();
  let fpsSmooth = 60;
  let lastHud = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastNow) * 0.001, 0.05);
    lastNow = now;
    const tSec = now * 0.001;
    if (dt > 0) fpsSmooth = lerp(fpsSmooth, 1 / dt, 0.08);

    // Update Atmosphere & Lighting
    getAtmosphere(state.tod, atm);
    const isSlice = state.mode === 'slice';
    const fogDensity = 0.0020 * state.fogScale * (isSlice ? 0.35 : 1.0);

    sceneFog.color.copy(atm.fogCol);
    sceneFog.density = fogDensity;
    scene.environmentIntensity = atm.envIntensity * state.exposure;

    hemiLight.color.copy(atm.ambientSky);
    hemiLight.groundColor.copy(atm.ambientGround);
    hemiLight.intensity = 1.35 * state.exposure;

    sunLight.color.copy(atm.sunLight);
    sunLight.intensity = atm.sunIntensity * state.exposure;

    const bounceInt = (22 + 22 * atm.emissiveBoost) * state.exposure;
    for (const pl of streetLights) pl.intensity = bounceInt;

    bloomEffect.intensity = 0.72 * state.bloomScale;

    // Camera Parallax (Window) vs Orbit (Depth Slice)
    if (!isSlice) {
      let tx = 0;
      let ty = 0;
      if (state.mouseActive) {
        tx = state.mouseX;
        ty = state.mouseY;
      } else if (state.autoSway) {
        tx = Math.sin(tSec * 0.52) * 0.75;
        ty = Math.sin(tSec * 0.88) * 0.34;
      }
      state.curParX = lerp(state.curParX, tx, Math.min(1, dt * 4.8));
      state.curParY = lerp(state.curParY, ty, Math.min(1, dt * 4.8));

      camera.fov = 56;
      camera.updateProjectionMatrix();
      camera.position.set(state.curParX * 2.55, 17.5 - state.curParY * 1.05, 2.0);
      camera.lookAt(state.curParX * 0.45, 15.8 - state.curParY * 0.35, -120.0);
    } else {
      controls.update();
    }

    // Update 5 Layers
    tenementWin.uniforms.uLitRatio.value = clamp(state.litRatio + atm.nightFactor * 0.14, 0.05, 0.90);
    tenementWin.uniforms.uEmissiveBoost.value = atm.emissiveBoost * state.exposure;

    skyLayer.update(atm, tSec, camera.position);
    farSkylineLayer.update(atm, fogDensity, state.litRatio, tSec);
    midCityLayer.update(atm, fogDensity, state.litRatio);
    streetLayer.update(dt, tSec, state.trafficSpeed, atm);

    composer.render(dt);

    if (now - lastHud > 260) {
      lastHud = now;
      const totalInst = midCityLayer.instanceCount + streetLayer.instanceCount;
      statsBadge.textContent = `5 layers · ${totalInst.toLocaleString()} inst · ${Math.round(fpsSmooth)} fps`;
    }
  }

  requestAnimationFrame(animate);
}

init().catch((err) => {
  console.error(err);
  const el = document.querySelector('.loader-text');
  if (el) el.textContent = `Error: ${err.message}`;
});
