// 3D Brooklyn Bridge, East River Waterfront & FDR Drive Highway Scene (Three.js + Poly Haven PBR)
// Provides a true 3D architectural counterpart to the Brooklyn Bridge & FDR Drive Photo+ scene.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, clamp, lerp } from '../utils/rng.js';

// Build the iconic Brooklyn Bridge Limestone Gothic Double-Arch Tower in 3D
function createBrooklynBridgeTower(stoneMat, archDarkMat) {
  const group = new THREE.Group();

  // Base granite pier in the East River
  const basePier = new THREE.Mesh(new THREE.BoxGeometry(28, 7, 15), stoneMat);
  basePier.position.set(0, 3.5, 0);
  group.add(basePier);

  // Three massive vertical gothic masonry buttress shafts (left, center, right)
  for (const bx of [-9.4, 0, 9.4]) {
    const w = bx === 0 ? 5.2 : 5.6;
    const buttress = new THREE.Mesh(new THREE.BoxGeometry(w, 78, 11.5), stoneMat);
    buttress.position.set(bx, 42.5, 0);
    group.add(buttress);

    // Upper tapered gothic pinnacle cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 7.5, 9.5), stoneMat);
    cap.position.set(bx, 84.5, 0);
    group.add(cap);
  }

  // Below-deck solid masonry spandrel beam (y = 7 to 25)
  const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(24.5, 18, 10.2), stoneMat);
  lowerWall.position.set(0, 16, 0);
  group.add(lowerWall);

  // Upper gothic lancet arch crown spandrel above the twin portals (y = 63 to 81)
  const upperCrown = new THREE.Mesh(new THREE.BoxGeometry(24.8, 18, 10.6), stoneMat);
  upperCrown.position.set(0, 72, 0);
  group.add(upperCrown);

  // Pointed Gothic arch lintel wedges framing the twin lancet openings (x = -4.7 and +4.7, y = 56..64)
  for (const ax of [-4.7, 4.7]) {
    const leftSlope = new THREE.Mesh(new THREE.BoxGeometry(2.6, 9.5, 10.4), stoneMat);
    leftSlope.position.set(ax - 1.6, 59.5, 0);
    leftSlope.rotation.z = -0.32;
    const rightSlope = new THREE.Mesh(new THREE.BoxGeometry(2.6, 9.5, 10.4), stoneMat);
    rightSlope.position.set(ax + 1.6, 59.5, 0);
    rightSlope.rotation.z = 0.32;
    group.add(leftSlope, rightSlope);

    // Recessed dark shadow inside arch apex
    const archBack = new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.5, 4.5), archDarkMat);
    archBack.position.set(ax, 61.5, 0);
    group.add(archBack);
  }

  // Projecting horizontal stone cornice ledges
  for (const cy of [25.5, 63.5, 81.2]) {
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(26.4, 1.8, 12.6), stoneMat);
    cornice.position.set(0, cy, 0);
    group.add(cornice);
  }

  return group;
}

// Create curved FDR Drive Highway Ribbon Geometry + Concrete Jersey Barriers
function createFdrHighwayCurve() {
  // Smooth 3D cubic spline curving along the East River waterfront from foreground right into mid-distance
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(24.5, 3.8, -6.0),
    new THREE.Vector3(23.0, 3.8, -28.0),
    new THREE.Vector3(21.5, 3.8, -56.0),
    new THREE.Vector3(19.0, 3.8, -88.0),
    new THREE.Vector3(13.5, 3.8, -122.0),
    new THREE.Vector3(2.0, 3.8, -158.0),
    new THREE.Vector3(-18.0, 3.8, -195.0)
  ]);
}

function buildRibbonGeometry(curve, halfWidth, yOffset = 0, segments = 72) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    // Horizontal perpendicular vector in XZ plane
    const perp = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    const left = pt.clone().addScaledVector(perp, -halfWidth);
    const right = pt.clone().addScaledVector(perp, halfWidth);

    positions.push(left.x, left.y + yOffset, left.z);
    positions.push(right.x, right.y + yOffset, right.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, t * 24, 1, t * 24);

    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  return geom;
}

