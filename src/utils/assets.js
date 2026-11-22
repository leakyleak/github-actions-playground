import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

function configureTex(tex, isColor = false, repeatX = 1, repeatY = 1) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export async function loadAllAssets(renderer) {
  const texLoader = new THREE.TextureLoader();
  const rgbeLoader = new RGBELoader();
  const inline = window.__INLINE_ASSETS__ || null;

  const loadTex = (url, isColor, rx = 1, ry = 1) =>
    new Promise((resolve, reject) => {
      texLoader.load(
        url,
        (t) => resolve(configureTex(t, isColor, rx, ry)),
        undefined,
        reject
      );
    });

  const loadHDR = (url) =>
    new Promise((resolve, reject) => {
      rgbeLoader.load(url, resolve, undefined, reject);
    });

  const src = (key, fallback) => (inline && inline[key] ? inline[key] : fallback);

  const [
    hdriEquirect,
    brickRedDiff, brickRedNor, brickRedRough,
    brickDarkDiff, brickDarkNor, brickDarkRough,
    asphaltDiff, asphaltNor, asphaltRough
  ] = await Promise.all([
    inline && inline.skyEquirect
      ? loadTex(inline.skyEquirect, true, 1, 1)
      : loadHDR('./assets/hdri/industrial_sunset_02_puresky_2k.hdr'),
    loadTex(src('brickRedDiff', './assets/textures/brick_red/diffuse.jpg'), true, 1, 1),
    loadTex(src('brickRedNor', './assets/textures/brick_red/nor_gl.jpg'), false, 1, 1),
    loadTex(src('brickRedRough', './assets/textures/brick_red/rough.jpg'), false, 1, 1),
    loadTex(src('brickDarkDiff', './assets/textures/brick_dark/diffuse.jpg'), true, 1, 1),
    loadTex(src('brickDarkNor', './assets/textures/brick_dark/nor_gl.jpg'), false, 1, 1),
    loadTex(src('brickDarkRough', './assets/textures/brick_dark/rough.jpg'), false, 1, 1),
    loadTex(src('asphaltDiff', './assets/textures/asphalt/diffuse.jpg'), true, 2, 18),
    loadTex(src('asphaltNor', './assets/textures/asphalt/nor_gl.jpg'), false, 2, 18),
    loadTex(src('asphaltRough', './assets/textures/asphalt/rough.jpg'), false, 2, 18)
  ]);

  hdriEquirect.mapping = THREE.EquirectangularReflectionMapping;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(hdriEquirect);
  pmrem.dispose();

  return {
    hdriEquirect,
    envMap: envRT.texture,
    brickRed: { map: brickRedDiff, normalMap: brickRedNor, roughnessMap: brickRedRough },
    brickDark: { map: brickDarkDiff, normalMap: brickDarkNor, roughnessMap: brickDarkRough },
    asphalt: { map: asphaltDiff, normalMap: asphaltNor, roughnessMap: asphaltRough }
  };
}

export function createGlowSpriteTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.14, 'rgba(255,255,255,0.88)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.34)');
  grad.addColorStop(0.68, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
