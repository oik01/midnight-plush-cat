# Shared Architecture & Interface Contract for Midnight (`index.html`)

All 5 modular parts live in `/Users/omarkreidieh/.gemini/antigravity/scratch/midnight-plush-cat/parts/` and are concatenated into `/Users/omarkreidieh/.gemini/antigravity/scratch/midnight-plush-cat/index.html` by `assemble.mjs`.

## Coordinate System & Units
- World space: `y` is UP, ground porch plane is `y = 0`, cat faces `+z` at rest.
- Scale: `1.0` world unit = `10 cm`. The cat is `24 cm` tall, so its rest height is `2.40` units (`y` from `0.0` to `2.40`).
- Rest bounding box of cat: `x in [-0.75, 0.75]`, `y in [0.0, 2.40]`, `z in [-0.85, 0.85]`.

## Part 1: `parts/01_ui_shell_and_css.html`
Provides the complete HTML structure and CSS (everything up to `<script type="module">`, with a placeholder `/* __MIDNIGHT_JS_BUNDLE__ */` inside `<script type="module">` where Parts 2–5 are injected).

### Required DOM IDs & Data Attributes:
- Canvases:
  - `#bg-canvas` (lower canvas for Three.js WebGL background)
  - `#plush-canvas` (upper canvas for native WebGPU plush cat, `pointer-events: auto`)
- Loading & Fallback:
  - `#loading-overlay` (centred italic `"Fluffing a very small cat…"` while geometry builds; hidden via `.is-hidden` once ready)
  - `#fallback-card` (hidden by default; shown with `.is-visible` if WebGPU is unavailable or WGSL fails to compile)
  - `#fallback-reason` (text/pre element showing WebGPU status or WGSL compilation error log)
- Top Bar:
  - `#fps-pill` (status pill text `"WEBGPU · 60 FPS"` with `.ember-dot`)
- Masthead (Left, `#masthead`):
  - Title `"Plush / Black Cat."` (~100px italic Fraunces, soft warm glow, second line indented)
  - 2-line caption, italic motto in left-bordered quote, specimen ID `"FELIS CATUS NOCTURNA / SOFT GOODS — Sitting specimen, 24 cm · one bell"`
- Right Panel (`#control-panel`, `"The specimen — fig. 013"`):
  - TOUCH segmented control: buttons `[data-tool="hand"]`, `[data-tool="finger"]`, `[data-tool="comb"]` with `aria-pressed="true|false"`
  - COAT swatches: buttons `[data-coat="midnight"]`, `[data-coat="smoke"]`, `[data-coat="tuxedo"]` with `aria-pressed="true|false"`
  - Sliders:
    - `#slider-stuffing` (`min="0" max="100" value="55"`, Squishy–Plump)
    - `#slider-pile` (`min="0" max="100" value="62"`, Velvet–Fluffy)
    - `#slider-mood` (`min="0" max="100" value="50"`, Sleepy–Zoomies)
  - ACTIONS 2-column grid (4-column on mobile `<=900px`):
    - `[data-action="prowl"]` (toggle, key `1`)
    - `[data-action="pounce"]` (trigger, key `2`)
    - `[data-action="arch"]` (trigger/hold, key `3`, label `"Arch & hiss"`)
    - `[data-action="purr"]` (toggle, key `4`)
    - `[data-action="groom"]` (trigger, key `5`)
    - `[data-action="chase"]` (toggle/trigger, key `6`)
    - `[data-action="nap"]` (toggle, key `7`)
    - `[data-action="topple"]` (trigger, key `8`)
  - Utility row:
    - `#btn-smooth-fur` (`"Smooth fur"`)
    - `#btn-reset` (`"Reset"`, key `R`)
    - `#btn-pause` (`"Pause"`, key `Space`, `aria-pressed`)
  - Checkboxes:
    - `#chk-slowmo` (`"¼ speed"`, `aria-checked`)
    - `#chk-mesh` (`"Mesh"`, `aria-checked`)
- Speech Bubble (`#speech-bubble`, `aria-live="polite"`):
  - `#speech-text` (italic Fraunces text inside glass pill centred under the cat; toggling `.pop-anim` class pops it)
