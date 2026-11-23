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
import { createBrooklynBridge3DScene } from './layers/brooklynBridge3DLayer.js';
import { PhotoPlusRig, BRIDGE_RIG_DATA, MIDTOWN_RIG_DATA } from './photoPlus/photoPlusRig.js';

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
  addPlane(-10, 22, 36, 0xff7b54);    // 5 Foreground Frame (~10m)
  addPlane(-142, 28, 30, 0xffc454);   // 4 Street Canyon end (142m)
  addPlane(-325, 220, 120, 0x5cd4ff); // 3 Mid City back (325m)
  addPlane(-485, 340, 220, 0x829eff); // 2 Far Skyline arc (485m)

  group.visible = false;
  return group;
}

async function init() {
  const glCanvas = document.getElementById('glCanvas');
  const photoCanvas = document.getElementById('photoCanvas');
  const photoCtx = photoCanvas.getContext('2d');
  const loaderEl = document.getElementById('loader');
  const statsBadge = document.getElementById('statsBadge');
  const hintBadge = document.getElementById('hintBadge');
  const sliceHint = document.getElementById('sliceHint');
  const roomFrameOverlay = document.getElementById('roomFrameOverlay');
  const photoLayerBar = document.getElementById('photoLayerBar');
  const threeLayerBar = document.getElementById('threeLayerBar');

  // 1. Initialize Photo+ Deconstructed Rigs (Brooklyn Bridge & FDR Drive + Midtown Avenue)
  const bridgePhotoRig = new PhotoPlusRig(BRIDGE_RIG_DATA);
  const midtownPhotoRig = new PhotoPlusRig(MIDTOWN_RIG_DATA);

  // 2. Initialize 3D WebGL Renderer (HDR pipeline + SMAA in EffectComposer)
  const renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false
  });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  function resizePhotoCanvas() {
    photoCanvas.width = Math.round(window.innerWidth * dpr);
    photoCanvas.height = Math.round(window.innerHeight * dpr);
  }
  resizePhotoCanvas();

  // 3. 3D Scene, Fog & Camera
  const scene = new THREE.Scene();
  const sceneFog = new THREE.FogExp2(0xd9a88a, 0.0020);
  scene.fog = sceneFog;

  const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.5, 1800);
  camera.position.set(0, 17.5, 2.0);
  camera.lookAt(0, 16.0, -120);

  const controls = new OrbitControls(camera, glCanvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.set(0, 40, -215);
  controls.minDistance = 80;
  controls.maxDistance = 680;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.enabled = false;

  // 4. Load Both Photo+ Base Plates & Poly Haven 3D HDRI/PBR Textures in parallel
  const [assets] = await Promise.all([
    loadAllAssets(renderer),
    bridgePhotoRig.load(),
    midtownPhotoRig.load()
  ]);

  const glowTex = createGlowSpriteTexture();
  scene.environment = assets.envMap;

  // 5. Twilight Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0x467996, 0x4a2916, 1.35);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffa663, 1.05);
  sunLight.position.set(-45, 52, -220);
  scene.add(sunLight);

  const streetLights = [];
  for (const lz of [-22, -52, -86, -120]) {
    const pl = new THREE.PointLight(0xff8c38, 28, 38, 1.6);
    pl.position.set(0, 5.5, lz);
    scene.add(pl);
    streetLights.push(pl);
  }

  // 6. Build 3D Manhattan Street Canyon Layers & 3D Brooklyn Bridge Waterfront Scene
  const tenementWin = createTenementWindowMaterial(assets.hdriEquirect);
  const skyLayer = createSkyLayer(assets.hdriEquirect);
  const farSkylineLayer = createFarSkylineLayer(glowTex);
  const midCityLayer = createMidCityLayer(assets.hdriEquirect);
  const streetLayer = createStreetCanyonLayer(assets, glowTex, tenementWin);
  const frameLayer = createForegroundFrameLayer(assets, tenementWin);
  const sliceGuides = createDepthSliceGuides();

  const canyon3DGroup = new THREE.Group();
  canyon3DGroup.add(
    farSkylineLayer.group,
    midCityLayer.group,
    streetLayer.group,
    frameLayer.group,
    sliceGuides
  );

  const bridge3DScene = createBrooklynBridge3DScene(assets, glowTex, tenementWin);

  scene.add(skyLayer.group, canyon3DGroup, bridge3DScene.group);

  // 7. Post-Processing Pipeline (SMAA + Mipmap Blur Bloom + ACES Filmic + Vignette + Subtle Film Grain)
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

  // 8. Unified Application State
  const state = {
    scenery: 'bridge_photo', // 'bridge_photo' | 'midtown_photo' | 'bridge_3d' | 'canyon_3d'
    tod: 0.36,
    fogScale: 1.0,
    litRatio: 0.42,
    bloomScale: 1.0,
    trafficSpeed: 1.0,
    exposure: 1.08,
    mode3d: 'window', // 'window' | 'slice'
    roomFrame: false,
    autoSway: true,
    mouseX: 0,
    mouseY: 0,
    mouseActive: false,
    curParX: 0,
    curParY: 0,
    photoLayers: {
      base: true,
      water: true,
      windows: true,
      traffic: true,
      skyLife: true,
      debug: false
    },
    threeLayerVis: {
      sky: true,
      skyline: true,
      mid: true,
      street: true,
      frame: true
    }
  };

  // Apply 3D sub-layer visibility across whichever 3D scene is active
  function sync3DLayerVisibility() {
    skyLayer.group.visible = state.threeLayerVis.sky;
    if (state.scenery === 'canyon_3d') {
      farSkylineLayer.group.visible = state.threeLayerVis.skyline;
      midCityLayer.group.visible = state.threeLayerVis.mid;
      streetLayer.group.visible = state.threeLayerVis.street;
      frameLayer.group.visible = state.threeLayerVis.frame;
    } else if (state.scenery === 'bridge_3d') {
      bridge3DScene.layers.skyline.visible = state.threeLayerVis.skyline;
      bridge3DScene.layers.bridge.visible = state.threeLayerVis.mid;
      bridge3DScene.layers.highway.visible = state.threeLayerVis.street;
      bridge3DScene.layers.water.visible = state.threeLayerVis.frame;
    }
  }

  const sceneryDescriptions = {
    bridge_photo: 'Bridge Alive (Photo+ Deconstructed: Facade Window Quads & FDR Spline Traffic)',
    midtown_photo: 'Street Alive (Photo+ Deconstructed: Midtown Skyscraper Quads & Avenue Traffic)',
    bridge_3d: 'Brooklyn Bridge & FDR Drive (True 3D PBR + Animated East River Shader)',
    canyon_3d: 'Manhattan Street Canyon (True 3D PBR + 5 Separated Depth Layers)'
  };

  const btnRoomFrame = document.getElementById('btnRoomFrame');
  const btnInspector = document.getElementById('btnInspector');
  const btnSway = document.getElementById('btnSway');
  const btnSlice = document.getElementById('btnSlice');
  const btnDebugOverlay = document.getElementById('btnDebugOverlay');
  const btnExportJson = document.getElementById('btnExportJson');

  const sliceStartPos = new THREE.Vector3(295, 162, 22);
  const sliceTarget = new THREE.Vector3(0, 40, -215);

  function set3DMode(m) {
    state.mode3d = m;
    btnSlice.classList.toggle('active', m === 'slice');
    sliceHint.classList.toggle('hidden', m !== 'slice');
    if (m === 'slice') {
      camera.position.copy(sliceStartPos);
      controls.target.copy(sliceTarget);
      controls.enabled = true;
      controls.update();
      sliceGuides.visible = state.scenery === 'canyon_3d';
    } else {
      controls.enabled = false;
      sliceGuides.visible = false;
    }
    syncInspectorBtnState();
  }

  function syncInspectorBtnState() {
    const isPhoto = state.scenery === 'bridge_photo' || state.scenery === 'midtown_photo';
    const active = isPhoto ? state.photoLayers.debug : state.mode3d === 'slice';
    btnInspector.classList.toggle('active', active);
  }

  function setScenery(sceneryId) {
    state.scenery = sceneryId;
    const isPhoto = sceneryId === 'bridge_photo' || sceneryId === 'midtown_photo';

    document.querySelectorAll('.scenery-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.scenery === sceneryId);
    });

    photoCanvas.classList.toggle('hidden', !isPhoto);
    glCanvas.classList.toggle('hidden', isPhoto);
    photoLayerBar.classList.toggle('hidden', !isPhoto);
    threeLayerBar.classList.toggle('hidden', isPhoto);

    canyon3DGroup.visible = sceneryId === 'canyon_3d';
    bridge3DScene.group.visible = sceneryId === 'bridge_3d';

    if (!isPhoto) {
      sync3DLayerVisibility();
      if (state.mode3d === 'slice') {
        sliceGuides.visible = sceneryId === 'canyon_3d';
      }
    }

    hintBadge.textContent = sceneryDescriptions[sceneryId] || '';
    syncInspectorBtnState();
  }

  // Bind Scenery Preset Buttons
  document.querySelectorAll('.scenery-btn').forEach((btn) => {
    btn.addEventListener('click', () => setScenery(btn.dataset.scenery));
  });

  // Bind Room Window Frame Preview Toggle
  btnRoomFrame.addEventListener('click', () => {
    state.roomFrame = !state.roomFrame;
    roomFrameOverlay.classList.toggle('hidden', !state.roomFrame);
    btnRoomFrame.classList.toggle('active', state.roomFrame);
  });

  // Bind Rig Inspector Button (toggles Mask & Spline Overlay in Photo+ mode, or Depth Slice Orbit in 3D mode)
  btnInspector.addEventListener('click', () => {
    const isPhoto = state.scenery === 'bridge_photo' || state.scenery === 'midtown_photo';
    if (isPhoto) {
      state.photoLayers.debug = !state.photoLayers.debug;
      btnDebugOverlay.classList.toggle('active', state.photoLayers.debug);
      btnDebugOverlay.classList.toggle('off', false);
      syncInspectorBtnState();
    } else {
      set3DMode(state.mode3d === 'slice' ? 'window' : 'slice');
    }
  });

  btnSlice.addEventListener('click', () => {
    set3DMode(state.mode3d === 'slice' ? 'window' : 'slice');
  });

  btnSway.addEventListener('click', () => {
    state.autoSway = !state.autoSway;
    btnSway.classList.toggle('active', state.autoSway);
  });

  // Bind Export Calibrated Rig JSON Button
  btnExportJson.addEventListener('click', () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      description: 'Calibrated NYC Photo+ Deconstructed Rig (Perspective Building Facade Quads, Exclusion Masks & Highway Traffic Splines)',
      scenes: {
        bridge_alive: BRIDGE_RIG_DATA,
        street_alive: MIDTOWN_RIG_DATA
      }
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nyc_photo_plus_deconstructed_rig.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Bind Photo+ Sub-Layer Buttons
  document.querySelectorAll('.photolayer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.photolayer;
      state.photoLayers[key] = !state.photoLayers[key];
      btn.classList.toggle('active', state.photoLayers[key]);
      if (key !== 'debug') {
        btn.classList.toggle('off', !state.photoLayers[key]);
      } else {
        syncInspectorBtnState();
      }
    });
  });

  // Bind 3D Sub-Layer Buttons
  document.querySelectorAll('.layer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.layer;
      state.threeLayerVis[key] = !state.threeLayerVis[key];
      btn.classList.toggle('active', state.threeLayerVis[key]);
      btn.classList.toggle('off', !state.threeLayerVis[key]);
      sync3DLayerVisibility();
    });
  });

  // Bind Sliders
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

  const todLabel = (v) => (v < 0.20 ? 'Golden Hour' : v < 0.54 ? 'Twilight' : v < 0.84 ? 'Blue Hour' : 'Night');

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

  // Pointer parallax on both canvases
  const onPointerMove = (e) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    state.mouseX = clamp((e.clientX / w) * 2 - 1, -1, 1);
    state.mouseY = clamp((e.clientY / h) * 2 - 1, -1, 1);
    state.mouseActive = true;
  };
  const onPointerLeave = () => {
    state.mouseActive = false;
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerleave', onPointerLeave);

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    resizePhotoCanvas();
  });

  // Expose programmatic API on window.NYCBackdrop for easy integration or inspection
  window.NYCBackdrop = {
    state,
    setScenery,
    bridgePhotoRig,
    midtownPhotoRig,
    BRIDGE_RIG_DATA,
    MIDTOWN_RIG_DATA
  };

  // Start in Bridge Alive (Photo+) mode and hide loading screen
  setScenery('bridge_photo');
  loaderEl.classList.add('done');

  // 9. Unified Animation Loop
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

    // Smooth parallax offset
    let tx = 0;
    let ty = 0;
    if (state.mouseActive) {
      tx = state.mouseX;
      ty = state.mouseY;
    } else if (state.autoSway) {
      tx = Math.sin(tSec * 0.52) * 0.72;
      ty = Math.sin(tSec * 0.88) * 0.32;
    }
    state.curParX = lerp(state.curParX, tx, Math.min(1, dt * 4.8));
    state.curParY = lerp(state.curParY, ty, Math.min(1, dt * 4.8));

    const isPhoto = state.scenery === 'bridge_photo' || state.scenery === 'midtown_photo';

    if (isPhoto) {
      // Update & Render Active Photo+ Deconstructed Rig
      const activeRig = state.scenery === 'bridge_photo' ? bridgePhotoRig : midtownPhotoRig;
      activeRig.update(dt, tSec, state.trafficSpeed);
      const stats = activeRig.render(photoCtx, photoCanvas.width, photoCanvas.height, {
        ...state,
        time: tSec
      });

      if (now - lastHud > 260) {
        lastHud = now;
        statsBadge.textContent = `${stats.buildings} facades · ${stats.activeWindows.toLocaleString()}/${stats.totalWindows.toLocaleString()} windows · ${stats.vehicles} cars · ${Math.round(fpsSmooth)} fps`;
      }
    } else {
      // Update & Render Active 3D WebGL PBR Scene
      getAtmosphere(state.tod, atm);
      const isSlice = state.mode3d === 'slice';
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

      if (!isSlice) {
        if (state.scenery === 'bridge_3d') {
          camera.fov = 52;
          camera.updateProjectionMatrix();
          camera.position.set(8.0 + state.curParX * 3.2, 22.5 - state.curParY * 1.3, 6.0);
          camera.lookAt(-8.0 + state.curParX * 0.6, 20.0 - state.curParY * 0.4, -145.0);
        } else {
          camera.fov = 56;
          camera.updateProjectionMatrix();
          camera.position.set(state.curParX * 2.55, 17.5 - state.curParY * 1.05, 2.0);
          camera.lookAt(state.curParX * 0.45, 15.8 - state.curParY * 0.35, -120.0);
        }
      } else {
        controls.update();
      }

      tenementWin.uniforms.uLitRatio.value = clamp(state.litRatio + atm.nightFactor * 0.14, 0.05, 0.90);
      tenementWin.uniforms.uEmissiveBoost.value = atm.emissiveBoost * state.exposure;

      skyLayer.update(atm, tSec, camera.position);

      if (state.scenery === 'bridge_3d') {
        bridge3DScene.update(dt, tSec, state.trafficSpeed, atm, fogDensity, state.litRatio);
      } else {
        farSkylineLayer.update(atm, fogDensity, state.litRatio, tSec);
        midCityLayer.update(atm, fogDensity, state.litRatio);
        streetLayer.update(dt, tSec, state.trafficSpeed, atm);
      }

      composer.render(dt);

      if (now - lastHud > 260) {
        lastHud = now;
        const totalInst =
          state.scenery === 'bridge_3d'
            ? bridge3DScene.instanceCount
            : midCityLayer.instanceCount + streetLayer.instanceCount;
        statsBadge.textContent = `3D PBR · ${totalInst.toLocaleString()} inst · ${Math.round(fpsSmooth)} fps`;
      }
    }
  }

  requestAnimationFrame(animate);
}

init().catch((err) => {
  console.error(err);
  const el = document.querySelector('.loader-text');
  if (el) el.textContent = `Error: ${err.message}`;
});
