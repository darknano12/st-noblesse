import http from 'node:http';
import { spawn } from 'node:child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const viewports = [
  { name: 'Mobile 320px', width: 320, height: 640 },
  { name: 'Mobile 360px', width: 360, height: 780 },
  { name: 'Mobile 375px', width: 375, height: 812 },
  { name: 'Mobile 390px', width: 390, height: 844 },
  { name: 'Mobile 414px', width: 414, height: 896 },
  { name: 'Mobile 480px', width: 480, height: 854 },
  { name: 'Tablet 600px', width: 600, height: 960 },
  { name: 'Tablet 768px', width: 768, height: 1024 },
  { name: 'Tablet 1024px', width: 1024, height: 768 },
  { name: 'Laptop 1280px', width: 1280, height: 800 },
  { name: 'Desktop 1440px', width: 1440, height: 900 },
  { name: 'Full HD 1920px', width: 1920, height: 1080 }
];

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9229/json/list', res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const page = list.find(p => p.type === 'page');
    if (!page) throw new Error('No page target found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await send('Runtime.enable');
    await send('Page.enable');

    async function evalCode(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res?.result?.value;
    }

    // Wait for initial render and animations
    await new Promise(r => setTimeout(r, 1000));

    console.log('--- AUDITING VIEWPORT RESOLUTIONS ---');
    let anyOverflow = false;

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width <= 768
      });

      await new Promise(r => setTimeout(r, 200));

      const audit = await evalCode(`
        (() => {
          const docEl = document.documentElement;
          const body = document.body;
          const winWidth = window.innerWidth;
          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const hasHScroll = scrollWidth > winWidth + 1;

          // Find overflowing elements
          const overflowEls = [];
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            // ignore svg inner tags
            if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;
            const rect = el.getBoundingClientRect();
            if (rect.right > winWidth + 1) {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? '#' + el.id : '';
              const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
              overflowEls.push({
                selector: tag + id + cls,
                right: Math.round(rect.right),
                excess: Math.round(rect.right - winWidth),
                width: Math.round(rect.width)
              });
            }
          }

          // Top overflowing selectors
          const topOverflow = overflowEls
            .sort((a, b) => b.excess - a.excess)
            .slice(0, 5);

          return {
            winWidth,
            scrollWidth,
            hasHScroll,
            overflowCount: overflowEls.length,
            topOverflow
          };
        })()
      `);

      const status = audit.hasHScroll ? '❌ OVERFLOW' : '✅ OK';
      if (audit.hasHScroll) anyOverflow = true;
      console.log(`[${status}] ${vp.name} (${vp.width}x${vp.height}): scrollWidth=${audit.scrollWidth} winWidth=${audit.winWidth}`);
      if (audit.hasHScroll && audit.topOverflow.length) {
        console.log('   Top offenders:', JSON.stringify(audit.topOverflow));
      }
    }

    ws.close();
    if (anyOverflow) {
      console.log('\n❌ RESOLUTION AUDIT FOUND OVERFLOW ISSUES!');
    } else {
      console.log('\n🎉 ALL RESOLUTIONS FIT PERFECTLY WITHOUT HORIZONTAL OVERFLOW!');
    }
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
