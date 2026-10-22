import { bus } from '../../core/bus';
import { getLanguageSettings, getLocale, setLocale, t, type Locale } from '../../core/i18n';

/**
 * Initialize Language Switcher (desktop header and mobile menu)
 */
export function initLangSwitch(): void {
  function updateActiveButtons(current: Locale): void {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.lang-btn');
    buttons.forEach((btn) => {
      if (btn.dataset.lang === current) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  function applyVisibility(): void {
    const settings = getLanguageSettings();
    const switchers = document.querySelectorAll<HTMLElement>('#langSwitch, .m-lang-switch');
    
    // Check enabled count
    const enabledLangs = (['de', 'en', 'fr', 'es'] as Locale[]).filter(
      (l) => settings.languages[l] !== false
    );

    // If whole switcher is disabled or only 1 language is available, hide switcher
    if (!settings.showSwitcher || enabledLangs.length <= 1) {
      switchers.forEach((el) => {
        el.style.display = 'none';
      });
      return;
    }

    switchers.forEach((el) => {
      el.style.display = '';
    });

    // Toggle individual buttons & separators
    document.querySelectorAll<HTMLElement>('.lang-btn[data-lang]').forEach((btn) => {
      const lang = btn.dataset.lang as Locale;
      const isEnabled = settings.languages[lang] !== false;
      btn.style.display = isEnabled ? '' : 'none';

      // Next or previous separator
      const nextSep = btn.nextElementSibling;
      if (nextSep && nextSep.classList.contains('lang-sep')) {
        (nextSep as HTMLElement).style.display = isEnabled ? '' : 'none';
      }
    });
  }

  function applyTranslations(): void {
    const translatables = document.querySelectorAll<HTMLElement>('[data-i18n]');
    translatables.forEach((el) => {
      const key = el.dataset.i18n;
      if (!key) return;

      const translated = t(key);
      if (el.dataset.i18nAttr) {
        el.setAttribute(el.dataset.i18nAttr, translated);
      } else if (el.tagName === 'INPUT' && (el as HTMLInputElement).placeholder) {
        (el as HTMLInputElement).placeholder = translated;
      } else {
        // If element has HTML tags like <em> inside translation, support it safely
        if (translated.includes('<')) {
          el.innerHTML = translated;
        } else {
          el.textContent = translated;
        }
      }
    });
  }

  // Delegated click on any .lang-btn
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-btn');
    if (!btn || !btn.dataset.lang) return;

    const targetLang = btn.dataset.lang as Locale;
    if (['de', 'en', 'fr', 'es'].includes(targetLang)) {
      setLocale(targetLang);
      let toastMsg = 'Language changed to <b>English</b>';
      if (targetLang === 'de') toastMsg = 'Sprache geändert auf <b>Deutsch</b>';
      else if (targetLang === 'fr') toastMsg = 'Langue changée en <b>Français</b>';
      else if (targetLang === 'es') toastMsg = 'Idioma cambiado a <b>Español</b>';

      bus.emit('toast:show', {
        html: toastMsg,
        duration: 2500,
      });
    }
  });

  // Listen for language changes from bus
  bus.on('i18n:change', ({ locale }) => {
    updateActiveButtons(locale as Locale);
    applyTranslations();
  });

  // Listen for language settings changes
  bus.on('i18n:settings-changed', () => {
    applyVisibility();
    updateActiveButtons(getLocale());
    applyTranslations();
  });

  // Initial synchronization
  applyVisibility();
  const initial = getLocale();
  updateActiveButtons(initial);
  applyTranslations();
}
