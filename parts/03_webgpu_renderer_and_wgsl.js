// ============================================================================
// Part 3: Native WebGPU Plush Cat Renderer & WGSL Shaders
// Defines class PlushWebGPURenderer (no export keyword for bundle assembly)
// ============================================================================

const PLUSH_COAT_PALETTES = {
  midnight: {
    id: 0,
    root: [0.018, 0.020, 0.042], // Deep blue-black root
    base: [0.031, 0.035, 0.071], // #080912
    tip:  [0.141, 0.173, 0.329], // #242c54 indigo tips
  },
  smoke: {
    id: 1,
    root: [0.055, 0.060, 0.082],
    base: [0.118, 0.125, 0.161], // #1e2029 charcoal grey
    tip:  [0.482, 0.510, 0.600], // #7b8299 silver tips
  },
  tuxedo: {
    id: 2,
    root: [0.020, 0.020, 0.032],
    base: [0.035, 0.035, 0.051], // #09090d rich black
    tip:  [0.140, 0.145, 0.195], // sheen tip (cream bib/paws applied in shader)
  },
};

const QUALITY_PRESETS = [
  { scale: 1.00, shells: 30 },
  { scale: 0.90, shells: 24 },
  { scale: 0.80, shells: 20 },
  { scale: 0.70, shells: 18 },
];

const COMMON_WGSL = /* wgsl */ `
struct FrameUniforms {
  viewProj         : mat4x4f,
  viewMat          : mat4x4f,
  lightViewProj    : mat4x4f,
  heightViewProj   : mat4x4f,
  cameraPosAndTime : vec4f, // xyz = eye, w = time
  lightDirAndPile  : vec4f, // xyz = moon lightDir, w = pileLength
  catComAndShells  : vec4f, // xyz = cat COM, w = shellCount
  coatRootColor    : vec4f, // xyz = root color, w = coatId
  coatBaseColor    : vec4f, // xyz = base color, w = exposure
  coatTipColor     : vec4f, // xyz = tip color, w = isSrgbCanvas
  heightBounds     : vec4f, // x = cx, y = cz, z = invHalfExtent, w = pupilWidth
  camRight         : vec4f, // xyz = camRight, w = blinkSquash
  camUp            : vec4f, // xyz = camUp, w = expressionId
};

fn pcg3d(v_in : vec3u) -> vec3u {
  var v = v_in * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v = v ^ (v >> vec3u(16u));
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}

fn hash33(p : vec3f) -> vec3f {
  let u = vec3u(vec3i(floor(p)) + vec3i(32768));
  let h = pcg3d(u);
  return vec3f(h) * (1.0 / 4294967295.0);
}

fn hash12(p : vec2f) -> f32 {
  let u = vec3u(u32(i32(floor(p.x)) + 65536), u32(i32(floor(p.y)) + 65536), 1099u);
  let h = pcg3d(u);
  return f32(h.x) * (1.0 / 4294967295.0);
}

fn noise3D(p : vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let n000 = hash33(i + vec3f(0.0, 0.0, 0.0)).x;
  let n100 = hash33(i + vec3f(1.0, 0.0, 0.0)).x;
  let n010 = hash33(i + vec3f(0.0, 1.0, 0.0)).x;
  let n110 = hash33(i + vec3f(1.0, 1.0, 0.0)).x;
  let n001 = hash33(i + vec3f(0.0, 0.0, 1.0)).x;
  let n101 = hash33(i + vec3f(1.0, 0.0, 1.0)).x;
  let n011 = hash33(i + vec3f(0.0, 1.0, 1.0)).x;
  let n111 = hash33(i + vec3f(1.0, 1.0, 1.0)).x;
  let nx00 = mix(n000, n100, u.x);
  let nx10 = mix(n010, n110, u.x);
  let nx01 = mix(n001, n101, u.x);
  let nx11 = mix(n011, n111, u.x);
  let nxy0 = mix(nx00, nx10, u.y);
  let nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z);
}

fn sampleNightEnv(dir : vec3f, lightDir : vec3f) -> vec3f {
  let up = clamp(dir.y, -1.0, 1.0);
  // Violet night sky gradient (#3a2452 horizon -> #120920 zenith) with warm porch bounce below
  let skyHoriz = vec3f(0.227, 0.141, 0.322);
  let skyZenith = vec3f(0.055, 0.030, 0.110);
  let groundBounce = vec3f(0.45, 0.20, 0.07);
  var env = select(
    mix(skyHoriz, groundBounce, clamp(-up * 1.6, 0.0, 1.0)),
    mix(skyHoriz, skyZenith, pow(clamp(up, 0.0, 1.0), 0.7)),
    up >= 0.0
  );
  // Cool full moon disc & halo
  let moonDot = dot(dir, lightDir);
  let moonDisc = smoothstep(0.965, 0.985, moonDot) * 3.8 + pow(clamp(moonDot, 0.0, 1.0), 16.0) * 0.75;
  env += vec3f(0.612, 0.722, 1.0) * moonDisc;
  // Warm cottage window / jack-o'-lantern reflection in front-side direction
  let warmDir = normalize(vec3f(0.42, 0.24, 0.87));
  let warmDot = dot(dir, warmDir);
  let windowGlow = smoothstep(0.88, 0.96, warmDot) * 2.5 + pow(clamp(warmDot, 0.0, 1.0), 10.0) * 0.45;
  env += vec3f(1.0, 0.56, 0.22) * windowGlow;
  return env;
}
`;

const SHADOW_AND_HEIGHT_WGSL = /* wgsl */ `
${COMMON_WGSL}

@group(0) @binding(0) var<uniform> frame : FrameUniforms;

struct SkinVertIn {
  @location(0) worldPos  : vec4f,
  @location(1) worldNorm : vec4f,
  @location(2) restPos   : vec4f,
  @location(3) lieDir    : vec4f,
  @location(4) dynTip    : vec4f,
};

@vertex
fn vs_shadow(in : SkinVertIn) -> @builtin(position) vec4f {
  let pos = in.worldPos.xyz + in.worldNorm.xyz * 0.015;
  return frame.lightViewProj * vec4f(pos, 1.0);
}

struct HeightVarying {
  @builtin(position) clipPos : vec4f,
  @location(0) worldY : f32,
};

@vertex
fn vs_height(in : SkinVertIn) -> HeightVarying {
  var out : HeightVarying;
  out.clipPos = frame.heightViewProj * vec4f(in.worldPos.xyz, 1.0);
  out.worldY = max(in.worldPos.y, 0.0);
  return out;
}

@fragment
fn fs_height(in : HeightVarying) -> @location(0) vec4f {
  // Store normalized clearance above y = 0 for top-down contact AO
  let normH = clamp(in.worldY / 1.35, 0.0, 1.0);
  return vec4f(normH, normH, normH, 1.0);
}
`;

