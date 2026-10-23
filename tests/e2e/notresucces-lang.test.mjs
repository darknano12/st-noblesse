import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9232',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9232/json/list', res => {
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

    console.log('1. Testing Footer Language Switcher (Notre Succès style)...');
    const footerInit = await evalCode(`
      (() => {
        const dropdown = document.querySelector('#footerLangDropdown');
        const btn = document.querySelector('#footerLangBtn');
        const currentText = document.querySelector('#footerLangCurrent')?.textContent;
        const items = document.querySelectorAll('#footerLangList .loc-item');
        return {
          hasDropdown: Boolean(dropdown),
          hasBtn: Boolean(btn),
          currentText,
          itemCount: items.length
        };
      })()
    `);
    console.log('✓ Footer dropdown initial state:', footerInit);
    assert.strictEqual(footerInit.hasDropdown, true);
    assert.strictEqual(footerInit.hasBtn, true);
    assert.ok(footerInit.itemCount >= 4, 'Should contain active languages');

    console.log('2. Switching language to Dutch (Nederlands - nl) via Footer Dropdown...');
    const switchNl = await evalCode(`
      (async () => {
        const btn = document.querySelector('#footerLangBtn');
        btn.click();
        await new Promise(r => setTimeout(r, 100));

        const nlItem = document.querySelector('#footerLangList .loc-item[data-lang="nl"]');
        if (nlItem) nlItem.click();
        await new Promise(r => setTimeout(r, 300));

        const docLang = document.documentElement.getAttribute('lang');
        const currentText = document.querySelector('#footerLangCurrent')?.textContent;
        const navFamilies = document.querySelector('nav.desk a[href="#collections"]')?.textContent;

        return { docLang, currentText, navFamilies };
      })()
    `);
    console.log('✓ Dutch switch result:', switchNl);
    assert.strictEqual(switchNl.docLang, 'nl');
    assert.ok(switchNl.currentText.includes('Nederlands'));
    assert.strictEqual(switchNl.navFamilies, 'De Geurfamilies');

    console.log('3. Switching language to Italian (Italiano - it) via Footer Dropdown...');
    const switchIt = await evalCode(`
      (async () => {
        const btn = document.querySelector('#footerLangBtn');
        btn.click();
        await new Promise(r => setTimeout(r, 100));

        const itItem = document.querySelector('#footerLangList .loc-item[data-lang="it"]');
        if (itItem) itItem.click();
        await new Promise(r => setTimeout(r, 300));

        const docLang = document.documentElement.getAttribute('lang');
        const currentText = document.querySelector('#footerLangCurrent')?.textContent;
        const navFamilies = document.querySelector('nav.desk a[href="#collections"]')?.textContent;

        return { docLang, currentText, navFamilies };
      })()
    `);
    console.log('✓ Italian switch result:', switchIt);
    assert.strictEqual(switchIt.docLang, 'it');
    assert.ok(switchIt.currentText.includes('Italiano'));
    assert.strictEqual(switchIt.navFamilies, 'Le Famiglie');

    console.log('4. Authenticating and verifying Language Settings in Admin Studio...');
    const adminLangRes = await evalCode(`
      (async () => {
        const admin = await window.__st.pb.login('admin@noblesse.com', 'noblesse12345');
        window.__st.bus.emit('auth:change', { user: admin });
        window.__st.adminStudioApi.open();
        await new Promise(r => setTimeout(r, 200));

        const tab = document.querySelector('#adminTabLanguages');
        tab.click();
        await new Promise(r => setTimeout(r, 200));

        const langCheckboxes = document.querySelectorAll('.admin-lang-selection input[type="checkbox"]');
        const defaultLangSelect = document.querySelector('#adminDefaultLang');
        const switcherPosSelect = document.querySelector('#adminSwitcherPosition');

        return {
          totalLangCheckboxes: langCheckboxes.length,
          hasDefaultSelect: Boolean(defaultLangSelect),
          hasPosSelect: Boolean(switcherPosSelect),
          defaultLangValue: defaultLangSelect ? defaultLangSelect.value : null
        };
      })()
    `);
    console.log('✓ Admin language settings state:', adminLangRes);
    assert.strictEqual(adminLangRes.totalLangCheckboxes, 9, 'Should have all 9 Notre Succès languages');
    assert.strictEqual(adminLangRes.hasDefaultSelect, true);
    assert.strictEqual(adminLangRes.hasPosSelect, true);

    console.log('5. Saving modified language settings...');
    const saveLangRes = await evalCode(`
      (async () => {
        const defaultLangSelect = document.querySelector('#adminDefaultLang');
        defaultLangSelect.value = 'fr';

        const saveBtn = document.querySelector('#adminSaveLanguagesBtn');
        saveBtn.click();
        await new Promise(r => setTimeout(r, 400));

        const settings = window.__st.i18n.getLanguageSettings();
        return {
          savedDefault: settings.defaultLocale,
          showSwitcher: settings.showSwitcher
        };
      })()
    `);
    console.log('✓ Saved language settings:', saveLangRes);
    assert.strictEqual(saveLangRes.savedDefault, 'fr');
    assert.strictEqual(saveLangRes.showSwitcher, true);

    console.log('\n🎉 ALL NOTRE SUCCÈS LANGUAGE & LOCALIZATION TESTS PASSED 100%!');
    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
