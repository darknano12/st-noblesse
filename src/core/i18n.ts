import deDict from '../data/locales/de.json';
import enDict from '../data/locales/en.json';
import frDict from '../data/locales/fr.json';
import esDict from '../data/locales/es.json';
import nlDict from '../data/locales/nl.json';
import itDict from '../data/locales/it.json';
import nbDict from '../data/locales/nb.json';
import svDict from '../data/locales/sv.json';
import daDict from '../data/locales/da.json';
import { bus } from './bus';
import type { LanguageSettings } from './types';

export type Locale = 'en' | 'de' | 'nl' | 'fr' | 'es' | 'it' | 'nb' | 'sv' | 'da';

export interface LocaleMeta {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

export const NOTRESUCCES_LOCALES: LocaleMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'nb', name: 'Norwegian', nativeName: 'Norsk (bokmål)', flag: '🇳🇴' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
];

const STORAGE_KEY = 'st_noblesse_locale';
const STORAGE_SETTINGS_KEY = 'st_noblesse_lang_settings';

const DEFAULT_SETTINGS: LanguageSettings = {
  showSwitcher: true,
  defaultLocale: 'en',
  switcherPosition: 'both',
  languages: {
    en: true,
    de: true,
    nl: true,
    fr: true,
    es: true,
    it: true,
    nb: true,
    sv: true,
    da: true,
  },
};

let currentLocale: Locale = 'en';

const dictionaries: Record<Locale, Record<string, any>> = {
  en: enDict,
  de: deDict,
  nl: nlDict,
  fr: frDict,
  es: esDict,
  it: itDict,
  nb: nbDict,
  sv: svDict,
  da: daDict,
};

/**
 * Get language curation settings (Notre Succès standard)
 */
export function getLanguageSettings(): LanguageSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        showSwitcher: parsed.showSwitcher !== false,
        defaultLocale: parsed.defaultLocale || 'en',
        switcherPosition: parsed.switcherPosition || 'both',
        languages: {
          en: parsed.languages?.en !== false,
          de: parsed.languages?.de !== false,
          nl: parsed.languages?.nl !== false,
          fr: parsed.languages?.fr !== false,
          es: parsed.languages?.es !== false,
          it: parsed.languages?.it !== false,
          nb: parsed.languages?.nb !== false,
          sv: parsed.languages?.sv !== false,
          da: parsed.languages?.da !== false,
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
  // Base default fallback cannot be completely disabled
  const base = (settings.defaultLocale as Locale) || 'en';
  settings.languages[base] = true;
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}

  // If current locale is disabled or switcher is off, revert to default locale
  if (!settings.showSwitcher || !settings.languages[currentLocale]) {
    setLocale(base);
  }

  bus.emit('i18n:settings-changed', { settings });
}

/**
 * Check if a given locale is currently enabled
 */
export function isLocaleEnabled(locale: Locale): boolean {
  const settings = getLanguageSettings();
  if (locale === (settings.defaultLocale || 'en')) return true;
  return Boolean(settings.showSwitcher && settings.languages[locale]);
}

/**
 * Initialize locale from localStorage or browser preferences
 */
export function initLocale(): Locale {
  const settings = getLanguageSettings();
  const validCodes = NOTRESUCCES_LOCALES.map((l) => l.code);
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;

  if (saved && validCodes.includes(saved) && isLocaleEnabled(saved)) {
    currentLocale = saved;
  } else {
    // Detect browser language if enabled
    const navLang = navigator.language.slice(0, 2).toLowerCase() as Locale;
    if (validCodes.includes(navLang) && isLocaleEnabled(navLang)) {
      currentLocale = navLang;
    } else {
      currentLocale = (settings.defaultLocale as Locale) || 'en';
    }
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
 * Universal helper to resolve localized text from either a string, a JSON object string, or a dictionary
 */
export function getLocalizedText(
  val: string | Record<string, string> | undefined | null,
  locale: Locale = currentLocale
): string {
  if (!val) return '';
  if (typeof val === 'object') {
    return val[locale] || val['en'] || Object.values(val)[0] || '';
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed[locale] || parsed['en'] || Object.values(parsed)[0] || val;
        }
      } catch {}
    }
    return val;
  }
  return String(val);
}

/**
 * Helper to resolve product description across multilingual translations
 */
export function getProductDesc(
  desc: string | Record<string, string> | undefined,
  locale: Locale = currentLocale
): string {
  return getLocalizedText(desc, locale);
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
