/* The #1 match card takes its colour from the winning breed's own photo.

   The job is not "find the average pixel". Averaging a golden Labrador on a green lawn gives olive —
   the mean of two hues is a colour that appears nowhere in the picture. So instead we find the single
   strongest FAMILY of hues and use that:

     1. Draw the photo tiny (36x36) and walk the pixels.
     2. Sort them into 24 hue buckets, weighting each pixel by how colourful it is (s², so washed-out
        greys barely count) and by how central it is (the dog is in the middle; the lawn is at the edges).
     3. Take the heaviest bucket together with its two neighbours — a hue family straddling a bucket
        boundary would otherwise be split in half — and average only those.
     4. Give it brand-strength saturation.
     5. Drop the lightness until white text on it clears WCAG AA (4.5:1). This is the part that must not
        be "tuned by eye" later: the text has to stay readable on every photo we ever add.

   Everything is same-origin (/assets/...), so the canvas is never tainted. If anything at all goes
   wrong the caller gets null and keeps the brand orange.

   HOW TO EDIT
   - How colourful the cards are: SAT_MIN / SAT_MAX.
   - How dark they go: MIN_CONTRAST (4.5 is AA for normal text; 3 would be AA for large text only). */

const SAT_MIN = 0.42;
const SAT_MAX = 0.72;
const MIN_CONTRAST = 4.5;     // white text on the card
const SAMPLE = 36;            // the photo is drawn this big before sampling
const BINS = 24;              // hue buckets

const cache = new Map();      // src -> hex | null, so a breed is only measured once per page

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance(r, g, b) {
  const R = srgbToLinear(r / 255);
  const G = srgbToLinear(g / 255);
  const B = srgbToLinear(b / 255);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Contrast of a colour against white. */
const contrastWithWhite = (r, g, b) => 1.05 / (luminance(r, g, b) + 0.05);

function rgbToHsl(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    let T = t;
    if (T < 0) T += 1;
    if (T > 1) T -= 1;
    if (T < 1 / 6) return p + (q - p) * 6 * T;
    if (T < 1 / 2) return q;
    if (T < 2 / 3) return p + (q - p) * (2 / 3 - T) * 6;
    return p;
  };
  return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
}

const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

/**
 * The card colour for one photo.
 * @param {string} src same-origin image URL
 * @returns {Promise<string|null>} a hex colour that white text clears AA on, or null to keep the default
 */
export function cardColourFor(src) {
  if (!src) return Promise.resolve(null);
  if (cache.has(src)) return Promise.resolve(cache.get(src));

  return new Promise((resolve) => {
    const done = (value) => { cache.set(src, value); resolve(value); };
    try {
      const img = new Image();
      img.decoding = 'async';
      img.onerror = () => done(null);
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = SAMPLE; c.height = SAMPLE;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (!ctx) { done(null); return; }
          ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
          const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;

          /* Bucket the pixels by hue. Weight = how colourful (s², so grey barely counts) x how central
             (the dog is in the middle of the frame, the background is at the edges). */
          const binW = new Float64Array(BINS);
          const binX = new Float64Array(BINS);
          const binY = new Float64Array(BINS);
          const binS = new Float64Array(BINS);
          const binL = new Float64Array(BINS);
          let any = 0;
          const mid = (SAMPLE - 1) / 2;
          for (let py = 0; py < SAMPLE; py++) {
            for (let px = 0; px < SAMPLE; px++) {
              const i = (py * SAMPLE + px) * 4;
              if (data[i + 3] < 128) continue;                     // transparent
              const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
              if (l < 0.08 || l > 0.95) continue;                  // black / blown-out white say nothing about hue
              const dx = (px - mid) / mid, dy = (py - mid) / mid;
              const centre = 1 - 0.55 * Math.min(1, Math.sqrt(dx * dx + dy * dy) / 1.414);
              const w = (0.05 + s * s) * centre;
              const bin = Math.min(BINS - 1, Math.floor(h * BINS));
              const a = h * 2 * Math.PI;
              binW[bin] += w; binX[bin] += Math.cos(a) * w; binY[bin] += Math.sin(a) * w;
              binS[bin] += s * w; binL[bin] += l * w;
              any++;
            }
          }
          if (!any) { done(null); return; }

          // the heaviest bucket plus its neighbours, so a hue family split across a boundary stays whole
          let best = 0;
          for (let i = 1; i < BINS; i++) if (binW[i] > binW[best]) best = i;
          let x = 0, y = 0, satSum = 0, litSum = 0, weight = 0;
          for (const d of [-1, 0, 1]) {
            const i = (best + d + BINS) % BINS;
            x += binX[i]; y += binY[i]; satSum += binS[i]; litSum += binL[i]; weight += binW[i];
          }
          if (weight === 0) { done(null); return; }

          let h = Math.atan2(y / weight, x / weight) / (2 * Math.PI);
          if (h < 0) h += 1;
          const s = Math.min(SAT_MAX, Math.max(SAT_MIN, (satSum / weight) * 1.15));
          let l = Math.min(0.46, Math.max(0.16, litSum / weight));

          // walk the lightness down until white text is comfortably readable on it
          let rgb = hslToRgb(h, s, l);
          for (let guard = 0; guard < 40 && contrastWithWhite(...rgb) < MIN_CONTRAST; guard++) {
            l -= 0.02;
            if (l <= 0.04) break;
            rgb = hslToRgb(h, s, l);
          }
          if (contrastWithWhite(...rgb) < MIN_CONTRAST) { done(null); return; }   // give up rather than ship unreadable text
          done(hex(...rgb));
        } catch {
          done(null);                                               // tainted canvas, no 2d context, anything
        }
      };
      img.src = src;
    } catch {
      done(null);
    }
  });
}

/** Exported for the test script, so the contrast rule can be checked without a browser. */
export const _contrastWithWhite = contrastWithWhite;
