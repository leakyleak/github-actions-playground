// Photo+ Deconstructed NYC Rig Engine
// Fixes the 2 bugs shown in the reference screenshot:
//   1. Windows are clipped to exact perspective quadrilateral building facades (and excluded from bridge deck, sky, cables, and water).
//   2. Traffic vehicles are projected onto the exact perspective-calibrated highway/avenue splines with tangent rotation, 3D shaded vehicle silhouettes, cast shadows, and oriented headlight/taillight beams.

import { mulberry32, clamp, lerp } from '../utils/rng.js';

// ---------------------------------------------------------------------------
// SCENE 1: BROOKLYN BRIDGE & FDR DRIVE ("Bridge alive")
// Calibrated to public/assets/plates/bridge_clean.jpg (1376 x 768)
// ---------------------------------------------------------------------------
export const BRIDGE_RIG_DATA = {
  id: 'bridge_photo',
  name: 'Bridge Alive (Photo+ Deconstructed)',
  plateUrl: './assets/plates/bridge_clean.jpg',
  skylineHorizonY: 0.48,
  waterPolygon: [
    [0.0, 0.515],
    [0.305, 0.525],
    [0.310, 0.578],
    [0.480, 0.585],
    [0.640, 0.625],
    [0.600, 0.998],
    [0.0, 0.998]
  ],
  // Exclusion polygons where window lights must NEVER draw (Brooklyn Bridge stone tower + bridge roadway deck)
  exclusionPolygons: [
    // Brooklyn Bridge elevated deck & truss crossing in front of Lower Manhattan
    [
      [0.0, 0.400],
      [0.400, 0.436],
      [0.778, 0.494],
      [0.778, 0.529],
      [0.400, 0.473],
      [0.0, 0.449]
    ],
    // Brooklyn Bridge gothic stone tower
    [
      [0.138, 0.132],
      [0.228, 0.132],
      [0.228, 0.672],
      [0.138, 0.672]
    ]
  ],
  // Aviation red warning beacons on skyscraper spires & bridge tower
  beacons: [
    { x: 0.186, y: 0.104, color: '#ff3322', size: 10, phase: 0.0 },
    { x: 0.621, y: 0.128, color: '#ff3322', size: 9, phase: 1.4 },
    { x: 0.684, y: 0.180, color: '#ff3322', size: 8, phase: 2.7 },
    { x: 0.486, y: 0.205, color: '#ff3322', size: 7, phase: 0.8 }
  ],
  // Perspective-warped building facade quads: [topLeft, topRight, bottomRight, bottomLeft]
  buildings: [
    {
      id: 'waterfront_left_tower',
      name: 'South St Glass Tower',
      quad: [[0.405, 0.284], [0.452, 0.284], [0.452, 0.444], [0.405, 0.444]],
      cols: 12,
      rows: 26,
      padX: 0.26,
      padY: 0.30,
      style: 'office_cool',
      cluster: 0.55
    },
    {
      id: 'slender_spire_tower',
      name: 'Maiden Lane Slender Tower',
      quad: [[0.458, 0.210], [0.501, 0.210], [0.501, 0.448], [0.458, 0.448]],
      cols: 9,
      rows: 34,
      padX: 0.28,
      padY: 0.32,
      style: 'warm_gold',
      cluster: 0.45
    },
    {
      id: 'mid_white_annex',
      name: 'Water St Mid Annex',
      quad: [[0.513, 0.342], [0.547, 0.342], [0.547, 0.458], [0.513, 0.458]],
      cols: 8,
      rows: 16,
      padX: 0.30,
      padY: 0.32,
      style: 'warm_gold',
      cluster: 0.40
    },
    {
      id: 'seventy_pine_upper',
      name: '70 Pine Street Art Deco Upper',
      quad: [[0.595, 0.198], [0.640, 0.198], [0.640, 0.302], [0.595, 0.302]],
      cols: 11,
      rows: 18,
      padX: 0.30,
      padY: 0.32,
      style: 'deco_amber',
      cluster: 0.50
    },
    {
      id: 'wall_st_plaza',
      name: 'Wall St Dark Curtain Slab',
      quad: [[0.574, 0.304], [0.634, 0.304], [0.634, 0.468], [0.574, 0.468]],
      cols: 16,
      rows: 26,
      padX: 0.24,
      padY: 0.28,
      style: 'office_mixed',
      cluster: 0.65
    },
    {
      id: 'forty_wall_upper',
      name: '40 Wall Street Crown Shaft',
      quad: [[0.670, 0.234], [0.697, 0.234], [0.697, 0.314], [0.670, 0.314]],
      cols: 7,
      rows: 14,
      padX: 0.30,
      padY: 0.32,
      style: 'deco_amber',
      cluster: 0.50
    },
    {
      id: 'fidi_blue_slab',
      name: '111 Wall Cyan Glass Slab',
      quad: [[0.648, 0.316], [0.695, 0.316], [0.695, 0.478], [0.648, 0.478]],
      cols: 13,
      rows: 24,
      padX: 0.24,
      padY: 0.28,
      style: 'office_cool',
      cluster: 0.60
    },
    {
      id: 'chase_plaza_28_liberty',
      name: '28 Liberty (One Chase Plaza)',
      quad: [[0.718, 0.178], [0.780, 0.178], [0.780, 0.378], [0.718, 0.378]],
      cols: 18,
      rows: 34,
      padX: 0.24,
      padY: 0.28,
      style: 'office_mixed',
      cluster: 0.72
    },
    {
      id: 'stepped_dark_mid',
      name: 'Fulton Stepped Office Tower',
      quad: [[0.701, 0.354], [0.745, 0.354], [0.745, 0.482], [0.701, 0.482]],
      cols: 12,
      rows: 20,
      padX: 0.26,
      padY: 0.30,
      style: 'warm_gold',
      cluster: 0.58
    },
    {
      id: 'mid_right_block',
      name: 'Pearl St Commercial Block',
      quad: [[0.791, 0.248], [0.834, 0.248], [0.834, 0.374], [0.791, 0.374]],
      cols: 11,
      rows: 19,
      padX: 0.26,
      padY: 0.30,
      style: 'office_mixed',
      cluster: 0.55
    },
    {
      id: 'rear_silver_tower',
      name: 'Cliff St Silver Tower',
      quad: [[0.834, 0.200], [0.866, 0.200], [0.866, 0.358], [0.834, 0.358]],
      cols: 9,
      rows: 26,
      padX: 0.28,
      padY: 0.30,
      style: 'office_cool',
      cluster: 0.52
    },
    {
      id: 'dark_bronze_tower',
      name: 'Beekman Bronze Tower',
      quad: [[0.877, 0.195], [0.933, 0.195], [0.933, 0.364], [0.877, 0.364]],
      cols: 14,
      rows: 28,
      padX: 0.25,
      padY: 0.28,
      style: 'warm_gold',
      cluster: 0.62
    },
    {
      id: 'rear_cyan_curtain',
      name: 'Pace Glass Curtain Tower',
      quad: [[0.915, 0.154], [0.962, 0.154], [0.962, 0.334], [0.915, 0.334]],
      cols: 11,
      rows: 26,
      padX: 0.25,
      padY: 0.28,
      style: 'office_cool',
      cluster: 0.56
    },
    {
      id: 'far_right_skyscraper',
      name: 'Civic Center Highrise',
      quad: [[0.975, 0.098], [0.998, 0.098], [0.998, 0.352], [0.975, 0.352]],
      cols: 6,
      rows: 36,
      padX: 0.26,
      padY: 0.28,
      style: 'office_mixed',
      cluster: 0.60
    },
    {
      id: 'southbridge_towers_left',
      name: 'Southbridge Brick Apartments I',
      quad: [[0.775, 0.390], [0.864, 0.390], [0.864, 0.558], [0.775, 0.558]],
      cols: 14,
      rows: 18,
      padX: 0.34,
      padY: 0.36,
      style: 'apartment_warm',
      cluster: 0.25
    },
    {
      id: 'southbridge_towers_right',
      name: 'Southbridge Brick Apartments II',
      quad: [[0.869, 0.416], [0.967, 0.416], [0.967, 0.554], [0.869, 0.554]],
      cols: 15,
      rows: 15,
      padX: 0.34,
      padY: 0.36,
      style: 'apartment_warm',
      cluster: 0.25
    },
    {
      id: 'fg_loft_side',
      name: 'Seaport Industrial Loft (West Wall)',
      quad: [[0.823, 0.568], [0.913, 0.612], [0.913, 0.852], [0.823, 0.724]],
      cols: 8,
      rows: 6,
      padX: 0.22,
      padY: 0.28,
      style: 'loft_warm',
      cluster: 0.38
    },
    {
      id: 'fg_loft_front',
      name: 'Seaport Industrial Loft (South Wall)',
      quad: [[0.919, 0.612], [0.997, 0.612], [0.997, 0.862], [0.919, 0.862]],
      cols: 4,
      rows: 6,
      padX: 0.20,
      padY: 0.26,
      style: 'loft_warm',
      cluster: 0.42
    },
    {
      id: 'pier_17_pavilion',
      name: 'Pier 17 Seaport Pavilion',
      quad: [[0.313, 0.522], [0.435, 0.522], [0.435, 0.560], [0.313, 0.560]],
      cols: 16,
      rows: 4,
      padX: 0.18,
      padY: 0.22,
      style: 'deco_amber',
      cluster: 0.75
    }
  ],
  // Perspective-calibrated FDR Drive highway waypoints: [y, leftOuterX, centerDividerX, rightOuterX]
  highwayWaypoints: [
    [0.575, 0.612, 0.628, 0.645],
    [0.600, 0.665, 0.704, 0.742],
    [0.650, 0.680, 0.726, 0.772],
    [0.720, 0.668, 0.733, 0.796],
    [0.800, 0.653, 0.740, 0.825],
    [0.900, 0.635, 0.752, 0.864],
    [0.996, 0.616, 0.765, 0.904]
  ],
  lanesPerSide: 3,
  vehicleScaleNear: 1.05,
  vehicleScaleFar: 0.16,
  // Secondary bridge traffic streak path across the Brooklyn Bridge deck
  bridgeDeckTraffic: {
    start: [0.02, 0.426],
    mid: [0.40, 0.456],
    end: [0.76, 0.512]
  }
};

