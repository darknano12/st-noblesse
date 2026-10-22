import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const PORT = 3000;
const ROOT = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.ts': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function transformTypeScript(code, filePath) {
  let js = stripTypeScriptTypes(code);

  // 1. Remove CSS imports (styles are loaded in index.html)
  js = js.replace(/import\s+['"][^'"]+\.css['"]\s*;?/g, '// [css import stripped]');

  // 2. Resolve relative imports: add .ts or route .json
  const dir = path.dirname(filePath);
  js = js.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, importPath) => {
    // If it points to .json, append ?esm
    if (importPath.endsWith('.json')) {
      return `from '${importPath}?esm'`;
    }
    // If it already has an extension, leave it
    if (path.extname(importPath)) {
      return match;
    }
    // Check if .ts exists
    const candidateTs = path.join(dir, importPath + '.ts');
    if (fs.existsSync(candidateTs)) {
      return `from '${importPath}.ts'`;
    }
    // Check if /index.ts exists
    const candidateIndex = path.join(dir, importPath, 'index.ts');
    if (fs.existsSync(candidateIndex)) {
      return `from '${importPath}/index.ts'`;
    }
    return match;
  });

  return js;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  // API to sync updated products directly to src/data/products.json
  if (pathname === '/api/sync-products' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (Array.isArray(parsed)) {
          const targetPath = path.join(ROOT, 'src', 'data', 'products.json');
          fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2), 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, count: parsed.length }));
        }
      } catch (err) {
        console.error('Failed to sync products:', err);
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid product data' }));
    });
    return;
  }

  const filePath = path.join(ROOT, pathname);

  // Handle JSON imported as ES Module (?esm)
  if (parsedUrl.searchParams.has('esm') && pathname.endsWith('.json')) {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    const jsonContent = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    return res.end(`export default ${jsonContent};`);
  }

  // Check if file exists
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    return res.end('Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();

  // If TypeScript, transpile on the fly
  if (ext === '.ts') {
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      const compiled = transformTypeScript(source, filePath);
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      return res.end(compiled);
    } catch (err) {
      console.error(`Error compiling ${pathname}:`, err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end(err.message);
    }
  }

  // Static file delivery
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n✦ st.noblesse boutique server running at: http://localhost:${PORT}/`);
  console.log(`✦ Mode: Native Vanilla TypeScript (zero dependencies, Node 24 native type stripping)\n`);
});
