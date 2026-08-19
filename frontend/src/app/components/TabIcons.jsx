/* The app's icon set — bottom tab bar, and the vet card actions.

   These were all emoji (🏠 🧰 💚 🔄 ⋯, 📞 📍). Emoji render from each
   platform's own font, so the bar looked like a different product on Android
   than on iOS, and one glyph (⋯) isn't really an icon at all. Worse for the
   Call button: emoji carry their own baked-in colours, and a dark-and-pink
   receiver sitting on a saturated orange button is close to invisible — which
   is exactly how it was reported.

   Inline SVG fixes both: identical on every platform, and `currentColor` means
   the icon takes the colour of whatever it sits in — white on the orange Call
   button, the active orange in the tab bar — with no per-context rules.

   One drawing style throughout: 24×24 box, stroked not filled, 1.75 width,
   round caps and joins. */

const icon = (size = 22) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
});

const base = icon();

export const HomeIcon = () => (
  <svg {...base}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20a1 1 0 0 0 1 1H9.5v-5.5h5V21h3a1 1 0 0 0 1-1V9.5" /></svg>
);

export const ServicesIcon = () => (
  <svg {...base}>
    <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    <path d="M12 11.5v5M9.5 14h5" />
  </svg>
);

export const HealthIcon = () => (
  <svg {...base}>
    <path d="M20.4 5.9a5 5 0 0 0-7.1 0l-1.3 1.3-1.3-1.3a5 5 0 1 0-7.1 7.1l8.4 8.4 8.4-8.4a5 5 0 0 0 0-7.1Z" />
  </svg>
);

export const SwitchDogIcon = () => (
  <svg {...base}>
    <path d="M3 11a8 8 0 0 1 13.7-5.6L20 8.5" /><path d="M20 4v4.5h-4.5" />
    <path d="M21 13a8 8 0 0 1-13.7 5.6L4 15.5" /><path d="M4 20v-4.5h4.5" />
  </svg>
);

export const MoreIcon = () => (
  <svg {...base}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

/* Vet card actions. Default 17px — these sit inline beside a text label in a
   button, where the 22px tab size would crowd it. */
export const PhoneIcon = ({ size = 17 }) => (
  <svg {...icon(size)}>
    <path d="M6.6 3.5h-2A1.6 1.6 0 0 0 3 5.2C3 13.4 10.6 21 18.8 21a1.6 1.6 0 0 0 1.7-1.6v-2a1.1 1.1 0 0 0-.85-1.07l-3.2-.8a1.1 1.1 0 0 0-1.13.42l-.86 1.15a12.4 12.4 0 0 1-5.55-5.55l1.15-.86a1.1 1.1 0 0 0 .42-1.13l-.8-3.2A1.1 1.1 0 0 0 6.6 3.5Z" />
  </svg>
);

export const MapPinIcon = ({ size = 17 }) => (
  <svg {...icon(size)}>
    <path d="M20 10.5c0 5.2-8 11-8 11s-8-5.8-8-11a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10.3" r="2.7" />
  </svg>
);
