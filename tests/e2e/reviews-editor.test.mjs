import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9231',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9231/json/list', res => {
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

    console.log('1. Authenticating as admin and opening Studio...');
    const loginRes = await evalCode(`
      (async () => {
        const admin = await window.__st.pb.login('admin@noblesse.com', 'noblesse12345');
        window.__st.bus.emit('auth:change', { user: admin });
        window.__st.adminStudioApi.open();
        return {
          isAdmin: admin.isAdmin,
          isOpen: document.querySelector('#adminStudioModal').classList.contains('open')
        };
      })()
    `);
    console.log('✓ Login & Studio open:', loginRes);
    assert.strictEqual(loginRes.isAdmin, true);
    assert.strictEqual(loginRes.isOpen, true);

    console.log('2. Switching to "Client Reviews" tab...');
    const switchRes = await evalCode(`
      (async () => {
        const tab = document.querySelector('#adminTabReviews');
        tab.click();
        await new Promise(r => setTimeout(r, 400));
        const viewReviews = document.querySelector('#adminViewReviews');
        const cards = document.querySelectorAll('#adminReviewList .admin-review-card');
        return {
          tabActive: tab.classList.contains('active'),
          viewVisible: viewReviews && viewReviews.style.display !== 'none',
          cardCount: cards.length
        };
      })()
    `);
    console.log('✓ Reviews tab switched:', switchRes);
    assert.strictEqual(switchRes.tabActive, true);
    assert.strictEqual(switchRes.viewVisible, true);
    assert.ok(switchRes.cardCount >= 1, 'Should display existing reviews');

    console.log('3. Selecting an existing review and verifying form fields...');
    const selectRes = await evalCode(`
      (() => {
        const firstCard = document.querySelector('#adminReviewList .admin-review-card');
        firstCard.click();
        const author = document.querySelector('#adminReviewAuthor').value;
        const text = document.querySelector('#adminReviewText').value;
        const location = document.querySelector('#adminReviewLocation').value;
        const rating = document.querySelector('#adminReviewRating').value;
        const delBtnVisible = document.querySelector('#adminDeleteReviewBtn').style.display !== 'none';
        return { author, textLength: text.length, location, rating, delBtnVisible };
      })()
    `);
    console.log('✓ Existing review populated:', selectRes);
    assert.ok(selectRes.author.length > 0);
    assert.ok(selectRes.textLength > 0);
    assert.strictEqual(selectRes.delBtnVisible, true);

    console.log('4. Creating a new client review...');
    const newAuthorName = 'E2E Test Client ' + Math.floor(Math.random() * 1000);
    const newReviewText = 'Exquisite fragrance with unmatched longevity and aura.';
    const createRes = await evalCode(`
      (async () => {
        const newBtn = document.querySelector('#adminNewReviewBtn');
        newBtn.click();

        const authorInput = document.querySelector('#adminReviewAuthor');
        const textInput = document.querySelector('#adminReviewText');
        const locInput = document.querySelector('#adminReviewLocation');
        const ratingSelect = document.querySelector('#adminReviewRating');
        const form = document.querySelector('#adminReviewForm');

        authorInput.value = '${newAuthorName}';
        textInput.value = '${newReviewText}';
        locInput.value = 'Zurich · Azure Épure';
        ratingSelect.value = '5';

        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        await new Promise(r => setTimeout(r, 600));

        const cards = document.querySelectorAll('#adminReviewList .admin-review-card');
        const activeCard = document.querySelector('#adminReviewList .admin-review-card.active');
        const carouselHasNew = Array.from(document.querySelectorAll('#revSlides .rev-slide .rev-who b'))
          .some(b => b.textContent.includes('${newAuthorName}'));

        return {
          totalCards: cards.length,
          activeCardAuthor: activeCard ? activeCard.querySelector('strong').textContent : '',
          carouselHasNew
        };
      })()
    `);
    console.log('✓ Create review result:', createRes);
    assert.ok(createRes.activeCardAuthor.includes(newAuthorName));
    assert.strictEqual(createRes.carouselHasNew, true, 'Carousel must immediately include new review');

    console.log('5. Editing the newly created review...');
    const updatedReviewText = 'Updated: An absolute masterpiece in our collection!';
    const editRes = await evalCode(`
      (async () => {
        const textInput = document.querySelector('#adminReviewText');
        textInput.value = '${updatedReviewText}';
        const form = document.querySelector('#adminReviewForm');
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        await new Promise(r => setTimeout(r, 600));

        const carouselHasUpdated = Array.from(document.querySelectorAll('#revSlides .rev-slide .rev-text'))
          .some(p => p.textContent.includes('Updated: An absolute masterpiece'));

        return { carouselHasUpdated };
      })()
    `);
    console.log('✓ Edit review result:', editRes);
    assert.strictEqual(editRes.carouselHasUpdated, true);

    console.log('6. Deleting the review and verifying cleanup...');
    const deleteRes = await evalCode(`
      (async () => {
        // Mock window.confirm
        window.confirm = () => true;
        const delBtn = document.querySelector('#adminDeleteReviewBtn');
        delBtn.click();
        await new Promise(r => setTimeout(r, 600));

        const cards = document.querySelectorAll('#adminReviewList .admin-review-card');
        const carouselStillHas = Array.from(document.querySelectorAll('#revSlides .rev-slide .rev-who b'))
          .some(b => b.textContent.includes('${newAuthorName}'));

        return {
          remainingCards: cards.length,
          carouselStillHas
        };
      })()
    `);
    console.log('✓ Delete review result:', deleteRes);
    assert.strictEqual(deleteRes.carouselStillHas, false, 'Deleted review must be removed from carousel');

    console.log('\n🎉 ALL REVIEWS EDITOR TESTS PASSED 100%!');
    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
