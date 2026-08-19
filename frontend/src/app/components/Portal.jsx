import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/* Renders children at <body>, outside the page tree.

   Why this exists: `.pb-page` carries the `pb-fade` entry animation, whose
   keyframes set `transform: translateY(8px)`. A transformed element becomes
   the containing block for any `position: fixed` descendant — so an overlay
   rendered inside the page is positioned against the PAGE, not the viewport.
   In practice the emergency card opened roughly a screen-and-a-half down and
   had to be scrolled to, which is exactly what it looked like.

   `transform: none` (the animation's end state) does not create a containing
   block, so this only bites while the animation is running — or indefinitely
   wherever the animation clock is throttled or paused, such as a backgrounded
   tab. Portalling to <body> removes the dependency on animation state
   entirely rather than trying to time around it. */

const Portal = ({ children }) => {
  const [host] = useState(() => document.createElement('div'));

  useEffect(() => {
    document.body.appendChild(host);
    return () => { document.body.removeChild(host); };
  }, [host]);

  return createPortal(children, host);
};

export default Portal;
