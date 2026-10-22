import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

/* Squeaky toys: the two things every toy spot on a page has to share.

   1. A SEED, new for every page view (every time the route changes). It decides which toy goes in which spot, so a page
      shows a different mix each visit but never the same toy twice (see shuffledToyKeys in constants/toys.js).
      Nothing is stored anywhere.
   2. An ON/OFF switch. The footer lives outside the pages, so a page tells it when to stay quiet: while the loading
      screen, the quiz, the breed slider, the swipe cards or the match reveal are open, no toy may be on the page (not
      even hidden behind a layer, where the keyboard could still reach it). Several screens can ask at once: it is a
      counter, and toys are back only when nobody is asking them to stay away. */

const ToyContext = createContext({ seed: 1, enabled: true, block: () => {} });

export function ToyProvider({ children }) {
  const { pathname } = useLocation();
  const [blockers, setBlockers] = useState(0);
  const block = useCallback((delta) => setBlockers((n) => Math.max(0, n + delta)), []);
  // A fresh random seed for each page view (the route changing). Being random is the whole point, so the linter's
  // "no random numbers while rendering" rule is switched off for this one line.
  // eslint-disable-next-line react-hooks/purity, react-hooks/exhaustive-deps
  const seed = useMemo(() => Math.floor(Math.random() * 4294967296), [pathname]);
  const enabled = blockers === 0;
  const value = useMemo(() => ({ seed, enabled, block }), [seed, enabled, block]);
  return <ToyContext.Provider value={value}>{children}</ToyContext.Provider>;
}

export const useToys = () => useContext(ToyContext);

/** A screen calls this with `false` while toys must stay away (quiz open, loading screen, reveal...), `true` when they may show. */
export function useToyGate(allowed) {
  const { block } = useToys();
  useEffect(() => {
    if (allowed) return undefined;
    block(1);
    return () => block(-1);
  }, [allowed, block]);
}

/** true on a phone-sized screen (under 700 px wide), and it follows the screen if it is turned or resized. */
/* The live viewport width, for placements that need a breakpoint of their own.
   `show: 'phone' | 'desktop'` splits at 700px, which is right for most of the site — but the
   home hero switches to its two-column layout at 900px, so its toys need to switch there too
   or the 700-899 band gets desktop toys laid over a phone layout. */
export function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on, { passive: true });
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

export function usePhone() {
  const query = '(max-width: 699px)';
  const [phone, setPhone] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(query);
    const on = () => setPhone(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return phone;
}