// ---------------------------------------------------------------------------
// SCENE 2: MIDTOWN MANHATTAN AVENUE ("Street alive")
// Calibrated to public/assets/plates/midtown_clean.jpg (1376 x 768)
// ---------------------------------------------------------------------------
export const MIDTOWN_RIG_DATA = {
  id: 'midtown_photo',
  name: 'Street Alive (Photo+ Deconstructed)',
  plateUrl: './assets/plates/midtown_clean.jpg',
  skylineHorizonY: 0.36,
  waterPolygon: null,
  exclusionPolygons: [],
  beacons: [
    { x: 0.626, y: 0.008, color: '#ff3322', size: 10, phase: 0.2 },
    { x: 0.252, y: 0.015, color: '#ff3322', size: 9, phase: 1.7 },
    { x: 0.155, y: 0.042, color: '#ff3322', size: 8, phase: 2.9 }
  ],
  buildings: [
    {
      id: 'left_fg_curtain_tower',
      name: '42nd St Glass Curtain Tower (Left)',
      quad: [[0.003, 0.004], [0.145, 0.052], [0.145, 0.992], [0.003, 0.992]],
      cols: 10,
      rows: 28,
      padX: 0.16,
      padY: 0.20,
      style: 'office_mixed',
      cluster: 0.65
    },
    {
      id: 'left_dark_slab_upper',
      name: 'Grace Annex Upper Setback',
      quad: [[0.138, 0.202], [0.275, 0.202], [0.275, 0.428], [0.138, 0.428]],
      cols: 16,
      rows: 16,
      padX: 0.22,
      padY: 0.26,
      style: 'warm_gold',
      cluster: 0.72
    },
    {
      id: 'left_dark_slab_lower',
      name: 'Grace Annex Lower Tower',
      quad: [[0.149, 0.432], [0.253, 0.432], [0.253, 0.955], [0.149, 0.955]],
      cols: 12,
      rows: 26,
      padX: 0.20,
      padY: 0.24,
      style: 'office_mixed',
      cluster: 0.68
    },
    {
      id: 'mid_left_canyon_slab',
      name: 'Bryant Mid-Block Tower',
      quad: [[0.283, 0.248], [0.343, 0.248], [0.343, 0.695], [0.283, 0.695]],
      cols: 9,
      rows: 28,
      padX: 0.26,
      padY: 0.28,
      style: 'warm_gold',
      cluster: 0.55
    },
    {
      id: 'center_left_supertall',
      name: 'One Vanderbilt / Midtown Supertall',
      quad: [[0.349, 0.006], [0.447, 0.006], [0.447, 0.786], [0.349, 0.786]],
      cols: 14,
      rows: 46,
      padX: 0.18,
      padY: 0.22,
      style: 'office_mixed',
      cluster: 0.74
    },
    {
      id: 'deep_canyon_left',
      name: 'Lexington Canyon North Block',
      quad: [[0.457, 0.238], [0.505, 0.238], [0.505, 0.615], [0.457, 0.615]],
      cols: 8,
      rows: 26,
      padX: 0.28,
      padY: 0.30,
      style: 'warm_gold',
      cluster: 0.52
    },
    {
      id: 'metlife_panam_tower',
      name: 'MetLife Building (200 Park Ave)',
      quad: [[0.551, 0.185], [0.601, 0.185], [0.601, 0.558], [0.551, 0.558]],
      cols: 12,
      rows: 32,
      padX: 0.26,
      padY: 0.28,
      style: 'office_mixed',
      cluster: 0.64
    },
    {
      id: 'chrysler_shaft',
      name: 'Chrysler Building Art Deco Shaft',
      quad: [[0.601, 0.218], [0.651, 0.218], [0.651, 0.638], [0.601, 0.638]],
      cols: 10,
      rows: 34,
      padX: 0.28,
      padY: 0.30,
      style: 'deco_amber',
      cluster: 0.60
    },
    {
      id: 'fg_right_dark_monolith',
      name: 'Third Ave Dark Glass Monolith',
      quad: [[0.631, 0.446], [0.753, 0.446], [0.753, 0.992], [0.631, 0.992]],
      cols: 14,
      rows: 28,
      padX: 0.20,
      padY: 0.24,
      style: 'office_cool',
      cluster: 0.70
    },
    {
      id: 'mid_right_setback_tower',
      name: 'Grand Central East Tower',
      quad: [[0.743, 0.208], [0.815, 0.208], [0.815, 0.556], [0.743, 0.556]],
      cols: 12,
      rows: 26,
      padX: 0.26,
      padY: 0.28,
      style: 'warm_gold',
      cluster: 0.58
    },
    {
      id: 'right_teal_office_slab',
      name: 'Chanin / Teal Curtain Tower',
      quad: [[0.795, 0.308], [0.873, 0.308], [0.873, 0.768], [0.795, 0.768]],
      cols: 12,
      rows: 30,
      padX: 0.20,
      padY: 0.24,
      style: 'office_cool',
      cluster: 0.68
    },
    {
      id: 'far_right_fg_skyscraper',
      name: 'Tudor City Foreground Glass Tower',
      quad: [[0.873, 0.004], [0.997, 0.004], [0.997, 0.992], [0.873, 0.992]],
      cols: 9,
      rows: 28,
      padX: 0.16,
      padY: 0.20,
      style: 'office_mixed',
      cluster: 0.64
    }
  ],
  // Perspective-calibrated 42nd St / Midtown Avenue waypoints: [y, leftOuterX, centerDividerX, rightOuterX]
  highwayWaypoints: [
    [0.435, 0.524, 0.531, 0.538],
    [0.550, 0.512, 0.528, 0.544],
    [0.680, 0.496, 0.522, 0.548],
    [0.820, 0.478, 0.516, 0.554],
    [0.996, 0.456, 0.508, 0.560]
  ],
  lanesPerSide: 2,
  vehicleScaleNear: 0.92,
  vehicleScaleFar: 0.13,
  bridgeDeckTraffic: null
};