- Bottom Left (`#bottom-left-hud`):
  - `#tool-hint` (context hint for active tool)
  - Readout cards:
    - `#readout-mass` (`"340 g"`)
    - `#readout-volume` (`"100.0%"`)
    - `#readout-purrs` (`"0"`)
    - `#readout-pounces` (`"0"`)
  - Collapsible `#inside-experiment` (`<details>` or button-toggled card `"Inside the experiment"` with 5 short paragraphs and live counts `#count-particles`, `#count-cells`, `#count-tets`)

---

## Part 2: `parts/02_sdf_mesh_and_xpbd_physics.js`
Exports/defines `class PlushPhysicsEngine`:
- `constructor()` -> builds SDF, Surface Nets skin mesh, Hex/Tet lattice, Barycentric skin & attachment weights, Cloth ears (left & right `6x8` grids), Soft rope tail (`16` particles + procedural dynamic fur tube mesh), Brass bell pendulum, and Felt toy mouse rigid body.
- Properties exposed on `physics`:
  - `particleCount`, `cellCount`, `tetCount` (numbers)
  - `pos` (`Float32Array` of tet node positions `3 * particleCount`), `restPos`, `vel`, `invMass`
  - `cells` (array of hex cells with node indices, warm-started `quat`, rest offsets)
  - `tets` (`Uint32Array` `4 * tetCount`), `tetRestVol` (`Float32Array`)
  - `volumeRatio` (number, e.g. `1.0` = `100.0%` live signed-tet sum / total rest volume)
  - `com` (`[x, y, z]` current center of mass), `bodyOrientation` (`[qx, qy, qz, qw]`)
  - `skinMesh`:
    - `vertexCount`, `triangleCount`
    - `restPositions` (`Float32Array`), `restNormals` (`Float32Array`)
    - `positions` (`Float32Array`), `normals` (`Float32Array`)
    - `combAndRegion` (`Float32Array` `4 * vertexCount`: `[lieX, lieY, lieZ, regionCode]`)
    - `dynTipOffsets` (`Float32Array` `4 * vertexCount`: `[tipDx, tipDy, tipDz, seamWeight]`)
    - `indices` (`Uint32Array` `3 * triangleCount`)
  - `earMesh`:
    - `vertexCount`, `triangleCount`
    - `positions` (`Float32Array`), `normals` (`Float32Array`), `uvsAndSide` (`Float32Array` `4 * vertexCount`: `[u, v, isInnerPink, edgeStitch]`)
    - `indices` (`Uint32Array`)
  - `tailMesh`:
    - `vertexCount`, `triangleCount`
    - `positions`, `normals`, `restPositions`, `combAndRegion`, `dynTipOffsets`, `indices`
  - `attachments`:
    - Rigid frames `{ pos: [x,y,z], rotMat3: Float32Array(9), quat: [x,y,z,w] }` computed via polar decomposition of the averaged deformation gradient for:
      - `leftEye`, `rightEye`, `nose`, `mouth`, `collar`, `leftCheek`, `rightCheek`
    - `bell`: `{ pos: [x,y,z], vel: [vx,vy,vz], anchorPos: [x,y,z], radius: 0.11, swingSpeed: 0 }`
    - `mouseToy`: `{ active: false, pos: [x,y,z], vel: [vx,vy,vz], yaw: 0, stringAnchor: [x,y,z] }`
  - `latticeWireframeIndices` (`Uint32Array` line list for `"Mesh"` toggle)
- Methods on `physics`:
  - `step(dt)` (runs 6 XPBD substeps at 60 Hz equivalent, updates skinning, fur tip springs, cloth ears, rope tail, bell pendulum, mouse toy, and NaN guard)
  - `setStuffing(val0to100)`, `setMood(val0to100)`
  - `smoothFur()` (resets comb vectors to natural anatomical flow)
  - `applyCombStroke(worldPos, worldDir, radius)` (strokes fur lie in rest space via inverse deformation gradient; combing back triggers happy arch)
  - `applyFingerPoke(rayOrigin, rayDir, hitPoint, isHoldNearHead)` (dents fur with capsule collider + lever-arm impulse; hovering near head triggers headbutt lean + purr)
  - `startGrab(rayOrigin, rayDir)` -> returns `{ hit: boolean, type: 'body'|'scruff'|'ear'|'tail'|'bell', distance: number, worldPoint: [x,y,z] }`
  - `moveGrab(worldTargetPoint)` (clamped `y >= 0.02`)
  - `endGrab()`
  - `triggerAction(actionName, options)` (drives `prowl`, `pounce`, `arch`, `purr`, `groom`, `chase`, `nap`, `topple`, or `trotToPoint(x, z)`)
  - `reset()`

