import React from 'react';

/* Small inline SVG icons for Breed Swipe. currentColor strokes, so the parent
   sets the colour. All decorative (aria-hidden); buttons carry their own labels. */

const Svg = ({ size = 24, children, fill = 'none', sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

export const HeartIcon = ({ size, filled }) => (
  <Svg size={size} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.5s-8-4.9-8-10.7A4.5 4.5 0 0 1 12 7.2a4.5 4.5 0 0 1 8 2.6c0 5.8-8 10.7-8 10.7z" />
  </Svg>
);
export const XIcon = ({ size, sw = 2.4 }) => (<Svg size={size} sw={sw}><path d="M6 6l12 12M18 6L6 18" /></Svg>);
export const UndoIcon = ({ size }) => (<Svg size={size}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Svg>);
export const InfoIcon = ({ size }) => (<Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.6v.01" strokeWidth="3" /></Svg>);
export const HelpIcon = ({ size }) => (<Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1 1-1.1 1.8" /><path d="M12 17h.01" /></Svg>);
export const CheckIcon = ({ size }) => (<Svg size={size} sw={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>);
export const AlertIcon = ({ size }) => (<Svg size={size}><path d="M12 3.5L21 19H3z" /><path d="M12 10v4M12 16.8v.01" /></Svg>);
export const ArrowLeftIcon = ({ size }) => (<Svg size={size} sw={2.6}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>);
export const ArrowRightIcon = ({ size }) => (<Svg size={size} sw={2.6}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>);

/** Stack of cards, used on the results "Tinder for dogs" button. */
export const CardStackIcon = ({ size }) => (
  <Svg size={size}>
    <rect x="7.5" y="3.5" width="12" height="15" rx="2.5" />
    <path d="M4.5 7.5v10a2.5 2.5 0 0 0 2.5 2.5h9" />
    <circle cx="13.5" cy="9.8" r="1.4" />
    <path d="M10.5 15.5c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4" />
  </Svg>
);

/** A drawn hand for the tutorial's drag demo. */
export const HandIcon = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="#FFFFFF" stroke="#011E4A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M19 24V9.5a3 3 0 0 1 6 0V21l.5-2.5a3 3 0 0 1 6 .7l.3 3.3 1.2-1.6a3 3 0 0 1 5.2 2.6L36 33c-1.2 5-3.8 8-9.2 8-5.6 0-8.4-3-11.4-7.2l-4-5.6a3 3 0 0 1 5-3.2z" />
  </svg>
);
