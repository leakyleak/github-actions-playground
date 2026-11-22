import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

const STOPS = [
  {
    t: 0.0, // Golden Sunset
    zenith:  new THREE.Color(0x2d7da3),
    midSky:  new THREE.Color(0x98b5bc),
    horizon: new THREE.Color(0xffaa62),
    sunGlow: new THREE.Color(0xffd78e),
    fogCol:  new THREE.Color(0xeba87c),
    ambientSky: new THREE.Color(0x6c9eb5),
    ambientGround: new THREE.Color(0x523626),
    sunLight: new THREE.Color(0xffb474),
    sunIntensity: 1.5,
    envIntensity: 1.25,
    emissiveBoost: 0.55,
    nightFactor: 0.0
  },
  {
    t: 0.36, // Signature Twilight (matches reference photo)
    zenith:  new THREE.Color(0x1f6b8c),
    midSky:  new THREE.Color(0x7ca7b5),
    horizon: new THREE.Color(0xffbd7a),
    sunGlow: new THREE.Color(0xffe1a3),
    fogCol:  new THREE.Color(0xd9a88a),
    ambientSky: new THREE.Color(0x467996),
    ambientGround: new THREE.Color(0x4a2916),
    sunLight: new THREE.Color(0xffa663),
    sunIntensity: 1.05,
    envIntensity: 1.0,
    emissiveBoost: 1.05,
    nightFactor: 0.22
  },
  {
    t: 0.72, // Deep Blue-Hour Dusk
    zenith:  new THREE.Color(0x0b223d),
    midSky:  new THREE.Color(0x213d59),
    horizon: new THREE.Color(0x9c5144),
    sunGlow: new THREE.Color(0xd46d46),
    fogCol:  new THREE.Color(0x4f3a47),
    ambientSky: new THREE.Color(0x203b59),
    ambientGround: new THREE.Color(0x361d12),
    sunLight: new THREE.Color(0xa65842),
    sunIntensity: 0.45,
    envIntensity: 0.48,
    emissiveBoost: 1.65,
    nightFactor: 0.72
  },
  {
    t: 1.0, // Night
    zenith:  new THREE.Color(0x040a18),
    midSky:  new THREE.Color(0x0c172b),
    horizon: new THREE.Color(0x2d283d),
    sunGlow: new THREE.Color(0x4a3846),
    fogCol:  new THREE.Color(0x171a29),
    ambientSky: new THREE.Color(0x122238),
    ambientGround: new THREE.Color(0x2b170c),
    sunLight: new THREE.Color(0x3d3852),
    sunIntensity: 0.22,
    envIntensity: 0.26,
    emissiveBoost: 2.15,
    nightFactor: 1.0
  }
];

export function getAtmosphere(tod, target = null) {
  let a = STOPS[0];
  let b = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (tod >= STOPS[i].t && tod <= STOPS[i + 1].t) {
      a = STOPS[i];
      b = STOPS[i + 1];
      break;
    }
  }
  const f = a === b ? 0 : (tod - a.t) / (b.t - a.t);
  const out = target || {
    zenith: new THREE.Color(),
    midSky: new THREE.Color(),
    horizon: new THREE.Color(),
    sunGlow: new THREE.Color(),
    fogCol: new THREE.Color(),
    ambientSky: new THREE.Color(),
    ambientGround: new THREE.Color(),
    sunLight: new THREE.Color(),
    sunIntensity: 1,
    envIntensity: 1,
    emissiveBoost: 1,
    nightFactor: 0
  };
  out.zenith.copy(a.zenith).lerp(b.zenith, f);
  out.midSky.copy(a.midSky).lerp(b.midSky, f);
  out.horizon.copy(a.horizon).lerp(b.horizon, f);
  out.sunGlow.copy(a.sunGlow).lerp(b.sunGlow, f);
  out.fogCol.copy(a.fogCol).lerp(b.fogCol, f);
  out.ambientSky.copy(a.ambientSky).lerp(b.ambientSky, f);
  out.ambientGround.copy(a.ambientGround).lerp(b.ambientGround, f);
  out.sunLight.copy(a.sunLight).lerp(b.sunLight, f);
  out.sunIntensity = lerp(a.sunIntensity, b.sunIntensity, f);
  out.envIntensity = lerp(a.envIntensity, b.envIntensity, f);
  out.emissiveBoost = lerp(a.emissiveBoost, b.emissiveBoost, f);
  out.nightFactor = lerp(a.nightFactor, b.nightFactor, f);
  return out;
}
