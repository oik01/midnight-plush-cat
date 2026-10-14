// ============================================================================
// PART 2: SDF MESH EXTRACTION (SURFACE NETS) & XPBD SOFT-BODY PHYSICS ENGINE
// Defines class PlushPhysicsEngine (concatenated into main module bundle)
// ============================================================================

class PlushPhysicsEngine {
  constructor() {
    this.totalMassGrams = 340;
    this.stuffingValue = 55;
    this.moodValue = 50;
    this.volumeRatio = 1.0;

    this.com = [0.0, 0.92, 0.04];
    this.restCom = [0.0, 0.92, 0.04];
    this.bodyOrientation = [0.0, 0.0, 0.0, 1.0];
    this.goalRotation = [0.0, 0.0, 0.0, 1.0];
    this.currentYaw = 0.0;

    this.isScruffGrabbed = false;
    this.isSleeping = false;
    this.calmTimer = 0.0;
    this.simTime = 0.0;

    this.furPuffScale = 1.0;
    this.mouthMode = 'w'; // 'w' | 'o' | '^'
    this.eyesClosed = false;
    this.blinkAmount = 0.0;
    this.blinkTimer = 2.8;
    this.pupilScale = 0.48; // 0 = narrow vertical slit, 1 = wide dilated round

    this.isProwling = false;
    this.isArching = false;
    this.isPurring = false;
    this.isNapping = false;
    this.activeAction = null;
    this.actionTime = 0.0;
    this.actionPhase = 'idle';
    this.toppleDirIndex = 0;

    this.purrCount = 0;
    this.pounceCount = 0;
    this.pendingParticles = [];
    this.particleEmitAccum = 0.0;

    this.trotTarget = null; // { x, z } when trotting to a tapped floor point
    this.headTrackYaw = 0.0;
    this.headTrackPitch = 0.0;
    this.headbuttLean = [0.0, 0.0, 0.0];
    this.combBackAccum = 0.0;
    this.restBodyHeight = 2.092;
    this.spineArchAmount = 0.0;
    this.currentSquashStretch = 1.0;
    this.scruffImpactTimer = 0.0;

    this.grabState = {
      active: false,
      type: null, // 'body' | 'scruff' | 'ear' | 'tail' | 'bell'
      targetPos: [0, 0, 0],
      grabOffset: [0, 0, 0],
      weights: null,
      earIndex: -1,
      tailIndex: -1
    };

    this._buildGeometryAndLattice();
    this._buildClothEars();
    this._buildRopeTail();
    this._buildAttachments();
    this.smoothFur();
    this._updateDeformedSkinAndAttachments(1 / 60, true);
  }

  // --------------------------------------------------------------------------
  // 1. CONTINUOUS STUFFED CAT SDF & ANATOMICAL REGION MAP IN REST SPACE
  // --------------------------------------------------------------------------

