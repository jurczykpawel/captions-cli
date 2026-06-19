import ccStyles from "vanilla-cookieconsent/dist/cookieconsent.css?inline";
import * as CC from "vanilla-cookieconsent";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
    __captions_gtm_id?: string;
    __captions_gtm_loaded?: boolean;
  }
}

type ConsentCookie = { categories?: string[] };

const LS_KEY = "captions_cc_v1";
const COOKIE_NAME = "captions_consent";

const saveConsentToStorage = (cats: string[]) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cats));
  } catch {
    /* ignore */
  }
};

const loadConsentFromStorage = (): string[] | null => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const restoreConsentCookie = (cats: string[]) => {
  try {
    const now = new Date().toISOString();
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    const id =
      typeof crypto !== "undefined" &&
      typeof (crypto as Crypto & { randomUUID?: () => string }).randomUUID === "function"
        ? (crypto as Crypto & { randomUUID: () => string }).randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const data = {
      categories: cats,
      revision: 0,
      data: null,
      consentTimestamp: now,
      consentId: id,
      services: {},
      languageCode: detectLang(),
      lastConsentTimestamp: now,
    };
    const { hostname, protocol } = window.location;
    let cookie = `${COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify(data),
    )}; expires=${exp.toUTCString()}; Path=/; SameSite=Lax`;
    if (hostname.includes(".")) cookie += `; Domain=${hostname}`;
    if (protocol === "https:") cookie += "; Secure";
    document.cookie = cookie;
  } catch {
    /* ignore */
  }
};

function detectLang(): "pl" | "en" {
  const lang = document.documentElement.lang?.toLowerCase() || "";
  return lang.startsWith("pl") ? "pl" : "en";
}

function loadGtm() {
  if (window.__captions_gtm_loaded) return;
  const id = window.__captions_gtm_id;
  if (!id) return;
  window.__captions_gtm_loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  const first = document.getElementsByTagName("script")[0];
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtm.js?id=" + id;
  first.parentNode?.insertBefore(s, first);
}

const updateGtag = (cookie: ConsentCookie) => {
  const cats = cookie.categories || [];
  const has = (c: string) => cats.includes(c);
  saveConsentToStorage(cats);
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: has("analytics") ? "granted" : "denied",
      ad_storage: has("marketing") ? "granted" : "denied",
      ad_user_data: has("marketing") ? "granted" : "denied",
      ad_personalization: has("marketing") ? "granted" : "denied",
      functionality_storage: "granted",
      security_storage: "granted",
    });
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "cookieconsent_change",
    cookie_categories: cats,
    source_brand: "captions",
  });
  if (has("analytics") || has("marketing")) {
    loadGtm();
  }
};

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const tag = document.createElement("style");
  tag.setAttribute("data-cc-styles", "");
  tag.textContent = ccStyles;
  document.head.appendChild(tag);
}

