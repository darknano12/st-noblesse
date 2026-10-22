import http from 'node:http';
import { spawn } from 'node:child_process';

const URLS = [
  '/',
  '/agb.html',
  '/datenschutz.html',
  '/impressum.html',
  '/sitemap.html',
  '/sitemap.xml',
  '/robots.txt'
];

function isServerAvailable(url = 'http://127.0.0.1:3000/') {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureDevServer() {
  const alreadyUp = await isServerAvailable();
  if (alreadyUp) {
    return null;
  }

  const devServer = spawn('node', ['dev-server.mjs'], {
    stdio: 'ignore',
    detached: false,
  });

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    if (await isServerAvailable()) {
      return devServer;
    }
  }

  devServer.kill();
  throw new Error('Timeout waiting for dev-server to start on port 3000');
}

async function checkUrl(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          contentType: res.headers['content-type'],
          size: data.length,
          body: data,
          preview: data.slice(0, 80).replace(/\n/g, ' ')
        });
      });
    }).on('error', reject);
  });
}

async function run() {
  let devServerProcess = null;
  try {
    devServerProcess = await ensureDevServer();
  } catch (err) {
    console.error('Failed to ensure dev server:', err);
    process.exit(1);
  }

  console.log('--- Checking Legal & Sitemap Pages ---');
  let hasError = false;
  for (const url of URLS) {
    try {
      const res = await checkUrl(url);
      const isOk = res.status === 200 && res.size > 0;
      console.log(`${isOk ? '✓' : '✗'} [${res.status}] ${res.path} (${res.contentType}, ${res.size} bytes)`);
      if (!isOk) hasError = true;

      // Verify language buttons for HTML pages
      if (['/agb.html', '/datenschutz.html', '/impressum.html', '/sitemap.html'].includes(url)) {
        const hasDe = res.body.includes('data-lang="de"');
        const hasEn = res.body.includes('data-lang="en"');
        const hasFr = res.body.includes('data-lang="fr"');
        const hasEs = res.body.includes('data-lang="es"');
        const hasRu = res.body.includes('data-lang="ru"');

        if (!hasDe || !hasEn || !hasFr || !hasEs || hasRu) {
          console.error(`✗ ${url} language buttons invalid! DE:${hasDe}, EN:${hasEn}, FR:${hasFr}, ES:${hasEs}, RU:${hasRu}`);
          hasError = true;
        } else {
          console.log(`  ✓ Languages valid: DE, EN, FR, ES (No RU) on ${url}`);
        }
      }

      if (url === '/sitemap.xml') {
        const hasDe = res.body.includes('hreflang="de"');
        const hasEs = res.body.includes('hreflang="es"');
        const hasRu = res.body.includes('hreflang="ru"');
        if (!hasDe || !hasEs || hasRu) {
          console.error(`✗ sitemap.xml hreflang invalid! DE:${hasDe}, ES:${hasEs}, RU:${hasRu}`);
          hasError = true;
        } else {
          console.log(`  ✓ Sitemaps hreflang valid: DE, EN, FR, ES (No RU)`);
        }
      }
    } catch (e) {
      console.error(`✗ Failed to fetch ${url}:`, e.message);
      hasError = true;
    }
  }

  if (devServerProcess) {
    devServerProcess.kill();
  }

  if (hasError) {
    console.error('Test FAILED');
    process.exit(1);
  } else {
    console.log('\n✦ All Legal Pages & Sitemaps are 100% accessible and valid!');
    process.exit(0);
  }
}

run();
