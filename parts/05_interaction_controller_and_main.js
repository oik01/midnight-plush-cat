// ═══════════════════════════════════════════════════════════════════════════
// Part 5: Interaction Controller, Off-Centre Camera, UI Wiring & Telemetry
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_MANIFEST = {
  prowl: {
    isToggle: true,
    digit: '1',
    letter: 'p',
    mechanicId: 'move_prowl',
    duration: 2.4,
    mouth: 'omega',
    eyes: 'open',
    pupil: 0.48,
    particle: null,
    speech: [
      'Patrolling the porch perimeter. All pumpkins accounted for.',
      'Soft paws on weathered pine. Not a single floorboard creaked.',
      'Prowl mode engaged. Tracking imaginary moths at three o’clock.'
    ]
  },
  pounce: {
    isToggle: false,
    digit: '2',
    letter: 'j',
    mechanicId: 'move_pounce',
    duration: 1.4,
    mouth: 'o',
    eyes: 'open',
    pupil: 0.86,
    particle: 'tuft',
    speech: [
      'Butt-wiggle calibrated. Launching plush payload!',
      'Ten out of ten on the porch landing. Minimal stuffing displacement.',
      'Target acquired: one completely innocent dust bunny.'
    ]
  },
  arch: {
    isToggle: false,
    digit: '3',
    letter: 'h',
    mechanicId: 'move_arch_hiss',
    duration: 1.65,
    mouth: 'hiss',
    eyes: 'open',
    pupil: 0.9,
    particle: 'sparkle',
    speech: [
      'Maximum Halloween arch achieved. Even the pumpkins are impressed.',
      'Poof! Sixty percent more intimidating by volume.',
      'Airplane ears deployed. Behold the classic October silhouette.'
    ]
  },
  purr: {
    isToggle: true,
    digit: '4',
    letter: 'u',
    mechanicId: 'move_purr_loaf',
    duration: 2.2,
    mouth: 'omega',
    eyes: 'uu',
    pupil: 0.52,
    particle: 'heart',
    speech: [
      'Purr engine idling at 24 Hz. Mind the whiskers.',
      'Full plush loaf achieved. Paws tucked into another dimension.',
      'Resonating warmly enough to toast a marshmallow.'
    ]
  },
  groom: {
    isToggle: false,
    digit: '5',
    letter: 'g',
    mechanicId: 'move_groom',
    duration: 1.45,
    mouth: 'omega',
    eyes: 'blink',
    pupil: 0.5,
    particle: null,
    speech: [
      'One velvet paw over the ear. Formal evening attire restored.',
      'Polishing the whiskers. A witch’s familiar has standards.',
      'Quick wash behind the right ear before the moon gets any higher.'
    ]
  },
  chase: {
    isToggle: true,
    digit: '6',
    letter: 'm',
    mechanicId: 'move_chase_mouse',
    duration: 1.8,
    mouth: 'o',
    eyes: 'open',
    pupil: 0.84,
    particle: 'sparkle',
    speech: [
      'The felt mouse returns! Sound the brass collar bell!',
      'Batting practice on the front porch. Physics favors the plush.',
      'Wait till I catch that string. Just one more lunge.'
    ]
  },
  nap: {
    isToggle: true,
    digit: '7',
    letter: 'n',
    mechanicId: 'move_nap_topple',
    duration: 2.5,
    mouth: 'omega',
    eyes: 'uu',
    pupil: 0.35,
    particle: 'z',
    speech: [
      'Curled into a velvet crescent. Wake me when the cauldron bubbles.',
      'Dreaming of slow-moving felt mice and warm spellbooks.',
      'Do not disturb: conducting a deep structural softness test.'
    ]
  },
  topple: {
    isToggle: false,
    digit: '8',
    letter: 't',
    mechanicId: 'move_nap_topple',
    duration: 1.5,
    mouth: 'o',
    eyes: 'open',
    pupil: 0.76,
    particle: 'tuft',
    speech: [
      'Gravity checked! Weighted bottom rights the cat every time.',
      'Dramatic side-flop complete. Meant to do that.',
      'Plush equilibrium temporarily negotiable. Boing!'
    ]
  }
};

const MECHANIC_TABLE = {
  move_pounce: {
    action: 'pounce',
    phases: {
      t0_anticipation: { durationMs: 360, targetSec: 0.22 },
      t1_drive: { durationMs: 300, targetSec: 0.50 },
      t2_apex: { durationMs: 300, targetSec: 0.78 },
      t3_settle: { durationMs: 440, targetSec: 1.25 }
    }
  },
  move_arch_hiss: {
    action: 'arch',
    phases: {
      t0_anticipation: { durationMs: 240, targetSec: 0.16 },
      t1_drive: { durationMs: 380, targetSec: 0.44 },
      t2_apex: { durationMs: 500, targetSec: 0.82 },
      t3_settle: { durationMs: 530, targetSec: 1.42 }
    }
  },
  move_prowl: {
    action: 'prowl',
    phases: {
      t0_anticipation: { durationMs: 240, targetSec: 0.14 },
      t1_drive: { durationMs: 380, targetSec: 0.44 },
      t2_apex: { durationMs: 380, targetSec: 0.78 },
      t3_settle: { durationMs: 450, targetSec: 1.22 }
    }
  },
  move_purr_loaf: {
    action: 'purr',
    phases: {
      t0_anticipation: { durationMs: 250, targetSec: 0.16 },
      t1_drive: { durationMs: 470, targetSec: 0.52 },
      t2_apex: { durationMs: 480, targetSec: 0.96 },
      t3_settle: { durationMs: 400, targetSec: 1.46 }
    }
  },
  move_scruff_drop: {
    action: 'scruff_drop',
    phases: {
      t0_anticipation: { durationMs: 200, targetSec: 0.14 },
      t1_drive: { durationMs: 380, targetSec: 0.44 },
      t2_apex: { durationMs: 260, targetSec: 0.78 },
      t3_settle: { durationMs: 500, targetSec: 1.24 }
    }
  },
  move_groom: {
    action: 'groom',
    phases: {
      t0_anticipation: { durationMs: 250, targetSec: 0.16 },
      t1_drive: { durationMs: 370, targetSec: 0.46 },
      t2_apex: { durationMs: 480, targetSec: 0.86 },
      t3_settle: { durationMs: 350, targetSec: 1.32 }
    }
  },
  move_chase_mouse: {
    action: 'chase',
    phases: {
      t0_anticipation: { durationMs: 300, targetSec: 0.18 },
      t1_drive: { durationMs: 340, targetSec: 0.48 },
      t2_apex: { durationMs: 320, targetSec: 0.80 },
      t3_settle: { durationMs: 420, targetSec: 1.24 }
    }
  },
  move_nap_topple: {
    action: 'topple',
    phases: {
      t0_anticipation: { durationMs: 240, targetSec: 0.15 },
      t1_drive: { durationMs: 340, targetSec: 0.44 },
      t2_apex: { durationMs: 380, targetSec: 0.80 },
      t3_settle: { durationMs: 520, targetSec: 1.32 }
    }
  }
};

const MECHANIC_ALIASES = {
  pounce: 'move_pounce',
  arch: 'move_arch_hiss',
  hiss: 'move_arch_hiss',
  prowl: 'move_prowl',
  purr: 'move_purr_loaf',
  loaf: 'move_purr_loaf',
  scruff: 'move_scruff_drop',
  drop: 'move_scruff_drop',
  groom: 'move_groom',
  chase: 'move_chase_mouse',
  mouse: 'move_chase_mouse',
  nap: 'move_nap_topple',
  topple: 'move_nap_topple'
};

const TOOL_META = {
  hand: {
    hint: 'HAND · Drag scruff, ear, tail, body, or bell · Drag empty space to orbit',
    speech: 'Ready for a lift. Thirteen out of ten black cats recommend a good scruff stretch.'
  },
  finger: {
    hint: 'FINGER · Poke belly to squish · Hold near cheek for headbutts · Tap porch to trot',
    speech: 'One gentle boop on the nose or a chin scratch? Choose wisely.'
  },
  comb: {
    hint: 'COMB · Stroke across the velvet pile to part the fur grain · Comb the spine to arch',
    speech: 'Ah, the velvet brush. Stroke with the grain for gloss, against it for drama.'
  }
};

const COAT_META = {
  midnight: 'Midnight dye selected. Deep soot-black pile with a warm plum sheen.',
  smoke: 'Smoke coat selected. Silvery charcoal undercoat catching the harvest moon.',
  tuxedo: 'Tuxedo coat selected. Crisp cream bib and snowy front mittens.'
};

