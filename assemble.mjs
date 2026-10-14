import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/omarkreidieh/.gemini/antigravity/scratch/midnight-plush-cat';
const partsDir = path.join(root, 'parts');

const shellHtml = fs.readFileSync(path.join(partsDir, '01_ui_shell_and_css.html'), 'utf8');

function readAndStripImports(fileName) {
  const raw = fs.readFileSync(path.join(partsDir, fileName), 'utf8');
  const imports = [];
  const body = raw.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, (m) => {
    imports.push(m.trim());
    return '';
  });
  return { imports, body };
}

const p2 = readAndStripImports('02_sdf_mesh_and_xpbd_physics.js');
const p3 = readAndStripImports('03_webgpu_renderer_and_wgsl.js');
const p4 = readAndStripImports('04_threejs_witch_porch.js');
const p5 = readAndStripImports('05_interaction_controller_and_main.js');

const allImports = [...new Set([...p2.imports, ...p3.imports, ...p4.imports, ...p5.imports])].join('\n');

const bundle = `${allImports}

// ─── 02_sdf_mesh_and_xpbd_physics.js ───
const PlushPhysicsEngine = (() => {
${p2.body}
return PlushPhysicsEngine;
})();

// ─── 03_webgpu_renderer_and_wgsl.js ───
const PlushWebGPURenderer = (() => {
${p3.body}
return PlushWebGPURenderer;
})();

// ─── 04_threejs_witch_porch.js ───
const WitchPorchScene = (() => {
${p4.body}
return WitchPorchScene;
})();

// ─── 05_interaction_controller_and_main.js ───
(() => {
${p5.body}
})();
`;

const finalHtml = shellHtml.replace('/* __MIDNIGHT_JS_BUNDLE__ */', () => bundle);
const outPath = path.join(root, 'index.html');
fs.writeFileSync(outPath, finalHtml, 'utf8');
console.log(`Assembled index.html (${finalHtml.length} bytes, ${finalHtml.split('\n').length} lines)`);
