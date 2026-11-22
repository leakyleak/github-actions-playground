import * as THREE from 'three';
import { mulberry32 } from '../utils/rng.js';

function createFarSkylineCutoutTextures() {
  const W = 2048;
  const H = 768;
  const colC = document.createElement('canvas');
  colC.width = W;
  colC.height = H;
  const cCtx = colC.getContext('2d');

  const emC = document.createElement('canvas');
  emC.width = W;
  emC.height = H;
  const eCtx = emC.getContext('2d');

  cCtx.clearRect(0, 0, W, H);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, W, H);

  const rand = mulberry32(4291);
  const groundY = H;

  function drawSilhouetteTower(x, w, h, opts = {}) {
    const {
      baseColor = '#1c4054',
      sideColor = '#102838',
      winStepX = 6,
      winStepY = 7,
      litProb = 0.30,
      stepped = 0,
      spireH = 0,
      crownGlow = null
    } = opts;

    const topY = groundY - h;
    const grad = cCtx.createLinearGradient(x, topY, x, groundY);
    grad.addColorStop(0, baseColor);
    grad.addColorStop(1, sideColor);
    cCtx.fillStyle = grad;
    cCtx.fillRect(x, topY, w, h);

    cCtx.fillStyle = sideColor;
    cCtx.fillRect(x + w * 0.66, topY, w * 0.34, h);

    if (stepped > 0) {
      for (let s = 1; s <= stepped; s++) {
        const inset = w * 0.14 * s;
        const sh = h * 0.075 * s;
        cCtx.fillStyle = s % 2 === 0 ? baseColor : sideColor;
        cCtx.fillRect(x + inset, topY - sh, w - inset * 2, sh + 2);
      }
    }

    if (spireH > 0) {
      const cx = x + w * 0.5;
      const base = topY - (stepped > 0 ? h * 0.075 * stepped : 0);
      cCtx.strokeStyle = '#3b677e';
      cCtx.lineWidth = 2.2;
      cCtx.beginPath();
      cCtx.moveTo(cx, base);
      cCtx.lineTo(cx, base - spireH);
      cCtx.stroke();
    }

    for (let wy = topY + 8; wy < groundY - 6; wy += winStepY) {
      const rowLit = litProb * (0.45 + 0.85 * rand());
      for (let wx = x + 3; wx < x + w - 4; wx += winStepX) {
        if (rand() < rowLit) {
          const warm = rand();
          const col = warm < 0.68 ? '#ffd97d' : warm < 0.88 ? '#ffae54' : '#b8e8ff';
          eCtx.fillStyle = col;
          eCtx.fillRect(wx, wy, Math.max(2, winStepX - 2.4), Math.max(2, winStepY - 3));
        }
      }
    }

    if (crownGlow) {
      eCtx.fillStyle = crownGlow;
      eCtx.fillRect(x + w * 0.14, topY + 2, w * 0.72, 7);
    }
  }

  // Panoramic background Manhattan skyline silhouettes behind the 3D hero landmarks
  for (let i = 0; i < 48; i++) {
    const tx = i * 43 + (rand() - 0.5) * 16;
    const normX = tx / W;
    // Open central peach sunset valley directly behind the street vanishing point
    const centerDip = Math.exp(-Math.pow((normX - 0.505) / 0.075, 2));
    const h = (145 + rand() * 225) * (1.0 - 0.52 * centerDip);
    const w = 32 + rand() * 54;
    drawSilhouetteTower(tx, w, h, {
      baseColor: rand() < 0.5 ? '#204a61' : '#1b3d52',
      sideColor: '#102736',
      litProb: 0.24,
      stepped: rand() < 0.25 ? 2 : 0,
      spireH: rand() < 0.18 ? 38 + rand() * 32 : 0,
      crownGlow: rand() < 0.12 ? '#ffd978' : null
    });
  }

  const colTex = new THREE.CanvasTexture(colC);
  colTex.colorSpace = THREE.SRGBColorSpace;
  colTex.anisotropy = 8;

  const emTex = new THREE.CanvasTexture(emC);
  emTex.colorSpace = THREE.SRGBColorSpace;
  emTex.anisotropy = 8;

  return { colTex, emTex };
}