const MAIN_SCENE_WGSL = /* wgsl */ `
${COMMON_WGSL}

@group(0) @binding(0) var<uniform> frame : FrameUniforms;
@group(0) @binding(1) var shadowTex : texture_depth_2d;
@group(0) @binding(2) var heightTex : texture_2d<f32>;
@group(0) @binding(3) var linearSampler : sampler;

// PCSS-lite soft shadow lookup using textureLoad (safe in any control flow)
fn samplePCSSShadow(worldPos : vec3f, normalBias : f32, worldNorm : vec3f) -> f32 {
  let biasedPos = worldPos + worldNorm * normalBias;
  let lightClip = frame.lightViewProj * vec4f(biasedPos, 1.0);
  let ndc = lightClip.xyz / max(lightClip.w, 1e-5);
  let uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  if (uv.x <= 0.002 || uv.x >= 0.998 || uv.y <= 0.002 || uv.y >= 0.998 || ndc.z <= 0.0 || ndc.z >= 1.0) {
    return 1.0;
  }

  let dims = vec2f(textureDimensions(shadowTex));
  let centerPx = uv * dims;
  let receiverZ = ndc.z - 0.0022;

  let poisson = array<vec2f, 9>(
    vec2f( 0.00,  0.00),
    vec2f(-0.72, -0.45),
    vec2f( 0.68, -0.52),
    vec2f(-0.55,  0.68),
    vec2f( 0.64,  0.61),
    vec2f(-0.94,  0.12),
    vec2f( 0.92, -0.08),
    vec2f( 0.08, -0.95),
    vec2f(-0.11,  0.94)
  );

  // Step 1: 9-tap blocker search
  var blockerSum = 0.0;
  var blockerCount = 0.0;
  let searchRadius = 6.5;
  for (var i = 0u; i < 9u; i = i + 1u) {
    let sampleCoord = clamp(vec2i(centerPx + poisson[i] * searchRadius), vec2i(0), vec2i(dims) - vec2i(1));
    let depthVal = textureLoad(shadowTex, sampleCoord, 0);
    if (depthVal < receiverZ) {
      blockerSum += depthVal;
      blockerCount += 1.0;
    }
  }

  if (blockerCount < 0.5) {
    return 1.0;
  }

  let avgBlockerZ = blockerSum / blockerCount;
  let penumbraRatio = clamp((receiverZ - avgBlockerZ) / max(avgBlockerZ, 0.08), 0.0, 1.0);
  let filterRadius = mix(1.35, 9.5, penumbraRatio);

  // Step 2: Variable-penumbra 9-tap PCF filter
  var litSum = 0.0;
  for (var j = 0u; j < 9u; j = j + 1u) {
    let sampleCoord = clamp(vec2i(centerPx + poisson[j] * filterRadius), vec2i(0), vec2i(dims) - vec2i(1));
    let depthVal = textureLoad(shadowTex, sampleCoord, 0);
    litSum += select(0.0, 1.0, receiverZ <= depthVal);
  }
  return litSum * (1.0 / 9.0);
}

fn sampleGroundContactAO(worldPos : vec3f) -> f32 {
  let relXZ = (worldPos.xz - frame.heightBounds.xy) * frame.heightBounds.z;
  let uv = vec2f(relXZ.x * 0.5 + 0.5, 0.5 - relXZ.y * 0.5);
  if (uv.x <= 0.01 || uv.x >= 0.99 || uv.y <= 0.01 || uv.y >= 0.99) {
    return 1.0;
  }
  let minClearance = textureSampleLevel(heightTex, linearSampler, uv, 0.0).r * 1.35;
  let heightDiff = max(worldPos.y - minClearance, 0.0);
  let contactFactor = smoothstep(0.0, 0.52, minClearance + heightDiff * 0.45);
  return mix(0.18, 1.0, contactFactor);
}

// ============================================================================
// Subpass 3a: Ground Shadow Catcher (y = 0 disc, premultiplied darkness only)
// ============================================================================
struct GroundOut {
  @builtin(position) clipPos : vec4f,
  @location(0) worldPos : vec3f,
};

@vertex
fn vs_ground(@builtin(vertex_index) vid : u32) -> GroundOut {
  let corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f( 1.0,  1.0),
    vec2f(-1.0, -1.0), vec2f( 1.0,  1.0), vec2f(-1.0,  1.0)
  );
  let c = corners[vid];
  let radius = 2.65;
  let wp = vec3f(
    frame.catComAndShells.x + c.x * radius,
    0.001,
    frame.catComAndShells.z + c.y * radius
  );
  var out : GroundOut;
  out.clipPos = frame.viewProj * vec4f(wp, 1.0);
  out.worldPos = wp;
  return out;
}

@fragment
fn fs_ground(in : GroundOut) -> @location(0) vec4f {
  let offsetXZ = in.worldPos.xz - frame.catComAndShells.xz;
  let radialDist = length(offsetXZ);
  let radialFade = 1.0 - smoothstep(1.15, 2.50, radialDist);
  if (radialFade <= 0.002) {
    discard;
  }
  let shadowLit = samplePCSSShadow(in.worldPos, 0.005, vec3f(0.0, 1.0, 0.0));
  let contactAO = sampleGroundContactAO(in.worldPos);
  // Analytical elliptical soft contact under paws/body
  let bodyEllipse = length(vec2f(offsetXZ.x * 1.15, offsetXZ.y * 0.95));
  let analyticAO = 1.0 - smoothstep(0.15, 0.82, bodyEllipse);
  let shadowDarkness = (1.0 - shadowLit) * 0.58 + (1.0 - contactAO) * 0.52 + analyticAO * 0.36;
  let shadowAlpha = clamp(shadowDarkness * radialFade, 0.0, 0.78);
  // Premultiplied darkness only: RGB = 0, A = shadowAlpha
  return vec4f(0.0, 0.0, 0.0, shadowAlpha);
}

// ============================================================================
// Subpass 3c, 3d, 3e: Felt Ears, Fur Base Layer, and Instanced Fur Shells
// ============================================================================
struct SkinVertIn {
  @location(0) worldPos  : vec4f, // xyz = pos, w = seamWeight (or isInnerPink on ears)
  @location(1) worldNorm : vec4f, // xyz = norm, w = regionCode (or edgeStitch on ears)
  @location(2) restPos   : vec4f, // xyz = restPos (or ear UV), w = isTail
  @location(3) lieDir    : vec4f, // xyz = lieDir, w = regionAux
  @location(4) dynTip    : vec4f, // xyz = dynTipOffset, w = seamWeightAux
};

struct FurVarying {
  @builtin(position) clipPos : vec4f,
  @location(0) worldPos  : vec3f,
  @location(1) worldNorm : vec3f,
  @location(2) restPos   : vec3f,
  @location(3) lieDir    : vec3f,
  @location(4) strandTan : vec3f,
  @location(5) params    : vec4f, // x = shellFrac, y = seamWeight, z = regionCode, w = isTail
};

fn getRegionPileMultiplier(regionCode : f32, restPos : vec3f) -> f32 {
  if (restPos.y > 1.24 && restPos.z > 0.44 && abs(restPos.x) < 0.24) {
    return 0.22;
  }
  if (restPos.y > 1.25 && restPos.z > 0.32) {
    return 0.46;
  }
  if (restPos.y < 0.22) {
    return 0.58;
  }
  return clamp(select(1.0, regionCode, regionCode > 0.1), 0.35, 1.05);
}

fn evaluateCoatPalette(restPos : vec3f, isTail : f32, shellFrac : f32, strandJitter : vec3f) -> vec3f {
  let coatId = i32(round(frame.coatRootColor.w));
  var rootCol = frame.coatRootColor.xyz;
  var baseCol = frame.coatBaseColor.xyz;
  var tipCol  = frame.coatTipColor.xyz;

  // Tuxedo cream bib, four socks/paws, and tail-tip mask in rest space
  if (coatId == 2) {
    let bibWidth = max(0.05, 0.31 * (1.0 - max(restPos.y - 0.58, 0.0) * 0.85));
    let inBib = smoothstep(0.14, 0.24, restPos.z)
              * smoothstep(0.32, 0.44, restPos.y)
              * (1.0 - smoothstep(1.06, 1.18, restPos.y))
              * (1.0 - smoothstep(bibWidth - 0.05, bibWidth + 0.04, abs(restPos.x)));
    let inPaws = (1.0 - smoothstep(0.18, 0.26, restPos.y)) * smoothstep(-0.32, -0.18, restPos.z);
    let inMuzzleChin = smoothstep(0.38, 0.46, restPos.z)
                     * smoothstep(1.16, 1.24, restPos.y)
                     * (1.0 - smoothstep(1.36, 1.44, restPos.y))
                     * (1.0 - smoothstep(0.14, 0.21, abs(restPos.x)));
    let creamMask = clamp(max(max(inBib, inPaws), inMuzzleChin), 0.0, 1.0);
    let creamRoot = vec3f(0.68, 0.58, 0.48);
    let creamBase = vec3f(0.92, 0.84, 0.74);
    let creamTip  = vec3f(0.98, 0.93, 0.86);
    rootCol = mix(rootCol, creamRoot, creamMask);
    baseCol = mix(baseCol, creamBase, creamMask);
    tipCol  = mix(tipCol,  creamTip,  creamMask);
  }

  let hCurve = smoothstep(0.0, 1.0, shellFrac);
  var col = mix(rootCol, baseCol, clamp(shellFrac * 1.9, 0.0, 1.0));
  col = mix(col, tipCol, pow(hCurve, 1.55));
  // Subtle per-strand chroma jitter
  col *= 0.90 + 0.22 * strandJitter.y;
  return col;
}

fn computePlushLighting(
  worldPos : vec3f,
  worldNorm : vec3f,
  strandTan : vec3f,
  lieDir : vec3f,
  albedo : vec3f,
  shellFrac : f32,
  shadowLit : f32,
  contactAO : f32
) -> vec3f {
  let N = normalize(worldNorm);
  let V = normalize(frame.cameraPosAndTime.xyz - worldPos);
  let L = normalize(frame.lightDirAndPile.xyz);
  let T = normalize(strandTan);

  // Night lighting palette:
  // 1. Cool moonlight key (#9cb8ff) from behind/above
  let moonCol = vec3f(0.612, 0.722, 1.0) * 1.65;
  // 2. Violet sky ambient (#3a2452) + warm pumpkin-orange ground bounce (#ff8533)
  let skyCol = vec3f(0.227, 0.141, 0.322) * 1.35;
  let bounceCol = vec3f(1.0, 0.522, 0.200) * 0.62;
  // 3. Soft warm "candle" fill from viewer side (#ffbb77)
  let candleDir = normalize(V + vec3f(0.22, 0.18, 0.35));
  let candleCol = vec3f(1.0, 0.733, 0.467) * 0.92;

  let selfOcc = mix(0.28, 1.0, pow(clamp(shellFrac, 0.0, 1.0), 0.75)) * contactAO;

  // Wrapped diffuse for soft plush subsurface scatter
  let nDotL = clamp((dot(N, L) + 0.45) / 1.45, 0.0, 1.0);
  let nDotCandle = clamp((dot(N, candleDir) + 0.55) / 1.55, 0.0, 1.0);
  let hemi = N.y * 0.5 + 0.5;

  // Velvet pile term: darker against lie, luminous sheen along lie
  let lieLen = length(lieDir);
  var velvetTerm = 1.0;
  if (lieLen > 1e-3) {
    let vDotLie = dot(V, lieDir / lieLen);
    velvetTerm = mix(0.72, 1.28, smoothstep(-0.65, 0.65, vDotLie));
  }

  // Dual-lobe Kajiya-Kay anisotropic strand specular
  let tDotL = clamp(dot(T, L), -0.99, 0.99);
  let tDotV = clamp(dot(T, V), -0.99, 0.99);
  let sinTL = sqrt(max(0.0, 1.0 - tDotL * tDotL));
  let sinTV = sqrt(max(0.0, 1.0 - tDotV * tDotV));
  let kkRaw = max(0.0, sinTL * sinTV - tDotL * tDotV);

  let H_candle = normalize(candleDir + V);
  let tDotHc = clamp(dot(T, H_candle), -0.99, 0.99);
  let sinTHc = sqrt(max(0.0, 1.0 - tDotHc * tDotHc));

  let kkPrimary = pow(kkRaw, 38.0) * 0.22 * shellFrac;
  let kkSecondary = pow(sinTHc, 16.0) * 0.26 * (0.35 + 0.65 * shellFrac);

  // Moonlit rim halo on outer shells (shellFrac > 0.55)
  let fresnelRim = pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 2.5);
  let outerHalo = smoothstep(0.55, 1.0, shellFrac) * fresnelRim * (0.45 + 0.55 * clamp(dot(N, L) + 0.5, 0.0, 1.0));

  let ambientLight = mix(bounceCol, skyCol, hemi) * selfOcc;
  let directMoon = moonCol * nDotL * (0.25 + 0.75 * shadowLit) * selfOcc;
  let directCandle = candleCol * nDotCandle * selfOcc;

  var lit = albedo * velvetTerm * (ambientLight + directMoon + directCandle);
  lit += moonCol * kkPrimary * (0.35 + 0.65 * shadowLit);
  lit += mix(candleCol, frame.coatTipColor.xyz + vec3f(0.18), 0.55) * kkSecondary * selfOcc;
  lit += vec3f(0.612, 0.722, 1.0) * outerHalo * 0.82;
  return lit;
}

@vertex
fn vs_fur_base(in : SkinVertIn) -> FurVarying {
  var out : FurVarying;
  out.clipPos = frame.viewProj * vec4f(in.worldPos.xyz, 1.0);
  out.worldPos = in.worldPos.xyz;
  out.worldNorm = normalize(in.worldNorm.xyz);
  out.restPos = in.restPos.xyz;
  out.lieDir = in.lieDir.xyz;
  out.strandTan = normalize(in.worldNorm.xyz + in.lieDir.xyz * 0.45);
  out.params = vec4f(0.0, in.worldPos.w, in.worldNorm.w, in.restPos.w);
  return out;
}

@fragment
fn fs_fur_base(in : FurVarying) -> @location(0) vec4f {
  let shadowLit = samplePCSSShadow(in.worldPos, 0.018, in.worldNorm);
  let contactAO = sampleGroundContactAO(in.worldPos);
  let jitter = hash33(in.restPos / 0.011);
  var baseCol = evaluateCoatPalette(in.restPos, in.params.w, 0.06, jitter) * 0.68;

  // Back stitched seam groove & thread dashes
  let seamWeight = clamp(in.params.y, 0.0, 1.0);
  if (seamWeight > 0.05) {
    let stitchDash = smoothstep(0.25, 0.65, abs(fract(in.restPos.y * 22.0 + in.restPos.z * 22.0) - 0.5) * 2.0);
    let threadCol = vec3f(0.22, 0.16, 0.28);
    baseCol = mix(baseCol * 0.45, threadCol, (1.0 - stitchDash) * 0.55 * seamWeight);
  }

  let lit = computePlushLighting(
    in.worldPos,
    in.worldNorm,
    in.strandTan,
    in.lieDir,
    baseCol,
    0.08,
    shadowLit,
    contactAO
  );
  return vec4f(lit, 1.0);
}

@vertex
fn vs_fur_shell(in : SkinVertIn, @builtin(instance_index) instIdx : u32) -> FurVarying {
  let shellCount = max(frame.catComAndShells.w, 1.0);
  let h = f32(instIdx + 1u) / shellCount;
  let N = normalize(in.worldNorm.xyz);
  let lie = in.lieDir.xyz;
  let tip = in.dynTip.xyz;
  let seamWeight = clamp(in.worldPos.w, 0.0, 1.0);
  let regionMult = getRegionPileMultiplier(in.worldNorm.w, in.restPos.xyz) * (1.0 - seamWeight * 0.58);
  let pileLen = frame.lightDirAndPile.w * regionMult;

  let offset = (N * h + lie * pow(h, 1.4) * 0.68 + tip * pow(h, 1.6)) * pileLen;
  let worldP = in.worldPos.xyz + offset;
  let tanVec = normalize(N + lie * (1.4 * pow(h, 0.4) * 0.68) + tip * (1.6 * pow(h, 0.6)));

  var out : FurVarying;
  out.clipPos = frame.viewProj * vec4f(worldP, 1.0);
  out.worldPos = worldP;
  out.worldNorm = N;
  out.restPos = in.restPos.xyz;
  out.lieDir = lie;
  out.strandTan = tanVec;
  out.params = vec4f(h, seamWeight, in.worldNorm.w, in.restPos.w);
  return out;
}

struct FurShellFragOut {
  @location(0) color : vec4f,
  @builtin(sample_mask) mask : u32,
};

@fragment
fn fs_fur_shell(in : FurVarying) -> FurShellFragOut {
  var out : FurShellFragOut;
  let h = in.params.x;
  let seamWeight = in.params.y;

  // 3D rest-space grid hash (cell ~ 0.011 units in rest space)
  let cellSize = 0.011;
  let restN = normalize(in.restPos - vec3f(0.0, 1.05, 0.05));
  let surfPos = in.restPos - restN * dot(in.restPos, restN) * 0.88;
  let gridCoord = surfPos / cellSize;
  let cellId = floor(gridCoord);
  let cellFract = fract(gridCoord) - 0.5;
  let rnd = hash33(cellId);

  // Per-strand max height (shortens along stitched back seam)
  let strandMaxH = mix(0.46, 1.0, rnd.x) * (1.0 - seamWeight * 0.52);
  if (h > strandMaxH) {
    out.color = vec4f(0.0);
    out.mask = 0u;
    return out;
  }

  // Sinusoidal crimp + lean in rest space
  let phase = rnd.y * 6.2831853 + h * 11.5;
  let crimp = vec3f(sin(phase), cos(phase * 0.85 + rnd.z * 6.283), sin(phase * 1.15 - rnd.x * 6.283)) * (0.14 * h);
  let dVec = cellFract + crimp + (rnd - 0.5) * 0.22;

  // Measure radial distance perpendicular to surface normal for uniform cones on all sides
  let N = normalize(in.worldNorm);
  let perpVec = dVec - restN * dot(dVec, restN);
  let dist = length(perpVec);

  let taper = clamp(h / max(strandMaxH, 0.05), 0.0, 1.0);
  let coneRadius = 0.52 * (1.0 - pow(taper, 0.82) * 0.86);

  if (dist > coneRadius) {
    out.color = vec4f(0.0);
    out.mask = 0u;
    return out;
  }

  // Deterministic 4-sample coverage mask (@builtin(sample_mask)) with alpha = 1.0
  let rawCov = clamp((coneRadius - dist) / max(coneRadius * 0.48, 1e-4), 0.0, 1.0);
  let pixelJitter = hash12(in.clipPos.xy + vec2f(h * 37.0, rnd.z * 19.0));
  let sampleFloat = clamp(rawCov * 4.25 + (pixelJitter - 0.38) * 0.75, 0.0, 4.0);
  let sampleCount = u32(round(sampleFloat));
  if (sampleCount == 0u) {
    out.color = vec4f(0.0);
    out.mask = 0u;
    return out;
  }

  let rot = u32(pixelJitter * 4.0) & 3u;
  var bitMask = 0xFu;
  if (sampleCount == 1u) {
    bitMask = 1u << rot;
  } else if (sampleCount == 2u) {
    bitMask = select(0x5u, 0xAu, (rot & 1u) != 0u);
  } else if (sampleCount == 3u) {
    bitMask = 0xFu ^ (1u << rot);
  }

  let shadowLit = samplePCSSShadow(in.worldPos, 0.018, N);
  let contactAO = sampleGroundContactAO(in.worldPos);
  let strandAlbedo = evaluateCoatPalette(in.restPos, in.params.w, h, rnd);
  let litColor = computePlushLighting(
    in.worldPos,
    N,
    in.strandTan,
    in.lieDir,
    strandAlbedo,
    h,
    shadowLit,
    contactAO
  );

  out.color = vec4f(litColor, 1.0);
  out.mask = bitMask;
  return out;
}

// ============================================================================
// Subpass 3c: Felt Ears (double-sided, stitched outer edge, pink inner patch)
// ============================================================================
@vertex
fn vs_felt_ear(in : SkinVertIn) -> FurVarying {
  var out : FurVarying;
  out.clipPos = frame.viewProj * vec4f(in.worldPos.xyz, 1.0);
  out.worldPos = in.worldPos.xyz;
  out.worldNorm = normalize(in.worldNorm.xyz);
  out.restPos = in.restPos.xyz; // x = u, y = v
  out.lieDir = in.lieDir.xyz;
  out.strandTan = in.worldNorm.xyz;
  out.params = vec4f(in.worldPos.w, in.worldNorm.w, 0.0, 0.0); // x = isInnerPink, y = edgeStitch
  return out;
}

@fragment
fn fs_felt_ear(in : FurVarying, @builtin(front_facing) isFront : bool) -> @location(0) vec4f {
  let N = select(-normalize(in.worldNorm), normalize(in.worldNorm), isFront);
  let V = normalize(frame.cameraPosAndTime.xyz - in.worldPos);
  let L = normalize(frame.lightDirAndPile.xyz);

  let uv = in.restPos.xy;
  let isInnerPink = in.params.x;
  let edgeStitch = in.params.y;

  // Fine 3D procedural felt fuzz noise
  let fuzz = (noise3D(in.worldPos * 65.0) - 0.5) * 0.14;
  var feltCol = frame.coatBaseColor.xyz * (1.15 + fuzz);

  // Soft dusky-pink felt inner ear patch on the front cupped side
  let pinkPatch = clamp(isInnerPink, 0.0, 1.0) * select(0.15, 1.0, isFront);
  let innerPinkCol = vec3f(0.58, 0.31, 0.36) + vec3f(fuzz * 0.45);
  feltCol = mix(feltCol, innerPinkCol, pinkPatch * 0.85);

  // Dashed blanket-stitch seam along the outer ear border
  if (edgeStitch > 0.15) {
    let perimeterCoord = (uv.x + uv.y) * 18.0;
    let dash = smoothstep(0.30, 0.55, abs(fract(perimeterCoord) - 0.5) * 2.0);
    let stitchThreadCol = mix(frame.coatTipColor.xyz + vec3f(0.14), vec3f(0.68, 0.42, 0.48), pinkPatch);
    feltCol = mix(feltCol, stitchThreadCol, (1.0 - dash) * smoothstep(0.15, 0.75, edgeStitch) * 0.85);
  }

  let shadowLit = samplePCSSShadow(in.worldPos, 0.015, N);
  let grazingSheen = pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 2.2);
  let lit = computePlushLighting(
    in.worldPos,
    N,
    normalize(cross(N, vec3f(0.0, 1.0, 0.0)) + vec3f(1e-4)),
    vec3f(0.0, 1.0, 0.0),
    feltCol,
    0.45,
    shadowLit,
    1.0
  ) + (feltCol + vec3f(0.15, 0.14, 0.22)) * grazingSheen * 0.42;

  return vec4f(lit, 1.0);
}

// ============================================================================
// Subpass 3b: Rigidly Attached Props & Face
// ============================================================================
struct PropInstance {
  modelMat    : mat4x4f,
  normMat     : mat4x4f,
  colorAndMat : vec4f, // rgb = color, w = materialType (1=Eye, 2=Felt, 3=Thread, 4=Velvet, 5=BrassBell)
  extraParams : vec4f, // x = param0, y = param1, z = param2, w = activeFlag
};

@group(1) @binding(0) var<storage, read> propInstances : array<PropInstance>;

struct PropVertIn {
  @location(0) localPos  : vec3f,
  @location(1) localNorm : vec3f,
  @location(2) uv        : vec2f,
};

struct PropVarying {
  @builtin(position) clipPos : vec4f,
  @location(0) worldPos  : vec3f,
  @location(1) worldNorm : vec3f,
  @location(2) localPos  : vec3f,
  @location(3) localNorm : vec3f,
  @location(4) uv        : vec2f,
  @location(5) @interpolate(flat) instIdx : u32,
};

@vertex
fn vs_prop(in : PropVertIn, @builtin(instance_index) instIdx : u32) -> PropVarying {
  let inst = propInstances[instIdx];
  var out : PropVarying;
  if (inst.extraParams.w < 0.5) {
    out.clipPos = vec4f(0.0, 0.0, -2.0, 1.0);
    out.instIdx = instIdx;
    return out;
  }
  let wp = inst.modelMat * vec4f(in.localPos, 1.0);
  let wn = normalize((inst.normMat * vec4f(in.localNorm, 0.0)).xyz);
  out.clipPos = frame.viewProj * wp;
  out.worldPos = wp.xyz;
  out.worldNorm = wn;
  out.localPos = in.localPos;
  out.localNorm = normalize(in.localNorm);
  out.uv = in.uv;
  out.instIdx = instIdx;
  return out;
}

@fragment
fn fs_prop(in : PropVarying) -> @location(0) vec4f {
  let inst = propInstances[in.instIdx];
  let matType = i32(round(inst.colorAndMat.w));
  let baseCol = inst.colorAndMat.xyz;
  let N = normalize(in.worldNorm);
  let V = normalize(frame.cameraPosAndTime.xyz - in.worldPos);
  let L = normalize(frame.lightDirAndPile.xyz);
  let shadowLit = samplePCSSShadow(in.worldPos, 0.012, N);

  // Material 1: Glass-bead Eye (glowing iris, slit pupil, 2 camera-space catchlights, cornea env)
  if (matType == 1) {
    let ln = normalize(in.localNorm);
    let forwardZ = ln.z;
    let r = length(ln.xy);
    let coatId = i32(round(frame.coatRootColor.w));

    // Iris palette by coat: Midnight=Amber-Gold, Smoke=Emerald, Tuxedo=Rich Gold
    var irisInner = vec3f(1.00, 0.68, 0.14);
    var irisOuter = vec3f(0.76, 0.34, 0.04);
    if (coatId == 1) {
      irisInner = vec3f(0.24, 0.92, 0.52);
      irisOuter = vec3f(0.06, 0.44, 0.24);
    } else if (coatId == 2) {
      irisInner = vec3f(1.00, 0.84, 0.22);
      irisOuter = vec3f(0.72, 0.48, 0.06);
    }

    let angle = atan2(ln.y, ln.x);
    let fibers = sin(angle * 28.0 + sin(r * 20.0) * 1.6) * 0.5 + 0.5;
    let irisRadial = clamp(r / 0.82, 0.0, 1.0);
    var irisCol = mix(irisInner, irisOuter, pow(irisRadial, 1.25));
    irisCol *= 0.84 + 0.32 * fibers;
    // Lower iris caustic glow
    irisCol *= 1.0 + clamp(-ln.y, 0.0, 1.0) * 0.45;
    // Dark limbal ring
    let limbal = 1.0 - smoothstep(0.68, 0.84, r) * 0.82;
    irisCol *= limbal;

    // Vertical slit-ellipse pupil
    let pupilW = clamp(frame.heightBounds.w, 0.16, 0.85);
    let pupilCoord = vec2f(ln.x / (pupilW * 0.55), ln.y / 0.58);
    let pupilDist = length(pupilCoord);
    let pupilMask = smoothstep(0.92, 1.04, pupilDist);
    let obsidianPupil = vec3f(0.004, 0.004, 0.008);

    let isFrontIris = smoothstep(-0.05, 0.20, forwardZ) * (1.0 - smoothstep(0.78, 0.88, r));
    var eyeColor = mix(obsidianPupil, irisCol * 1.38, pupilMask * isFrontIris);

    // Camera-space normal for two persistent alive catchlights from every orbit angle
    let viewN = normalize((frame.viewMat * vec4f(N, 0.0)).xyz);
    let catch1Dist = length(viewN.xy - vec2f(-0.26, 0.30));
    let catch2Dist = length(viewN.xy - vec2f( 0.24, -0.25));
    let catch1 = smoothstep(0.21, 0.09, catch1Dist) * 3.1;
    let catch2 = smoothstep(0.095, 0.032, catch2Dist) * 2.1;

    // Cornea procedural night reflection
    let R = reflect(-V, N);
    let fresnel = 0.05 + 0.90 * pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 3.6);
    let envRefl = sampleNightEnv(R, L);

    eyeColor += envRefl * fresnel * 0.65;
    eyeColor += vec3f(1.0, 0.97, 0.92) * (catch1 + catch2);
    return vec4f(eyeColor, 1.0);
  }

  // Material 5: Metallic Brass Bell with cross-slit cutout
  if (matType == 5) {
    let lp = in.localPos;
    let ln = normalize(in.localNorm);
    // Cross-slit cutout & bottom keyhole on lower hemisphere
    let inBottomHalf = lp.y < -0.10;
    let crossSlit = (abs(lp.x) < 0.14 || abs(lp.z) < 0.14) && lp.y < -0.18;
    let bottomHole = length(lp.xz) < 0.30 && lp.y < -0.65;
    let ringGroove = abs(lp.y - 0.06) < 0.055;
    if (inBottomHalf && (crossSlit || bottomHole)) {
      return vec4f(0.025, 0.015, 0.010, 1.0);
    }

    let R = reflect(-V, N);
    let env = sampleNightEnv(R, L);
    let H_moon = normalize(L + V);
    let H_candle = normalize(normalize(V + vec3f(0.25, 0.2, 0.3)) + V);
    let specMoon = pow(max(dot(N, H_moon), 0.0), 48.0) * 2.4 * shadowLit;
    let specCandle = pow(max(dot(N, H_candle), 0.0), 28.0) * 1.8;
    let fresnel = 0.25 + 0.75 * pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 3.2);
    let grooveDarken = select(1.0, 0.55, ringGroove);
    let brassCol = baseCol * grooveDarken;
    let litBrass = brassCol * (env * 1.15 + vec3f(0.32, 0.22, 0.12))
                 + brassCol * (specMoon + specCandle)
                 + env * fresnel * 0.45;
    return vec4f(litBrass, 1.0);
  }

  // Material 4: Dark-purple Velvet Collar with strong grazing velvet sheen
  if (matType == 4) {
    let fuzz = (noise3D(in.worldPos * 75.0) - 0.5) * 0.08;
    let grazing = pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 2.0);
    let sheenCol = vec3f(0.62, 0.36, 0.85);
    let litVelvet = computePlushLighting(
      in.worldPos, N, normalize(cross(N, vec3f(0.0, 1.0, 0.0)) + vec3f(1e-4)),
      vec3f(0.0, 1.0, 0.0), baseCol + vec3f(fuzz), 0.5, shadowLit, 1.0
    ) + sheenCol * grazing * 0.65;
    return vec4f(litVelvet, 1.0);
  }

  // Material 2 (Felt: nose, tongue, blush, mouse toy) & Material 3 (Embroidery Thread: mouth, whiskers)
  let fuzzAmp = select(0.08, 0.14, matType == 2);
  let fuzz = (noise3D(in.worldPos * 85.0) - 0.5) * fuzzAmp;
  var surfCol = baseCol + vec3f(fuzz);
  if (matType == 3) {
    // Ribbed embroidery thread twist along UV
    let twist = sin(in.uv.x * 55.0 + in.uv.y * 12.0) * 0.10;
    surfCol += vec3f(twist);
  }
  let grazing = pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 2.4);
  var lit = computePlushLighting(
    in.worldPos, N, normalize(cross(N, vec3f(0.0, 1.0, 0.0)) + vec3f(1e-4)),
    vec3f(0.0, 1.0, 0.0), surfCol, 0.65, shadowLit, 1.0
  ) + surfCol * grazing * 0.38;
  // Subtle warm fill boost on facial embroidery & nose so features always read clearly
  lit += surfCol * clamp(dot(N, V), 0.0, 1.0) * 0.32;
  return vec4f(lit, 1.0);
}

// ============================================================================
// Subpass 3f: Instanced Billboard Particles & Soft Bloom Halos
// ============================================================================
struct ParticleInstance {
  posAndSize  : vec4f, // xyz = worldPos, w = size
  colorAndRot : vec4f, // rgb = color, w = rotation
  uvRect      : vec4f, // xy = uvOffset, zw = uvScale
  alphaAndPad : vec4f, // x = alpha, y = isHalo
};

@group(1) @binding(0) var<storage, read> particles : array<ParticleInstance>;
@group(1) @binding(1) var glyphAtlas : texture_2d<f32>;

struct ParticleOut {
  @builtin(position) clipPos : vec4f,
  @location(0) uv : vec2f,
  @location(1) color : vec4f,
};

@vertex
fn vs_particle(@builtin(vertex_index) vid : u32, @builtin(instance_index) iid : u32) -> ParticleOut {
  let corners = array<vec2f, 6>(
    vec2f(-0.5, -0.5), vec2f( 0.5, -0.5), vec2f( 0.5,  0.5),
    vec2f(-0.5, -0.5), vec2f( 0.5,  0.5), vec2f(-0.5,  0.5)
  );
  let p = particles[iid];
  var out : ParticleOut;
  if (p.alphaAndPad.x <= 0.001) {
    out.clipPos = vec4f(0.0, 0.0, -2.0, 1.0);
    return out;
  }
  let c = corners[vid];
  let ca = cos(p.colorAndRot.w);
  let sa = sin(p.colorAndRot.w);
  let rotC = vec2f(c.x * ca - c.y * sa, c.x * sa + c.y * ca) * p.posAndSize.w;
  let worldPos = p.posAndSize.xyz
               + frame.camRight.xyz * rotC.x
               + frame.camUp.xyz * rotC.y;
  out.clipPos = frame.viewProj * vec4f(worldPos, 1.0);
  let localUv = vec2f(c.x + 0.5, 0.5 - c.y);
  out.uv = p.uvRect.xy + localUv * p.uvRect.zw;
  out.color = vec4f(p.colorAndRot.xyz, p.alphaAndPad.x);
  return out;
}

@fragment
fn fs_particle(in : ParticleOut) -> @location(0) vec4f {
  let tex = textureSampleLevel(glyphAtlas, linearSampler, in.uv, 0.0);
  let a = tex.a * in.color.a;
  if (a <= 0.003) {
    discard;
  }
  // Premultiplied alpha output
  return vec4f(tex.rgb * in.color.rgb * a, a);
}

// ============================================================================
// Subpass 3g: Simulation Lattice Wireframe ("Mesh" toggle)
// ============================================================================
@vertex
fn vs_wireframe(@location(0) pos : vec3f) -> @builtin(position) vec4f {
  return frame.viewProj * vec4f(pos, 1.0);
}

@fragment
fn fs_wireframe() -> @location(0) vec4f {
  let alpha = 0.72;
  let glowOrange = vec3f(1.0, 0.62, 0.22) * 1.45;
  return vec4f(glowOrange * alpha, alpha);
}
`;

