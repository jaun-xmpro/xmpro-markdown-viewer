/*
 * Tiny static file server for the harness.
 *
 * Serves:
 *   /                       -> harness/index.html
 *   /examples/*.md          -> harness/examples/...
 *   /harness.css, .js       -> harness/...
 *   /../metablock/*         -> metablock/... (relative path from index.html)
 *
 * Uses only Node built-ins so `npm install` only adds nodemon for development.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const HARNESS = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md':   'text/markdown; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
    '.txt':  'text/plain; charset=utf-8',
    '.zip':  'application/zip'
};

function safeJoin(base, target) {
    const resolved = path.resolve(base, '.' + target);
    // Require a path-separator boundary so e.g. ROOT="/x/foo" doesn't permit "/x/foo_other".
    const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
    if (resolved !== ROOT && !resolved.startsWith(rootWithSep)) return null;
    return resolved;
}

function serveFile(res, filepath) {
    fs.stat(filepath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(`404 Not Found: ${path.relative(ROOT, filepath)}`);
            return;
        }
        const ext = path.extname(filepath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(filepath).pipe(res);
    });
}

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url);
    let pathname = decodeURIComponent(parsed.pathname || '/');

    if (pathname === '/' || pathname === '') {
        return serveFile(res, path.join(HARNESS, 'index.html'));
    }

    // Anything starting with /examples or /metablock resolves relative to project root
    if (pathname.startsWith('/examples/')) {
        const filepath = safeJoin(HARNESS, pathname);
        if (!filepath) { res.statusCode = 403; res.end('403'); return; }
        return serveFile(res, filepath);
    }

    if (pathname.startsWith('/metablock/') || pathname.startsWith('/../metablock/') ||
        pathname.startsWith('/dist/') || pathname.startsWith('/../dist/') ||
        pathname === '/README.md' || pathname === '/../README.md') {
        const cleaned = pathname.replace(/^\/\.\.\//, '/');
        const filepath = safeJoin(ROOT, cleaned);
        if (!filepath) { res.statusCode = 403; res.end('403'); return; }
        return serveFile(res, filepath);
    }

    // Anything else relative to the harness dir
    const filepath = safeJoin(HARNESS, pathname);
    if (!filepath) { res.statusCode = 403; res.end('403'); return; }
    return serveFile(res, filepath);
});

server.listen(PORT, () => {
    console.log('');
    console.log('  XMPro Markdown Viewer — harness');
    console.log('  ──────────────────────────────────────');
    console.log(`  Listening on  http://localhost:${PORT}`);
    console.log(`  Project root  ${ROOT}`);
    console.log('  Press Ctrl+C to stop.');
    console.log('');
});