// ---------------------------------------------------------------------------
// GEOMETRY HELPERS: Bilinear Quad Interpolation & Point-in-Polygon
// ---------------------------------------------------------------------------
function bilerpQuad(quad, u, v) {
  const [tl, tr, br, bl] = quad;
  const topX = lerp(tl[0], tr[0], u);
  const topY = lerp(tl[1], tr[1], u);
  const botX = lerp(bl[0], br[0], u);
  const botY = lerp(bl[1], br[1], u);
  return [lerp(topX, botX, v), lerp(topY, botY, v)];
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Sample highway spline position, tangent angle, and perspective depth scale at parameter s in [0, 1]
function sampleHighwayLane(waypoints, lanesPerSide, laneIndex, sRaw) {
  // Apply perspective foreshortening curve so vehicles move at realistic world speed
  // (s=0 is far vanishing point, s=1 is close foreground)
  const s = clamp(sRaw, 0, 1);
  const yMin = waypoints[0][0];
  const yMax = waypoints[waypoints.length - 1][0];
  // Quadratic perspective mapping so far cars move slowly in screen space and accelerate toward foreground
  const perspT = Math.pow(s, 1.55);
  const targetY = lerp(yMin, yMax, perspT);

  // Find segment containing targetY
  let segIdx = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (targetY >= waypoints[i][0] && targetY <= waypoints[i + 1][0]) {
      segIdx = i;
      break;
    }
  }
  const wpA = waypoints[segIdx];
  const wpB = waypoints[segIdx + 1];
  const segF = clamp((targetY - wpA[0]) / Math.max(1e-5, wpB[0] - wpA[0]), 0, 1);

  const laneXAt = (wp) => {
    const [, lx, cx, rx] = wp;
    if (laneIndex < lanesPerSide) {
      const frac = (laneIndex + 0.5) / lanesPerSide;
      return lerp(lx, cx, frac);
    } else {
      const frac = (laneIndex - lanesPerSide + 0.5) / lanesPerSide;
      return lerp(cx, rx, frac);
    }
  };

  const xA = laneXAt(wpA);
  const xB = laneXAt(wpB);
  const x = lerp(xA, xB, segF);
  const y = targetY;

  // Tangent vector along lane in normalized coordinates
  const dx = xB - xA;
  const dy = wpB[0] - wpA[0];

  return { x, y, dx, dy, depth: perspT };
}

