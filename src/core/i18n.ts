import deDict from '../data/locales/de.json';
import enDict from '../data/locales/en.json';
import frDict from '../data/locales/fr.json';
import esDict from '../data/locales/es.json';
import { bus } from './bus';
import type { LanguageSettings } from './types';

export type Locale = 'de' | 'en' | 'fr' | 'es';

const STORAGE_KEY = 'st_noblesse_locale';
const STORAGE_SETTINGS_KEY = 'st_noblesse_lang_settings';

const DEFAULT_SETTINGS: LanguageSettings = {
  showSwitcher: true,
  languages: {
    de: true,
    en: true,
    fr: true,
    es: true,
  },
};

let currentLocale: Locale = 'en';

const dictionaries: Record<Locale, Record<string, any>> = {
  de: deDict,
  en: enDict,
  fr: frDict,
  es: esDict,
};

/**
 * Get language curation settings
 */
export function getLanguageSettings(): LanguageSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        showSwitcher: parsed.showSwitcher !== false,
        languages: {
          de: parsed.languages?.de !== false,
          en: true, // English is always the base
          fr: parsed.languages?.fr !== false,
          es: parsed.languages?.es !== false,
        },
      };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save language settings and synchronize interface
 */
export function saveLanguageSettings(settings: LanguageSettings): void {
  // English is permanently enabled as root fallback
  settings.languages.en = true;
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}

  // If current locale is disabled or switcher is off, revert to English
  if (!settings.showSwitcher || !settings.languages[currentLocale]) {
    setLocale('en');
  }

  bus.emit('i18n:settings-changed', { settings });
}

/**
 * Check if a given locale is currently enabled
 */
export function isLocaleEnabled(locale: Locale): boolean {
  if (locale === 'en') return true;
  const settings = getLanguageSettings();
  return Boolean(settings.showSwitcher && settings.languages[locale]);
}

/**
 * Initialize locale from localStorage or browser preferences
 */
export function initLocale(): Locale {
  const settings = getLanguageSettings();
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;

  if (saved && ['de', 'en', 'fr', 'es'].includes(saved) && isLocaleEnabled(saved)) {
    currentLocale = saved;
  } else {
    // Detect browser language if enabled
    const navLang = navigator.language.slice(0, 2).toLowerCase();
    if (navLang === 'de' && isLocaleEnabled('de')) currentLocale = 'de';
    else if (navLang === 'fr' && isLocaleEnabled('fr')) currentLocale = 'fr';
    else if (navLang === 'es' && isLocaleEnabled('es')) currentLocale = 'es';
    else currentLocale = 'en';
  }
  document.documentElement.setAttribute('lang', currentLocale);
  return currentLocale;
}

/**
 * Get currently active locale
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Switch active locale and notify app
 */
export function setLocale(locale: Locale): void {
  // If not enabled and not english, force english
  const target: Locale = isLocaleEnabled(locale) ? locale : 'en';
  currentLocale = target;
  try {
    localStorage.setItem(STORAGE_KEY, target);
  } catch {}
  document.documentElement.setAttribute('lang', target);
  bus.emit('i18n:change', { locale: target });
}

/**
 * Helper to resolve product description across multilingual translations
 */
export function getProductDesc(
  desc: string | Record<string, string> | undefined,
  locale: Locale = currentLocale
): string {
  if (!desc) return '';
  if (typeof desc === 'object') {
    return desc[locale] || desc['en'] || Object.values(desc)[0] || '';
  }
  if (typeof desc === 'string' && desc.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(desc);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed[locale] || parsed['en'] || Object.values(parsed)[0] || desc;
      }
    } catch {}
  }
  return desc;
}

/**
 * Translate a dot-notated key (e.g. 'cart.checkout_btn')
 * Supports interpolation like `{amount}`
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[currentLocale] || dictionaries.en;
  const parts = key.split('.');
  let val: any = dict;

  for (const part of parts) {
    if (val && typeof val === 'object' && part in val) {
      val = val[part];
    } else {
      val = undefined;
      break;
    }
  }

  if (typeof val !== 'string') {
    return key;
  }

  if (params) {
    return val.replace(/\{(\w+)\}/g, (_, match) => {
      return match in params ? String(params[match]) : `{${match}}`;
    });
  }

  return val;
}