export async function initCookieConsent() {
  ensureStyles();

  const storedCategories = loadConsentFromStorage();
  const hasCCCookie = document.cookie.includes(COOKIE_NAME + "=");

  if (storedCategories && !hasCCCookie) {
    restoreConsentCookie(storedCategories);
  }

  await CC.run({
    cookie: {
      name: COOKIE_NAME,
      expiresAfterDays: 365,
      sameSite: "Lax",
      path: "/",
    },
    autoShow: !storedCategories,
    guiOptions: {
      consentModal: {
        layout: "box",
        position: "bottom right",
        equalWeightButtons: true,
        flipButtons: false,
      },
      preferencesModal: {
        layout: "box",
        position: "right",
        equalWeightButtons: true,
        flipButtons: false,
      },
    },
    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
      },
      analytics: {
        enabled: false,
        autoClear: {
          cookies: [{ name: /^_ga/ }, { name: "_gid" }],
        },
      },
      marketing: {
        enabled: false,
        autoClear: {
          cookies: [{ name: "_fbp" }, { name: "_fbc" }],
        },
      },
    },
    language: {
      default: detectLang(),
      autoDetect: "document",
      translations: {
        en: {
          consentModal: {
            title: "Cookies & privacy",
            description:
              "We use cookies only for anonymous analytics, so we can see what works. No ad tracking. You can change your choice anytime.",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject all",
            showPreferencesBtn: "Manage preferences",
            footer: '<a href="/privacy">Privacy policy</a>',
          },
          preferencesModal: {
            title: "Cookie preferences",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject all",
            savePreferencesBtn: "Save preferences",
            closeIconLabel: "Close",
            sections: [
              {
                title: "How we use cookies",
                description:
                  "We only use cookies for anonymous analytics so we can see what works. No cross-site or ad tracking. You decide.",
              },
              {
                title: "Strictly necessary",
                description:
                  "Required for the site to function (consent storage, language preference). Always on.",
                linkedCategory: "necessary",
              },
              {
                title: "Analytics",
                description:
                  "Google Analytics 4 (server-side, first-party) and Umami self-hosted. GA4 stores `_ga` (24 months) and `_gid` (24 hours). Umami is cookieless. No cross-site tracking.",
                linkedCategory: "analytics",
              },
              {
                title: "Marketing",
                description:
                  "Meta Pixel — ad measurement and audience building (remarketing), _fbp/_fbc cookies.",
                linkedCategory: "marketing",
              },
              {
                title: "More info",
                description:
                  'Questions? Email <a href="mailto:kontakt@techskills.academy">kontakt@techskills.academy</a> or see the <a href="/privacy">privacy policy</a>.',
              },
            ],
          },
        },
        pl: {
          consentModal: {
            title: "Pliki cookie i prywatność",
            description:
              "Używamy plików cookie wyłącznie do anonimowej analityki, żeby wiedzieć, co działa. Bez śledzenia reklamowego. Wybór możesz zmienić w każdej chwili.",
            acceptAllBtn: "Akceptuj wszystkie",
            acceptNecessaryBtn: "Odrzuć wszystkie",
            showPreferencesBtn: "Zarządzaj preferencjami",
            footer: '<a href="/pl/privacy">Polityka prywatności</a>',
          },
          preferencesModal: {
            title: "Preferencje plików cookie",
            acceptAllBtn: "Akceptuj wszystkie",
            acceptNecessaryBtn: "Odrzuć wszystkie",
            savePreferencesBtn: "Zapisz preferencje",
            closeIconLabel: "Zamknij",
            sections: [
              {
                title: "Jak używamy plików cookie",
                description:
                  "Używamy plików cookie wyłącznie do anonimowej analityki, żeby wiedzieć, co działa. Bez śledzenia między witrynami ani reklamowego. Ty decydujesz.",
              },
              {
                title: "Niezbędne",
                description:
                  "Wymagane do działania strony (zapis zgody, preferencja języka). Zawsze włączone.",
                linkedCategory: "necessary",
              },
              {
                title: "Analityka",
                description:
                  "Google Analytics 4 (server-side, first-party) i self-hosted Umami. GA4 zapisuje `_ga` (24 miesiące) i `_gid` (24 godziny). Umami działa bez cookie. Brak śledzenia między witrynami.",
                linkedCategory: "analytics",
              },
              {
                title: "Marketing",
                description:
                  "Meta Pixel — pomiar skuteczności reklam i budowanie grup odbiorców (remarketing), cookies _fbp/_fbc.",
                linkedCategory: "marketing",
              },
              {
                title: "Więcej informacji",
                description:
                  'Pytania? Napisz na <a href="mailto:kontakt@techskills.academy">kontakt@techskills.academy</a> lub zajrzyj do <a href="/pl/privacy">polityki prywatności</a>.',
              },
            ],
          },
        },
      },
    },
    onFirstConsent: ({ cookie }) => updateGtag(cookie as ConsentCookie),
    onConsent: ({ cookie }) => updateGtag(cookie as ConsentCookie),
    onChange: ({ cookie }) => updateGtag(cookie as ConsentCookie),
  });

  if (storedCategories && !CC.validConsent()) {
    CC.acceptCategory(storedCategories as string[]);
  }
}

export function showCookiePreferences() {
  ensureStyles();
  CC.showPreferences();
}
