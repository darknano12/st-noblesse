// =========================================================
// ST. NOBLESSE - LEGAL PAGE RUNTIME
// Handles locale switching, persistence and smooth navigation
// =========================================================

export function initLegalPage() {
  const STORAGE_KEY = 'st_noblesse_locale';
  const LEGACY_STORAGE_KEY = 'noblesse_lang';
  const urlParams = new URLSearchParams(window.location.search);
  const paramLang = urlParams.get('lang');
  const savedLang = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  
  let currentLang = paramLang || savedLang || 'en';
  if (!['de', 'en', 'fr', 'es'].includes(currentLang)) {
    currentLang = 'en';
  }

  function applyLanguage(lang: string) {
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      localStorage.setItem(LEGACY_STORAGE_KEY, lang);
    } catch {}
    document.documentElement.lang = lang;

    // Toggle active state on language switcher buttons
    document.querySelectorAll('.legal-lang-btn').forEach(btn => {
      const btnLang = btn.getAttribute('data-lang');
      if (btnLang === lang) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    // Toggle visibility of multilingual content sections
    document.querySelectorAll('[data-content-lang]').forEach(el => {
      const elLang = el.getAttribute('data-content-lang');
      if (elLang === lang) {
        (el as HTMLElement).style.display = '';
      } else {
        (el as HTMLElement).style.display = 'none';
      }
    });
  }

  // Wire buttons
  document.querySelectorAll('.legal-lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetLang = btn.getAttribute('data-lang');
      if (targetLang) {
        applyLanguage(targetLang);
      }
    });
  });

  // Apply initial language
  applyLanguage(currentLang);
}

// Auto-run if executed in browser
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLegalPage);
  } else {
    initLegalPage();
  }
}