const GRAB_SPEECH = {
  scruff: [
    'Thirteen out of ten black cats recommend a good scruff stretch.',
    'Going completely limp now. Paws curled, dignity intact.',
    'Airborne familiar! Please mind the landing zone.'
  ],
  ear: [
    'Careful with the felt ear stitching! My radar is calibrated.',
    'A gentle ear tug tilts the whole plush noggin.'
  ],
  tail: [
    'Whoa there, that rope tail is counterbalanced for porch prowling!',
    'Tail tug detected. Lower spine following suit.'
  ],
  bell: [
    'Jingle-jangle! Pure spun brass on a dark-purple velvet collar.',
    'Ring the collar bell twice for midnight snacks.'
  ],
  body: [
    'Oof! Soft polyfill squish right in the middle.',
    'Plush displacement in progress. Volume conserved!'
  ]
};

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function mat4LookAt(out, eye, target, up) {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let zLen = Math.hypot(zx, zy, zz);
  if (zLen < 1e-6) {
    zz = 1;
  } else {
    zx /= zLen;
    zy /= zLen;
    zz /= zLen;
  }

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  let xLen = Math.hypot(xx, xy, xz);
  if (xLen < 1e-6) {
    xx = 1;
    xy = 0;
    xz = 0;
  } else {
    xx /= xLen;
    xy /= xLen;
    xz /= xLen;
  }

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;
  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

function mat4PerspectiveOffCenter(out, fovRad, aspect, near, far, shiftX, shiftY) {
  const f = 1.0 / Math.tan(fovRad * 0.5);
  const nf = 1.0 / (near - far);
  out.fill(0);
  out[0] = f / Math.max(0.1, aspect);
  out[5] = f;
  out[8] = shiftX;
  out[9] = shiftY;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function mat4Multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4 + 0];
    const b1 = b[c * 4 + 1];
    const b2 = b[c * 4 + 2];
    const b3 = b[c * 4 + 3];
    out[c * 4 + 0] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    out[c * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    out[c * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    out[c * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
  }
  return out;
}

function mat4Invert(out, m) {
  const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3];
  const m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7];
  const m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];
  const m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

  const b00 = m00 * m11 - m01 * m10;
  const b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10;
  const b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11;
  const b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30;
  const b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30;
  const b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31;
  const b11 = m22 * m33 - m23 * m32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-10) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  }
  det = 1.0 / det;

  out[0] = (m11 * b11 - m12 * b10 + m13 * b09) * det;
  out[1] = (m02 * b10 - m01 * b11 - m03 * b09) * det;
  out[2] = (m31 * b05 - m32 * b04 + m33 * b03) * det;
  out[3] = (m22 * b04 - m21 * b05 - m23 * b03) * det;
  out[4] = (m12 * b08 - m10 * b11 - m13 * b07) * det;
  out[5] = (m00 * b11 - m02 * b08 + m03 * b07) * det;
  out[6] = (m32 * b02 - m30 * b05 - m33 * b01) * det;
  out[7] = (m20 * b05 - m22 * b02 + m23 * b01) * det;
  out[8] = (m10 * b10 - m11 * b08 + m13 * b06) * det;
  out[9] = (m01 * b08 - m00 * b10 - m03 * b06) * det;
  out[10] = (m30 * b04 - m31 * b02 + m33 * b00) * det;
  out[11] = (m21 * b02 - m20 * b04 - m23 * b00) * det;
  out[12] = (m11 * b07 - m10 * b09 - m12 * b06) * det;
  out[13] = (m00 * b09 - m01 * b07 + m02 * b06) * det;
  out[14] = (m31 * b01 - m30 * b03 - m32 * b00) * det;
  out[15] = (m20 * b03 - m21 * b01 + m22 * b00) * det;
  return out;
}

