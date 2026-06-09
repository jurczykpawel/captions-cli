/**
 * Client controller: wires the DOM to the local pipeline.
 * file -> probe -> transcribe (whisper) -> cues -> live preview + preset
 * picker -> MP4 export. Tier gating via a pasted Sellf license token.
 */
import { probeVideo, checkVideo, decodeAudioMono16k, type VideoMeta } from './media';
import { buildCaptionStage, type CaptionStage } from './captions-renderer';
import { runWhisper } from './whisper';
import type { WhisperModelSize } from './transcribe';
import { groupWordsIntoCues, type Cue, type Word, type PresetInput } from '@captions-cli/core/pure';
import { PRESETS } from '@captions-cli/engine-hf/presets';
import type { HfPresetBuilder } from '@captions-cli/engine-hf';
import { getExportEngine } from './export';

interface TestHooks {
  /** Replace whisper with a stub (avoids model download in tests). */
  transcribe?: (audio: Float32Array, lang: string) => Promise<Word[]>;
}
const hooks = (): TestHooks =>
  (window as unknown as { __captionsTestHooks?: TestHooks }).__captionsTestHooks ?? {};

type Dict = Record<string, Record<string, string>>;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

function readJson<T>(id: string, fallback: T): T {
  const el = document.getElementById(id);
  if (!el?.textContent) return fallback;
  try {
    return JSON.parse(el.textContent) as T;
  } catch {
    return fallback;
  }
}

const COLORS = { fontColor: '#ffffff', highlightColor: '#ffca28', upcomingColor: '#9aa3af' };
const CAPTION_TOP_PERCENT = 74;
const EXPORT_FPS = 30;
// One credential now: a Sellf-issued license token. Its `tier` claim decides
// what unlocks (basic vs premium). Cached locally so a return visit stays unlocked.
const TOKEN_KEY = 'captions:token';
const TIER_KEY = 'captions:tier';
const PREMIUM_PACK_KEY = 'captions:premiumPack';
const WATERMARK_TEXT = 'captions.techskills.academy';

interface PremiumPreset {
  slug: string;
  css: string;
  timelineJs?: string;
}

/** Mirror of the server's tier gating (functions/_lib/tiers.ts). */
function allowedTiers(tier: string | null): string[] {
  if (tier === 'premium') return ['basic', 'premium'];
  if (tier === 'basic') return ['basic'];
  return [];
}

