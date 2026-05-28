/**
 * app.js — wire the form to the preview + TS exporter. Pure DOM, no
 * framework. Reads every input on every change, rebuilds preview + ts,
 * stores form state in localStorage so reopening the page keeps your
 * work-in-progress.
 */
const FIELDS = [
  'slug', 'description', 'tier',
  'fontSize', 'bold', 'italic', 'spacing', 'transform',
  'fontColor', 'highlightColor', 'upcomingColor',
  'borderStyle', 'outlineWidth', 'outlineColor', 'shadowDepth',
  'activeScale', 'activeBord', 'activeOutlineHighlight', 'activeFillDark', 'activeUnderline',
  'position',
];

function readState() {
  const s = {};
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (!el) continue;
    if (el.type === 'checkbox') s[f] = el.checked;
    else s[f] = el.value;
  }
  // Numeric coercion for the fields the preview math wants as numbers.
  for (const k of ['fontSize', 'spacing', 'outlineWidth', 'shadowDepth', 'activeScale', 'activeBord', 'position']) {
    if (s[k] !== undefined) s[k] = Number(s[k]);
  }
  return s;
}

function writeState(s) {
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (!el || s[f] === undefined) continue;
    if (el.type === 'checkbox') el.checked = !!s[f];
    else el.value = s[f];
  }
}

function applyCss(el, css) {
  for (const [k, v] of Object.entries(css)) {
    el.style[k] = v;
  }
}

function rerender() {
  const state = readState();
  // Update slider value labels.
  document.getElementById('activeScaleVal').textContent = state.activeScale + '%';
  document.getElementById('positionVal').textContent = state.position + '%';

  // Preview line.
  const { lineCss, words } = window.assToCss.buildPreview(state);
  const line = document.getElementById('previewLine');
  line.innerHTML = '';
  applyCss(line, lineCss);
  for (const w of words) {
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = w.text;
    applyCss(span, w.css);
    line.appendChild(span);
  }

  // TS export.
  const ts = window.template.buildTs(state);
  document.getElementById('tsOutput').textContent = ts;

  // Persist to localStorage so reload keeps your work.
  try { localStorage.setItem('captions-studio-state', JSON.stringify(state)); } catch {}
}

function downloadTs() {
  const state = readState();
  const ts = window.template.buildTs(state);
  const blob = new Blob([ts], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.slug || 'preset'}.ts`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: older browser / file:// without clipboard permission.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
    return false;
  }
}

function init() {
  // Restore prior session.
  try {
    const raw = localStorage.getItem('captions-studio-state');
    if (raw) writeState(JSON.parse(raw));
  } catch {}

  // Wire all inputs.
  for (const f of FIELDS) {
    const el = document.getElementById(f);
    if (el) el.addEventListener('input', rerender);
  }

  document.getElementById('downloadTs').addEventListener('click', downloadTs);
  document.getElementById('copyTs').addEventListener('click', async () => {
    const state = readState();
    await copyText(window.template.buildTs(state));
    flash('copyTs', 'Copied!');
  });
  document.getElementById('copyCli').addEventListener('click', async () => {
    const state = readState();
    await copyText(`captions video.mp4 --preset ${state.slug} --color "${state.highlightColor}" --position ${state.position}`);
    flash('copyCli', 'Copied!');
  });

  rerender();
}

function flash(buttonId, msg) {
  const btn = document.getElementById(buttonId);
  const orig = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = orig; }, 1200);
}

document.addEventListener('DOMContentLoaded', init);
