import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

function readVec3(input, fallback) {
  if (!input) return fallback;
  if (Array.isArray(input) || ArrayBuffer.isView(input)) {
    return [
      Number.isFinite(input[0]) ? input[0] : fallback[0],
      Number.isFinite(input[1]) ? input[1] : fallback[1],
      Number.isFinite(input[2]) ? input[2] : fallback[2]
    ];
  }
  if (typeof input === 'object') {
    return [
      Number.isFinite(input.x) ? input.x : fallback[0],
      Number.isFinite(input.y) ? input.y : fallback[1],
      Number.isFinite(input.z) ? input.z : fallback[2]
    ];
  }
  return fallback;
}

function createWoodPlankTextures() {
  const width = 1024;
  const height = 512;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d');

  cCtx.fillStyle = '#24150e';
  cCtx.fillRect(0, 0, width, height);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, width, height);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < height; y += 2) {
    const wave = Math.sin(y * 0.045) * 6.0 + Math.cos(y * 0.13) * 2.5;
    const tone = 0.82 + 0.18 * Math.sin(y * 0.09 + rand() * 0.5);
    const r = Math.floor(42 * tone + rand() * 8);
    const g = Math.floor(25 * tone + rand() * 5);
    const b = Math.floor(17 * tone + rand() * 4);
    cCtx.strokeStyle = `rgb(${r},${g},${b})`;
    cCtx.lineWidth = 2.2;
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.bezierCurveTo(width * 0.33, y + wave, width * 0.66, y - wave, width, y);
    cCtx.stroke();

    const bumpVal = Math.floor(110 + 36 * Math.sin(y * 0.16) + rand() * 18);
    bCtx.strokeStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
    bCtx.lineWidth = 2.0;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.bezierCurveTo(width * 0.33, y + wave, width * 0.66, y - wave, width, y);
    bCtx.stroke();
  }

  for (let k = 0; k < 7; k++) {
    const kx = 90 + rand() * (width - 180);
    const ky = 50 + rand() * (height - 100);
    const rx = 18 + rand() * 26;
    const ry = 8 + rand() * 12;
    const grad = cCtx.createRadialGradient(kx, ky, 2, kx, ky, rx);
    grad.addColorStop(0, 'rgba(16, 8, 5, 0.85)');
    grad.addColorStop(0.55, 'rgba(34, 18, 11, 0.45)');
    grad.addColorStop(1, 'rgba(42, 24, 15, 0)');
    cCtx.fillStyle = grad;
    cCtx.beginPath();
    cCtx.ellipse(kx, ky, rx, ry, (rand() - 0.5) * 0.3, 0, Math.PI * 2);
    cCtx.fill();

    const bGrad = bCtx.createRadialGradient(kx, ky, 1, kx, ky, rx);
    bGrad.addColorStop(0, 'rgba(55, 55, 55, 0.9)');
    bGrad.addColorStop(1, 'rgba(128, 128, 128, 0)');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.ellipse(kx, ky, rx, ry, 0, 0, Math.PI * 2);
    bCtx.fill();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function createDoormatTextures() {
  const width = 512;
  const height = 384;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d');

  ctx.fillStyle = '#5c3d22';
  ctx.fillRect(0, 0, width, height);
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, width, height);

  for (let y = 16; y < height - 16; y += 6) {
    for (let x = 16; x < width - 16; x += 8) {
      const zig = ((x / 8 + y / 6) % 2 === 0) ? 3 : -3;
      const shade = 78 + ((x * 13 + y * 29) % 28);
      ctx.strokeStyle = `rgb(${shade + 18}, ${shade - 4}, ${Math.max(18, shade - 32)})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6, y + zig);
      ctx.stroke();

      const bShade = 120 + ((x * 17 + y * 31) % 95);
      bCtx.strokeStyle = `rgb(${bShade}, ${bShade}, ${bShade})`;
      bCtx.lineWidth = 2.6;
      bCtx.beginPath();
      bCtx.moveTo(x, y);
      bCtx.lineTo(x + 6, y + zig);
      bCtx.stroke();
    }
  }

  ctx.strokeStyle = '#2d1c10';
  ctx.lineWidth = 18;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = '#8c6239';
  ctx.lineWidth = 3.5;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.setLineDash([]);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  return { map, bumpMap };
}

function createRibbedPumpkinGeometry(radius, height, ribs = 14) {
  const geo = new THREE.SphereGeometry(radius, 42, 28);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const angle = Math.atan2(v.z, v.x);
    const normY = v.y / radius;
    const equatorFactor = Math.sqrt(Math.max(0, 1 - normY * normY));
    const ribWave = Math.cos(angle * ribs);
    const radialScale = 1.0 + 0.095 * ribWave * equatorFactor;

    v.x *= radialScale;
    v.z *= radialScale;
    v.y *= (height / (radius * 2));

    const poleIndent = Math.pow(Math.max(0, 1 - equatorFactor), 2.4);
    v.y -= Math.sign(v.y) * poleIndent * radius * 0.18;

    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

class WitchPorchScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.pixelRatioScale = 1.0;
    this.elapsedTime = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0512);
    this.scene.fog = new THREE.FogExp2(0x160c24, 0.022);

    const { width, height } = this._getCanvasDimensions();
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 150);
    this.camera.position.set(0, 1.85, 5.4);
    this.camera.lookAt(0, 1.0, 0);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.56,
      0.65,
      0.72
    );
    this.composer.addPass(this.bloomPass);
    this._applySize(width, height);

    this.hangingLanterns = [];
    this.rafterCandles = [];
    this.cauldronBubbles = [];
    this.cloudMaterials = [];
    this.mistMaterials = [];
    this.batFlock = [];
    this.villageWindows = [];

    this.witchFlybyState = {
      active: true,
      progress: 0.12,
      cooldown: 40.0,
      duration: 9.5
    };
    this.archResponse = 0;
    this.purrResponse = 0;
    this.prowlResponse = 0;

    this._buildLighting();
    this._buildSkyAndMoon();
    this._buildValleyHillsAndVillage();
    this._buildPorchDeckAndForegroundProps();
    this._buildCottageMidgroundAndRafters();
    this._buildYardFenceAndTrees();
    this._buildAtmosphereMistAndFireflies();

    this._onResize = () => {
      const dims = this._getCanvasDimensions();
      this._applySize(dims.width, dims.height);
    };
    window.addEventListener('resize', this._onResize, { passive: true });
  }

  _getCanvasDimensions() {
    const w = Math.max(1, this.canvas?.clientWidth || window.innerWidth || 1280);
    const h = Math.max(1, this.canvas?.clientHeight || window.innerHeight || 720);
    return { width: w, height: h };
  }

  _applySize(width, height) {
    const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
    const dpr = Math.max(0.5, baseDpr * this.pixelRatioScale);
    this._lastWidth = width;
    this._lastHeight = height;
    this._lastDpr = dpr;

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(Math.floor(width * dpr * 0.5), Math.floor(height * dpr * 0.5));
  }

  setPixelRatioScale(scale) {
    const clamped = Math.max(0.5, Math.min(2.0, Number(scale) || 1.0));
    if (Math.abs(clamped - this.pixelRatioScale) < 0.01) return;
    this.pixelRatioScale = clamped;
    const { width, height } = this._getCanvasDimensions();
    this._applySize(width, height);
  }

  syncCamera(cameraState) {
    if (!cameraState) return;
    const { width, height } = this._getCanvasDimensions();
    if (width !== this._lastWidth || height !== this._lastHeight) {
      this._applySize(width, height);
    }

    const eye = readVec3(cameraState.eye, [0, 1.85, 5.4]);
    const target = readVec3(cameraState.target, [0, 1.0, 0]);
    const up = readVec3(cameraState.up, [0, 1, 0]);

    this.camera.position.set(eye[0], eye[1], eye[2]);
    this.camera.up.set(up[0], up[1], up[2]);
    this.camera.lookAt(target[0], target[1], target[2]);

    this.camera.fov = cameraState.fovDeg ?? cameraState.fov ?? 36;
    this.camera.aspect = cameraState.aspect ?? (width / height);
    this.camera.near = cameraState.near ?? 0.1;
    this.camera.far = cameraState.far ?? 150;
    this.camera.updateProjectionMatrix();

    // Exact off-center frustum shift so Three.js y = 0 planks match the WebGPU plush cat & shadow catcher pixel-for-pixel
    this.camera.projectionMatrix.elements[8] = cameraState.shiftX ?? 0;
    this.camera.projectionMatrix.elements[9] = cameraState.shiftY ?? 0;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  triggerWitchFlyby(phase = 0.05) {
    this.witchFlybyState.active = true;
    this.witchFlybyState.progress = Math.max(0, Math.min(0.95, phase));
  }

  _buildLighting() {
    this.hemiLight = new THREE.HemisphereLight(0x472d6b, 0x160b1f, 0.92);
    this.scene.add(this.hemiLight);

    // Moonlight aligned with the WebGPU plush cat key light
    this.moonLight = new THREE.DirectionalLight(0xdce6ff, 1.75);
    this.moonLight.position.set(-4.5, 13.5, -11.0);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 1.0;
    this.moonLight.shadow.camera.far = 36.0;
    const d = 8.5;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.moonLight.shadow.bias = -0.0008;
    this.scene.add(this.moonLight);

    // Warm rim/fill light that tracks the plush cat center of mass
    this.catLight = new THREE.PointLight(0xffb56b, 1.35, 7.0, 1.7);
    this.catLight.position.set(0, 0.8, 0.6);
    this.scene.add(this.catLight);

    // Flickering carved pumpkin point light (right rear porch corner)
    this.pumpkinLight = new THREE.PointLight(0xff7b24, 3.4, 9.5, 1.55);
    this.pumpkinLight.position.set(1.18, 0.55, -1.25);
    this.scene.add(this.pumpkinLight);

    // Glowing green cauldron point light (left rear porch corner)
    this.cauldronLight = new THREE.PointLight(0x4eff7a, 2.5, 8.2, 1.65);
    this.cauldronLight.position.set(-1.22, 0.92, -1.45);
    this.scene.add(this.cauldronLight);

    // Warm orange cottage mullioned window light
    this.windowLight = new THREE.PointLight(0xff9e44, 2.2, 10.5, 1.55);
    this.windowLight.position.set(-1.65, 2.15, -3.95);
    this.scene.add(this.windowLight);
  }

  _buildSkyAndMoon() {
    const skyGeo = new THREE.SphereGeometry(118, 40, 28);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorldPos;
        uniform float uTime;

        float hash31(vec3 p) {
          p = fract(p * vec3(443.897, 441.423, 437.195));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y * 1.15 + 0.08, 0.0, 1.0);

          vec3 horizonCol = vec3(0.165, 0.082, 0.239); // #2a153d
          vec3 midCol = vec3(0.086, 0.039, 0.145);
          vec3 zenithCol = vec3(0.043, 0.020, 0.071);  // #0b0512

          vec3 col = mix(horizonCol, midCol, smoothstep(0.0, 0.42, h));
          col = mix(col, zenithCol, smoothstep(0.35, 0.95, h));

          // Subtle violet milky band
          float band = exp(-pow((dir.x * 0.55 + dir.y * 0.75 - 0.28) * 3.8, 2.0));
          col += vec3(0.055, 0.022, 0.085) * band * smoothstep(0.05, 0.4, dir.y);

          if (dir.y > 0.02) {
            vec3 gridA = floor(dir * 210.0);
            float rA = hash31(gridA);
            if (rA > 0.9945) {
              vec3 cellCenter = normalize(gridA + 0.5);
              float dist = length(dir - cellCenter) * 210.0;
              float twinkle = 0.62 + 0.38 * sin(uTime * (2.2 + rA * 4.0) + rA * 95.0);
              float star = smoothstep(0.32, 0.0, dist) * twinkle * smoothstep(0.02, 0.22, dir.y);
              vec3 starTint = mix(vec3(1.0, 0.91, 0.78), vec3(0.82, 0.88, 1.0), fract(rA * 37.0));
              col += starTint * star * 1.55;
            }

            vec3 gridB = floor(dir * 95.0);
            float rB = hash31(gridB + 17.3);
            if (rB > 0.9972) {
              vec3 cellCenter = normalize(gridB + 0.5);
              float dist = length(dir - cellCenter) * 95.0;
              float twinkle = 0.7 + 0.3 * cos(uTime * 3.4 + rB * 120.0);
              float brightStar = smoothstep(0.38, 0.0, dist) * twinkle * smoothstep(0.06, 0.25, dir.y);
              col += vec3(1.0, 0.93, 0.80) * brightStar * 2.2;
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    const skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(skyMesh);

    // Harvest Moon low in the valley behind the cat's head (z ~ -60, y ~ 11.5)
    this.moonGroup = new THREE.Group();
    this.moonGroup.position.set(0.88, 3.35, -34.0);
    this.scene.add(this.moonGroup);

    const moonDiscGeo = new THREE.CircleGeometry(3.2, 64);
    const moonDiscMat = new THREE.ShaderMaterial({
      transparent: true,
      fog: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        void main() {
          float r = length(vUv);
          if (r > 1.0) discard;
          float fbm = noise(vUv * 3.2) * 0.55 + noise(vUv * 6.8 + 2.4) * 0.30 + noise(vUv * 14.0) * 0.15;
          float maria = smoothstep(0.42, 0.68, fbm);
          float limb = sqrt(max(0.0, 1.0 - r * r));
          vec3 highCol = vec3(1.0, 0.89, 0.66); // #ffe3a8
          vec3 lowCol = vec3(0.95, 0.69, 0.38);
          vec3 col = mix(highCol, lowCol, maria * 0.38 + (1.0 - limb) * 0.42);
          float edge = smoothstep(1.0, 0.955, r);
          gl_FragColor = vec4(col * 1.42, edge);
        }
      `
    });
    const moonDisc = new THREE.Mesh(moonDiscGeo, moonDiscMat);
    moonDisc.renderOrder = 1;
    this.moonGroup.add(moonDisc);

    // Atmospheric corona around the harvest moon
    const coronaGeo = new THREE.PlaneGeometry(34, 34);
    const coronaMat = new THREE.ShaderMaterial({
      transparent: true,
      fog: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          float d = length(vUv);
          float glow = exp(-d * 3.4) * 0.55 + exp(-d * 1.65) * 0.18;
          glow *= smoothstep(1.0, 0.12, d);
          vec3 col = mix(vec3(1.0, 0.72, 0.36), vec3(0.55, 0.32, 0.72), smoothstep(0.18, 0.85, d));
          gl_FragColor = vec4(col * glow, glow);
        }
      `
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.position.z = -0.2;
    this.moonGroup.add(coronaMesh);

    // Witch-on-a-broom silhouette crossing in front of the harvest moon
    const witchGeo = new THREE.PlaneGeometry(3.4, 2.3);
    const witchMat = new THREE.ShaderMaterial({
      transparent: true,
      fog: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        float sdSegment(vec2 p, vec2 a, vec2 b) {
          vec2 pa = p - a, ba = b - a;
          float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          return length(pa - ba * h);
        }
        float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
          vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
          vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
          vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
          vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
          vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
          float s = sign(e0.x * e2.y - e0.y * e2.x);
          vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                           vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                           vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
          return -sqrt(d.x) * sign(d.y);
        }
        void main() {
          vec2 p = vUv;
          p.y += sin(p.x * 2.8) * 0.03;

          // Broomstick shaft
          float broom = sdSegment(p, vec2(-0.82, -0.18), vec2(0.78, 0.08)) - 0.025;
          // Bristle tail on left
          float bristles = sdTriangle(p, vec2(-0.52, -0.13), vec2(-0.95, -0.02), vec2(-0.90, -0.34)) - 0.02;
          // Witch torso & billowing cape
          float torso = sdTriangle(p, vec2(-0.02, 0.34), vec2(-0.38, -0.15), vec2(0.16, -0.08)) - 0.03;
          float head = length(p - vec2(0.05, 0.38)) - 0.095;
          // Pointed witch hat + brim
          float brim = sdSegment(p, vec2(-0.18, 0.44), vec2(0.28, 0.48)) - 0.024;
          float hatCone = sdTriangle(p, vec2(-0.08, 0.45), vec2(0.16, 0.47), vec2(-0.14, 0.84)) - 0.015;
          // Little familiar cat sitting at the front of the broom
          float catBody = length((p - vec2(0.50, 0.14)) * vec2(1.0, 0.8)) - 0.075;
          float catHead = length(p - vec2(0.57, 0.24)) - 0.055;
          float d = min(min(broom, bristles), min(min(torso, head), min(min(brim, hatCone), min(catBody, catHead))));

          float alpha = smoothstep(0.015, -0.015, d);
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(vec3(0.05, 0.02, 0.08), alpha);
        }
      `
    });
    this.witchSilhouette = new THREE.Mesh(witchGeo, witchMat);
    this.witchSilhouette.position.set(0, 0.2, 0.5);
    this.witchSilhouette.renderOrder = 3;
    this.moonGroup.add(this.witchSilhouette);

    // Drifting moonlit clouds passing in front of the moon and stars
    const cloudConfigs = [
      { x: -3.5, y: 12.6, z: -53.0, w: 34, h: 7.5, speed: 0.18, seed: 1.1 },
      { x: 6.5, y: 10.2, z: -51.5, w: 30, h: 6.8, speed: -0.14, seed: 3.7 },
      { x: -12.0, y: 15.2, z: -55.0, w: 38, h: 8.2, speed: 0.11, seed: 6.4 },
      { x: 14.0, y: 13.8, z: -49.0, w: 28, h: 6.2, speed: 0.15, seed: 9.2 }
    ];

    cloudConfigs.forEach((cfg) => {
      const cGeo = new THREE.PlaneGeometry(cfg.w, cfg.h);
      const cMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: cfg.seed },
          uSpeed: { value: cfg.speed }
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          uniform float uSeed;
          uniform float uSpeed;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }
          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p = p * 2.03 + vec2(17.1, 31.4);
              a *= 0.5;
            }
            return v;
          }
          void main() {
            vec2 uv = vUv;
            vec2 p = vec2(uv.x * 3.6 + uTime * uSpeed + uSeed, uv.y * 1.8 + uSeed);
            float n = fbm(p);
            float mask = sin(uv.x * 3.14159) * sin(uv.y * 3.14159);
            float density = smoothstep(0.42, 0.78, n * mask * 1.35);
            vec3 darkCloud = vec3(0.09, 0.05, 0.14);
            vec3 silverEdge = vec3(0.86, 0.73, 0.54);
            float rim = smoothstep(0.65, 0.35, density) * smoothstep(0.15, 0.85, uv.y);
            vec3 col = mix(darkCloud, silverEdge, rim * 0.52);
            gl_FragColor = vec4(col, density * 0.62);
          }
        `
      });
      const mesh = new THREE.Mesh(cGeo, cMat);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.cloudMaterials.push(cMat);
    });
  }

  _buildValleyHillsAndVillage() {
    // Layered rolling hill ridges in exponential purple fog
    const hillLayers = [
      { z: -24, yBase: -4.2, width: 95, height: 5.2, color: 0x12091c, seed: 1.2, dipCenter: true },
      { z: -35, yBase: -3.8, width: 120, height: 6.4, color: 0x160c24, seed: 2.7, dipCenter: true },
      { z: -47, yBase: -3.4, width: 150, height: 7.5, color: 0x1c102e, seed: 4.5, dipCenter: true }
    ];

    hillLayers.forEach((layer) => {
      const shape = new THREE.Shape();
      const segs = 64;
      shape.moveTo(-layer.width * 0.5, -18);
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const x = (u - 0.5) * layer.width;
        const valleyDip = layer.dipCenter ? (1.0 - 0.52 * Math.exp(-Math.pow((x - 1.0) / 14.0, 2))) : 1.0;
        const h = (
          Math.sin(u * 9.0 + layer.seed) * 0.45 +
          Math.cos(u * 21.0 - layer.seed * 1.7) * 0.22 +
          0.65
        ) * layer.height * valleyDip;
        shape.lineTo(x, layer.yBase + h);
      }
      shape.lineTo(layer.width * 0.5, -18);
      shape.closePath();

      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshStandardMaterial({
        color: layer.color,
        roughness: 0.96,
        metalness: 0.02
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = layer.z;
      this.scene.add(mesh);
    });

    // Crooked village of tiny lit windows clustered in the valley (z ~ -28 .. -43)
    const villageGroup = new THREE.Group();
    this.scene.add(villageGroup);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x12091d,
      roughness: 0.92
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x0b0512,
      roughness: 0.88
    });

    for (let i = 0; i < 20; i++) {
      const house = new THREE.Group();
      const t = i / 19;
      const z = -27.5 - (i % 5) * 3.6 - Math.sin(i * 2.1) * 1.5;
      const x = -3.5 + t * 12.0 + Math.cos(i * 3.7) * 0.8;
      const valleyHeight = -1.1 + Math.pow((x - 1.2) * 0.065, 2) * 1.8 + (i % 3) * 0.22;

      const w = 0.85 + (i % 3) * 0.24;
      const h = 0.95 + (i % 4) * 0.28;
      const d = 0.85 + (i % 2) * 0.25;

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      body.position.y = h * 0.5;
      house.add(body);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.84, h * 0.88, 4), roofMat);
      roof.position.y = h + h * 0.42;
      roof.rotation.y = Math.PI * 0.25;
      house.add(roof);

      const winMat = new THREE.MeshBasicMaterial({
        color: (i % 3 === 0) ? 0xff9e44 : 0xffd27a,
        fog: false
      });
      const winCount = 1 + (i % 2);
      for (let k = 0; k < winCount; k++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.23), winMat);
        win.position.set((k - (winCount - 1) * 0.5) * 0.28, h * 0.52, d * 0.5 + 0.01);
        house.add(win);
      }

      house.position.set(x, valleyHeight, z);
      house.rotation.z = Math.sin(i * 4.3) * 0.09;
      house.rotation.y = Math.cos(i * 1.9) * 0.24;
      villageGroup.add(house);
      this.villageWindows.push({ mat: winMat, phase: i * 1.37 });
    }

    // Flock of bats circling high over the valley
    const batMat = new THREE.MeshBasicMaterial({
      color: 0x09040f,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < 18; i++) {
      const bat = new THREE.Group();
      const leftWing = new THREE.Mesh(
        new THREE.PlaneGeometry(0.26, 0.11),
        batMat
      );
      leftWing.position.x = -0.12;
      const rightWing = new THREE.Mesh(
        new THREE.PlaneGeometry(0.26, 0.11),
        batMat
      );
      rightWing.position.x = 0.12;
      bat.add(leftWing, rightWing);

      this.scene.add(bat);
      this.batFlock.push({
        group: bat,
        leftWing,
        rightWing,
        centerX: 0.4 + Math.sin(i * 2.3) * 3.5,
        centerY: 2.6 + (i % 5) * 0.45,
        centerZ: -22.0 - (i % 4) * 2.5,
        radiusX: 3.2 + (i % 3) * 1.6,
        radiusZ: 1.8 + (i % 2) * 1.1,
        speed: 0.55 + (i % 5) * 0.12,
        phase: i * 0.85
      });
    }
  }

  _buildPorchDeckAndForegroundProps() {
    this.porchGroup = new THREE.Group();
    this.scene.add(this.porchGroup);

    const { map: woodMap, bumpMap: woodBump } = createWoodPlankTextures();
    const plankCount = 22;
    const deckWidth = 12.8;
    const plankDepth = 0.42;
    const plankGap = 0.022;
    const plankThickness = 0.11;
    const totalDepth = plankCount * (plankDepth + plankGap);
    const startZ = -5.1;

    // Dark under-deck subfloor so inter-plank gaps read as deep shadow seams
    const subFloor = new THREE.Mesh(
      new THREE.BoxGeometry(deckWidth + 0.3, 0.16, totalDepth + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x090508, roughness: 0.98 })
    );
    subFloor.position.set(0, -0.10, startZ + totalDepth * 0.5);
    this.porchGroup.add(subFloor);

    const plankGeo = new THREE.BoxGeometry(deckWidth, plankThickness, plankDepth);
    for (let i = 0; i < plankCount; i++) {
      const z = startZ + (i + 0.5) * (plankDepth + plankGap);
      const isUnderCatZone = Math.abs(z) < 2.2;
      const shade = 0.86 + 0.24 * Math.sin(i * 2.7 + 0.5);
      const pMat = new THREE.MeshStandardMaterial({
        map: woodMap,
        bumpMap: woodBump,
        bumpScale: 0.018,
        color: new THREE.Color().setRGB(0.68 * shade, 0.52 * shade, 0.44 * shade),
        roughness: 0.82 - (i % 3) * 0.04,
        metalness: 0.04
      });

      const plank = new THREE.Mesh(plankGeo, pMat);
      // Keep top surface at exact y = 0.0 under the clearing so WebGPU ground shadow catcher aligns cleanly
      const yOffset = isUnderCatZone ? 0.0 : Math.sin(i * 3.1) * 0.004;
      plank.position.set(
        Math.sin(i * 1.9) * 0.05,
        -plankThickness * 0.5 + yOffset,
        z
      );
      plank.receiveShadow = true;
      this.porchGroup.add(plank);
    }

    // Front porch steps leading down to the yard (x in [-1.8, 2.2], z > 4.4)
    const stepMat = new THREE.MeshStandardMaterial({
      map: woodMap,
      bumpMap: woodBump,
      bumpScale: 0.02,
      color: 0x6b4f3d,
      roughness: 0.86
    });
    for (let s = 1; s <= 3; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.14, 0.46),
        stepMat
      );
      step.position.set(0.2, -s * 0.22, startZ + totalDepth + s * 0.44);
      step.receiveShadow = true;
      this.porchGroup.add(step);
    }

    // Woven straw/coir doormat right under/behind the cat (y = 0.004)
    const { map: matMap, bumpMap: matBump } = createDoormatTextures();
    const doormatGeo = new THREE.BoxGeometry(2.55, 0.008, 1.68);
    const doormatMat = new THREE.MeshStandardMaterial({
      map: matMap,
      bumpMap: matBump,
      bumpScale: 0.025,
      roughness: 0.94,
      metalness: 0.0
    });
    const doormat = new THREE.Mesh(doormatGeo, doormatMat);
    doormat.position.set(0, 0.002, -0.15);
    doormat.receiveShadow = true;
    this.porchGroup.add(doormat);

    // Glazed ceramic saucer of milk near the edge of the clearing (low profile y <= 0.075)
    const saucerGroup = new THREE.Group();
    saucerGroup.position.set(0.78, 0.0, 0.42);
    const saucerPts = [
      new THREE.Vector2(0.0, 0.002),
      new THREE.Vector2(0.22, 0.002),
      new THREE.Vector2(0.33, 0.068),
      new THREE.Vector2(0.30, 0.075),
      new THREE.Vector2(0.20, 0.018),
      new THREE.Vector2(0.0, 0.018)
    ];
    const saucerGeo = new THREE.LatheGeometry(saucerPts, 32);
    const saucerMat = new THREE.MeshStandardMaterial({
      color: 0xd9d2c5,
      roughness: 0.22,
      metalness: 0.05
    });
    const saucerMesh = new THREE.Mesh(saucerGeo, saucerMat);
    saucerMesh.castShadow = true;
    saucerMesh.receiveShadow = true;
    saucerGroup.add(saucerMesh);

    const milkGeo = new THREE.CircleGeometry(0.265, 32);
    milkGeo.rotateX(-Math.PI * 0.5);
    const milkMat = new THREE.MeshStandardMaterial({
      color: 0xfff8eb,
      emissive: 0x261d14,
      roughness: 0.08,
      metalness: 0.02
    });
    const milkMesh = new THREE.Mesh(milkGeo, milkMat);
    milkMesh.position.y = 0.048;
    saucerGroup.add(milkMesh);
    this.porchGroup.add(saucerGroup);

    // Fat carved jack-o'-lantern + two small uncarved pumpkins (kept outside r > 4.2 at right-rear porch)
    this._buildPorchPumpkins();

    // Stack of 3 leather-bound spell books with gold-foil spine bands (left-rear porch, r > 4.2)
    this._buildSpellBooks();

    // Bubbling cast-iron cauldron with green potion & rising bubbles (left-rear porch, r > 4.4)
    this._buildCauldron();

    // Witch's crooked broom leaning against the porch railing (r > 5.0)
    this._buildWitchBroom();

    // Blowing autumn leaves across the porch boards
    this._buildAutumnLeaves();
  }

  _buildPorchPumpkins() {
    const pumpkinGroup = new THREE.Group();
    // Position at (3.32, 0, -2.78) -> radius r = 4.33 > 4.2
    pumpkinGroup.position.set(1.32, 0.0, -1.52);
    pumpkinGroup.rotation.y = -0.45;
    this.porchGroup.add(pumpkinGroup);

    const orangeBodyMat = new THREE.MeshStandardMaterial({
      color: 0xd95614,
      roughness: 0.58,
      metalness: 0.04
    });
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x3b2d1b,
      roughness: 0.88
    });

    // Main fat jack-o'-lantern
    const bigGeo = createRibbedPumpkinGeometry(0.62, 0.88, 16);
    const bigPumpkin = new THREE.Mesh(bigGeo, orangeBodyMat);
    bigPumpkin.position.y = 0.42;
    bigPumpkin.castShadow = true;
    bigPumpkin.receiveShadow = true;
    pumpkinGroup.add(bigPumpkin);

    // Twisted stem
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.80, 0),
      new THREE.Vector3(0.05, 0.96, 0.03),
      new THREE.Vector3(0.14, 1.07, -0.05)
    ]);
    const stemMesh = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 12, 0.065, 8, false),
      stemMat
    );
    pumpkinGroup.add(stemMesh);

    // Glowing carved triangle eyes, nose, and toothy grin positioned on the front hemisphere
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffa834,
      fog: false
    });
    this.jackFaceMat = glowMat;

    const makeTri = (w, h) => {
      const s = new THREE.Shape();
      s.moveTo(-w * 0.5, -h * 0.45);
      s.lineTo(w * 0.5, -h * 0.45);
      s.lineTo(0, h * 0.55);
      s.closePath();
      return new THREE.ShapeGeometry(s);
    };

    const leftEye = new THREE.Mesh(makeTri(0.22, 0.20), glowMat);
    leftEye.position.set(-0.20, 0.54, 0.58);
    leftEye.rotation.y = -0.28;
    leftEye.rotation.x = -0.16;
    pumpkinGroup.add(leftEye);

    const rightEye = new THREE.Mesh(makeTri(0.22, 0.20), glowMat);
    rightEye.position.set(0.20, 0.54, 0.58);
    rightEye.rotation.y = 0.28;
    rightEye.rotation.x = -0.16;
    pumpkinGroup.add(rightEye);

    const nose = new THREE.Mesh(makeTri(0.14, 0.13), glowMat);
    nose.position.set(0.0, 0.41, 0.62);
    pumpkinGroup.add(nose);

    // Carved toothy grin shape
    const grinShape = new THREE.Shape();
    grinShape.moveTo(-0.34, 0.08);
    grinShape.lineTo(-0.18, 0.0);
    grinShape.lineTo(-0.14, 0.07);
    grinShape.lineTo(-0.04, 0.01);
    grinShape.lineTo(0.06, 0.01);
    grinShape.lineTo(0.14, 0.07);
    grinShape.lineTo(0.18, 0.0);
    grinShape.lineTo(0.34, 0.08);
    grinShape.lineTo(0.25, -0.11);
    grinShape.lineTo(0.08, -0.14);
    grinShape.lineTo(0.05, -0.05);
    grinShape.lineTo(-0.05, -0.05);
    grinShape.lineTo(-0.08, -0.14);
    grinShape.lineTo(-0.25, -0.11);
    grinShape.closePath();
    const grinMesh = new THREE.Mesh(new THREE.ShapeGeometry(grinShape), glowMat);
    grinMesh.position.set(0, 0.25, 0.60);
    grinMesh.rotation.x = 0.14;
    pumpkinGroup.add(grinMesh);

    // Two small uncarved pumpkins beside the jack-o'-lantern
    const smallSpecs = [
      { x: -0.78, z: -0.28, r: 0.34, h: 0.46, color: 0xe06a1b },
      { x: 0.68, z: 0.22, r: 0.28, h: 0.40, color: 0xc84a12 }
    ];
    smallSpecs.forEach((sp) => {
      const pMesh = new THREE.Mesh(
        createRibbedPumpkinGeometry(sp.r, sp.h, 12),
        new THREE.MeshStandardMaterial({ color: sp.color, roughness: 0.62 })
      );
      pMesh.position.set(sp.x, sp.h * 0.48, sp.z);
      pMesh.castShadow = true;
      pMesh.receiveShadow = true;
      pumpkinGroup.add(pMesh);

      const sStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.045, 0.14, 7),
        stemMat
      );
      sStem.position.set(sp.x + 0.02, sp.h * 0.95, sp.z);
      sStem.rotation.z = -0.22;
      pumpkinGroup.add(sStem);
    });
  }

  _buildSpellBooks() {
    // Placed at (-2.75, 0, -3.35) -> r = 4.33 > 4.2
    const stackGroup = new THREE.Group();
    stackGroup.position.set(-0.92, 0.0, -1.18);
    this.porchGroup.add(stackGroup);

    const books = [
      { w: 0.68, h: 0.14, d: 0.52, color: 0x3b1322, yaw: 0.28 },
      { w: 0.62, h: 0.13, d: 0.46, color: 0x182b24, yaw: -0.18 },
      { w: 0.54, h: 0.12, d: 0.42, color: 0x29183b, yaw: 0.42 }
    ];

    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xd6c39c,
      roughness: 0.85
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xe3b448,
      roughness: 0.32,
      metalness: 0.85,
      emissive: 0x3a2606
    });

    let curY = 0;
    books.forEach((b) => {
      const bGroup = new THREE.Group();
      bGroup.position.y = curY + b.h * 0.5;
      bGroup.rotation.y = b.yaw;

      const leatherMat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.72,
        metalness: 0.08
      });

      const cover = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), leatherMat);
      cover.castShadow = true;
      cover.receiveShadow = true;
      bGroup.add(cover);

      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(b.w * 0.94, b.h * 0.76, b.d * 0.93),
        pageMat
      );
      pages.position.set(0.02, 0, 0.01);
      bGroup.add(pages);

      // Gold-foil spine bands along the front-facing spine (-z / +z)
      for (let s = -1; s <= 1; s++) {
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, b.h * 1.03, b.d * 1.02),
          goldMat
        );
        band.position.set(s * (b.w * 0.28), 0, 0);
        bGroup.add(band);
      }

      stackGroup.add(bGroup);
      curY += b.h;
    });
  }

  _buildCauldron() {
    // Placed at (-3.65, 0, -2.65) -> r = 4.51 > 4.2
    const cauldronGroup = new THREE.Group();
    cauldronGroup.position.set(-1.38, 0.0, -1.68);
    this.porchGroup.add(cauldronGroup);

    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x1b1921,
      roughness: 0.62,
      metalness: 0.68
    });

    const lathePts = [
      new THREE.Vector2(0.0, 0.08),
      new THREE.Vector2(0.38, 0.10),
      new THREE.Vector2(0.56, 0.34),
      new THREE.Vector2(0.58, 0.58),
      new THREE.Vector2(0.47, 0.76),
      new THREE.Vector2(0.55, 0.86),
      new THREE.Vector2(0.49, 0.88),
      new THREE.Vector2(0.43, 0.74)
    ];
    const potMesh = new THREE.Mesh(new THREE.LatheGeometry(lathePts, 32), ironMat);
    potMesh.castShadow = true;
    potMesh.receiveShadow = true;
    cauldronGroup.add(potMesh);

    // Three iron feet + two side ring handles
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.14, 8), ironMat);
      foot.position.set(Math.cos(a) * 0.34, 0.06, Math.sin(a) * 0.34);
      cauldronGroup.add(foot);
    }
    for (let s of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 18), ironMat);
      handle.position.set(s * 0.56, 0.56, 0);
      handle.rotation.y = Math.PI * 0.5;
      handle.rotation.x = s * 0.35;
      cauldronGroup.add(handle);
    }

    // Glowing green potion surface (#4eff7a)
    const potionGeo = new THREE.CircleGeometry(0.45, 32);
    potionGeo.rotateX(-Math.PI * 0.5);
    this.potionMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          float r = length(vUv);
          float a = atan(vUv.y, vUv.x);
          float swirl = sin(r * 14.0 - uTime * 3.2 + a * 2.0) * 0.5 + 0.5;
          vec3 core = vec3(0.306, 1.0, 0.478); // #4eff7a
          vec3 deep = vec3(0.08, 0.52, 0.24);
          vec3 col = mix(deep, core, swirl * 0.65 + (1.0 - r) * 0.45);
          gl_FragColor = vec4(col * 1.45, 1.0);
        }
      `
    });
    const potionMesh = new THREE.Mesh(potionGeo, this.potionMat);
    potionMesh.position.y = 0.76;
    cauldronGroup.add(potionMesh);

    // Rising procedural green bubble spheres that pop and respawn
    const bubbleGeo = new THREE.SphereGeometry(0.045, 12, 10);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x6bff95,
      emissive: 0x35d462,
      emissiveIntensity: 1.35,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85
    });

    for (let i = 0; i < 16; i++) {
      const bMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
      const angle = (i / 16) * Math.PI * 2 + (i % 3) * 0.4;
      const rad = 0.06 + (i % 5) * 0.068;
      cauldronGroup.add(bMesh);
      this.cauldronBubbles.push({
        mesh: bMesh,
        baseX: Math.cos(angle) * rad,
        baseZ: Math.sin(angle) * rad,
        speed: 0.45 + (i % 4) * 0.14,
        phase: i * 0.42,
        scaleBase: 0.55 + (i % 3) * 0.32
      });
    }
  }

  _buildWitchBroom() {
    // Leaning against the back-left porch railing post at (-4.35, 0, -3.55), r = 5.61 > 4.2
    const broomGroup = new THREE.Group();
    broomGroup.position.set(-1.88, 0.0, -2.25);
    broomGroup.rotation.z = -0.26;
    broomGroup.rotation.x = 0.18;
    this.porchGroup.add(broomGroup);

    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.45, 0),
      new THREE.Vector3(0.05, 1.15, -0.03),
      new THREE.Vector3(-0.04, 1.85, 0.04),
      new THREE.Vector3(0.06, 2.55, -0.02)
    ]);
    const handleMesh = new THREE.Mesh(
      new THREE.TubeGeometry(handleCurve, 20, 0.036, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 0.84 })
    );
    handleMesh.castShadow = true;
    broomGroup.add(handleMesh);

    const bristleMat = new THREE.MeshStandardMaterial({
      color: 0x7a572d,
      roughness: 0.94
    });
    const bristleCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.72, 14, 1, false),
      bristleMat
    );
    bristleCone.position.set(0, 0.36, 0);
    bristleCone.rotation.x = Math.PI;
    broomGroup.add(bristleCone);

    const twine = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.022, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xbfa06a, roughness: 0.88 })
    );
    twine.position.y = 0.52;
    twine.rotation.x = Math.PI * 0.5;
    broomGroup.add(twine);
  }

  _buildAutumnLeaves() {
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, -0.06);
    leafShape.lineTo(0.05, -0.02);
    leafShape.lineTo(0.08, 0.02);
    leafShape.lineTo(0.03, 0.04);
    leafShape.lineTo(0.0, 0.09);
    leafShape.lineTo(-0.03, 0.04);
    leafShape.lineTo(-0.08, 0.02);
    leafShape.lineTo(-0.05, -0.02);
    leafShape.closePath();

    const leafGeo = new THREE.ShapeGeometry(leafShape);
    leafGeo.rotateX(-Math.PI * 0.5);
    const leafColors = [0xc94a1a, 0xd9821e, 0x9e2a1b, 0xe0a82e];

    this.blowingLeaves = [];
    for (let i = 0; i < 34; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: leafColors[i % leafColors.length],
        roughness: 0.78,
        side: THREE.DoubleSide
      });
      const leaf = new THREE.Mesh(leafGeo, mat);
      const scale = 0.75 + (i % 4) * 0.25;
      leaf.scale.setScalar(scale);
      this.porchGroup.add(leaf);

      this.blowingLeaves.push({
        mesh: leaf,
        x: -5.5 + (i / 34) * 11.0,
        z: -4.4 + ((i * 1.73) % 8.2),
        speed: 0.55 + (i % 5) * 0.22,
        phase: i * 0.91
      });
    }
  }

  _buildCottageMidgroundAndRafters() {
    this.cottageGroup = new THREE.Group();
    this.scene.add(this.cottageGroup);

    const timberMat = new THREE.MeshStandardMaterial({
      color: 0x261710,
      roughness: 0.88
    });
    const plasterMat = new THREE.MeshStandardMaterial({
      color: 0x2b2033,
      roughness: 0.92
    });
    const shingleMat = new THREE.MeshStandardMaterial({
      color: 0x160f21,
      roughness: 0.86
    });

    // Porch perimeter posts and crooked railings (all posts strictly outside r > 4.6)
    const postCoords = [
      [-5.6, -4.5],
      [-2.4, -4.5],
      [2.6, -4.5],
      [5.6, -4.5],
      [-5.6, 0.2],
      [5.6, 0.2]
    ];
    postCoords.forEach(([px, pz], idx) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.5, 0.24), timberMat);
      post.position.set(px, 2.25, pz);
      post.rotation.z = Math.sin(idx * 2.1) * 0.03;
      post.castShadow = true;
      this.cottageGroup.add(post);
    });

    // Overhead porch rafters & eaves (y = 4.45 .. 4.9)
    const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.24, 0.24), timberMat);
    frontBeam.position.set(0, 3.25, -3.8);
    this.cottageGroup.add(frontBeam);

    for (let i = 0; i < 6; i++) {
      const rx = -5.5 + i * 2.2;
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 4.9), timberMat);
      rafter.position.set(rx, 3.30, -2.15);
      rafter.rotation.x = 0.06;
      this.cottageGroup.add(rafter);
    }

    // Porch back railings (leaving center-right step opening)
    const railSegments = [
      { x1: 2.6, z1: -4.5, x2: 5.6, z2: -4.5 },
      { x1: 5.6, z1: -4.5, x2: 5.6, z2: 0.2 },
      { x1: -5.6, z1: -4.5, x2: -5.6, z2: 0.2 }
    ];
    railSegments.forEach((seg) => {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      const segGroup = new THREE.Group();
      segGroup.position.set((seg.x1 + seg.x2) * 0.5, 0, (seg.z1 + seg.z2) * 0.5);
      segGroup.rotation.y = angle;

      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, len), timberMat);
      topRail.position.y = 0.96;
      const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, len), timberMat);
      botRail.position.y = 0.18;
      segGroup.add(topRail, botRail);

      const balusterCount = Math.floor(len / 0.34);
      for (let b = 0; b < balusterCount; b++) {
        const bz = -len * 0.45 + (b / Math.max(1, balusterCount - 1)) * (len * 0.9);
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.78, 0.065), timberMat);
        bal.position.set(0, 0.56, bz);
        bal.rotation.x = Math.sin(b * 3.1) * 0.06;
        segGroup.add(bal);
      }
      this.cottageGroup.add(segGroup);
    });

    // Crooked witch's cottage wall on the left wing (x in [-6.4, -2.2], z = -4.9) so valley & harvest moon stay unobstructed at center-right
    const cottageWing = new THREE.Group();
    cottageWing.position.set(-1.85, 0, -4.55);
    cottageWing.rotation.y = 0.12;
    this.cottageGroup.add(cottageWing);

    const mainWall = new THREE.Mesh(new THREE.BoxGeometry(4.4, 5.2, 0.45), plasterMat);
    mainWall.position.set(0, 2.6, 0);
    mainWall.receiveShadow = true;
    cottageWing.add(mainWall);

    // Crooked timber framing beams across the cottage facade
    const beamSpecs = [
      { x: -2.15, y: 2.6, w: 0.18, h: 5.2, rot: 0.02 },
      { x: 2.15, y: 2.6, w: 0.18, h: 5.2, rot: -0.03 },
      { x: 0.0, y: 2.6, w: 0.16, h: 5.2, rot: 0.015 },
      { x: 0.0, y: 4.3, w: 4.5, h: 0.18, rot: -0.02 },
      { x: -1.1, y: 1.9, w: 2.1, h: 0.14, rot: 0.24 }
    ];
    beamSpecs.forEach((bs) => {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(bs.w, bs.h, 0.52), timberMat);
      bm.position.set(bs.x, bs.y, 0.02);
      bm.rotation.z = bs.rot;
      cottageWing.add(bm);
    });

    // Steep shingled gable roof eaves
    const gableRoof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.8, 4), shingleMat);
    gableRoof.position.set(0, 6.3, 0.15);
    gableRoof.rotation.y = Math.PI * 0.25;
    cottageWing.add(gableRoof);

    // Wooden cottage door with a tiny cat-flap at the bottom (right half of cottage facade)
    const doorGroup = new THREE.Group();
    doorGroup.position.set(1.05, 0.0, 0.24);
    cottageWing.add(doorGroup);

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x3b2314,
      roughness: 0.84
    });
    const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(1.18, 2.35, 0.09), doorMat);
    doorSlab.position.y = 1.175;
    doorGroup.add(doorSlab);

    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.34, 2.48, 0.14), timberMat);
    doorFrame.position.set(0, 1.24, -0.02);
    doorGroup.add(doorFrame);

    // Tiny cat-flap at bottom of the cottage door
    const catFlapFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.46, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x1e120a, roughness: 0.78 })
    );
    catFlapFrame.position.set(0, 0.34, 0.01);
    doorGroup.add(catFlapFrame);

    this.catFlapDoor = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.36, 0.04),
      new THREE.MeshStandardMaterial({
        color: 0x6e472b,
        emissive: 0x291506,
        roughness: 0.65
      })
    );
    this.catFlapDoor.position.set(0, 0.34, 0.06);
    this.catFlapDoor.rotation.x = -0.18;
    doorGroup.add(this.catFlapDoor);

    // Round mullioned window glowing warm orange (#ff9e44), warms up when catState.isPurring is true
    const windowGroup = new THREE.Group();
    windowGroup.position.set(0.15, 2.15, 0.25);
    cottageWing.add(windowGroup);

    this.cottageWindowMat = new THREE.MeshStandardMaterial({
      color: 0xff9e44,
      emissive: 0xff8c24,
      emissiveIntensity: 1.55,
      roughness: 0.25
    });
    const winGlass = new THREE.Mesh(new THREE.CircleGeometry(0.68, 32), this.cottageWindowMat);
    windowGroup.add(winGlass);

    const winRim = new THREE.Mesh(new THREE.TorusGeometry(0.70, 0.075, 12, 32), timberMat);
    windowGroup.add(winRim);

    // Mullion crossbars + inner ring
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.03, 8, 24), timberMat);
    innerRing.position.z = 0.02;
    windowGroup.add(innerRing);

    for (let a = 0; a < 4; a++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.045, 0.05), timberMat);
      spoke.rotation.z = (a * Math.PI) / 4;
      spoke.position.z = 0.02;
      windowGroup.add(spoke);
    }

    // Hanging lanterns suspended from porch eaves that sway in the wind (and wildly during Arch & hiss)
    const lanternPositions = [
      { x: -1.15, y: 3.18, z: -2.8, phase: 0.2 },
      { x: 1.25, y: 3.18, z: -2.8, phase: 1.9 },
      { x: -0.05, y: 3.22, z: -3.2, phase: 3.4 }
    ];
    lanternPositions.forEach((lp) => {
      const pivot = new THREE.Group();
      pivot.position.set(lp.x, lp.y, lp.z);
      this.cottageGroup.add(pivot);

      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.65, 6),
        new THREE.MeshStandardMaterial({ color: 0x1c1824, metalness: 0.8, roughness: 0.4 })
      );
      chain.position.y = -0.32;
      pivot.add(chain);

      const body = new THREE.Group();
      body.position.y = -0.74;
      pivot.add(body);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.18, 6),
        new THREE.MeshStandardMaterial({ color: 0x18141f, metalness: 0.75, roughness: 0.45 })
      );
      cap.position.y = 0.16;
      body.add(cap);

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xffb35c,
        emissive: 0xff8c2b,
        emissiveIntensity: 1.75,
        roughness: 0.2
      });
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.10, 0.26, 6), coreMat);
      body.add(core);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.08, 0.08, 6),
        new THREE.MeshStandardMaterial({ color: 0x18141f, metalness: 0.75, roughness: 0.45 })
      );
      base.position.y = -0.16;
      body.add(base);

      this.hangingLanterns.push({
        pivot,
        coreMat,
        phase: lp.phase
      });
    });

    // Strings of little glowing candles draped along the porch rafters
    const candleCount = 14;
    const waxMat = new THREE.MeshStandardMaterial({
      color: 0xf2e3c6,
      roughness: 0.65
    });
    const waxGeo = new THREE.CylinderGeometry(0.032, 0.035, 0.22, 8);
    const flameGeo = new THREE.ConeGeometry(0.028, 0.095, 8);

    for (let i = 0; i < candleCount; i++) {
      const u = i / (candleCount - 1);
      const cx = -2.4 + u * 4.8;
      const sag = Math.sin(u * Math.PI) * 0.24 + Math.sin(u * Math.PI * 3.0) * 0.06;
      const cy = 3.05 - sag;
      const cz = -3.1 + Math.cos(u * Math.PI * 2.0) * 0.18;

      const cGroup = new THREE.Group();
      cGroup.position.set(cx, cy, cz);
      this.cottageGroup.add(cGroup);

      const wax = new THREE.Mesh(waxGeo, waxMat);
      cGroup.add(wax);

      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xffbe55,
        fog: false
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 0.15;
      cGroup.add(flame);

      this.rafterCandles.push({
        group: cGroup,
        flame,
        flameMat,
        baseY: cy,
        phase: i * 1.13
      });
    }

    // Cobwebs in the corners: procedural radial/spiral web shader on transparent planes
    this._buildCornerCobwebs();
  }

  _buildCornerCobwebs() {
    const webMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          vec2 p = vUv;
          float r = length(p);
          if (r > 1.0 || r < 0.04) discard;
          float a = atan(p.y, p.x);

          float spokes = abs(sin(a * 9.0));
          float spokeLine = smoothstep(0.045, 0.0, spokes * r);

          float sag = sin(a * 18.0) * 0.018;
          float rings = abs(fract((r + sag) * 7.5) - 0.5);
          float ringLine = smoothstep(0.06, 0.0, rings);

          float web = max(spokeLine, ringLine) * smoothstep(1.0, 0.25, r);
          vec3 silk = vec3(0.82, 0.78, 0.92);
          gl_FragColor = vec4(silk, web * 0.48);
        }
      `
    });
    this.cobwebMat = webMat;

    const corners = [
      { x: -5.1, y: 4.05, z: -4.42, rotZ: 0.2, scale: 1.25 },
      { x: -2.0, y: 4.08, z: -4.42, rotZ: -0.3, scale: 1.05 },
      { x: 2.95, y: 4.08, z: -4.42, rotZ: 0.15, scale: 1.1 },
      { x: 5.15, y: 4.05, z: -4.42, rotZ: -0.25, scale: 1.25 }
    ];
    corners.forEach((c) => {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(c.scale, c.scale), webMat);
      plane.position.set(c.x, c.y, c.z);
      plane.rotation.z = c.rotZ;
      this.cottageGroup.add(plane);
    });
  }

  _buildYardFenceAndTrees() {
    const yardGroup = new THREE.Group();
    this.scene.add(yardGroup);

    // Crooked wooden picket fence beyond the porch steps (z ~ -7.8)
    const fenceMat = new THREE.MeshStandardMaterial({
      color: 0x2a1b15,
      roughness: 0.92
    });
    const picketCount = 34;
    for (let i = 0; i < picketCount; i++) {
      const px = -9.5 + i * 0.62;
      if (px > -1.4 && px < 1.8) continue; // Gate gap down to pumpkin patch
      const pz = -7.6 + Math.sin(i * 0.7) * 0.25;
      const py = -0.65;
      const picket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.15, 0.04), fenceMat);
      picket.position.set(px, py + 0.55, pz);
      picket.rotation.z = Math.sin(i * 2.9) * 0.09;
      picket.rotation.x = Math.cos(i * 1.7) * 0.06;
      yardGroup.add(picket);
    }

    // Pumpkin patch nestled beyond the porch (z ~ -8.5 .. -14.5)
    for (let i = 0; i < 14; i++) {
      const px = -5.8 + (i * 1.15) + Math.sin(i * 3.1) * 0.6;
      const pz = -8.4 - (i % 4) * 1.45;
      const pr = 0.28 + (i % 3) * 0.09;
      const ph = pr * 1.35;
      const patchPumpkin = new THREE.Mesh(
        createRibbedPumpkinGeometry(pr, ph, 12),
        new THREE.MeshStandardMaterial({
          color: (i % 2 === 0) ? 0xd45515 : 0xc24610,
          roughness: 0.68
        })
      );
      patchPumpkin.position.set(px, -0.78 + ph * 0.45, pz);
      yardGroup.add(patchPumpkin);
    }

    // Bare twisted trees framing the valley (recursive tapered branches)
    const treeMat = new THREE.MeshStandardMaterial({
      color: 0x130b1c,
      roughness: 0.94
    });

    const addBranch = (parent, len, radBottom, radTop, depth, seed) => {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(radTop, radBottom, len, 7),
        treeMat
      );
      cyl.position.y = len * 0.5;
      parent.add(cyl);

      if (depth <= 0) return;
      const subCount = 2 + (depth % 2);
      for (let i = 0; i < subCount; i++) {
        const pivot = new THREE.Group();
        pivot.position.y = len * (0.72 + i * 0.12);
        const side = (i === 0 ? -1 : 1) * (0.42 + ((seed + i) % 3) * 0.12);
        pivot.rotation.z = side;
        pivot.rotation.x = Math.sin(seed * 2.3 + i * 1.9) * 0.36;
        pivot.rotation.y = i * 1.7;
        parent.add(pivot);
        addBranch(pivot, len * 0.72, radTop, radTop * 0.62, depth - 1, seed + i * 3 + 1);
      }
    };

    const treeSpecs = [
      { x: -8.6, y: -1.1, z: -13.5, len: 3.2, r: 0.34, seed: 2 },
      { x: 7.8, y: -1.0, z: -12.0, len: 3.4, r: 0.36, seed: 5 },
      { x: 11.2, y: -1.4, z: -18.5, len: 3.8, r: 0.40, seed: 9 },
      { x: -11.5, y: -1.5, z: -20.0, len: 3.6, r: 0.38, seed: 14 }
    ];
    treeSpecs.forEach((ts) => {
      const root = new THREE.Group();
      root.position.set(ts.x, ts.y, ts.z);
      yardGroup.add(root);
      addBranch(root, ts.len, ts.r, ts.r * 0.64, 3, ts.seed);
    });
  }

  _buildAtmosphereMistAndFireflies() {
    // Low horizontal ground mist layers with animated FBM noise shader
    const mistLevels = [
      { y: -0.18, z: -6.2, w: 26, d: 14, seed: 1.0 },
      { y: -0.42, z: -10.5, w: 34, d: 18, seed: 2.8 },
      { y: -0.75, z: -16.0, w: 44, d: 22, seed: 5.1 }
    ];

    mistLevels.forEach((ml) => {
      const mistGeo = new THREE.PlaneGeometry(ml.w, ml.d);
      mistGeo.rotateX(-Math.PI * 0.5);
      const mistMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: ml.seed }
        },
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
          uniform float uTime;
          uniform float uSeed;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }
          void main() {
            vec2 p = vUv * vec2(4.5, 3.2) + vec2(uTime * 0.08 + uSeed, -uTime * 0.04);
            float n = noise(p) * 0.6 + noise(p * 2.1 + 4.3) * 0.4;
            float edge = sin(vUv.x * 3.14159) * sin(vUv.y * 3.14159);
            float clearNearCat = smoothstep(2.4, 4.2, length(vWorldPos.xz));
            float alpha = smoothstep(0.32, 0.78, n * edge) * clearNearCat * 0.34;
            vec3 mistCol = vec3(0.28, 0.19, 0.42);
            gl_FragColor = vec4(mistCol, alpha);
          }
        `
      });
      const mistMesh = new THREE.Mesh(mistGeo, mistMat);
      mistMesh.position.set(0, ml.y, ml.z);
      this.scene.add(mistMesh);
      this.mistMaterials.push(mistMat);
    });

    // Drifting ember fireflies (THREE.Points with custom pulsing gold/orange shader)
    const count = 88;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 7) * 0.31;
      const radius = 3.9 + (i % 9) * 1.45;
      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0.25 + (i % 8) * 0.52;
      positions[i * 3 + 2] = -1.5 + Math.sin(angle) * radius - (i % 5) * 1.4;
      phases[i] = i * 0.77;
      scales[i] = 0.7 + (i % 4) * 0.35;
    }

    const fireflyGeo = new THREE.BufferGeometry();
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    fireflyGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    fireflyGeo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    this.fireflyMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: this._lastDpr || 1.0 }
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aScale;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vPulse;
        varying float vTint;

        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.75 + aPhase) * 0.38;
          p.y += cos(uTime * 0.95 + aPhase * 1.3) * 0.26;
          p.z += sin(uTime * 0.62 + aPhase * 0.7) * 0.32;

          vPulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.6 + aPhase * 3.1), 2.0);
          vTint = fract(aPhase * 0.37);

          vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = clamp((28.0 * aScale * uPixelRatio) / max(1.0, -mvPos.z), 3.0, 26.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vPulse;
        varying float vTint;
        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float r = length(uv);
          if (r > 1.0) discard;
          float glow = exp(-r * 3.2) * vPulse;
          vec3 gold = vec3(1.0, 0.76, 0.32);
          vec3 ember = vec3(1.0, 0.48, 0.14);
          vec3 col = mix(gold, ember, vTint);
          gl_FragColor = vec4(col * 1.5, glow);
        }
      `
    });

    const fireflyPoints = new THREE.Points(fireflyGeo, this.fireflyMat);
    this.scene.add(fireflyPoints);
  }

  render(time, dt, catState = {}) {
    const safeDt = (typeof dt === 'number' && Number.isFinite(dt) && dt > 0)
      ? (dt > 1.0 ? dt * 0.001 : Math.min(dt, 0.1))
      : 1 / 60;
    this.elapsedTime += safeDt;

    const t = (typeof time === 'number' && Number.isFinite(time))
      ? (time > 5000 ? time * 0.001 : time)
      : this.elapsedTime;

    const isArching = Boolean(catState?.isArching);
    const isPurring = Boolean(catState?.isPurring);
    const isProwling = Boolean(catState?.isProwling);

    this.archResponse += ((isArching ? 1.0 : 0.0) - this.archResponse) * Math.min(1.0, safeDt * 6.0);
    this.purrResponse += ((isPurring ? 1.0 : 0.0) - this.purrResponse) * Math.min(1.0, safeDt * 4.5);
    this.prowlResponse += ((isProwling ? 1.0 : 0.0) - this.prowlResponse) * Math.min(1.0, safeDt * 4.5);

    // Update warm rim point light following the plush cat's center of mass
    const com = readVec3(catState?.com, [0, 0.9, 0]);
    this.catLight.position.set(com[0], com[1] + 0.8, com[2] + 0.6);
    this.catLight.intensity = 1.35 + this.purrResponse * 0.45;

    // Flickering carved pumpkin point light + face glow
    const flicker = 0.88 + 0.14 * Math.sin(t * 11.3) + 0.09 * Math.cos(t * 23.7);
    this.pumpkinLight.intensity = (3.3 + this.archResponse * 0.9) * flicker;
    if (this.jackFaceMat) {
      this.jackFaceMat.color.setRGB(1.0 * flicker, 0.64 * flicker, 0.20 * flicker);
    }

    // Round mullioned cottage window warms up when catState.isPurring is true
    if (this.cottageWindowMat) {
      const warmPulse = 1.55 + this.purrResponse * 1.15 + 0.12 * Math.sin(t * 3.2);
      this.cottageWindowMat.emissiveIntensity = warmPulse;
      this.windowLight.intensity = 2.1 + this.purrResponse * 1.4;
    }

    // Cauldron potion swirl & rising/popping green bubbles
    if (this.potionMat) {
      this.potionMat.uniforms.uTime.value = t;
    }
    this.cauldronLight.intensity = 2.4 + 0.35 * Math.sin(t * 4.7);
    for (let i = 0; i < this.cauldronBubbles.length; i++) {
      const b = this.cauldronBubbles[i];
      const cycle = (t * b.speed + b.phase) % 1.0;
      const height = 0.77 + cycle * 0.62;
      const popScale = cycle < 0.86
        ? b.scaleBase * (0.6 + cycle * 0.7)
        : b.scaleBase * Math.max(0.01, (1.0 - cycle) * 7.0);
      b.mesh.position.set(
        b.baseX + Math.sin(t * 3.0 + b.phase) * 0.03,
        height,
        b.baseZ + Math.cos(t * 2.6 + b.phase) * 0.03
      );
      b.mesh.scale.setScalar(popScale);
    }

    // Hanging lanterns sway gently in wind and sway wildly during Arch & hiss
    const swayAmp = 0.055 + this.archResponse * 0.28;
    const swayFreq = 1.85 + this.archResponse * 5.2;
    for (let i = 0; i < this.hangingLanterns.length; i++) {
      const l = this.hangingLanterns[i];
      l.pivot.rotation.z = Math.sin(t * swayFreq + l.phase) * swayAmp;
      l.pivot.rotation.x = Math.cos(t * (swayFreq * 0.78) + l.phase) * swayAmp * 0.65;
      l.coreMat.emissiveIntensity = 1.7 + 0.35 * Math.sin(t * (6.0 + this.archResponse * 18.0) + l.phase);
    }

    // Strings of little glowing candles gutter & flicker rapidly during Arch & hiss
    for (let i = 0; i < this.rafterCandles.length; i++) {
      const c = this.rafterCandles[i];
      const gutterFreq = 8.0 + this.archResponse * 26.0;
      const gutter = Math.sin(t * gutterFreq + c.phase) * (0.14 + this.archResponse * 0.42);
      c.flame.scale.set(
        1.0 - gutter * 0.35,
        Math.max(0.35, 1.0 + gutter),
        1.0 - gutter * 0.35
      );
      c.flame.rotation.z = Math.sin(t * (4.5 + this.archResponse * 14.0) + c.phase) * (0.12 + this.archResponse * 0.38);
      c.group.position.y = c.baseY + Math.sin(t * 1.6 + c.phase) * 0.015;
    }

    // Blowing autumn leaves skittering across the porch planks
    const windMult = 1.0 + this.archResponse * 1.8 + this.prowlResponse * 0.6;
    for (let i = 0; i < this.blowingLeaves.length; i++) {
      const lf = this.blowingLeaves[i];
      lf.x += safeDt * lf.speed * windMult;
      if (lf.x > 5.8) lf.x = -5.8;
      const hop = Math.abs(Math.sin(t * 3.4 + lf.phase)) * (0.04 + this.archResponse * 0.14);
      lf.mesh.position.set(
        lf.x,
        0.012 + hop,
        lf.z + Math.sin(t * 1.4 + lf.phase) * 0.18
      );
      lf.mesh.rotation.y = t * 1.2 + lf.phase;
      lf.mesh.rotation.z = Math.sin(t * 4.2 + lf.phase) * 0.32;
    }

    // Distant circling bats with animated flapping wings
    for (let i = 0; i < this.batFlock.length; i++) {
      const b = this.batFlock[i];
      const ang = t * b.speed + b.phase;
      const x = b.centerX + Math.cos(ang) * b.radiusX;
      const z = b.centerZ + Math.sin(ang) * b.radiusZ;
      const y = b.centerY + Math.sin(ang * 2.0) * 0.45;
      b.group.position.set(x, y, z);
      b.group.rotation.y = -ang + Math.PI * 0.5;
      const flap = Math.sin(t * 15.0 + b.phase * 3.0) * 0.68;
      b.leftWing.rotation.z = flap;
      b.rightWing.rotation.z = -flap;
    }

    // Witch-on-a-broom silhouette crossing the harvest moon every ~40s (or when forced)
    if (catState?.forceWitchFlyby) {
      this.triggerWitchFlyby(typeof catState.forceWitchFlyby === 'number' ? catState.forceWitchFlyby : 0.18);
    }
    if (this.witchFlybyState.active) {
      this.witchFlybyState.progress += safeDt / this.witchFlybyState.duration;
      if (this.witchFlybyState.progress >= 1.0) {
        this.witchFlybyState.active = false;
        this.witchFlybyState.cooldown = 40.0;
        this.witchSilhouette.visible = false;
      } else {
        this.witchSilhouette.visible = true;
        const p = this.witchFlybyState.progress;
        this.witchSilhouette.position.set(
          -8.2 + p * 16.4,
          -1.2 + Math.sin(p * Math.PI) * 2.4 + Math.sin(t * 3.2) * 0.18,
          0.5
        );
        this.witchSilhouette.rotation.z = 0.08 * Math.cos(p * Math.PI);
      }
    } else {
      this.witchFlybyState.cooldown -= safeDt;
      if (this.witchFlybyState.cooldown <= 0) {
        this.witchFlybyState.active = true;
        this.witchFlybyState.progress = 0.0;
      }
    }

    // Update sky, clouds, mist, cobwebs, and firefly uniforms
    if (this.skyMat) this.skyMat.uniforms.uTime.value = t;
    if (this.cobwebMat) this.cobwebMat.uniforms.uTime.value = t;
    if (this.fireflyMat) {
      this.fireflyMat.uniforms.uTime.value = t;
      this.fireflyMat.uniforms.uPixelRatio.value = this._lastDpr || 1.0;
    }
    for (let i = 0; i < this.cloudMaterials.length; i++) {
      this.cloudMaterials[i].uniforms.uTime.value = t;
    }
    for (let i = 0; i < this.mistMaterials.length; i++) {
      this.mistMaterials[i].uniforms.uTime.value = t;
    }

    this.composer.render(safeDt);
  }
}