const POST_PROCESS_WGSL = /* wgsl */ `
${COMMON_WGSL}

@group(0) @binding(0) var<uniform> frame : FrameUniforms;
@group(0) @binding(1) var hdrTex : texture_2d<f32>;

struct PostOut {
  @builtin(position) clipPos : vec4f,
  @location(0) uv : vec2f,
};

@vertex
fn vs_post(@builtin(vertex_index) vid : u32) -> PostOut {
  let pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0)
  );
  let p = pos[vid];
  var out : PostOut;
  out.clipPos = vec4f(p, 0.0, 1.0);
  out.uv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return out;
}

// Khronos PBR Neutral Tone Mapper
fn pbrNeutralToneMapping(color_in : vec3f) -> vec3f {
  let startCompression = 0.8 - 0.04;
  let desaturation = 0.15;
  var color = max(color_in, vec3f(0.0));
  let x = min(color.r, min(color.g, color.b));
  let offset = select(0.04, x - 6.25 * x * x, x < 0.08);
  color -= vec3f(offset);
  let peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) {
    return color;
  }
  let d = 1.0 - startCompression;
  let newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / max(peak, 1e-5);
  let g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3f(newPeak), g);
}

fn linearToSrgb(c : vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;
  return select(lo, hi, c > vec3f(0.0031308));
}

@fragment
fn fs_post(in : PostOut) -> @location(0) vec4f {
  let coord = vec2i(in.clipPos.xy);
  let sampleVal = textureLoad(hdrTex, coord, 0);
  let alpha = clamp(sampleVal.a, 0.0, 1.0);
  if (alpha <= 1e-4) {
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }
  // Unpremultiply RGB before exposure and tone mapping
  let rawRgb = max(sampleVal.rgb / max(alpha, 1e-4), vec3f(0.0));
  let exposed = rawRgb * frame.coatBaseColor.w;
  var mapped = pbrNeutralToneMapping(exposed);
  if (frame.coatTipColor.w < 0.5) {
    mapped = linearToSrgb(mapped);
  }
  // 1/255 hash dither
  let dither = (hash12(in.clipPos.xy + vec2f(frame.cameraPosAndTime.w * 60.0)) - 0.5) * (1.0 / 255.0);
  mapped = clamp(mapped + vec3f(dither), vec3f(0.0), vec3f(1.0));
  // Re-premultiply by alpha for alphaMode: "premultiplied" swapchain composite over Three.js
  return vec4f(mapped * alpha, alpha);
}
`;

