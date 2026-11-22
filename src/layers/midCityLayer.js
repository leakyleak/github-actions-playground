import * as THREE from 'three';
import { mulberry32, clamp } from '../utils/rng.js';

export function createMidCityLayer(hdriEquirect) {
  const group = new THREE.Group();
  group.name = 'MidCity';

  const uniforms = {
    uHdri: { value: hdriEquirect },
    uFogCol: { value: new THREE.Color(0xd9a88a) },
    uHorizon: { value: new THREE.Color(0xffbd7a) },
    uZenith: { value: new THREE.Color(0x1f6b8c) },
    uAmbient: { value: new THREE.Color(0x467996) },
    uSunLight: { value: new THREE.Color(0xffa663) },
    uFogDensity: { value: 0.0021 },
    uLitRatio: { value: 0.32 },
    uEmissiveBoost: { value: 1.05 }
  };

  // Instanced Interior-Mapping + HDRI Fresnel Glass Reflection Shader
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec4 aMeta; // x=scaleX, y=scaleY, z=scaleZ, w=seed
      attribute vec3 aTint;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPos;
      varying vec3 vLocalNormal;
      varying vec3 vScale;
      varying float vSeed;
      varying vec3 vTint;

      void main() {
        vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vLocalPos = position;
        vLocalNormal = normal;
        vScale = aMeta.xyz;
        vSeed = aMeta.w;
        vTint = aTint;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
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

        // Sample Poly Haven HDRI for realistic twilight sky glass reflections
        vec3 R = reflect(-V, N);
        vec3 envRefl = texture2D(uHdri, dirToEquirect(R)).rgb;
        envRefl = envRefl / (1.0 + envRefl * 0.45);
        // Tint reflections toward twilight zenith/horizon
        envRefl = mix(envRefl, mix(uZenith, uHorizon, clamp(R.y * 1.5 + 0.35, 0.0, 1.0)), 0.42);

        vec3 sunDir = normalize(vec3(-0.3, 0.35, -0.88));
        float diff = max(dot(N, sunDir), 0.0);

        vec3 col;

        if (isRoof) {
          col = vTint * (uAmbient * 0.45 + uZenith * 0.22);
        } else {
          // Architectural world-scaled window grid (consistent floor heights ~3.2m, bay widths ~2.6m)
          float isZFace = step(0.5, abs(vLocalNormal.z));
          float faceCoordX = isZFace > 0.5 ? (vLocalPos.x + 0.5) * vScale.x : (vLocalPos.z + 0.5) * vScale.z;
          float faceCoordY = (vLocalPos.y + 0.5) * vScale.y;

          vec2 cellSize = vec2(2.55, 3.15);
          vec2 gridPos = vec2(faceCoordX, faceCoordY) / cellSize;
          vec2 cellId = floor(gridPos);
          vec2 cellUv = fract(gridPos);

          // Concrete floor slabs & vertical mullions
          float frameX = step(0.10, cellUv.x) * step(cellUv.x, 0.90);
          float frameY = step(0.14, cellUv.y) * step(cellUv.y, 0.86);
          float isGlass = frameX * frameY;

          // Base spandrel/mullion masonry color
          vec3 mullionCol = vTint * (uAmbient * 0.72 + uSunLight * diff * 0.25);

          if (isGlass < 0.5) {
            col = mullionCol;
          } else {
            // --- Interior Mapping: Raycast into a virtual 3D room behind each window pane ---
            vec2 winUv = (cellUv - vec2(0.10, 0.14)) / vec2(0.80, 0.72);
            // Compute tangent basis for the facade face
            vec3 T = isZFace > 0.5 ? vec3(sign(vLocalNormal.z), 0.0, 0.0) : vec3(0.0, 0.0, -sign(vLocalNormal.x));
            vec3 B = vec3(0.0, 1.0, 0.0);
            vec3 viewTan = vec3(dot(-V, T), dot(-V, B), dot(-V, N));

            // Ray origin on the window pane (x,y in [0,1], z = 0 looking into room z in [0, -roomDepth])
            float roomDepth = 0.72;
            vec3 ro = vec3(winUv, 0.0);
            vec3 rd = normalize(vec3(viewTan.x, viewTan.y, -abs(viewTan.z) - 0.001));

            // Ray-box intersection with interior room walls
            vec3 invRd = 1.0 / (rd + vec3(1e-5));
            vec3 tMaxX = (vec3(step(0.0, rd.x), step(0.0, rd.y), 0.0) - ro) * invRd;
            float tx = ((rd.x > 0.0 ? 1.0 : 0.0) - ro.x) * invRd.x;
            float ty = ((rd.y > 0.0 ? 1.0 : 0.0) - ro.y) * invRd.y;
            float tz = (-roomDepth - ro.z) * invRd.z;
            float tHit = min(min(tx, ty), tz);
            vec3 hit = ro + rd * tHit;

            // Shade room interior surfaces (brighter ceiling light, darker floor, soft warm walls)
            float isCeiling = step(0.98, hit.y);
            float isFloor = step(hit.y, 0.02);
            float isBackWall = step(abs(hit.z + roomDepth), 0.02);

            // Per-room + subtle floor-band hash so office floors cluster realistically
            float floorRand = hash21(vec2(cellId.y, vSeed * 53.0));
            float roomHash = hash21(cellId + vec2(vSeed * 97.3, vSeed * 41.7));
            float combinedHash = roomHash * 0.75 + floorRand * 0.25;
            float isLit = step(1.0 - uLitRatio, combinedHash);

            float colorPick = hash21(cellId * 1.7 + vSeed * 19.0);
            vec3 warmLamp = mix(vec3(1.0, 0.66, 0.24), vec3(1.0, 0.88, 0.56), colorPick);
            vec3 coolOffice = vec3(0.76, 0.92, 1.0);
            vec3 roomTint = mix(coolOffice, warmLamp, step(0.22, colorPick));

            // Interior shading depth cues
            float wallGrad = mix(0.55, 1.0, hit.y) * mix(1.0, 0.68, -hit.z / roomDepth);
            float roomShade = isCeiling > 0.5 ? 1.35 : (isFloor > 0.5 ? 0.35 : (isBackWall > 0.5 ? 0.88 * wallGrad : 0.68 * wallGrad));

            // Subtle venetian blind silhouette on top of some rooms
            float blind = step(1.0 - hash21(cellId + 7.1) * 0.45, winUv.y) * 0.55;
            vec3 litRoom = roomTint * roomShade * (1.0 - blind) * (0.85 + 0.55 * roomHash) * uEmissiveBoost * 1.55;
            vec3 darkRoom = vec3(0.03, 0.05, 0.08) * wallGrad;

            // Fresnel reflection of real Poly Haven twilight HDRI tinted toward crisp cool blue-teal glass
            float fres = 0.22 + 0.72 * pow(1.0 - max(dot(N, V), 0.0), 2.8);
            vec3 coolGlass = mix(envRefl * 0.72, uZenith * 0.85, 0.45);
            vec3 glassCol = mix(mix(darkRoom, litRoom, isLit), coolGlass, fres * (1.0 - isLit * 0.68));

            // Warm street canyon glow bouncing onto lower floors
            float lowerGlow = smoothstep(24.0, 0.0, vWorldPos.y) * 0.18;
            col = glassCol + vec3(1.0, 0.58, 0.24) * lowerGlow * uEmissiveBoost * 0.24;
          }
        }

        // Height-based exponential fog shifting gently toward horizon color without washing out cool glass
        float dist = length(vWorldPos - cameraPosition);
        float heightAtten = exp(-max(vWorldPos.y - 10.0, 0.0) * 0.011);
        float fog = 1.0 - exp(-dist * uFogDensity * (0.48 + 0.42 * heightAtten));
        vec3 fogTarget = mix(uFogCol, uHorizon, smoothstep(140.0, 340.0, dist) * 0.52);
        col = mix(col, fogTarget, clamp(fog, 0.0, 0.72));

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  // Generate Manhattan mid-city blocks + stepped architectural setbacks + rooftop mechanical penthouses
  const rand = mulberry32(2026);
  const instances = [];

  function addTower(x, z, sx, h, sz, seed, tint) {
    // Base shaft
    instances.push({ x, y: h * 0.5, z, sx, sy: h, sz, seed, tint });
    // Architectural setback upper tier on ~55% of mid-city towers
    if (h > 34 && rand() < 0.58) {
      const uh = h * (0.24 + rand() * 0.22);
      const usx = sx * (0.62 + rand() * 0.16);
      const usz = sz * (0.62 + rand() * 0.16);
      instances.push({ x, y: h + uh * 0.5, z, sx: usx, sy: uh, sz: usz, seed: seed + 0.13, tint });
    }
  }

  for (let z = -152; z >= -322; z -= 23) {
    for (let x = -215; x <= 215; x += 22) {
      const jx = x + (rand() - 0.5) * 8;
      const jz = z + (rand() - 0.5) * 9;
      if (Math.abs(jx) < 16 && jz > -192) continue;

      const distRatio = clamp((-jz - 150) / 172, 0, 1);
      const centerValley = Math.exp(-Math.pow((jx - 2) / 46, 2));

      let h = 22 + rand() * 32 + distRatio * (16 + rand() * 26);
      if (centerValley > 0.35) {
        h = Math.min(h, 24 + rand() * 18);
      }
      const sx = 12 + rand() * 13;
      const sz = 12 + rand() * 13;
      const seed = rand();

      const tChoice = rand();
      const tint =
        tChoice < 0.45
          ? [0.46, 0.62, 0.74]
          : tChoice < 0.78
          ? [0.56, 0.62, 0.68]
          : [0.44, 0.48, 0.56];

      addTower(jx, jz, sx, h, sz, seed, tint);
    }
  }

  // Distinctive mid-ground Manhattan slabs matching photo framing
  addTower(-44, -172, 46, 36, 22, 0.31, [0.46, 0.44, 0.48]);
  addTower(54, -182, 44, 42, 24, 0.77, [0.52, 0.66, 0.76]);
  addTower(98, -162, 36, 46, 24, 0.44, [0.50, 0.56, 0.64]);

  const geom = new THREE.BoxGeometry(1, 1, 1);
  const count = instances.length;
  const metaArr = new Float32Array(count * 4);
  const tintArr = new Float32Array(count * 3);

  const mesh = new THREE.InstancedMesh(geom, mat, count);
  const dummy = new THREE.Object3D();

  instances.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z);
    dummy.scale.set(b.sx, b.sy, b.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    metaArr.set([b.sx, b.sy, b.sz, b.seed], i * 4);
    tintArr.set(b.tint, i * 3);
  });
  mesh.instanceMatrix.needsUpdate = true;

  geom.setAttribute('aMeta', new THREE.InstancedBufferAttribute(metaArr, 4));
  geom.setAttribute('aTint', new THREE.InstancedBufferAttribute(tintArr, 3));
  group.add(mesh);

  return {
    group,
    instanceCount: count,
    update(atm, fogDensity, litRatio) {
      uniforms.uFogCol.value.copy(atm.fogCol);
      uniforms.uHorizon.value.copy(atm.horizon);
      uniforms.uZenith.value.copy(atm.zenith);
      uniforms.uAmbient.value.copy(atm.ambientSky);
      uniforms.uSunLight.value.copy(atm.sunLight);
      uniforms.uFogDensity.value = fogDensity;
      uniforms.uLitRatio.value = clamp(litRatio + atm.nightFactor * 0.16, 0.05, 0.92);
      uniforms.uEmissiveBoost.value = atm.emissiveBoost;
    }
  };
}