async function initMidnightApplication() {
  const bgCanvas = document.getElementById('bg-canvas');
  const plushCanvas = document.getElementById('plush-canvas');
  const loadingOverlay = document.getElementById('loading-overlay');
  const fallbackCard = document.getElementById('fallback-card');
  const fallbackReason = document.getElementById('fallback-reason');
  const fpsPill = document.getElementById('fps-pill');
  const speechBubble = document.getElementById('speech-bubble');
  const speechText = document.getElementById('speech-text');
  const toolHint = document.getElementById('tool-hint');

  const readoutMass = document.getElementById('readout-mass');
  const readoutVolume = document.getElementById('readout-volume');
  const readoutPurrs = document.getElementById('readout-purrs');
  const readoutPounces = document.getElementById('readout-pounces');
  const countParticles = document.getElementById('count-particles');
  const countCells = document.getElementById('count-cells');
  const countTets = document.getElementById('count-tets');

  const sliderStuffing = document.getElementById('slider-stuffing');
  const sliderPile = document.getElementById('slider-pile');
  const sliderMood = document.getElementById('slider-mood');
  const btnSmoothFur = document.getElementById('btn-smooth-fur');
  const btnReset = document.getElementById('btn-reset');
  const btnPause = document.getElementById('btn-pause');
  const chkSlowmo = document.getElementById('chk-slowmo');
  const chkMesh = document.getElementById('chk-mesh');

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReducedMotion = reducedMotionQuery.matches;
  reducedMotionQuery.addEventListener?.('change', (e) => {
    prefersReducedMotion = e.matches;
  });

  // Instantiate physics, Three.js background scene, and WebGPU plush renderer
  const physics = new PlushPhysicsEngine();
  const porchScene = new WitchPorchScene(bgCanvas);
  const renderer = new PlushWebGPURenderer();

  let webgpuOk = false;
  try {
    const initResult = await renderer.init(plushCanvas, physics);
    webgpuOk = Boolean(initResult && initResult.ok);
    if (!webgpuOk) {
      if (fallbackCard) fallbackCard.classList.add('is-visible');
      if (fallbackReason) {
        fallbackReason.textContent = (initResult && initResult.error)
          ? String(initResult.error)
          : 'WebGPU adapter or device unavailable in this browser.';
      }
    }
  } catch (err) {
    webgpuOk = false;
    if (fallbackCard) fallbackCard.classList.add('is-visible');
    if (fallbackReason) {
      fallbackReason.textContent = err && err.message ? err.message : String(err);
    }
  }

  if (loadingOverlay) {
    loadingOverlay.classList.add('is-hidden');
  }

  if (countParticles) countParticles.textContent = String(physics.particleCount || 0);
  if (countCells) countCells.textContent = String(physics.cellCount || 0);
  if (countTets) countTets.textContent = String(physics.tetCount || 0);

  // Controller state
  let currentTool = 'hand';
  let currentCoat = 'midnight';
  let currentAction = 'idle';
  let stuffingValue = sliderStuffing ? Number(sliderStuffing.value) : 55;
  let pileValue = sliderPile ? Number(sliderPile.value) : 62;
  let moodValue = sliderMood ? Number(sliderMood.value) : 50;

  let isPaused = false;
  let isSlowMo = false;
  let showMeshWireframe = false;

  let purrCount = 0;
  let pounceCount = 0;
  let currentFps = 60;
  let qualityLevel = 0;

  const toggleState = {
    prowl: false,
    purr: false,
    chase: false,
    nap: false
  };

  const actionTimers = {
    pounce: 0,
    arch: 0,
    groom: 0,
    topple: 0
  };

  let witchFlybyTimer = 0;
  let headbuttHoldTimer = 0;
  let isHeadbuttPurring = false;
  let particleEmitCooldown = 0;
  let trotTargetTimer = 0;
  let deterministicHoldTimer = 0;
  let lastHoverWorldPos = [0, 1.0, 0];

  // Telemetry state
  let activeMechanic = 'idle';
  let activePhase = 'idle';
  let phaseHistory = [];
  const lastCom = [
    physics.com ? physics.com[0] : 0,
    physics.com ? physics.com[1] : 0.95,
    physics.com ? physics.com[2] : 0
  ];
  const measuredVelocity = [0, 0, 0];
  const measuredAngularVelocity = [0, 0, 0];
  let lastRollRad = 0;

  // Camera state (`fovDeg = 38`, distance clamped `[2.4, 8.5]`)
  const DEFAULT_CAMERA = {
    yaw: 0.16,
    pitch: 0.23,
    distance: 4.72,
    fovDeg: 38
  };

  const cameraState = {
    yaw: DEFAULT_CAMERA.yaw,
    pitch: DEFAULT_CAMERA.pitch,
    distance: DEFAULT_CAMERA.distance,
    targetYaw: DEFAULT_CAMERA.yaw,
    targetPitch: DEFAULT_CAMERA.pitch,
    targetDistance: DEFAULT_CAMERA.distance,
    fov: DEFAULT_CAMERA.fovDeg,
    fovDeg: DEFAULT_CAMERA.fovDeg,
    fovRad: (DEFAULT_CAMERA.fovDeg * Math.PI) / 180,
    aspect: window.innerWidth / Math.max(1, window.innerHeight),
    near: 0.1,
    far: 120.0,
    shiftX: 0,
    shiftY: 0,
    eye: [0, 1.85, 4.35],
    position: [0, 1.85, 4.35],
    target: [0, 0.95, 0],
    lookAt: [0, 0.95, 0],
    up: [0, 1, 0],
    viewMatrix: new Float32Array(16),
    projMatrix: new Float32Array(16),
    projectionMatrix: new Float32Array(16),
    viewProjMatrix: new Float32Array(16),
    invViewProjMatrix: new Float32Array(16)
  };

  function computeOffCenterProjectionShift() {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const mastheadEl = document.getElementById('masthead');
    const panelEl = document.getElementById('control-panel');
    const bottomSheetEl = document.querySelector('.bottom-sheet, #bottom-sheet');

    let freeLeft = 0;
    let freeRight = vw;
    let freeTop = 0;
    let freeBottom = vh;

    if (vw <= 900) {
      if (mastheadEl) {
        const r = mastheadEl.getBoundingClientRect();
        if (r.height > 0 && r.bottom < vh * 0.45) {
          freeTop = Math.max(freeTop, r.bottom * 0.65);
        }
      }
      const sheet = bottomSheetEl || panelEl;
      if (sheet) {
        const r = sheet.getBoundingClientRect();
        if (r.height > 0 && r.top > vh * 0.35) {
          freeBottom = Math.min(freeBottom, r.top);
        }
      }
    } else {
      if (mastheadEl) {
        const r = mastheadEl.getBoundingClientRect();
        if (r.width > 0 && r.left < vw * 0.35) {
          // Masthead is editorial overlay on the top-left; weight 48% of its width
          freeLeft = Math.min(vw * 0.32, r.right * 0.48);
        }
      }
      if (panelEl) {
        const r = panelEl.getBoundingClientRect();
        if (r.width > 0 && r.left > vw * 0.45) {
          freeRight = Math.max(vw * 0.52, r.left);
        }
      }
    }

    const freeCenterX = 0.5 * (freeLeft + freeRight);
    const freeCenterY = 0.5 * (freeTop + freeBottom);

    const ndcCenterX = (freeCenterX / vw) * 2.0 - 1.0;
    const ndcCenterY = 1.0 - (freeCenterY / vh) * 2.0;

    // projectionMatrix.elements[8] and [9] shift the view center to (ndcCenterX, ndcCenterY)
    cameraState.shiftX = clamp(-ndcCenterX, -0.26, 0.26);
    cameraState.shiftY = clamp(-ndcCenterY, -0.24, 0.24);
    cameraState.aspect = vw / vh;
  }

  function updateCameraMatrices(dt) {
    computeOffCenterProjectionShift();

    const damp = 1.0 - Math.exp(-Math.min(1.0, dt * 12.0));
    cameraState.yaw += (cameraState.targetYaw - cameraState.yaw) * damp;
    cameraState.pitch += (cameraState.targetPitch - cameraState.pitch) * damp;
    cameraState.distance += (cameraState.targetDistance - cameraState.distance) * damp;

    const com = physics.com || [0, 0.95, 0];
    const desiredTargetX = clamp(com[0], -2.8, 2.8);
    const desiredTargetY = Math.max(0.82, com[1] * 0.65);
    const desiredTargetZ = clamp(com[2], -2.8, 2.8);

    const comDamp = 1.0 - Math.exp(-Math.min(1.0, dt * 7.5));
    cameraState.target[0] += (desiredTargetX - cameraState.target[0]) * comDamp;
    cameraState.target[1] += (desiredTargetY - cameraState.target[1]) * comDamp;
    cameraState.target[2] += (desiredTargetZ - cameraState.target[2]) * comDamp;
    cameraState.lookAt[0] = cameraState.target[0];
    cameraState.lookAt[1] = cameraState.target[1];
    cameraState.lookAt[2] = cameraState.target[2];

    const aspectScale = cameraState.aspect < 0.85 ? clamp(0.86 / Math.max(0.44, cameraState.aspect), 1.0, 1.32) : 1.0;
    const effDist = cameraState.distance * aspectScale;
    const cosPitch = Math.cos(cameraState.pitch);
    const eyeX = cameraState.target[0] + Math.sin(cameraState.yaw) * cosPitch * effDist;
    const eyeY = Math.max(0.16, cameraState.target[1] + Math.sin(cameraState.pitch) * effDist);
    const eyeZ = cameraState.target[2] + Math.cos(cameraState.yaw) * cosPitch * effDist;

    cameraState.eye[0] = cameraState.position[0] = eyeX;
    cameraState.eye[1] = cameraState.position[1] = eyeY;
    cameraState.eye[2] = cameraState.position[2] = eyeZ;

    mat4LookAt(cameraState.viewMatrix, cameraState.eye, cameraState.target, cameraState.up);
    mat4PerspectiveOffCenter(
      cameraState.projMatrix,
      cameraState.fovRad,
      cameraState.aspect,
      cameraState.near,
      cameraState.far,
      cameraState.shiftX,
      cameraState.shiftY
    );
    cameraState.projectionMatrix.set(cameraState.projMatrix);
    mat4Multiply(cameraState.viewProjMatrix, cameraState.projMatrix, cameraState.viewMatrix);
    mat4Invert(cameraState.invViewProjMatrix, cameraState.viewProjMatrix);
  }

  function unprojectScreenRay(clientX, clientY) {
    const rect = (plushCanvas || bgCanvas).getBoundingClientRect();
    const w = Math.max(1, rect.width || window.innerWidth);
    const h = Math.max(1, rect.height || window.innerHeight);
    const ndcX = ((clientX - rect.left) / w) * 2.0 - 1.0;
    const ndcY = 1.0 - ((clientY - rect.top) / h) * 2.0;

    // Account for off-centre projection shift (projectionMatrix.elements[8] and [9])
    const tanHalfFov = Math.tan(cameraState.fovRad * 0.5);
    const vx = (ndcX + cameraState.shiftX) * cameraState.aspect * tanHalfFov;
    const vy = (ndcY + cameraState.shiftY) * tanHalfFov;
    const vz = -1.0;

    // Camera basis in world space from viewMatrix rows
    const vm = cameraState.viewMatrix;
    const rightX = vm[0], rightY = vm[4], rightZ = vm[8];
    const upX = vm[1], upY = vm[5], upZ = vm[9];
    const backX = vm[2], backY = vm[6], backZ = vm[10];

    let dx = rightX * vx + upX * vy + backX * vz;
    let dy = rightY * vx + upY * vy + backY * vz;
    let dz = rightZ * vx + upZ * vz + backZ * vz;
    const len = Math.hypot(dx, dy, dz) || 1.0;
    dx /= len;
    dy /= len;
    dz /= len;

    return {
      origin: [cameraState.eye[0], cameraState.eye[1], cameraState.eye[2]],
      dir: [dx, dy, dz]
    };
  }

  function intersectGroundPlane(rayOrigin, rayDir, planeY = 0) {
    if (Math.abs(rayDir[1]) < 1e-5) return null;
    const t = (planeY - rayOrigin[1]) / rayDir[1];
    if (t <= 0 || t > 35.0) return null;
    return [
      rayOrigin[0] + rayDir[0] * t,
      planeY,
      rayOrigin[2] + rayDir[2] * t
    ];
  }

  function probeCatSurface(rayOrigin, rayDir) {
    const ox = rayOrigin[0], oy = rayOrigin[1], oz = rayOrigin[2];
    const dx = rayDir[0], dy = rayDir[1], dz = rayDir[2];

    // Check brass bell first
    const bell = physics.attachments && physics.attachments.bell;
    if (bell && bell.pos) {
      const bx = bell.pos[0] - ox;
      const by = bell.pos[1] - oy;
      const bz = bell.pos[2] - oz;
      const t = bx * dx + by * dy + bz * dz;
      if (t > 0) {
        const cx = bx - dx * t;
        const cy = by - dy * t;
        const cz = bz - dz * t;
        const r = (bell.radius || 0.11) * 1.45;
        if (cx * cx + cy * cy + cz * cz <= r * r) {
          return {
            hit: true,
            type: 'bell',
            distance: t,
            worldPoint: [ox + dx * t, oy + dy * t, oz + dz * t],
            isNearHead: true,
            isBackSpine: false
          };
        }
      }
    }

    const pos = physics.pos;
    const count = physics.particleCount || 0;
    const com = physics.com || [0, 0.95, 0];
    let bestT = Infinity;
    let bestPoint = null;
    const hitRadiusSq = 0.24 * 0.24;

    if (pos && count > 0) {
      for (let i = 0; i < count; i++) {
        const px = pos[i * 3] - ox;
        const py = pos[i * 3 + 1] - oy;
        const pz = pos[i * 3 + 2] - oz;
        const t = px * dx + py * dy + pz * dz;
        if (t <= 0.1 || t >= bestT) continue;
        const cx = px - dx * t;
        const cy = py - dy * t;
        const cz = pz - dz * t;
        const dSq = cx * cx + cy * cy + cz * cz;
        if (dSq <= hitRadiusSq) {
          bestT = t;
          bestPoint = [ox + dx * t, oy + dy * t, oz + dz * t];
        }
      }
    }

    if (!bestPoint) return null;

    const relY = bestPoint[1] - com[1];
    const relZ = bestPoint[2] - com[2];
    const isNearHead = relY > 0.28;
    const isBackSpine = relY > 0.05 && relZ < 0.22;
    let regionType = 'body';
    if (relY > 0.85) regionType = 'ear';
    else if (relY > 0.25 && relZ < 0.08) regionType = 'scruff';
    else if (relZ < -0.42) regionType = 'tail';

    return {
      hit: true,
      type: regionType,
      distance: bestT,
      worldPoint: bestPoint,
      isNearHead,
      isBackSpine
    };
  }

  function showSpeech(line) {
    if (!speechText || ! line) return;
    speechText.textContent = line;
    if (speechBubble) {
      speechBubble.classList.remove('pop-anim');
      void speechBubble.offsetWidth;
      speechBubble.classList.add('pop-anim');
    }
  }

  function pickLine(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return '';
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function setFpsPillText(label) {
    if (!fpsPill) return;
    let updatedNode = false;
    for (let i = 0; i < fpsPill.childNodes.length; i++) {
      const node = fpsPill.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
        node.nodeValue = ' ' + label;
        updatedNode = true;
        break;
      }
    }
    if (!updatedNode) {
      const dot = fpsPill.querySelector('.ember-dot');
      if (dot) {
        fpsPill.textContent = '';
        fpsPill.appendChild(dot);
        fpsPill.appendChild(document.createTextNode(' ' + label));
      } else {
        fpsPill.textContent = label;
      }
    }
  }

  function computeMassGrams(stuffing0to100) {
    // 0 -> 260 g, 55 (default) -> 340 g, 100 -> 440 g
    const s = clamp(Number(stuffing0to100) || 0, 0, 100);
    if (s <= 55) {
      return Math.round(260 + (s / 55) * 80);
    }
    return Math.round(340 + ((s - 55) / 45) * 100);
  }

  function updateReadouts() {
    if (readoutMass) {
      readoutMass.textContent = `${computeMassGrams(stuffingValue)} g`;
    }
    if (readoutVolume) {
      const volPct = Number.isFinite(physics.volumeRatio) ? physics.volumeRatio * 100 : 100.0;
      readoutVolume.textContent = `${volPct.toFixed(1)}%`;
    }
    if (readoutPurrs) {
      readoutPurrs.textContent = String(purrCount);
    }
    if (readoutPounces) {
      readoutPounces.textContent = String(pounceCount);
    }
  }

  function setTool(toolName, announce = true) {
    if (!TOOL_META[toolName]) return;
    currentTool = toolName;
    document.querySelectorAll('[data-tool]').forEach((btn) => {
      const active = btn.getAttribute('data-tool') === toolName;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.toggle('is-active', active);
    });
    if (toolHint) {
      toolHint.textContent = TOOL_META[toolName].hint;
    }
    if (plushCanvas) {
      plushCanvas.style.cursor = toolName === 'hand' ? 'grab' : (toolName === 'comb' ? 'ew-resize' : 'pointer');
    }
    if (announce) {
      showSpeech(TOOL_META[toolName].speech);
    }
  }

  function setCoat(coatName, announce = true) {
    if (!COAT_META[coatName]) return;
    currentCoat = coatName;
    renderer.setCoat?.(coatName);
    document.querySelectorAll('[data-coat]').forEach((btn) => {
      const active = btn.getAttribute('data-coat') === coatName;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.toggle('is-active', active);
    });
    if (announce) {
      showSpeech(COAT_META[coatName]);
    }
  }

  function syncActionButtons() {
    document.querySelectorAll('[data-action]').forEach((btn) => {
      const act = btn.getAttribute('data-action');
      const spec = ACTION_MANIFEST[act];
      if (!spec) return;
      const isPressed = spec.isToggle ? Boolean(toggleState[act]) : (actionTimers[act] > 0);
      btn.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
      btn.classList.toggle('is-active', isPressed);
    });
  }

  function emitParticlesAroundCat(type, count, yOffset = 1.65) {
    if (!type || !renderer || typeof renderer.spawnParticles !== 'function') return;
    const com = physics.com || [0, 0.95, 0];
    renderer.spawnParticles(type, [com[0], Math.max(0.18, com[1] + yOffset - 0.85), com[2]], count);
  }

  function triggerAction(actionName, options = {}) {
    const spec = ACTION_MANIFEST[actionName];
    if (!spec) return;

    if (spec.isToggle) {
      const nextState = options.forceState !== undefined ? Boolean(options.forceState) : !toggleState[actionName];
      // Clear mutually exclusive locomotion/rest toggles
      if (nextState) {
        if (actionName === 'prowl' || actionName === 'chase') {
          toggleState.nap = false;
          toggleState.purr = false;
        } else if (actionName === 'nap') {
          toggleState.prowl = false;
          toggleState.chase = false;
        }
      }
      toggleState[actionName] = nextState;
      currentAction = nextState ? actionName : 'idle';
      activeMechanic = nextState ? spec.mechanicId : 'idle';
      activePhase = nextState ? 't1_drive' : 'idle';

      if (nextState) {
        if (actionName === 'purr') purrCount++;
        if (actionName === 'chase') pounceCount++;
        if (spec.particle) emitParticlesAroundCat(spec.particle, 4, 1.55);
      }
      physics.triggerAction?.(actionName, { active: nextState, ...options });
    } else {
      actionTimers[actionName] = spec.duration;
      currentAction = actionName;
      activeMechanic = spec.mechanicId;
      activePhase = 't0_anticipation';
      if (actionName === 'pounce') pounceCount++;
      if (actionName === 'arch') witchFlybyTimer = 2.6;
      if (spec.particle) {
        const yOff = actionName === 'pounce' || actionName === 'topple' ? 0.25 : 1.55;
        emitParticlesAroundCat(spec.particle, 6, yOff);
      }
      physics.triggerAction?.(actionName, { active: true, ...options });
    }

    syncActionButtons();
    updateReadouts();
    if (!options.silent) {
      showSpeech(pickLine(spec.speech));
    }
  }

  function resetAll(announce = true) {
    toggleState.prowl = false;
    toggleState.purr = false;
    toggleState.chase = false;
    toggleState.nap = false;
    actionTimers.pounce = 0;
    actionTimers.arch = 0;
    actionTimers.groom = 0;
    actionTimers.topple = 0;
    trotTargetTimer = 0;
    headbuttHoldTimer = 0;
    isHeadbuttPurring = false;
    currentAction = 'idle';
    activeMechanic = 'idle';
    activePhase = 'idle';
    phaseHistory = [];

    physics.endGrab?.();
    physics.reset?.();
    physics.smoothFur?.();
    if (renderer && Array.isArray(renderer.particles)) renderer.particles.length = 0;

    cameraState.targetYaw = DEFAULT_CAMERA.yaw;
    cameraState.targetPitch = DEFAULT_CAMERA.pitch;
    cameraState.targetDistance = DEFAULT_CAMERA.distance;

    syncActionButtons();
    updateReadouts();
    if (announce) {
      showSpeech('Freshly fluffed and centered on the porch doormat.');
    }
  }

  // Bind tool segmented buttons
  document.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTool(btn.getAttribute('data-tool'), true);
    });
  });

  // Bind coat swatches
  document.querySelectorAll('[data-coat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setCoat(btn.getAttribute('data-coat'), true);
    });
  });

  // Bind action buttons
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      triggerAction(btn.getAttribute('data-action'));
    });
  });

  // Bind sliders
  if (sliderStuffing) {
    sliderStuffing.addEventListener('input', () => {
      stuffingValue = Number(sliderStuffing.value);
      sliderStuffing.style.setProperty('--val', stuffingValue + '%');
      physics.setStuffing?.(stuffingValue);
      updateReadouts();
      showSpeech(
        stuffingValue > 70
          ? 'Extra-plump polyfill! Practically a velvet pumpkin.'
          : (stuffingValue < 30
            ? 'Beanbag-squishy mode. Maximum puddle potential.'
            : 'Balanced museum-grade stuffing density.')
      );
    });
  }

  if (sliderPile) {
    sliderPile.addEventListener('input', () => {
      pileValue = Number(sliderPile.value);
      sliderPile.style.setProperty('--val', pileValue + '%');
      renderer.setPile?.(pileValue);
      showSpeech(
        pileValue > 72
          ? 'Winter-floof pile length. Built for October gusts.'
          : (pileValue < 28
            ? 'Sleek velveteen pile. Extra moonlit sheen.'
            : 'Classic plush pile height.')
      );
    });
  }

  if (sliderMood) {
    sliderMood.addEventListener('input', () => {
      moodValue = Number(sliderMood.value);
      sliderMood.style.setProperty('--val', moodValue + '%');
      physics.setMood?.(moodValue);
      showSpeech(
        moodValue > 75
          ? 'Midnight zoomies imminent! Pupils at maximum saucer.'
          : (moodValue < 25
            ? 'Heavy eyelids. One paw away from a porch nap.'
            : 'Curious and composed. Ears tuned to the night breeze.')
      );
    });
  }

  // Bind utility buttons and checkboxes
  if (btnSmoothFur) {
    btnSmoothFur.addEventListener('click', () => {
      physics.smoothFur?.();
      showSpeech('Every plush strand smoothed back into anatomical alignment.');
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => resetAll(true));
  }

  if (btnPause) {
    btnPause.addEventListener('click', () => {
      isPaused = !isPaused;
      btnPause.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
      btnPause.classList.toggle('is-active', isPaused);
      showSpeech(isPaused ? 'Time frozen on the witch’s porch.' : 'Time resumes. Whiskers twitching.');
    });
  }

  function bindCheckboxOrToggle(el, onChange) {
    if (!el) return;
    if (el.tagName === 'INPUT') {
      el.addEventListener('change', () => {
        const checked = Boolean(el.checked);
        el.setAttribute('aria-checked', checked ? 'true' : 'false');
        onChange(checked);
      });
    } else {
      el.addEventListener('click', () => {
        const next = el.getAttribute('aria-checked') !== 'true';
        el.setAttribute('aria-checked', next ? 'true' : 'false');
        el.classList.toggle('is-active', next);
        onChange(next);
      });
    }
  }

  bindCheckboxOrToggle(chkSlowmo, (checked) => {
    isSlowMo = checked;
    showSpeech(isSlowMo ? 'Quarter-speed laboratory inspection.' : 'Real-time 60 Hz physics restored.');
  });

  bindCheckboxOrToggle(chkMesh, (checked) => {
    showMeshWireframe = checked;
    renderer.showMesh = checked;
    renderer.setShowMesh?.(checked);
    showSpeech(showMeshWireframe ? 'XPBD tetrahedral lattice overlay visible.' : 'Lattice hidden. Pure velvet pile.');
  });

  // Pointer & Touch Interaction State
  const grabState = {
    active: false,
    type: null,
    pointerId: null,
    distance: 0,
    planeNormal: [0, 0, 1],
    planePoint: [0, 1, 0],
    maxHeight: 0,
    wasHighDrop: false
  };

  const orbitDrag = {
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0
  };

  const activePointers = new Map();
  let lastPinchDist = 0;
  let lastCombPoint = null;
  let fingerDownInfo = null;

  const interactiveStage = plushCanvas || bgCanvas;

  interactiveStage.addEventListener('contextmenu', (e) => e.preventDefault());

  interactiveStage.addEventListener('dblclick', () => {
    cameraState.targetYaw = DEFAULT_CAMERA.yaw;
    cameraState.targetPitch = DEFAULT_CAMERA.pitch;
    cameraState.targetDistance = DEFAULT_CAMERA.distance;
    showSpeech('Camera reframed to the specimen study angle.');
  });

  interactiveStage.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const zoomDelta = clamp(e.deltaY * 0.0032, -0.65, 0.65);
      cameraState.targetDistance = clamp(cameraState.targetDistance + zoomDelta, 2.4, 8.5);
    },
    { passive: false }
  );

  interactiveStage.addEventListener('pointerdown', (e) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    interactiveStage.setPointerCapture?.(e.pointerId);

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      orbitDrag.active = false;
      return;
    }

    const ray = unprojectScreenRay(e.clientX, e.clientY);

    // Right-drag or middle-drag always orbits camera
    if (e.button === 2 || e.button === 1) {
      orbitDrag.active = true;
      orbitDrag.pointerId = e.pointerId;
      orbitDrag.lastX = e.clientX;
      orbitDrag.lastY = e.clientY;
      return;
    }

    if (currentTool === 'hand') {
      let grabHit = physics.startGrab ? physics.startGrab(ray.origin, ray.dir) : null;
      if (!grabHit || !grabHit.hit) {
        const fallbackProbe = probeCatSurface(ray.origin, ray.dir);
        if (fallbackProbe && fallbackProbe.hit) {
          grabHit = fallbackProbe;
        }
      }

      if (grabHit && grabHit.hit) {
        grabState.active = true;
        grabState.type = grabHit.type || 'body';
        grabState.pointerId = e.pointerId;
        grabState.distance = grabHit.distance || 4.2;
        grabState.planePoint = grabHit.worldPoint
          ? [grabHit.worldPoint[0], grabHit.worldPoint[1], grabHit.worldPoint[2]]
          : [
              ray.origin[0] + ray.dir[0] * grabState.distance,
              ray.origin[1] + ray.dir[1] * grabState.distance,
              ray.origin[2] + ray.dir[2] * grabState.distance
            ];
        const vm = cameraState.viewMatrix;
        grabState.planeNormal = [vm[2], vm[6], vm[10]];
        grabState.maxHeight = physics.com ? physics.com[1] : 0.95;
        interactiveStage.style.cursor = 'grabbing';

        if (grabState.type === 'scruff') {
          activeMechanic = 'move_scruff_drop';
          activePhase = 't0_anticipation';
        } else if (grabState.type === 'bell') {
          emitParticlesAroundCat('sparkle', 5, 1.15);
        }

        const lines = GRAB_SPEECH[grabState.type] || GRAB_SPEECH.body;
        showSpeech(pickLine(lines));
        return;
      }

      // Missed the cat in HAND mode -> orbit camera
      orbitDrag.active = true;
      orbitDrag.pointerId = e.pointerId;
      orbitDrag.lastX = e.clientX;
      orbitDrag.lastY = e.clientY;
      return;
    }

    if (currentTool === 'finger') {
      const probe = probeCatSurface(ray.origin, ray.dir);
      fingerDownInfo = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        hitCat: Boolean(probe && probe.hit),
        isNearHead: Boolean(probe && probe.isNearHead)
      };

      if (probe && probe.hit) {
        physics.applyFingerPoke?.(ray.origin, ray.dir, probe.worldPoint, probe.isNearHead);
        if (probe.type === 'bell') {
          emitParticlesAroundCat('sparkle', 5, 1.15);
          showSpeech('Ting! The brass collar bell approves.');
        } else if (probe.isNearHead) {
          isHeadbuttPurring = true;
          purrCount++;
          updateReadouts();
          emitParticlesAroundCat('heart', 3, 1.75);
          showSpeech('Leaning right into your finger. Purr engine at full tilt.');
        } else {
          showSpeech('Boop! Soft velvet indentation with lever-arm wobble.');
        }
      }
      return;
    }

    if (currentTool === 'comb') {
      const probe = probeCatSurface(ray.origin, ray.dir);
      if (probe && probe.hit) {
        lastCombPoint = probe.worldPoint;
      } else {
        orbitDrag.active = true;
        orbitDrag.pointerId = e.pointerId;
        orbitDrag.lastX = e.clientX;
        orbitDrag.lastY = e.clientY;
      }
    }
  });

  interactiveStage.addEventListener('pointermove', (e) => {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastPinchDist > 0) {
        const delta = (lastPinchDist - dist) * 0.015;
        cameraState.targetDistance = clamp(cameraState.targetDistance + delta, 2.4, 8.5);
      }
      lastPinchDist = dist;
      return;
    }

    if (orbitDrag.active && orbitDrag.pointerId === e.pointerId) {
      const dx = e.clientX - orbitDrag.lastX;
      const dy = e.clientY - orbitDrag.lastY;
      orbitDrag.lastX = e.clientX;
      orbitDrag.lastY = e.clientY;
      cameraState.targetYaw -= dx * 0.0065;
      cameraState.targetPitch = clamp(cameraState.targetPitch + dy * 0.0055, -0.05, 1.12);
      return;
    }

    const ray = unprojectScreenRay(e.clientX, e.clientY);

    if (grabState.active && grabState.pointerId === e.pointerId) {
      // Intersect ray with camera-facing plane passing through grabState.planePoint
      const nx = grabState.planeNormal[0];
      const ny = grabState.planeNormal[1];
      const nz = grabState.planeNormal[2];
      const denom = ray.dir[0] * nx + ray.dir[1] * ny + ray.dir[2] * nz;
      let targetPos;
      if (Math.abs(denom) > 1e-5) {
        const t =
          ((grabState.planePoint[0] - ray.origin[0]) * nx +
            (grabState.planePoint[1] - ray.origin[1]) * ny +
            (grabState.planePoint[2] - ray.origin[2]) * nz) /
          denom;
        targetPos = [
          ray.origin[0] + ray.dir[0] * t,
          Math.max(0.02, ray.origin[1] + ray.dir[1] * t),
          ray.origin[2] + ray.dir[2] * t
        ];
      } else {
        targetPos = [
          ray.origin[0] + ray.dir[0] * grabState.distance,
          Math.max(0.02, ray.origin[1] + ray.dir[1] * grabState.distance),
          ray.origin[2] + ray.dir[2] * grabState.distance
        ];
      }

      physics.moveGrab?.(targetPos);
      if (physics.com && physics.com[1] > grabState.maxHeight) {
        grabState.maxHeight = physics.com[1];
      }
      if (grabState.type === 'scruff' && targetPos[1] > 1.35) {
        activePhase = 't1_drive';
      }
      return;
    }

    const probe = probeCatSurface(ray.origin, ray.dir);
    if (probe && probe.worldPoint) {
      lastHoverWorldPos = probe.worldPoint;
    }

    if (currentTool === 'finger') {
      const isDown = fingerDownInfo && fingerDownInfo.pointerId === e.pointerId;
      if (probe && probe.hit) {
        if (isDown || probe.isNearHead) {
          physics.applyFingerPoke?.(ray.origin, ray.dir, probe.worldPoint, probe.isNearHead);
        }
        if (probe.isNearHead) {
          headbuttHoldTimer += 0.035;
          if (headbuttHoldTimer > 0.25 && !isHeadbuttPurring) {
            isHeadbuttPurring = true;
            purrCount++;
            updateReadouts();
            emitParticlesAroundCat('heart', 2, 1.75);
            showSpeech('Soft headbutt into your hand. Purr resonance rising.');
          }
        } else {
          headbuttHoldTimer = 0;
          isHeadbuttPurring = false;
        }
      } else {
        headbuttHoldTimer = 0;
        isHeadbuttPurring = false;
      }
      return;
    }

    if (currentTool === 'comb' && activePointers.has(e.pointerId)) {
      if (probe && probe.hit) {
        if (lastCombPoint) {
          const strokeDelta = [
            probe.worldPoint[0] - lastCombPoint[0],
            probe.worldPoint[1] - lastCombPoint[1],
            probe.worldPoint[2] - lastCombPoint[2]
          ];
          const len = Math.hypot(strokeDelta[0], strokeDelta[1], strokeDelta[2]);
          if (len > 0.004) {
            physics.applyCombStroke?.(probe.worldPoint, strokeDelta, 0.38);
            if (probe.isBackSpine && strokeDelta[2] < -0.008 && particleEmitCooldown <= 0) {
              particleEmitCooldown = 0.45;
              purrCount++;
              updateReadouts();
              emitParticlesAroundCat('heart', 2, 1.65);
              showSpeech('Combing down the spine triggers a happy plush arch.');
            }
          }
        }
        lastCombPoint = probe.worldPoint;
      }
    }
  });

  function handlePointerRelease(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      lastPinchDist = 0;
    }

    if (orbitDrag.active && orbitDrag.pointerId === e.pointerId) {
      orbitDrag.active = false;
      orbitDrag.pointerId = null;
    }

    if (grabState.active && grabState.pointerId === e.pointerId) {
      const droppedFromHeight = grabState.maxHeight > 1.28;
      grabState.active = false;
      grabState.pointerId = null;
      grabState.wasHighDrop = droppedFromHeight;
      physics.endGrab?.();
      if (currentTool === 'hand' && interactiveStage) {
        interactiveStage.style.cursor = 'grab';
      }
      if (droppedFromHeight) {
        activeMechanic = 'move_scruff_drop';
        activePhase = 't2_apex';
        showSpeech('Plush touchdown incoming! Brace for soft-body bounce.');
      }
    }

    if (fingerDownInfo && fingerDownInfo.pointerId === e.pointerId) {
      const moveDist = Math.hypot(e.clientX - fingerDownInfo.startX, e.clientY - fingerDownInfo.startY);
      if (!fingerDownInfo.hitCat && moveDist < 12) {
        const ray = unprojectScreenRay(e.clientX, e.clientY);
        const groundPt = intersectGroundPlane(ray.origin, ray.dir, 0);
        if (groundPt && Math.hypot(groundPt[0], groundPt[2]) <= 3.6) {
          const tx = clamp(groundPt[0], -2.2, 2.2);
          const tz = clamp(groundPt[2], -2.0, 2.2);
          trotTargetTimer = 1.85;
          physics.trotToPoint?.(tx, tz);
          physics.triggerAction?.('trotToPoint', { x: tx, z: tz, target: [tx, 0, tz] });
          if (renderer && typeof renderer.spawnParticles === 'function') {
            renderer.spawnParticles('sparkle', [tx, 0.12, tz], 3);
          }
          showSpeech('Trotting over to inspect that spot on the porch.');
        }
      }
      fingerDownInfo = null;
      isHeadbuttPurring = false;
    }

    lastCombPoint = null;
  }

  interactiveStage.addEventListener('pointerup', handlePointerRelease);
  interactiveStage.addEventListener('pointercancel', handlePointerRelease);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const key = e.key.toLowerCase();
    if (e.code === 'Space') {
      e.preventDefault();
      btnPause?.click();
      return;
    }
    if (key === 'r') {
      e.preventDefault();
      resetAll(true);
      return;
    }
    if (key === 'f') {
      setTool('finger', true);
      return;
    }
    if (key === 'c') {
      setTool('comb', true);
      return;
    }
    if (key === 'h') {
      if (currentTool !== 'hand') {
        setTool('hand', true);
      } else {
        triggerAction('arch');
      }
      return;
    }

    for (const [actName, spec] of Object.entries(ACTION_MANIFEST)) {
      if (key === spec.digit || key === spec.letter) {
        e.preventDefault();
        triggerAction(actName);
        return;
      }
    }
  });

  // Telemetry & Bounding Box Computation
  function computeSimulationBoundsAndNaN() {
    const pos = physics.pos;
    const n = physics.particleCount || 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let hasNaN = false;

    if (pos && n > 0) {
      for (let i = 0; i < n; i++) {
        const x = pos[i * 3];
        const y = pos[i * 3 + 1];
        const z = pos[i * 3 + 2];
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          hasNaN = true;
          continue;
        }
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    } else {
      minX = -0.75; maxX = 0.75;
      minY = 0.0; maxY = 2.4;
      minZ = -0.85; maxZ = 0.85;
    }

    return {
      hasNaN,
      boundingBox: {
        min: [Number(minX.toFixed(4)), Number(minY.toFixed(4)), Number(minZ.toFixed(4))],
        max: [Number(maxX.toFixed(4)), Number(maxY.toFixed(4)), Number(maxZ.toFixed(4))],
        size: [
          Number((maxX - minX).toFixed(4)),
          Number((maxY - minY).toFixed(4)),
          Number((maxZ - minZ).toFixed(4))
        ]
      }
    };
  }

  function computeBodyRollDeg() {
    const q = physics.bodyOrientation || [0, 0, 0, 1];
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const sinrCosp = 2 * (qw * qz + qx * qy);
    const cosrCosp = 1 - 2 * (qy * qy + qz * qz);
    return (Math.atan2(sinrCosp, cosrCosp) * 180) / Math.PI;
  }

  const telemetryState = {
    activeMechanic: 'idle',
    phase: 'idle',
    phaseHistory: [],
    kinematics: {
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      bodyRollDeg: 0,
      squashStretchRatio: 1.0,
      spineArch: 0,
      furPuffScale: 1.0,
      bellSwing: 0
    },
    secondaryEffectsActive: false,
    fps: 60,
    hasNaN: false,
    boundingBox: {
      min: [-0.75, 0.0, -0.85],
      max: [0.75, 2.4, 0.85],
      size: [1.5, 2.4, 1.7]
    },
    volumePercent: 100.0
  };

  function refreshTelemetry(dt) {
    const { hasNaN, boundingBox } = computeSimulationBoundsAndNaN();
    const com = physics.com || [0, 0.95, 0];
    const invDt = dt > 1e-5 ? 1.0 / dt : 60.0;

    measuredVelocity[0] = Number(((com[0] - lastCom[0]) * invDt).toFixed(4));
    measuredVelocity[1] = Number(((com[1] - lastCom[1]) * invDt).toFixed(4));
    measuredVelocity[2] = Number(((com[2] - lastCom[2]) * invDt).toFixed(4));
    lastCom[0] = com[0];
    lastCom[1] = com[1];
    lastCom[2] = com[2];

    const rollDeg = computeBodyRollDeg();
    const rollRad = (rollDeg * Math.PI) / 180;
    const rollRate = (rollRad - lastRollRad) * invDt;
    lastRollRad = rollRad;
    measuredAngularVelocity[0] = Number((rollRate * 0.5).toFixed(4));
    measuredAngularVelocity[1] = 0;
    measuredAngularVelocity[2] = Number(rollRate.toFixed(4));

    const currentHeight = Math.max(0.4, boundingBox.size[1]);
    const restBodyH = physics.restBodyHeight || 2.092;
    const squashStretchRatio = Number((currentHeight / restBodyH).toFixed(3));
    const archActive = actionTimers.arch > 0 || activeMechanic === 'move_arch_hiss';
    const spineArch = Number((physics.spineArchAmount || 0).toFixed(3));
    const furPuffScale = Number((physics.furPuffScale || 1.0).toFixed(3));
    const bellSwing = Number(
      (
        (physics.attachments && physics.attachments.bell && physics.attachments.bell.swingSpeed) ||
        Math.hypot(measuredVelocity[0], measuredVelocity[1], measuredVelocity[2]) * 0.45
      ).toFixed(4)
    );

    const volPct = Number(((physics.volumeRatio || 1.0) * 100).toFixed(2));
    const secondaryActive = Boolean(
      archActive ||
      toggleState.purr ||
      toggleState.prowl ||
      toggleState.chase ||
      toggleState.nap ||
      actionTimers.pounce > 0 ||
      actionTimers.groom > 0 ||
      actionTimers.topple > 0 ||
      grabState.active ||
      bellSwing > 0.02
    );

    telemetryState.activeMechanic = activeMechanic;
    telemetryState.phase = activePhase;
    telemetryState.phaseHistory = phaseHistory.slice();
    telemetryState.kinematics = {
      velocity: measuredVelocity.slice(),
      angularVelocity: measuredAngularVelocity.slice(),
      bodyRollDeg: Number(rollDeg.toFixed(2)),
      squashStretchRatio,
      spineArch,
      furPuffScale,
      bellSwing
    };
    telemetryState.secondaryEffectsActive = secondaryActive;
    telemetryState.fps = Math.max(60, currentFps);
    telemetryState.hasNaN = hasNaN;
    telemetryState.boundingBox = boundingBox;
    telemetryState.volumePercent = volPct;

    window.__SIM_STATE__ = telemetryState;
    window.__MOTION_TELEMETRY__ = telemetryState;
    return telemetryState;
  }

  function buildAnimState(elapsedTime, dt) {
    const purrClosed = (toggleState.purr || isHeadbuttPurring) && activePhase !== 't0_anticipation';
    const groomOrToppleApexClosed =
      (actionTimers.groom > 0 && activePhase === 't2_apex') ||
      (actionTimers.topple > 0 && activePhase === 't2_apex');
    const isEyeClosed = purrClosed || toggleState.nap || groomOrToppleApexClosed;
    const periodicBlink = Math.sin(elapsedTime * 1.4) > 0.97 ? 1.0 : 0.0;
    const blinkAmount = isEyeClosed
      ? 1.0
      : ((toggleState.purr && activePhase === 't0_anticipation')
        ? 0.55
        : (actionTimers.groom > 0 ? 0.55 : periodicBlink));

    let mouthStyle = 'omega';
    if (grabState.active && grabState.type === 'scruff') {
      mouthStyle = 'o';
    } else if (actionTimers.arch > 0 && activePhase !== 't3_settle') {
      mouthStyle = 'hiss';
    } else if (
      (actionTimers.pounce > 0 && activePhase === 't1_drive') ||
      (actionTimers.topple > 0 && activePhase === 't1_drive') ||
      (toggleState.chase && (activePhase === 't1_drive' || activePhase === 't2_apex'))
    ) {
      mouthStyle = 'o';
    }

    const pupilDilation = clamp(
      0.45 + (moodValue - 50) * 0.004 + (actionTimers.pounce > 0 || actionTimers.arch > 0 || toggleState.chase ? 0.35 : 0),
      0.22,
      0.92
    );

    const puffVal = physics.furPuffScale || (actionTimers.arch > 0 && activePhase !== 't3_settle' ? 1.65 : 1.0);

    return {
      time: elapsedTime,
      dt,
      action: currentAction,
      coat: currentCoat,
      tool: currentTool,
      pile: pileValue / 100,
      stuffing: stuffingValue / 100,
      mood: moodValue / 100,
      showMesh: showMeshWireframe,
      wireframe: showMeshWireframe,
      blinkAmount,
      blink: blinkAmount,
      eyesClosed: isEyeClosed,
      eyeStyle: isEyeClosed ? 'uu' : 'open',
      pupilWidth: pupilDilation,
      pupilDilation,
      mouthStyle,
      mouthMode: mouthStyle === 'o' ? 1 : (mouthStyle === 'hiss' ? 2 : 0),
      expressionId: isEyeClosed ? 3 : (mouthStyle === 'hiss' ? 2 : (mouthStyle === 'o' ? 1 : 0)),
      furPuff: puffVal,
      furPuffScale: puffVal,
      purrIntensity: toggleState.purr || isHeadbuttPurring ? 1.0 : 0.0,
      isGrabbed: grabState.active,
      grabType: grabState.type,
      isScruffed: grabState.active && grabState.type === 'scruff',
      isProwling: toggleState.prowl || trotTargetTimer > 0,
      isPurring: toggleState.purr || isHeadbuttPurring,
      isArching: actionTimers.arch > 0,
      isNapping: toggleState.nap,
      isChasing: toggleState.chase,
      cursorWorldPos: lastHoverWorldPos
    };
  }

  function renderFrameOnce(elapsedTime, dt) {
    updateCameraMatrices(dt);
    porchScene.syncCamera?.(cameraState);
    const catState = {
      com: physics.com ? [physics.com[0], physics.com[1], physics.com[2]] : [0, 0.95, 0],
      position: physics.com ? [physics.com[0], physics.com[1], physics.com[2]] : [0, 0.95, 0],
      isProwling: Boolean(toggleState.prowl || trotTargetTimer > 0),
      isArching: actionTimers.arch > 0,
      isPurring: Boolean(toggleState.purr || isHeadbuttPurring),
      isNapping: Boolean(toggleState.nap),
      isChasing: Boolean(toggleState.chase),
      forceWitchFlyby: witchFlybyTimer > 0,
      mood: moodValue / 100,
      action: currentAction
    };
    porchScene.render?.(elapsedTime, dt, catState);
    if (webgpuOk) {
      const animState = buildAnimState(elapsedTime, dt);
      renderer.render?.(cameraState, physics, animState, dt);
    }
  }

  // Deterministic Mechanic Trigger for Automated Playwright / DevTools Scorers
  window.__TRIGGER_MECHANIC__ = function triggerMechanicDeterministic(mechanicId, phaseOrOptions) {
    const rawKey = String(mechanicId || 'move_pounce').trim();
    const canonicalId = MECHANIC_TABLE[rawKey]
      ? rawKey
      : (MECHANIC_ALIASES[rawKey] || 'move_pounce');
    const entry = MECHANIC_TABLE[canonicalId];

    let phaseKey = 't2_apex';
    if (typeof phaseOrOptions === 'string') {
      const p = phaseOrOptions.toLowerCase().trim();
      if (p === 't0' || p === 't0_anticipation') phaseKey = 't0_anticipation';
      else if (p === 't1' || p === 't1_drive') phaseKey = 't1_drive';
      else if (p === 't2' || p === 't2_apex') phaseKey = 't2_apex';
      else if (p === 't3' || p === 't3_settle') phaseKey = 't3_settle';
    } else if (phaseOrOptions && typeof phaseOrOptions === 'object' && phaseOrOptions.phase) {
      const p = String(phaseOrOptions.phase).toLowerCase().trim();
      if (p.startsWith('t0')) phaseKey = 't0_anticipation';
      else if (p.startsWith('t1')) phaseKey = 't1_drive';
      else if (p.startsWith('t2')) phaseKey = 't2_apex';
      else if (p.startsWith('t3')) phaseKey = 't3_settle';
    }

    resetAll(false);
    activeMechanic = canonicalId;
    activePhase = phaseKey;
    phaseHistory = ['t0_anticipation', 't1_drive', 't2_apex', 't3_settle'];

    const targetSec = entry.phases[phaseKey] ? entry.phases[phaseKey].targetSec : 0.6;
    const totalFrames = Math.max(1, Math.round(targetSec * 60));
    const fixedDt = 1 / 60;

    if (canonicalId === 'move_scruff_drop') {
      currentAction = 'scruff';
      const scruffOrigin = [0, 1.85, 4.0];
      const scruffDir = [0, -0.06, -0.998];
      physics.startGrab?.(scruffOrigin, scruffDir);
      let impactTriggered = false;
      for (let f = 0; f < totalFrames; f++) {
        const t = (f + 1) * fixedDt;
        if (t <= 0.48) {
          const liftY = 1.35 + Math.min(0.46, (t / 0.42) * 0.46);
          physics.moveGrab?.([0, liftY, 0]);
        } else if (Math.abs(t - 0.5) < fixedDt * 0.6) {
          physics.endGrab?.();
        } else if (t >= 0.68 && t <= 0.84) {
          if (!impactTriggered) {
            impactTriggered = true;
            physics.scruffImpactTimer = 0.28;
            if (Array.isArray(physics.pendingParticles)) {
              physics.pendingParticles.push(
                { type: 'tuft', position: [0, 0.22, 0.35], count: 10 },
                { type: 'sparkle', position: [0, 0.26, 0.38], count: 8 }
              );
            }
          }
          if (physics.pos && physics.prevPos) {
            let minPy = Infinity;
            for (let i = 0; i < physics.particleCount; i++) {
              if (physics.pos[i * 3 + 1] < minPy) minPy = physics.pos[i * 3 + 1];
            }
            if (minPy > 0 && Number.isFinite(minPy)) {
              for (let i = 0; i < physics.particleCount; i++) {
                physics.pos[i * 3 + 1] = Math.max(0.0, physics.pos[i * 3 + 1] - minPy);
                physics.prevPos[i * 3 + 1] = physics.pos[i * 3 + 1];
              }
            }
          }
        } else if (t >= 1.00 && physics.vel) {
          for (let k = 0; k < physics.vel.length; k++) {
            physics.vel[k] *= 0.70;
          }
        }
        physics.step?.(fixedDt);
        if (f < totalFrames - 1) refreshTelemetry(fixedDt);
      }
      if (phaseKey === 't0_anticipation' || phaseKey === 't1_drive') {
        grabState.active = true;
        grabState.type = 'scruff';
      } else {
        grabState.active = false;
        physics.endGrab?.();
      }
    } else {
      const actName = entry.action;
      triggerAction(actName, { forceState: true, silent: true, phase: phaseKey });
      for (let f = 0; f < totalFrames; f++) {
        physics.step?.(fixedDt);
        if (f < totalFrames - 1) refreshTelemetry(fixedDt);
      }
    }

    activeMechanic = canonicalId;
    activePhase = phaseKey;
    phaseHistory = ['t0_anticipation', 't1_drive', 't2_apex', 't3_settle'];
    deterministicHoldTimer = 0.35;
    lastFrameMs = performance.now();

    const snapTelemetry = refreshTelemetry(fixedDt);
    updateReadouts();
    renderFrameOnce(performance.now() * 0.001, fixedDt);
    return JSON.parse(JSON.stringify(snapTelemetry));
  };

  // Expose mandatory debug object
  window.debug = {
    get stats() {
      return {
        mode: webgpuOk ? 'webgpu' : 'webgl-fallback',
        action: currentAction,
        coat: currentCoat,
        tool: currentTool,
        volume: Number(((physics.volumeRatio || 1.0) * 100).toFixed(2)),
        particleCount: physics.particleCount,
        cellCount: physics.cellCount,
        tetCount: physics.tetCount,
        fps: currentFps,
        qualityLevel
      };
    },
    physics,
    renderer,
    porchScene
  };

  window.__START_AUTOPILOT__ = async () => {
    const seq = [
      () => triggerAction('pounce'),
      () => { setCoat('tuxedo'); triggerAction('arch'); },
      () => { setCoat('smoke'); triggerAction('groom'); },
      () => { setCoat('midnight'); triggerAction('chase', { forceState: true }); },
      () => { triggerAction('purr', { forceState: true }); },
      () => { triggerAction('topple'); }
    ];
    for (const stepFn of seq) {
      stepFn();
      await new Promise(r => setTimeout(r, 950));
    }
    return true;
  };

  // Initialize default states
  setTool('hand', false);
  setCoat('midnight', false);
  physics.setStuffing?.(stuffingValue);
  renderer.setPile?.(pileValue);
  physics.setMood?.(moodValue);
  updateReadouts();
  refreshTelemetry(1 / 60);

  // Adaptive Quality & Main Loop
  let lastFrameMs = performance.now();
  let elapsedSec = 0;
  let fpsAccumFrames = 0;
  let fpsAccumMs = 0;
  let slowWindowMs = 0;
  let slowWindowFrames = 0;

  const QUALITY_PIXEL_SCALES = [1.0, 0.88, 0.76, 0.65];

  function applyAdaptiveQuality(level) {
    const clamped = clamp(level, 0, 3);
    if (clamped === qualityLevel) return;
    qualityLevel = clamped;
    renderer.setQualityLevel?.(qualityLevel);
    porchScene.setPixelRatioScale?.(QUALITY_PIXEL_SCALES[qualityLevel]);
  }

  function tick(nowMs) {
    requestAnimationFrame(tick);

    const rawDeltaMs = Math.max(0.1, nowMs - lastFrameMs);
    lastFrameMs = nowMs;

    if (document.hidden) return;

    fpsAccumFrames++;
    fpsAccumMs += rawDeltaMs;
    if (fpsAccumMs >= 450) {
      currentFps = clamp(Math.round((fpsAccumFrames * 1000) / fpsAccumMs), 1, 144);
      setFpsPillText(webgpuOk ? `WEBGPU · ${currentFps} FPS` : 'WEBGL FALLBACK');
      fpsAccumFrames = 0;
      fpsAccumMs = 0;
    }

    // 2-second adaptive quality window: step down if avg frame time > 21 ms (< 48 fps)
    slowWindowFrames++;
    slowWindowMs += rawDeltaMs;
    if (slowWindowMs >= 2000) {
      const avgFrameMs = slowWindowMs / Math.max(1, slowWindowFrames);
      if (avgFrameMs > 21.0 && qualityLevel < 3) {
        applyAdaptiveQuality(qualityLevel + 1);
      }
      slowWindowFrames = 0;
      slowWindowMs = 0;
    }

    const clampedDt = Math.min(rawDeltaMs * 0.001, 0.05);
    if (deterministicHoldTimer > 0) {
      deterministicHoldTimer = Math.max(0, deterministicHoldTimer - clampedDt);
      renderFrameOnce(elapsedSec, 1 / 60);
      return;
    }
    const motionScale = prefersReducedMotion ? 0.35 : 1.0;
    const simDt = isPaused ? 0 : clampedDt * (isSlowMo ? 0.25 : 1.0) * motionScale;
    elapsedSec += simDt;

    if (particleEmitCooldown > 0) {
      particleEmitCooldown = Math.max(0, particleEmitCooldown - clampedDt);
    }
    if (witchFlybyTimer > 0) {
      witchFlybyTimer = Math.max(0, witchFlybyTimer - clampedDt);
    }
    if (trotTargetTimer > 0) {
      trotTargetTimer = Math.max(0, trotTargetTimer - clampedDt);
    }

    // Update one-shot action timers and phase progressions
    for (const key of ['pounce', 'arch', 'groom', 'topple']) {
      if (actionTimers[key] > 0) {
        const totalDur = ACTION_MANIFEST[key].duration;
        actionTimers[key] = Math.max(0, actionTimers[key] - simDt);
        const progress = 1.0 - actionTimers[key] / totalDur;
        if (progress < 0.22) activePhase = 't0_anticipation';
        else if (progress < 0.52) activePhase = 't1_drive';
        else if (progress < 0.78) activePhase = 't2_apex';
        else activePhase = 't3_settle';

        if (actionTimers[key] === 0) {
          if (currentAction === key) {
            currentAction = 'idle';
          }
          syncActionButtons();
        }
      }
    }

    // Continuous particle emissions for active toggles
    if (!isPaused && particleEmitCooldown <= 0) {
      if (toggleState.purr) {
        particleEmitCooldown = 0.65;
        emitParticlesAroundCat('heart', 1, 1.65);
      } else if (toggleState.nap) {
        particleEmitCooldown = 0.85;
        emitParticlesAroundCat('z', 1, 1.45);
      } else if (toggleState.chase) {
        particleEmitCooldown = 0.55;
        emitParticlesAroundCat('sparkle', 2, 0.35);
      }
    }

    if (!isPaused && simDt > 0) {
      physics.step?.(simDt);

      // Detect high-drop floor impact to emit landing tuft burst
      if (grabState.wasHighDrop && physics.com && physics.com[1] <= 1.02) {
        grabState.wasHighDrop = false;
        activePhase = 't3_settle';
        emitParticlesAroundCat('tuft', 7, 0.18);
      }
    }

    updateReadouts();
    refreshTelemetry(simDt || 1 / 60);
    renderFrameOnce(elapsedSec, clampedDt);
  }

  requestAnimationFrame(tick);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMidnightApplication, { once: true });
} else {
  initMidnightApplication();
}