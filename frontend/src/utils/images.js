/* Right-sized image URLs.

   Dog photos are stored on Cloudinary at whatever size they were uploaded —
   often several thousand pixels wide. Rendering one of those into a 92px
   avatar makes the browser downscale by ~19x, and at that ratio browsers fall
   back to a cheap filter: the result is visibly soft, worst on images with
   fine detail or text. It also means downloading a multi-megabyte original to
   paint a thumbnail.

   Asking Cloudinary for a derivative fixes both. The resize happens
   server-side with a proper filter, and the bytes that arrive are the bytes
   actually needed.

   Non-Cloudinary URLs (and anything unrecognised) are returned untouched, so
   this is always safe to wrap around a src. */

/** Cloudinary delivery URLs always contain this segment exactly once. */
const UPLOAD = '/image/upload/';

/**
 * @param url    the stored image URL
 * @param size   the rendered size in CSS pixels (the SHORT side)
 * @param dpr    device pixel ratio; capped at 2 because past that the extra
 *               bytes buy nothing the eye can resolve at avatar sizes
 */
export function thumb(url, size = 96, dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1)) {
  const src = String(url || '');
  if (!src.includes(UPLOAD)) return src || '';

  const px = Math.round(size * Math.min(dpr || 1, 2));
  const transforms = [
    `w_${px}`, `h_${px}`,
    'c_fill',      // fill the box, cropping the overflow — matches object-fit: cover
    'g_auto',      // let Cloudinary pick the subject rather than the geometric centre
    'f_auto',      // modern format (webp/avif) where the browser supports it
    'q_auto',      // quality tuned per image
  ].join(',');

  return src.replace(UPLOAD, `${UPLOAD}${transforms}/`);
}
