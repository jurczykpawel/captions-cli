export type Locale = 'en' | 'pl';

export interface Dict {
  meta: { title: string; description: string };
  hero: { badge: string; title: string; subtitle: string; cta: string; secondary: string };
  privacy: { heading: string; local: string; noUpload: string; noStore: string };
  steps: { heading: string; one: string; two: string; three: string };
  upload: {
    drop: string;
    browse: string;
    hint: string;
    tooLong: string;
    invalid: string;
    selected: string;
  };
  presets: {
    heading: string;
    free: string;
    basic: string;
    premium: string;
    locked: string;
    unlock: string;
    buy: string;
  };
  email: {
    heading: string;
    desc: string;
    placeholder: string;
    submit: string;
    submitting: string;
    success: string;
    error: string;
    invalid: string;
    waiting: string;
    consentPrefix: string;
    tos: string;
    and: string;
    privacy: string;
  };
  exportUi: {
    heading: string;
    button: string;
    rendering: string;
    cancel: string;
    done: string;
    download: string;
    unsupported: string;
  };
  transcribe: { loadingModel: string; transcribing: string; ready: string };
  unlock: { basicText: string; premiumText: string; mailBtn: string; buyBtn: string };
  ws: {
    generate: string;
    generating: string;
    model: string;
    language: string;
    play: string;
    pause: string;
    style: string;
    exportNote: string;
    premiumTeaser: string;
    changeVideo: string;
    needCaptionsFirst: string;
    loadPack: string;
    getPremium: string;
  };
  premium: { panelHeading: string; panelBody: string; needPack: string; loading: string; loaded: string; error: string };
  cli: { heading: string; body: string; cta: string };
  footer: { tagline: string; madeBy: string; brand: string; tos: string; privacy: string; source: string };
  legal: { privacyTitle: string; termsTitle: string; back: string };
}

import { en } from './en';
import { pl } from './pl';

const DICTS: Record<Locale, Dict> = { en, pl };

export function getDict(locale: Locale): Dict {
  return DICTS[locale] ?? en;
}

/** Locale-aware path: en stays at root, pl is prefixed with /pl. */
export function localePath(locale: Locale, path = ''): string {
  const clean = path.replace(/^\//, '');
  const base = locale === 'en' ? '' : '/pl';
  return clean ? `${base}/${clean}` : base || '/';
}
