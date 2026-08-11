import { createContext, useContext, useEffect, useState } from 'react';
import { BUNDLED_BREEDS, fetchBreeds } from '../utils/breeds';

/* One fetch of the breed catalogue, shared by every consumer.

   Reading breeds was synchronous before this — a bundled JSON import — so
   every screen could assume the data was simply there. It isn't any more, and
   pretending otherwise is how you get a results page that renders an empty
   ranking for a second before filling in. Consumers get `loading` and `error`
   alongside the list and are expected to use them.

   `breeds` is never empty: on a failed fetch it holds the bundled copy, so a
   component that ignores `loading` still renders something correct rather than
   nothing. That is deliberate — a missing catalogue should degrade the page,
   not blank it. */

const BreedsContext = createContext({
  breeds: BUNDLED_BREEDS,
  loading: false,
  error: null,
  source: 'fallback',
});

export const BreedsProvider = ({ children }) => {
  const [state, setState] = useState({
    breeds: BUNDLED_BREEDS,
    loading: true,
    error: null,
    source: 'pending',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { breeds, source, error } = await fetchBreeds();
      if (cancelled) return;
      setState({ breeds, loading: false, error, source });
      if (source === 'fallback') {
        // Visible in the console rather than to the owner: the page still
        // works, and there is nothing they can do about it.
        console.warn(`Breed catalogue served from the bundled fallback (${error}).`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <BreedsContext.Provider value={state}>{children}</BreedsContext.Provider>;
};

/** `{ breeds, loading, error, source }` — `source` is 'api' or 'fallback'. */
export const useBreeds = () => useContext(BreedsContext);

/** For the many places that only need the list and already handle an empty UI. */
export const useBreedList = () => useContext(BreedsContext).breeds;