---

## Part 3: `parts/03_webgpu_renderer_and_wgsl.js`
Exports/defines `class PlushWebGPURenderer`:
- `async init(canvas, physics)` -> returns `{ ok: boolean, error?: string }`. Validates all WGSL modules with `getCompilationInfo()`.
- Implements all 4 passes specified in §2 & §4:
  1. Key-light shadow map (`depth32float`, `1536x1536`) with PCSS-lite blocker search & variable penumbra.
  2. Top-down height map (`256x256` `r32float` or `rgba16float`) for contact AO on `y = 0`.
  3. Main pass (`4x MSAA`, `rgba16float` HDR):
     - Ground shadow catcher on `y = 0` (outputs premultiplied darkness only).
     - Props pass: glass-bead eyes (with glowing iris, variable pupil width, 2 camera-space catchlights per eye, procedural night env reflection, blink squash), pink felt triangle nose, embroidered mouth meshes (`ω`, `o`, `^` with felt tongue, `u u` closed eyes), pink cheek blush, 3 embroidered thread whiskers per side, dark-purple velvet collar, metallic brass bell, felt toy mouse on string.
     - Felt ears pass (double-sided, stitched edges, fine fuzz noise, pink inner-ear patch, grazing-angle sheen).
     - Fur base layer (backing fabric + dark root density).
     - Fur shells pass (`18–30` adaptive instances on body + tail, tapered cone procedural strands hashed in rest space, Kajiya-Kay dual lobes, velvet term, moonlit rim halo, Tuxedo cream bib/paws mask, back stitched seam, manual 4-sample `@builtin(sample_mask)` coverage).
     - Instanced camera-facing billboard particles pass (depth-tested, premultiplied blending, canvas glyph atlas: hearts, `z`, orange sparkles, fur tufts, plus subtle eye/bell bloom halos).
     - Optional wireframe of simulation lattice (`showMesh`).
  4. Post pass: exposure, Khronos PBR Neutral tone mapping on unpremultiplied color, sRGB OETF, `1/255` dither, re-premultiplied output to `alphaMode: "premultiplied"` canvas.
- Methods:
  - `setCoat(coatName)` (`'midnight' | 'smoke' | 'tuxedo'`)
  - `setPile(val0to100)`
  - `setQualityLevel(level0to3)` (scales resolution & shell count 30 -> 24 -> 20 -> 18)
  - `spawnParticles(type, position, count)` (`'heart' | 'z' | 'sparkle' | 'tuft'`)
  - `render(cameraState, physics, animState, dt)`

---

## Part 4: `parts/04_threejs_witch_porch.js`
Exports/defines `class WitchPorchScene`:
- `constructor(canvas)` -> initializes Three.js `WebGLRenderer`, `Scene`, `PerspectiveCamera`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, and builds "The Witch's Front Porch" (keeping all tall geometry outside radius `r > 4.2` so nothing ever blocks the camera).
- Builds all required foreground, mid-ground, far, and atmosphere elements (§5).
- Methods:
  - `syncCamera(cameraState)` (copies `eye`, `target`, `fov`, `aspect`, builds perspective matrix, and overwrites `projectionMatrix.elements[8] = cameraState.shiftX` and `projectionMatrix.elements[9] = cameraState.shiftY` so both canvases line up pixel-perfectly)
  - `setPixelRatioScale(scale)` (mirrors adaptive quality)
  - `render(time, dt, catState)` (where `catState` provides `{ com, isProwling, isArching, isPurring, forceWitchFlyby }`)

---

## Part 5: `parts/05_interaction_controller_and_main.js`
Wires Parts 1–4 together:
- Manages camera orbit, zoom, double-click reset, smooth COM tracking, and off-center projection shift (`shiftX`, `shiftY`) computed from actual DOM rects of `#masthead`, `#control-panel`, and mobile sheet.
- Binds all UI controls, keyboard shortcuts (`1-8`, `H`, `F`, `C`, `Space`, `R`), pointer events, reactive witty dialogue thoughts, live DOM readouts, and adaptive 4-level quality scaling.
- Exposes `window.debug`, `window.__SIM_STATE__`, `window.__MOTION_TELEMETRY__`, and `window.__TRIGGER_MECHANIC__(mechanicId, phaseOrTime)`.
