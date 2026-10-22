import React from 'react';

/* The PAW BUDDY dog, drawn in code (original flat art, brand colours only).
   Used by the quiz progress bar (RunningDog), the match reveal, and the sitting dog on the results page,
   so it is always the SAME dog everywhere.

   Props
     mood     'run' | 'tilt' | 'pant' | 'sit' | 'wag'
                run   standing/running side view (legs swap while `running`)
                tilt  head tilted to one side (curious)
                pant  tongue out, small fast bob
                sit   sitting, tail wagging
                wag   standing, tail wagging fast
     running  true while the dog is sliding along the lane (legs swap)
     idle     true to give the tail a couple of wags (used when the dog has just stopped)
     width    pixel width (height follows)
     noStyle  true = do not include the dog's CSS here (a parent drawing several dogs includes DOG_CSS once instead)
     variant  'orange' (default, the PAW BUDDY dog) | 'navy' | 'cream' | 'brown'   the coat colour (see DOG_VARIANTS);
              used by the "zoomies" pack in the match reveal. Every variant is the SAME drawing, only the colours change.

   Reduced motion: every animation is switched off; the pose itself (tilted head, tongue, sitting) stays. */

export const DOG = { body: '#F5691A', line: '#011E4A', belly: '#FFD9BD', ear: '#B4470B', tongue: '#FF7A8A' };

/* Coat colours for a pack of dogs. Same outline colour everywhere, so they all look like cartoons from one set. */
export const DOG_VARIANTS = {
  orange: DOG,
  navy: { body: '#1F3F7D', line: '#011E4A', belly: '#FFD9BD', ear: '#0B2D66', tongue: '#FF7A8A' },
  cream: { body: '#FFEBD6', line: '#011E4A', belly: '#FFFFFF', ear: '#E2B98F', tongue: '#FF7A8A' },
  brown: { body: '#8A5A3C', line: '#011E4A', belly: '#E8C9A8', ear: '#5A3A24', tongue: '#FF7A8A' },
};

const Head = ({ tilt, tongue, P }) => (
  <g className="pbdog__head" style={{ transformOrigin: '24px 12px', transform: tilt ? 'rotate(-16deg)' : 'none' }}>
    <circle cx="25.6" cy="9.4" r="5.3" fill={P.body} stroke={P.line} strokeWidth="1.6" />
    <rect x="28.4" y="8.4" width="5.2" height="4.9" rx="2.3" fill={P.belly} stroke={P.line} strokeWidth="1.4" />
    <ellipse cx="33" cy="9.5" rx="1.25" ry="1.05" fill={P.line} />
    <circle cx="27.4" cy="7.6" r="1.1" fill={P.line} />
    {tongue && <path d="M30.4 13.2c-.2 2.8 2.9 2.8 2.7 0z" fill={P.tongue} stroke={P.line} strokeWidth="1" strokeLinejoin="round" />}
    <path d="M22.4 4.6c-2.9-.2-3.9 3.6-2.4 7.3 1.9.3 3.4-1.8 3.5-4.6.1-1.2-.4-2.4-1.1-2.7z" fill={P.ear} stroke={P.line} strokeWidth="1.3" strokeLinejoin="round" />
  </g>
);

const Tail = ({ P }) => (
  <g className="pbdog__tail" style={{ transformOrigin: '6px 11.5px' }}>
    <path d="M5.5 11.5C2.6 10.8 1.4 7.6 3 4.6" fill="none" stroke={P.line} strokeWidth="3.6" strokeLinecap="round" />
    <path d="M5.5 11.5C2.6 10.8 1.4 7.6 3 4.6" fill="none" stroke={P.body} strokeWidth="1.7" strokeLinecap="round" />
  </g>
);

