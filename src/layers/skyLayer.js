import * as THREE from 'three';

export function createSkyLayer(hdriEquirect) {
  const uniforms = {
    uHdri: { value: hdriEquirect },
    uZenith: { value: new THREE.Color(0x1f6b8c) },
    uMidSky: { value: new THREE.Color(0x7ca7b5) },
    uHorizon: { value: new THREE.Color(0xffbd7a) },
    uSunGlow: { value: new THREE.Color(0xffe1a3) },
    uNightFactor: { value: 0.22 },
    uTime: { value: 0 }
  };

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      #define PI 3.14159265359
      varying vec3 vDir;
      uniform sampler2D uHdri;
      uniform vec3 uZenith;
      uniform vec3 uMidSky;
      uniform vec3 uHorizon;
      uniform vec3 uSunGlow;
      uniform float uNightFactor;
      uniform float uTime;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      vec2 dirToEquirect(vec3 d) {
        // Rotate HDRI azimuth so its warm sunset glow aligns behind Manhattan (-Z)
        float u = atan(d.x, -d.z) / (2.0 * PI) + 0.5 + 0.14;
        float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
        return vec2(fract(u), v);
      }

      void main() {
        vec3 dir = normalize(vDir);
        float elev = clamp(dir.y, -0.2, 1.0);

        // Sample Poly Haven 2K twilight HDRI clouds & natural atmospheric scatter
        vec3 hdriCol = texture2D(uHdri, dirToEquirect(dir)).rgb;
        // Softly compress HDRI highlights so it blends naturally with our time-of-day palette
        hdriCol = hdriCol / (1.0 + hdriCol * 0.45);

        // Clean teal-blue zenith -> peach-orange horizon twilight gradient
        float t1 = smoothstep(-0.02, 0.15, elev);
        float t2 = smoothstep(0.12, 0.42, elev);
        vec3 gradCol = mix(uHorizon, uMidSky, t1);
        gradCol = mix(gradCol, uZenith, t2);

        // Warm sunset bloom directly behind the central skyline gap (-Z)
        vec3 sunDir = normalize(vec3(0.02, 0.048, -1.0));
        float sDot = max(dot(dir, sunDir), 0.0);
        float horizonBand = exp(-abs(dir.y - 0.032) * 6.5);
        gradCol += uSunGlow * pow(sDot, 4.2) * horizonBand * 0.62;
        gradCol += uHorizon * pow(sDot, 1.8) * horizonBand * 0.22;

        // Blend natural HDRI cloud detail with controlled Time-of-Day sky palette
        float hdriWeight = mix(0.36, 0.08, uNightFactor);
        vec3 tintedHdri = hdriCol * mix(vec3(1.0, 0.96, 0.92), uMidSky * 1.4, uNightFactor);
        vec3 col = mix(gradCol, tintedHdri * 0.9 + gradCol * 0.45, hdriWeight);

        // Subtle stars fading in at deep dusk / night
        if (uNightFactor > 0.32 && dir.y > 0.09) {
          vec2 grid = floor(dir.xz / (dir.y + 0.24) * 185.0);
          float star = hash21(grid);
          if (star > 0.9962) {
            float tw = 0.65 + 0.35 * sin(uTime * 2.4 + star * 700.0);
            float vis = smoothstep(0.32, 0.92, uNightFactor) * smoothstep(0.09, 0.28, dir.y);
            col += vec3(0.86, 0.93, 1.0) * tw * vis * 0.95;
          }
        }

        // Below horizon dark urban glow
        if (dir.y < 0.0) {
          col = mix(col, uHorizon * 0.22, smoothstep(0.0, -0.15, dir.y));
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(950, 48, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return {
    group: mesh,
    update(atm, time, camPos) {
      mesh.position.copy(camPos);
      uniforms.uZenith.value.copy(atm.zenith);
      uniforms.uMidSky.value.copy(atm.midSky);
      uniforms.uHorizon.value.copy(atm.horizon);
      uniforms.uSunGlow.value.copy(atm.sunGlow);
      uniforms.uNightFactor.value = atm.nightFactor;
      uniforms.uTime.value = time;
    }
  };
}
