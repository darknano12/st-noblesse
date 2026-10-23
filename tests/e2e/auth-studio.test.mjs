import http from 'node:http';
import { spawn } from 'node:child_process';

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

async function run() {
  let devServerProcess = null;
  try {
    devServerProcess = await ensureDevServer();
  } catch (err) {
    console.error('Failed to ensure dev server:', err);
    process.exit(1);
  }

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9228/json/list', res => {
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

    await new Promise(r => setTimeout(r, 1500));

    console.log('1. Logging in as Boutique Admin & opening Studio...');
    const loginResult = await send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const admin = await window.__st.pb.login('admin@noblesse.com', 'noblesse12345');
        window.__st.bus.emit('auth:change', { user: admin });
        window.__st.adminStudioApi.open();
        return {
          isAdmin: admin.isAdmin,
          isStudioOpen: document.querySelector('#adminStudioModal').classList.contains('open')
        };
      })()`,
      returnByValue: true
    });
    console.log('✓ Login & Studio Open:', loginResult.result.value);

    console.log('2. Verifying existing product description is populated and NOT empty...');
    const existingDescResult = await send('Runtime.evaluate', {
      expression: `(() => {
        // Find first item in list (e.g. Azure Épure)
        const firstCard = document.querySelector('.admin-item-card');
        if (firstCard) firstCard.click();

        const nameVal = document.querySelector('#adminProductName').value;
        const descVal = document.querySelector('#adminProductDesc').value;
        const isEnTabActive = document.querySelector('.desc-lang-tab[data-desc-lang="en"]').classList.contains('active');

        return {
          name: nameVal,
          descLength: descVal.length,
          descPreview: descVal.slice(0, 50),
          isEnTabActive,
          isNotEmpty: descVal.trim().length > 0
        };
      })()`,
      returnByValue: true
    });
    console.log('✓ Existing Product Check:', existingDescResult.result.value);
    if (!existingDescResult.result.value.isNotEmpty) {
      throw new Error('Existing product description was EMPTY upon editing!');
    }

    console.log('3. Testing switching description tabs and preserving text...');
    const descTabSwitchResult = await send('Runtime.evaluate', {
      expression: `(() => {
        // Switch to French tab and write text
        document.querySelector('.desc-lang-tab[data-desc-lang="fr"]').click();
        document.querySelector('#adminProductDesc').value = 'Un sillage céleste et frais.';

        // Switch back to English tab and check if English text is still there
        document.querySelector('.desc-lang-tab[data-desc-lang="en"]').click();
        const enText = document.querySelector('#adminProductDesc').value;

        // Switch to French again and verify French text is still there
        document.querySelector('.desc-lang-tab[data-desc-lang="fr"]').click();
        const frText = document.querySelector('#adminProductDesc').value;

        return {
          enPreserved: enText.length > 0,
          frPreserved: frText === 'Un sillage céleste et frais.'
        };
      })()`,
      returnByValue: true
    });
    console.log('✓ Tab switching preservation:', descTabSwitchResult.result.value);
    if (!descTabSwitchResult.result.value.enPreserved || !descTabSwitchResult.result.value.frPreserved) {
      throw new Error('Description tabs did not preserve multilingual inputs!');
    }

    console.log('4. Creating a new product and then EDITING & RE-SAVING it (testing PATCH by ID)...');
    const createAndEditResult = await send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        document.querySelector('#adminNewProductBtn').click();
        const testName = 'Atelier Test ' + Math.floor(Math.random() * 900 + 100);

        document.querySelector('#adminProductName').value = testName;
        document.querySelector('#adminProductFamily').value = 'floral';
        document.querySelector('#adminProductBadge').value = 'Original Batch';
        document.querySelector('#adminProductPrice50').value = '95';
        document.querySelector('#adminProductPrice100').value = '145';
        document.querySelector('#adminProductDesc').value = 'Delicate rose extract with iris.';

        // Submit new product
        const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
        document.querySelector('#adminProductForm').dispatchEvent(submitEvent);
        await new Promise(r => setTimeout(r, 1200));

        // Find newly saved product in list and click it to edit
        const cards = Array.from(document.querySelectorAll('.admin-item-card'));
        const createdCard = cards.find(c => c.textContent.includes(testName));
        if (!createdCard) return { success: false, error: 'Created card not found in list' };

        createdCard.click();

        // Check if description loaded
        const loadedDesc = document.querySelector('#adminProductDesc').value;

        // Now EDIT IT: change price to 105 and badge to "Updated Batch"
        document.querySelector('#adminProductPrice50').value = '105';
        document.querySelector('#adminProductBadge').value = 'Updated Batch';

        // Submit edit
        document.querySelector('#adminProductForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        await new Promise(r => setTimeout(r, 1200));

        const toastMsg = document.querySelector('#toastTxt').textContent;
        const hasError = toastMsg.toLowerCase().includes('error');

        // Check updated product in catalog
        const updated = window.__st.catalog.all().find(p => p.name === testName);

        return {
          success: !hasError,
          loadedDescPopulated: loadedDesc === 'Delicate rose extract with iris.',
          toastMsg,
          updatedPrice: updated ? updated.price['50'] : null,
          updatedBadge: updated ? updated.badge : null
        };
      })()`,
      returnByValue: true
    });
    console.log('✓ Create & Re-Edit Results:', createAndEditResult.result.value);
    if (!createAndEditResult.result.value.success || createAndEditResult.result.value.updatedPrice !== 105) {
      throw new Error(`Re-editing product failed: ${createAndEditResult.result.value.toastMsg}`);
    }

    // Clean up test products
    await send('Runtime.evaluate', {
      expression: `(() => {
        const cleanProds = window.__st.catalog.all().filter(p => !p.id.startsWith('atelier-test'));
        window.__st.catalog.setProducts(cleanProds);
        window.__st.pb.saveLocalProducts(cleanProds);
      })()`
    });

    // Close Studio
    await send('Runtime.evaluate', {
      expression: `window.__st.adminStudioApi.close()`
    });

    ws.close();
    chrome.kill();
    if (devServerProcess) devServerProcess.kill();
    console.log('\n🎉 ALL PRODUCT EDITING, MULTILINGUAL RETENTION & RE-SAVING TESTS PASSED 100%!');
  } catch (err) {
    chrome.kill();
    if (devServerProcess) devServerProcess.kill();
    console.error('Test error:', err);
    process.exit(1);
  }
}

run();
