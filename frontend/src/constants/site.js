/* Site-wide constants used by the share flow and mirrored by hand in index.html.

   index.html cannot import JavaScript, so its link-preview tags (Open Graph /
   Twitter) are written out literally. When the live domain is known, change it
   in BOTH places: here, and in the og:url / og:image / canonical / twitter:image
   tags in index.html (search for REPLACE-WITH-LIVE-DOMAIN).

   Until SITE_URL is real, shared LINKS fall back to the page's own address so
   sharing still works; link PREVIEWS (WhatsApp, Instagram DMs) will not show
   until the real domain is in index.html. */

export const SITE_URL = 'https://REPLACE-WITH-LIVE-DOMAIN'; // no trailing slash
export const SITE_NAME = 'PAW BUDDY';
export const SITE_TAGLINE = 'Find the right dog for your life, not just the cutest one.';

export const siteIsConfigured = () => !/REPLACE/.test(SITE_URL);
/** The address people should be sent to: the live domain, or (before it is set) this page's origin. */
export const shareBase = () => (siteIsConfigured() ? SITE_URL : (typeof window !== 'undefined' ? window.location.origin : ''));