// ============================================================================
// Matrix & Geometry Helper Functions
// ============================================================================
function mat4Identity() {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

function mat4Multiply(out, a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4]     = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  }
  return out;
}

function mat4LookAt(out, eye, target, up) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

function mat4PerspectiveZO(out, fovYRad, aspect, near, far, shiftX = 0, shiftY = 0) {
  const f = 1.0 / Math.tan(fovYRad * 0.5);
  const nf = 1.0 / (near - far);
  out.fill(0);
  out[0] = f / Math.max(aspect, 1e-4);
  out[5] = f;
  out[8] = shiftX;
  out[9] = shiftY;
  out[10] = far * nf;
  out[11] = -1.0;
  out[14] = far * near * nf;
  return out;
}

function mat4OrthoZO(out, left, right, bottom, top, near, far) {
  const lr = 1.0 / (left - right);
  const bt = 1.0 / (bottom - top);
  const nf = 1.0 / (near - far);
  out.fill(0);
  out[0] = -2.0 * lr;
  out[5] = -2.0 * bt;
  out[10] = nf;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = near * nf;
  out[15] = 1.0;
  return out;
}

function rotMat3FromFrame(att) {
  if (att && att.rotMat3 && att.rotMat3.length === 9) {
    const m = att.rotMat3;
    const det = m[0] * m[4] * m[8] + m[1] * m[5] * m[6] + m[2] * m[3] * m[7]
              - m[2] * m[4] * m[6] - m[1] * m[3] * m[8] - m[0] * m[5] * m[7];
    if (Number.isFinite(det) && Math.abs(det) > 0.1) {
      return m;
    }
  }
  if (att && att.quat && att.quat.length === 4) {
    const [x, y, z, w] = att.quat;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    return [
      1 - (yy + zz), xy + wz, xz - wy,
      xy - wz, 1 - (xx + zz), yz + wx,
      xz + wy, yz - wx, 1 - (xx + yy),
    ];
  }
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

function buildPropGeometryBundle() {
  const verts = [];
  const indices = [];
  const ranges = {};

  function beginMesh() {
    return { baseVertex: verts.length / 8, firstIndex: indices.length };
  }
  function endMesh(name, start) {
    ranges[name] = {
      firstIndex: start.firstIndex,
      indexCount: indices.length - start.firstIndex,
    };
  }
  function pushVert(px, py, pz, nx, ny, nz, u, v) {
    const l = Math.hypot(nx, ny, nz) || 1;
    verts.push(px, py, pz, nx / l, ny / l, nz / l, u, v);
  }

  // 1. Unit Sphere (for glass-bead eyes & brass bell)
  {
    const s = beginMesh();
    const latSteps = 18, lonSteps = 28;
    for (let i = 0; i <= latSteps; i++) {
      const v = i / latSteps;
      const theta = v * Math.PI;
      const st = Math.sin(theta), ct = Math.cos(theta);
      for (let j = 0; j <= lonSteps; j++) {
        const u = j / lonSteps;
        const phi = u * Math.PI * 2;
        const nx = st * Math.sin(phi);
        const ny = ct;
        const nz = st * Math.cos(phi);
        pushVert(nx, ny, nz, nx, ny, nz, u, v);
      }
    }
    const ring = lonSteps + 1;
    for (let i = 0; i < latSteps; i++) {
      for (let j = 0; j < lonSteps; j++) {
        const a = s.baseVertex + i * ring + j;
        const b = a + ring;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    endMesh("sphere", s);
  }

  // 2. Rounded Triangle Felt Nose
  {
    const s = beginMesh();
    const latSteps = 12, lonSteps = 18;
    for (let i = 0; i <= latSteps; i++) {
      const v = i / latSteps;
      const theta = v * Math.PI;
      const st = Math.sin(theta), ct = Math.cos(theta);
      for (let j = 0; j <= lonSteps; j++) {
        const u = j / lonSteps;
        const phi = u * Math.PI * 2;
        let x = st * Math.cos(phi);
        let y = ct;
        let z = st * Math.sin(phi);
        const pinch = 0.55 + 0.45 * Math.max(0, y + 0.55);
        const px = x * 0.058 * pinch;
        const py = y * 0.042;
        const pz = z * 0.034 + 0.008;
        pushVert(px, py, pz, x, y, z + 0.3, u, v);
      }
    }
    const ring = lonSteps + 1;
    for (let i = 0; i < latSteps; i++) {
      for (let j = 0; j < lonSteps; j++) {
        const a = s.baseVertex + i * ring + j;
        const b = a + ring;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    endMesh("nose", s);
  }

  // Helper: Sweep a 3D tube along a parametric curve fn(t) -> [x, y, z]
  function addTubeCurve(curveFn, segs, radialSegs, radius, taperEnds = true) {
    const b = verts.length / 8;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curveFn(t);
      const pNext = curveFn(Math.min(1, t + 0.01));
      const pPrev = curveFn(Math.max(0, t - 0.01));
      let tx = pNext[0] - pPrev[0], ty = pNext[1] - pPrev[1], tz = pNext[2] - pPrev[2];
      let tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      // Orthonormal frame around tangent
      let ux = 0, uy = 0, uz = 1;
      if (Math.abs(tz) > 0.85) { ux = 0; uy = 1; uz = 0; }
      let bx = ty * uz - tz * uy, by = tz * ux - tx * uz, bz = tx * uy - ty * ux;
      let bl = Math.hypot(bx, by, bz) || 1;
      bx /= bl; by /= bl; bz /= bl;
      const nx = by * tz - bz * ty, ny = bz * tx - bx * tz, nz = bx * ty - by * tx;
      const rScale = taperEnds ? Math.sin(Math.PI * Math.min(1, Math.max(0.08, t))) ** 0.35 : 1.0;
      const r = radius * rScale;
      for (let j = 0; j <= radialSegs; j++) {
        const v = j / radialSegs;
        const ang = v * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const rnx = bx * ca + nx * sa;
        const rny = by * ca + ny * sa;
        const rnz = bz * ca + nz * sa;
        pushVert(p[0] + rnx * r, p[1] + rny * r, p[2] + rnz * r, rnx, rny, rnz, t, v);
      }
    }
    const ring = radialSegs + 1;
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = b + i * ring + j;
        const c = a + ring;
        indices.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  }

  // 3. Mouth 0: 'ω' content cat smile (two connected arcs)
  {
    const s = beginMesh();
    addTubeCurve((t) => {
      const ang = Math.PI + t * Math.PI;
      return [-0.036 + Math.cos(ang) * 0.036, Math.sin(ang) * 0.028, 0.018];
    }, 18, 8, 0.0108, true);
    addTubeCurve((t) => {
      const ang = Math.PI + t * Math.PI;
      return [0.036 + Math.cos(ang) * 0.036, Math.sin(ang) * 0.028, 0.018];
    }, 18, 8, 0.0108, true);
    endMesh("mouthW", s);
  }

  // 4. Mouth 1: 'o' surprised ring
  {
    const s = beginMesh();
    addTubeCurve((t) => {
      const ang = t * Math.PI * 2;
      return [Math.cos(ang) * 0.028, -0.012 + Math.sin(ang) * 0.032, 0.018];
    }, 22, 8, 0.0108, false);
    endMesh("mouthO", s);
  }

  // 5. Mouth 2: '^' arch mouth thread + pink felt tongue mesh
  {
    const s = beginMesh();
    addTubeCurve((t) => {
      const x = (t - 0.5) * 0.11;
      const y = 0.015 - Math.abs(t - 0.5) * 0.095;
      return [x, y, 0.018];
    }, 18, 8, 0.0108, true);
    endMesh("mouthCaret", s);

    const st = beginMesh();
    addTubeCurve((t) => {
      return [0, -0.005 - t * 0.036, 0.006 + Math.sin(t * Math.PI) * 0.006];
    }, 10, 10, 0.022, true);
    endMesh("tongue", st);
  }

  // 6. Mouth 3: 'u u' happy sleeping eye arcs (in mouth frame, offset to eye sockets)
  {
    const s = beginMesh();
    addTubeCurve((t) => {
      const ang = Math.PI * 1.12 + t * Math.PI * 0.76;
      return [-0.215 + Math.cos(ang) * 0.075, 0.185 + Math.sin(ang) * 0.044, -0.028];
    }, 18, 8, 0.0115, true);
    addTubeCurve((t) => {
      const ang = Math.PI * 1.12 + t * Math.PI * 0.76;
      return [0.215 + Math.cos(ang) * 0.075, 0.185 + Math.sin(ang) * 0.044, -0.028];
    }, 18, 8, 0.0115, true);
    endMesh("closedEyesUU", s);
  }

  // 7. Cheek Blush + 3 Embroidered Whiskers per cheek
  function buildCheekCluster(sideSign) {
    const sBlush = beginMesh();
    addTubeCurve((t) => {
      return [sideSign * (t - 0.5) * 0.055, (t - 0.5) * 0.012, 0.018];
    }, 10, 10, 0.022, true);
    endMesh(sideSign < 0 ? "blushL" : "blushR", sBlush);

    const sWhisk = beginMesh();
    const angles = [-0.22, 0.0, 0.22];
    for (let w = 0; w < 3; w++) {
      const a = angles[w];
      addTubeCurve((t) => {
        const len = t * 0.28;
        const x = sideSign * (0.02 + len * Math.cos(a));
        const y = (w - 1) * 0.022 + len * Math.sin(a) - (t * t) * 0.032;
        const z = 0.015 - (t * t) * 0.055;
        return [x, y, z];
      }, 14, 6, 0.0052, true);
    }
    endMesh(sideSign < 0 ? "whiskersL" : "whiskersR", sWhisk);
  }
  buildCheekCluster(-1);
  buildCheekCluster(1);

  // 8. Dark-purple Velvet Collar Torus
  {
    const s = beginMesh();
    addTubeCurve((t) => {
      const ang = t * Math.PI * 2;
      return [Math.sin(ang) * 0.415, Math.cos(ang) * 0.022, Math.cos(ang) * 0.395];
    }, 32, 12, 0.042, false);
    endMesh("collar", s);
  }

  // 9. Felt Toy Mouse (body + ears + tail) & String
  {
    const s = beginMesh();
    addTubeCurve((t) => {
      const r = Math.sin(Math.pow(t, 0.65) * Math.PI);
      return [0, r * 0.045, (0.5 - t) * 0.22];
    }, 16, 12, 0.068, true);
    // Tiny mouse tail
    addTubeCurve((t) => {
      return [Math.sin(t * 5.0) * 0.018, 0.02, -0.11 - t * 0.16];
    }, 12, 6, 0.008, true);
    endMesh("mouseBody", s);

    const sStr = beginMesh();
    addTubeCurve((t) => [0, t, 0], 10, 6, 0.0045, false);
    endMesh("unitString", sStr);
  }

  return {
    vertexData: new Float32Array(verts),
    indexData: new Uint32Array(indices),
    ranges,
  };
}

function createGlyphAtlasCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);

  function softGlow(cx, cy, r, rgbaInner, rgbaOuter) {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, rgbaInner);
    g.addColorStop(0.55, rgbaOuter);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Quadrant 0 (0,0): Heart
  softGlow(64, 64, 54, "rgba(255,160,190,0.45)", "rgba(255,120,160,0.12)");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(64, 94);
  ctx.bezierCurveTo(26, 70, 24, 36, 46, 34);
  ctx.bezierCurveTo(56, 34, 62, 42, 64, 48);
  ctx.bezierCurveTo(66, 42, 72, 34, 82, 34);
  ctx.bezierCurveTo(104, 36, 102, 70, 64, 94);
  ctx.fill();

  // Quadrant 1 (128,0): Italic 'z'
  softGlow(192, 64, 52, "rgba(210,195,255,0.42)", "rgba(170,150,255,0.10)");
  ctx.fillStyle = "#ffffff";
  ctx.font = "italic 700 68px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("z", 192, 66);

  // Quadrant 2 (0,128): 4-point Sparkle Star
  softGlow(64, 192, 56, "rgba(255,220,160,0.65)", "rgba(255,160,80,0.18)");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const sx = 64, sy = 192, sr = 42, si = 10;
  ctx.moveTo(sx, sy - sr);
  ctx.quadraticCurveTo(sx + si, sy - si, sx + sr, sy);
  ctx.quadraticCurveTo(sx + si, sy + si, sx, sy + sr);
  ctx.quadraticCurveTo(sx - si, sy + si, sx - sr, sy);
  ctx.quadraticCurveTo(sx - si, sy - si, sx, sy - sr);
  ctx.fill();

  // Quadrant 3 (128,128): Fur Tuft + Soft Radial Halo
  softGlow(192, 192, 56, "rgba(255,255,255,0.75)", "rgba(255,255,255,0.22)");
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(192 + k * 4, 214);
    ctx.quadraticCurveTo(192 + k * 10, 188, 192 + k * 15, 168 + Math.abs(k) * 3);
    ctx.stroke();
  }

  return canvas;
}

class PlushWebGPURenderer {
  constructor() {
    this.device = null;
    this.context = null;
    this.canvas = null;
    this.canvasFormat = "bgra8unorm";
    this.isSrgbFormat = false;

    this.coatName = "midnight";
    this.pileValue = 62; // 0..100
    this.qualityLevel = 0; // 0..3
    this.shellCount = 30;
    this.resolutionScale = 1.0;
    this.showMesh = false;

    this.frameData = new Float32Array(100); // 400 bytes
    this.viewMat = mat4Identity();
    this.projMat = mat4Identity();
    this.viewProjMat = mat4Identity();
    this.lightViewMat = mat4Identity();
    this.lightProjMat = mat4Identity();
    this.lightViewProjMat = mat4Identity();
    this.heightViewMat = mat4Identity();
    this.heightProjMat = mat4Identity();
    this.heightViewProjMat = mat4Identity();

    this.maxParticles = 160;
    this.particles = [];
    this.particleStaging = new Float32Array(this.maxParticles * 16);

    this.maxProps = 24;
    this.propStaging = new Float32Array(this.maxProps * 40); // 160 bytes (40 floats) per PropInstance

    this.time = 0;
    this.blinkTimer = 3.2;
    this.blinkPhase = 0;
    this.emitAccum = 0;
    this.targetWidth = 0;
    this.targetHeight = 0;
  }

  async init(canvas, physics) {
    try {
      if (!navigator.gpu) {
        return { ok: false, error: "WebGPU is not supported in this browser (navigator.gpu unavailable)." };
      }
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) {
        return { ok: false, error: "Unable to acquire a WebGPU GPUAdapter on this system." };
      }
      const device = await adapter.requestDevice();
      this.device = device;
      this.canvas = canvas;

      const context = canvas.getContext("webgpu");
      if (!context) {
        return { ok: false, error: "Failed to acquire WebGPU canvas context." };
      }
      this.context = context;
      this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.isSrgbFormat = this.canvasFormat.endsWith("-srgb");

      context.configure({
        device,
        format: this.canvasFormat,
        alphaMode: "premultiplied",
      });

      // Compile and validate every WGSL shader module via getCompilationInfo()
      const modulesToCheck = [
        { name: "SHADOW_AND_HEIGHT_WGSL", code: SHADOW_AND_HEIGHT_WGSL },
        { name: "MAIN_SCENE_WGSL", code: MAIN_SCENE_WGSL },
        { name: "POST_PROCESS_WGSL", code: POST_PROCESS_WGSL },
      ];
      const compiledModules = {};
      for (const item of modulesToCheck) {
        const mod = device.createShaderModule({ label: item.name, code: item.code });
        const info = await mod.getCompilationInfo();
        const errors = info.messages.filter((m) => m.type === "error");
        if (errors.length > 0) {
          const formatted = errors
            .map((e) => `[${item.name} line ${e.lineNum}:${e.linePos}] ${e.message}`)
            .join("\n");
          return { ok: false, error: formatted };
        }
        compiledModules[item.name] = mod;
      }

      this._createStaticResources(physics);
      this._createPipelines(compiledModules);
      this._ensureRenderTargets();

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  _createStaticResources(physics) {
    const device = this.device;

    this.frameUniformBuffer = device.createBuffer({
      size: 400,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Pass 1: Key-light shadow map (1536x1536 depth32float)
    this.shadowSize = 1536;
    this.shadowTex = device.createTexture({
      size: [this.shadowSize, this.shadowSize],
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.shadowView = this.shadowTex.createView();

    // Pass 2: Top-down height map (256x256 rgba16float + depth32float)
    this.heightSize = 256;
    this.heightTex = device.createTexture({
      size: [this.heightSize, this.heightSize],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.heightView = this.heightTex.createView();
    this.heightDepthTex = device.createTexture({
      size: [this.heightSize, this.heightSize],
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.heightDepthView = this.heightDepthTex.createView();

    this.linearSampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    // Glyph Atlas texture (256x256)
    const atlasCanvas = createGlyphAtlasCanvas();
    this.glyphAtlasTex = device.createTexture({
      size: [256, 256, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: atlasCanvas },
      { texture: this.glyphAtlasTex },
      [256, 256]
    );
    this.glyphAtlasView = this.glyphAtlasTex.createView();

    // Prop static mesh bundle + storage buffer
    this.propBundle = buildPropGeometryBundle();
    this.propVertBuffer = device.createBuffer({
      size: this.propBundle.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.propVertBuffer, 0, this.propBundle.vertexData);
    this.propIdxBuffer = device.createBuffer({
      size: this.propBundle.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.propIdxBuffer, 0, this.propBundle.indexData);

    this.propStorageBuffer = device.createBuffer({
      size: this.propStaging.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Particle storage buffer
    this.particleStorageBuffer = device.createBuffer({
      size: this.particleStaging.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Dynamic buffers for Skin+Tail, Ears, and Lattice Wireframe
    const skinV = physics?.skinMesh?.vertexCount || 4096;
    const tailV = physics?.tailMesh?.vertexCount || 1024;
    const earV = physics?.earMesh?.vertexCount || 256;
    this.maxCombinedSkinVerts = skinV + tailV + 256;
    this.maxEarVerts = earV + 64;

    this.combinedSkinStaging = new Float32Array(this.maxCombinedSkinVerts * 20);
    this.combinedSkinVertBuffer = device.createBuffer({
      size: this.combinedSkinStaging.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.earStaging = new Float32Array(this.maxEarVerts * 20);
    this.earVertBuffer = device.createBuffer({
      size: this.earStaging.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this._uploadStaticIndices(physics);
  }

  _uploadStaticIndices(physics) {
    const device = this.device;
    const skinIdx = physics?.skinMesh?.indices || new Uint32Array(0);
    const tailIdx = physics?.tailMesh?.indices || new Uint32Array(0);
    const skinVertCount = physics?.skinMesh?.vertexCount || 0;

    const combinedIndices = new Uint32Array(skinIdx.length + tailIdx.length);
    combinedIndices.set(skinIdx, 0);
    for (let i = 0; i < tailIdx.length; i++) {
      combinedIndices[skinIdx.length + i] = tailIdx[i] + skinVertCount;
    }
    this.combinedSkinIndexCount = combinedIndices.length;
    this.combinedSkinIdxBuffer = device.createBuffer({
      size: Math.max(16, ((combinedIndices.byteLength + 3) & ~3)),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    if (combinedIndices.byteLength > 0) {
      device.queue.writeBuffer(this.combinedSkinIdxBuffer, 0, combinedIndices);
    }

    const earIdx = physics?.earMesh?.indices || new Uint32Array(0);
    this.earIndexCount = earIdx.length;
    this.earIdxBuffer = device.createBuffer({
      size: Math.max(16, ((earIdx.byteLength + 3) & ~3)),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    if (earIdx.byteLength > 0) {
      device.queue.writeBuffer(this.earIdxBuffer, 0, earIdx);
    }

    const wireIdx = physics?.latticeWireframeIndices || physics?.wireframeIndices || new Uint32Array(0);
    this.wireIndexCount = wireIdx.length;
    this.wireIdxBuffer = device.createBuffer({
      size: Math.max(16, ((wireIdx.byteLength + 3) & ~3)),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    if (wireIdx.byteLength > 0) {
      device.queue.writeBuffer(this.wireIdxBuffer, 0, wireIdx);
    }

    const pCount = physics?.particleCount || 1024;
    this.wireVertBuffer = device.createBuffer({
      size: Math.max(64, pCount * 12),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  _createPipelines(mods) {
    const device = this.device;
    const shMod = mods.SHADOW_AND_HEIGHT_WGSL;
    const mainMod = mods.MAIN_SCENE_WGSL;
    const postMod = mods.POST_PROCESS_WGSL;

    const skinVertexBufferLayout = {
      arrayStride: 80,
      attributes: [
        { shaderLocation: 0, offset: 0,  format: "float32x4" },
        { shaderLocation: 1, offset: 16, format: "float32x4" },
        { shaderLocation: 2, offset: 32, format: "float32x4" },
        { shaderLocation: 3, offset: 48, format: "float32x4" },
        { shaderLocation: 4, offset: 64, format: "float32x4" },
      ],
    };

    const propVertexBufferLayout = {
      arrayStride: 32,
      attributes: [
        { shaderLocation: 0, offset: 0,  format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
      ],
    };

    // Bind Group Layouts
    this.shadowBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });

    this.mainSceneBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      ],
    });

    this.propBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      ],
    });

    this.particleBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      ],
    });

    this.postBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      ],
    });

    // Static Bind Groups
    this.shadowBG = device.createBindGroup({
      layout: this.shadowBGL,
      entries: [{ binding: 0, resource: { buffer: this.frameUniformBuffer } }],
    });

    this.mainSceneBG = device.createBindGroup({
      layout: this.mainSceneBGL,
      entries: [
        { binding: 0, resource: { buffer: this.frameUniformBuffer } },
        { binding: 1, resource: this.shadowView },
        { binding: 2, resource: this.heightView },
        { binding: 3, resource: this.linearSampler },
      ],
    });

    this.propBG = device.createBindGroup({
      layout: this.propBGL,
      entries: [{ binding: 0, resource: { buffer: this.propStorageBuffer } }],
    });

    this.particleBG = device.createBindGroup({
      layout: this.particleBGL,
      entries: [
        { binding: 0, resource: { buffer: this.particleStorageBuffer } },
        { binding: 1, resource: this.glyphAtlasView },
      ],
    });

    const shadowPipeLayout = device.createPipelineLayout({ bindGroupLayouts: [this.shadowBGL] });
    const mainPipeLayout = device.createPipelineLayout({ bindGroupLayouts: [this.mainSceneBGL] });
    const propPipeLayout = device.createPipelineLayout({ bindGroupLayouts: [this.mainSceneBGL, this.propBGL] });
    const particlePipeLayout = device.createPipelineLayout({ bindGroupLayouts: [this.mainSceneBGL, this.particleBGL] });

    // Pass 1: Key-Light Shadow Pipeline
    this.shadowPipeline = device.createRenderPipeline({
      layout: shadowPipeLayout,
      vertex: { module: shMod, entryPoint: "vs_shadow", buffers: [skinVertexBufferLayout] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less" },
    });

    // Pass 2: Top-Down Height Pipeline
    this.heightPipeline = device.createRenderPipeline({
      layout: shadowPipeLayout,
      vertex: { module: shMod, entryPoint: "vs_height", buffers: [skinVertexBufferLayout] },
      fragment: { module: shMod, entryPoint: "fs_height", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less" },
    });

    const premultBlend = {
      color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    };

    // Subpass 3a: Ground Shadow Catcher
    this.groundPipeline = device.createRenderPipeline({
      layout: mainPipeLayout,
      vertex: { module: mainMod, entryPoint: "vs_ground" },
      fragment: { module: mainMod, entryPoint: "fs_ground", targets: [{ format: "rgba16float", blend: premultBlend }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth32float", depthWriteEnabled: false, depthCompare: "less-equal" },
      multisample: { count: 4 },
    });

    // Subpass 3b: Rigid Props & Face
    this.propPipeline = device.createRenderPipeline({
      layout: propPipeLayout,
      vertex: { module: mainMod, entryPoint: "vs_prop", buffers: [propVertexBufferLayout] },
      fragment: { module: mainMod, entryPoint: "fs_prop", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less-equal" },
      multisample: { count: 4 },
    });

    // Subpass 3c: Felt Ears
    this.feltEarPipeline = device.createRenderPipeline({
      layout: mainPipeLayout,
      vertex: { module: mainMod, entryPoint: "vs_felt_ear", buffers: [skinVertexBufferLayout] },
      fragment: { module: mainMod, entryPoint: "fs_felt_ear", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less-equal" },
      multisample: { count: 4 },
    });

    // Subpass 3d: Fur Base Layer
    this.furBasePipeline = device.createRenderPipeline({
      layout: mainPipeLayout,
      vertex: { module: mainMod, entryPoint: "vs_fur_base", buffers: [skinVertexBufferLayout] },
      fragment: { module: mainMod, entryPoint: "fs_fur_base", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list", cullMode: "back" },
      depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less-equal" },
      multisample: { count: 4 },
    });

    // Subpass 3e: Instanced Fur Shells (with @builtin(sample_mask))
    this.furShellPipeline = device.createRenderPipeline({
      layout: mainPipeLayout,
      vertex: { module: mainMod, entryPoint: "vs_fur_shell", buffers: [skinVertexBufferLayout] },
      fragment: { module: mainMod, entryPoint: "fs_fur_shell", targets: [{ format: "rgba16float" }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less-equal" },
      multisample: { count: 4 },
    });

    // Subpass 3f: Instanced Billboard Particles
    this.particlePipeline = device.createRenderPipeline({
      layout: particlePipeLayout,
      vertex: { module: mainMod, entryPoint: "vs_particle" },
      fragment: { module: mainMod, entryPoint: "fs_particle", targets: [{ format: "rgba16float", blend: premultBlend }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth32float", depthWriteEnabled: false, depthCompare: "less-equal" },
      multisample: { count: 4 },
    });

    // Subpass 3g: Wireframe Lattice
    this.wireframePipeline = device.createRenderPipeline({
      layout: mainPipeLayout,
      vertex: {
        module: mainMod,
        entryPoint: "vs_wireframe",
        buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] }],
      },
      fragment: { module: mainMod, entryPoint: "fs_wireframe", targets: [{ format: "rgba16float", blend: premultBlend }] },
      primitive: { topology: "line-list" },
      depthStencil: { format: "depth32float", depthWriteEnabled: false, depthCompare: "always" },
      multisample: { count: 4 },
    });

    // Pass 4: Post-Processing Pipeline
    this.postPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.postBGL] }),
      vertex: { module: postMod, entryPoint: "vs_post" },
      fragment: { module: postMod, entryPoint: "fs_post", targets: [{ format: this.canvasFormat }] },
      primitive: { topology: "triangle-list" },
    });
  }

  _ensureRenderTargets() {
    if (!this.canvas || !this.device) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.resolutionScale;
    const clientW = Math.max(1, this.canvas.clientWidth || window.innerWidth || 1280);
    const clientH = Math.max(1, this.canvas.clientHeight || window.innerHeight || 720);
    const w = Math.max(64, Math.round(clientW * dpr));
    const h = Math.max(64, Math.round(clientH * dpr));

    if (w === this.targetWidth && h === this.targetHeight && this.msaaColorTex) {
      return;
    }

    this.targetWidth = w;
    this.targetHeight = h;
    this.canvas.width = w;
    this.canvas.height = h;

    if (this.msaaColorTex) this.msaaColorTex.destroy();
    if (this.hdrResolvedTex) this.hdrResolvedTex.destroy();
    if (this.msaaDepthTex) this.msaaDepthTex.destroy();

    this.msaaColorTex = this.device.createTexture({
      size: [w, h],
      sampleCount: 4,
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.msaaColorView = this.msaaColorTex.createView();

    this.hdrResolvedTex = this.device.createTexture({
      size: [w, h],
      sampleCount: 1,
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.hdrResolvedView = this.hdrResolvedTex.createView();

    this.msaaDepthTex = this.device.createTexture({
      size: [w, h],
      sampleCount: 4,
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.msaaDepthView = this.msaaDepthTex.createView();

    this.postBG = this.device.createBindGroup({
      layout: this.postBGL,
      entries: [
        { binding: 0, resource: { buffer: this.frameUniformBuffer } },
        { binding: 1, resource: this.hdrResolvedView },
      ],
    });
  }

  setCoat(coatName) {
    const key = String(coatName || "midnight").toLowerCase();
    if (PLUSH_COAT_PALETTES[key]) {
      this.coatName = key;
    }
  }

  setPile(val0to100) {
    this.pileValue = Math.max(0, Math.min(100, Number(val0to100) || 0));
  }

  setQualityLevel(level0to3) {
    const idx = Math.max(0, Math.min(3, Math.round(Number(level0to3) || 0)));
    this.qualityLevel = idx;
    this.resolutionScale = QUALITY_PRESETS[idx].scale;
    this.shellCount = QUALITY_PRESETS[idx].shells;
  }

  setShowMesh(flag) {
    this.showMesh = Boolean(flag);
  }

  spawnParticles(type, position, count = 4) {
    const origin = position || [0, 1.1, 0.25];
    const kind = String(type || "sparkle").toLowerCase();
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles - 6) {
        this.particles.shift();
      }
      const angle = Math.random() * Math.PI * 2;
      const spread = 0.08 + Math.random() * 0.14;
      let vx = Math.cos(angle) * (0.2 + Math.random() * 0.35);
      let vy = 0.35 + Math.random() * 0.45;
      let vz = Math.sin(angle) * (0.2 + Math.random() * 0.35);
      let maxLife = 1.1 + Math.random() * 0.7;
      let size = 0.11 + Math.random() * 0.06;
      let color = [1.0, 0.65, 0.30];
      let uvRect = [0.0, 0.5, 0.5, 0.5]; // default quadrant 2: sparkle

      if (kind === "heart") {
        uvRect = [0.0, 0.0, 0.5, 0.5];
        color = Math.random() < 0.65 ? [1.0, 0.48, 0.68] : [1.0, 0.76, 0.36];
        vx *= 0.45; vz *= 0.45; vy = 0.38 + Math.random() * 0.25;
        size = 0.22 + Math.random() * 0.08;
        maxLife = 1.65 + Math.random() * 0.5;
      } else if (kind === "z") {
        uvRect = [0.5, 0.0, 0.5, 0.5];
        color = [0.86, 0.82, 1.0];
        vx = 0.10 + Math.random() * 0.10;
        vy = 0.28 + Math.random() * 0.18;
        vz *= 0.25;
        size = 0.24 + Math.random() * 0.08;
        maxLife = 1.95 + Math.random() * 0.6;
      } else if (kind === "tuft") {
        uvRect = [0.5, 0.5, 0.5, 0.5];
        const pal = PLUSH_COAT_PALETTES[this.coatName] || PLUSH_COAT_PALETTES.midnight;
        color = [pal.tip[0] * 1.9 + 0.28, pal.tip[1] * 1.9 + 0.28, pal.tip[2] * 1.9 + 0.34];
        vx *= 1.6; vz *= 1.6; vy = 0.22 + Math.random() * 0.55;
        size = 0.17 + Math.random() * 0.06;
        maxLife = 1.05 + Math.random() * 0.45;
      } else {
        size = 0.20 + Math.random() * 0.08;
      }

      this.particles.push({
        kind,
        pos: [
          origin[0] + (Math.random() - 0.5) * spread * 1.35,
          origin[1] + (Math.random() - 0.5) * spread * 1.15,
          origin[2] + (Math.random() - 0.5) * spread,
        ],
        vel: [vx, vy, vz],
        age: 0.18 + Math.random() * 0.15,
        maxLife,
        size,
        rot: (Math.random() - 0.5) * 0.35,
        rotVel: (Math.random() - 0.5) * 1.2,
        color,
        uvRect,
      });
    }
  }

  _packDynamicMeshes(physics) {
    const skin = physics?.skinMesh;
    const tail = physics?.tailMesh;
    const ears = physics?.earMesh;
    if (!skin) return;

    const skinV = skin.vertexCount || 0;
    const tailV = tail?.vertexCount || 0;
    const totalV = skinV + tailV;
    if (totalV > this.maxCombinedSkinVerts) return;

    const dst = this.combinedSkinStaging;
    // Pack skinMesh
    {
      const pos = skin.positions;
      const norm = skin.normals;
      const rPos = skin.restPositions || pos;
      const comb = skin.combAndRegion;
      const tip = skin.dynTipOffsets;
      for (let i = 0; i < skinV; i++) {
        const i3 = i * 3, i4 = i * 4, o = i * 20;
        dst[o]     = pos[i3];     dst[o + 1] = pos[i3 + 1]; dst[o + 2] = pos[i3 + 2];
        dst[o + 3] = tip ? tip[i4 + 3] : 0.0; // seamWeight
        dst[o + 4] = norm[i3];    dst[o + 5] = norm[i3 + 1]; dst[o + 6] = norm[i3 + 2];
        dst[o + 7] = comb ? comb[i4 + 3] : 0.0; // regionCode
        dst[o + 8] = rPos[i3];    dst[o + 9] = rPos[i3 + 1]; dst[o + 10] = rPos[i3 + 2];
        dst[o + 11] = 0.0; // isTail = 0
        dst[o + 12] = comb ? comb[i4] : 0.0;
        dst[o + 13] = comb ? comb[i4 + 1] : -0.5;
        dst[o + 14] = comb ? comb[i4 + 2] : 0.0;
        dst[o + 15] = 0.0;
        dst[o + 16] = tip ? tip[i4] : 0.0;
        dst[o + 17] = tip ? tip[i4 + 1] : 0.0;
        dst[o + 18] = tip ? tip[i4 + 2] : 0.0;
        dst[o + 19] = 0.0;
      }
    }
    // Pack tailMesh immediately after skinMesh
    if (tail && tailV > 0) {
      const pos = tail.positions;
      const norm = tail.normals;
      const rPos = tail.restPositions || pos;
      const comb = tail.combAndRegion;
      const tip = tail.dynTipOffsets;
      for (let i = 0; i < tailV; i++) {
        const i3 = i * 3, i4 = i * 4, o = (skinV + i) * 20;
        dst[o]     = pos[i3];     dst[o + 1] = pos[i3 + 1]; dst[o + 2] = pos[i3 + 2];
        dst[o + 3] = tip ? tip[i4 + 3] : 0.0;
        dst[o + 4] = norm[i3];    dst[o + 5] = norm[i3 + 1]; dst[o + 6] = norm[i3 + 2];
        dst[o + 7] = comb ? comb[i4 + 3] : 4.0;
        dst[o + 8] = rPos[i3];    dst[o + 9] = rPos[i3 + 1]; dst[o + 10] = rPos[i3 + 2];
        dst[o + 11] = 1.0; // isTail = 1
        dst[o + 12] = comb ? comb[i4] : 0.0;
        dst[o + 13] = comb ? comb[i4 + 1] : 0.0;
        dst[o + 14] = comb ? comb[i4 + 2] : -0.5;
        dst[o + 15] = 0.0;
        dst[o + 16] = tip ? tip[i4] : 0.0;
        dst[o + 17] = tip ? tip[i4 + 1] : 0.0;
        dst[o + 18] = tip ? tip[i4 + 2] : 0.0;
        dst[o + 19] = 0.0;
      }
    }
    this.device.queue.writeBuffer(this.combinedSkinVertBuffer, 0, dst.buffer, 0, totalV * 80);

    // Pack earMesh
    if (ears && ears.vertexCount > 0 && ears.vertexCount <= this.maxEarVerts) {
      const ev = ears.vertexCount;
      const eDst = this.earStaging;
      const pos = ears.positions;
      const norm = ears.normals;
      const uvs = ears.uvsAndSide;
      for (let i = 0; i < ev; i++) {
        const i3 = i * 3, i4 = i * 4, o = i * 20;
        eDst[o]     = pos[i3];     eDst[o + 1] = pos[i3 + 1]; eDst[o + 2] = pos[i3 + 2];
        eDst[o + 3] = uvs ? uvs[i4 + 2] : 0.0; // isInnerPink
        eDst[o + 4] = norm[i3];    eDst[o + 5] = norm[i3 + 1]; eDst[o + 6] = norm[i3 + 2];
        eDst[o + 7] = uvs ? uvs[i4 + 3] : 0.0; // edgeStitch
        eDst[o + 8] = uvs ? uvs[i4] : 0.0;
        eDst[o + 9] = uvs ? uvs[i4 + 1] : 0.0;
        eDst[o + 10] = 0.0; eDst[o + 11] = 0.0;
      }
      this.device.queue.writeBuffer(this.earVertBuffer, 0, eDst.buffer, 0, ev * 80);
    }

    if (this.showMesh && physics.pos) {
      this.device.queue.writeBuffer(this.wireVertBuffer, 0, physics.pos);
    }
  }

  _packProps(physics, expressionId, blinkSquash) {
    const att = physics?.attachments || {};
    const buf = this.propStaging;
    buf.fill(0);
    this.propDrawCalls = [];
    let slot = 0;

    const writeProp = (meshName, pos, rot3, scaleXYZ, colorRGB, matType, active = true) => {
      if (slot >= this.maxProps) return;
      const range = this.propBundle.ranges[meshName];
      if (!range) return;
      const base = slot * 40;
      const [sx, sy, sz] = scaleXYZ;
      // modelMat (col-major)
      buf[base + 0]  = rot3[0] * sx; buf[base + 1]  = rot3[3] * sx; buf[base + 2]  = rot3[6] * sx; buf[base + 3]  = 0;
      buf[base + 4]  = rot3[1] * sy; buf[base + 5]  = rot3[4] * sy; buf[base + 6]  = rot3[7] * sy; buf[base + 7]  = 0;
      buf[base + 8]  = rot3[2] * sz; buf[base + 9]  = rot3[5] * sz; buf[base + 10] = rot3[8] * sz; buf[base + 11] = 0;
      buf[base + 12] = pos[0];       buf[base + 13] = pos[1];       buf[base + 14] = pos[2];       buf[base + 15] = 1;
      // normMat (pure rotation for undistorted specular/catchlights)
      buf[base + 16] = rot3[0]; buf[base + 17] = rot3[3]; buf[base + 18] = rot3[6]; buf[base + 19] = 0;
      buf[base + 20] = rot3[1]; buf[base + 21] = rot3[4]; buf[base + 22] = rot3[7]; buf[base + 23] = 0;
      buf[base + 24] = rot3[2]; buf[base + 25] = rot3[5]; buf[base + 26] = rot3[8]; buf[base + 27] = 0;
      buf[base + 28] = 0;       buf[base + 29] = 0;       buf[base + 30] = 0;       buf[base + 31] = 1;
      // colorAndMat
      buf[base + 32] = colorRGB[0];
      buf[base + 33] = colorRGB[1];
      buf[base + 34] = colorRGB[2];
      buf[base + 35] = matType;
      // extraParams
      buf[base + 36] = 0;
      buf[base + 37] = 0;
      buf[base + 38] = 0;
      buf[base + 39] = active ? 1.0 : 0.0;

      if (active) {
        this.propDrawCalls.push({ firstIndex: range.firstIndex, indexCount: range.indexCount, instanceIndex: slot });
      }
      slot++;
    };

    const eyeR = 0.112;
    const eyeVisible = expressionId !== 3;
    const leftEyeAtt = att.leftEye || { pos: [-0.155, 1.38, 0.42] };
    const rightEyeAtt = att.rightEye || { pos: [0.155, 1.38, 0.42] };
    writeProp("sphere", leftEyeAtt.pos, rotMat3FromFrame(leftEyeAtt), [eyeR, eyeR * blinkSquash, eyeR * 0.78], [1, 1, 1], 1, eyeVisible);
    writeProp("sphere", rightEyeAtt.pos, rotMat3FromFrame(rightEyeAtt), [eyeR, eyeR * blinkSquash, eyeR * 0.78], [1, 1, 1], 1, eyeVisible);

    // Pink felt nose
    const noseAtt = att.nose || { pos: [0.0, 1.33, 0.48] };
    writeProp("nose", noseAtt.pos, rotMat3FromFrame(noseAtt), [1, 1, 1], [0.92, 0.46, 0.56], 2, true);

    // Embroidered expressions (0 = ω, 1 = o, 2 = ^ + tongue, 3 = u u closed eyes + ω smile)
    const mouthAtt = att.mouth || { pos: [0.0, 1.26, 0.46] };
    const mouthRot = rotMat3FromFrame(mouthAtt);
    const threadCol = this.coatName === "tuxedo" ? [0.22, 0.16, 0.20] : [0.90, 0.68, 0.74];
    writeProp("mouthW", mouthAtt.pos, mouthRot, [1, 1, 1], threadCol, 3, expressionId === 0 || expressionId === 3);
    writeProp("mouthO", mouthAtt.pos, mouthRot, [1, 1, 1], threadCol, 3, expressionId === 1);
    writeProp("mouthCaret", mouthAtt.pos, mouthRot, [1, 1, 1], threadCol, 3, expressionId === 2);
    writeProp("tongue", mouthAtt.pos, mouthRot, [1, 1, 1], [0.94, 0.40, 0.50], 2, expressionId === 2);
    writeProp("closedEyesUU", mouthAtt.pos, mouthRot, [1, 1, 1], threadCol, 3, expressionId === 3);

    // Soft pink embroidered blush + 3 whiskers per cheek
    const lCheek = att.leftCheek || { pos: [-0.23, 1.30, 0.37] };
    const rCheek = att.rightCheek || { pos: [0.23, 1.30, 0.37] };
    const whiskerCol = this.coatName === "midnight" ? [0.36, 0.40, 0.58] : [0.82, 0.80, 0.86];
    writeProp("blushL", lCheek.pos, rotMat3FromFrame(lCheek), [1, 1, 1], [0.85, 0.38, 0.48], 2, true);
    writeProp("blushR", rCheek.pos, rotMat3FromFrame(rCheek), [1, 1, 1], [0.85, 0.38, 0.48], 2, true);
    writeProp("whiskersL", lCheek.pos, rotMat3FromFrame(lCheek), [1, 1, 1], whiskerCol, 3, true);
    writeProp("whiskersR", rCheek.pos, rotMat3FromFrame(rCheek), [1, 1, 1], whiskerCol, 3, true);

    // Dark-purple velvet collar
    const collarAtt = att.collar || { pos: [0.0, 1.04, 0.08] };
    writeProp("collar", collarAtt.pos, rotMat3FromFrame(collarAtt), [1, 1, 1], [0.22, 0.09, 0.34], 4, true);

    // Metallic brass bell with orthonormal basis
    const bell = att.bell || { pos: [0.0, 0.92, 0.42], anchorPos: [0.0, 1.03, 0.40], radius: 0.11 };
    const bRad = bell.radius || 0.11;
    let bRot = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (bell.anchorPos) {
      let ux = bell.anchorPos[0] - bell.pos[0];
      let uy = bell.anchorPos[1] - bell.pos[1];
      let uz = bell.anchorPos[2] - bell.pos[2];
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      let rx = uz, ry = 0, rz = -ux;
      const rl = Math.hypot(rx, ry, rz) || 1;
      rx /= rl; rz /= rl;
      const fx = uy * rz - uz * ry;
      const fy = uz * rx - ux * rz;
      const fz = ux * ry - uy * rx;
      bRot = [rx, ux, fx, ry, uy, fy, rz, uz, fz];
    }
    writeProp("sphere", bell.pos, bRot, [bRad, bRad, bRad], [0.96, 0.74, 0.30], 5, true);

    // Felt toy mouse on a string
    const mouse = att.mouseToy;
    if (mouse && mouse.active) {
      const yaw = mouse.yaw || 0;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const mRot = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
      writeProp("mouseBody", mouse.pos, mRot, [1, 1, 1], [0.68, 0.64, 0.62], 2, true);
      if (mouse.stringAnchor) {
        let ux = mouse.stringAnchor[0] - mouse.pos[0];
        let uy = mouse.stringAnchor[1] - mouse.pos[1];
        let uz = mouse.stringAnchor[2] - mouse.pos[2];
        const sLen = Math.hypot(ux, uy, uz) || 0.01;
        ux /= sLen; uy /= sLen; uz /= sLen;
        let rx = uz, ry = 0, rz = -ux;
        const rl = Math.hypot(rx, ry, rz) || 1;
        rx /= rl; rz /= rl;
        const fx = uy * rz - uz * ry;
        const fy = uz * rx - ux * rz;
        const fz = ux * ry - uy * rx;
        const sRot = [rx, ux, fx, ry, uy, fy, rz, uz, fz];
        writeProp("unitString", mouse.pos, sRot, [1, sLen, 1], [0.85, 0.78, 0.68], 3, true);
      }
    }

    this.device.queue.writeBuffer(this.propStorageBuffer, 0, buf);
  }

  _updateAndPackParticles(physics, animState, dt, expressionId) {
    const stepDt = Math.min(Math.max(dt || 0.016, 0.001), 0.08);
    const att = physics?.attachments || {};
    const headPos = att.nose?.pos || [0, 1.35, 0.42];
    const bell = att.bell || { pos: [0, 0.92, 0.42], swingSpeed: 0 };
    const mouse = att.mouseToy;

    if (physics && Array.isArray(physics.pendingParticles)) {
      while (physics.pendingParticles.length > 0) {
        const pp = physics.pendingParticles.shift();
        if (pp && pp.type && pp.position) {
          this.spawnParticles(pp.type, pp.position, pp.count || 4);
        }
      }
    }

    this.emitAccum += stepDt;
    if (this.emitAccum > 0.22) {
      this.emitAccum = 0;
      const isPurring = Boolean(animState?.isPurring || physics?.activeAction === "purr");
      const isNapping = Boolean(animState?.isNapping || physics?.activeAction === "nap" || expressionId === 3);
      if (isPurring && Math.random() < 0.75) {
        this.spawnParticles("heart", [headPos[0], headPos[1] + 0.35, headPos[2]], 1);
      }
      if (isNapping && Math.random() < 0.65) {
        this.spawnParticles("z", [headPos[0] + 0.12, headPos[1] + 0.32, headPos[2]], 1);
      }
      if ((bell.swingSpeed || 0) > 0.45) {
        this.spawnParticles("sparkle", bell.pos, 1);
      }
      if (mouse && mouse.active && Math.random() < 0.7) {
        this.spawnParticles("sparkle", mouse.pos, 1);
      }
    }

    // Update live particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += stepDt;
      if (p.age >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.pos[0] += p.vel[0] * stepDt + Math.sin(this.time * 3.5 + i) * 0.06 * stepDt;
      p.pos[1] += p.vel[1] * stepDt;
      p.pos[2] += p.vel[2] * stepDt;
      if (p.kind === "tuft") {
        p.vel[1] -= 1.4 * stepDt;
      }
      p.rot += p.rotVel * stepDt;
    }

    const buf = this.particleStaging;
    buf.fill(0);
    let count = 0;

    for (let i = 0; i < this.particles.length && count < this.maxParticles - 4; i++) {
      const p = this.particles[i];
      const lifeFrac = p.age / p.maxLife;
      const fade = Math.min(1.0, 0.55 + lifeFrac * 3.0) * (1.0 - Math.pow(lifeFrac, 1.8));
      const base = count * 16;
      buf[base + 0] = p.pos[0];
      buf[base + 1] = p.pos[1];
      buf[base + 2] = p.pos[2];
      buf[base + 3] = p.size * (0.75 + 0.35 * Math.sin(lifeFrac * Math.PI));
      buf[base + 4] = p.color[0];
      buf[base + 5] = p.color[1];
      buf[base + 6] = p.color[2];
      buf[base + 7] = p.rot;
      buf[base + 8] = p.uvRect[0];
      buf[base + 9] = p.uvRect[1];
      buf[base + 10] = p.uvRect[2];
      buf[base + 11] = p.uvRect[3];
      buf[base + 12] = Math.max(0, fade * 0.98);
      buf[base + 13] = 0;
      count++;
    }

    // Subtle soft bloom halo sprites on brass bell & open glass eyes
    const pushHalo = (pos, size, color, alpha) => {
      if (count >= this.maxParticles) return;
      const base = count * 16;
      buf[base + 0] = pos[0];
      buf[base + 1] = pos[1];
      buf[base + 2] = pos[2];
      buf[base + 3] = size;
      buf[base + 4] = color[0];
      buf[base + 5] = color[1];
      buf[base + 6] = color[2];
      buf[base + 7] = this.time * 0.35;
      buf[base + 8] = 0.0;
      buf[base + 9] = 0.5;
      buf[base + 10] = 0.5;
      buf[base + 11] = 0.5;
      buf[base + 12] = alpha;
      buf[base + 13] = 1.0;
      count++;
    };

    if (bell.pos) {
      pushHalo(bell.pos, 0.24, [1.0, 0.72, 0.32], 0.22);
    }
    if (expressionId !== 3) {
      const eyeGlowCol = this.coatName === "smoke" ? [0.25, 0.95, 0.55] : [1.0, 0.72, 0.22];
      if (att.leftEye?.pos) pushHalo(att.leftEye.pos, 0.21, eyeGlowCol, 0.16);
      if (att.rightEye?.pos) pushHalo(att.rightEye.pos, 0.21, eyeGlowCol, 0.16);
    }

    this.activeParticleCount = count;
    if (count > 0) {
      this.device.queue.writeBuffer(this.particleStorageBuffer, 0, buf.buffer, 0, count * 64);
    }
  }

  render(cameraState, physics, animState = {}, dt = 0.016) {
    if (!this.device || !this.context || !physics) return;
    this._ensureRenderTargets();

    const stepDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);
    this.time += stepDt;

    // Boundary normalization for cameraState
    const eye = cameraState?.eye || [0, 1.42, 4.15];
    const target = cameraState?.target || [0, 0.95, 0];
    const up = cameraState?.up || [0, 1, 0];
    const rawFov = cameraState?.fov || 38;
    const fovRad = rawFov > Math.PI ? (rawFov * Math.PI) / 180 : rawFov;
    const aspect = cameraState?.aspect || (this.targetWidth / Math.max(1, this.targetHeight));
    const shiftX = cameraState?.shiftX || 0;
    const shiftY = cameraState?.shiftY || 0;

    mat4LookAt(this.viewMat, eye, target, up);
    mat4PerspectiveZO(this.projMat, fovRad, aspect, cameraState?.near || 0.1, cameraState?.far || 60.0, shiftX, shiftY);
    mat4Multiply(this.viewProjMat, this.projMat, this.viewMat);

    // Moonlight Key-Light ortho view-proj centered on cat COM
    const com = physics.com || [0, 0.95, 0];
    const lightDir = [-0.35, 0.78, -0.52];
    const lLen = Math.hypot(lightDir[0], lightDir[1], lightDir[2]);
    lightDir[0] /= lLen; lightDir[1] /= lLen; lightDir[2] /= lLen;
    const lightEye = [com[0] + lightDir[0] * 5.0, com[1] + lightDir[1] * 5.0, com[2] + lightDir[2] * 5.0];
    mat4LookAt(this.lightViewMat, lightEye, com, [0, 1, 0]);
    mat4OrthoZO(this.lightProjMat, -2.2, 2.2, -2.2, 2.2, 0.5, 11.5);
    mat4Multiply(this.lightViewProjMat, this.lightProjMat, this.lightViewMat);

    // Top-Down Height Map ortho view-proj
    const heightHalfExtent = 1.65;
    mat4LookAt(this.heightViewMat, [com[0], 4.0, com[2]], [com[0], 0.0, com[2]], [0, 0, -1]);
    mat4OrthoZO(this.heightProjMat, -heightHalfExtent, heightHalfExtent, -heightHalfExtent, heightHalfExtent, 0.2, 5.0);
    mat4Multiply(this.heightViewProjMat, this.heightProjMat, this.heightViewMat);

    // Normalize expression & eye animation state
    let expressionId = 0;
    const rawExpr = animState?.expressionId ?? animState?.expression ?? physics?.expression;
    if (typeof rawExpr === "number") {
      expressionId = rawExpr;
    } else if (typeof rawExpr === "string") {
      const s = rawExpr.toLowerCase();
      if (s === "o" || s === "surprised") expressionId = 1;
      else if (s === "^" || s === "arch" || s === "hiss") expressionId = 2;
      else if (s === "uu" || s === "u u" || s === "sleep" || s === "nap" || s === "purr") expressionId = 3;
    } else if (animState?.isNapping || animState?.isPurring) {
      expressionId = 3;
    } else if (animState?.isArching) {
      expressionId = 2;
    }

    // Automatic blink & slow-blink timer (unless overridden by animState.blinkSquash)
    this.blinkTimer -= stepDt;
    if (this.blinkTimer <= 0) {
      this.blinkPhase = 1.0;
      this.blinkTimer = 2.4 + Math.random() * 3.4;
    }
    if (this.blinkPhase > 0) {
      const speed = animState?.isPurring ? 2.8 : 6.8; // Slow-blink when content/purring
      this.blinkPhase = Math.max(0, this.blinkPhase - stepDt * speed);
    }
    const autoSquash = 1.0 - Math.sin(this.blinkPhase * Math.PI) * 0.90;
    const blinkSquash = animState?.blinkSquash !== undefined ? animState.blinkSquash : autoSquash;

    let pupilWidth = animState?.pupilWidth ?? 0.42;
    if (animState?.isArching || animState?.isPouncing || expressionId === 1 || expressionId === 2) {
      pupilWidth = 0.72;
    }

    if (animState?.showMesh !== undefined) {
      this.showMesh = Boolean(animState.showMesh);
    }

    const pal = PLUSH_COAT_PALETTES[this.coatName] || PLUSH_COAT_PALETTES.midnight;
    const pileLength = 0.032 + (this.pileValue / 100) * 0.062;

    // Pack 400-byte FrameUniforms
    const fd = this.frameData;
    fd.set(this.viewProjMat, 0);
    fd.set(this.viewMat, 16);
    fd.set(this.lightViewProjMat, 32);
    fd.set(this.heightViewProjMat, 48);
    fd[64] = eye[0]; fd[65] = eye[1]; fd[66] = eye[2]; fd[67] = this.time;
    fd[68] = lightDir[0]; fd[69] = lightDir[1]; fd[70] = lightDir[2]; fd[71] = pileLength;
    fd[72] = com[0]; fd[73] = com[1]; fd[74] = com[2]; fd[75] = this.shellCount;
    fd[76] = pal.root[0]; fd[77] = pal.root[1]; fd[78] = pal.root[2]; fd[79] = pal.id;
    fd[80] = pal.base[0]; fd[81] = pal.base[1]; fd[82] = pal.base[2]; fd[83] = 1.18; // exposure = 1.18
    fd[84] = pal.tip[0];  fd[85] = pal.tip[1];  fd[86] = pal.tip[2];  fd[87] = this.isSrgbFormat ? 1.0 : 0.0;
    fd[88] = com[0]; fd[89] = com[2]; fd[90] = 1.0 / heightHalfExtent; fd[91] = pupilWidth;
    // Camera right & up from viewMat rows
    fd[92] = this.viewMat[0]; fd[93] = this.viewMat[4]; fd[94] = this.viewMat[8];  fd[95] = blinkSquash;
    fd[96] = this.viewMat[1]; fd[97] = this.viewMat[5]; fd[98] = this.viewMat[9];  fd[99] = expressionId;

    this.device.queue.writeBuffer(this.frameUniformBuffer, 0, fd);

    this._packDynamicMeshes(physics);
    this._packProps(physics, expressionId, blinkSquash);
    this._updateAndPackParticles(physics, animState, stepDt, expressionId);

    const encoder = this.device.createCommandEncoder();

    // Pass 1: Key-Light Shadow Map (1536x1536 depth32float)
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: this.shadowView,
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      pass.setPipeline(this.shadowPipeline);
      pass.setBindGroup(0, this.shadowBG);
      if (this.combinedSkinIndexCount > 0) {
        pass.setVertexBuffer(0, this.combinedSkinVertBuffer);
        pass.setIndexBuffer(this.combinedSkinIdxBuffer, "uint32");
        pass.drawIndexed(this.combinedSkinIndexCount);
      }
      if (this.earIndexCount > 0) {
        pass.setVertexBuffer(0, this.earVertBuffer);
        pass.setIndexBuffer(this.earIdxBuffer, "uint32");
        pass.drawIndexed(this.earIndexCount);
      }
      pass.end();
    }

    // Pass 2: Top-Down Height Map (256x256 rgba16float)
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.heightView,
          clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        }],
        depthStencilAttachment: {
          view: this.heightDepthView,
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      pass.setPipeline(this.heightPipeline);
      pass.setBindGroup(0, this.shadowBG);
      if (this.combinedSkinIndexCount > 0) {
        pass.setVertexBuffer(0, this.combinedSkinVertBuffer);
        pass.setIndexBuffer(this.combinedSkinIdxBuffer, "uint32");
        pass.drawIndexed(this.combinedSkinIndexCount);
      }
      pass.end();
    }

    // Pass 3: Main Pass (4x MSAA HDR rgba16float resolved to hdrResolvedView)
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.msaaColorView,
          resolveTarget: this.hdrResolvedView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          loadOp: "clear",
          storeOp: "discard",
        }],
        depthStencilAttachment: {
          view: this.msaaDepthView,
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "discard",
        },
      });

      pass.setBindGroup(0, this.mainSceneBG);

      // Subpass 3a: Ground Shadow Catcher on y = 0
      pass.setPipeline(this.groundPipeline);
      pass.draw(6);

      // Subpass 3b: Rigidly Attached Props & Face
      if (this.propDrawCalls.length > 0) {
        pass.setPipeline(this.propPipeline);
        pass.setBindGroup(1, this.propBG);
        pass.setVertexBuffer(0, this.propVertBuffer);
        pass.setIndexBuffer(this.propIdxBuffer, "uint32");
        for (let i = 0; i < this.propDrawCalls.length; i++) {
          const dc = this.propDrawCalls[i];
          pass.drawIndexed(dc.indexCount, 1, dc.firstIndex, 0, dc.instanceIndex);
        }
      }

      // Subpass 3c: Felt Ears
      if (this.earIndexCount > 0) {
        pass.setPipeline(this.feltEarPipeline);
        pass.setVertexBuffer(0, this.earVertBuffer);
        pass.setIndexBuffer(this.earIdxBuffer, "uint32");
        pass.drawIndexed(this.earIndexCount);
      }

      // Subpass 3d & 3e: Fur Base Layer + Instanced Fur Shells
      if (this.combinedSkinIndexCount > 0) {
        pass.setVertexBuffer(0, this.combinedSkinVertBuffer);
        pass.setIndexBuffer(this.combinedSkinIdxBuffer, "uint32");

        pass.setPipeline(this.furBasePipeline);
        pass.drawIndexed(this.combinedSkinIndexCount);

        pass.setPipeline(this.furShellPipeline);
        pass.drawIndexed(this.combinedSkinIndexCount, this.shellCount);
      }

      // Subpass 3f: Instanced Billboard Particles & Soft Bloom Halos
      if (this.activeParticleCount > 0) {
        pass.setPipeline(this.particlePipeline);
        pass.setBindGroup(1, this.particleBG);
        pass.draw(6, this.activeParticleCount);
      }

      // Subpass 3g: Optional Simulation Lattice Wireframe ("Mesh" toggle)
      if (this.showMesh && this.wireIndexCount > 0) {
        pass.setPipeline(this.wireframePipeline);
        pass.setVertexBuffer(0, this.wireVertBuffer);
        pass.setIndexBuffer(this.wireIdxBuffer, "uint32");
        pass.drawIndexed(this.wireIndexCount);
      }

      pass.end();
    }

    // Pass 4: Post-Processing Pass (Full-Screen Triangle to Swapchain)
    {
      const swapView = this.context.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: swapView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(this.postPipeline);
      pass.setBindGroup(0, this.postBG);
      pass.draw(3);
      pass.end();
    }

    this.device.queue.submit([encoder.finish()]);
  }
}