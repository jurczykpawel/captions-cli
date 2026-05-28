/**
 * Rasterize the (GSAP-animated) caption DOM to a canvas, caching by a cheap
 * signature so we only re-rasterize when the visual actually changes. GSAP
 * writes inline styles onto the elements, so they appear in innerHTML — a
 * static caption span yields a cache hit, an animating one a cache miss.
 */
import { snapdom } from '@zumer/snapdom';

export interface CaptionRasterizer {
  frame(): Promise<HTMLCanvasElement | null>;
}

export function createCaptionRasterizer(stage: HTMLElement): CaptionRasterizer {
  let lastSig = '';
  let lastCanvas: HTMLCanvasElement | null = null;

  return {
    async frame() {
      const sig = stage.innerHTML;
      if (sig === lastSig && lastCanvas) return lastCanvas;
      const canvas = await snapdom.toCanvas(stage, { backgroundColor: 'transparent' });
      lastSig = sig;
      lastCanvas = canvas;
      return canvas;
    },
  };
}