export function initApp() {
  const t = readJson<Dict>('ws-i18n', {});
  const cfg = readJson<{ locale: string; buyUrl: string }>('ws-config', { locale: 'en', buyUrl: '' });

  const fileInput = $<HTMLInputElement>('file-input');
  const dropzone = document.querySelector<HTMLElement>('[data-dropzone]');
  const uploadCard = $('upload-card');
  const uploadError = $('upload-error');
  const workspace = $('workspace');
  const video = $<HTMLVideoElement>('preview-video');
  const stagewrap = $('stagewrap');
  const playBtn = $<HTMLButtonElement>('play-btn');
  const transcribeBtn = $<HTMLButtonElement>('transcribe-btn');
  const modelSelect = $<HTMLSelectElement>('model-select');
  const langSelect = $<HTMLSelectElement>('lang-select');
  const transcribeStatus = $('transcribe-status');
  const presetStep = $('preset-step');
  const exportStep = $('export-step');
  const exportBtn = $<HTMLButtonElement>('export-btn');
  const exportProgress = $<HTMLProgressElement>('export-progress');
  const exportStatus = $('export-status');
  const downloadLink = $<HTMLAnchorElement>('download-link');
  const changeVideoBtn = $('change-video-btn');

  if (!fileInput || !video || !stagewrap || !workspace) return;

  let file: File | null = null;
  let meta: VideoMeta | null = null;
  let cues: Cue[] | null = null;
  let stage: CaptionStage | null = null;
  let currentSlug = 'text';
  let currentTier = 'free';
  let raf = 0;

  // Bundled styles (free + basic) plus premium styles loaded at runtime from the
  // gated /api/premium endpoint. Premium is NEVER in the static build.
  const premiumBuilders: Record<string, HfPresetBuilder> = {};
  // Public, css-only previews of premium styles (the look, not the animation
  // and not the renderable preset). Used so buyers can preview on their video.
  const previewBuilders: Record<string, HfPresetBuilder> = {};
  const getBuilder = (slug: string): HfPresetBuilder =>
    PRESETS[slug] ?? premiumBuilders[slug] ?? previewBuilders[slug] ?? PRESETS['text'];
  function registerPremium(list: PremiumPreset[]) {
    for (const p of list) {
      premiumBuilders[p.slug] = () => ({ css: p.css, timelineJs: p.timelineJs });
    }
  }
  function registerPreviews(list: { slug: string; css: string }[]) {
    for (const p of list) previewBuilders[p.slug] = () => ({ css: p.css });
  }
  async function loadPreviews() {
    try {
      const res = await fetch('/premium-previews.json');
      if (!res.ok) return;
      registerPreviews((await res.json()) as { slug: string; css: string }[]);
      if (currentTier === 'premium' && !premiumBuilders[currentSlug] && previewBuilders[currentSlug]) {
        previewPreset(currentSlug, currentTier);
      }
    } catch {
      /* no previews available (e.g. free build) */
    }
  }

  const tr = (section: string, key: string) => t[section]?.[key] ?? '';
  const fontSize = () => (meta ? Math.round(meta.height * 0.055) : 64);
  const presetInput = (): PresetInput => ({ ...COLORS, fontSize: fontSize() });

  // Sample caption used to preview a style before the user has transcribed.
  function exampleCues(): Cue[] {
    const w: [string, number, number][] =
      cfg.locale === 'pl'
        ? [['Tak', 0, 0.5], ['będą', 0.5, 0.9], ['wyglądać', 0.9, 1.6], ['Twoje', 1.6, 2.1], ['napisy', 2.1, 2.8]]
        : [['This', 0, 0.45], ['is', 0.45, 0.7], ['your', 0.7, 1.05], ['caption', 1.05, 1.7], ['style', 1.7, 2.4]];
    return [
      {
        id: 'example',
        text: w.map((x) => x[0]).join(' '),
        startTime: 0,
        endTime: w[w.length - 1][2],
        words: w.map(([text, startTime, endTime]) => ({ text, startTime, endTime })),
      },
    ];
  }

  function showUploadError(msg: string) {
    if (!uploadError) return;
    uploadError.textContent = msg;
    uploadError.hidden = false;
  }

  async function onFile(f: File) {
    if (uploadError) uploadError.hidden = true;
    let probe: VideoMeta;
    try {
      probe = await probeVideo(f);
    } catch {
      showUploadError(tr('upload', 'invalid'));
      return;
    }
    const check = checkVideo({ type: f.type, durationSeconds: probe.durationSeconds });
    if (!check.ok) {
      showUploadError(check.reason === 'too-long' ? tr('upload', 'tooLong') : tr('upload', 'invalid'));
      URL.revokeObjectURL(probe.url);
      return;
    }
    file = f;
    meta = probe;
    cues = null;
    video!.src = probe.url;
    stagewrap!.style.aspectRatio = `${probe.width} / ${probe.height}`;
    uploadCard?.setAttribute('hidden', '');
    workspace!.removeAttribute('hidden');
    presetStep?.removeAttribute('hidden');
    exportStep?.setAttribute('hidden', '');
    if (transcribeStatus) transcribeStatus.textContent = '';
    previewPreset(currentSlug, currentTier);
  }

  function syncScale() {
    if (!stage || !meta) return;
    const scale = stagewrap!.clientWidth / meta.width;
    stage.stage.style.transformOrigin = 'top left';
    stage.stage.style.transform = `scale(${scale})`;
  }

  function mountStage(slug: string, useCues: Cue[] | null = cues) {
    if (!meta || !useCues || useCues.length === 0) return;
    if (stage) stage.destroy();
    const build = getBuilder(slug);
    stage = buildCaptionStage({
      parent: stagewrap!,
      cues: useCues,
      build,
      preset: presetInput(),
      width: meta.width,
      height: meta.height,
      captionTopPercent: CAPTION_TOP_PERCENT,
    });
    stage.stage.style.position = 'absolute';
    stage.stage.style.top = '0';
    stage.stage.style.left = '0';
    syncScale();
    stage.seek(video!.currentTime);
    currentSlug = slug;
    document.querySelectorAll<HTMLElement>('.preset-card').forEach((c) => {
      c.classList.toggle('is-active', c.dataset.slug === slug);
    });
  }

  function previewPreset(slug: string, tier: string) {
    const usingExample = !cues;
    mountStage(slug, cues ?? exampleCues());
    currentSlug = slug;
    currentTier = tier;
    if (usingExample && stage) {
      stage.timeline.repeat(-1).repeatDelay(0.6);
      stage.timeline.play();
    }
  }

  // The granted tier comes from the verified token. Free is always clean; basic
  // and premium are watermarked until a token grants them.
  const grantedTier = () => localStorage.getItem(TIER_KEY) || '';
  const allowedNow = () => new Set(allowedTiers(grantedTier()));
  function shouldWatermark(): boolean {
    if (currentTier === 'free') return false;
    return !allowedNow().has(currentTier);
  }

  function selectPreset(slug: string, tier: string) {
    // Locked premium without a real builder yet: preview the LOOK (css-only) and
    // nudge to the unlock panel.
    if (tier === 'premium' && !premiumBuilders[slug]) {
      const status = $('premium-status');
      if (previewBuilders[slug]) {
        previewPreset(slug, tier);
        if (status) status.textContent = tr('premium', 'previewHint');
      } else if (status) {
        status.textContent = tr('premium', 'needPack');
      }
      $('premium-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    previewPreset(slug, tier);
  }

  async function transcribe() {
    if (!file || !meta) return;
    transcribeBtn!.disabled = true;
    const setStatus = (s: string) => {
      if (transcribeStatus) transcribeStatus.textContent = s;
    };
    try {
      setStatus(tr('transcribe', 'transcribing'));
      const audio = await decodeAudioMono16k(file);
      const lang = (langSelect?.value as 'en' | 'pl') ?? 'en';
      let words: Word[];
      const hook = hooks().transcribe;
      if (hook) {
        words = await hook(audio, lang);
      } else {
        words = await runWhisper({
          audio,
          language: lang,
          model: (modelSelect?.value as WhisperModelSize) ?? 'base',
          onProgress: (p) =>
            setStatus(
              p.stage === 'loading-model'
                ? tr('transcribe', 'loadingModel') + (p.fraction ? ` ${Math.round(p.fraction * 100)}%` : '')
                : tr('transcribe', 'transcribing'),
            ),
        });
      }
      cues = groupWordsIntoCues(words);
      setStatus(tr('transcribe', 'ready'));
      mountStage(currentSlug); // real cues now; replaces the looping example
      exportStep?.removeAttribute('hidden');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      // Re-enable so the user can re-generate after changing model/language/video.
      transcribeBtn!.disabled = false;
    }
  }

  async function exportVideo() {
    if (!file || !meta || !cues) return;
    const engine = getExportEngine();
    if (!engine) {
      if (exportStatus) exportStatus.textContent = tr('exportUi', 'unsupported');
      return;
    }
    const watermark = shouldWatermark();
    exportBtn!.disabled = true;
    if (downloadLink) downloadLink.hidden = true;
    hideUnlockCta();
    if (exportProgress) {
      exportProgress.hidden = false;
      exportProgress.value = 0;
    }
    if (exportStatus) exportStatus.textContent = tr('exportUi', 'rendering');
    try {
      const slug = currentSlug;
      const result = await engine.export({
        file,
        width: meta.width,
        height: meta.height,
        durationSeconds: meta.durationSeconds,
        fps: EXPORT_FPS,
        watermark,
        watermarkText: WATERMARK_TEXT,
        buildStage: (parent) =>
          buildCaptionStage({
            parent,
            cues: cues!,
            build: getBuilder(slug),
            preset: presetInput(),
            width: meta!.width,
            height: meta!.height,
            captionTopPercent: CAPTION_TOP_PERCENT,
          }),
        onProgress: (f) => {
          if (exportProgress) exportProgress.value = f;
        },
      });
      const url = URL.createObjectURL(result.blob);
      if (downloadLink) {
        downloadLink.href = url;
        downloadLink.download = `captions.${result.extension}`;
        downloadLink.hidden = false;
      }
      if (exportStatus) exportStatus.textContent = tr('exportUi', 'done');
      if (watermark) showUnlockCta();
    } catch (err) {
      if (exportStatus) exportStatus.textContent = err instanceof Error ? err.message : String(err);
    } finally {
      exportBtn!.disabled = false;
    }
  }

  // Offer to unlock (remove the watermark) after a gated export. Both basic and
  // premium are obtained the same way now — a Sellf token — so the CTA just sends
  // the user to the unlock panel.
  const unlockCta = $('unlock-cta');
  const unlockText = $('unlock-text');
  const unlockBtn = $<HTMLButtonElement>('unlock-btn');
  function hideUnlockCta() {
    unlockCta?.setAttribute('hidden', '');
  }
  function showUnlockCta() {
    if (!unlockCta) return;
    const premium = currentTier === 'premium';
    if (unlockText) unlockText.textContent = premium ? tr('unlock', 'premiumText') : tr('unlock', 'basicText');
    if (unlockBtn) unlockBtn.textContent = tr('premium', 'unlockBtn');
    unlockCta.removeAttribute('hidden');
  }
  unlockBtn?.addEventListener('click', () => {
    $('premium-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  // ---- token unlock (paste the Sellf license token; tier decides what unlocks) ----
  const tokenInput = $<HTMLInputElement>('premium-token');
  const unlockBtnEl = $<HTMLButtonElement>('unlock-premium-btn');
  const downloadCliLink = $<HTMLAnchorElement>('download-cli-link');
  const premiumStatus = $('premium-status');

  function unlockCards(selector: string, animate: boolean) {
    document.querySelectorAll<HTMLElement>(selector).forEach((c) => {
      if (!c.classList.contains('is-locked')) return;
      c.classList.remove('is-locked');
      if (animate) {
        c.classList.add('just-unlocked');
        c.addEventListener('animationend', () => c.classList.remove('just-unlocked'), { once: true });
      }
    });
  }

  function applyTierUnlock(tier: string | null, token: string, opts?: { animate?: boolean }) {
    const animate = opts?.animate ?? false;
    const allowed = new Set(allowedTiers(tier));
    if (allowed.has('basic')) {
      unlockCards('.preset-card[data-tier="basic"]', animate);
    }
    if (allowed.has('premium')) {
      unlockCards('.preset-card[data-tier="premium"]', animate);
      if (downloadCliLink) {
        downloadCliLink.href = `/api/premium-zip?token=${encodeURIComponent(token)}`;
        downloadCliLink.hidden = false;
      }
    }
  }

  // Drop all unlocked state and re-lock the UI. Called when the worker
  // definitively rejects a previously-stored token (revoked / expired).
  function revokeUnlock() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TIER_KEY);
    localStorage.removeItem(PREMIUM_PACK_KEY);
    for (const k of Object.keys(premiumBuilders)) delete premiumBuilders[k];
    document
      .querySelectorAll<HTMLElement>('.preset-card[data-tier="basic"], .preset-card[data-tier="premium"]')
      .forEach((c) => c.classList.add('is-locked'));
    if (downloadCliLink) downloadCliLink.hidden = true;
    if (cues) previewPreset(currentSlug, currentTier); // watermark returns
  }

  async function unlockToken(token: string, opts?: { silent?: boolean }): Promise<boolean> {
    const setS = (s: string) => {
      if (premiumStatus && !opts?.silent) premiumStatus.textContent = s;
    };
    try {
      const res = await fetch('/api/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        // A stored token the worker now rejects (revoked/expired) must lose
        // access on this refresh. A freshly pasted bad token only reports —
        // never nuke an existing unlock over a typo. Transient 5xx/offline
        // (caught below) also keep the optimistic state.
        if (opts?.silent && res.status === 403) revokeUnlock();
        setS(tr('premium', 'notFound'));
        return false;
      }
      const data = (await res.json()) as { tier: string | null; presets: PremiumPreset[] };
      registerPremium(data.presets);
      localStorage.setItem(PREMIUM_PACK_KEY, JSON.stringify(data.presets));
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TIER_KEY, data.tier ?? '');
      applyTierUnlock(data.tier, token, { animate: !opts?.silent });
      hideUnlockCta();
      setS(tr('premium', data.tier === 'premium' ? 'loaded' : 'loadedBasic'));
      if (cues) previewPreset(currentSlug, currentTier);
      return true;
    } catch {
      setS(tr('premium', 'error'));
      return false;
    }
  }

  unlockBtnEl?.addEventListener('click', () => {
    const token = (tokenInput?.value ?? '').trim();
    if (!token) {
      if (premiumStatus) premiumStatus.textContent = tr('premium', 'badKey');
      return;
    }
    void unlockToken(token);
  });

  // ---- preview playback ----
  function tick() {
    if (stage && video && !video.paused) {
      stage.seek(video.currentTime);
      raf = requestAnimationFrame(tick);
    }
  }
  video.addEventListener('play', () => {
    if (playBtn) playBtn.textContent = tr('ws', 'pause');
    raf = requestAnimationFrame(tick);
  });
  video.addEventListener('pause', () => {
    if (playBtn) playBtn.textContent = tr('ws', 'play');
    cancelAnimationFrame(raf);
  });
  video.addEventListener('seeked', () => stage?.seek(video.currentTime));
  playBtn?.addEventListener('click', () => {
    if (video.paused) void video.play();
    else video.pause();
  });

  // ---- wiring ----
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) void onFile(f);
  });
  if (dropzone) {
    ['dragenter', 'dragover'].forEach((ev) =>
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.setAttribute('data-drag', '');
      }),
    );
    ['dragleave', 'drop'].forEach((ev) =>
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.removeAttribute('data-drag');
      }),
    );
    dropzone.addEventListener('drop', (e) => {
      const f = (e as DragEvent).dataTransfer?.files?.[0];
      if (f) void onFile(f);
    });
  }
  transcribeBtn?.addEventListener('click', () => void transcribe());
  exportBtn?.addEventListener('click', () => void exportVideo());
  changeVideoBtn?.addEventListener('click', () => {
    workspace!.setAttribute('hidden', '');
    uploadCard?.removeAttribute('hidden');
    if (stage) {
      stage.destroy();
      stage = null;
    }
  });
  document.querySelectorAll<HTMLElement>('.preset-card').forEach((card) => {
    card.addEventListener('click', () => selectPreset(card.dataset.slug ?? 'text', card.dataset.tier ?? 'free'));
  });

  // Polish is much better on the small model; default to it for PL (user can
  // still override).
  const syncModelToLang = () => {
    if (modelSelect && langSelect) modelSelect.value = langSelect.value === 'pl' ? 'small' : 'base';
  };
  langSelect?.addEventListener('change', syncModelToLang);
  syncModelToLang();

  void loadPreviews();

  // Restore unlock state on load from the cached token + pack.
  const savedToken = localStorage.getItem(TOKEN_KEY);
  const savedPack = localStorage.getItem(PREMIUM_PACK_KEY);
  const savedTier = localStorage.getItem(TIER_KEY);
  if (savedToken) {
    if (savedPack) {
      try {
        registerPremium(JSON.parse(savedPack) as PremiumPreset[]);
      } catch {
        /* ignore a corrupt saved pack */
      }
    }
    applyTierUnlock(savedTier, savedToken);
    // Re-validate online so a revoked/expired token loses access.
    void unlockToken(savedToken, { silent: true });
  }

  window.addEventListener('resize', syncScale);
}
