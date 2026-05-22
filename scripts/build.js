#!/usr/bin/env node
/*
 * Build the distribution artifacts: a single-file HTML bundle and a
 * minified variant. The source ZIP is produced separately (see
 * scripts/build-source-zip.ps1 or the npm script).
 *
 * Outputs to dist/:
 *   xmpro-markdown-viewer.html      — single-file bundle (CDN libs + inlined CSS/JS)
 *   xmpro-markdown-viewer.min.html  — minified version (best-effort, requires npx)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'metablock');
const DIST = path.join(ROOT, 'dist');

fs.mkdirSync(DIST, { recursive: true });

const html = fs.readFileSync(path.join(SRC, 'main.html'), 'utf8');
const css = fs.readFileSync(path.join(SRC, 'main.css'), 'utf8');
const js = fs.readFileSync(path.join(SRC, 'main.js'), 'utf8');

const sampleContent = `# Welcome to the XMPro Markdown Viewer

This is the **single-file bundle**. Everything you need is in this one HTML.

## How to use

Replace the content shown here by either:

- Adding URL query parameters: \`?content=...\` or \`?url=https://your-doc.md\`
- Editing this file and calling \`window.onValueMappingLoaded({...})\`
- Posting a message: \`{source: 'xmpro-metablock', type: 'markdown:set-content', data: {content: '# ...'}}\`

## What's included

- 5 themes (auto, light, dark, xmpro-light, xmpro-dark) + 11 backgrounds
- Math (KaTeX, lazy) and diagrams (Mermaid, lazy)
- Syntax-highlighted code with copy buttons
- Auto table of contents with scroll-spy
- In-document search, image lightbox, reading-progress bar
- Text-to-speech via Web Speech API
- Printable layout
- GitHub-flavoured markdown including footnotes and callouts

See [the repo](https://github.com/jaun-xmpro/xmpro-markdown-viewer) for the full configuration reference.
`;

const bundle = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>XMPro Markdown Viewer</title>
</head>
<body>
${html}
<style id="bundle-main-css">
${css}
</style>
<script id="bundle-main-js">
${js}
</script>
<script id="bundle-init">
(function () {
    var params = new URLSearchParams(window.location.search);
    if (params.has('content') || params.has('url')) return;
    setTimeout(function () {
        if (typeof window.onValueMappingLoaded === 'function') {
            window.onValueMappingLoaded({
                content: ${JSON.stringify(sampleContent)},
                enable_toc: true,
                enable_anchors: true
            });
        }
    }, 50);
})();
</script>
</body>
</html>`;

const bundlePath = path.join(DIST, 'xmpro-markdown-viewer.html');
fs.writeFileSync(bundlePath, bundle);
const bundleKb = (bundle.length / 1024).toFixed(1);
console.log(`  wrote dist/xmpro-markdown-viewer.html  (${bundleKb} KB)`);

const minPath = path.join(DIST, 'xmpro-markdown-viewer.min.html');
try {
    execSync(
        `npx -y html-minifier-terser ` +
        `--collapse-whitespace --remove-comments ` +
        `--minify-css true --minify-js true ` +
        `--remove-script-type-attributes --remove-style-link-type-attributes ` +
        `-o "${minPath}" "${bundlePath}"`,
        { stdio: ['ignore', 'inherit', 'inherit'], cwd: ROOT, timeout: 120000 }
    );
    const minKb = (fs.statSync(minPath).size / 1024).toFixed(1);
    const saved = (((bundle.length - fs.statSync(minPath).size) / bundle.length) * 100).toFixed(0);
    console.log(`  wrote dist/xmpro-markdown-viewer.min.html  (${minKb} KB, ${saved}% smaller)`);
} catch (e) {
    console.warn('\n  Minification skipped — npx html-minifier-terser failed.');
    console.warn('  ', e.message.split('\n')[0]);
    console.warn('  The unminified bundle is still usable.\n');
}

console.log('\n  Done.');
