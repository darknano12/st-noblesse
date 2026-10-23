import { bus } from '../../core/bus';
import {
  getLanguageSettings,
  getLocale,
  setLocale,
  t,
  NOTRESUCCES_LOCALES,
  type Locale,
} from '../../core/i18n';

/**
 * Initialize Language Switcher (header, mobile navigation & Notre Succès footer dropdown)
 */
export function initLangSwitch(): void {
  function renderAllSwitchers(): void {
    const settings = getLanguageSettings();
    const current = getLocale();
    const enabledLangs = NOTRESUCCES_LOCALES.filter(
      (item) => settings.languages[item.code] !== false
    );

    // 1. Render Header Switcher
    const headerSwitch = document.querySelector<HTMLElement>('#langSwitch');
    if (headerSwitch) {
      headerSwitch.innerHTML = enabledLangs
        .map(
          (item, idx) =>
            `<button class="lang-btn ${item.code === current ? 'active' : ''}" data-lang="${item.code}" aria-label="${item.name}">${item.code.toUpperCase()}</button>` +
            (idx < enabledLangs.length - 1 ? '<span class="lang-sep">·</span>' : '')
        )
        .join('');
    }

    // 2. Render Mobile Nav Switcher
    const mSwitch = document.querySelector<HTMLElement>('.m-lang-switch');
    if (mSwitch) {
      mSwitch.innerHTML = enabledLangs
        .map(
          (item) =>
            `<button class="lang-btn ${item.code === current ? 'active' : ''}" data-lang="${item.code}" aria-label="${item.name}">${item.code.toUpperCase()}</button>`
        )
        .join('');
    }

    // 3. Render Footer Dropdown (Notre Succès style)
    const footerCurrent = document.querySelector<HTMLElement>('#footerLangCurrent');
    const footerList = document.querySelector<HTMLElement>('#footerLangList');
    if (footerCurrent) {
      const activeMeta = NOTRESUCCES_LOCALES.find((l) => l.code === current) || NOTRESUCCES_LOCALES[0];
      footerCurrent.textContent = `${activeMeta.flag} ${activeMeta.nativeName}`;
    }

    if (footerList) {
      footerList.innerHTML = enabledLangs
        .map(
          (item) => `
          <li class="loc-item ${item.code === current ? 'active' : ''}" data-lang="${item.code}">
            <div class="loc-item-text">
              <span>${item.flag}</span>
              <strong>${item.nativeName}</strong>
            </div>
            <small style="opacity: 0.6; font-size: 0.72rem; text-transform: uppercase;">${item.code}</small>
          </li>
        `
        )
        .join('');
    }

    applyVisibility();
  }

  function applyVisibility(): void {
    const settings = getLanguageSettings();
    const headerSwitch = document.querySelector<HTMLElement>('#langSwitch');
    const mSwitch = document.querySelector<HTMLElement>('.m-lang-switch');
    const footerLoc = document.querySelector<HTMLElement>('.footer-localization');

    const enabledCount = NOTRESUCCES_LOCALES.filter(
      (l) => settings.languages[l.code] !== false
    ).length;

    const isVisible = settings.showSwitcher && enabledCount > 1;
    const pos = settings.switcherPosition || 'both';

    if (headerSwitch) {
      headerSwitch.style.display = isVisible && (pos === 'both' || pos === 'header') ? '' : 'none';
    }
    if (mSwitch) {
      mSwitch.style.display = isVisible && (pos === 'both' || pos === 'header') ? '' : 'none';
    }
    if (footerLoc) {
      footerLoc.style.display = isVisible && (pos === 'both' || pos === 'footer') ? '' : 'none';
    }
  }

  function updateActiveButtons(current: Locale): void {
    document.querySelectorAll<HTMLElement>('.lang-btn').forEach((btn) => {
      const lang = btn.dataset.lang as Locale;
      btn.classList.toggle('active', lang === current);
      btn.setAttribute('aria-pressed', lang === current ? 'true' : 'false');
    });

    const footerCurrent = document.querySelector<HTMLElement>('#footerLangCurrent');
    if (footerCurrent) {
      const activeMeta = NOTRESUCCES_LOCALES.find((l) => l.code === current) || NOTRESUCCES_LOCALES[0];
      footerCurrent.textContent = `${activeMeta.flag} ${activeMeta.nativeName}`;
    }

    document.querySelectorAll<HTMLElement>('.loc-item').forEach((item) => {
      const lang = item.dataset.lang as Locale;
      item.classList.toggle('active', lang === current);
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
        if (translated.includes('<')) {
          el.innerHTML = translated;
        } else {
          el.textContent = translated;
        }
      }
    });
  }

  function changeLocaleWithFeedback(targetLang: Locale): void {
    const prev = getLocale();
    if (prev === targetLang) return;

    setLocale(targetLang);

    const meta = NOTRESUCCES_LOCALES.find((l) => l.code === targetLang);
    const toastMsg = `Language switched to <b>${meta?.nativeName || targetLang.toUpperCase()}</b>`;
    bus.emit('toast:show', {
      html: toastMsg,
      duration: 2500,
    });
  }

  // Delegated click handler for language buttons (header & mobile)
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.lang-btn');
    if (btn && btn.dataset.lang) {
      const targetLang = btn.dataset.lang as Locale;
      changeLocaleWithFeedback(targetLang);
      return;
    }

    // Footer dropdown item click
    const locItem = (e.target as HTMLElement).closest<HTMLElement>('.loc-item');
    if (locItem && locItem.dataset.lang) {
      const targetLang = locItem.dataset.lang as Locale;
      changeLocaleWithFeedback(targetLang);
      const dropdown = document.querySelector('#footerLangDropdown');
      dropdown?.classList.remove('active');
      return;
    }

    // Footer dropdown toggle button
    const footerBtn = (e.target as HTMLElement).closest<HTMLElement>('#footerLangBtn');
    if (footerBtn) {
      const dropdown = document.querySelector('#footerLangDropdown');
      dropdown?.classList.toggle('active');
      return;
    }

    // Click outside footer dropdown closes it
    const dropdown = document.querySelector('#footerLangDropdown');
    if (dropdown && dropdown.classList.contains('active')) {
      if (!(e.target as HTMLElement).closest('#footerLangDropdown')) {
        dropdown.classList.remove('active');
      }
    }
  });

  // Listen for language changes from bus
  bus.on('i18n:change', ({ locale }) => {
    updateActiveButtons(locale as Locale);
    applyTranslations();
  });

  // Listen for language settings changes
  bus.on('i18n:settings-changed', () => {
    renderAllSwitchers();
    updateActiveButtons(getLocale());
    applyTranslations();
  });

  // Initial setup
  renderAllSwitchers();
  updateActiveButtons(getLocale());
  applyTranslations();
}