// ---------------------------------------------------------------------------
// PHOTO+ RIG CLASS
// ---------------------------------------------------------------------------
export class PhotoPlusRig {
  constructor(rigData) {
    this.data = rigData;
    this.image = null;
    this.loaded = false;
    this.windows = [];
    this.vehicles = [];
    this.bridgeVehicles = [];
    this.birds = [];
    this.plane = { x: 0.12, y: 0.11, vx: 0.018 };

    this._buildWindows();
    this._buildTraffic();
    this._buildSkyLife();
  }

  async load() {
    if (this.loaded) return;
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.image = img;
        this.loaded = true;
        resolve();
      };
      img.onerror = reject;
      img.src = this.data.plateUrl;
    });
  }

  _buildWindows() {
    const rand = mulberry32(this.data.id === 'bridge_photo' ? 8821 : 4491);
    const exclusions = this.data.exclusionPolygons || [];
    this.windows = [];

    for (const b of this.data.buildings) {
      const { quad, cols, rows, padX, padY, style, cluster } = b;
      for (let r = 0; r < rows; r++) {
        // Per-floor office occupancy probability so lit windows form realistic horizontal floor bands
        const floorSeed = rand();
        const floorBias = floorSeed < cluster ? 0.25 + rand() * 0.45 : rand() * 0.25;

        for (let c = 0; c < cols; c++) {
          const u0 = (c + padX * 0.5) / cols;
          const u1 = (c + 1 - padX * 0.5) / cols;
          const v0 = (r + padY * 0.5) / rows;
          const v1 = (r + 1 - padY * 0.5) / rows;
          const uc = (u0 + u1) * 0.5;
          const vc = (v0 + v1) * 0.5;

          const [cx, cy] = bilerpQuad(quad, uc, vc);

          // Check exclusion masks (e.g. Brooklyn Bridge deck crossing in front of building!)
          let excluded = false;
          for (const exPoly of exclusions) {
            if (pointInPolygon(cx, cy, exPoly)) {
              excluded = true;
              break;
            }
          }
          if (excluded) continue;

          // Compute exact 4 corners of the perspective-projected window cell
          const pTL = bilerpQuad(quad, u0, v0);
          const pTR = bilerpQuad(quad, u1, v0);
          const pBR = bilerpQuad(quad, u1, v1);
          const pBL = bilerpQuad(quad, u0, v1);

          // Threshold in [0, 1] determining when this window turns on as Lit Windows % increases
          const cellRand = rand();
          const threshold = clamp(cellRand * 0.72 + (1.0 - floorBias) * 0.28, 0.02, 0.98);

          // Color palette per building style
          const colorPick = rand();
          let rgb;
          if (style === 'office_cool') {
            rgb = colorPick < 0.52 ? [185, 232, 255] : colorPick < 0.85 ? [255, 232, 168] : [255, 198, 110];
          } else if (style === 'deco_amber') {
            rgb = colorPick < 0.75 ? [255, 204, 102] : [255, 236, 175];
          } else if (style === 'apartment_warm' || style === 'loft_warm') {
            rgb = colorPick < 0.65 ? [255, 182, 84] : colorPick < 0.90 ? [255, 224, 142] : [196, 228, 255];
          } else {
            rgb = colorPick < 0.64 ? [255, 220, 138] : colorPick < 0.84 ? [255, 178, 86] : [190, 235, 255];
          }

          this.windows.push({
            buildingId: b.id,
            corners: [pTL, pTR, pBR, pBL],
            cx,
            cy,
            threshold,
            rgb,
            flickerFreq: 0.35 + rand() * 1.4,
            flickerPhase: rand() * Math.PI * 2,
            intensity: 0.72 + rand() * 0.38
          });
        }
      }
    }
  }

  _buildTraffic() {
    const rand = mulberry32(this.data.id === 'bridge_photo' ? 7719 : 9923);
    const totalLanes = this.data.lanesPerSide * 2;
    this.vehicles = [];

    const bodyColors = [
      '#1e242d', // Dark charcoal sedan
      '#38424f', // Slate SUV
      '#8b939c', // Silver metallic
      '#d49b1e', // Iconic NYC Yellow Taxi!
      '#d9a121', // NYC Yellow Taxi
      '#c8cdd2', // Pearl white
      '#4f2121'  // Deep burgundy
    ];

    const vehiclesPerLane = this.data.id === 'bridge_photo' ? 7 : 9;
    for (let lane = 0; lane < totalLanes; lane++) {
      const incoming = lane < this.data.lanesPerSide; // Left lanes: oncoming (headlights); Right lanes: outgoing (taillights)
      const baseSpeed = (0.095 + (lane % this.data.lanesPerSide) * 0.022) * (incoming ? 1.0 : 1.08);

      for (let k = 0; k < vehiclesPerLane; k++) {
        const s = (k + rand() * 0.72) / vehiclesPerLane;
        const isTaxi = rand() < (this.data.id === 'midtown_photo' ? 0.42 : 0.24);
        const isSuv = rand() < 0.32;
        this.vehicles.push({
          lane,
          incoming,
          s: s % 1.0,
          speed: baseSpeed * (0.88 + rand() * 0.24),
          color: isTaxi ? '#e5a922' : bodyColors[Math.floor(rand() * bodyColors.length)],
          isTaxi,
          isSuv,
          laneJitter: (rand() - 0.5) * 0.14
        });
      }
    }

    // Secondary subtle traffic stream across the Brooklyn Bridge deck
    this.bridgeVehicles = [];
    if (this.data.bridgeDeckTraffic) {
      for (let i = 0; i < 18; i++) {
        this.bridgeVehicles.push({
          t: rand(),
          dir: i % 2 === 0 ? 1 : -1,
          speed: 0.045 + rand() * 0.025
        });
      }
    }
  }

  _buildSkyLife() {
    const rand = mulberry32(3109);
    this.birds = [];
    for (let i = 0; i < 9; i++) {
      this.birds.push({
        x: 0.08 + rand() * 0.65,
        y: 0.10 + rand() * 0.18,
        vx: 0.012 + rand() * 0.010,
        vy: (rand() - 0.5) * 0.003,
        wingPhase: rand() * Math.PI * 2,
        size: 3.2 + rand() * 2.4
      });
    }
  }

  update(dt, time, trafficSpeed) {
    // Advance primary highway / avenue vehicles along their splines
    for (const v of this.vehicles) {
      const dir = v.incoming ? 1 : -1;
      v.s += dir * v.speed * trafficSpeed * dt;
      if (v.s > 1.0) v.s -= 1.0;
      if (v.s < 0.0) v.s += 1.0;
    }

    for (const bv of this.bridgeVehicles) {
      bv.t += bv.dir * bv.speed * trafficSpeed * dt;
      if (bv.t > 1.0) bv.t -= 1.0;
      if (bv.t < 0.0) bv.t += 1.0;
    }

    // Advance birds & distant airplane
    for (const b of this.birds) {
      b.x += b.vx * dt;
      b.y += Math.sin(time * 1.5 + b.wingPhase) * 0.00015;
      if (b.x > 1.04) b.x = -0.04;
    }
    this.plane.x += this.plane.vx * dt;
    if (this.plane.x > 1.08) this.plane.x = -0.08;
  }

  // Render the complete deconstructed Photo+ scene to a 2D canvas with parallax & debug overlays
  render(ctx, width, height, state) {
    if (!this.loaded || !this.image) return;

    const {
      tod,          // 0 = Sunset, 0.36 = Twilight, 0.72 = Dusk, 1.0 = Night
      litRatio,     // 0.05 .. 0.90
      bloomScale,   // 0 .. 2
      fogScale,     // 0 .. 2
      exposure,     // 0.6 .. 1.7
      curParX,      // -1 .. 1
      curParY,      // -1 .. 1
      photoLayers,  // { base, windows, traffic, water, skyLife, debug }
      time
    } = state;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Compute cover-fit viewport rectangle with overscan for smooth cursor parallax
    const imgAspect = this.image.width / this.image.height;
    const viewAspect = width / height;
    const overscan = 1.048;
    let drawW, drawH;
    if (viewAspect > imgAspect) {
      drawW = width * overscan;
      drawH = drawW / imgAspect;
    } else {
      drawH = height * overscan;
      drawW = drawH * imgAspect;
    }
    const parShiftX = -curParX * (drawW - width) * 0.42;
    const parShiftY = -curParY * (drawH - height) * 0.42;
    const ox = (width - drawW) * 0.5 + parShiftX;
    const oy = (height - drawH) * 0.5 + parShiftY;

    const toScreen = (nx, ny, depthParallax = 0) => [
      ox + nx * drawW - curParX * depthParallax * 14,
      oy + ny * drawH - curParY * depthParallax * 8
    ];

    // Night factor & day-to-night color grading
    const nightFactor = clamp((tod - 0.15) / 0.85, 0, 1);
    const duskFactor = clamp(1.0 - Math.abs(tod - 0.38) * 2.2, 0, 1);

    // 1. BASE ARCHITECTURAL PLATE LAYER
    if (photoLayers.base) {
      ctx.save();
      const brightness = clamp(lerp(1.06, 0.42, nightFactor) * exposure, 0.25, 1.85);
      const contrast = lerp(1.04, 1.16, nightFactor);
      const saturate = lerp(1.12, 0.82, nightFactor);
      ctx.filter = `brightness(${brightness.toFixed(2)}) contrast(${contrast.toFixed(2)}) saturate(${saturate.toFixed(2)})`;
      ctx.drawImage(this.image, ox, oy, drawW, drawH);
      ctx.restore();

      // Atmospheric time-of-day color grade overlay (golden hour warmth -> deep blue hour -> midnight indigo)
      ctx.save();
      if (nightFactor > 0.02) {
        ctx.globalCompositeOperation = 'multiply';
        const grad = ctx.createLinearGradient(0, oy, 0, oy + drawH);
        const rTop = Math.round(lerp(245, 58, nightFactor));
        const gTop = Math.round(lerp(235, 86, nightFactor));
        const bTop = Math.round(lerp(250, 148, nightFactor));
        const rBot = Math.round(lerp(255, 82, nightFactor));
        const gBot = Math.round(lerp(238, 92, nightFactor));
        const bBot = Math.round(lerp(225, 132, nightFactor));
        grad.addColorStop(0, `rgb(${rTop},${gTop},${bTop})`);
        grad.addColorStop(1, `rgb(${rBot},${gBot},${bBot})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // Horizon atmospheric haze / sunset glow band
      if (fogScale > 0.02) {
        ctx.globalCompositeOperation = 'screen';
        const hY = oy + this.data.skylineHorizonY * drawH;
        const hGrad = ctx.createLinearGradient(0, hY - drawH * 0.22, 0, hY + drawH * 0.18);
        const hAlpha = clamp((0.18 * (1.0 - nightFactor * 0.65) + 0.08 * duskFactor) * fogScale, 0, 0.45);
        hGrad.addColorStop(0, 'rgba(255, 175, 105, 0)');
        hGrad.addColorStop(0.5, `rgba(255, 172, 98, ${hAlpha.toFixed(3)})`);
        hGrad.addColorStop(1, 'rgba(255, 175, 105, 0)');
        ctx.fillStyle = hGrad;
        ctx.fillRect(0, hY - drawH * 0.22, width, drawH * 0.40);
      }
      ctx.restore();
    }

    // 2. EAST RIVER SHIMMER & DYNAMIC SKYLINE WATER REFLECTIONS (Bridge Scene)
    if (photoLayers.water && this.data.waterPolygon) {
      ctx.save();
      ctx.beginPath();
      this.data.waterPolygon.forEach(([wx, wy], i) => {
        const [sx, sy] = toScreen(wx, wy);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.clip();

      ctx.globalCompositeOperation = 'screen';
      const shimmerIntensity = (0.28 + 0.55 * nightFactor) * exposure;
      // Draw animated horizontal water wave reflection streaks under the skyline and bridge tower
      const numWaves = 68;
      for (let i = 0; i < numWaves; i++) {
        const wy = 0.56 + (i / numWaves) * 0.42;
        const wavePhase = time * 2.2 + i * 0.75;
        const wxCenter = 0.28 + 0.26 * ((i * 0.618) % 1) + Math.sin(wavePhase) * 0.008;
        const [sx, sy] = toScreen(wxCenter, wy);
        const streakW = (18 + (wy - 0.55) * 95) * (0.7 + 0.3 * Math.sin(wavePhase * 1.3));
        const streakH = 1.4 + (wy - 0.55) * 3.5;

        const isGold = i % 3 !== 0;
        const alpha = (0.04 + 0.07 * Math.sin(wavePhase) ** 2) * shimmerIntensity;
        ctx.fillStyle = isGold
          ? `rgba(255, 196, 112, ${alpha.toFixed(3)})`
          : `rgba(150, 215, 255, ${(alpha * 0.8).toFixed(3)})`;
        ctx.fillRect(sx - streakW * 0.5, sy, streakW, streakH);
      }
      ctx.restore();
    }

    // 3. PERSPECTIVE-MAPPED BUILDING WINDOWS LAYER (Clipped to exact facade quads!)
    let activeWinCount = 0;
    if (photoLayers.windows) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Effective lit ratio increases naturally as evening deepens into night
      const effLitRatio = clamp(litRatio + nightFactor * 0.22, 0.04, 0.94);
      const winBrightness = (0.38 + 0.85 * nightFactor + 0.25 * duskFactor) * exposure;

      for (const w of this.windows) {
        if (w.threshold > effLitRatio) continue;
        activeWinCount++;

        const flicker = 0.92 + 0.08 * Math.sin(time * w.flickerFreq + w.flickerPhase);
        const alpha = clamp(w.intensity * winBrightness * flicker, 0.08, 0.96);
        const [r, g, b] = w.rgb;

        const [p0, p1, p2, p3] = w.corners;
        const [x0, y0] = toScreen(p0[0], p0[1]);
        const [x1, y1] = toScreen(p1[0], p1[1]);
        const [x2, y2] = toScreen(p2[0], p2[1]);
        const [x3, y3] = toScreen(p3[0], p3[1]);

        // Crisp perspective window pane fill (NO ugly dark rectangle halo!)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fill();

        // Subtle warm optical bloom around the brightest windows
        if (bloomScale > 0.15 && w.intensity > 0.92 && nightFactor > 0.15) {
          const [cx, cy] = toScreen(w.cx, w.cy);
          const rad = Math.max(3.5, Math.abs(x1 - x0) * 1.9) * bloomScale;
          const bAlpha = clamp(alpha * 0.24 * bloomScale, 0.02, 0.32);
          const gGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
          gGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${bAlpha.toFixed(3)})`);
          gGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = gGlow;
          ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        }
      }

      // Pulsing Red Aviation Beacons on Spire Tops
      for (const bc of this.data.beacons) {
        const [bx, by] = toScreen(bc.x, bc.y);
        const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2.8 + bc.phase));
        const rad = bc.size * (0.8 + 0.4 * pulse) * Math.max(0.7, bloomScale);
        const gBeacon = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
        gBeacon.addColorStop(0, `rgba(255, 220, 210, ${(0.95 * pulse).toFixed(3)})`);
        gBeacon.addColorStop(0.3, `rgba(255, 48, 32, ${(0.75 * pulse).toFixed(3)})`);
        gBeacon.addColorStop(1, 'rgba(255, 30, 20, 0)');
        ctx.fillStyle = gBeacon;
        ctx.beginPath();
        ctx.arc(bx, by, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 4. PERSPECTIVE-CALIBRATED HIGHWAY & AVENUE TRAFFIC LAYER
    if (photoLayers.traffic) {
      ctx.save();
      const waypoints = this.data.highwayWaypoints;
      const lanesPerSide = this.data.lanesPerSide;

      // Sort vehicles back-to-front (increasing y) so closer cars cleanly overlap distant cars
      const sorted = this.vehicles
        .map((v) => {
          const sample = sampleHighwayLane(waypoints, lanesPerSide, v.lane, v.s);
          return { v, sample };
        })
        .sort((a, b) => a.sample.y - b.sample.y);

      for (const { v, sample } of sorted) {
        const [sx, sy] = toScreen(sample.x, sample.y);
        // Screen-space tangent vector along the lane
        const tx = sample.dx * drawW;
        const ty = sample.dy * drawH;
        const tLen = Math.hypot(tx, ty) || 1;
        const ux = tx / tLen; // Unit vector pointing down-lane (toward foreground)
        const uy = ty / tLen;
        const px = -uy;       // Unit vector perpendicular across-lane
        const py = ux;

        // Perspective vehicle dimensions in pixels
        const scale = lerp(this.data.vehicleScaleFar, this.data.vehicleScaleNear, sample.depth) * (drawW / 1376);
        const carW = (v.isSuv ? 18 : 15.5) * scale;
        const carL = (v.isSuv ? 32 : 27) * scale;
        const carH = (v.isSuv ? 10.5 : 8.2) * scale;

        // 4a. Cast ground shadow under vehicle
        ctx.fillStyle = 'rgba(8, 10, 15, 0.58)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + carH * 0.18, carW * 0.65, carL * 0.44, Math.atan2(ux, uy) * -0.35, 0, Math.PI * 2);
        ctx.fill();

        // 4b. Perspective 3D Vehicle Body + Cabin Roof Silhouette
        const drawPoly = (pts, fillStyle, strokeStyle = null) => {
          ctx.beginPath();
          pts.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = fillStyle;
          ctx.fill();
          if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = Math.max(0.6, 1.1 * scale);
            ctx.stroke();
          }
        };

        // Lower chassis box oriented along lane tangent (ux, uy) and perpendicular (px, py)
        const fL = carL * 0.5;
        const hW = carW * 0.5;
        const bFL = [sx + ux * fL - px * hW, sy + uy * fL - py * hW];
        const bFR = [sx + ux * fL + px * hW, sy + uy * fL + py * hW];
        const bBR = [sx - ux * fL + px * hW, sy - uy * fL + py * hW];
        const bBL = [sx - ux * fL - px * hW, sy - uy * fL - py * hW];

        drawPoly([bFL, bFR, bBR, bBL], v.color, 'rgba(15, 20, 28, 0.65)');

        // Elevated cabin & windshield (shifted vertically by -carH)
        const cL = carL * 0.27;
        const cW = carW * 0.40;
        const cFL = [sx + ux * cL - px * cW, sy + uy * cL - py * cW - carH * 0.55];
        const cFR = [sx + ux * cL + px * cW, sy + uy * cL + py * cW - carH * 0.55];
        const cBR = [sx - ux * cL + px * cW, sy - uy * cL + py * cW - carH * 0.58];
        const cBL = [sx - ux * cL - px * cW, sy - uy * cL - py * cW - carH * 0.58];

        // Dark glass windshield/rear window polygon
        drawPoly([bFL, bFR, cFR, cFL], 'rgba(22, 34, 48, 0.88)');
        drawPoly([cFL, cFR, cBR, cBL], v.color, 'rgba(255, 255, 255, 0.18)');

        // Iconic NYC Taxi illuminated rooftop medallion sign
        if (v.isTaxi && scale > 0.28) {
          ctx.fillStyle = 'rgba(255, 250, 215, 0.92)';
          ctx.fillRect(sx - 2.4 * scale, sy - carH * 0.72, 4.8 * scale, 2.0 * scale);
        }

        // 4c. Oriented Headlight & Taillight Beams + Road Specular Glare (No flat rectangular stamps!)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const lightBoost = clamp(0.65 + 0.65 * nightFactor + 0.35 * bloomScale, 0.4, 2.2);

        if (v.incoming) {
          // Incoming vehicle: Front faces down-lane (+ux, +uy) -> Warm-white stereo headlights
          for (const side of [-0.66, 0.66]) {
            const lx = sx + ux * (fL * 0.92) + px * (hW * side);
            const ly = sy + uy * (fL * 0.92) + py * (hW * side) - carH * 0.14;

            // Forward headlight beam cone cast onto the asphalt
            const beamLen = (18 + 26 * sample.depth) * scale * (0.7 + 0.4 * nightFactor);
            const beamSpread = (4.5 + 6.5 * sample.depth) * scale;
            const tipL = [lx + ux * beamLen - px * beamSpread, ly + uy * beamLen - py * beamSpread];
            const tipR = [lx + ux * beamLen + px * beamSpread, ly + uy * beamLen + py * beamSpread];

            const bGrad = ctx.createLinearGradient(lx, ly, lx + ux * beamLen, ly + uy * beamLen);
            bGrad.addColorStop(0, `rgba(255, 244, 214, ${(0.34 * lightBoost).toFixed(3)})`);
            bGrad.addColorStop(1, 'rgba(255, 230, 175, 0)');
            drawPoly([[lx, ly], tipL, tipR], bGrad);

            // Crisp round optical headlamp core & halo
            const hRad = Math.max(2.2, 6.2 * scale * Math.max(0.8, bloomScale));
            const hGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, hRad);
            hGrad.addColorStop(0, `rgba(255, 252, 240, ${(0.96 * lightBoost).toFixed(3)})`);
            hGrad.addColorStop(0.35, `rgba(255, 224, 155, ${(0.58 * lightBoost).toFixed(3)})`);
            hGrad.addColorStop(1, 'rgba(255, 200, 110, 0)');
            ctx.fillStyle = hGrad;
            ctx.beginPath();
            ctx.arc(lx, ly, hRad, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Outgoing vehicle: Rear faces down-lane (+ux, +uy) -> Crimson LED taillights
          for (const side of [-0.66, 0.66]) {
            const lx = sx + ux * (fL * 0.88) + px * (hW * side);
            const ly = sy + uy * (fL * 0.88) + py * (hW * side) - carH * 0.18;

            // Crimson asphalt reflection streak trailing behind
            const trailLen = (10 + 16 * sample.depth) * scale;
            const tGrad = ctx.createLinearGradient(lx, ly, lx + ux * trailLen, ly + uy * trailLen);
            tGrad.addColorStop(0, `rgba(255, 38, 24, ${(0.32 * lightBoost).toFixed(3)})`);
            tGrad.addColorStop(1, 'rgba(255, 20, 12, 0)');
            ctx.strokeStyle = tGrad;
            ctx.lineWidth = Math.max(1.5, 3.2 * scale);
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + ux * trailLen, ly + uy * trailLen);
            ctx.stroke();

            // Crisp crimson taillight halo
            const tRad = Math.max(2.0, 5.6 * scale * Math.max(0.8, bloomScale));
            const rGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, tRad);
            rGrad.addColorStop(0, `rgba(255, 190, 175, ${(0.95 * lightBoost).toFixed(3)})`);
            rGrad.addColorStop(0.32, `rgba(255, 36, 22, ${(0.72 * lightBoost).toFixed(3)})`);
            rGrad.addColorStop(1, 'rgba(255, 18, 10, 0)');
            ctx.fillStyle = rGrad;
            ctx.beginPath();
            ctx.arc(lx, ly, tRad, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Secondary subtle glowing traffic across the Brooklyn Bridge span
      if (this.data.bridgeDeckTraffic) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const { start, mid, end } = this.data.bridgeDeckTraffic;
        for (const bv of this.bridgeVehicles) {
          const t = bv.t;
          const bx = t < 0.5 ? lerp(start[0], mid[0], t * 2) : lerp(mid[0], end[0], (t - 0.5) * 2);
          const by = t < 0.5 ? lerp(start[1], mid[1], t * 2) : lerp(mid[1], end[1], (t - 0.5) * 2);
          const [sx, sy] = toScreen(bx, by);
          const col = bv.dir > 0 ? 'rgba(255, 232, 175, 0.72)' : 'rgba(255, 58, 38, 0.68)';
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();
    }

    // 5. SKY LIFE LAYER (Soaring East River Seagulls & Distant Blinking Aircraft)
    if (photoLayers.skyLife) {
      ctx.save();
      const birdCol = nightFactor > 0.6 ? 'rgba(180, 195, 215, 0.45)' : 'rgba(38, 46, 58, 0.62)';
      ctx.strokeStyle = birdCol;
      ctx.lineWidth = 1.35;
      for (const b of this.birds) {
        const [bx, by] = toScreen(b.x, b.y, 0.35);
        const flap = Math.sin(time * 5.2 + b.wingPhase) * b.size * 0.55;
        ctx.beginPath();
        ctx.moveTo(bx - b.size, by - flap);
        ctx.quadraticCurveTo(bx - b.size * 0.4, by - b.size * 0.35, bx, by);
        ctx.quadraticCurveTo(bx + b.size * 0.4, by - b.size * 0.35, bx + b.size, by - flap);
        ctx.stroke();
      }

      // Distant aircraft with strobe navigation lights
      const [px, py] = toScreen(this.plane.x, this.plane.y, 0.2);
      const strobe = Math.sin(time * 7.5) > 0.35 ? 1.0 : 0.2;
      ctx.fillStyle = `rgba(255, 245, 220, ${(0.85 * strobe).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 48, 36, 0.82)';
      ctx.beginPath();
      ctx.arc(px - 4.5, py + 0.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. PHOTO+ DECONSTRUCTION DEBUG INSPECTOR OVERLAY
    // Shows the exact perspective building facade quads, exclusion masks, and highway lane splines
    if (photoLayers.debug) {
      ctx.save();

      // Draw building facade quads
      for (const b of this.data.buildings) {
        const pts = b.quad.map(([qx, qy]) => toScreen(qx, qy));
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 196, 46, 0.14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 215, 40, 0.92)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Building label pill
        const [lx, ly] = pts[0];
        ctx.fillStyle = 'rgba(10, 15, 24, 0.82)';
        ctx.fillRect(lx, ly - 15, Math.min(130, b.name.length * 6.2), 14);
        ctx.fillStyle = '#ffd84d';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(b.name.slice(0, 20), lx + 4, ly - 4);
      }

      // Draw exclusion masks (e.g., Brooklyn Bridge deck occlusion)
      for (const ex of this.data.exclusionPolygons || []) {
        const pts = ex.map(([qx, qy]) => toScreen(qx, qy));
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 48, 90, 0.22)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 70, 110, 0.95)';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw perspective highway/avenue lane splines
      const totalLanes = this.data.lanesPerSide * 2;
      for (let lane = 0; lane < totalLanes; lane++) {
        const incoming = lane < this.data.lanesPerSide;
        ctx.beginPath();
        for (let step = 0; step <= 24; step++) {
          const sample = sampleHighwayLane(this.data.highwayWaypoints, this.data.lanesPerSide, lane, step / 24);
          const [sx, sy] = toScreen(sample.x, sample.y);
          if (step === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = incoming ? 'rgba(0, 240, 255, 0.92)' : 'rgba(255, 75, 75, 0.92)';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
    return {
      activeWindows: activeWinCount,
      totalWindows: this.windows.length,
      vehicles: this.vehicles.length + this.bridgeVehicles.length,
      buildings: this.data.buildings.length
    };
  }
}
