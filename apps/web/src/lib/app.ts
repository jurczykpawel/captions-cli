/**
 * Client controller: wires the DOM to the local pipeline.
 * file -> probe -> transcribe (whisper) -> cues -> live preview + preset
 * picker -> MP4 export. Tier gating + Listmonk email unlock included.
 */
import { probeVideo, checkVideo, decodeAudioMono16k, type VideoMeta } from './media';
import { buildCaptionStage, type CaptionStage } from './captions-renderer';
import { runWhisper } from './whisper';
import type { WhisperModelSize } from './transcribe';
import { groupWordsIntoCues, type Cue, type Word, type PresetInput } from '@captions-cli/core/pure';
import { PRESETS } from '@captions-cli/engine-hf/presets';
import { getExportEngine } from './export';

interface TestHooks {
  /** Replace whisper with a stub (avoids model download in tests). */
  transcribe?: (audio: Float32Array, lang: string) => Promise<Word[]>;
  /** Skip the client-side altcha wait (server still enforces in prod). */
  skipAltcha?: boolean;
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
const UNLOCK_KEY = 'captions:emailUnlocked';

export function initApp() {
  const t = readJson<Dict>('ws-i18n', {});
  const cfg = readJson<{ locale: string; listmonkEndpoint: string; listmonkList: string; buyUrl: string }>(
    'ws-config',
    { locale: 'en', listmonkEndpoint: '', listmonkList: '', buyUrl: '' },
  );

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
  let pendingSlug: string | null = null;
  let raf = 0;

  const tr = (section: string, key: string) => t[section]?.[key] ?? '';
  const fontSize = () => (meta ? Math.round(meta.height * 0.055) : 64);
  const presetInput = (): PresetInput => ({ ...COLORS, fontSize: fontSize() });
  const isUnlocked = () => localStorage.getItem(UNLOCK_KEY) === '1';

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
    presetStep?.setAttribute('hidden', '');
    exportStep?.setAttribute('hidden', '');
    if (transcribeStatus) transcribeStatus.textContent = '';
  }

  function syncScale() {
    if (!stage || !meta) return;
    const scale = stagewrap!.clientWidth / meta.width;
    stage.stage.style.transformOrigin = 'top left';
    stage.stage.style.transform = `scale(${scale})`;
  }

  function mountStage(slug: string) {
    if (!meta || !cues) return;
    if (stage) stage.destroy();
    const build = PRESETS[slug] ?? PRESETS['text'];
    stage = buildCaptionStage({
      parent: stagewrap!,
      cues,
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

  function selectPreset(slug: string, tier: string) {
    if (tier === 'premium') {
      if (cfg.buyUrl) window.open(cfg.buyUrl, '_blank', 'noopener');
      return;
    }
    if (tier === 'basic' && !isUnlocked()) {
      pendingSlug = slug;
      openEmailDialog();
      return;
    }
    mountStage(slug);
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
      mountStage(currentSlug);
      presetStep?.removeAttribute('hidden');
      exportStep?.removeAttribute('hidden');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
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
    exportBtn!.disabled = true;
    if (downloadLink) downloadLink.hidden = true;
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
        buildStage: (parent) =>
          buildCaptionStage({
            parent,
            cues: cues!,
            build: PRESETS[slug] ?? PRESETS['text'],
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
    } catch (err) {
      if (exportStatus) exportStatus.textContent = err instanceof Error ? err.message : String(err);
    } finally {
      exportBtn!.disabled = false;
    }
  }

  // ---- email dialog ----
  const dialog = $<HTMLDialogElement>('email-dialog');
  const emailForm = $<HTMLFormElement>('email-form');
  const emailInput = $<HTMLInputElement>('email-input');
  const tosCheckbox = $<HTMLInputElement>('tos-checkbox');
  const emailStatus = $('email-status');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function openEmailDialog() {
    dialog?.showModal();
  }

  function applyUnlock() {
    localStorage.setItem(UNLOCK_KEY, '1');
    document.querySelectorAll<HTMLElement>('.preset-card[data-tier="basic"]').forEach((c) => {
      c.classList.remove('is-locked');
    });
    dialog?.close();
    if (pendingSlug) {
      mountStage(pendingSlug);
      pendingSlug = null;
    }
  }

  $('email-cancel')?.addEventListener('click', () => dialog?.close());

  emailForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (emailInput?.value ?? '').trim();
    const setS = (s: string) => {
      if (emailStatus) emailStatus.textContent = s;
    };
    if (!EMAIL_RE.test(email)) return setS(tr('email', 'invalid'));
    if (tosCheckbox && !tosCheckbox.checked) return setS(tr('email', 'invalid'));
    const altchaInput = emailForm.querySelector<HTMLInputElement>('input[name="altcha"]');
    const widget = emailForm.querySelector('altcha-widget');
    if (widget && !hooks().skipAltcha && !altchaInput?.value) return setS(tr('email', 'waiting'));
    setS(tr('email', 'submitting'));
    try {
      const res = await fetch(cfg.listmonkEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          list_uuids: [cfg.listmonkList],
          altcha: altchaInput?.value,
          attribs: { source: 'captions.web', locale: cfg.locale },
        }),
      });
      if (res.ok) {
        setS(tr('email', 'success'));
        applyUnlock();
      } else {
        setS(tr('email', 'error'));
      }
    } catch {
      setS(tr('email', 'error'));
    }
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

  // restore unlock state on load
  if (isUnlocked()) {
    document.querySelectorAll<HTMLElement>('.preset-card[data-tier="basic"]').forEach((c) =>
      c.classList.remove('is-locked'),
    );
  }

  window.addEventListener('resize', syncScale);
}
