/**
 * ass-to-css.js — render a preset's "active word in context" preview using
 * pure CSS that approximates how libass would draw the same ASS preset.
 *
 * Inputs: a state object with fields the form binds to (slug, fontSize,
 * fontColor, highlightColor, outlineWidth, outlineColor, activeScale,
 * activeBord, activeOutlineHighlight, activeFillDark, etc).
 * Output: returns { lineCss, words: [{ text, css }] } — the caller drops
 * each word into a <span class="word"> with the per-word CSS.
 *
 * Mapping conventions (libass → CSS):
 *   - Outline N (PrimaryColour:OutlineColour) → text-shadow stack with
 *     8 directional offsets at distance N, each in OutlineColour. This
 *     is the closest CSS gets to libass's stroke render.
 *   - BorderStyle 1 → just text-shadow (above)
 *   - BorderStyle 4 → background-color on the line + smaller text-shadow
 *   - \fscx/\fscy → transform: scale(N/100) (uniform if both)
 *   - Bold → font-weight: 700
 *   - Italic → font-style: italic
 *   - text-transform → CSS text-transform
 *   - letter-spacing → CSS letter-spacing (px)
 *   - shadowDepth → additional text-shadow at offset (N, N) in 50%-black
 */

function outlineStack(width, color) {
  if (!width || width <= 0) return 'none';
  // 8 cardinal + intercardinal directions for a smoother edge than 4-pt.
  const w = width;
  const offsets = [
    [-w, -w], [0, -w], [w, -w],
    [-w,  0],          [w,  0],
    [-w,  w], [0,  w], [w,  w],
  ];
  return offsets.map(([x, y]) => `${x}px ${y}px 0 ${color}`).join(', ');
}

function combineShadows(...stacks) {
  return stacks.filter((s) => s && s !== 'none').join(', ');
}

function buildPreview(state) {
  // Three-word line — keeps it on a single row at typical font sizes,
  // matches what real captions look like (one cue ≈ 3-5 words). One past,
  // one active, one upcoming so all three states render simultaneously.
  const sentence = ['past', 'active', 'upcoming'];
  const activeIndex = 1;

  // Outline width clamped down for the preview because the frame is
  // ~360 px wide vs 1080 in real video. Actual ASS render uses the raw
  // value; preview just scales for readability.
  const previewScale = 0.45;
  const previewOutline = Math.max(1, Math.round(state.outlineWidth * previewScale));
  const previewActiveBord = Math.max(1, Math.round((state.activeBord ?? state.outlineWidth) * previewScale));
  const previewShadow = state.shadowDepth > 0 ? Math.max(1, Math.round(state.shadowDepth * previewScale)) : 0;

  const baseShadow = outlineStack(previewOutline, state.outlineColor);
  const drop = previewShadow > 0
    ? `${previewShadow}px ${previewShadow}px 0 rgba(0,0,0,0.5)`
    : null;

  const baseTextShadow = combineShadows(baseShadow, drop) || 'none';

  // Line-level CSS: typography, position, optional bg bar (BorderStyle 4).
  const lineCss = {
    fontSize: `${Math.round(state.fontSize * previewScale)}px`,
    fontWeight: state.bold === '-1' ? 700 : 400,
    fontStyle: state.italic === '-1' ? 'italic' : 'normal',
    letterSpacing: `${state.spacing * 0.4}px`,
    textTransform: state.transform === 'none' ? 'none' : state.transform,
    top: `${state.position}%`,
    transform: 'translateY(-50%)',
    color: state.fontColor,
    textShadow: baseTextShadow,
    padding: state.borderStyle === '4' ? '6px 12px' : '0',
    background: state.borderStyle === '4' ? 'rgba(0,0,0,0.85)' : 'transparent',
    display: 'inline-block',
    left: '50%',
    marginLeft: 'auto',
    marginRight: 'auto',
    width: 'auto',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  };

  const words = sentence.map((text, idx) => {
    const css = {
      display: 'inline-block',
      transformOrigin: 'center bottom',
    };
    if (idx === activeIndex) {
      // Active state. Resolve fill + outline carefully to avoid the trap
      // where both end up the same colour (amber fill + amber outline =
      // unreadable blob).
      const activeOutlineColor = state.activeOutlineHighlight ? state.highlightColor : state.outlineColor;
      const fill = state.activeFillDark ? '#000000' : state.highlightColor;
      // If fill === outline colour, drop the outline so the glyph reads.
      const effectiveOutline = (fill.toLowerCase() === activeOutlineColor.toLowerCase())
        ? 0
        : previewActiveBord;
      const activeShadow = combineShadows(outlineStack(effectiveOutline, activeOutlineColor), drop);

      Object.assign(css, {
        color: fill,
        textShadow: activeShadow || 'none',
        transform: state.activeScale != 100 ? `scale(${state.activeScale / 100})` : 'none',
        textDecoration: state.activeUnderline ? `underline ${state.highlightColor}` : 'none',
        textDecorationThickness: state.activeUnderline ? '3px' : 'auto',
        textUnderlineOffset: state.activeUnderline ? '3px' : 'auto',
      });
    } else if (idx > activeIndex) {
      css.color = state.upcomingColor;
    }
    return { text, css };
  });

  return { lineCss, words };
}

window.assToCss = { buildPreview, outlineStack };
