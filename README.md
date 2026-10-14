# Midnight — Plush Black Cat · Material Study No. 013

**Live Interactive Demo:** [https://oik01.github.io/midnight-plush-cat/](https://oik01.github.io/midnight-plush-cat/)

An interactive, physically simulated 24 cm plush black cat sitting on a witch's front porch on Halloween night:
- **Native WebGPU + WGSL Plush Renderer (`#plush-canvas`)**: 1536×1536 PCSS-lite shadow map, 256×256 top-down contact AO height map, 4× MSAA HDR `rgba16float` pass with 18–30 instanced Kajiya-Kay fur shells, manual 4-sample `@builtin(sample_mask)` coverage, polar-decomposed glass bead eyes with dual camera-space catchlights, sewn felt ears, and Khronos PBR Neutral tone mapping.
- **CPU XPBD Soft-Body Physics (60 Hz × 6 Substeps)**: Surface Nets SDF mesh extraction (`2,538` vertices) embedded barycentrically in `544` hexahedral cells (`2,720` volume-conserving tetrahedra, `561` particles), sewn particle-cloth ears, 16-particle soft rope tail, brass collar bell pendulum, and rigid-body felt mouse on a string.
- **Three.js r169 Witch's Front Porch (`#bg-canvas`)**: Synchronized off-centre frustum with weathered planks, straw doormat, jack-o'-lantern, bubbling green cauldron, spell books, cottage window, swaying lanterns, candle strings, harvest moon, witch flyby, and `UnrealBloomPass`.