// Low-poly 3D sedan/taxi & SUV geometries for FDR Drive 3D traffic
function createHighwayVehicleGeom() {
  const parts = [];
  const body = new THREE.BoxGeometry(1.78, 0.62, 4.15);
  body.translate(0, 0.52, 0);
  const cabin = new THREE.BoxGeometry(1.54, 0.54, 2.08);
  cabin.translate(0, 1.06, -0.15);
  parts.push(body, cabin);
  for (const wx of [-0.82, 0.82]) {
    for (const wz of [-1.25, 1.25]) {
      const w = new THREE.CylinderGeometry(0.30, 0.30, 0.24, 10);
      w.rotateZ(Math.PI / 2);
      w.translate(wx, 0.30, wz);
      parts.push(w);
    }
  }
  return mergeGeometries(parts, false);
}

export function createBrooklynBridge3DScene(assets, glowTex, tenementWin) {
  const root = new THREE.Group();
  root.name = 'BrooklynBridge3DScene';
  root.visible = false;

  const gWater = new THREE.Group();
  const gBridge = new THREE.Group();
  const gHighway = new THREE.Group();
  const gSkyline = new THREE.Group();
  root.add(gWater, gBridge, gHighway, gSkyline);

  // -------------------------------------------------------------------------
  // 1. ANIMATED 3D EAST RIVER WATER SURFACE SHADER
  // -------------------------------------------------------------------------
  const waterUniforms = {
    uHdri: { value: assets.hdriEquirect },
    uTime: { value: 0 },
    uHorizon: { value: new THREE.Color(0xffbd7a) },
    uZenith: { value: new THREE.Color(0x1f6b8c) },
    uFogCol: { value: new THREE.Color(0xd9a88a) },
    uFogDensity: { value: 0.0018 },
    uEmissiveBoost: { value: 1.05 }
  };

  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      #define PI 3.14159265359
      varying vec3 vWorldPos;
      varying vec2 vUv;
      uniform sampler2D uHdri;
      uniform float uTime;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uFogCol;
      uniform float uFogDensity;
      uniform float uEmissiveBoost;

      vec2 dirToEquirect(vec3 d) {
        float u = atan(d.x, -d.z) / (2.0 * PI) + 0.5 + 0.14;
        float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
        return vec2(fract(u), v);
      }

      void main() {
        vec2 p = vWorldPos.xz;
        // Multi-octave East River normal wave ripples
        float w1 = sin(p.x * 0.42 + p.y * 0.28 + uTime * 2.1);
        float w2 = cos(p.x * 0.85 - p.y * 0.62 + uTime * 2.8);
        float w3 = sin(p.x * 1.9 + p.y * 1.4 - uTime * 3.6);
        vec3 N = normalize(vec3((w1 * 0.45 + w2 * 0.35 + w3 * 0.2) * 0.095, 1.0, (w2 * 0.5 - w3 * 0.3) * 0.095));

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);

        vec3 envCol = texture2D(uHdri, dirToEquirect(R)).rgb;
        envCol = envCol / (1.0 + envCol * 0.4);
        vec3 skyTint = mix(uHorizon, uZenith, clamp(R.y * 2.2, 0.0, 1.0));
        envCol = mix(envCol, skyTint, 0.48);

        float fres = 0.15 + 0.82 * pow(1.0 - max(dot(N, V), 0.0), 3.2);
        vec3 deepWater = vec3(0.05, 0.11, 0.16) * (0.4 + 0.6 * uZenith);
        vec3 col = mix(deepWater, envCol, fres);

        // Golden sunset & skyline specular reflection columns on the East River
        vec3 sunDir = normalize(vec3(-0.22, 0.14, -0.96));
        float spec = pow(max(dot(R, sunDir), 0.0), 42.0);
        col += uHorizon * spec * 1.35;

        // Warm Lower Manhattan skyscraper window reflections shimmering in the water
        float cityReflMask = smoothstep(-25.0, 55.0, p.x) * smoothstep(-320.0, -55.0, p.y);
        float rippleBands = smoothstep(0.35, 0.92, sin(p.y * 1.8 + w1 * 2.4 + uTime * 3.0));
        col += vec3(1.0, 0.72, 0.32) * cityReflMask * rippleBands * 0.18 * uEmissiveBoost;

        float dist = length(vWorldPos - cameraPosition);
        float fog = 1.0 - exp(-dist * uFogDensity * 0.65);
        col = mix(col, mix(uFogCol, uHorizon, 0.45), clamp(fog, 0.0, 0.85));

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(900, 750), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(-80, 0, -240);
  gWater.add(waterMesh);

  // -------------------------------------------------------------------------
  // 2. 3D BROOKLYN BRIDGE (Gothic Limestone Tower + Suspension Cables + Deck)
  // -------------------------------------------------------------------------
  const stoneMat = new THREE.MeshStandardMaterial({
    map: assets.brickDark.map.clone(),
    normalMap: assets.brickDark.normalMap.clone(),
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: assets.brickDark.roughnessMap.clone(),
    color: new THREE.Color(0x9a8878),
    roughness: 0.88,
    metalness: 0.06
  });
  stoneMat.map.repeat.set(4, 10);
  stoneMat.normalMap.repeat.set(4, 10);
  stoneMat.roughnessMap.repeat.set(4, 10);

  const archDarkMat = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.95 });
  const steelCableMat = new THREE.MeshStandardMaterial({
    color: 0x3b3835,
    roughness: 0.45,
    metalness: 0.78
  });

  // Position Brooklyn Bridge Manhattan tower on the left looking across East River
  const towerPos = new THREE.Vector3(-48, 0, -108);
  const bridgeTower = createBrooklynBridgeTower(stoneMat, archDarkMat);
  bridgeTower.position.copy(towerPos);
  // Orient tower perpendicular to bridge deck span (deck runs from Brooklyn on left to Manhattan on right)
  const bridgeAngle = -0.18;
  bridgeTower.rotation.y = Math.PI / 2 + bridgeAngle;
  gBridge.add(bridgeTower);

  // Bridge elevated steel truss roadway deck crossing from left (-165, 25, -130) through tower (-48, 25, -108) into Manhattan anchorage (62, 22, -88)
  const deckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-175, 24.5, -132),
    new THREE.Vector3(-48, 25.5, -108),
    new THREE.Vector3(68, 21.5, -86)
  ]);
  const deckGeom = buildRibbonGeometry(deckCurve, 7.5, 0, 48);
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x36322f,
    roughness: 0.72,
    metalness: 0.48,
    side: THREE.DoubleSide
  });
  gBridge.add(new THREE.Mesh(deckGeom, deckMat));

  // Side truss girders along the bridge deck
  const trussSideGeom = buildRibbonGeometry(deckCurve, 7.8, 1.8, 48);
  gBridge.add(new THREE.Mesh(trussSideGeom, steelCableMat));

  // 4 Main Parabolic Suspension Cables + Vertical Suspender Ropes + Diagonal Roebling Stay Cables
  const cableLines = [];
  const addCableSegment = (pA, pB) => {
    cableLines.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
  };

  const towerTopCenter = new THREE.Vector3(-48, 81.5, -108);
  const deckRightEnd = new THREE.Vector3(64, 22.0, -87);
  const deckLeftEnd = new THREE.Vector3(-170, 24.8, -131);

  for (const zOffset of [-5.8, -2.1, 2.1, 5.8]) {
    const topSaddle = towerTopCenter.clone().add(new THREE.Vector3(0, 0, zOffset));

    // Right span (Tower -> Manhattan anchorage) catenary curve + vertical suspenders
    const stepsR = 36;
    let prevPt = topSaddle;
    for (let i = 1; i <= stepsR; i++) {
      const t = i / stepsR;
      const deckPt = new THREE.Vector3().lerpVectors(
        new THREE.Vector3(-48, 25.5, -108 + zOffset),
        deckRightEnd.clone().add(new THREE.Vector3(0, 0, zOffset)),
        t
      );
      // Parabolic sag from tower top down to deck anchorage
      const sagY = lerp(topSaddle.y, deckPt.y + 1.5, 1.0 - Math.pow(1.0 - t, 1.85));
      const curPt = new THREE.Vector3(deckPt.x, sagY, deckPt.z);
      addCableSegment(prevPt, curPt);
      prevPt = curPt;

      // Vertical suspender cable + Roebling diagonal stay every 2 steps
      if (i % 2 === 0) {
        addCableSegment(curPt, deckPt);
      }
      if (i % 3 === 0 && i < 26) {
        addCableSegment(topSaddle, deckPt);
      }
    }

    // Left main river span (Tower -> toward Brooklyn) catenary curve + suspenders
    const stepsL = 32;
    prevPt = topSaddle;
    for (let i = 1; i <= stepsL; i++) {
      const t = i / stepsL;
      const deckPt = new THREE.Vector3().lerpVectors(
        new THREE.Vector3(-48, 25.5, -108 + zOffset),
        deckLeftEnd.clone().add(new THREE.Vector3(0, 0, zOffset)),
        t
      );
      const sagY = lerp(topSaddle.y, deckPt.y + 3.0, Math.sin(t * Math.PI * 0.5));
      const curPt = new THREE.Vector3(deckPt.x, sagY, deckPt.z);
      addCableSegment(prevPt, curPt);
      prevPt = curPt;

      if (i % 2 === 0) {
        addCableSegment(curPt, deckPt);
      }
      if (i % 3 === 0 && i < 24) {
        addCableSegment(topSaddle, deckPt);
      }
    }
  }

  const cableGeom = new THREE.BufferGeometry();
  cableGeom.setAttribute('position', new THREE.Float32BufferAttribute(cableLines, 3));
  const cableLineMat = new THREE.LineBasicMaterial({
    color: 0x2c2a29,
    transparent: true,
    opacity: 0.78
  });
  gBridge.add(new THREE.LineSegments(cableGeom, cableLineMat));

  // -------------------------------------------------------------------------
  // 3. ELEVATED FDR DRIVE CURVED HIGHWAY + PBR ASPHALT + MOVING 3D TRAFFIC
  // -------------------------------------------------------------------------
  const fdrCurve = createFdrHighwayCurve();
  const fdrRoadGeom = buildRibbonGeometry(fdrCurve, 10.2, 0, 80);

  const fdrRoadMat = new THREE.MeshStandardMaterial({
    map: assets.asphalt.map,
    normalMap: assets.asphalt.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: assets.asphalt.roughnessMap,
    roughness: 0.68,
    metalness: 0.14,
    color: new THREE.Color(0x686b72)
  });
  gHighway.add(new THREE.Mesh(fdrRoadGeom, fdrRoadMat));

  // Elevated concrete highway deck support structure & Jersey median barrier
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x8a8682, roughness: 0.85 });
  const medianGeom = buildRibbonGeometry(fdrCurve, 0.35, 0.45, 80);
  gHighway.add(new THREE.Mesh(medianGeom, barrierMat));

  // Highway concrete support pillars along the East River edge
  const pillarGeom = new THREE.BoxGeometry(1.6, 3.8, 1.6);
  for (let i = 0; i <= 14; i++) {
    const pt = fdrCurve.getPointAt(i / 14);
    for (const side of [-8.2, 8.2]) {
      const pMesh = new THREE.Mesh(pillarGeom, barrierMat);
      pMesh.position.set(pt.x + side, 1.9, pt.z);
      gHighway.add(pMesh);
    }
  }

  // Instanced 3D vehicles driving along the curved FDR Drive spline
  const carGeom = createHighwayVehicleGeom();
  const carMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0.56,
    envMapIntensity: 1.3
  });
  const NUM_FDR_CARS = 48;
  const fdrCars = [];
  const rand = mulberry32(6102);
  const carColors = [
    new THREE.Color(0x222831),
    new THREE.Color(0x3a4452),
    new THREE.Color(0x8c939b),
    new THREE.Color(0xe0a422), // NYC Yellow Cab
    new THREE.Color(0xc5cad0),
    new THREE.Color(0x5c2220)
  ];

  // 6 lanes across the 20.4m wide FDR deck: 3 southbound (left, incoming), 3 northbound (right, outgoing)
  const laneOffsets = [-7.8, -5.2, -2.5, 2.5, 5.2, 7.8];
  for (let i = 0; i < NUM_FDR_CARS; i++) {
    const laneIdx = i % 6;
    const incoming = laneIdx < 3; // Left 3 lanes drive toward camera (t: 1 -> 0)
    fdrCars.push({
      laneOffset: laneOffsets[laneIdx] + (rand() - 0.5) * 0.28,
      t: rand(),
      incoming,
      speed: (0.068 + (laneIdx % 3) * 0.015) * (0.9 + rand() * 0.22),
      color: rand() < 0.26 ? new THREE.Color(0xe5a820) : carColors[Math.floor(rand() * carColors.length)]
    });
  }

  const fdrCarMesh = new THREE.InstancedMesh(carGeom, carMat, NUM_FDR_CARS);
  fdrCars.forEach((c, i) => fdrCarMesh.setColorAt(i, c.color));
  fdrCarMesh.instanceColor.needsUpdate = true;
  gHighway.add(fdrCarMesh);

  // Additive headlight & taillight glow sprites on FDR Drive
  const MAX_GLOWS = 180;
  const glowQuad = new THREE.PlaneGeometry(1, 1);
  const glowPosSize = new Float32Array(MAX_GLOWS * 4);
  const glowColInt = new Float32Array(MAX_GLOWS * 4);
  const glowUniforms = {
    uTex: { value: glowTex },
    uEmissiveBoost: { value: 1.05 }
  };

  const glowMat = new THREE.ShaderMaterial({
    uniforms: glowUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aPosSize;
      attribute vec4 aColInt;
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vInt;
      void main() {
        vUv = uv;
        vCol = aColInt.rgb;
        vInt = aColInt.w;
        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float dist = length(aPosSize.xyz - cameraPosition);
        float r = aPosSize.w * (1.0 + dist * 0.004);
        vec3 wp = aPosSize.xyz + (camRight * position.x + camUp * position.y) * r;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vInt;
      uniform sampler2D uTex;
      uniform float uEmissiveBoost;
      void main() {
        float a = texture2D(uTex, vUv).a;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCol * a * vInt * (0.85 + 0.35 * uEmissiveBoost), a);
      }
    `
  });

  const glowInstGeom = new THREE.InstancedBufferGeometry();
  glowInstGeom.index = glowQuad.index;
  glowInstGeom.attributes.position = glowQuad.attributes.position;
  glowInstGeom.attributes.uv = glowQuad.attributes.uv;
  const posSizeAttr = new THREE.InstancedBufferAttribute(glowPosSize, 4);
  const colIntAttr = new THREE.InstancedBufferAttribute(glowColInt, 4);
  posSizeAttr.setUsage(THREE.DynamicDrawUsage);
  colIntAttr.setUsage(THREE.DynamicDrawUsage);
  glowInstGeom.setAttribute('aPosSize', posSizeAttr);
  glowInstGeom.setAttribute('aColInt', colIntAttr);
  const glowMesh = new THREE.Mesh(glowInstGeom, glowMat);
  glowMesh.frustumCulled = false;
  gHighway.add(glowMesh);

  // -------------------------------------------------------------------------
  // 4. LOWER MANHATTAN FINANCIAL DISTRICT 3D SKYLINE (Interior-Mapped Glass + Spires)
  // -------------------------------------------------------------------------
  const skylineUniforms = {
    uHdri: { value: assets.hdriEquirect },
    uFogCol: { value: new THREE.Color(0xd9a88a) },
    uHorizon: { value: new THREE.Color(0xffbd7a) },
    uZenith: { value: new THREE.Color(0x1f6b8c) },
    uAmbient: { value: new THREE.Color(0x467996) },
    uSunLight: { value: new THREE.Color(0xffa663) },
    uFogDensity: { value: 0.0018 },
    uLitRatio: { value: 0.32 },
    uEmissiveBoost: { value: 1.05 }
  };

  const fidiTowerMat = new THREE.ShaderMaterial({
    uniforms: skylineUniforms,
    vertexShader: /* glsl */ `
      attribute vec4 aMeta;
      attribute vec3 aTint;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPos;
      varying vec3 vLocalNormal;
      varying vec3 vScale;
      varying float vSeed;
      varying vec3 vTint;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vLocalPos = position;
        vLocalNormal = normal;
        vScale = aMeta.xyz;
        vSeed = aMeta.w;
        vTint = aTint;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      #define PI 3.14159265359
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPos;
      varying vec3 vLocalNormal;
      varying vec3 vScale;
      varying float vSeed;
      varying vec3 vTint;

      uniform sampler2D uHdri;
      uniform vec3 uFogCol;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uAmbient;
      uniform vec3 uSunLight;
      uniform float uFogDensity;
      uniform float uLitRatio;
      uniform float uEmissiveBoost;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.5);
        return fract(p.x * p.y);
      }

      vec2 dirToEquirect(vec3 d) {
        float u = atan(d.x, -d.z) / (2.0 * PI) + 0.5 + 0.14;
        float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
        return vec2(fract(u), v);
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        bool isRoof = abs(vLocalNormal.y) > 0.5;

        vec3 R = reflect(-V, N);
        vec3 envRefl = texture2D(uHdri, dirToEquirect(R)).rgb;
        envRefl = envRefl / (1.0 + envRefl * 0.45);
        envRefl = mix(envRefl, mix(uZenith, uHorizon, clamp(R.y * 1.5 + 0.35, 0.0, 1.0)), 0.42);

        vec3 sunDir = normalize(vec3(-0.35, 0.32, -0.88));
        float diff = max(dot(N, sunDir), 0.0);
        vec3 col;

        if (isRoof) {
          col = vTint * (uAmbient * 0.48 + uSunLight * 0.25);
        } else {
          float isZFace = step(0.5, abs(vLocalNormal.z));
          float fx = isZFace > 0.5 ? (vLocalPos.x + 0.5) * vScale.x : (vLocalPos.z + 0.5) * vScale.z;
          float fy = (vLocalPos.y + 0.5) * vScale.y;

          vec2 cellSize = vec2(2.6, 3.2);
          vec2 gridPos = vec2(fx, fy) / cellSize;
          vec2 cellId = floor(gridPos);
          vec2 cellUv = fract(gridPos);

          float frameX = step(0.11, cellUv.x) * step(cellUv.x, 0.89);
          float frameY = step(0.15, cellUv.y) * step(cellUv.y, 0.85);
          float isGlass = frameX * frameY;

          vec3 mullionCol = vTint * (uAmbient * 0.72 + uSunLight * diff * 0.36);

          if (isGlass < 0.5) {
            col = mullionCol;
          } else {
            // 3D Interior-Mapped office rooms behind glass panes
            vec2 winUv = (cellUv - vec2(0.11, 0.15)) / vec2(0.78, 0.70);
            vec3 T = isZFace > 0.5 ? vec3(sign(vLocalNormal.z), 0.0, 0.0) : vec3(0.0, 0.0, -sign(vLocalNormal.x));
            vec3 B = vec3(0.0, 1.0, 0.0);
            vec3 viewTan = vec3(dot(-V, T), dot(-V, B), dot(-V, N));

            float roomD = 0.75;
            vec3 ro = vec3(winUv, 0.0);
            vec3 rd = normalize(vec3(viewTan.x, viewTan.y, -abs(viewTan.z) - 0.001));
            vec3 invRd = 1.0 / (rd + vec3(1e-5));
            float tx = ((rd.x > 0.0 ? 1.0 : 0.0) - ro.x) * invRd.x;
            float ty = ((rd.y > 0.0 ? 1.0 : 0.0) - ro.y) * invRd.y;
            float tz = (-roomD - ro.z) * invRd.z;
            vec3 hit = ro + rd * min(min(tx, ty), tz);

            float wallGrad = mix(0.55, 1.0, hit.y) * mix(1.0, 0.68, -hit.z / roomD);
            float floorRand = hash21(vec2(cellId.y, vSeed * 53.0));
            float roomHash = hash21(cellId + vec2(vSeed * 97.3, vSeed * 41.7));
            float isLit = step(1.0 - uLitRatio, roomHash * 0.72 + floorRand * 0.28);

            float colorPick = hash21(cellId * 1.7 + vSeed * 19.0);
            vec3 warmGold = mix(vec3(1.0, 0.68, 0.26), vec3(1.0, 0.90, 0.58), colorPick);
            vec3 coolCyan = vec3(0.74, 0.92, 1.0);
            vec3 roomCol = mix(coolCyan, warmGold, step(0.24, colorPick)) * wallGrad * uEmissiveBoost * 1.65;
            vec3 darkRoom = vec3(0.03, 0.05, 0.08) * wallGrad;

            float fres = 0.22 + 0.72 * pow(1.0 - max(dot(N, V), 0.0), 2.8);
            col = mix(mix(darkRoom, roomCol, isLit), envRefl * 0.82, fres * (1.0 - isLit * 0.65));
          }
        }

        float dist = length(vWorldPos - cameraPosition);
        float fog = 1.0 - exp(-dist * uFogDensity * 0.55);
        col = mix(col, mix(uFogCol, uHorizon, 0.5), clamp(fog, 0.0, 0.76));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  // Populate Lower Manhattan Skyline on the right & center-right (matching Brooklyn Bridge waterfront view)
  const towers = [];
  const addTower = (x, z, sx, sy, sz, seed, tint) => {
    towers.push({ x, y: sy * 0.5, z, sx, sy, sz, seed, tint });
  };

  // Iconic Financial District landmark towers positioned on right & center-right
  addTower(18, -220, 24, 128, 24, 0.14, [0.64, 0.58, 0.52]); // 70 Pine Street base shaft
  addTower(18, -220, 15, 158, 15, 0.19, [0.68, 0.62, 0.54]); // 70 Pine upper setback
  addTower(54, -230, 22, 134, 22, 0.27, [0.62, 0.58, 0.54]); // 40 Wall Street shaft
  addTower(92, -215, 36, 146, 24, 0.41, [0.52, 0.58, 0.64]); // 28 Liberty (One Chase Plaza)
  addTower(42, -192, 26, 94, 22, 0.52, [0.46, 0.62, 0.74]);  // 111 Wall Cyan Glass Slab
  addTower(8, -188, 28, 98, 22, 0.63, [0.38, 0.42, 0.48]);   // Wall St Dark Curtain Slab
  addTower(-24, -210, 20, 118, 20, 0.71, [0.58, 0.64, 0.68]); // Maiden Lane Slender Tower
  addTower(-52, -225, 26, 86, 22, 0.83, [0.48, 0.58, 0.66]);  // South St Glass Tower

  // Additional Financial District & Southbridge cluster filling the right horizon
  for (let i = 0; i < 36; i++) {
    const tx = -40 + (i % 9) * 28 + (rand() - 0.5) * 12;
    const tz = -155 - Math.floor(i / 9) * 34 + (rand() - 0.5) * 14;
    // Keep the East River & FDR highway corridor clear!
    if (tx < 28 && tz > -168) continue;
    const h = 38 + rand() * 82;
    const w = 16 + rand() * 16;
    const d = 16 + rand() * 16;
    const tint =
      rand() < 0.4
        ? [0.48, 0.60, 0.70]
        : rand() < 0.75
        ? [0.62, 0.56, 0.52]
        : [0.52, 0.42, 0.38];
    addTower(tx, tz, w, h, d, rand(), tint);
  }

  // Green Patina Copper Pyramidal Crown on 40 Wall Street (54, 144, -230)
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0x3d8c78,
    roughness: 0.45,
    metalness: 0.55
  });
  const wallCrown = new THREE.Mesh(new THREE.ConeGeometry(13.5, 22, 4), copperMat);
  wallCrown.position.set(54, 145, -230);
  wallCrown.rotation.y = Math.PI / 4;
  gSkyline.add(wallCrown);

  // Art Deco Spire on 70 Pine Street (18, 168, -220)
  const pineCrown = new THREE.Mesh(new THREE.ConeGeometry(8.5, 24, 4), copperMat);
  pineCrown.position.set(18, 170, -220);
  pineCrown.rotation.y = Math.PI / 4;
  gSkyline.add(pineCrown);

  // Foreground Right Seaport Industrial Brick Loft Building alongside FDR Drive
  const loftMat = new THREE.MeshStandardMaterial({
    map: assets.brickRed.map,
    normalMap: assets.brickRed.normalMap,
    roughnessMap: assets.brickRed.roughnessMap,
    color: new THREE.Color(0xb88b76),
    roughness: 0.9
  });
  const seaportLoft = new THREE.Mesh(new THREE.BoxGeometry(22, 18, 52), loftMat);
  seaportLoft.position.set(47, 9, -46);
  gSkyline.add(seaportLoft);

  // Build InstancedMesh for all Financial District towers
  const boxGeom = new THREE.BoxGeometry(1, 1, 1);
  const count = towers.length;
  const metaArr = new Float32Array(count * 4);
  const tintArr = new Float32Array(count * 3);
  const towerIm = new THREE.InstancedMesh(boxGeom, fidiTowerMat, count);
  const dummy = new THREE.Object3D();

  towers.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z);
    dummy.scale.set(b.sx, b.sy, b.sz);
    dummy.updateMatrix();
    towerIm.setMatrixAt(i, dummy.matrix);
    metaArr.set([b.sx, b.sy, b.sz, b.seed], i * 4);
    tintArr.set(b.tint, i * 3);
  });
  towerIm.instanceMatrix.needsUpdate = true;
  boxGeom.setAttribute('aMeta', new THREE.InstancedBufferAttribute(metaArr, 4));
  boxGeom.setAttribute('aTint', new THREE.InstancedBufferAttribute(tintArr, 3));
  gSkyline.add(towerIm);

  return {
    group: root,
    layers: {
      water: gWater,
      bridge: gBridge,
      highway: gHighway,
      skyline: gSkyline
    },
    instanceCount: count + NUM_FDR_CARS,
    update(dt, time, trafficSpeed, atm, fogDensity, litRatio) {
      waterUniforms.uTime.value = time;
      waterUniforms.uHorizon.value.copy(atm.horizon);
      waterUniforms.uZenith.value.copy(atm.zenith);
      waterUniforms.uFogCol.value.copy(atm.fogCol);
      waterUniforms.uFogDensity.value = fogDensity;
      waterUniforms.uEmissiveBoost.value = atm.emissiveBoost;

      skylineUniforms.uFogCol.value.copy(atm.fogCol);
      skylineUniforms.uHorizon.value.copy(atm.horizon);
      skylineUniforms.uZenith.value.copy(atm.zenith);
      skylineUniforms.uAmbient.value.copy(atm.ambientSky);
      skylineUniforms.uSunLight.value.copy(atm.sunLight);
      skylineUniforms.uFogDensity.value = fogDensity;
      skylineUniforms.uLitRatio.value = clamp(litRatio + atm.nightFactor * 0.18, 0.05, 0.92);
      skylineUniforms.uEmissiveBoost.value = atm.emissiveBoost;

      glowUniforms.uEmissiveBoost.value = atm.emissiveBoost;

      // Advance 3D vehicles along the curved FDR Drive highway spline
      let gIdx = 0;
      const pushGlow = (x, y, z, size, r, g, b, intensity) => {
        if (gIdx >= MAX_GLOWS) return;
        glowPosSize[gIdx * 4] = x;
        glowPosSize[gIdx * 4 + 1] = y;
        glowPosSize[gIdx * 4 + 2] = z;
        glowPosSize[gIdx * 4 + 3] = size;
        glowColInt[gIdx * 4] = r;
        glowColInt[gIdx * 4 + 1] = g;
        glowColInt[gIdx * 4 + 2] = b;
        glowColInt[gIdx * 4 + 3] = intensity;
        gIdx++;
      };

      fdrCars.forEach((c, idx) => {
        const dir = c.incoming ? -1 : 1; // t=0 is foreground, t=1 is far distance
        c.t += dir * c.speed * trafficSpeed * dt;
        if (c.t < 0.02) c.t = 0.98;
        if (c.t > 0.98) c.t = 0.02;

        const pt = fdrCurve.getPointAt(c.t);
        const tan = fdrCurve.getTangentAt(c.t).normalize();
        const perp = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

        const pos = pt.clone().addScaledVector(perp, c.laneOffset);
        pos.y = 3.82;

        const yaw = Math.atan2(tan.x, tan.z) + (c.incoming ? Math.PI : 0);
        dummy.position.copy(pos);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        fdrCarMesh.setMatrixAt(idx, dummy.matrix);

        // Headlights (incoming) or Taillights (outgoing) facing the camera
        const camDir = c.incoming ? -1 : -1; // Both face toward camera (+Z)
        const lightZ = pos.z + 2.05;
        for (const side of [-0.62, 0.62]) {
          const lx = pos.x + perp.x * side;
          const lz = lightZ + perp.z * side;
          if (c.incoming) {
            pushGlow(lx, 4.55, lz, 2.2, 1.0, 0.94, 0.80, 1.85);
          } else {
            pushGlow(lx, 4.58, lz, 2.0, 1.0, 0.16, 0.09, 1.75);
          }
        }
      });
      fdrCarMesh.instanceMatrix.needsUpdate = true;

      glowInstGeom.instanceCount = gIdx;
      posSizeAttr.needsUpdate = true;
      colIntAttr.needsUpdate = true;
    }
  };
}