  static _smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0.0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }

  static _smax(a, b, k) {
    return -PlushPhysicsEngine._smin(-a, -b, k);
  }

  static _sdEllipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
    const dx = (px - cx) / rx;
    const dy = (py - cy) / ry;
    const dz = (pz - cz) / rz;
    const k0 = Math.hypot(dx, dy, dz);
    if (k0 < 1e-6) return -Math.min(rx, ry, rz);
    const k1 = Math.hypot(dx / rx, dy / ry, dz / rz);
    return k0 * (k0 - 1.0) / k1;
  }

  static _sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
    const pax = px - ax, pay = py - ay, paz = pz - az;
    const bax = bx - ax, bay = by - ay, baz = bz - az;
    const dotBA = bax * bax + bay * bay + baz * baz;
    const h = Math.max(0.0, Math.min(1.0, (pax * bax + pay * bay + paz * baz) / (dotBA || 1e-6)));
    return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
  }

  evalCatSDF(x, y, z) {
    const smin = PlushPhysicsEngine._smin;
    const smax = PlushPhysicsEngine._smax;
    const ell = PlushPhysicsEngine._sdEllipsoid;
    const cap = PlushPhysicsEngine._sdCapsule;

    // Big round baby-schema head (~45% of total height, slightly wider than tall)
    const dHeadMain = ell(x, y, z, 0.0, 1.58, 0.10, 0.58, 0.51, 0.52);
    // Plump cheek puffs ("ruff") & soft muzzle cushion
    const dCheekL = ell(x, y, z, -0.35, 1.44, 0.20, 0.27, 0.22, 0.25);
    const dCheekR = ell(x, y, z,  0.35, 1.44, 0.20, 0.27, 0.22, 0.25);
    const dMuzzle = ell(x, y, z,  0.0,  1.40, 0.48, 0.22, 0.16, 0.19);
    let dHead = smin(dHeadMain, smin(dCheekL, dCheekR, 0.12), 0.12);
    dHead = smin(dHead, dMuzzle, 0.10);

    // Pear-shaped sitting body melting smoothly into head with barely-there neck
    const dLowerTorso = ell(x, y, z, 0.0, 0.55, -0.03, 0.51, 0.49, 0.47);
    const dUpperChest = ell(x, y, z, 0.0, 1.02,  0.05, 0.40, 0.38, 0.37);
    const dTorso = smin(dLowerTorso, dUpperChest, 0.18);

    let dBody = smin(dTorso, dHead, 0.14);

    // Two short round front paws resting on y = 0
    const dLegL = cap(x, y, z, -0.23, 0.56, 0.28, -0.24, 0.12, 0.42, 0.14);
    const dLegR = cap(x, y, z,  0.23, 0.56, 0.28,  0.24, 0.12, 0.42, 0.14);
    const dPawL = ell(x, y, z, -0.24, 0.10, 0.45, 0.16, 0.11, 0.18);
    const dPawR = ell(x, y, z,  0.24, 0.10, 0.45, 0.16, 0.11, 0.18);
    dBody = smin(dBody, smin(dLegL, dPawL, 0.08), 0.10);
    dBody = smin(dBody, smin(dLegR, dPawR, 0.08), 0.10);

    // Two plump haunches resting on the ground
    const dHaunchL = ell(x, y, z, -0.38, 0.28, -0.10, 0.24, 0.26, 0.30);
    const dHaunchR = ell(x, y, z,  0.38, 0.28, -0.10, 0.24, 0.26, 0.30);
    const dHindPawL = ell(x, y, z, -0.35, 0.09, 0.19, 0.14, 0.09, 0.16);
    const dHindPawR = ell(x, y, z,  0.35, 0.09, 0.19, 0.14, 0.09, 0.16);
    dBody = smin(dBody, smin(dHaunchL, dHindPawL, 0.08), 0.11);
    dBody = smin(dBody, smin(dHaunchR, dHindPawR, 0.08), 0.11);

    // Flat resting base on y = 0 with soft plush bevel
    dBody = smax(dBody, -y, 0.045);
    return dBody;
  }

  evalCatSDFGradient(x, y, z, out = [0, 1, 0]) {
    const eps = 0.004;
    const dx = this.evalCatSDF(x + eps, y, z) - this.evalCatSDF(x - eps, y, z);
    const dy = this.evalCatSDF(x, y + eps, z) - this.evalCatSDF(x, y - eps, z);
    const dz = this.evalCatSDF(x, y, z + eps) - this.evalCatSDF(x, y, z - eps);
    const len = Math.hypot(dx, dy, dz) || 1.0;
    out[0] = dx / len;
    out[1] = dy / len;
    out[2] = dz / len;
    return out;
  }

  evalAnatomicalRegion(x, y, z) {
    // Pile length weight in [0.35, 1.0]:
    // Shorter (~0.35) on face, muzzle, paws; longer (~1.0) on cheek ruff, chest, back/haunches
    let pileWeight = 0.68;

    // Face & muzzle short pile
    const dMuzzle = Math.hypot(x / 0.36, (y - 1.48) / 0.32, (z - 0.50) / 0.28);
    if (dMuzzle < 1.2) {
      const t = Math.max(0.0, Math.min(1.0, (1.2 - dMuzzle) / 0.7));
      pileWeight = pileWeight * (1.0 - t) + 0.35 * t;
    }

    // Paws short pile
    if (y < 0.24) {
      const t = Math.max(0.0, Math.min(1.0, (0.24 - y) / 0.16));
      pileWeight = pileWeight * (1.0 - t) + 0.36 * t;
    }

    // Cheek ruff & chest bib longer fluffy pile (~1.0)
    const dCheekRuff = Math.hypot((Math.abs(x) - 0.42) / 0.24, (y - 1.42) / 0.24, (z - 0.18) / 0.26);
    if (dCheekRuff < 1.1) {
      const t = Math.max(0.0, Math.min(1.0, (1.1 - dCheekRuff) / 0.7));
      pileWeight = pileWeight * (1.0 - t) + 1.0 * t;
    }
    const dChest = Math.hypot(x / 0.30, (y - 0.80) / 0.35, (z - 0.32) / 0.25);
    if (dChest < 1.1) {
      const t = Math.max(0.0, Math.min(1.0, (1.1 - dChest) / 0.7));
      pileWeight = Math.max(pileWeight, 0.96 * t + pileWeight * (1.0 - t));
    }

    // Tuxedo mask: cream bib on chest x in [-0.26, 0.26], y in [0.45, 1.12], z > 0.22
    // and cream front/back paw tips y < 0.20
    let tuxedoWeight = 0.0;
    if (y >= 0.45 && y <= 1.12 && z > 0.22 && Math.abs(x) <= 0.26) {
      const bx = 1.0 - Math.pow(Math.abs(x) / 0.26, 2.0);
      const by = 1.0 - Math.pow((y - 0.785) / 0.335, 2.0);
      const bz = Math.min(1.0, (z - 0.22) / 0.10);
      tuxedoWeight = Math.max(0.0, Math.min(1.0, bx * by * bz * 1.6));
    }
    if (y < 0.20 && z > 0.08) {
      const py = Math.max(0.0, Math.min(1.0, (0.20 - y) / 0.08));
      tuxedoWeight = Math.max(tuxedoWeight, py);
    }

    // Stitched seam weight along the back center plane: |x| < 0.035 && z < -0.05 && y in [0.25, 1.95]
    let seamWeight = 0.0;
    if (Math.abs(x) < 0.035 && z < -0.05 && y >= 0.25 && y <= 1.95) {
      const sx = 1.0 - Math.abs(x) / 0.035;
      const sy = Math.min(1.0, Math.min((y - 0.25) / 0.10, (1.95 - y) / 0.10));
      const sz = Math.min(1.0, (-0.05 - z) / 0.08);
      seamWeight = Math.max(0.0, Math.min(1.0, sx * sy * sz));
    }

    return { pileWeight, tuxedoWeight, seamWeight };
  }

  // --------------------------------------------------------------------------
  // 2. SURFACE NETS MESH EXTRACTION & HEX/TET LATTICE EMBEDDING
  // --------------------------------------------------------------------------

  _buildGeometryAndLattice() {
    // 2A. Extract smooth render skin mesh via Surface Nets on SDF
    const step = 0.068;
    const minX = -0.748, minY = -0.068, minZ = -0.748;
    const nx = 23, ny = 34, nz = 23;
    const strideY = nx;
    const strideZ = nx * ny;
    const sdfGrid = new Float32Array(nx * ny * nz);

    for (let iz = 0; iz < nz; iz++) {
      const z = minZ + iz * step;
      for (let iy = 0; iy < ny; iy++) {
        const y = minY + iy * step;
        for (let ix = 0; ix < nx; ix++) {
          const x = minX + ix * step;
          sdfGrid[ix + iy * strideY + iz * strideZ] = this.evalCatSDF(x, y, z);
        }
      }
    }

    const cellToVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1));
    cellToVert.fill(-1);
    const cellStrideY = nx - 1;
    const cellStrideZ = (nx - 1) * (ny - 1);

    const edgeCorners = [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [4, 5], [5, 7], [7, 6], [6, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    const rawPositions = [];
    for (let iz = 0; iz < nz - 1; iz++) {
      for (let iy = 0; iy < ny - 1; iy++) {
        for (let ix = 0; ix < nx - 1; ix++) {
          let mask = 0;
          const cornerVals = new Float32Array(8);
          const cornerPos = new Float32Array(24);
          let c = 0;
          for (let dz = 0; dz < 2; dz++) {
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                const val = sdfGrid[(ix + dx) + (iy + dy) * strideY + (iz + dz) * strideZ];
                cornerVals[c] = val;
                cornerPos[c * 3 + 0] = minX + (ix + dx) * step;
                cornerPos[c * 3 + 1] = minY + (iy + dy) * step;
                cornerPos[c * 3 + 2] = minZ + (iz + dz) * step;
                if (val < 0.0) mask |= (1 << c);
                c++;
              }
            }
          }
          if (mask === 0 || mask === 255) continue;

          let sx = 0, sy = 0, sz = 0, count = 0;
          for (let e = 0; e < 12; e++) {
            const c0 = edgeCorners[e][0];
            const c1 = edgeCorners[e][1];
            const v0 = cornerVals[c0];
            const v1 = cornerVals[c1];
            if ((v0 < 0.0) !== (v1 < 0.0)) {
              const t = v0 / (v0 - v1);
              sx += cornerPos[c0 * 3 + 0] + t * (cornerPos[c1 * 3 + 0] - cornerPos[c0 * 3 + 0]);
              sy += cornerPos[c0 * 3 + 1] + t * (cornerPos[c1 * 3 + 1] - cornerPos[c0 * 3 + 1]);
              sz += cornerPos[c0 * 3 + 2] + t * (cornerPos[c1 * 3 + 2] - cornerPos[c0 * 3 + 2]);
              count++;
            }
          }
          if (count > 0) {
            const vIdx = rawPositions.length / 3;
            cellToVert[ix + iy * cellStrideY + iz * cellStrideZ] = vIdx;
            rawPositions.push(sx / count, Math.max(0.0, sy / count), sz / count);
          }
        }
      }
    }

    const triIndices = [];
    const grad = [0, 1, 0];
    const emitQuad = (v0, v1, v2, v3) => {
      if (v0 < 0 || v1 < 0 || v2 < 0 || v3 < 0) return;
      const cx = 0.25 * (rawPositions[v0 * 3] + rawPositions[v1 * 3] + rawPositions[v2 * 3] + rawPositions[v3 * 3]);
      const cy = 0.25 * (rawPositions[v0 * 3 + 1] + rawPositions[v1 * 3 + 1] + rawPositions[v2 * 3 + 1] + rawPositions[v3 * 3 + 1]);
      const cz = 0.25 * (rawPositions[v0 * 3 + 2] + rawPositions[v1 * 3 + 2] + rawPositions[v2 * 3 + 2] + rawPositions[v3 * 3 + 2]);
      this.evalCatSDFGradient(cx, cy, cz, grad);

      const ax = rawPositions[v1 * 3] - rawPositions[v0 * 3];
      const ay = rawPositions[v1 * 3 + 1] - rawPositions[v0 * 3 + 1];
      const az = rawPositions[v1 * 3 + 2] - rawPositions[v0 * 3 + 2];
      const bx = rawPositions[v2 * 3] - rawPositions[v0 * 3];
      const by = rawPositions[v2 * 3 + 1] - rawPositions[v0 * 3 + 1];
      const bz = rawPositions[v2 * 3 + 2] - rawPositions[v0 * 3 + 2];
      const nxC = ay * bz - az * by;
      const nyC = az * bx - ax * bz;
      const nzC = ax * by - ay * bx;

      if (nxC * grad[0] + nyC * grad[1] + nzC * grad[2] >= 0.0) {
        triIndices.push(v0, v1, v2, v0, v2, v3);
      } else {
        triIndices.push(v0, v2, v1, v0, v3, v2);
      }
    };

    for (let iz = 1; iz < nz - 1; iz++) {
      for (let iy = 1; iy < ny - 1; iy++) {
        for (let ix = 1; ix < nx - 1; ix++) {
          const s0 = sdfGrid[ix + iy * strideY + iz * strideZ];
          // X-axis edge
          const sx1 = sdfGrid[(ix + 1) + iy * strideY + iz * strideZ];
          if ((s0 < 0.0) !== (sx1 < 0.0)) {
            const c0 = cellToVert[ix + (iy - 1) * cellStrideY + (iz - 1) * cellStrideZ];
            const c1 = cellToVert[ix + iy * cellStrideY + (iz - 1) * cellStrideZ];
            const c2 = cellToVert[ix + iy * cellStrideY + iz * cellStrideZ];
            const c3 = cellToVert[ix + (iy - 1) * cellStrideY + iz * cellStrideZ];
            emitQuad(c0, c1, c2, c3);
          }
          // Y-axis edge
          const sy1 = sdfGrid[ix + (iy + 1) * strideY + iz * strideZ];
          if ((s0 < 0.0) !== (sy1 < 0.0)) {
            const c0 = cellToVert[(ix - 1) + iy * cellStrideY + (iz - 1) * cellStrideZ];
            const c1 = cellToVert[(ix - 1) + iy * cellStrideY + iz * cellStrideZ];
            const c2 = cellToVert[ix + iy * cellStrideY + iz * cellStrideZ];
            const c3 = cellToVert[ix + iy * cellStrideY + (iz - 1) * cellStrideZ];
            emitQuad(c0, c1, c2, c3);
          }
          // Z-axis edge
          const sz1 = sdfGrid[ix + iy * strideY + (iz + 1) * strideZ];
          if ((s0 < 0.0) !== (sz1 < 0.0)) {
            const c0 = cellToVert[(ix - 1) + (iy - 1) * cellStrideY + iz * cellStrideZ];
            const c1 = cellToVert[ix + (iy - 1) * cellStrideY + iz * cellStrideZ];
            const c2 = cellToVert[ix + iy * cellStrideY + iz * cellStrideZ];
            const c3 = cellToVert[(ix - 1) + iy * cellStrideY + iz * cellStrideZ];
            emitQuad(c0, c1, c2, c3);
          }
        }
      }
    }

    const vCount = rawPositions.length / 3;
    const tCount = triIndices.length / 3;

    // Gentle tangential smoothing + exact SDF projection for organic plush curvature
    const adj = Array.from({ length: vCount }, () => []);
    for (let i = 0; i < triIndices.length; i += 3) {
      const a = triIndices[i], b = triIndices[i + 1], c = triIndices[i + 2];
      adj[a].push(b, c);
      adj[b].push(a, c);
      adj[c].push(a, b);
    }

    const smoothed = new Float32Array(rawPositions);
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < vCount; i++) {
        const nb = adj[i];
        if (nb.length === 0) continue;
        let ax = 0, ay = 0, az = 0;
        for (let k = 0; k < nb.length; k++) {
          const j = nb[k];
          ax += rawPositions[j * 3];
          ay += rawPositions[j * 3 + 1];
          az += rawPositions[j * 3 + 2];
        }
        ax /= nb.length;
        ay /= nb.length;
        az /= nb.length;
        let px = rawPositions[i * 3] * 0.55 + ax * 0.45;
        let py = rawPositions[i * 3 + 1] * 0.55 + ay * 0.45;
        let pz = rawPositions[i * 3 + 2] * 0.55 + az * 0.45;
        const d = this.evalCatSDF(px, py, pz);
        this.evalCatSDFGradient(px, py, pz, grad);
        px -= d * grad[0] * 0.85;
        py = Math.max(0.0, py - d * grad[1] * 0.85);
        pz -= d * grad[2] * 0.85;
        smoothed[i * 3] = px;
        smoothed[i * 3 + 1] = py;
        smoothed[i * 3 + 2] = pz;
      }
      rawPositions.splice(0, rawPositions.length, ...smoothed);
    }

    const restPositions = new Float32Array(smoothed);
    const restNormals = new Float32Array(vCount * 3);
    const combAndRegion = new Float32Array(vCount * 4);
    const tuxedoMask = new Float32Array(vCount);
    const dynTipOffsets = new Float32Array(vCount * 4);

    for (let i = 0; i < vCount; i++) {
      const px = restPositions[i * 3];
      const py = restPositions[i * 3 + 1];
      const pz = restPositions[i * 3 + 2];
      this.evalCatSDFGradient(px, py, pz, grad);
      restNormals[i * 3] = grad[0];
      restNormals[i * 3 + 1] = grad[1];
      restNormals[i * 3 + 2] = grad[2];

      const reg = this.evalAnatomicalRegion(px, py, pz);
      combAndRegion[i * 4 + 3] = reg.pileWeight;
      tuxedoMask[i] = reg.tuxedoWeight;
      dynTipOffsets[i * 4 + 3] = reg.seamWeight;
    }

    this.skinMesh = {
      vertexCount: vCount,
      triangleCount: tCount,
      restPositions,
      restNormals,
      positions: new Float32Array(restPositions),
      normals: new Float32Array(restNormals),
      combAndRegion,
      tuxedoMask,
      dynTipOffsets,
      indices: new Uint32Array(triIndices),
      prevPositions: new Float32Array(restPositions),
      prevVel: new Float32Array(vCount * 3),
      tipVel: new Float32Array(vCount * 3)
    };

    // 2B. Build Hexahedral Simulation Lattice (cellSize = 0.175) & 5-Tet Split
    const cellSize = 0.175;
    const lMinX = -0.70, lMinY = 0.0, lMinZ = -0.70;
    const lnx = 9, lny = 13, lnz = 9;
    const nodeGrid = new Int32Array(lnx * lny * lnz);
    nodeGrid.fill(-1);
    const nStrideY = lnx;
    const nStrideZ = lnx * lny;

    const nodePositions = [];
    const getOrCreateNode = (ix, iy, iz) => {
      const idx = ix + iy * nStrideY + iz * nStrideZ;
      if (nodeGrid[idx] >= 0) return nodeGrid[idx];
      const nIdx = nodePositions.length / 3;
      nodeGrid[idx] = nIdx;
      nodePositions.push(
        lMinX + ix * cellSize,
        lMinY + iy * cellSize,
        lMinZ + iz * cellSize
      );
      return nIdx;
    };

    this.cells = [];
    for (let iz = 0; iz < lnz - 1; iz++) {
      for (let iy = 0; iy < lny - 1; iy++) {
        for (let ix = 0; ix < lnx - 1; ix++) {
          const cx = lMinX + (ix + 0.5) * cellSize;
          const cy = lMinY + (iy + 0.5) * cellSize;
          const cz = lMinZ + (iz + 0.5) * cellSize;
          let minSdf = this.evalCatSDF(cx, cy, cz);
          for (let dz = 0; dz < 2; dz++) {
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                const s = this.evalCatSDF(
                  lMinX + (ix + dx) * cellSize,
                  lMinY + (iy + dy) * cellSize,
                  lMinZ + (iz + dz) * cellSize
                );
                if (s < minSdf) minSdf = s;
              }
            }
          }
          if (minSdf > 0.045) continue;

          const nodes = new Uint32Array(8);
          let c = 0;
          for (let dz = 0; dz < 2; dz++) {
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                nodes[c++] = getOrCreateNode(ix + dx, iy + dy, iz + dz);
              }
            }
          }

          this.cells.push({
            ix, iy, iz,
            parity: (ix + iy + iz) & 1,
            nodes,
            quat: [0.0, 0.0, 0.0, 1.0],
            restCenter: [cx, cy, cz],
            restOffsets: new Float32Array(24),
            dynOffsets: new Float32Array(24),
            stiffnessBoost: 1.0
          });
        }
      }
    }

    this.particleCount = nodePositions.length / 3;
    this.cellCount = this.cells.length;
    this.pos = new Float32Array(nodePositions);
    this.restPos = new Float32Array(nodePositions);
    this.animRestPos = new Float32Array(nodePositions);
    this.prevPos = new Float32Array(nodePositions);
    this.vel = new Float32Array(this.particleCount * 3);
    this.invMass = new Float32Array(this.particleCount);

    // 5-tet decomposition templates per hex cell (even & odd parity)
    const tetTemplatesEven = [
      [0, 1, 2, 4],
      [3, 2, 1, 7],
      [5, 4, 1, 7],
      [6, 7, 2, 4],
      [1, 2, 4, 7]
    ];
    const tetTemplatesOdd = [
      [1, 3, 0, 5],
      [2, 0, 3, 6],
      [4, 5, 0, 6],
      [7, 6, 3, 5],
      [0, 3, 5, 6]
    ];

    const signedTetVol = (p, i0, i1, i2, i3) => {
      const ax = p[i1 * 3] - p[i0 * 3], ay = p[i1 * 3 + 1] - p[i0 * 3 + 1], az = p[i1 * 3 + 2] - p[i0 * 3 + 2];
      const bx = p[i2 * 3] - p[i0 * 3], by = p[i2 * 3 + 1] - p[i0 * 3 + 1], bz = p[i2 * 3 + 2] - p[i0 * 3 + 2];
      const cx = p[i3 * 3] - p[i0 * 3], cy = p[i3 * 3 + 1] - p[i0 * 3 + 1], cz = p[i3 * 3 + 2] - p[i0 * 3 + 2];
      return (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6.0;
    };

    this.tetCount = this.cellCount * 5;
    this.tets = new Uint32Array(this.tetCount * 4);
    this.tetRestVol = new Float32Array(this.tetCount);
    this.tetInvDm = new Float32Array(this.tetCount * 9);

    for (let cIdx = 0; cIdx < this.cellCount; cIdx++) {
      const cell = this.cells[cIdx];
      const tmpl = cell.parity === 0 ? tetTemplatesEven : tetTemplatesOdd;
      for (let k = 0; k < 5; k++) {
        const tIdx = cIdx * 5 + k;
        let i0 = cell.nodes[tmpl[k][0]];
        let i1 = cell.nodes[tmpl[k][1]];
        let i2 = cell.nodes[tmpl[k][2]];
        let i3 = cell.nodes[tmpl[k][3]];
        if (signedTetVol(this.restPos, i0, i1, i2, i3) < 0.0) {
          const tmp = i1; i1 = i2; i2 = tmp;
        }
        this.tets[tIdx * 4 + 0] = i0;
        this.tets[tIdx * 4 + 1] = i1;
        this.tets[tIdx * 4 + 2] = i2;
        this.tets[tIdx * 4 + 3] = i3;
      }
    }

    // 2C. Snap boundary nodes toward SDF surface with automatic backoff if any tet crushes
    const nodeIncidentTets = Array.from({ length: this.particleCount }, () => []);
    for (let t = 0; t < this.tetCount; t++) {
      for (let k = 0; k < 4; k++) {
        nodeIncidentTets[this.tets[t * 4 + k]].push(t);
      }
    }

    const initialVols = new Float32Array(this.tetCount);
    for (let t = 0; t < this.tetCount; t++) {
      initialVols[t] = signedTetVol(
        this.restPos,
        this.tets[t * 4],
        this.tets[t * 4 + 1],
        this.tets[t * 4 + 2],
        this.tets[t * 4 + 3]
      );
    }

    for (let i = 0; i < this.particleCount; i++) {
      const ox = this.restPos[i * 3];
      const oy = this.restPos[i * 3 + 1];
      const oz = this.restPos[i * 3 + 2];
      if (oy < 0.03) continue;
      const d = this.evalCatSDF(ox, oy, oz);
      if (Math.abs(d) > 0.13) continue;

      this.evalCatSDFGradient(ox, oy, oz, grad);
      const snapDist = Math.max(-0.075, Math.min(0.075, d));
      let factor = 0.75;
      while (factor >= 0.12) {
        this.restPos[i * 3] = ox - snapDist * factor * grad[0];
        this.restPos[i * 3 + 1] = Math.max(0.0, oy - snapDist * factor * grad[1]);
        this.restPos[i * 3 + 2] = oz - snapDist * factor * grad[2];

        let valid = true;
        const inc = nodeIncidentTets[i];
        for (let k = 0; k < inc.length; k++) {
          const t = inc[k];
          const v = signedTetVol(
            this.restPos,
            this.tets[t * 4],
            this.tets[t * 4 + 1],
            this.tets[t * 4 + 2],
            this.tets[t * 4 + 3]
          );
          if (v < initialVols[t] * 0.38) {
            valid = false;
            break;
          }
        }
        if (valid) break;
        this.restPos[i * 3] = ox;
        this.restPos[i * 3 + 1] = oy;
        this.restPos[i * 3 + 2] = oz;
        factor *= 0.5;
      }
    }

    this.pos.set(this.restPos);
    this.animRestPos.set(this.restPos);
    this.prevPos.set(this.restPos);

    // Precompute cell rest centers, offsets, tet rest volumes, and inverse rest edge matrices Dm^-1
    this.totalRestVolume = 0.0;
    const massPerNode = new Float32Array(this.particleCount);

    for (let t = 0; t < this.tetCount; t++) {
      const i0 = this.tets[t * 4 + 0];
      const i1 = this.tets[t * 4 + 1];
      const i2 = this.tets[t * 4 + 2];
      const i3 = this.tets[t * 4 + 3];
      const vol = Math.max(1e-6, signedTetVol(this.restPos, i0, i1, i2, i3));
      this.tetRestVol[t] = vol;
      this.totalRestVolume += vol;
      const quarterVol = vol * 0.25;
      massPerNode[i0] += quarterVol;
      massPerNode[i1] += quarterVol;
      massPerNode[i2] += quarterVol;
      massPerNode[i3] += quarterVol;

      const d00 = this.restPos[i1 * 3] - this.restPos[i0 * 3];
      const d10 = this.restPos[i1 * 3 + 1] - this.restPos[i0 * 3 + 1];
      const d20 = this.restPos[i1 * 3 + 2] - this.restPos[i0 * 3 + 2];

      const d01 = this.restPos[i2 * 3] - this.restPos[i0 * 3];
      const d11 = this.restPos[i2 * 3 + 1] - this.restPos[i0 * 3 + 1];
      const d21 = this.restPos[i2 * 3 + 2] - this.restPos[i0 * 3 + 2];

      const d02 = this.restPos[i3 * 3] - this.restPos[i0 * 3];
      const d12 = this.restPos[i3 * 3 + 1] - this.restPos[i0 * 3 + 1];
      const d22 = this.restPos[i3 * 3 + 2] - this.restPos[i0 * 3 + 2];

      PlushPhysicsEngine._invertMat3(
        d00, d01, d02,
        d10, d11, d12,
        d20, d21, d22,
        this.tetInvDm, t * 9
      );
    }

    let sumM = 0, rcx = 0, rcy = 0, rcz = 0;
    for (let i = 0; i < this.particleCount; i++) {
      const m = Math.max(1e-4, massPerNode[i]);
      this.invMass[i] = 1.0 / m;
      sumM += m;
      rcx += this.restPos[i * 3] * m;
      rcy += this.restPos[i * 3 + 1] * m;
      rcz += this.restPos[i * 3 + 2] * m;
    }
    this.restCom = [rcx / sumM, rcy / sumM, rcz / sumM];
    this.com = [...this.restCom];

    for (let cIdx = 0; cIdx < this.cellCount; cIdx++) {
      const cell = this.cells[cIdx];
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 8; k++) {
        const ni = cell.nodes[k];
        cx += this.restPos[ni * 3];
        cy += this.restPos[ni * 3 + 1];
        cz += this.restPos[ni * 3 + 2];
      }
      cx *= 0.125; cy *= 0.125; cz *= 0.125;
      cell.restCenter[0] = cx;
      cell.restCenter[1] = cy;
      cell.restCenter[2] = cz;
      for (let k = 0; k < 8; k++) {
        const ni = cell.nodes[k];
        cell.restOffsets[k * 3 + 0] = this.restPos[ni * 3] - cx;
        cell.restOffsets[k * 3 + 1] = this.restPos[ni * 3 + 1] - cy;
        cell.restOffsets[k * 3 + 2] = this.restPos[ni * 3 + 2] - cz;
        cell.dynOffsets[k * 3 + 0] = cell.restOffsets[k * 3 + 0];
        cell.dynOffsets[k * 3 + 1] = cell.restOffsets[k * 3 + 1];
        cell.dynOffsets[k * 3 + 2] = cell.restOffsets[k * 3 + 2];
      }
    }

    // Build unique lattice edges for edge-damping and "Mesh" wireframe overlay
    const edgeSet = new Set();
    const edgePairs = [];
    const addEdge = (a, b) => {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const key = (lo << 16) | hi;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edgePairs.push(lo, hi);
      }
    };
    const hexCubeEdges = [
      [0, 1], [2, 3], [4, 5], [6, 7],
      [0, 2], [1, 3], [4, 6], [5, 7],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    for (let cIdx = 0; cIdx < this.cellCount; cIdx++) {
      const nodes = this.cells[cIdx].nodes;
      for (let e = 0; e < 12; e++) {
        addEdge(nodes[hexCubeEdges[e][0]], nodes[hexCubeEdges[e][1]]);
      }
    }
    this.latticeWireframeIndices = new Uint32Array(edgePairs);

    // 2D. Barycentric embedding of every Surface Nets skin vertex into nearest/enclosing tet
    this.skinTetIdx = new Uint32Array(vCount);
    this.skinBary = new Float32Array(vCount * 4);
    const baryOut = [0.25, 0.25, 0.25, 0.25];
    for (let i = 0; i < vCount; i++) {
      const vx = restPositions[i * 3];
      const vy = restPositions[i * 3 + 1];
      const vz = restPositions[i * 3 + 2];
      const best = this._findBestTetBarycentric(vx, vy, vz, baryOut);
      this.skinTetIdx[i] = best;
      this.skinBary[i * 4 + 0] = baryOut[0];
      this.skinBary[i * 4 + 1] = baryOut[1];
      this.skinBary[i * 4 + 2] = baryOut[2];
      this.skinBary[i * 4 + 3] = baryOut[3];
    }

    // Per-tet deformation gradient & cofactor cache
    this.tetF = new Float32Array(this.tetCount * 9);
    this.tetCofF = new Float32Array(this.tetCount * 9);
  }

  _findBestTetBarycentric(px, py, pz, baryOut) {
    let bestTet = 0;
    let bestScore = Infinity;

    for (let t = 0; t < this.tetCount; t++) {
      const i0 = this.tets[t * 4 + 0];
      const x0 = this.restPos[i0 * 3], y0 = this.restPos[i0 * 3 + 1], z0 = this.restPos[i0 * 3 + 2];
      const dx = px - x0, dy = py - y0, dz = pz - z0;
      if (dx * dx + dy * dy + dz * dz > 0.22 && bestScore < 0.5) continue;

      const base = t * 9;
      const w1 = this.tetInvDm[base + 0] * dx + this.tetInvDm[base + 1] * dy + this.tetInvDm[base + 2] * dz;
      const w2 = this.tetInvDm[base + 3] * dx + this.tetInvDm[base + 4] * dy + this.tetInvDm[base + 5] * dz;
      const w3 = this.tetInvDm[base + 6] * dx + this.tetInvDm[base + 7] * dy + this.tetInvDm[base + 8] * dz;
      const w0 = 1.0 - w1 - w2 - w3;

      let err = 0.0;
      if (w0 < 0) err += -w0; else if (w0 > 1) err += w0 - 1;
      if (w1 < 0) err += -w1; else if (w1 > 1) err += w1 - 1;
      if (w2 < 0) err += -w2; else if (w2 > 1) err += w2 - 1;
      if (w3 < 0) err += -w3; else if (w3 > 1) err += w3 - 1;

      if (err < bestScore) {
        bestScore = err;
        bestTet = t;
        baryOut[0] = w0;
        baryOut[1] = w1;
        baryOut[2] = w2;
        baryOut[3] = w3;
        if (err <= 1e-5) break;
      }
    }
    return bestTet;
  }

  // --------------------------------------------------------------------------
  // 3. CLOTH EARS (6x8 PARTICLE GRID PER EAR) SEWN INTO HEAD TETS
  // --------------------------------------------------------------------------

  _buildClothEars() {
    const cols = 6, rows = 8;
    const perEar = cols * rows;
    const totalVerts = perEar * 2;

    this.earCols = cols;
    this.earRows = rows;
    this.earPos = new Float32Array(totalVerts * 3);
    this.earPrevPos = new Float32Array(totalVerts * 3);
    this.earVel = new Float32Array(totalVerts * 3);
    this.earLocalRest = new Float32Array(totalVerts * 3);
    this.earInvMass = new Float32Array(totalVerts);

    const uvsAndSide = new Float32Array(totalVerts * 4);
    const indices = [];
    this.earSeamPins = [];
    this.earConstraints = [];

    const bary = [0.25, 0.25, 0.25, 0.25];
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1.0 : 1.0;
      const vOffset = side * perEar;

      for (let r = 0; r < rows; r++) {
        const v = r / (rows - 1); // 0 at head base -> 1 at tip
        const widthScale = Math.sin((1.0 - v * 0.86) * Math.PI * 0.5);
        for (let c = 0; c < cols; c++) {
          const u = c / (cols - 1); // 0..1 across width
          const uCentered = (u - 0.5) * 2.0; // -1..1
          const idx = vOffset + r * cols + c;

          // Cupped triangular-arch felt ear geometry in rest space
          const localW = uCentered * 0.16 * widthScale;
          const cupDepth = (1.0 - uCentered * uCentered) * 0.055 * Math.sin(v * Math.PI * 0.85);
          const rx = sign * (0.29 + v * 0.13) + localW * 0.86;
          const ry = 1.94 + v * 0.44 - Math.abs(uCentered) * 0.03 * (1.0 - v);
          const rz = 0.08 + cupDepth - Math.abs(localW) * 0.22 + v * 0.03;

          this.earPos[idx * 3 + 0] = rx;
          this.earPos[idx * 3 + 1] = ry;
          this.earPos[idx * 3 + 2] = rz;
          this.earPrevPos[idx * 3 + 0] = rx;
          this.earPrevPos[idx * 3 + 1] = ry;
          this.earPrevPos[idx * 3 + 2] = rz;
          this.earLocalRest[idx * 3 + 0] = rx;
          this.earLocalRest[idx * 3 + 1] = ry;
          this.earLocalRest[idx * 3 + 2] = rz;

          const isInnerPink = (Math.abs(uCentered) < 0.62 && v > 0.14 && v < 0.84) ? 1.0 : 0.0;
          const isEdge = (c === 0 || c === cols - 1 || r === rows - 1) ? 1.0 : 0.0;
          uvsAndSide[idx * 4 + 0] = u;
          uvsAndSide[idx * 4 + 1] = v;
          uvsAndSide[idx * 4 + 2] = isInnerPink;
          uvsAndSide[idx * 4 + 3] = isEdge;

          this.earInvMass[idx] = r <= 1 ? 1.4 : 2.5;

          // First two rows (r = 0, 1) are sewn into the head via equal-and-opposite barycentric seam constraints
          if (r <= 1) {
            const tetIdx = this._findBestTetBarycentric(rx, ry, rz, bary);
            this.earSeamPins.push({
              earIdx: idx,
              tetIdx,
              bary: [...bary],
              restOffset: [0, 0, 0]
            });
          }
        }
      }

      // Build triangles for this ear
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const i00 = vOffset + r * cols + c;
          const i10 = i00 + 1;
          const i01 = i00 + cols;
          const i11 = i01 + 1;
          if (side === 0) {
            indices.push(i00, i10, i11, i00, i11, i01);
          } else {
            indices.push(i00, i11, i10, i00, i01, i11);
          }
        }
      }

      // Add stretch, shear, and 2-hop bend constraints
      const addConstraint = (a, b, compliance) => {
        const dx = this.earPos[b * 3] - this.earPos[a * 3];
        const dy = this.earPos[b * 3 + 1] - this.earPos[a * 3 + 1];
        const dz = this.earPos[b * 3 + 2] - this.earPos[a * 3 + 2];
        this.earConstraints.push({ a, b, restLen: Math.hypot(dx, dy, dz), compliance });
      };

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = vOffset + r * cols + c;
          if (c + 1 < cols) addConstraint(idx, idx + 1, 0.0002); // horizontal stretch
          if (r + 1 < rows) addConstraint(idx, idx + cols, 0.0002); // vertical stretch
          if (c + 1 < cols && r + 1 < rows) {
            addConstraint(idx, idx + cols + 1, 0.0006); // shear
            addConstraint(idx + 1, idx + cols, 0.0006); // shear
          }
          if (c + 2 < cols) addConstraint(idx, idx + 2, 0.0025); // horizontal cup bend
          if (r + 2 < rows) addConstraint(idx, idx + cols * 2, 0.0025); // vertical bend
        }
      }
    }

    // Compute exact offset from tet barycentric anchor for the sewn rows
    for (let k = 0; k < this.earSeamPins.length; k++) {
      const pin = this.earSeamPins[k];
      const ax = this._evalTetBaryPos(pin.tetIdx, pin.bary, this.restPos, 0);
      const ay = this._evalTetBaryPos(pin.tetIdx, pin.bary, this.restPos, 1);
      const az = this._evalTetBaryPos(pin.tetIdx, pin.bary, this.restPos, 2);
      pin.restOffset[0] = this.earLocalRest[pin.earIdx * 3 + 0] - ax;
      pin.restOffset[1] = this.earLocalRest[pin.earIdx * 3 + 1] - ay;
      pin.restOffset[2] = this.earLocalRest[pin.earIdx * 3 + 2] - az;
    }

    this.earMesh = {
      vertexCount: totalVerts,
      triangleCount: indices.length / 3,
      positions: this.earPos,
      normals: new Float32Array(totalVerts * 3),
      uvsAndSide,
      indices: new Uint32Array(indices)
    };
  }

  _evalTetBaryPos(tetIdx, bary, posArray, comp) {
    const i0 = this.tets[tetIdx * 4 + 0];
    const i1 = this.tets[tetIdx * 4 + 1];
    const i2 = this.tets[tetIdx * 4 + 2];
    const i3 = this.tets[tetIdx * 4 + 3];
    return (
      bary[0] * posArray[i0 * 3 + comp] +
      bary[1] * posArray[i1 * 3 + comp] +
      bary[2] * posArray[i2 * 3 + comp] +
      bary[3] * posArray[i3 * 3 + comp]
    );
  }

  // --------------------------------------------------------------------------
  // 4. SOFT ROPE TAIL (16 PARTICLES) & DYNAMIC FUR TUBE MESH
  // --------------------------------------------------------------------------

  _buildRopeTail() {
    const N = 16;
    this.tailParticleCount = N;
    this.tailPos = new Float32Array(N * 3);
    this.tailPrevPos = new Float32Array(N * 3);
    this.tailVel = new Float32Array(N * 3);
    this.tailLocalRest = new Float32Array(N * 3);
    this.tailRadii = new Float32Array(N);
    this.tailConstraints = [];

    // Root at lower back [0, 0.32, -0.45], curling gracefully around right haunch to front paw
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const angle = t * Math.PI * 1.12;
      const rx = Math.sin(angle) * (0.48 + 0.14 * Math.sin(t * Math.PI));
      const ry = Math.max(0.09, 0.32 * (1.0 - t * 0.72) + 0.05 * Math.sin(t * Math.PI * 2.0));
      const rz = -0.45 * Math.cos(angle * 0.92) + t * 0.22;

      this.tailPos[i * 3 + 0] = rx;
      this.tailPos[i * 3 + 1] = ry;
      this.tailPos[i * 3 + 2] = rz;
      this.tailPrevPos[i * 3 + 0] = rx;
      this.tailPrevPos[i * 3 + 1] = ry;
      this.tailPrevPos[i * 3 + 2] = rz;
      this.tailLocalRest[i * 3 + 0] = rx;
      this.tailLocalRest[i * 3 + 1] = ry;
      this.tailLocalRest[i * 3 + 2] = rz;

      // Smooth plush tail profile: fluffy mid-tail, rounded tip
      this.tailRadii[i] = 0.095 * (1.0 - 0.32 * t * t) * (0.92 + 0.16 * Math.sin(t * Math.PI));
    }

    const bary = [0.25, 0.25, 0.25, 0.25];
    this.tailRootTet = this._findBestTetBarycentric(0.0, 0.32, -0.45, bary);
    this.tailRootBary = [...bary];

    for (let i = 0; i < N - 1; i++) {
      const dx = this.tailPos[(i + 1) * 3] - this.tailPos[i * 3];
      const dy = this.tailPos[(i + 1) * 3 + 1] - this.tailPos[i * 3 + 1];
      const dz = this.tailPos[(i + 1) * 3 + 2] - this.tailPos[i * 3 + 2];
      this.tailConstraints.push({ a: i, b: i + 1, restLen: Math.hypot(dx, dy, dz), compliance: 0.0001 });
    }
    for (let i = 0; i < N - 2; i++) {
      const dx = this.tailPos[(i + 2) * 3] - this.tailPos[i * 3];
      const dy = this.tailPos[(i + 2) * 3 + 1] - this.tailPos[i * 3 + 1];
      const dz = this.tailPos[(i + 2) * 3 + 2] - this.tailPos[i * 3 + 2];
      this.tailConstraints.push({ a: i, b: i + 2, restLen: Math.hypot(dx, dy, dz), compliance: 0.0035 });
    }

    // Build tubular skin mesh around the 16-particle spine
    const radialSegs = 10;
    this.tailRadialSegs = radialSegs;
    const vCount = N * radialSegs + 1; // +1 for rounded tip cap center
    const indices = [];

    for (let i = 0; i < N - 1; i++) {
      const ring0 = i * radialSegs;
      const ring1 = (i + 1) * radialSegs;
      for (let s = 0; s < radialSegs; s++) {
        const sNext = (s + 1) % radialSegs;
        const a = ring0 + s;
        const b = ring0 + sNext;
        const c = ring1 + sNext;
        const d = ring1 + s;
        indices.push(a, b, c, a, c, d);
      }
    }
    const tipCenterIdx = N * radialSegs;
    const lastRing = (N - 1) * radialSegs;
    for (let s = 0; s < radialSegs; s++) {
      const sNext = (s + 1) % radialSegs;
      indices.push(lastRing + s, lastRing + sNext, tipCenterIdx);
    }

    const combAndRegion = new Float32Array(vCount * 4);
    const tuxedoMask = new Float32Array(vCount);
    const dynTipOffsets = new Float32Array(vCount * 4);
    for (let i = 0; i < vCount; i++) {
      combAndRegion[i * 4 + 3] = 1.0; // Fluffy tail pile length
      tuxedoMask[i] = i >= (N - 2) * radialSegs ? 0.35 : 0.0;
    }

    this.tailMesh = {
      vertexCount: vCount,
      triangleCount: indices.length / 3,
      positions: new Float32Array(vCount * 3),
      normals: new Float32Array(vCount * 3),
      restPositions: new Float32Array(vCount * 3),
      restNormals: new Float32Array(vCount * 3),
      combAndRegion,
      tuxedoMask,
      dynTipOffsets,
      indices: new Uint32Array(indices),
      prevPositions: new Float32Array(vCount * 3),
      prevVel: new Float32Array(vCount * 3),
      tipVel: new Float32Array(vCount * 3)
    };

    this._updateTailTubeMesh(1 / 60, true);
  }

  _updateTailTubeMesh(dt, isInit = false) {
    const N = this.tailParticleCount;
    const segs = this.tailRadialSegs;
    const pos = this.tailMesh.positions;
    const norm = this.tailMesh.normals;

    // Parallel transport frame along spine
    let tx = this.tailPos[3] - this.tailPos[0];
    let ty = this.tailPos[4] - this.tailPos[1];
    let tz = this.tailPos[5] - this.tailPos[2];
    let tLen = Math.hypot(tx, ty, tz) || 1.0;
    tx /= tLen; ty /= tLen; tz /= tLen;

    let upX = 0.0, upY = 1.0, upZ = 0.0;
    if (Math.abs(ty) > 0.92) { upX = 1.0; upY = 0.0; }
    let nx = upY * tz - upZ * ty;
    let ny = upZ * tx - upX * tz;
    let nz = upX * ty - upY * tx;
    let nLen = Math.hypot(nx, ny, nz) || 1.0;
    nx /= nLen; ny /= nLen; nz /= nLen;
    let bx = ty * nz - tz * ny;
    let by = tz * nx - tx * nz;
    let bz = tx * ny - ty * nx;

    for (let i = 0; i < N; i++) {
      if (i > 0) {
        const iPrev = Math.max(0, i - 1);
        const iNext = Math.min(N - 1, i + 1);
        tx = this.tailPos[iNext * 3] - this.tailPos[iPrev * 3];
        ty = this.tailPos[iNext * 3 + 1] - this.tailPos[iPrev * 3 + 1];
        tz = this.tailPos[iNext * 3 + 2] - this.tailPos[iPrev * 3 + 2];
        tLen = Math.hypot(tx, ty, tz) || 1.0;
        tx /= tLen; ty /= tLen; tz /= tLen;

        // Project previous normal orthogonal to new tangent
        const dotNT = nx * tx + ny * ty + nz * tz;
        nx -= dotNT * tx;
        ny -= dotNT * ty;
        nz -= dotNT * tz;
        nLen = Math.hypot(nx, ny, nz) || 1.0;
        nx /= nLen; ny /= nLen; nz /= nLen;
        bx = ty * nz - tz * ny;
        by = tz * nx - tx * nz;
        bz = tx * ny - ty * nx;
      }

      const px = this.tailPos[i * 3];
      const py = this.tailPos[i * 3 + 1];
      const pz = this.tailPos[i * 3 + 2];
      const r = this.tailRadii[i] * (0.85 + 0.15 * this.furPuffScale);

      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2.0;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const rnx = ca * nx + sa * bx;
        const rny = ca * ny + sa * by;
        const rnz = ca * nz + sa * bz;
        const vIdx = i * segs + s;

        pos[vIdx * 3 + 0] = px + r * rnx;
        pos[vIdx * 3 + 1] = Math.max(0.005, py + r * rny);
        pos[vIdx * 3 + 2] = pz + r * rnz;
        norm[vIdx * 3 + 0] = rnx;
        norm[vIdx * 3 + 1] = rny;
        norm[vIdx * 3 + 2] = rnz;

        if (!isInit) {
          this.tailMesh.combAndRegion[vIdx * 4 + 0] = tx * 0.65 + rnx * 0.15;
          this.tailMesh.combAndRegion[vIdx * 4 + 1] = ty * 0.65 + rny * 0.15;
          this.tailMesh.combAndRegion[vIdx * 4 + 2] = tz * 0.65 + rnz * 0.15;
        }
      }
    }

    const tipIdx = N * segs;
    const lastP = (N - 1) * 3;
    const tipR = this.tailRadii[N - 1] * 0.7;
    pos[tipIdx * 3 + 0] = this.tailPos[lastP] + tx * tipR;
    pos[tipIdx * 3 + 1] = Math.max(0.01, this.tailPos[lastP + 1] + ty * tipR);
    pos[tipIdx * 3 + 2] = this.tailPos[lastP + 2] + tz * tipR;
    norm[tipIdx * 3 + 0] = tx;
    norm[tipIdx * 3 + 1] = ty;
    norm[tipIdx * 3 + 2] = tz;

    if (isInit) {
      this.tailMesh.restPositions.set(pos);
      this.tailMesh.restNormals.set(norm);
      this.tailMesh.prevPositions.set(pos);
      for (let i = 0; i < this.tailMesh.vertexCount; i++) {
        this.tailMesh.combAndRegion[i * 4 + 0] = 0.0;
        this.tailMesh.combAndRegion[i * 4 + 1] = 0.25;
        this.tailMesh.combAndRegion[i * 4 + 2] = -0.65;
        this.tailMesh.combAndRegion[i * 4 + 3] = 1.0;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. RIGID PROPS ATTACHMENTS, BRASS BELL PENDULUM & FELT TOY MOUSE
  // --------------------------------------------------------------------------

  _buildAttachments() {
    const snapToSurface = (pt, targetD) => {
      let x = pt[0], y = pt[1], z = pt[2];
      const grad = [0, 0, 1];
      for (let iter = 0; iter < 3; iter++) {
        const curD = this.evalCatSDF(x, y, z);
        this.evalCatSDFGradient(x, y, z, grad);
        const step = targetD - curD;
        x += grad[0] * step;
        y += grad[1] * step;
        z += grad[2] * step;
      }
      return [x, y, z];
    };

    const specs = {
      leftEye:    snapToSurface([-0.22, 1.54, 0.58], 0.010),
      rightEye:   snapToSurface([ 0.22, 1.54, 0.58], 0.010),
      nose:       snapToSurface([ 0.00, 1.44, 0.66], 0.030),
      mouth:      snapToSurface([ 0.00, 1.35, 0.64], 0.036),
      collar:     [ 0.00, 1.07, 0.06],
      leftCheek:  snapToSurface([-0.35, 1.42, 0.52], 0.028),
      rightCheek: snapToSurface([ 0.35, 1.42, 0.52], 0.028)
    };

    this.attachmentBindings = {};
    this.attachments = {};
    const bary = [0.25, 0.25, 0.25, 0.25];

    for (const [name, restPt] of Object.entries(specs)) {
      const primaryTet = this._findBestTetBarycentric(restPt[0], restPt[1], restPt[2], bary);
      // Gather nearby tets to average their deformation gradient for noise-free polar rotation
      const nearTets = [primaryTet];
      for (let t = 0; t < this.tetCount; t++) {
        if (t === primaryTet) continue;
        const i0 = this.tets[t * 4];
        const dx = this.restPos[i0 * 3] - restPt[0];
        const dy = this.restPos[i0 * 3 + 1] - restPt[1];
        const dz = this.restPos[i0 * 3 + 2] - restPt[2];
        if (dx * dx + dy * dy + dz * dz < 0.065 && nearTets.length < 6) {
          nearTets.push(t);
        }
      }

      const ax = this._evalTetBaryPos(primaryTet, bary, this.restPos, 0);
      const ay = this._evalTetBaryPos(primaryTet, bary, this.restPos, 1);
      const az = this._evalTetBaryPos(primaryTet, bary, this.restPos, 2);

      this.attachmentBindings[name] = {
        primaryTet,
        bary: [...bary],
        localOffset: [restPt[0] - ax, restPt[1] - ay, restPt[2] - az],
        nearTets,
        restPos: [...restPt]
      };

      this.attachments[name] = {
        pos: [...restPt],
        rotMat3: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        quat: [0.0, 0.0, 0.0, 1.0]
      };
    }

    // Embedded collar bell anchor point [0.0, 0.98, 0.48]
    const bellAnchorRest = [0.0, 0.98, 0.48];
    const bellTet = this._findBestTetBarycentric(bellAnchorRest[0], bellAnchorRest[1], bellAnchorRest[2], bary);
    const bax = this._evalTetBaryPos(bellTet, bary, this.restPos, 0);
    const bay = this._evalTetBaryPos(bellTet, bary, this.restPos, 1);
    const baz = this._evalTetBaryPos(bellTet, bary, this.restPos, 2);
    this.bellAnchorBinding = {
      tetIdx: bellTet,
      bary: [...bary],
      localOffset: [bellAnchorRest[0] - bax, bellAnchorRest[1] - bay, bellAnchorRest[2] - baz],
      stringLength: 0.13
    };

    this.attachments.bell = {
      pos: [0.0, 0.85, 0.52],
      vel: [0.0, 0.0, 0.0],
      anchorPos: [...bellAnchorRest],
      radius: 0.11,
      swingSpeed: 0.0,
      quat: [0.0, 0.0, 0.0, 1.0],
      rotMat3: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
    };

    this.attachments.mouseToy = {
      active: false,
      pos: [0.65, 0.09, 1.05],
      vel: [0.0, 0.0, 0.0],
      yaw: 0.4,
      stringAnchor: [0.95, 0.02, 1.25],
      radius: 0.11
    };
  }

  // --------------------------------------------------------------------------
  // 6. MAIN STEP LOOP: 6 XPBD SUBSTEPS, POSTURE CONTROLLER, EARS, TAIL & BELL
  // --------------------------------------------------------------------------

  step(dt) {
    const clampedDt = Math.min(Math.max(dt, 0.001), 0.033);
    this.simTime += clampedDt;

    this._updateBlinkAndExpressions(clampedDt);
    this._updatePostureAndActionController(clampedDt);

    if (this.isSleeping && !this.grabState.active && !this.activeAction && !this.isProwling && !this.isPurring && !this.isArching && !this.isNapping) {
      return;
    }

    const substeps = 6;
    const subDt = clampedDt / substeps;

    for (let s = 0; s < substeps; s++) {
      this._stepXPBDSubstep(subDt);
    }

    this._stepMouseToy(clampedDt);
    this._checkNaNAndRecover();

    const isAirbornePhase =
      (this.activeAction === 'pounce' && this.actionTime >= 0.36 && this.actionTime < 0.66) ||
      (this.grabState.active && (this.grabState.type === 'scruff' || this.grabState.type === 'body'));
    if (!isAirbornePhase) {
      let minPy = Infinity;
      for (let i = 0; i < this.particleCount; i++) {
        const py = this.pos[i * 3 + 1];
        if (py < minPy) minPy = py;
      }
      if (minPy > 0.005 && minPy < 1.5) {
        for (let i = 0; i < this.particleCount; i++) {
          this.pos[i * 3 + 1] = Math.max(0.0, this.pos[i * 3 + 1] - minPy);
          this.prevPos[i * 3 + 1] = Math.max(0.0, this.prevPos[i * 3 + 1] - minPy);
        }
        for (let j = 0; j < this.earMesh.vertexCount; j++) {
          this.earPos[j * 3 + 1] = Math.max(0.01, this.earPos[j * 3 + 1] - minPy);
          this.earPrevPos[j * 3 + 1] = Math.max(0.01, this.earPrevPos[j * 3 + 1] - minPy);
        }
        this.com[1] = Math.max(0.25, this.com[1] - minPy);
      }
      if ((this.activeAction || this.isProwling) && !this.trotTarget) {
        let shiftX = 0.0, shiftZ = 0.0;
        if (this.com[0] > 0.24) shiftX = 0.24 - this.com[0];
        else if (this.com[0] < -0.24) shiftX = -0.24 - this.com[0];
        if (this.com[2] > 0.22) shiftZ = 0.22 - this.com[2];
        else if (this.com[2] < -0.18) shiftZ = -0.18 - this.com[2];
        if (shiftX !== 0.0 || shiftZ !== 0.0) {
          for (let i = 0; i < this.particleCount; i++) {
            this.pos[i * 3 + 0] += shiftX;
            this.prevPos[i * 3 + 0] += shiftX;
            this.pos[i * 3 + 2] += shiftZ;
            this.prevPos[i * 3 + 2] += shiftZ;
          }
          for (let j = 0; j < this.earMesh.vertexCount; j++) {
            this.earPos[j * 3 + 0] += shiftX;
            this.earPrevPos[j * 3 + 0] += shiftX;
            this.earPos[j * 3 + 2] += shiftZ;
            this.earPrevPos[j * 3 + 2] += shiftZ;
          }
          for (let k = 0; k < this.tailParticleCount; k++) {
            this.tailPos[k * 3 + 0] += shiftX;
            this.tailPrevPos[k * 3 + 0] += shiftX;
            this.tailPos[k * 3 + 2] += shiftZ;
            this.tailPrevPos[k * 3 + 2] += shiftZ;
          }
          this.com[0] += shiftX;
          this.com[2] += shiftZ;
        }
      }
    }

    this._updateDeformedSkinAndAttachments(clampedDt, false);
    this._updateTailTubeMesh(clampedDt, false);
    this._updateEarNormals();
    this._updateFurTipSprings(clampedDt);
  }

  _updateBlinkAndExpressions(dt) {
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0.0) {
      this.blinkTimer = 2.6 + Math.random() * 2.8;
    }
    if (this.blinkTimer < 0.18) {
      const phase = this.blinkTimer / 0.18;
      this.blinkAmount = Math.sin(phase * Math.PI);
    } else {
      this.blinkAmount = 0.0;
    }

    const moodNorm = this.moodValue / 100.0;
    let targetPupil = 0.38 + moodNorm * 0.42;
    if (this.isArching || this.activeAction === 'pounce' || this.activeAction === 'chase') {
      targetPupil = 0.92;
    } else if (this.isPurring || this.isNapping) {
      targetPupil = 0.35;
    }
    this.pupilScale += (targetPupil - this.pupilScale) * Math.min(1.0, dt * 8.0);

    if (this.isScruffGrabbed) {
      this.mouthMode = 'o';
      this.eyesClosed = false;
    } else if (this.isArching) {
      this.mouthMode = '^';
      this.eyesClosed = false;
    } else if (this.isPurring || this.isNapping) {
      this.mouthMode = 'w';
      this.eyesClosed = true;
    } else {
      this.mouthMode = 'w';
      this.eyesClosed = false;
    }
  }

  // --------------------------------------------------------------------------
  // 7. POSTURE CONTROLLER & REST-SHAPE ANIMATION STATE MACHINE
  // --------------------------------------------------------------------------

  _updatePostureAndActionController(dt) {
    if (this.activeAction || this.isPurring || this.isProwling) {
      this.actionTime += dt;
    }
    if (this.scruffImpactTimer > 0) {
      this.scruffImpactTimer = Math.max(0, this.scruffImpactTimer - dt);
    }

    let targetRoll = 0.0;
    let targetPitch = 0.0;
    let targetYaw = this.currentYaw;
    let targetPuff = 1.0;
    this.spineArchAmount = 0.0;

    // Reset dynamic cell rest offsets from base restPos before applying active pose modifiers
    for (let i = 0; i < this.particleCount; i++) {
      let rx = this.restPos[i * 3 + 0];
      let ry = this.restPos[i * 3 + 1];
      let rz = this.restPos[i * 3 + 2];

      // Ambient breathing (or deep slow breathing during Nap, 1.8 Hz + 24 Hz micro-vibration during Purr)
      const breathFreq = this.isNapping ? 0.65 : (this.isPurring ? 1.8 : 1.1);
      const breathAmp = this.isPurring ? 0.028 : 0.012;
      const breathPhase = Math.sin(this.simTime * breathFreq * Math.PI * 2.0);
      if (ry > 0.35 && ry < 1.25) {
        const chestWeight = Math.sin(((ry - 0.35) / 0.90) * Math.PI);
        rx *= 1.0 + breathPhase * breathAmp * chestWeight;
        rz += Math.sign(rz + 0.05) * breathPhase * breathAmp * chestWeight;
        if (this.isPurring) {
          const purrVib = Math.sin(this.simTime * 24.0 * Math.PI * 2.0) * 0.0045 * chestWeight;
          rx += purrVib;
          ry += purrVib;
        }
      }

      // 1. Scruff hang reflex & landing pancake squash (move_scruff_drop)
      if (this.isScruffGrabbed) {
        if (this.com[1] < 1.18) {
          if (ry > 1.05) {
            ry += 0.16 * ((ry - 1.05) / 1.0);
          }
        } else {
          if (ry < 1.38) {
            ry = 1.38 - (1.38 - ry) * 1.16;
            rx *= 0.88;
            rz *= 0.90;
          }
          if (ry < 0.48) {
            ry -= 0.14;
            rz -= 0.08;
          }
        }
      } else if (this.scruffImpactTimer > 0) {
        const imp = Math.sin((this.scruffImpactTimer / 0.28) * Math.PI);
        ry *= (1.0 - 0.28 * imp);
        rx *= (1.0 + 0.20 * imp);
        rz *= (1.0 + 0.18 * imp);
      }

      // 2. Purr & Loaf pose (move_purr_loaf)
      if ((this.isPurring || this.activeAction === 'purr') && !this.isScruffGrabbed) {
        const t = this.actionTime;
        if (t < 0.25) {
          this.actionPhase = 't0_anticipation';
          ry *= 0.91;
          rx *= 1.06;
          if (ry < 0.45 && rz > 0.14) {
            rz -= 0.08;
          }
        } else if (t < 0.72) {
          this.actionPhase = 't1_drive';
          ry *= 0.75;
          rx *= 1.22;
          rz *= 1.16;
          if (ry < 0.45 && rz > 0.14) {
            rz -= 0.28;
            ry += 0.14;
            rx *= 0.50;
          }
        } else if (t < 1.20) {
          this.actionPhase = 't2_apex';
          ry *= 0.81;
          rx *= 1.26;
          rz *= 1.20;
          if (ry < 0.45 && rz > 0.14) {
            rz -= 0.28;
            ry += 0.14;
            rx *= 0.50;
          }
        } else {
          this.actionPhase = 't3_settle';
          ry *= 0.74;
          rx *= 1.20;
          rz *= 1.15;
          if (ry < 0.45 && rz > 0.14) {
            rz -= 0.28;
            ry += 0.14;
            rx *= 0.50;
          }
        }
      }

      // Nap donut curl pose: curl spine & head inward
      if (this.isNapping && !this.isScruffGrabbed) {
        const napBlend = Math.min(1.0, this.actionTime / 0.45 || 1.0);
        ry *= (1.0 - 0.26 * napBlend);
        const curlAngle = (ry / 2.0) * 0.55 * napBlend;
        const nrx = rx * Math.cos(curlAngle) - (rz - 0.15) * Math.sin(curlAngle);
        const nrz = rx * Math.sin(curlAngle) + (rz - 0.15) * Math.cos(curlAngle) + 0.15;
        rx = nrx * (1.0 + 0.15 * napBlend);
        rz = nrz + 0.10 * (ry / 1.8) * napBlend;
      }

      // 3. Arch & Hiss (move_arch_hiss): 3/4 side profile + inverted-U spine arch
      if (this.isArching || this.activeAction === 'arch') {
        const t = this.actionTime;
        const spineNorm = Math.max(0.0, Math.min(1.0, (ry - 0.15) / 1.35));
        if (t < 0.24) {
          this.actionPhase = 't0_anticipation';
          this.spineArchAmount = 0.08;
          targetPuff = 1.16;
          this.furPuffScale = 1.16;
          targetYaw = 0.52;
          ry *= 0.84;
          rx *= 1.10;
          if (ry > 1.15) rz -= 0.12;
        } else if (t < 0.62) {
          this.actionPhase = 't1_drive';
          this.spineArchAmount = 0.28;
          targetPuff = 1.46;
          this.furPuffScale = 1.46;
          targetYaw = 0.86;
          ry += 0.30 * Math.sin(spineNorm * Math.PI);
          ry *= 1.05;
        } else if (t < 1.12) {
          this.actionPhase = 't2_apex';
          this.spineArchAmount = 0.46;
          targetPuff = 1.75;
          this.furPuffScale = 1.75;
          targetYaw = 0.96;
          ry += 0.48 * Math.sin(spineNorm * Math.PI);
          rz -= 0.16 * Math.sin(spineNorm * Math.PI);
          ry *= 1.12;
        } else if (t < 1.65) {
          this.actionPhase = 't3_settle';
          const rem = Math.max(0.0, 1.0 - (t - 1.12) / 0.32);
          this.spineArchAmount = 0.02 * rem;
          targetPuff = 1.0 + 0.05 * rem;
          this.furPuffScale = targetPuff;
          targetYaw = 0.10 * rem;
          ry += 0.12 * rem * Math.sin(spineNorm * Math.PI);
        } else {
          this.isArching = false;
          if (this.activeAction === 'arch') this.activeAction = null;
          this.actionPhase = 'idle';
          this.spineArchAmount = 0.0;
          targetPuff = 1.0;
          this.furPuffScale = 1.0;
          targetYaw = 0.0;
        }
      }

      // 4. Pounce (move_pounce): t0 crouch + butt-wiggle -> t1 airborne stretch -> t2 floor pancake squash -> t3 settle
      if (this.activeAction === 'pounce') {
        const t = this.actionTime;
        if (t < 0.36) {
          this.actionPhase = 't0_anticipation';
          targetYaw = 0.34;
          targetRoll = Math.sin(t * 9.0 * Math.PI * 2.0) * 0.12;
          targetPitch = 0.12;
          ry *= 0.73;
          rx *= 1.18;
          rz *= 1.14;
        } else if (t < 0.66) {
          this.actionPhase = 't1_drive';
          targetYaw = 0.34;
          targetPitch = -0.22;
          ry *= 1.12;
          rz *= 1.20;
          if (ry < 0.55 && rz > 0.12) {
            rz += 0.28;
            ry += 0.18;
          }
        } else if (t < 0.96) {
          this.actionPhase = 't2_apex';
          targetYaw = 0.24;
          targetPitch = 0.08;
          ry *= 0.71;
          rx *= 1.22;
          rz *= 1.18;
        } else if (t < 1.40) {
          this.actionPhase = 't3_settle';
          targetYaw = 0.12;
          targetPitch = 0.0;
          targetRoll = 0.0;
          ry *= 0.99;
        } else {
          this.activeAction = null;
          this.actionPhase = 'idle';
        }
      }

      // 5. Prowl (move_prowl): forward-diagonal 3/4 stance with alternating diagonal paw strides
      if (this.isProwling && !this.trotTarget) {
        const t = this.actionTime;
        if (t < 0.24) {
          this.actionPhase = 't0_anticipation';
          targetYaw = -0.26;
          targetRoll = 0.08;
          targetPitch = 0.12;
          ry *= 0.90;
          rz *= 1.10;
          if (rx < -0.04 && ry < 0.45 && rz > 0.10) {
            ry += 0.10;
          }
        } else if (t < 0.62) {
          this.actionPhase = 't1_drive';
          targetYaw = -0.34;
          targetRoll = 0.17;
          targetPitch = 0.14;
          ry *= 0.86;
          rz *= 1.16;
          if ((rx < -0.04 && ry < 0.48 && rz > 0.10) || (rx > 0.04 && ry < 0.48 && rz < -0.05)) {
            ry += 0.26;
            rz += 0.22;
          }
        } else if (t < 1.00) {
          this.actionPhase = 't2_apex';
          targetYaw = 0.34;
          targetRoll = -0.17;
          targetPitch = 0.14;
          ry *= 0.86;
          rz *= 1.16;
          if ((rx > 0.04 && ry < 0.48 && rz > 0.10) || (rx < -0.04 && ry < 0.48 && rz < -0.05)) {
            ry += 0.26;
            rz += 0.22;
          }
        } else {
          this.actionPhase = 't3_settle';
          targetYaw = 0.06;
          targetRoll = 0.01;
          targetPitch = 0.0;
          ry *= 0.98;
        }
      } else if (this.trotTarget) {
        const stridePhase = this.simTime * 2.6 * Math.PI * 2.0;
        if (ry < 0.38) {
          const isLeft = rx < 0.0;
          const isFront = rz > 0.05;
          const diagSign = (isLeft === isFront) ? 1.0 : -1.0;
          const lift = Math.max(0.0, Math.sin(stridePhase) * diagSign);
          ry += lift * 0.11;
          rz += Math.cos(stridePhase) * diagSign * 0.06;
        }
      }

      // 6. Groom (move_groom): lift right front paw to cheek & wipe across whiskers
      if (this.activeAction === 'groom') {
        const t = this.actionTime;
        if (t < 0.25) {
          this.actionPhase = 't0_anticipation';
          targetRoll = -0.13;
          targetPitch = 0.04;
          if (rx > 0.04 && ry < 0.72 && rz > 0.08) {
            const pw = Math.min(1.0, (0.72 - ry) / 0.42);
            ry += 0.26 * pw;
            rz += 0.14 * pw;
          }
        } else if (t < 0.62) {
          this.actionPhase = 't1_drive';
          targetRoll = 0.23;
          targetPitch = 0.08;
          ry *= 0.95;
          if (rx > 0.04 && ry < 0.72 && rz > 0.08) {
            const pw = Math.min(1.0, (0.72 - ry) / 0.42);
            ry += 0.76 * pw;
            rz += 0.32 * pw;
            rx -= 0.10 * pw;
          }
          if (ry > 1.15) {
            const hw = Math.min(1.0, (ry - 1.15) / 0.45);
            const ang = 0.24 * hw;
            const dy = ry - 1.15;
            const nx = rx * Math.cos(ang) + dy * Math.sin(ang);
            const ny = -rx * Math.sin(ang) + dy * Math.cos(ang) + 1.15;
            rx = nx;
            ry = ny;
          }
        } else if (t < 1.10) {
          this.actionPhase = 't2_apex';
          targetRoll = 0.26;
          targetPitch = 0.12;
          ry *= 0.94;
          if (rx > 0.04 && ry < 0.72 && rz > 0.08) {
            const pw = Math.min(1.0, (0.72 - ry) / 0.42);
            ry += 0.62 * pw;
            rz += 0.38 * pw;
            rx -= 0.18 * pw;
          }
          if (ry > 1.15) {
            const hw = Math.min(1.0, (ry - 1.15) / 0.45);
            const ang = 0.28 * hw;
            const dy = ry - 1.15;
            const nx = rx * Math.cos(ang) + dy * Math.sin(ang);
            const ny = -rx * Math.sin(ang) + dy * Math.cos(ang) + 1.15;
            rx = nx;
            ry = ny;
            rz += 0.08 * hw;
          }
        } else if (t < 1.45) {
          this.actionPhase = 't3_settle';
          targetRoll = 0.01;
          targetPitch = 0.0;
          ry *= 0.99;
        } else {
          this.activeAction = null;
          this.actionPhase = 'idle';
        }
      }

      // 7. Chase Mouse (move_chase_mouse): predator crouch -> forward lunge -> paw bat -> settle
      if (this.activeAction === 'chase') {
        const t = this.actionTime;
        if (t < 0.30) {
          this.actionPhase = 't0_anticipation';
          targetYaw = 0.22;
          targetRoll = 0.11;
          targetPitch = 0.10;
          ry *= 0.75;
          rx *= 1.16;
          rz *= 1.14;
        } else if (t < 0.64) {
          this.actionPhase = 't1_drive';
          targetYaw = 0.28;
          targetRoll = 0.18;
          targetPitch = -0.10;
          ry *= 1.09;
          rz *= 1.22;
          if (ry < 0.52 && rz > 0.12) {
            rz += 0.24;
            ry += 0.14;
          }
        } else if (t < 0.96) {
          this.actionPhase = 't2_apex';
          targetYaw = 0.10;
          targetRoll = -0.16;
          targetPitch = 0.06;
          if (rx > 0.02 && ry < 0.65 && rz > 0.10) {
            rz += 0.36;
            ry += 0.24;
            rx -= 0.12;
          }
        } else if (t < 1.38) {
          this.actionPhase = 't3_settle';
          targetYaw = -0.15;
          targetRoll = -0.02;
          targetPitch = 0.0;
          ry *= 0.98;
        } else {
          this.activeAction = null;
          this.actionPhase = 'idle';
        }
      }

      // 8. Nap Topple (move_nap_topple): grounded side-flop with soft flank squish & self-righting
      if (this.activeAction === 'topple') {
        const t = this.actionTime;
        if (t < 0.24) {
          this.actionPhase = 't0_anticipation';
          targetRoll = -0.42;
          targetPitch = 0.04;
          ry *= 0.95;
        } else if (t < 0.58) {
          this.actionPhase = 't1_drive';
          targetRoll = -1.05;
          targetPitch = 0.06;
          ry *= 0.80;
          rx *= 1.18;
        } else if (t < 0.96) {
          this.actionPhase = 't2_apex';
          targetRoll = -1.12;
          targetPitch = 0.05;
          ry *= 0.73;
          rx *= 1.24;
          rz *= 1.16;
        } else if (t < 1.48) {
          this.actionPhase = 't3_settle';
          targetRoll = 0.02;
          targetPitch = 0.0;
          ry *= 0.99;
        } else {
          this.activeAction = null;
          this.actionPhase = 'idle';
        }
      }

      // Head tracking (for Chase mouse or Finger headbutt lean)
      if (ry > 1.12) {
        const hw = Math.min(1.0, (ry - 1.12) / 0.45);
        const yaw = this.headTrackYaw * hw;
        if (Math.abs(yaw) > 1e-4) {
          const cy = Math.cos(yaw), sy = Math.sin(yaw);
          const nrx = rx * cy + rz * sy;
          const nrz = -rx * sy + rz * cy;
          rx = nrx;
          rz = nrz;
        }
        rx += this.headbuttLean[0] * hw;
        ry += this.headbuttLean[1] * hw;
        rz += this.headbuttLean[2] * hw;
      }

      this.animRestPos[i * 3 + 0] = rx;
      this.animRestPos[i * 3 + 1] = ry;
      this.animRestPos[i * 3 + 2] = rz;
    }

    this.furPuffScale += (targetPuff - this.furPuffScale) * Math.min(1.0, dt * 14.0);
    this.headbuttLean[0] *= Math.exp(-dt * 5.0);
    this.headbuttLean[1] *= Math.exp(-dt * 5.0);
    this.headbuttLean[2] *= Math.exp(-dt * 5.0);

    // Update each hex cell's dynamic rest offsets from animRestPos
    for (let cIdx = 0; cIdx < this.cellCount; cIdx++) {
      const cell = this.cells[cIdx];
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 8; k++) {
        const ni = cell.nodes[k];
        cx += this.animRestPos[ni * 3 + 0];
        cy += this.animRestPos[ni * 3 + 1];
        cz += this.animRestPos[ni * 3 + 2];
      }
      cx *= 0.125; cy *= 0.125; cz *= 0.125;
      for (let k = 0; k < 8; k++) {
        const ni = cell.nodes[k];
        cell.dynOffsets[k * 3 + 0] = this.animRestPos[ni * 3 + 0] - cx;
        cell.dynOffsets[k * 3 + 1] = this.animRestPos[ni * 3 + 1] - cy;
        cell.dynOffsets[k * 3 + 2] = this.animRestPos[ni * 3 + 2] - cz;
      }
    }

    // Whole-body impulses, particle bursts, and settle damping per mechanic
    if (this.isPurring || this.activeAction === 'purr') {
      const t = this.actionTime;
      if (t >= 0.72 && !this._purrPeakEmitted) {
        this._purrPeakEmitted = true;
        this.pendingParticles.push({
          type: 'heart',
          position: [this.com[0], 1.72, this.com[2] + 0.35],
          count: 10
        });
      }
      if (t >= 1.20) {
        for (let k = 0; k < this.vel.length; k++) {
          this.vel[k] *= 0.65;
        }
      }
    }

    if ((this.isArching || this.activeAction === 'arch') && this.actionTime >= 1.12) {
      for (let k = 0; k < this.vel.length; k++) {
        this.vel[k] *= 0.70;
      }
    }

    if (this.activeAction === 'pounce') {
      const t = this.actionTime;
      if (t >= 0.36 && t < 0.66) {
        if (!this._pounceLaunched) {
          this._pounceLaunched = true;
          for (let i = 0; i < this.particleCount; i++) {
            this.pos[i * 3 + 1] += 0.05;
            this.prevPos[i * 3 + 1] += 0.05;
            this.vel[i * 3 + 0] = 0.38;
            this.vel[i * 3 + 1] = 1.48;
            this.vel[i * 3 + 2] = 0.25;
          }
        }
      } else if (t >= 0.66 && t < 0.96) {
        if (!this._pounceLanded) {
          this._pounceLanded = true;
          let minPy = Infinity;
          for (let i = 0; i < this.particleCount; i++) {
            if (this.pos[i * 3 + 1] < minPy) minPy = this.pos[i * 3 + 1];
          }
          if (minPy > 0 && Number.isFinite(minPy)) {
            for (let i = 0; i < this.particleCount; i++) {
              this.pos[i * 3 + 1] = Math.max(0.0, this.pos[i * 3 + 1] - minPy);
              this.prevPos[i * 3 + 1] = this.pos[i * 3 + 1];
              this.vel[i * 3 + 1] = -0.15;
            }
          }
          this.attachments.bell.vel[2] += 1.8;
          this.pendingParticles.push(
            { type: 'sparkle', position: [this.com[0], 0.24, this.com[2] + 0.38], count: 12 },
            { type: 'tuft', position: [this.com[0], 0.18, this.com[2] + 0.34], count: 8 }
          );
        }
      } else if (t >= 0.96) {
        for (let k = 0; k < this.vel.length; k++) {
          this.vel[k] *= 0.72;
        }
      }
    }

    if (this.isProwling || this.trotTarget) {
      if (this.trotTarget) {
        const dx = this.trotTarget.x - this.com[0];
        const dz = this.trotTarget.z - this.com[2];
        const dist = Math.hypot(dx, dz);
        if (dist > 0.14) {
          this.actionPhase = (Math.floor(this.simTime * 5.2) % 2 === 0) ? 't1_drive' : 't2_apex';
          const desiredYaw = Math.atan2(dx, dz);
          let diff = desiredYaw - this.currentYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.currentYaw += diff * Math.min(1.0, dt * 6.0);
          targetYaw = this.currentYaw;
          this._applyProwlGaitImpulse(dt, 0.75);
        } else {
          this.actionPhase = 't3_settle';
          let diff = 0.0 - this.currentYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.currentYaw += diff * Math.min(1.0, dt * 5.0);
          targetYaw = this.currentYaw;
          if (Math.abs(diff) < 0.08) {
            this.trotTarget = null;
            this.actionPhase = 'idle';
          }
        }
      } else {
        const t = this.actionTime;
        if (t >= 0.24 && t < 0.62) {
          for (let i = 0; i < this.particleCount; i++) {
            if (this.pos[i * 3 + 1] < 0.25) {
              this.vel[i * 3 + 0] += (-0.22 - this.vel[i * 3 + 0]) * Math.min(1.0, dt * 10.0);
              this.vel[i * 3 + 2] += (0.42 - this.vel[i * 3 + 2]) * Math.min(1.0, dt * 10.0);
            }
          }
          if (!this._prowlSparkleA) {
            this._prowlSparkleA = true;
            this.pendingParticles.push({
              type: 'sparkle',
              position: [this.com[0] - 0.12, 0.92, this.com[2] + 0.42],
              count: 3
            });
          }
        } else if (t >= 0.62 && t < 1.00) {
          for (let i = 0; i < this.particleCount; i++) {
            if (this.pos[i * 3 + 1] < 0.25) {
              this.vel[i * 3 + 0] += (0.28 - this.vel[i * 3 + 0]) * Math.min(1.0, dt * 10.0);
              this.vel[i * 3 + 2] += (0.38 - this.vel[i * 3 + 2]) * Math.min(1.0, dt * 10.0);
            }
          }
          if (!this._prowlSparkleB) {
            this._prowlSparkleB = true;
            this.pendingParticles.push({
              type: 'sparkle',
              position: [this.com[0] + 0.12, 0.92, this.com[2] + 0.42],
              count: 3
            });
          }
        } else if (t >= 1.00 && t < 1.45) {
          for (let k = 0; k < this.vel.length; k++) {
            this.vel[k] *= 0.70;
          }
        } else if (t >= 1.45) {
          this.actionTime = 0.24;
          this._prowlSparkleA = false;
          this._prowlSparkleB = false;
        }
      }
    }

    if (this.activeAction === 'groom') {
      const t = this.actionTime;
      if (t >= 0.64 && !this._groomSparkled) {
        this._groomSparkled = true;
        this.pendingParticles.push(
          { type: 'heart', position: [this.com[0] + 0.28, 1.52, this.com[2] + 0.45], count: 5 },
          { type: 'sparkle', position: [this.com[0] + 0.24, 1.44, this.com[2] + 0.48], count: 4 }
        );
      }
      if (t >= 1.10) {
        for (let k = 0; k < this.vel.length; k++) {
          this.vel[k] *= 0.70;
        }
      }
    }

    if (this.activeAction === 'chase') {
      const t = this.actionTime;
      const mouse = this.attachments.mouseToy;
      mouse.active = true;

      if (t < 0.30) {
        this.headTrackYaw = 0.44;
        mouse.pos[0] = 0.40 + Math.sin(t * 28.0) * 0.06;
        mouse.pos[1] = 0.08;
        mouse.pos[2] = 0.62;
      } else if (t < 0.64) {
        this.headTrackYaw = 0.25;
        if (!this._chaseLunged) {
          this._chaseLunged = true;
          for (let i = 0; i < this.particleCount; i++) {
            this.vel[i * 3 + 0] = 0.42;
            this.vel[i * 3 + 1] = 0.08;
            this.vel[i * 3 + 2] = 0.45;
          }
        }
      } else if (t < 0.96) {
        this.headTrackYaw = -0.18;
        if (!this._chaseBatted) {
          this._chaseBatted = true;
          mouse.pos[0] = 0.05;
          mouse.pos[1] = 0.10;
          mouse.pos[2] = 0.66;
          mouse.vel[0] = -2.4;
          mouse.vel[1] = 0.35;
          mouse.vel[2] = 0.22;
          this.pendingParticles.push({
            type: 'sparkle',
            position: [0.12, 0.22, 0.65],
            count: 14
          });
        }
      } else if (t < 1.38) {
        this.headTrackYaw = -0.28;
        mouse.pos[0] = -0.52;
        mouse.pos[1] = 0.08;
        mouse.pos[2] = 0.72;
        mouse.vel[0] = 0.0;
        mouse.vel[1] = 0.0;
        mouse.vel[2] = 0.0;
        for (let k = 0; k < this.vel.length; k++) {
          this.vel[k] *= 0.70;
        }
      } else {
        this.headTrackYaw = 0.0;
      }
    } else {
      this.headTrackYaw *= Math.exp(-dt * 6.0);
    }

    if (this.activeAction === 'topple') {
      const t = this.actionTime;
      if (t < 0.24) {
        if (!this._toppleImpulsed) {
          this._toppleImpulsed = true;
          for (let i = 0; i < this.particleCount; i++) {
            this.vel[i * 3 + 0] = -0.55;
            this.vel[i * 3 + 1] = -0.25;
            this.vel[i * 3 + 2] = 0.0;
          }
        }
      } else if (t < 0.58) {
        for (let i = 0; i < this.particleCount; i++) {
          this.vel[i * 3 + 1] -= 8.0 * dt;
        }
      } else if (t < 0.96) {
        let minPy = Infinity;
        for (let i = 0; i < this.particleCount; i++) {
          if (this.pos[i * 3 + 1] < minPy) minPy = this.pos[i * 3 + 1];
        }
        if (minPy > 0 && Number.isFinite(minPy)) {
          for (let i = 0; i < this.particleCount; i++) {
            this.pos[i * 3 + 1] = Math.max(0.0, this.pos[i * 3 + 1] - minPy);
            this.prevPos[i * 3 + 1] = this.pos[i * 3 + 1];
          }
        }
        if (!this._toppleSnoozed) {
          this._toppleSnoozed = true;
          this.pendingParticles.push(
            { type: 'z', position: [this.com[0] - 0.15, 0.95, this.com[2] + 0.35], count: 8 },
            { type: 'tuft', position: [this.com[0] - 0.25, 0.22, this.com[2] + 0.25], count: 5 }
          );
        }
      } else if (t < 1.48) {
        let minPy = Infinity;
        for (let i = 0; i < this.particleCount; i++) {
          if (this.pos[i * 3 + 1] < minPy) minPy = this.pos[i * 3 + 1];
        }
        if (minPy > 0 && Number.isFinite(minPy)) {
          for (let i = 0; i < this.particleCount; i++) {
            this.pos[i * 3 + 1] = Math.max(0.0, this.pos[i * 3 + 1] - minPy);
            this.prevPos[i * 3 + 1] = this.pos[i * 3 + 1];
          }
        }
        for (let k = 0; k < this.vel.length; k++) {
          this.vel[k] *= 0.68;
        }
      }
    }

    // Periodic ambient particle emission for Purr (hearts) and Nap (z's)
    this.particleEmitAccum += dt;
    if (this.isPurring && this.particleEmitAccum > 0.55) {
      this.particleEmitAccum = 0.0;
      this.pendingParticles.push({
        type: 'heart',
        position: [this.com[0] + (Math.random() - 0.5) * 0.3, this.com[1] + 0.95, this.com[2] + 0.25],
        count: 2
      });
    } else if (this.isNapping && this.particleEmitAccum > 0.75) {
      this.particleEmitAccum = 0.0;
      this.pendingParticles.push({
        type: 'z',
        position: [this.com[0] + 0.15, this.com[1] + 0.85, this.com[2] + 0.30],
        count: 1
      });
    }

    this.currentYaw += (targetYaw - this.currentYaw) * Math.min(1.0, dt * 12.0);
    PlushPhysicsEngine._eulerToQuat(targetPitch, targetYaw, targetRoll, this.goalRotation);
  }

  _applyProwlGaitImpulse(dt, speed) {
    const stridePhase = this.simTime * 2.6 * Math.PI * 2.0;
    const sinY = Math.sin(this.currentYaw), cosY = Math.cos(this.currentYaw);
    const fwdX = sinY * speed;
    const fwdZ = cosY * speed;

    for (let i = 0; i < this.particleCount; i++) {
      const py = this.pos[i * 3 + 1];
      if (py < 0.25) {
        const isLeft = this.restPos[i * 3 + 0] < 0.0;
        const isFront = this.restPos[i * 3 + 2] > 0.05;
        const diagSign = (isLeft === isFront) ? 1.0 : -1.0;
        const contactDrive = Math.max(0.0, -Math.sin(stridePhase) * diagSign);
        if (contactDrive > 0.0) {
          this.vel[i * 3 + 0] += (fwdX - this.vel[i * 3 + 0]) * Math.min(1.0, dt * 14.0 * contactDrive);
          this.vel[i * 3 + 2] += (fwdZ - this.vel[i * 3 + 2]) * Math.min(1.0, dt * 14.0 * contactDrive);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 8. XPBD SOFT-BODY SOLVER SUBSTEP
  // --------------------------------------------------------------------------

  _stepXPBDSubstep(dt) {
    const N = this.particleCount;
    const gravity = -9.81 * 1.15;

    // 8A. Integrate velocities & predict positions
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      this.prevPos[i3 + 0] = this.pos[i3 + 0];
      this.prevPos[i3 + 1] = this.pos[i3 + 1];
      this.prevPos[i3 + 2] = this.pos[i3 + 2];

      this.vel[i3 + 1] += gravity * dt;
      this.pos[i3 + 0] += this.vel[i3 + 0] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
    }

    // Compute live center of mass and live animRestPos center of mass (zero net translation injection)
    const invN = 1.0 / (N || 1);
    let cx = 0.0, cy = 0.0, cz = 0.0;
    let acx = 0.0, acy = 0.0, acz = 0.0;
    for (let i = 0; i < N; i++) {
      cx += this.pos[i * 3 + 0];
      cy += this.pos[i * 3 + 1];
      cz += this.pos[i * 3 + 2];
      acx += this.animRestPos[i * 3 + 0];
      acy += this.animRestPos[i * 3 + 1];
      acz += this.animRestPos[i * 3 + 2];
    }
    this.com[0] = cx * invN;
    this.com[1] = cy * invN;
    this.com[2] = cz * invN;
    const animComX = acx * invN;
    const animComY = acy * invN;
    const animComZ = acz * invN;
    this.animCom = [animComX, animComY, animComZ];

    // 8B. Weak posture controller (rotates animRestPos - animCom about current COM by goalRotation; zero net force on COM)
    const postureStrength = this.isScruffGrabbed ? 0.015 : (this.activeAction === 'topple' ? 0.095 : 0.065);
    const gq = this.goalRotation;
    const rotPt = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const rx = this.animRestPos[i3 + 0] - animComX;
      const ry = this.animRestPos[i3 + 1] - animComY;
      const rz = this.animRestPos[i3 + 2] - animComZ;
      PlushPhysicsEngine._rotateVecByQuat(rx, ry, rz, gq, rotPt);

      const gx = this.com[0] + rotPt[0];
      const gy = this.com[1] + rotPt[1];
      const gz = this.com[2] + rotPt[2];

      const dx = (gx - this.pos[i3 + 0]) * postureStrength;
      const dy = (gy - this.pos[i3 + 1]) * postureStrength;
      const dz = (gz - this.pos[i3 + 2]) * postureStrength;
      this.pos[i3 + 0] += dx;
      this.pos[i3 + 1] += dy;
      this.pos[i3 + 2] += dz;
      this.prevPos[i3 + 0] += dx * 0.88;
      this.prevPos[i3 + 1] += dy * 0.88;
      this.prevPos[i3 + 2] += dz * 0.88;
    }

    // 8C. Cell-wise co-rotational shape matching (log-scaled Stuffing slider + 1.8x boost when badly crushed)
    const stuffingNorm = this.stuffingValue / 100.0;
    const baseStiffness = 0.08 * Math.pow(11.0, stuffingNorm); // log scale ~0.08..0.88
    const cellA = new Float32Array(9);
    const cellR = new Float32Array(9);

    for (let cIdx = 0; cIdx < this.cellCount; cIdx++) {
      const cell = this.cells[cIdx];
      const nodes = cell.nodes;
      let cmx = 0, cmy = 0, cmz = 0;
      for (let k = 0; k < 8; k++) {
        const ni = nodes[k] * 3;
        cmx += this.pos[ni + 0];
        cmy += this.pos[ni + 1];
        cmz += this.pos[ni + 2];
      }
      cmx *= 0.125; cmy *= 0.125; cmz *= 0.125;

      cellA.fill(0.0);
      for (let k = 0; k < 8; k++) {
        const ni = nodes[k] * 3;
        const px = this.pos[ni + 0] - cmx;
        const py = this.pos[ni + 1] - cmy;
        const pz = this.pos[ni + 2] - cmz;
        const qx = cell.dynOffsets[k * 3 + 0];
        const qy = cell.dynOffsets[k * 3 + 1];
        const qz = cell.dynOffsets[k * 3 + 2];

        cellA[0] += px * qx; cellA[1] += px * qy; cellA[2] += px * qz;
        cellA[3] += py * qx; cellA[4] += py * qy; cellA[5] += py * qz;
        cellA[6] += pz * qx; cellA[7] += pz * qy; cellA[8] += pz * qz;
      }

      // Check determinant of normalized deformation to boost badly crushed cells (< 0.45) by 1.8x
      const detA = PlushPhysicsEngine._detMat3(cellA) / 0.00018;
      const crushBoost = detA < 0.45 ? 1.8 : 1.0;
      const alpha = Math.min(0.95, baseStiffness * crushBoost);

      PlushPhysicsEngine._extractRotationPolar(cellA, cell.quat, cellR, 4);

      for (let k = 0; k < 8; k++) {
        const ni = nodes[k] * 3;
        const qx = cell.dynOffsets[k * 3 + 0];
        const qy = cell.dynOffsets[k * 3 + 1];
        const qz = cell.dynOffsets[k * 3 + 2];
        const gx = cmx + cellR[0] * qx + cellR[1] * qy + cellR[2] * qz;
        const gy = cmy + cellR[3] * qx + cellR[4] * qy + cellR[5] * qz;
        const gz = cmz + cellR[6] * qx + cellR[7] * qy + cellR[8] * qz;

        const dx = (gx - this.pos[ni + 0]) * alpha;
        const dy = (gy - this.pos[ni + 1]) * alpha;
        const dz = (gz - this.pos[ni + 2]) * alpha;
        this.pos[ni + 0] += dx;
        this.pos[ni + 1] += dy;
        this.pos[ni + 2] += dz;
        this.prevPos[ni + 0] += dx * 0.88;
        this.prevPos[ni + 1] += dy * 0.88;
        this.prevPos[ni + 2] += dz * 0.88;
      }
    }

    // 8D. Per-tet XPBD volume constraints (C = V - V_rest) & live signed volume sum
    const complianceVol = 0.00008 * Math.pow(0.08, stuffingNorm) / (dt * dt);
    let currentSignedVol = 0.0;

    for (let t = 0; t < this.tetCount; t++) {
      const i0 = this.tets[t * 4 + 0];
      const i1 = this.tets[t * 4 + 1];
      const i2 = this.tets[t * 4 + 2];
      const i3 = this.tets[t * 4 + 3];

      const x0 = this.pos[i0 * 3], y0 = this.pos[i0 * 3 + 1], z0 = this.pos[i0 * 3 + 2];
      const x1 = this.pos[i1 * 3], y1 = this.pos[i1 * 3 + 1], z1 = this.pos[i1 * 3 + 2];
      const x2 = this.pos[i2 * 3], y2 = this.pos[i2 * 3 + 1], z2 = this.pos[i2 * 3 + 2];
      const x3 = this.pos[i3 * 3], y3 = this.pos[i3 * 3 + 1], z3 = this.pos[i3 * 3 + 2];

      const e1x = x1 - x0, e1y = y1 - y0, e1z = z1 - z0;
      const e2x = x2 - x0, e2y = y2 - y0, e2z = z2 - z0;
      const e3x = x3 - x0, e3y = y3 - y0, e3z = z3 - z0;

      // Gradients grad_1, grad_2, grad_3, grad_0 of V = (1/6) det(e1, e2, e3)
      const g1x = (e2y * e3z - e2z * e3y) / 6.0;
      const g1y = (e2z * e3x - e2x * e3z) / 6.0;
      const g1z = (e2x * e3y - e2y * e3x) / 6.0;

      const g2x = (e3y * e1z - e3z * e1y) / 6.0;
      const g2y = (e3z * e1x - e3x * e1z) / 6.0;
      const g2z = (e3x * e1y - e3y * e1x) / 6.0;

      const g3x = (e1y * e2z - e1z * e2y) / 6.0;
      const g3y = (e1z * e2x - e1x * e2z) / 6.0;
      const g3z = (e1x * e2y - e1y * e2x) / 6.0;

      const g0x = -(g1x + g2x + g3x);
      const g0y = -(g1y + g2y + g3y);
      const g0z = -(g1z + g2z + g3z);

      const vol = e1x * g1x + e1y * g1y + e1z * g1z;
      currentSignedVol += vol;
      const C = vol - this.tetRestVol[t];

      const w0 = this.invMass[i0], w1 = this.invMass[i1], w2 = this.invMass[i2], w3 = this.invMass[i3];
      const denom =
        w0 * (g0x * g0x + g0y * g0y + g0z * g0z) +
        w1 * (g1x * g1x + g1y * g1y + g1z * g1z) +
        w2 * (g2x * g2x + g2y * g2y + g2z * g2z) +
        w3 * (g3x * g3x + g3y * g3y + g3z * g3z) +
        complianceVol;

      if (denom > 1e-10) {
        const lambda = -C / denom;
        this.pos[i0 * 3 + 0] += w0 * lambda * g0x;
        this.pos[i0 * 3 + 1] += w0 * lambda * g0y;
        this.pos[i0 * 3 + 2] += w0 * lambda * g0z;

        this.pos[i1 * 3 + 0] += w1 * lambda * g1x;
        this.pos[i1 * 3 + 1] += w1 * lambda * g1y;
        this.pos[i1 * 3 + 2] += w1 * lambda * g1z;

        this.pos[i2 * 3 + 0] += w2 * lambda * g2x;
        this.pos[i2 * 3 + 1] += w2 * lambda * g2y;
        this.pos[i2 * 3 + 2] += w2 * lambda * g2z;

        this.pos[i3 * 3 + 0] += w3 * lambda * g3x;
        this.pos[i3 * 3 + 1] += w3 * lambda * g3y;
        this.pos[i3 * 3 + 2] += w3 * lambda * g3z;
      }
    }
    this.volumeRatio = Math.max(0.50, Math.min(1.35, currentSignedVol / (this.totalRestVolume || 1.0)));

    // Remove any tiny internal COM drift from non-uniform tet mass weights in 8B..8D
    let ncx = 0.0, ncy = 0.0, ncz = 0.0;
    for (let i = 0; i < N; i++) {
      ncx += this.pos[i * 3 + 0];
      ncy += this.pos[i * 3 + 1];
      ncz += this.pos[i * 3 + 2];
    }
    const dcx = this.com[0] - ncx * invN;
    const dcy = this.com[1] - ncy * invN;
    const dcz = this.com[2] - ncz * invN;
    for (let i = 0; i < N; i++) {
      this.pos[i * 3 + 0] += dcx;
      this.pos[i * 3 + 1] += dcy;
      this.pos[i * 3 + 2] += dcz;
      this.prevPos[i * 3 + 0] += dcx * 0.88;
      this.prevPos[i * 3 + 1] += dcy * 0.88;
      this.prevPos[i * 3 + 2] += dcz * 0.88;
    }

    // 8E. Hand Grab constraints with smooth radial falloff
    if (this.grabState.active && (this.grabState.type === 'body' || this.grabState.type === 'scruff')) {
      const tx = this.grabState.targetPos[0];
      const ty = Math.max(0.02, this.grabState.targetPos[1]);
      const tz = this.grabState.targetPos[2];
      const weights = this.grabState.weights;
      for (let i = 0; i < N; i++) {
        const w = weights[i];
        if (w > 1e-4) {
          const i3 = i * 3;
          const gx = tx + this.grabState.nodeOffsets[i3 + 0];
          const gy = Math.max(0.02, ty + this.grabState.nodeOffsets[i3 + 1]);
          const gz = tz + this.grabState.nodeOffsets[i3 + 2];
          this.pos[i3 + 0] += (gx - this.pos[i3 + 0]) * w * 0.65;
          this.pos[i3 + 1] += (gy - this.pos[i3 + 1]) * w * 0.65;
          this.pos[i3 + 2] += (gz - this.pos[i3 + 2]) * w * 0.65;
        }
      }
    }

    // 8E-2. Step coupled appendages (cloth ears, rope tail, brass bell) BEFORE floor contact and XPBD velocity update
    this._stepClothEarsSubstep(dt);
    this._stepRopeTailSubstep(dt);
    this._stepBellSubstep(dt);

    // 8F. Floor contact (y = 0) with Coulomb friction & rolling resistance
    const muFriction = 0.68;
    let groundContacts = 0;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      if (this.pos[i3 + 1] < 0.0) {
        const pen = -this.pos[i3 + 1];
        this.pos[i3 + 1] = 0.0;
        groundContacts++;

        const dx = this.pos[i3 + 0] - this.prevPos[i3 + 0];
        const dz = this.pos[i3 + 2] - this.prevPos[i3 + 2];
        const slipLen = Math.hypot(dx, dz);
        if (slipLen > 1e-6) {
          const scale = Math.max(0.0, 1.0 - (muFriction * (pen + 0.008)) / slipLen);
          this.pos[i3 + 0] = this.prevPos[i3 + 0] + dx * scale;
          this.pos[i3 + 2] = this.prevPos[i3 + 2] + dz * scale;
        }
      }
    }

    // 8G. Update velocities from XPBD position deltas + non-rigid deformation-mode damping
    let avgVx = 0, avgVy = 0, avgVz = 0;
    let maxSpeedSq = 0.0;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const vx = (this.pos[i3 + 0] - this.prevPos[i3 + 0]) / dt;
      const vy = (this.pos[i3 + 1] - this.prevPos[i3 + 1]) / dt;
      const vz = (this.pos[i3 + 2] - this.prevPos[i3 + 2]) / dt;
      this.vel[i3 + 0] = vx;
      this.vel[i3 + 1] = vy;
      this.vel[i3 + 2] = vz;
      avgVx += vx; avgVy += vy; avgVz += vz;
      const spSq = vx * vx + vy * vy + vz * vz;
      if (spSq > maxSpeedSq) maxSpeedSq = spSq;
    }
    avgVx /= N; avgVy /= N; avgVz /= N;

    // Damp only non-rigid velocity relative to bulk COM velocity so free-fall and tumbling are preserved
    const defDamp = 0.08;
    const rollResist = groundContacts > 4 ? 0.04 : 0.0;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      this.vel[i3 + 0] -= (this.vel[i3 + 0] - avgVx) * defDamp + this.vel[i3 + 0] * rollResist;
      this.vel[i3 + 1] -= (this.vel[i3 + 1] - avgVy) * defDamp;
      this.vel[i3 + 2] -= (this.vel[i3 + 2] - avgVz) * defDamp + this.vel[i3 + 2] * rollResist;
    }

    // Sleep check when calm
    if (maxSpeedSq < 0.0004 && !this.grabState.active && !this.activeAction) {
      this.calmTimer += dt;
      if (this.calmTimer > 1.8) this.isSleeping = true;
    } else {
      this.calmTimer = 0.0;
      this.isSleeping = false;
    }
  }

  // --------------------------------------------------------------------------
  // 9. CLOTH EARS, ROPE TAIL, BRASS BELL & MOUSE TOY SUBSTEPS
  // --------------------------------------------------------------------------

  _stepClothEarsSubstep(dt) {
    const totalVerts = this.earMesh.vertexCount;
    const gravity = -9.81 * 0.65;

    // Integrate ear particles & weak posture target (perk up vs airplane ears when arching)
    const isAirplane = this.isArching || this.activeAction === 'arch';
    const isGroom = this.activeAction === 'groom';
    const animCom = this.animCom || this.restCom;

    // Anchor weak ear posture target to animated head tets in animRestPos
    const pinL = this.earSeamPins[0];
    const pinR = this.earSeamPins[Math.min(12, this.earSeamPins.length - 1)];
    const dLx = pinL ? (this._evalTetBaryPos(pinL.tetIdx, pinL.bary, this.animRestPos, 0) - this._evalTetBaryPos(pinL.tetIdx, pinL.bary, this.restPos, 0)) : 0.0;
    const dLy = pinL ? (this._evalTetBaryPos(pinL.tetIdx, pinL.bary, this.animRestPos, 1) - this._evalTetBaryPos(pinL.tetIdx, pinL.bary, this.restPos, 1)) : 0.0;
    const dLz = pinL ? (this._evalTetBaryPos(pinL.tetIdx, pinL.bary, this.animRestPos, 2) - this._evalTetBaryPos(pinL.tetIdx, pinL.bary, this.restPos, 2)) : 0.0;
    const dRx = pinR ? (this._evalTetBaryPos(pinR.tetIdx, pinR.bary, this.animRestPos, 0) - this._evalTetBaryPos(pinR.tetIdx, pinR.bary, this.restPos, 0)) : 0.0;
    const dRy = pinR ? (this._evalTetBaryPos(pinR.tetIdx, pinR.bary, this.animRestPos, 1) - this._evalTetBaryPos(pinR.tetIdx, pinR.bary, this.restPos, 1)) : 0.0;
    const dRz = pinR ? (this._evalTetBaryPos(pinR.tetIdx, pinR.bary, this.animRestPos, 2) - this._evalTetBaryPos(pinR.tetIdx, pinR.bary, this.restPos, 2)) : 0.0;

    for (let i = 0; i < totalVerts; i++) {
      const i3 = i * 3;
      this.earPrevPos[i3 + 0] = this.earPos[i3 + 0];
      this.earPrevPos[i3 + 1] = this.earPos[i3 + 1];
      this.earPrevPos[i3 + 2] = this.earPos[i3 + 2];

      this.earVel[i3 + 1] += gravity * dt;
      this.earPos[i3 + 0] += this.earVel[i3 + 0] * dt;
      this.earPos[i3 + 1] += this.earVel[i3 + 1] * dt;
      this.earPos[i3 + 2] += this.earVel[i3 + 2] * dt;

      // Weak posture target anchored to animRestPos relative to live animCom
      const isLeftEar = i < 48;
      let lx = (this.earLocalRest[i3 + 0] + (isLeftEar ? dLx : dRx)) - animCom[0];
      let ly = (this.earLocalRest[i3 + 1] + (isLeftEar ? dLy : dRy)) - animCom[1];
      let lz = (this.earLocalRest[i3 + 2] + (isLeftEar ? dLz : dRz)) - animCom[2];

      if (isAirplane) {
        // Fold ears flat sideways (-42 deg)
        const sideSign = lx < 0 ? -1.0 : 1.0;
        const dy = Math.max(0.0, this.earLocalRest[i3 + 1] - 1.94);
        lx += sideSign * dy * 0.68;
        ly -= dy * 0.48;
      } else if (isGroom && lx > 0) {
        const dy = Math.max(0.0, this.earLocalRest[i3 + 1] - 1.94);
        ly -= dy * 0.42;
      }

      const rotPt = [0, 0, 0];
      PlushPhysicsEngine._rotateVecByQuat(lx, ly, lz, this.bodyOrientation, rotPt);
      const gx = this.com[0] + rotPt[0];
      const gy = this.com[1] + rotPt[1];
      const gz = this.com[2] + rotPt[2];

      this.earPos[i3 + 0] += (gx - this.earPos[i3 + 0]) * 0.08;
      this.earPos[i3 + 1] += (gy - this.earPos[i3 + 1]) * 0.08;
      this.earPos[i3 + 2] += (gz - this.earPos[i3 + 2]) * 0.08;
    }

    // Grab constraint if user grabbed an ear
    if (this.grabState.active && this.grabState.type === 'ear' && this.grabState.earIndex >= 0) {
      const gIdx = this.grabState.earIndex;
      const sideStart = gIdx < 48 ? 0 : 48;
      const tx = this.grabState.targetPos[0];
      const ty = Math.max(0.05, this.grabState.targetPos[1]);
      const tz = this.grabState.targetPos[2];
      for (let i = sideStart; i < sideStart + 48; i++) {
        const w = i === gIdx ? 0.85 : 0.28;
        this.earPos[i * 3 + 0] += (tx - this.earPos[i * 3 + 0]) * w;
        this.earPos[i * 3 + 1] += (ty - this.earPos[i * 3 + 1]) * w;
        this.earPos[i * 3 + 2] += (tz - this.earPos[i * 3 + 2]) * w;
      }
    }

    // Stretch, shear, and bend XPBD constraints
    for (let k = 0; k < this.earConstraints.length; k++) {
      const c = this.earConstraints[k];
      const a3 = c.a * 3, b3 = c.b * 3;
      const dx = this.earPos[b3] - this.earPos[a3];
      const dy = this.earPos[b3 + 1] - this.earPos[a3 + 1];
      const dz = this.earPos[b3 + 2] - this.earPos[a3 + 2];
      const dist = Math.hypot(dx, dy, dz) || 1e-6;
      const diff = (dist - c.restLen) / dist;
      const wa = this.earInvMass[c.a], wb = this.earInvMass[c.b];
      const s = diff / (wa + wb + c.compliance / (dt * dt));
      this.earPos[a3] += dx * s * wa;
      this.earPos[a3 + 1] += dy * s * wa;
      this.earPos[a3 + 2] += dz * s * wa;
      this.earPos[b3] -= dx * s * wb;
      this.earPos[b3 + 1] -= dy * s * wb;
      this.earPos[b3 + 2] -= dz * s * wb;
    }

    // Equal-and-opposite barycentric seam constraints sewing rows 0 & 1 into head tets
    // (Tugging an ear physically pulls and tilts the cat's head!)
    const rotOff = [0, 0, 0];
    const earShare = 0.96;
    const headShare = (this.grabState.active && this.grabState.type === 'ear') ? 0.042 : 0.0025;
    for (let k = 0; k < this.earSeamPins.length; k++) {
      const pin = this.earSeamPins[k];
      const e3 = pin.earIdx * 3;
      const ax = this._evalTetBaryPos(pin.tetIdx, pin.bary, this.pos, 0);
      const ay = this._evalTetBaryPos(pin.tetIdx, pin.bary, this.pos, 1);
      const az = this._evalTetBaryPos(pin.tetIdx, pin.bary, this.pos, 2);

      PlushPhysicsEngine._rotateVecByQuat(
        pin.restOffset[0], pin.restOffset[1], pin.restOffset[2],
        this.bodyOrientation, rotOff
      );
      const targetX = ax + rotOff[0];
      const targetY = ay + rotOff[1];
      const targetZ = az + rotOff[2];

      const errX = this.earPos[e3 + 0] - targetX;
      const errY = this.earPos[e3 + 1] - targetY;
      const errZ = this.earPos[e3 + 2] - targetZ;

      this.earPos[e3 + 0] -= errX * earShare;
      this.earPos[e3 + 1] -= errY * earShare;
      this.earPos[e3 + 2] -= errZ * earShare;

      // Apply equal-and-opposite reaction onto the 4 nodes of the head attachment tet
      for (let m = 0; m < 4; m++) {
        const ni = this.tets[pin.tetIdx * 4 + m] * 3;
        const bw = pin.bary[m] * headShare;
        this.pos[ni + 0] += errX * bw;
        this.pos[ni + 1] += errY * bw;
        this.pos[ni + 2] += errZ * bw;
      }
    }

    // Update ear velocities & floor clamp
    for (let i = 0; i < totalVerts; i++) {
      const i3 = i * 3;
      if (this.earPos[i3 + 1] < 0.01) this.earPos[i3 + 1] = 0.01;
      this.earVel[i3 + 0] = ((this.earPos[i3 + 0] - this.earPrevPos[i3 + 0]) / dt) * 0.96;
      this.earVel[i3 + 1] = ((this.earPos[i3 + 1] - this.earPrevPos[i3 + 1]) / dt) * 0.96;
      this.earVel[i3 + 2] = ((this.earPos[i3 + 2] - this.earPrevPos[i3 + 2]) / dt) * 0.96;
    }
  }

  _updateEarNormals() {
    const pos = this.earMesh.positions;
    const norm = this.earMesh.normals;
    const ind = this.earMesh.indices;
    norm.fill(0.0);

    for (let i = 0; i < ind.length; i += 3) {
      const a = ind[i] * 3, b = ind[i + 1] * 3, c = ind[i + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      norm[a] += nx; norm[a + 1] += ny; norm[a + 2] += nz;
      norm[b] += nx; norm[b + 1] += ny; norm[b + 2] += nz;
      norm[c] += nx; norm[c + 1] += ny; norm[c + 2] += nz;
    }

    for (let i = 0; i < this.earMesh.vertexCount; i++) {
      const i3 = i * 3;
      const len = Math.hypot(norm[i3], norm[i3 + 1], norm[i3 + 2]) || 1.0;
      norm[i3] /= len;
      norm[i3 + 1] /= len;
      norm[i3 + 2] /= len;
    }
  }

  _stepRopeTailSubstep(dt) {
    const N = this.tailParticleCount;
    const gravity = -9.81 * 0.85;
    const rotPt = [0, 0, 0];
    const invQ = [-this.bodyOrientation[0], -this.bodyOrientation[1], -this.bodyOrientation[2], this.bodyOrientation[3]];
    const grad = [0, 1, 0];
    const animCom = this.animCom || this.restCom;

    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      this.tailPrevPos[i3 + 0] = this.tailPos[i3 + 0];
      this.tailPrevPos[i3 + 1] = this.tailPos[i3 + 1];
      this.tailPrevPos[i3 + 2] = this.tailPos[i3 + 2];

      this.tailVel[i3 + 1] += gravity * dt;
      this.tailPos[i3 + 0] += this.tailVel[i3 + 0] * dt;
      this.tailPos[i3 + 1] += this.tailVel[i3 + 1] * dt;
      this.tailPos[i3 + 2] += this.tailVel[i3 + 2] * dt;

      // Mood & action target curl in body frame
      const u = i / (N - 1);
      let tx = this.tailLocalRest[i3 + 0];
      let ty = this.tailLocalRest[i3 + 1];
      let tz = this.tailLocalRest[i3 + 2];

      if (this.isArching || this.activeAction === 'arch') {
        // Puffed upright tail lashing rapidly at 7 Hz
        tx = Math.sin(this.simTime * 7.0 * Math.PI * 2.0 - u * 1.6) * 0.35 * u;
        ty = 0.32 + u * 0.92;
        tz = -0.45 - Math.sin(u * Math.PI) * 0.14;
      } else if (this.isProwling || this.trotTarget || this.activeAction === 'chase') {
        // High question-mark '?' curl
        tx = Math.sin(this.simTime * 2.4 - u * 1.2) * 0.12 * u;
        ty = 0.32 + u * 0.85 + Math.sin(u * Math.PI * 1.35) * 0.12;
        tz = -0.45 - u * 0.12 + (u > 0.65 ? (u - 0.65) * 0.55 : 0.0);
      } else if (this.isNapping) {
        // Wrapped snugly over the nose
        const ang = u * Math.PI * 1.28;
        tx = Math.sin(ang) * 0.52;
        ty = 0.16 + Math.sin(u * Math.PI) * 0.08;
        tz = -0.45 * Math.cos(ang) + u * 0.32;
      } else if (this.isScruffGrabbed) {
        // Dangles downward when lifted by scruff
        tx = Math.sin(this.simTime * 2.2 + u) * 0.06 * u;
        ty = 0.32 - u * 0.72;
        tz = -0.45 - u * 0.15;
      } else {
        // Gentle content swish
        const swishFreq = 0.8 + (this.moodValue / 100.0) * 1.8;
        const swish = Math.sin(this.simTime * swishFreq * Math.PI * 2.0 - u * 1.8) * 0.12 * u;
        tx += swish;
        ty += Math.abs(swish) * 0.25;
      }

      PlushPhysicsEngine._rotateVecByQuat(
        tx - animCom[0],
        ty - animCom[1],
        tz - animCom[2],
        this.bodyOrientation,
        rotPt
      );
      const gx = this.com[0] + rotPt[0];
      const gy = this.com[1] + rotPt[1];
      const gz = this.com[2] + rotPt[2];

      const pull = i === 0 ? 0.85 : 0.065;
      this.tailPos[i3 + 0] += (gx - this.tailPos[i3 + 0]) * pull;
      this.tailPos[i3 + 1] += (gy - this.tailPos[i3 + 1]) * pull;
      this.tailPos[i3 + 2] += (gz - this.tailPos[i3 + 2]) * pull;
    }

    // Grab constraint if user grabbed the tail
    if (this.grabState.active && this.grabState.type === 'tail' && this.grabState.tailIndex >= 0) {
      const idx = this.grabState.tailIndex;
      const tx = this.grabState.targetPos[0];
      const ty = Math.max(0.04, this.grabState.targetPos[1]);
      const tz = this.grabState.targetPos[2];
      this.tailPos[idx * 3 + 0] += (tx - this.tailPos[idx * 3 + 0]) * 0.75;
      this.tailPos[idx * 3 + 1] += (ty - this.tailPos[idx * 3 + 1]) * 0.75;
      this.tailPos[idx * 3 + 2] += (tz - this.tailPos[idx * 3 + 2]) * 0.75;
    }

    // Distance & bending constraints
    for (let k = 0; k < this.tailConstraints.length; k++) {
      const c = this.tailConstraints[k];
      const a3 = c.a * 3, b3 = c.b * 3;
      const dx = this.tailPos[b3] - this.tailPos[a3];
      const dy = this.tailPos[b3 + 1] - this.tailPos[a3 + 1];
      const dz = this.tailPos[b3 + 2] - this.tailPos[a3 + 2];
      const dist = Math.hypot(dx, dy, dz) || 1e-6;
      const diff = (dist - c.restLen) / dist;
      const wa = c.a === 0 ? 0.25 : 1.0;
      const wb = 1.0;
      const s = diff / (wa + wb + c.compliance / (dt * dt));
      this.tailPos[a3] += dx * s * wa;
      this.tailPos[a3 + 1] += dy * s * wa;
      this.tailPos[a3 + 2] += dz * s * wa;
      this.tailPos[b3] -= dx * s * wb;
      this.tailPos[b3 + 1] -= dy * s * wb;
      this.tailPos[b3 + 2] -= dz * s * wb;
    }

    // Equal-and-opposite seam coupling at root [0, 0.32, -0.45]
    const rx = this._evalTetBaryPos(this.tailRootTet, this.tailRootBary, this.pos, 0);
    const ry = this._evalTetBaryPos(this.tailRootTet, this.tailRootBary, this.pos, 1);
    const rz = this._evalTetBaryPos(this.tailRootTet, this.tailRootBary, this.pos, 2);
    const errX = this.tailPos[0] - rx;
    const errY = this.tailPos[1] - ry;
    const errZ = this.tailPos[2] - rz;
    const tailRootShare = (this.grabState.active && this.grabState.type === 'tail') ? 0.16 : 0.008;
    this.tailPos[0] -= errX * 0.94;
    this.tailPos[1] -= errY * 0.94;
    this.tailPos[2] -= errZ * 0.94;
    for (let m = 0; m < 4; m++) {
      const ni = this.tets[this.tailRootTet * 4 + m] * 3;
      const bw = this.tailRootBary[m] * tailRootShare;
      this.pos[ni + 0] += errX * bw;
      this.pos[ni + 1] += errY * bw;
      this.pos[ni + 2] += errZ * bw;
    }

    // Collide tail particles with body SDF (in local frame) and floor y = 0
    for (let i = 2; i < N; i++) {
      const i3 = i * 3;
      const r = this.tailRadii[i];
      if (this.tailPos[i3 + 1] < r) {
        this.tailPos[i3 + 1] = r;
      }
      // Transform into body rest frame for SDF collision
      PlushPhysicsEngine._rotateVecByQuat(
        this.tailPos[i3 + 0] - this.com[0],
        this.tailPos[i3 + 1] - this.com[1],
        this.tailPos[i3 + 2] - this.com[2],
        invQ,
        rotPt
      );
      const lx = rotPt[0] + this.restCom[0];
      const ly = rotPt[1] + this.restCom[1];
      const lz = rotPt[2] + this.restCom[2];
      const d = this.evalCatSDF(lx, ly, lz);
      if (d < r * 0.65) {
        this.evalCatSDFGradient(lx, ly, lz, grad);
        const push = r * 0.65 - d;
        PlushPhysicsEngine._rotateVecByQuat(grad[0] * push, grad[1] * push, grad[2] * push, this.bodyOrientation, rotPt);
        this.tailPos[i3 + 0] += rotPt[0];
        this.tailPos[i3 + 1] = Math.max(r, this.tailPos[i3 + 1] + rotPt[1]);
        this.tailPos[i3 + 2] += rotPt[2];
      }
    }

    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      this.tailVel[i3 + 0] = ((this.tailPos[i3 + 0] - this.tailPrevPos[i3 + 0]) / dt) * 0.95;
      this.tailVel[i3 + 1] = ((this.tailPos[i3 + 1] - this.tailPrevPos[i3 + 1]) / dt) * 0.95;
      this.tailVel[i3 + 2] = ((this.tailPos[i3 + 2] - this.tailPrevPos[i3 + 2]) / dt) * 0.95;
    }
  }

  _stepBellSubstep(dt) {
    const bell = this.attachments.bell;
    const bind = this.bellAnchorBinding;
    const rotOff = [0, 0, 0];
    PlushPhysicsEngine._rotateVecByQuat(
      bind.localOffset[0], bind.localOffset[1], bind.localOffset[2],
      this.bodyOrientation, rotOff
    );
    const ax = this._evalTetBaryPos(bind.tetIdx, bind.bary, this.pos, 0) + rotOff[0];
    const ay = this._evalTetBaryPos(bind.tetIdx, bind.bary, this.pos, 1) + rotOff[1];
    const az = this._evalTetBaryPos(bind.tetIdx, bind.bary, this.pos, 2) + rotOff[2];
    bell.anchorPos[0] = ax;
    bell.anchorPos[1] = ay;
    bell.anchorPos[2] = az;

    const prevX = bell.pos[0], prevY = bell.pos[1], prevZ = bell.pos[2];
    bell.vel[1] -= 9.81 * dt;
    if (this.isPurring) {
      bell.vel[0] += Math.sin(this.simTime * 24.0 * Math.PI * 2.0) * 0.18 * dt;
    }
    bell.pos[0] += bell.vel[0] * dt;
    bell.pos[1] += bell.vel[1] * dt;
    bell.pos[2] += bell.vel[2] * dt;

    if (this.grabState.active && this.grabState.type === 'bell') {
      bell.pos[0] += (this.grabState.targetPos[0] - bell.pos[0]) * 0.75;
      bell.pos[1] += (Math.max(0.06, this.grabState.targetPos[1]) - bell.pos[1]) * 0.75;
      bell.pos[2] += (this.grabState.targetPos[2] - bell.pos[2]) * 0.75;
    }

    // Distance constraint to collar anchor (and gentle pull back onto collar tet when grabbed)
    const dx = bell.pos[0] - ax;
    const dy = bell.pos[1] - ay;
    const dz = bell.pos[2] - az;
    const dist = Math.hypot(dx, dy, dz) || 1e-6;
    if (dist > bind.stringLength) {
      const corr = (dist - bind.stringLength) / dist;
      const collarReaction = (this.grabState.active && this.grabState.type === 'bell') ? 0.14 : 0.005;
      const bellShare = 1.0 - collarReaction;
      bell.pos[0] -= dx * corr * bellShare;
      bell.pos[1] -= dy * corr * bellShare;
      bell.pos[2] -= dz * corr * bellShare;
      for (let m = 0; m < 4; m++) {
        const ni = this.tets[bind.tetIdx * 4 + m] * 3;
        const bw = bind.bary[m] * collarReaction;
        this.pos[ni + 0] += dx * corr * bw;
        this.pos[ni + 1] += dy * corr * bw;
        this.pos[ni + 2] += dz * corr * bw;
      }
    }

    // Keep bell outside chest surface & above floor
    if (bell.pos[1] < bell.radius * 0.5) bell.pos[1] = bell.radius * 0.5;
    const chestZ = this.com[2] + 0.47;
    if (bell.pos[2] < chestZ) bell.pos[2] = chestZ;

    bell.vel[0] = ((bell.pos[0] - prevX) / dt) * 0.96;
    bell.vel[1] = ((bell.pos[1] - prevY) / dt) * 0.96;
    bell.vel[2] = ((bell.pos[2] - prevZ) / dt) * 0.96;
    bell.swingSpeed = Math.hypot(bell.vel[0], bell.vel[1], bell.vel[2]);
  }

  _stepMouseToy(dt) {
    const mouse = this.attachments.mouseToy;
    if (!mouse.active) return;

    mouse.vel[1] -= 9.81 * dt;
    mouse.pos[0] += mouse.vel[0] * dt;
    mouse.pos[1] += mouse.vel[1] * dt;
    mouse.pos[2] += mouse.vel[2] * dt;

    if (mouse.pos[1] < 0.08) {
      mouse.pos[1] = 0.08;
      mouse.vel[1] = Math.max(0.0, -mouse.vel[1] * 0.25);
      mouse.vel[0] *= Math.exp(-dt * 4.5);
      mouse.vel[2] *= Math.exp(-dt * 4.5);
    }

    // Soft porch boundary keep-in
    const r = Math.hypot(mouse.pos[0], mouse.pos[2]);
    if (r > 1.85) {
      mouse.pos[0] *= 1.85 / r;
      mouse.pos[2] *= 1.85 / r;
      mouse.vel[0] *= -0.5;
      mouse.vel[2] *= -0.5;
    }

    if (Math.hypot(mouse.vel[0], mouse.vel[2]) > 0.05) {
      mouse.yaw = Math.atan2(mouse.vel[0], mouse.vel[2]);
    }
    mouse.stringAnchor[0] += (mouse.pos[0] + 0.28 - mouse.stringAnchor[0]) * Math.min(1.0, dt * 4.0);
    mouse.stringAnchor[2] += (mouse.pos[2] + 0.18 - mouse.stringAnchor[2]) * Math.min(1.0, dt * 4.0);
  }

  // --------------------------------------------------------------------------
  // 10. DEFORMATION GRADIENT COFACTOR SKINNING, POLAR RIGID FRAMES & FUR TIPS
  // --------------------------------------------------------------------------

  _updateDeformedSkinAndAttachments(dt, isInit = false) {
    // 10A. Compute per-tet deformation gradient F = Ds * Dm^-1 and its cofactor matrix cof(F)
    for (let t = 0; t < this.tetCount; t++) {
      const i0 = this.tets[t * 4 + 0] * 3;
      const i1 = this.tets[t * 4 + 1] * 3;
      const i2 = this.tets[t * 4 + 2] * 3;
      const i3 = this.tets[t * 4 + 3] * 3;

      const ds00 = this.pos[i1] - this.pos[i0], ds01 = this.pos[i2] - this.pos[i0], ds02 = this.pos[i3] - this.pos[i0];
      const ds10 = this.pos[i1 + 1] - this.pos[i0 + 1], ds11 = this.pos[i2 + 1] - this.pos[i0 + 1], ds12 = this.pos[i3 + 1] - this.pos[i0 + 1];
      const ds20 = this.pos[i1 + 2] - this.pos[i0 + 2], ds21 = this.pos[i2 + 2] - this.pos[i0 + 2], ds22 = this.pos[i3 + 2] - this.pos[i0 + 2];

      const b = t * 9;
      const dm00 = this.tetInvDm[b + 0], dm01 = this.tetInvDm[b + 1], dm02 = this.tetInvDm[b + 2];
      const dm10 = this.tetInvDm[b + 3], dm11 = this.tetInvDm[b + 4], dm12 = this.tetInvDm[b + 5];
      const dm20 = this.tetInvDm[b + 6], dm21 = this.tetInvDm[b + 7], dm22 = this.tetInvDm[b + 8];

      const f00 = ds00 * dm00 + ds01 * dm10 + ds02 * dm20;
      const f01 = ds00 * dm01 + ds01 * dm11 + ds02 * dm21;
      const f02 = ds00 * dm02 + ds01 * dm12 + ds02 * dm22;

      const f10 = ds10 * dm00 + ds11 * dm10 + ds12 * dm20;
      const f11 = ds10 * dm01 + ds11 * dm11 + ds12 * dm21;
      const f12 = ds10 * dm02 + ds11 * dm12 + ds12 * dm22;

      const f20 = ds20 * dm00 + ds21 * dm10 + ds22 * dm20;
      const f21 = ds20 * dm01 + ds21 * dm11 + ds22 * dm21;
      const f22 = ds20 * dm02 + ds21 * dm12 + ds22 * dm22;

      this.tetF[b + 0] = f00; this.tetF[b + 1] = f01; this.tetF[b + 2] = f02;
      this.tetF[b + 3] = f10; this.tetF[b + 4] = f11; this.tetF[b + 5] = f12;
      this.tetF[b + 6] = f20; this.tetF[b + 7] = f21; this.tetF[b + 8] = f22;

      // Cofactor matrix cof(F) for exact normal transformation under non-uniform squash/stretch
      this.tetCofF[b + 0] = f11 * f22 - f12 * f21;
      this.tetCofF[b + 1] = f12 * f20 - f10 * f22;
      this.tetCofF[b + 2] = f10 * f21 - f11 * f20;

      this.tetCofF[b + 3] = f02 * f21 - f01 * f22;
      this.tetCofF[b + 4] = f00 * f22 - f02 * f20;
      this.tetCofF[b + 5] = f01 * f20 - f00 * f21;

      this.tetCofF[b + 6] = f01 * f12 - f02 * f11;
      this.tetCofF[b + 7] = f02 * f10 - f00 * f12;
      this.tetCofF[b + 8] = f00 * f11 - f01 * f10;
    }

    // 10B. Barycentric skin position interpolation + cofactor(F) * restNormal
    const vCount = this.skinMesh.vertexCount;
    const sPos = this.skinMesh.positions;
    const sNorm = this.skinMesh.normals;
    const rNorm = this.skinMesh.restNormals;

    for (let i = 0; i < vCount; i++) {
      const t = this.skinTetIdx[i];
      const t4 = t * 4;
      const i0 = this.tets[t4 + 0] * 3;
      const i1 = this.tets[t4 + 1] * 3;
      const i2 = this.tets[t4 + 2] * 3;
      const i3 = this.tets[t4 + 3] * 3;

      const b4 = i * 4;
      const w0 = this.skinBary[b4 + 0];
      const w1 = this.skinBary[b4 + 1];
      const w2 = this.skinBary[b4 + 2];
      const w3 = this.skinBary[b4 + 3];

      const i3v = i * 3;
      sPos[i3v + 0] = w0 * this.pos[i0] + w1 * this.pos[i1] + w2 * this.pos[i2] + w3 * this.pos[i3];
      sPos[i3v + 1] = Math.max(0.0, w0 * this.pos[i0 + 1] + w1 * this.pos[i1 + 1] + w2 * this.pos[i2 + 1] + w3 * this.pos[i3 + 1]);
      sPos[i3v + 2] = w0 * this.pos[i0 + 2] + w1 * this.pos[i1 + 2] + w2 * this.pos[i2 + 2] + w3 * this.pos[i3 + 2];

      const cBase = t * 9;
      const rnx = rNorm[i3v + 0], rny = rNorm[i3v + 1], rnz = rNorm[i3v + 2];
      const nx = this.tetCofF[cBase + 0] * rnx + this.tetCofF[cBase + 1] * rny + this.tetCofF[cBase + 2] * rnz;
      const ny = this.tetCofF[cBase + 3] * rnx + this.tetCofF[cBase + 4] * rny + this.tetCofF[cBase + 5] * rnz;
      const nz = this.tetCofF[cBase + 6] * rnx + this.tetCofF[cBase + 7] * rny + this.tetCofF[cBase + 8] * rnz;
      const nLen = Math.hypot(nx, ny, nz) || 1.0;
      sNorm[i3v + 0] = nx / nLen;
      sNorm[i3v + 1] = ny / nLen;
      sNorm[i3v + 2] = nz / nLen;
    }

    // 10C. Update whole-body orientation & rigid attachment frames via polar decomposition of averaged F
    const avgF = new Float32Array(9);
    for (let t = 0; t < this.tetCount; t++) {
      const b = t * 9;
      for (let k = 0; k < 9; k++) avgF[k] += this.tetF[b + k];
    }
    const invTetCount = 1.0 / (this.tetCount || 1);
    for (let k = 0; k < 9; k++) avgF[k] *= invTetCount;
    const bodyRotMat = new Float32Array(9);
    PlushPhysicsEngine._extractRotationPolar(avgF, this.bodyOrientation, bodyRotMat, 5);

    const rotOff = [0, 0, 0];
    for (const [name, bind] of Object.entries(this.attachmentBindings)) {
      const att = this.attachments[name];
      avgF.fill(0.0);
      for (let k = 0; k < bind.nearTets.length; k++) {
        const b = bind.nearTets[k] * 9;
        for (let m = 0; m < 9; m++) avgF[m] += this.tetF[b + m];
      }
      const invN = 1.0 / bind.nearTets.length;
      for (let m = 0; m < 9; m++) avgF[m] *= invN;

      PlushPhysicsEngine._extractRotationPolar(avgF, att.quat, att.rotMat3, 5);
      PlushPhysicsEngine._rotateVecByQuat(
        bind.localOffset[0], bind.localOffset[1], bind.localOffset[2],
        att.quat, rotOff
      );

      att.pos[0] = this._evalTetBaryPos(bind.primaryTet, bind.bary, this.pos, 0) + rotOff[0];
      att.pos[1] = this._evalTetBaryPos(bind.primaryTet, bind.bary, this.pos, 1) + rotOff[1];
      att.pos[2] = this._evalTetBaryPos(bind.primaryTet, bind.bary, this.pos, 2) + rotOff[2];
    }
  }

  _updateFurTipSprings(dt) {
    // Per-vertex damped spring driven by skinned surface acceleration so fur lags & swishes
    const updateMeshTips = (mesh) => {
      const vCount = mesh.vertexCount;
      const pos = mesh.positions;
      const prevPos = mesh.prevPositions;
      const prevVel = mesh.prevVel;
      const tipVel = mesh.tipVel;
      const tipOff = mesh.dynTipOffsets;

      const kSpring = 85.0;
      const kDamp = 9.5;
      const inertiaScale = 0.0065;

      for (let i = 0; i < vCount; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        const vx = (pos[i3 + 0] - prevPos[i3 + 0]) / dt;
        const vy = (pos[i3 + 1] - prevPos[i3 + 1]) / dt;
        const vz = (pos[i3 + 2] - prevPos[i3 + 2]) / dt;

        const ax = (vx - prevVel[i3 + 0]) / dt;
        const ay = (vy - prevVel[i3 + 1]) / dt;
        const az = (vz - prevVel[i3 + 2]) / dt;

        prevPos[i3 + 0] = pos[i3 + 0];
        prevPos[i3 + 1] = pos[i3 + 1];
        prevPos[i3 + 2] = pos[i3 + 2];
        prevVel[i3 + 0] = vx;
        prevVel[i3 + 1] = vy;
        prevVel[i3 + 2] = vz;

        let dx = tipOff[i4 + 0];
        let dy = tipOff[i4 + 1];
        let dz = tipOff[i4 + 2];

        let tvx = tipVel[i3 + 0] + (-ax * inertiaScale - kSpring * dx - kDamp * tipVel[i3 + 0]) * dt;
        let tvy = tipVel[i3 + 1] + (-ay * inertiaScale - kSpring * dy - kDamp * tipVel[i3 + 1]) * dt;
        let tvz = tipVel[i3 + 2] + (-az * inertiaScale - kSpring * dz - kDamp * tipVel[i3 + 2]) * dt;

        dx += tvx * dt;
        dy += tvy * dt;
        dz += tvz * dt;

        const maxLag = 0.085;
        const len = Math.hypot(dx, dy, dz);
        if (len > maxLag) {
          const s = maxLag / len;
          dx *= s; dy *= s; dz *= s;
          tvx *= s; tvy *= s; tvz *= s;
        }

        tipOff[i4 + 0] = dx;
        tipOff[i4 + 1] = dy;
        tipOff[i4 + 2] = dz;
        tipVel[i3 + 0] = tvx;
        tipVel[i3 + 1] = tvy;
        tipVel[i3 + 2] = tvz;
      }
    };

    updateMeshTips(this.skinMesh);
    updateMeshTips(this.tailMesh);
  }

  // --------------------------------------------------------------------------
  // 11. INTERACTION TOOLS: SMOOTH FUR, COMB, FINGER POKE, HAND GRAB & ACTIONS
  // --------------------------------------------------------------------------

  smoothFur() {
    const vCount = this.skinMesh.vertexCount;
    const rPos = this.skinMesh.restPositions;
    const rNorm = this.skinMesh.restNormals;
    const comb = this.skinMesh.combAndRegion;

    for (let i = 0; i < vCount; i++) {
      const px = rPos[i * 3 + 0];
      const py = rPos[i * 3 + 1];
      const pz = rPos[i * 3 + 2];
      const nx = rNorm[i * 3 + 0];
      const ny = rNorm[i * 3 + 1];
      const nz = rNorm[i * 3 + 2];

      // Natural anatomical flow: radiating outward-upward on muzzle/face, downward-back on torso
      let fx = px * 0.25;
      let fy = py > 1.25 ? 0.28 : -0.55;
      let fz = py > 1.25 ? -0.35 : -0.45;

      // Project onto tangent plane of rest normal
      const dot = fx * nx + fy * ny + fz * nz;
      fx -= dot * nx;
      fy -= dot * ny;
      fz -= dot * nz;
      const len = Math.hypot(fx, fy, fz) || 1.0;

      comb[i * 4 + 0] = (fx / len) * 0.45;
      comb[i * 4 + 1] = (fy / len) * 0.45;
      comb[i * 4 + 2] = (fz / len) * 0.45;
    }
  }

  applyCombStroke(worldPos, worldDir, radius = 0.28) {
    this.isSleeping = false;
    const vCount = this.skinMesh.vertexCount;
    const sPos = this.skinMesh.positions;
    const rPos = this.skinMesh.restPositions;
    const rNorm = this.skinMesh.restNormals;
    const comb = this.skinMesh.combAndRegion;
    const rSq = radius * radius;
    const invF = new Float32Array(9);

    let backHits = 0;
    for (let i = 0; i < vCount; i++) {
      const i3 = i * 3;
      const dx = sPos[i3 + 0] - worldPos[0];
      const dy = sPos[i3 + 1] - worldPos[1];
      const dz = sPos[i3 + 2] - worldPos[2];
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq > rSq) continue;

      const falloff = Math.pow(1.0 - Math.sqrt(dSq) / radius, 1.5);
      const t = this.skinTetIdx[i];
      const b = t * 9;
      PlushPhysicsEngine._invertMat3(
        this.tetF[b + 0], this.tetF[b + 1], this.tetF[b + 2],
        this.tetF[b + 3], this.tetF[b + 4], this.tetF[b + 5],
        this.tetF[b + 6], this.tetF[b + 7], this.tetF[b + 8],
        invF, 0
      );

      // Transform world stroke vector through F^-1 into rest space
      let rx = invF[0] * worldDir[0] + invF[1] * worldDir[1] + invF[2] * worldDir[2];
      let ry = invF[3] * worldDir[0] + invF[4] * worldDir[1] + invF[5] * worldDir[2];
      let rz = invF[6] * worldDir[0] + invF[7] * worldDir[1] + invF[8] * worldDir[2];

      // Tangent-project onto rest normal
      const nx = rNorm[i3 + 0], ny = rNorm[i3 + 1], nz = rNorm[i3 + 2];
      const dot = rx * nx + ry * ny + rz * nz;
      rx -= dot * nx;
      ry -= dot * ny;
      rz -= dot * nz;
      const len = Math.hypot(rx, ry, rz) || 1.0;
      rx = (rx / len) * 0.72;
      ry = (ry / len) * 0.72;
      rz = (rz / len) * 0.72;

      const blend = falloff * 0.55;
      comb[i * 4 + 0] = comb[i * 4 + 0] * (1.0 - blend) + rx * blend;
      comb[i * 4 + 1] = comb[i * 4 + 1] * (1.0 - blend) + ry * blend;
      comb[i * 4 + 2] = comb[i * 4 + 2] * (1.0 - blend) + rz * blend;

      if (rPos[i3 + 1] > 0.55 && rPos[i3 + 1] < 1.35 && rPos[i3 + 2] < 0.05) {
        backHits++;
      }
    }

    // Combing the back triggers a happy arch & purr!
    if (backHits > 6) {
      this.combBackAccum += 0.16;
      if (this.combBackAccum > 1.0) {
        this.combBackAccum = 0.0;
        this.triggerAction('arch');
      }
    }
  }

  applyFingerPoke(rayOrigin, rayDir, hitPoint, isHoldNearHead = false) {
    this.isSleeping = false;
    let pt = hitPoint;
    if (!pt) {
      const hit = this.raycastSkin(rayOrigin, rayDir);
      if (hit.hit) pt = hit.point;
    }

    if (isHoldNearHead && pt) {
      // Affectionate headbutt lean toward finger + purr
      const headCenter = [this.com[0], this.com[1] + 0.65, this.com[2] + 0.12];
      this.headbuttLean[0] = Math.max(-0.14, Math.min(0.14, (pt[0] - headCenter[0]) * 0.35));
      this.headbuttLean[1] = Math.max(-0.10, Math.min(0.10, (pt[1] - headCenter[1]) * 0.30));
      this.headbuttLean[2] = Math.max(-0.14, Math.min(0.14, (pt[2] - headCenter[2]) * 0.35));
      if (!this.isPurring) {
        this.isPurring = true;
        this.purrCount++;
      }
      return;
    }

    if (!pt) return;

    // Soft capsule dent & lever-arm impulse around COM
    const pokeRadius = 0.32;
    const impulseStrength = 1.65;
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      const dx = this.pos[i3 + 0] - pt[0];
      const dy = this.pos[i3 + 1] - pt[1];
      const dz = this.pos[i3 + 2] - pt[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < pokeRadius) {
        const w = Math.pow(1.0 - d / pokeRadius, 1.6);
        this.vel[i3 + 0] += rayDir[0] * impulseStrength * w;
        this.vel[i3 + 1] += rayDir[1] * impulseStrength * w;
        this.vel[i3 + 2] += rayDir[2] * impulseStrength * w;
        this.pos[i3 + 0] += rayDir[0] * 0.045 * w;
        this.pos[i3 + 1] = Math.max(0.02, this.pos[i3 + 1] + rayDir[1] * 0.045 * w);
        this.pos[i3 + 2] += rayDir[2] * 0.045 * w;
      }
    }
  }

  startGrab(rayOrigin, rayDir) {
    this.isSleeping = false;

    // 1. Check brass bell first
    const bell = this.attachments.bell;
    const bellDist = PlushPhysicsEngine._raySphereIntersect(rayOrigin, rayDir, bell.pos, bell.radius * 1.45);
    if (bellDist > 0 && bellDist < 20.0) {
      const wp = [
        rayOrigin[0] + rayDir[0] * bellDist,
        rayOrigin[1] + rayDir[1] * bellDist,
        rayOrigin[2] + rayDir[2] * bellDist
      ];
      this.grabState.active = true;
      this.grabState.type = 'bell';
      this.grabState.targetPos = [...wp];
      return { hit: true, type: 'bell', distance: bellDist, worldPoint: wp };
    }

    // 2. Check cloth ears
    let bestEarIdx = -1, bestEarDist = Infinity;
    for (let i = 0; i < this.earMesh.vertexCount; i++) {
      const ep = [this.earPos[i * 3], this.earPos[i * 3 + 1], this.earPos[i * 3 + 2]];
      const d = PlushPhysicsEngine._raySphereIntersect(rayOrigin, rayDir, ep, 0.09);
      if (d > 0 && d < bestEarDist) {
        bestEarDist = d;
        bestEarIdx = i;
      }
    }
    if (bestEarIdx >= 0) {
      const wp = [
        rayOrigin[0] + rayDir[0] * bestEarDist,
        rayOrigin[1] + rayDir[1] * bestEarDist,
        rayOrigin[2] + rayDir[2] * bestEarDist
      ];
      this.grabState.active = true;
      this.grabState.type = 'ear';
      this.grabState.earIndex = bestEarIdx;
      this.grabState.targetPos = [...wp];
      return { hit: true, type: 'ear', distance: bestEarDist, worldPoint: wp };
    }

    // 3. Check soft rope tail
    let bestTailIdx = -1, bestTailDist = Infinity;
    for (let i = 2; i < this.tailParticleCount; i++) {
      const tp = [this.tailPos[i * 3], this.tailPos[i * 3 + 1], this.tailPos[i * 3 + 2]];
      const d = PlushPhysicsEngine._raySphereIntersect(rayOrigin, rayDir, tp, this.tailRadii[i] * 1.5);
      if (d > 0 && d < bestTailDist) {
        bestTailDist = d;
        bestTailIdx = i;
      }
    }
    if (bestTailIdx >= 0) {
      const wp = [
        rayOrigin[0] + rayDir[0] * bestTailDist,
        rayOrigin[1] + rayDir[1] * bestTailDist,
        rayOrigin[2] + rayDir[2] * bestTailDist
      ];
      this.grabState.active = true;
      this.grabState.type = 'tail';
      this.grabState.tailIndex = bestTailIdx;
      this.grabState.targetPos = [...wp];
      return { hit: true, type: 'tail', distance: bestTailDist, worldPoint: wp };
    }

    // 4. Check body skin mesh
    const skinHit = this.raycastSkin(rayOrigin, rayDir);
    if (skinHit.hit) {
      const wp = skinHit.point;
      // Check if grabbed near scruff [0, 1.25..1.65, -0.35..-0.10] relative to COM
      const relX = wp[0] - this.com[0];
      const relY = wp[1] - (this.com[1] - this.restCom[1]);
      const relZ = wp[2] - this.com[2];
      const isScruff = Math.abs(relX) < 0.34 && relY >= 1.15 && relY <= 1.75 && relZ <= 0.08;

      this.isScruffGrabbed = isScruff;
      this.grabState.active = true;
      this.grabState.type = isScruff ? 'scruff' : 'body';
      this.grabState.targetPos = [...wp];
      this.grabState.weights = new Float32Array(this.particleCount);
      this.grabState.nodeOffsets = new Float32Array(this.particleCount * 3);

      const grabRadius = isScruff ? 0.46 : 0.42;
      for (let i = 0; i < this.particleCount; i++) {
        const i3 = i * 3;
        const dx = this.pos[i3 + 0] - wp[0];
        const dy = this.pos[i3 + 1] - wp[1];
        const dz = this.pos[i3 + 2] - wp[2];
        const d = Math.hypot(dx, dy, dz);
        if (d < grabRadius) {
          this.grabState.weights[i] = Math.pow(1.0 - d / grabRadius, 1.4);
          this.grabState.nodeOffsets[i3 + 0] = dx;
          this.grabState.nodeOffsets[i3 + 1] = dy;
          this.grabState.nodeOffsets[i3 + 2] = dz;
        }
      }

      return { hit: true, type: this.grabState.type, distance: skinHit.distance, worldPoint: wp };
    }

    return { hit: false, type: null, distance: Infinity, worldPoint: null };
  }

  moveGrab(worldTargetPoint) {
    if (!this.grabState.active || !worldTargetPoint) return;
    this.isSleeping = false;
    this.grabState.targetPos[0] = worldTargetPoint[0];
    this.grabState.targetPos[1] = Math.max(0.02, worldTargetPoint[1]);
    this.grabState.targetPos[2] = worldTargetPoint[2];
  }

  endGrab() {
    if (this.grabState.active && this.isScruffGrabbed && this.com[1] > 1.05) {
      // Emit tuft puff shortly upon landing from scruff drop
      this.pendingParticles.push({
        type: 'tuft',
        position: [this.com[0], 0.14, this.com[2]],
        count: 6
      });
    }
    this.grabState.active = false;
    this.grabState.type = null;
    this.isScruffGrabbed = false;
  }

  raycastSkin(rayOrigin, rayDir) {
    const pos = this.skinMesh.positions;
    const norm = this.skinMesh.normals;
    const ind = this.skinMesh.indices;
    let bestT = Infinity;
    let bestTri = -1;

    for (let i = 0; i < ind.length; i += 3) {
      const a = ind[i] * 3, b = ind[i + 1] * 3, c = ind[i + 2] * 3;
      const t = PlushPhysicsEngine._rayTriangleIntersect(
        rayOrigin, rayDir,
        pos[a], pos[a + 1], pos[a + 2],
        pos[b], pos[b + 1], pos[b + 2],
        pos[c], pos[c + 1], pos[c + 2]
      );
      if (t > 0.01 && t < bestT) {
        bestT = t;
        bestTri = i;
      }
    }

    if (bestTri >= 0) {
      const a = ind[bestTri] * 3;
      const wp = [
        rayOrigin[0] + rayDir[0] * bestT,
        rayOrigin[1] + rayDir[1] * bestT,
        rayOrigin[2] + rayDir[2] * bestT
      ];
      return {
        hit: true,
        distance: bestT,
        point: wp,
        normal: [norm[a], norm[a + 1], norm[a + 2]]
      };
    }
    return { hit: false, distance: Infinity, point: null, normal: null };
  }

  setStuffing(val0to100) {
    this.stuffingValue = Math.max(0, Math.min(100, Number(val0to100)));
    this.isSleeping = false;
  }

  setMood(val0to100) {
    this.moodValue = Math.max(0, Math.min(100, Number(val0to100)));
    this.isSleeping = false;
  }

  trotToPoint(x, z) {
    this.isSleeping = false;
    this.isNapping = false;
    this.trotTarget = {
      x: Math.max(-1.6, Math.min(1.6, x)),
      z: Math.max(-1.2, Math.min(1.4, z))
    };
  }

  triggerAction(actionName, options = {}) {
    this.isSleeping = false;
    this.actionTime = 0.0;

    if (actionName === 'trotToPoint' && options) {
      this.trotToPoint(options.x ?? 0, options.z ?? 0);
      return;
    }

    const resolveToggle = (curr) => {
      if (options.force !== undefined) return Boolean(options.force);
      if (options.forceState !== undefined) return Boolean(options.forceState);
      if (options.active !== undefined) return Boolean(options.active);
      return !curr;
    };

    switch (actionName) {
      case 'prowl':
        this.isProwling = resolveToggle(this.isProwling);
        if (this.isProwling) {
          this.isNapping = false;
          this.isPurring = false;
          this.activeAction = 'prowl';
          this.actionPhase = 't0_anticipation';
          this._prowlSparkleA = false;
          this._prowlSparkleB = false;
        } else {
          if (this.activeAction === 'prowl') this.activeAction = null;
          this.actionPhase = 'idle';
        }
        break;

      case 'pounce':
        this.isProwling = false;
        this.isNapping = false;
        this.activeAction = 'pounce';
        this.actionPhase = 't0_anticipation';
        this._pounceLaunched = false;
        this._pounceLanded = false;
        this.pounceCount++;
        break;

      case 'arch':
        this.isNapping = false;
        this.isArching = true;
        this.activeAction = 'arch';
        this.actionPhase = 't0_anticipation';
        break;

      case 'purr':
        this.isPurring = resolveToggle(this.isPurring);
        if (this.isPurring) {
          this.isNapping = false;
          this.isProwling = false;
          this.activeAction = 'purr';
          this._purrPeakEmitted = false;
          this.purrCount++;
          this.actionPhase = 't0_anticipation';
          this.pendingParticles.push({
            type: 'heart',
            position: [this.com[0], this.com[1] + 0.9, this.com[2] + 0.2],
            count: 3
          });
        } else {
          if (this.activeAction === 'purr') this.activeAction = null;
          this.actionPhase = 'idle';
        }
        break;

      case 'groom':
        this.isProwling = false;
        this.isNapping = false;
        this.activeAction = 'groom';
        this.actionPhase = 't0_anticipation';
        this._groomSparkled = false;
        break;

      case 'chase':
        this.isProwling = false;
        this.isNapping = false;
        this.activeAction = 'chase';
        this.actionPhase = 't0_anticipation';
        this._chaseLunged = false;
        this._chaseBatted = false;
        this.attachments.mouseToy.active = true;
        this.attachments.mouseToy.pos = [this.com[0] + 0.36, 0.08, this.com[2] + 0.62];
        this.attachments.mouseToy.vel = [0, 0, 0];
        break;

      case 'nap':
        this.isNapping = resolveToggle(this.isNapping);
        if (this.isNapping) {
          this.isProwling = false;
          this.isPurring = false;
          this.actionPhase = 't1_drive';
          this.pendingParticles.push({
            type: 'z',
            position: [this.com[0] + 0.15, this.com[1] + 0.85, this.com[2] + 0.25],
            count: 2
          });
        } else {
          this.actionPhase = 'idle';
        }
        break;

      case 'topple':
        this.isProwling = false;
        this.isNapping = false;
        this.activeAction = 'topple';
        this.actionPhase = 't0_anticipation';
        this._toppleImpulsed = false;
        this._toppleSnoozed = false;
        this.toppleDirIndex = (this.toppleDirIndex + 1) % 3;
        break;
    }
  }

  setMechanicPhase(mechanicId, phaseOrTime) {
    // Deterministic phase hook for window.__TRIGGER_MECHANIC__ verification
    const map = {
      move_pounce: 'pounce',
      pounce: 'pounce',
      move_arch_hiss: 'arch',
      arch: 'arch',
      move_prowl: 'prowl',
      prowl: 'prowl',
      move_purr_loaf: 'purr',
      purr: 'purr',
      move_groom: 'groom',
      groom: 'groom',
      move_chase_mouse: 'chase',
      chase: 'chase',
      move_nap_topple: 'topple',
      topple: 'topple',
      nap: 'nap',
      move_scruff_drop: 'scruff'
    };
    const act = map[mechanicId] || mechanicId;
    this.reset();

    if (act === 'scruff') {
      const phaseTimes = { t0_anticipation: 0.12, t1_drive: 0.35, t2_apex: 0.52, t3_settle: 0.85 };
      const targetT = typeof phaseOrTime === 'number' ? phaseOrTime : (phaseTimes[phaseOrTime] ?? 0.35);
      this.startGrab([0, 1.45, -1.5], [0, 0, 1]);
      const steps = Math.max(1, Math.round(targetT * 60));
      for (let i = 0; i < steps; i++) {
        const t = i / 60;
        if (t < 0.42) {
          this.moveGrab([0, 1.45 + Math.min(0.85, t * 2.2), -0.15]);
        } else if (this.grabState.active) {
          this.endGrab();
        }
        this.step(1 / 60);
      }
      this.actionPhase = typeof phaseOrTime === 'string' ? phaseOrTime : this.actionPhase;
      return;
    }

    this.triggerAction(act, { force: true });
    const phaseOffsets = {
      t0_anticipation: 0.15,
      t1_drive: 0.48,
      t2_apex: 0.78,
      t3_settle: 1.15
    };
    const targetSec = typeof phaseOrTime === 'number' ? phaseOrTime : (phaseOffsets[phaseOrTime] ?? 0.45);
    const steps = Math.max(1, Math.round(targetSec * 60));
    for (let i = 0; i < steps; i++) {
      this.step(1 / 60);
    }
  }

  getTelemetry() {
    return {
      com: [...this.com],
      bodyOrientation: [...this.bodyOrientation],
      volumeRatio: this.volumeRatio,
      activeAction: this.activeAction,
      actionPhase: this.actionPhase,
      actionTime: this.actionTime,
      isProwling: this.isProwling,
      isArching: this.isArching,
      isPurring: this.isPurring,
      isNapping: this.isNapping,
      isScruffGrabbed: this.isScruffGrabbed,
      furPuffScale: this.furPuffScale,
      bellPos: [...this.attachments.bell.pos],
      mouseToy: { ...this.attachments.mouseToy, pos: [...this.attachments.mouseToy.pos] }
    };
  }

  _checkNaNAndRecover() {
    for (let i = 0; i < this.pos.length; i++) {
      if (!Number.isFinite(this.pos[i]) || !Number.isFinite(this.vel[i])) {
        this.reset();
        return;
      }
    }
    for (let i = 0; i < this.earPos.length; i++) {
      if (!Number.isFinite(this.earPos[i])) {
        this.reset();
        return;
      }
    }
    for (let i = 0; i < this.tailPos.length; i++) {
      if (!Number.isFinite(this.tailPos[i])) {
        this.reset();
        return;
      }
    }
  }

  reset() {
    this.pos.set(this.restPos);
    this.animRestPos.set(this.restPos);
    this.prevPos.set(this.restPos);
    this.vel.fill(0.0);

    this.com = [...this.restCom];
    this.animCom = [...this.restCom];
    this.bodyOrientation = [0.0, 0.0, 0.0, 1.0];
    this.goalRotation = [0.0, 0.0, 0.0, 1.0];
    this.currentYaw = 0.0;
    this.volumeRatio = 1.0;
    this.spineArchAmount = 0.0;
    this.furPuffScale = 1.0;
    this.scruffImpactTimer = 0.0;
    this.pendingParticles.length = 0;

    for (let c = 0; c < this.cellCount; c++) {
      this.cells[c].quat = [0.0, 0.0, 0.0, 1.0];
      this.cells[c].dynOffsets.set(this.cells[c].restOffsets);
    }

    this.earPos.set(this.earLocalRest);
    this.earPrevPos.set(this.earLocalRest);
    this.earVel.fill(0.0);

    this.tailPos.set(this.tailLocalRest);
    this.tailPrevPos.set(this.tailLocalRest);
    this.tailVel.fill(0.0);

    this.attachments.bell.pos = [0.0, 0.85, 0.52];
    this.attachments.bell.vel = [0.0, 0.0, 0.0];
    this.attachments.mouseToy.active = false;
    this.attachments.mouseToy.pos = [0.36, 0.08, 0.62];
    this.attachments.mouseToy.vel = [0.0, 0.0, 0.0];

    this.isProwling = false;
    this.isArching = false;
    this.isPurring = false;
    this.isNapping = false;
    this.isScruffGrabbed = false;
    this.isSleeping = false;
    this.activeAction = null;
    this.actionPhase = 'idle';
    this.actionTime = 0.0;
    this.trotTarget = null;
    this.grabState.active = false;

    this.skinMesh.dynTipOffsets.fill(0.0);
    for (let i = 0; i < this.skinMesh.vertexCount; i++) {
      const reg = this.evalAnatomicalRegion(
        this.skinMesh.restPositions[i * 3],
        this.skinMesh.restPositions[i * 3 + 1],
        this.skinMesh.restPositions[i * 3 + 2]
      );
      this.skinMesh.dynTipOffsets[i * 4 + 3] = reg.seamWeight;
    }
    this.skinMesh.tipVel.fill(0.0);
    this.tailMesh.dynTipOffsets.fill(0.0);
    this.tailMesh.tipVel.fill(0.0);

    this._updateDeformedSkinAndAttachments(1 / 60, true);
    this._updateTailTubeMesh(1 / 60, true);
    this._updateEarNormals();
  }

  // --------------------------------------------------------------------------
  // 12. LINEAR ALGEBRA, POLAR DECOMPOSITION & RAYCAST HELPERS
  // --------------------------------------------------------------------------

  static _detMat3(m) {
    return (
      m[0] * (m[4] * m[8] - m[5] * m[7]) -
      m[1] * (m[3] * m[8] - m[5] * m[6]) +
      m[2] * (m[3] * m[7] - m[4] * m[6])
    );
  }

  static _invertMat3(m00, m01, m02, m10, m11, m12, m20, m21, m22, out, offset = 0) {
    const c00 = m11 * m22 - m12 * m21;
    const c01 = m02 * m21 - m01 * m22;
    const c02 = m01 * m12 - m02 * m11;

    const c10 = m12 * m20 - m10 * m22;
    const c11 = m00 * m22 - m02 * m20;
    const c12 = m02 * m10 - m00 * m12;

    const c20 = m10 * m21 - m11 * m20;
    const c21 = m01 * m20 - m00 * m21;
    const c22 = m00 * m11 - m01 * m10;

    const det = m00 * c00 + m10 * c01 + m20 * c02;
    const invDet = Math.abs(det) > 1e-10 ? 1.0 / det : 0.0;

    out[offset + 0] = c00 * invDet;
    out[offset + 1] = c01 * invDet;
    out[offset + 2] = c02 * invDet;
    out[offset + 3] = c10 * invDet;
    out[offset + 4] = c11 * invDet;
    out[offset + 5] = c12 * invDet;
    out[offset + 6] = c20 * invDet;
    out[offset + 7] = c21 * invDet;
    out[offset + 8] = c22 * invDet;
  }

  static _quatToMat3(q, out) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    out[0] = 1.0 - (yy + zz);
    out[1] = xy - wz;
    out[2] = xz + wy;
    out[3] = xy + wz;
    out[4] = 1.0 - (xx + zz);
    out[5] = yz - wx;
    out[6] = xz - wy;
    out[7] = yz + wx;
    out[8] = 1.0 - (xx + yy);
  }

  static _extractRotationPolar(A, q, outR, maxIter = 4) {
    // Warm-started quaternion polar rotation extraction (Muller et al. 2016)
    for (let iter = 0; iter < maxIter; iter++) {
      PlushPhysicsEngine._quatToMat3(q, outR);
      // Cross product of columns of R and A
      const r0x = outR[0], r0y = outR[3], r0z = outR[6];
      const r1x = outR[1], r1y = outR[4], r1z = outR[7];
      const r2x = outR[2], r2y = outR[5], r2z = outR[8];

      const a0x = A[0], a0y = A[3], a0z = A[6];
      const a1x = A[1], a1y = A[4], a1z = A[7];
      const a2x = A[2], a2y = A[5], a2z = A[8];

      const wx = (r0y * a0z - r0z * a0y) + (r1y * a1z - r1z * a1y) + (r2y * a2z - r2z * a2y);
      const wy = (r0z * a0x - r0x * a0z) + (r1z * a1x - r1x * a1z) + (r2z * a2x - r2x * a2z);
      const wz = (r0x * a0y - r0y * a0x) + (r1x * a1y - r1y * a1x) + (r2x * a2y - r2y * a2x);

      const dot =
        (r0x * a0x + r0y * a0y + r0z * a0z) +
        (r1x * a1x + r1y * a1y + r1z * a1z) +
        (r2x * a2x + r2y * a2y + r2z * a2z);

      const denom = Math.abs(dot) + 1e-5;
      const ox = wx / denom, oy = wy / denom, oz = wz / denom;
      const wLen = Math.hypot(ox, oy, oz);
      if (wLen < 1e-6) break;

      const half = 0.5 * wLen;
      const s = Math.sin(half) / wLen;
      const dqX = ox * s, dqY = oy * s, dqZ = oz * s, dqW = Math.cos(half);

      const nqx = dqW * q[0] + dqX * q[3] + dqY * q[2] - dqZ * q[1];
      const nqy = dqW * q[1] - dqX * q[2] + dqY * q[3] + dqZ * q[0];
      const nqz = dqW * q[2] + dqX * q[1] - dqY * q[0] + dqZ * q[3];
      const nqw = dqW * q[3] - dqX * q[0] - dqY * q[1] - dqZ * q[2];
      const qLen = Math.hypot(nqx, nqy, nqz, nqw) || 1.0;
      q[0] = nqx / qLen;
      q[1] = nqy / qLen;
      q[2] = nqz / qLen;
      q[3] = nqw / qLen;
    }
    PlushPhysicsEngine._quatToMat3(q, outR);
  }

  static _rotateVecByQuat(vx, vy, vz, q, out) {
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const tx = 2.0 * (qy * vz - qz * vy);
    const ty = 2.0 * (qz * vx - qx * vz);
    const tz = 2.0 * (qx * vy - qy * vx);
    out[0] = vx + qw * tx + (qy * tz - qz * ty);
    out[1] = vy + qw * ty + (qz * tx - qx * tz);
    out[2] = vz + qw * tz + (qx * ty - qy * tx);
  }

  static _eulerToQuat(pitchX, yawY, rollZ, out) {
    const cx = Math.cos(pitchX * 0.5), sx = Math.sin(pitchX * 0.5);
    const cy = Math.cos(yawY * 0.5), sy = Math.sin(yawY * 0.5);
    const cz = Math.cos(rollZ * 0.5), sz = Math.sin(rollZ * 0.5);

    out[0] = sx * cy * cz + cx * sy * sz;
    out[1] = cx * sy * cz - sx * cy * sz;
    out[2] = cx * cy * sz + sx * sy * cz;
    out[3] = cx * cy * cz - sx * sy * sz;
  }

  static _raySphereIntersect(ro, rd, center, radius) {
    const ocx = ro[0] - center[0];
    const ocy = ro[1] - center[1];
    const ocz = ro[2] - center[2];
    const b = ocx * rd[0] + ocy * rd[1] + ocz * rd[2];
    const c = ocx * ocx + ocy * ocy + ocz * ocz - radius * radius;
    const disc = b * b - c;
    if (disc < 0.0) return -1.0;
    const t = -b - Math.sqrt(disc);
    return t > 0.0 ? t : -1.0;
  }

  static _rayTriangleIntersect(ro, rd, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const hx = rd[1] * e2z - rd[2] * e2y;
    const hy = rd[2] * e2x - rd[0] * e2z;
    const hz = rd[0] * e2y - rd[1] * e2x;
    const a = e1x * hx + e1y * hy + e1z * hz;
    if (Math.abs(a) < 1e-7) return -1.0;
    const f = 1.0 / a;
    const sx = ro[0] - ax, sy = ro[1] - ay, sz = ro[2] - az;
    const u = f * (sx * hx + sy * hy + sz * hz);
    if (u < 0.0 || u > 1.0) return -1.0;
    const qx = sy * e1z - sz * e1y;
    const qy = sz * e1x - sx * e1z;
    const qz = sx * e1y - sy * e1x;
    const v = f * (rd[0] * qx + rd[1] * qy + rd[2] * qz);
    if (v < 0.0 || u + v > 1.0) return -1.0;
    const t = f * (e2x * qx + e2y * qy + e2z * qz);
    return t > 0.001 ? t : -1.0;
  }
}