function createHeroTowerWindowTexture(seed, style = 'wtc') {
  const W = 256;
  const H = 512;
  const colC = document.createElement('canvas');
  colC.width = W;
  colC.height = H;
  const cCtx = colC.getContext('2d');

  const emC = document.createElement('canvas');
  emC.width = W;
  emC.height = H;
  const eCtx = emC.getContext('2d');

  const rand = mulberry32(seed);

  // Base cool twilight curtain-wall glass
  const grad = cCtx.createLinearGradient(0, 0, 0, H);
  if (style === 'wtc') {
    grad.addColorStop(0, '#3a7a99');
    grad.addColorStop(0.55, '#255770');
    grad.addColorStop(1, '#153445');
  } else if (style === 'verizon') {
    grad.addColorStop(0, '#34637a');
    grad.addColorStop(1, '#1a3848');
  } else {
    grad.addColorStop(0, '#2a566d');
    grad.addColorStop(1, '#142d3d');
  }
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, W, H);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, W, H);

  // Subtle vertical curtain-wall mullions
  cCtx.fillStyle = 'rgba(8, 22, 32, 0.35)';
  const stepX = style === 'wtc' ? 8 : 10;
  const stepY = style === 'wtc' ? 8 : 10;
  for (let x = 0; x < W; x += stepX) cCtx.fillRect(x, 0, 2, H);

  const bands = style === 'verizon' ? [0.16, 0.36, 0.52] : style === 'wtc' ? [0.09, 0.24] : [];
  for (let y = 6; y < H - 6; y += stepY) {
    const frac = y / H;
    const isBand = bands.some((b) => Math.abs(frac - b) < 0.04);
    const prob = isBand ? 0.88 : style === 'wtc' ? 0.22 : 0.34;
    for (let x = 2; x < W - 2; x += stepX) {
      if (rand() < prob) {
        const wCol =
          style === 'wtc' && isBand
            ? '#d9f4ff'
            : isBand
            ? '#ffe999'
            : rand() < 0.72
            ? '#ffd97a'
            : '#bfe9ff';
        eCtx.fillStyle = wCol;
        eCtx.fillRect(x, y, stepX - 3, stepY - 4);
      }
    }
  }

  // Verizon signature vertical solid concrete core stripe down center
  if (style === 'verizon') {
    cCtx.fillStyle = '#486c7e';
    cCtx.fillRect(W * 0.36, 0, W * 0.28, H);
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(W * 0.36, 0, W * 0.28, H);
  }

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const emissiveMap = new THREE.CanvasTexture(emC);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = 8;

  return { map, emissiveMap };
}