export default function DogArt({ mood = 'run', running = false, idle = false, width = 34, className = '', variant = 'orange', noStyle = false }) {
  const P = DOG_VARIANTS[variant] || DOG;   // this dog's colours
  const h = Math.round((width * 26) / 35);
  const cls = `pbdog pbdog--${mood}${running ? ' is-running' : ''}${idle ? ' is-idle' : ''} ${className}`.trim();

  if (mood === 'sit') {
    return (
      <svg className={cls} viewBox="0 0 35 26" width={width} height={h} aria-hidden="true" focusable="false">
        {!noStyle && <style>{CSS}</style>}
        <ellipse cx="17" cy="24.6" rx="11" ry="1.4" fill="rgba(1,30,74,.14)" />
        {/* tail, wagging on the ground behind */}
        <g className="pbdog__tail" style={{ transformOrigin: '8px 22px' }}>
          <path d="M8 22.5C3.5 23 2 20 4 17" fill="none" stroke={P.line} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M8 22.5C3.5 23 2 20 4 17" fill="none" stroke={P.body} strokeWidth="1.7" strokeLinecap="round" />
        </g>
        {/* upright body, haunch, belly patch, front legs */}
        <path d="M9 24c-1.5-5 .5-12 5-14 3.5-1.2 7 .5 7.5 4.5.5 3.8-.5 7.5-1.5 9.5z" fill={P.body} stroke={P.line} strokeWidth="1.6" strokeLinejoin="round" />
        <ellipse cx="11.6" cy="20.4" rx="4.3" ry="3.7" fill={P.ear} opacity=".55" />
        <path d="M15.5 14.5c2.3.2 3.6 2 3.6 4.6 0 2-.6 3.6-1.2 5h-3.2c1-2.4 1.4-6 .8-9.6z" fill={P.belly} />
        <rect x="16.2" y="19.5" width="3.4" height="5.2" rx="1.7" fill={P.belly} stroke={P.line} strokeWidth="1.4" />
        <rect x="19.8" y="19.8" width="3.2" height="4.9" rx="1.6" fill={P.belly} stroke={P.line} strokeWidth="1.4" />
        {/* head up and facing right */}
        <g transform="translate(-4.4 1.2)">
          <circle cx="25.6" cy="6.6" r="5.3" fill={P.body} stroke={P.line} strokeWidth="1.6" />
          <rect x="28.4" y="5.6" width="5.2" height="4.9" rx="2.3" fill={P.belly} stroke={P.line} strokeWidth="1.4" />
          <ellipse cx="33" cy="6.7" rx="1.25" ry="1.05" fill={P.line} />
          <circle cx="27.4" cy="4.8" r="1.1" fill={P.line} />
          <path d="M22.4 1.8c-2.9-.2-3.9 3.6-2.4 7.3 1.9.3 3.4-1.8 3.5-4.6.1-1.2-.4-2.4-1.1-2.7z" fill={P.ear} stroke={P.line} strokeWidth="1.3" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }

  return (
    <svg className={cls} viewBox="0 0 35 26" width={width} height={h} aria-hidden="true" focusable="false">
      {!noStyle && <style>{CSS}</style>}
      <g className="pbdog__bob">
        <Tail P={P} />
        <g className="pbdog__legsA" stroke={P.line} strokeWidth="2.7" strokeLinecap="round" fill="none">
          <path d="M21.5 17l4.2 5.6M19 17.4l-1.2 6M12.5 17.4l-4.2 5.6M10 17l1.6 6" />
        </g>
        <g className="pbdog__legsB" stroke={P.line} strokeWidth="2.7" strokeLinecap="round" fill="none">
          <path d="M21.5 17l-.8 5M19 17.4l-3.4 4M12.5 17.4l.8 5.2M10 17l3.6 3.8" />
        </g>
        <rect x="4.5" y="8.6" width="20.5" height="9.4" rx="4.7" fill={P.body} stroke={P.line} strokeWidth="1.6" />
        <path d="M8.5 15.6c3.6 1.7 8.6 1.7 12.4 0 .2 1.4-1.4 2.4-3 2.4H11c-1.8 0-3.1-1-2.5-2.4z" fill={P.belly} />
        <Head tilt={mood === 'tilt'} tongue={mood === 'pant'} P={P} />
      </g>
    </svg>
  );
}

const CSS = `
.pbdog{display:block;overflow:visible}
.pbdog__legsB{opacity:0}
.pbdog.is-running .pbdog__legsA{animation:pbdog-a .24s steps(1) infinite}
.pbdog.is-running .pbdog__legsB{animation:pbdog-b .24s steps(1) infinite}
@keyframes pbdog-a{0%{opacity:1}50%{opacity:0}}
@keyframes pbdog-b{0%{opacity:0}50%{opacity:1}}
.pbdog.is-idle .pbdog__tail{animation:pbdog-wag .5s ease-in-out 2 alternate}
.pbdog--wag .pbdog__tail,.pbdog--sit .pbdog__tail{animation:pbdog-wag .38s ease-in-out infinite alternate}
.pbdog--pant .pbdog__bob{animation:pbdog-bob .22s ease-in-out infinite alternate}
@keyframes pbdog-wag{from{transform:rotate(-14deg)}to{transform:rotate(16deg)}}
@keyframes pbdog-bob{from{transform:translateY(0)}to{transform:translateY(.9px)}}
@media (prefers-reduced-motion:reduce){
  .pbdog *{animation:none !important}
  .pbdog__legsA{opacity:1 !important}.pbdog__legsB{opacity:0 !important}
}
`;

export const DOG_CSS = CSS;   // for a parent that draws many dogs with noStyle: include this once
