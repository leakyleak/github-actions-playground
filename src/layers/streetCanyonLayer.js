import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, clamp } from '../utils/rng.js';

function createAsphaltMaterial(asphaltPbr, shaderUniforms) {
  const mat = new THREE.MeshStandardMaterial({
    map: asphaltPbr.map,
    normalMap: asphaltPbr.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: asphaltPbr.roughnessMap,
    roughness: 0.72,
    metalness: 0.12,
    color: new THREE.Color(0x555860)
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uEmissiveBoost = shaderUniforms.uEmissiveBoost;
    shader.uniforms.uTime = shaderUniforms.uTime;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRoadWorldPos;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvRoadWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vRoadWorldPos;
         uniform float uEmissiveBoost;
         uniform float uTime;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         float rx = vRoadWorldPos.x;
         float rz = vRoadWorldPos.z;
         float rax = abs(rx);
         bool isSidewalk = rax > 6.5;

         if (isSidewalk) {
           // Concrete sidewalk slab seams
           vec2 tile = fract(vRoadWorldPos.xz * 0.55);
           float seam = step(0.04, tile.x) * step(0.04, tile.y);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.30, 0.31) * (0.82 + 0.18 * seam), 0.68);
         } else {
           // NYC crosswalk zebra stripes at foreground & mid-street intersections
           float cw1 = step(-30.5, rz) * step(rz, -26.2);
           float cw2 = step(-64.0, rz) * step(rz, -60.4);
           float cw3 = step(-102.0, rz) * step(rz, -98.8);
           float stripe = step(0.42, fract((rx + 6.5) * 0.74));
           float cw = max(max(cw1, cw2), cw3) * stripe * step(rax, 6.0);

           // Center dashed lane dividers & stop bar
           float dash = step(rax, 0.12) * step(0.45, fract(rz * 0.14)) * (1.0 - cw1);
           float stopBar = step(-25.6, rz) * step(rz, -24.9) * step(rax, 6.0);
           float paint = clamp(cw * 0.85 + dash * 0.55 + stopBar * 0.75, 0.0, 0.9);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.74, 0.72), paint);
         }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         // Subtle worn tire-track sheen along road lanes for grazing headlight streaks
         float tireSheen = exp(-pow(abs(vRoadWorldPos.x) - 2.4, 2.0) * 0.45);
         roughnessFactor = clamp(roughnessFactor * mix(0.88, 0.52, tireSheen), 0.18, 0.95);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float ex = vRoadWorldPos.x;
         float ez = vRoadWorldPos.z;
         float eax = abs(ex);
         float emStr = 0.65 + 0.45 * uEmissiveBoost;

         if (eax <= 6.5) {
           // Warm sodium-vapor canyon glow & grazing specular streaks down the avenue
           float centerGlow = exp(-eax * eax * 0.055);
           float depthWarm = smoothstep(-8.0, -135.0, ez) * 0.7 + 0.3;
           float shimmer = 0.90 + 0.10 * sin(ez * 0.45 + uTime * 2.4);
           totalEmissiveRadiance += vec3(1.0, 0.56, 0.20) * centerGlow * depthWarm * shimmer * 0.65 * emStr;

           // Incoming white headlight specular streaks on left lanes
           float leftLane = exp(-pow(ex + 2.5, 2.0) * 0.42);
           totalEmissiveRadiance += vec3(1.0, 0.88, 0.68) * leftLane * 0.34 * emStr;

           // Outgoing crimson taillight specular streaks on right lanes
           float rightLane = exp(-pow(ex - 2.6, 2.0) * 0.42);
           totalEmissiveRadiance += vec3(1.0, 0.22, 0.12) * rightLane * 0.24 * emStr;
         } else {
           // Warm storefront & streetlamp bounce on sidewalks
           float lampPool = exp(-pow(sin((ez + 8.0) * 0.196), 2.0) * 5.0);
           totalEmissiveRadiance += vec3(1.0, 0.58, 0.22) * (0.14 + 0.26 * lampPool) * emStr;
         }`
      );
  };

  return mat;
}

// Shared Interior-Mapped Tenement Window Glass Shader
export function createTenementWindowMaterial(hdriEquirect) {
  const uniforms = {
    uHdri: { value: hdriEquirect },
    uLitRatio: { value: 0.32 },
    uEmissiveBoost: { value: 1.05 }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute float aWinSeed;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vSeed;
      void main() {
        vUv = uv;
        vSeed = aWinSeed;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      #define PI 3.14159265359
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vSeed;

      uniform sampler2D uHdri;
      uniform float uLitRatio;
      uniform float uEmissiveBoost;

      vec2 dirToEquirect(vec3 d) {
        float u = atan(d.x, -d.z) / (2.0 * PI) + 0.5 + 0.14;
        float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
        return vec2(fract(u), v);
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Wooden window sash meeting rail & center muntin bar
        float sashH = smoothstep(0.025, 0.038, abs(vUv.y - 0.50));
        float sashV = smoothstep(0.016, 0.028, abs(vUv.x - 0.50));
        float sash = sashH * sashV;

        if (sash < 0.5) {
          gl_FragColor = vec4(0.06, 0.06, 0.07, 1.0);
          return;
        }

        // Virtual 3D tenement apartment room parallax
        vec3 T = abs(N.x) > 0.5 ? vec3(0.0, 0.0, -sign(N.x)) : vec3(sign(N.z), 0.0, 0.0);
        vec3 B = vec3(0.0, 1.0, 0.0);
        vec3 viewTan = vec3(dot(-V, T), dot(-V, B), dot(-V, N));
        vec3 rd = normalize(vec3(viewTan.x, viewTan.y, -abs(viewTan.z) - 0.001));
        vec3 ro = vec3(vUv, 0.0);
        float roomD = 0.85;
        vec3 invRd = 1.0 / (rd + vec3(1e-5));
        float tx = ((rd.x > 0.0 ? 1.0 : 0.0) - ro.x) * invRd.x;
        float ty = ((rd.y > 0.0 ? 1.0 : 0.0) - ro.y) * invRd.y;
        float tz = (-roomD - ro.z) * invRd.z;
        float tHit = min(min(tx, ty), tz);
        vec3 hit = ro + rd * tHit;

        float isCeiling = step(0.98, hit.y);
        float isFloor = step(hit.y, 0.02);
        float wallShade = mix(0.45, 1.0, hit.y) * mix(1.0, 0.65, -hit.z / roomD);
        float shade = isCeiling > 0.5 ? 1.25 : (isFloor > 0.5 ? 0.35 : wallShade);

        // Curtains / shade partially pulled down
        float shadeDrop = fract(vSeed * 13.37) * 0.42;
        float curtain = smoothstep(1.0 - shadeDrop - 0.02, 1.0 - shadeDrop + 0.02, vUv.y) * 0.55;

        float isLit = step(1.0 - uLitRatio, fract(vSeed * 1.6180339));
        float warmth = fract(vSeed * 7.13);
        vec3 bulb = mix(vec3(1.0, 0.58, 0.18), vec3(1.0, 0.86, 0.46), warmth);
        vec3 litRoom = bulb * shade * (1.0 - curtain) * (0.85 + 0.45 * fract(vSeed * 3.7)) * uEmissiveBoost * 1.55;
        vec3 darkRoom = vec3(0.03, 0.05, 0.07) * wallShade;

        vec3 R = reflect(-V, N);
        vec3 envRefl = texture2D(uHdri, dirToEquirect(R)).rgb;
        envRefl = envRefl / (1.0 + envRefl * 0.45);
        float fres = 0.18 + 0.72 * pow(1.0 - max(dot(N, V), 0.0), 3.0);

        vec3 col = mix(mix(darkRoom, litRoom, isLit), envRefl * 0.75, fres * (1.0 - isLit * 0.68));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  return { mat, uniforms };
}

// Build a merged 3D iron fire escape module (balcony deck + railings + diagonal stair)
function createFireEscapeGeometry() {
  const parts = [];
  const addBox = (w, h, d, x, y, z, rz = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rz !== 0) g.rotateZ(rz);
    g.translate(x, y, z);
    parts.push(g);
  };
  // Balcony deck (sticks out +X by 1.05m, spans Z by 3.6m)
  addBox(1.05, 0.1, 3.6, 0.52, 0, 0);
  // Top & mid horizontal rails
  addBox(0.06, 0.06, 3.6, 1.02, 0.95, 0);
  addBox(0.05, 0.05, 3.6, 1.02, 0.48, 0);
  addBox(1.05, 0.06, 0.06, 0.52, 0.95, -1.78);
  addBox(1.05, 0.06, 0.06, 0.52, 0.95, 1.78);
  // Vertical pickets
  for (let z = -1.7; z <= 1.71; z += 0.34) {
    addBox(0.04, 0.95, 0.04, 1.02, 0.48, z);
  }
  // Diagonal iron ladder climbing up to next floor
  const ladderG = new THREE.BoxGeometry(0.12, 3.6, 0.42);
  ladderG.rotateX(0.62);
  ladderG.translate(0.55, 1.45, 0.15);
  parts.push(ladderG);

  return mergeGeometries(parts, false);
}

// Build a merged low-poly 3D sedan/taxi & box truck geometry
function createVehicleGeometries() {
  // Sedan / NYC cab
  const carParts = [];
  const body = new THREE.BoxGeometry(1.75, 0.62, 4.1);
  body.translate(0, 0.52, 0);
  const cabin = new THREE.BoxGeometry(1.52, 0.56, 2.05);
  cabin.translate(0, 1.08, -0.15);
  carParts.push(body, cabin);
  for (const wx of [-0.82, 0.82]) {
    for (const wz of [-1.25, 1.25]) {
      const w = new THREE.CylinderGeometry(0.30, 0.30, 0.24, 10);
      w.rotateZ(Math.PI / 2);
      w.translate(wx, 0.30, wz);
      carParts.push(w);
    }
  }
  const sedanGeom = mergeGeometries(carParts, false);

  // Box Truck (iconic NYC delivery truck like in reference photo!)
  const truckParts = [];
  const cargo = new THREE.BoxGeometry(2.2, 2.15, 4.1);
  cargo.translate(0, 1.62, -0.75);
  const cab = new THREE.BoxGeometry(2.05, 1.45, 1.55);
  cab.translate(0, 1.22, 1.95);
  const chassis = new THREE.BoxGeometry(2.0, 0.38, 5.5);
  chassis.translate(0, 0.55, 0.2);
  truckParts.push(cargo, cab, chassis);
  for (const wx of [-1.02, 1.02]) {
    for (const wz of [-1.85, 1.85]) {
      const w = new THREE.CylinderGeometry(0.40, 0.40, 0.30, 10);
      w.rotateZ(Math.PI / 2);
      w.translate(wx, 0.40, wz);
      truckParts.push(w);
    }
  }
  const truckGeom = mergeGeometries(truckParts, false);

  return { sedanGeom, truckGeom };
}

// Rooftop NYC Wooden Water Tower
function createWaterTowerGeometry() {
  const parts = [];
  const barrel = new THREE.CylinderGeometry(1.35, 1.42, 2.6, 12);
  barrel.translate(0, 3.0, 0);
  const roof = new THREE.ConeGeometry(1.52, 1.15, 12);
  roof.translate(0, 4.85, 0);
  parts.push(barrel, roof);
  for (const lx of [-0.9, 0.9]) {
    for (const lz of [-0.9, 0.9]) {
      const leg = new THREE.BoxGeometry(0.16, 1.9, 0.16);
      leg.translate(lx, 0.95, lz);
      parts.push(leg);
    }
  }
  return mergeGeometries(parts, false);
}

export function createStreetCanyonLayer(assets, glowTex, tenementWin) {
  const group = new THREE.Group();
  group.name = 'StreetCanyon';

  const rand = mulberry32(5512);

  // 1. Real Poly Haven PBR Asphalt Road & Sidewalks
  const roadUniforms = {
    uEmissiveBoost: { value: 1.05 },
    uTime: { value: 0 }
  };
  const roadMat = createAsphaltMaterial(assets.asphalt, roadUniforms);
  const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(34, 178), roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.set(0, 0, -83);
  group.add(roadMesh);

  // Raised concrete curbs separating sidewalk from asphalt
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x3b3838, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 178), curbMat);
    curb.position.set(side * 6.55, 0.11, -83);
    group.add(curb);
  }

  // 2. Modular 3D Brick Tenements using REAL Poly Haven Brick PBR maps
  const brickRedMat = new THREE.MeshStandardMaterial({
    map: assets.brickRed.map.clone(),
    normalMap: assets.brickRed.normalMap.clone(),
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: assets.brickRed.roughnessMap.clone(),
    roughness: 0.92,
    metalness: 0.04
  });
  brickRedMat.map.repeat.set(3, 3);
  brickRedMat.normalMap.repeat.set(3, 3);
  brickRedMat.roughnessMap.repeat.set(3, 3);
  brickRedMat.map.needsUpdate = true;

  const brickDarkMat = new THREE.MeshStandardMaterial({
    map: assets.brickDark.map.clone(),
    normalMap: assets.brickDark.normalMap.clone(),
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: assets.brickDark.roughnessMap.clone(),
    roughness: 0.90,
    metalness: 0.04
  });
  brickDarkMat.map.repeat.set(3, 3);
  brickDarkMat.normalMap.repeat.set(3, 3);
  brickDarkMat.roughnessMap.repeat.set(3, 3);
  brickDarkMat.map.needsUpdate = true;

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x574c47, roughness: 0.88, metalness: 0.05 });
  const corniceMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.78, metalness: 0.15 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.65, metalness: 0.55 });
  const acMat = new THREE.MeshStandardMaterial({ color: 0x6f757a, roughness: 0.6, metalness: 0.3 });
  const shopMat = new THREE.MeshStandardMaterial({
    color: 0xffd288,
    emissive: new THREE.Color(0xffb454),
    emissiveIntensity: 1.45,
    roughness: 0.3
  });
  const awningMat = new THREE.MeshStandardMaterial({ color: 0x1e4d3a, roughness: 0.85 });

  // Collect transforms for instanced architectural details
  const redWalls = [];
  const darkWalls = [];
  const cornices = [];
  const lintels = [];
  const winFrames = [];
  const winPanes = [];
  const fireEscapes = [];
  const acUnits = [];
  const shopWindows = [];
  const awnings = [];
  const waterTowers = [];

  for (const side of [-1, 1]) {
    let z = -14;
    while (z > -142) {
      const len = 10.5 + rand() * 6.5;
      const depth = 11 + rand() * 3.5;
      const floors = 3 + Math.floor(rand() * 2.2); // 3 to 5 stories (11.5 - 17m)
      const h = 3.6 + floors * 2.95;
      const wallFaceX = side * (9.7 + (rand() - 0.5) * 0.45);
      const cx = wallFaceX + side * (depth * 0.5);
      const cz = z - len * 0.5;

      // Color tint matching photo: warm terracotta right, salmon mid-right, dark brownstone mid-left
      let useDark = false;
      let tint;
      if (side > 0 && cz > -44) {
        tint = new THREE.Color(0xd99b82);
      } else if (side > 0 && cz > -70 && cz <= -44) {
        tint = new THREE.Color(0xdbaea8);
      } else if (side < 0 && cz > -48 && cz <= -24) {
        useDark = true;
        tint = new THREE.Color(0x767276);
      } else {
        useDark = rand() < 0.38;
        tint = useDark ? new THREE.Color(0x8c7b77) : new THREE.Color(0xc7927e);
      }

      const targetList = useDark ? darkWalls : redWalls;
      targetList.push({ x: cx, y: h * 0.5, z: cz, sx: depth, sy: h, sz: len - 0.14, tint });

      // Ornate projecting rooftop cornice
      cornices.push({
        x: wallFaceX + side * (depth * 0.5 - 0.28),
        y: h + 0.38,
        z: cz,
        sx: depth + 0.65,
        sy: 0.78,
        sz: len + 0.1
      });

      // Ground floor warm glowing storefront & projecting awning
      if (cz > -125) {
        const bayCount = Math.max(2, Math.floor(len / 4.2));
        const bayStep = len / bayCount;
        for (let b = 0; b < bayCount; b++) {
          if (rand() < 0.78) {
            const bz = z - (b + 0.5) * bayStep;
            shopWindows.push({
              x: wallFaceX - side * 0.06,
              y: 1.65,
              z: bz,
              sx: 0.14,
              sy: 2.35,
              sz: bayStep * 0.72
            });
            if (rand() < 0.55) {
              awnings.push({
                x: wallFaceX - side * 0.62,
                y: 3.05,
                z: bz,
                sx: 1.25,
                sy: 0.18,
                sz: bayStep * 0.78,
                rotZ: side * 0.28
              });
            }
          }
        }
      }

      // Upper story 3D recessed window bays, stone lintels/sills, AC units, and 3D fire escapes
      const numBays = Math.max(3, Math.floor(len / 2.35));
      const baySpacing = (len - 1.2) / numBays;
      const hasFireEscape = rand() < 0.76;
      const feCenterZ = cz + (rand() - 0.5) * (len * 0.25);

      for (let f = 0; f < floors; f++) {
        const fy = 4.95 + f * 2.95;

        // 3D Iron fire escape balcony per floor
        if (hasFireEscape) {
          fireEscapes.push({
            x: wallFaceX,
            y: fy - 0.95,
            z: feCenterZ,
            rotY: side > 0 ? Math.PI : 0
          });
        }

        for (let b = 0; b < numBays; b++) {
          const wz = z - 0.6 - (b + 0.5) * baySpacing;
          // Recessed dark frame sticking slightly out from brick wall
          winFrames.push({ x: wallFaceX - side * 0.07, y: fy, z: wz, sx: 0.16, sy: 1.92, sz: 1.14 });
          // Interior-mapped glass pane
          winPanes.push({
            x: wallFaceX - side * 0.11,
            y: fy,
            z: wz,
            rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
            seed: rand()
          });
          // Projecting stone lintel (top) & sill (bottom)
          lintels.push({ x: wallFaceX - side * 0.12, y: fy + 1.04, z: wz, sx: 0.26, sy: 0.22, sz: 1.32 });
          lintels.push({ x: wallFaceX - side * 0.12, y: fy - 1.02, z: wz, sx: 0.24, sy: 0.14, sz: 1.26 });

          // Occasional window AC unit sitting on sill
          if (rand() < 0.18) {
            acUnits.push({ x: wallFaceX - side * 0.28, y: fy - 0.76, z: wz, sx: 0.52, sy: 0.36, sz: 0.56 });
          }
        }
      }

      // Occasional rooftop wooden NYC water tower
      if (rand() < 0.32) {
        waterTowers.push({ x: cx, y: h + 0.7, z: cz });
      }

      z -= len;
    }
  }

  function makeInstancedBoxes(list, mat, withColor = false) {
    if (!list.length) return null;
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(geom, mat, list.length);
    const dummy = new THREE.Object3D();
    list.forEach((o, i) => {
      dummy.position.set(o.x, o.y, o.z);
      dummy.rotation.set(0, o.rotY || 0, o.rotZ || 0);
      dummy.scale.set(o.sx, o.sy, o.sz);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (withColor && o.tint) im.setColorAt(i, o.tint);
    });
    im.instanceMatrix.needsUpdate = true;
    if (withColor && im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    return im;
  }

  makeInstancedBoxes(redWalls, brickRedMat, true);
  makeInstancedBoxes(darkWalls, brickDarkMat, true);
  makeInstancedBoxes(cornices, corniceMat);
  makeInstancedBoxes(lintels, stoneMat);
  makeInstancedBoxes(winFrames, ironMat);
  makeInstancedBoxes(acUnits, acMat);
  makeInstancedBoxes(shopWindows, shopMat);
  makeInstancedBoxes(awnings, awningMat);

  // Instanced interior-mapped tenement glass panes
  {
    const paneGeom = new THREE.PlaneGeometry(1.0, 1.78);
    const seeds = new Float32Array(winPanes.length);
    const im = new THREE.InstancedMesh(paneGeom, tenementWin.mat, winPanes.length);
    const dummy = new THREE.Object3D();
    winPanes.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      seeds[i] = p.seed;
    });
    im.instanceMatrix.needsUpdate = true;
    paneGeom.setAttribute('aWinSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    group.add(im);
  }

  // Instanced 3D Fire Escapes
  {
    const feGeom = createFireEscapeGeometry();
    const im = new THREE.InstancedMesh(feGeom, ironMat, fireEscapes.length);
    const dummy = new THREE.Object3D();
    fireEscapes.forEach((f, i) => {
      dummy.position.set(f.x, f.y, f.z);
      dummy.rotation.set(0, f.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }

  // Instanced Rooftop Wooden Water Towers
  {
    const wtGeom = createWaterTowerGeometry();
    const wtMat = new THREE.MeshStandardMaterial({ color: 0x3b312d, roughness: 0.92 });
    const im = new THREE.InstancedMesh(wtGeom, wtMat, waterTowers.length);
    const dummy = new THREE.Object3D();
    waterTowers.forEach((w, i) => {
      dummy.position.set(w.x, w.y, w.z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  }

  // 3. Streetlamps & Poles
  const poleParts = [];
  const lampGlowPositions = [];
  for (let z = -18; z >= -138; z -= 17) {
    for (const side of [-1, 1]) {
      poleParts.push({ x: side * 6.95, y: 3.4, z, sx: 0.18, sy: 6.8, sz: 0.18 });
      poleParts.push({ x: side * 5.95, y: 6.65, z, sx: 2.05, sy: 0.14, sz: 0.14 });
      lampGlowPositions.push(new THREE.Vector3(side * 5.05, 6.45, z));
    }
  }
  makeInstancedBoxes(poleParts, ironMat);

  // 4. Moving Instanced 3D Traffic Vehicles (Sedans/NYC Cabs + Box Trucks)
  const { sedanGeom, truckGeom } = createVehicleGeometries();
  const vehicleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.38,
    metalness: 0.52,
    envMapIntensity: 1.25
  });

  const sedans = [];
  const trucks = [];
  const trafficAll = [];
  const carPalette = [
    new THREE.Color(0x1f242c),
    new THREE.Color(0x2d3845),
    new THREE.Color(0x7c848c),
    new THREE.Color(0x9a9ea4),
    new THREE.Color(0xdca024), // NYC Yellow Cab!
    new THREE.Color(0x6e2422)
  ];

  const NUM_VEHICLES = 54;
  for (let i = 0; i < NUM_VEHICLES; i++) {
    const incoming = i < 34;
    const laneIdx = incoming ? (rand() < 0.52 ? 0 : 1) : (rand() < 0.55 ? 2 : 3);
    const laneX = [-3.95, -1.35, 1.55, 4.05][laneIdx];
    const isTruck = rand() < 0.22;
    const v = {
      x: laneX + (rand() - 0.5) * 0.25,
      z: -14 - rand() * 140,
      dir: incoming ? 1 : -1,
      speed: (incoming ? 8.8 : 9.6) + rand() * 5.8,
      isTruck,
      color: isTruck
        ? new THREE.Color(rand() < 0.6 ? 0xc27e3a : 0xb8bdc2)
        : carPalette[Math.floor(rand() * carPalette.length)]
    };
    trafficAll.push(v);
    if (isTruck) trucks.push(v);
    else sedans.push(v);
  }

  const sedanMesh = new THREE.InstancedMesh(sedanGeom, vehicleMat, sedans.length);
  const truckMesh = new THREE.InstancedMesh(truckGeom, vehicleMat, trucks.length);
  sedans.forEach((v, i) => sedanMesh.setColorAt(i, v.color));
  trucks.forEach((v, i) => truckMesh.setColorAt(i, v.color));
  sedanMesh.instanceColor.needsUpdate = true;
  truckMesh.instanceColor.needsUpdate = true;
  group.add(sedanMesh, truckMesh);

  // 5. Instanced Additive Glow Billboards (Headlights, Taillights, Streetlamps, Traffic Signals)
  const MAX_GLOWS = 360;
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
        float r = aPosSize.w * (1.0 + dist * 0.0042);
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
        vec3 col = vCol * a * vInt * (0.85 + 0.35 * uEmissiveBoost);
        gl_FragColor = vec4(col, a);
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
  group.add(glowMesh);

  const dummy = new THREE.Object3D();

  return {
    group,
    instanceCount: redWalls.length + darkWalls.length + winPanes.length + fireEscapes.length + NUM_VEHICLES,
    update(dt, time, trafficSpeed, atm) {
      roadUniforms.uEmissiveBoost.value = atm.emissiveBoost;
      roadUniforms.uTime.value = time;
      glowUniforms.uEmissiveBoost.value = atm.emissiveBoost;
      shopMat.emissiveIntensity = 1.25 * (0.75 + 0.45 * atm.emissiveBoost);

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

      // Update vehicle positions & push headlight / taillight glows
      let sIdx = 0;
      let tIdx = 0;
      for (const v of trafficAll) {
        v.z += v.dir * v.speed * trafficSpeed * dt;
        if (v.dir > 0 && v.z > -10) v.z = -152;
        if (v.dir < 0 && v.z < -152) v.z = -10;

        dummy.position.set(v.x, 0, v.z);
        dummy.rotation.set(0, v.dir > 0 ? 0 : Math.PI, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        if (v.isTruck) truckMesh.setMatrixAt(tIdx++, dummy.matrix);
        else sedanMesh.setMatrixAt(sIdx++, dummy.matrix);

        const halfW = v.isTruck ? 0.78 : 0.62;
        const zOff = v.isTruck ? 2.75 : 2.08;
        if (v.dir > 0) {
          // Incoming warm-white headlights
          pushGlow(v.x - halfW, 0.72, v.z + zOff, 2.05, 1.0, 0.94, 0.80, 1.8);
          pushGlow(v.x + halfW, 0.72, v.z + zOff, 2.05, 1.0, 0.94, 0.80, 1.8);
          if (v.isTruck) {
            pushGlow(v.x, 2.78, v.z + 1.5, 2.2, 1.0, 0.62, 0.14, 1.3);
          }
        } else {
          // Outgoing crimson taillights
          pushGlow(v.x - halfW, 0.78, v.z + zOff, 1.95, 1.0, 0.14, 0.08, 1.75);
          pushGlow(v.x + halfW, 0.78, v.z + zOff, 1.95, 1.0, 0.14, 0.08, 1.75);
        }
      }
      sedanMesh.instanceMatrix.needsUpdate = true;
      truckMesh.instanceMatrix.needsUpdate = true;

      // Streetlamp sodium-vapor halos
      for (const lp of lampGlowPositions) {
        pushGlow(lp.x, lp.y, lp.z, 3.8, 1.0, 0.64, 0.22, 1.35);
      }

      // Cycling intersection traffic lights
      const cycle = (time * 0.25) % 3.0;
      const sigCol = cycle > 2.2 ? [1.0, 0.18, 0.10] : cycle > 1.85 ? [1.0, 0.70, 0.14] : [1.0, 0.58, 0.14];
      for (const iz of [-24.5, -59.5, -99.5]) {
        pushGlow(-5.4, 4.9, iz, 2.9, sigCol[0], sigCol[1], sigCol[2], 1.55);
        pushGlow(5.4, 4.9, iz, 2.9, 1.0, 0.60, 0.14, 1.45);
        pushGlow(6.6, 3.8, iz - 1.8, 1.8, 0.20, 0.95, 0.52, 0.85);
      }

      glowInstGeom.instanceCount = gIdx;
      posSizeAttr.needsUpdate = true;
      colIntAttr.needsUpdate = true;
    }
  };
}