export function createFarSkylineLayer(glowTex) {
  const group = new THREE.Group();
  group.name = 'FarSkyline';

  // 1. Alpha-masked curved panoramic skyline card at R = 485m with horizon haze & light-wrap
  const { colTex, emTex } = createFarSkylineCutoutTextures();
  const cutoutUniforms = {
    uColorTex: { value: colTex },
    uEmissiveTex: { value: emTex },
    uFogCol: { value: new THREE.Color(0xd9a88a) },
    uHorizon: { value: new THREE.Color(0xffbd7a) },
    uAmbient: { value: new THREE.Color(0x467996) },
    uFogDensity: { value: 0.0022 },
    uEmissiveBoost: { value: 1.05 },
    uLitScale: { value: 1.0 }
  };

  const cutoutMat = new THREE.ShaderMaterial({
    transparent: false,
    side: THREE.DoubleSide,
    uniforms: cutoutUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform sampler2D uColorTex;
      uniform sampler2D uEmissiveTex;
      uniform vec3 uFogCol;
      uniform vec3 uHorizon;
      uniform vec3 uAmbient;
      uniform float uFogDensity;
      uniform float uEmissiveBoost;
      uniform float uLitScale;

      void main() {
        vec4 base = texture2D(uColorTex, vUv);
        if (base.a < 0.35) discard;

        vec3 em = texture2D(uEmissiveTex, vUv).rgb * uEmissiveBoost * uLitScale * 1.65;
        vec3 col = base.rgb * (0.48 + uAmbient * 1.45) + em;

        // Height-based exponential fog fading distant buildings toward peach horizon
        float dist = length(vWorldPos - cameraPosition);
        float fogF = 1.0 - exp(-dist * uFogDensity * 0.56);
        float lowHaze = smoothstep(0.45, 0.0, vUv.y) * 0.45 * clamp(uFogDensity / 0.0022, 0.0, 1.8);
        float totalFog = clamp(fogF * 0.8 + lowHaze, 0.0, 0.86);

        // Subtle sunset light-wrap along silhouette tops
        float wrap = smoothstep(0.35, 0.85, base.a) * (1.0 - smoothstep(0.65, 0.98, base.a));
        col += uHorizon * wrap * 0.35;

        col = mix(col, mix(uFogCol, uHorizon, 0.6), totalFog);
        col += em * (1.0 - totalFog * 0.55) * 0.42;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  // Curved cylindrical segment at R = 485m
  const arcGeom = new THREE.CylinderGeometry(485, 485, 220, 48, 1, true, Math.PI * 0.68, Math.PI * 0.64);
  // Flip UV horizontally so inner side reads left-to-right
  const uvAttr = arcGeom.attributes.uv;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setX(i, 1.0 - uvAttr.getX(i));
  }
  const arcMesh = new THREE.Mesh(arcGeom, cutoutMat);
  arcMesh.position.set(0, 102, 0);
  group.add(arcMesh);

  // 2. Real 3D PBR Hero Landmarks (catch actual Poly Haven HDRI twilight sky reflections!)
  const heroMaterials = [];

  function makeHeroMat(seed, style, metalness = 0.72, roughness = 0.22) {
    const { map, emissiveMap } = createHeroTowerWindowTexture(seed, style);
    const mat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      emissive: new THREE.Color(0xfff1cc),
      emissiveIntensity: 1.5,
      metalness,
      roughness,
      envMapIntensity: 1.45
    });
    heroMaterials.push(mat);
    return mat;
  }

  // HERO 1: One World Trade Center (right of center, chamfered tapered facets + communications ring + tall needle spire)
  const wtcGroup = new THREE.Group();
  wtcGroup.position.set(42, 0, -420);
  const wtcMat = makeHeroMat(1001, 'wtc', 0.82, 0.16);
  // 8-sided tapered chamfered shaft (twisted 22.5 deg for signature triangular glass facets)
  const wtcShaft = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 16.5, 165, 8), wtcMat);
  wtcShaft.position.y = 82.5;
  wtcShaft.rotation.y = Math.PI / 8;
  wtcGroup.add(wtcShaft);

  // Illuminated rooftop communications ring
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x5c8da6,
    emissive: new THREE.Color(0xa6e3ff),
    emissiveIntensity: 1.4,
    metalness: 0.7,
    roughness: 0.25
  });
  heroMaterials.push(ringMat);
  const wtcRing = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 8.8, 7.5, 16), ringMat);
  wtcRing.position.y = 168.5;
  wtcGroup.add(wtcRing);

  // Tapered needle spire
  const spireMat = new THREE.MeshStandardMaterial({ color: 0x89aec2, metalness: 0.85, roughness: 0.2 });
  const wtcSpireLower = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 2.2, 22, 8), spireMat);
  wtcSpireLower.position.y = 183;
  wtcGroup.add(wtcSpireLower);
  const wtcSpireUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.85, 34, 8), spireMat);
  wtcSpireUpper.position.y = 210;
  wtcGroup.add(wtcSpireUpper);

  // Pulsing red aviation beacon at spire tip
  const beaconMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: new THREE.Color(0xff3022),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });
  const wtcBeacon = new THREE.Sprite(beaconMat);
  wtcBeacon.position.set(0, 227.5, 0);
  wtcBeacon.scale.set(9.5, 9.5, 1);
  wtcGroup.add(wtcBeacon);
  group.add(wtcGroup);

  // HERO 2: Verizon / 375 Pearl Street twin-slab tower (left of center, glowing horizontal yellow office bands)
  const verizonMat = makeHeroMat(2002, 'verizon', 0.65, 0.28);
  const verizon = new THREE.Mesh(new THREE.BoxGeometry(58, 148, 28), verizonMat);
  verizon.position.set(-108, 74, -405);
  group.add(verizon);

  // HERO 3: Slender shimmering residential glass tower (56 Leonard / 8 Spruce style)
  const slenderMat = makeHeroMat(3003, 'glass', 0.84, 0.14);
  const slender = new THREE.Mesh(new THREE.BoxGeometry(20, 156, 20), slenderMat);
  slender.position.set(-56, 78, -398);
  group.add(slender);

  // HERO 4: Woolworth-style Art Deco stepped spire left of One WTC
  const decoMat = makeHeroMat(4004, 'glass', 0.55, 0.34);
  const decoGroup = new THREE.Group();
  decoGroup.position.set(16, 0, -402);
  const d1 = new THREE.Mesh(new THREE.BoxGeometry(20, 108, 20), decoMat);
  d1.position.y = 54;
  const d2 = new THREE.Mesh(new THREE.BoxGeometry(13, 24, 13), decoMat);
  d2.position.y = 119;
  const d3 = new THREE.Mesh(new THREE.ConeGeometry(7.2, 24, 4), decoMat);
  d3.position.y = 143;
  d3.rotation.y = Math.PI / 4;
  decoGroup.add(d1, d2, d3);
  group.add(decoGroup);

  // HERO 5: Municipal Building golden-crowned cupola right of One WTC
  const muniGroup = new THREE.Group();
  muniGroup.position.set(74, 0, -395);
  const m1 = new THREE.Mesh(new THREE.BoxGeometry(30, 96, 22), decoMat);
  m1.position.y = 48;
  const mCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(6.5, 9.5, 22, 8),
    new THREE.MeshStandardMaterial({
      color: 0x42667a,
      emissive: new THREE.Color(0xffc966),
      emissiveIntensity: 1.6,
      metalness: 0.6,
      roughness: 0.3
    })
  );
  heroMaterials.push(mCrown.material);
  mCrown.position.y = 107;
  muniGroup.add(m1, mCrown);
  group.add(muniGroup);

  // HERO 6: Right cluster teal glass towers with warm crown strip
  const rightMat = makeHeroMat(5005, 'glass', 0.78, 0.20);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(36, 132, 26), rightMat);
  r1.position.set(126, 66, -408);
  const rCrown = new THREE.Mesh(
    new THREE.BoxGeometry(34, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe885).multiplyScalar(1.8) })
  );
  rCrown.position.set(126, 133.5, -408);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(26, 144, 24), slenderMat);
  r2.position.set(174, 72, -415);
  group.add(r1, rCrown, r2);

  return {
    group,
    update(atm, fogDensity, litRatio, time) {
      cutoutUniforms.uFogCol.value.copy(atm.fogCol);
      cutoutUniforms.uHorizon.value.copy(atm.horizon);
      cutoutUniforms.uAmbient.value.copy(atm.ambientSky);
      cutoutUniforms.uFogDensity.value = fogDensity;
      cutoutUniforms.uEmissiveBoost.value = atm.emissiveBoost;
      cutoutUniforms.uLitScale.value = THREE.MathUtils.clamp(litRatio / 0.32, 0.35, 1.85);

      const heroEm = atm.emissiveBoost * THREE.MathUtils.clamp(litRatio / 0.32, 0.4, 1.8) * 1.45;
      for (const m of heroMaterials) {
        m.emissiveIntensity = heroEm;
      }

      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2.8));
      beaconMat.opacity = pulse;
      const sc = 8.0 + pulse * 3.5;
      wtcBeacon.scale.set(sc, sc, 1);
    }
  };
}
