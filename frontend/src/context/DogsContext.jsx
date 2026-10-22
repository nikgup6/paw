import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { adoptBrowserDogs, getOwnerId, listDogs } from '../utils/dogs';

/* Owns the owner's dogs for the whole /app area.

   The list is fetched once when the app shell mounts and kept in memory, so
   moving between the dashboard and the Health Records pages doesn't refetch it
   — the pages read `dogs` from here and only call the API for their own data.
   Anything that changes a dog (create, edit, delete) calls `refresh`.

   Health Records unlock off `hasDogs`: with no dog there is nothing to file a
   record against, so the module isn't rendered and isn't routable.

   It also owns which dog is *selected*. One selection drives the dashboard and
   the sidebar together, and it survives a reload, so there is never a moment
   where the page is showing one dog and the menu is pointing at another.

   Dog profiles need a signed-in account. Without one, `needsSignIn` is true and
   the app shows the sign-in screen (app/components/DogSignIn.jsx) instead of an
   error. After signing in, this browser's old pre-sign-in dogs are moved to the
   account once, then the list loads. */

const DogsContext = createContext(null);
const SELECTED_KEY = 'pb_selected_dog';

const readSelected = () => {
  try { return localStorage.getItem(SELECTED_KEY) || null; } catch { return null; }
};

export const DogsProvider = ({ children }) => {
  const [ownerId] = useState(getOwnerId);
  const { token, user } = useContext(AuthContext);
  const needsSignIn = !token;
  const [dogs, setDogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(readSelected);

  const refresh = useCallback(async () => {
    try {
      const list = await listDogs(ownerId);
      setDogs(list);
      setError('');
      return list;
    } catch (err) {
      setError(err?.response?.status === 401
        ? 'Your sign-in has expired. Please sign in again.'
        : 'Couldn’t load your dogs. Check your connection and try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (needsSignIn) return undefined;
    let cancelled = false;
    // This browser's pre-sign-in dogs first, so they show up in the first list.
    adoptBrowserDogs(user?.id).then(() => { if (!cancelled) refresh(); });
    return () => { cancelled = true; };
  }, [needsSignIn, user?.id, refresh]);

  const selectDog = useCallback((id) => {
    setSelectedId(id);
    try { localStorage.setItem(SELECTED_KEY, id); } catch { /* private mode */ }
  }, []);

  const value = useMemo(() => {
    // A stored id can go stale — the dog was deleted, or this is a different
    // owner on the same device. Fall back to the first dog rather than showing
    // an empty selection.
    const selectedDog = dogs.find((d) => d.id === selectedId) || dogs[0] || null;
    return {
      ownerId,
      needsSignIn,
      dogs,
      loading: needsSignIn ? false : loading,
      error,
      refresh,
      hasDogs: dogs.length > 0,
      dogById: (id) => dogs.find((d) => d.id === id) || null,
      selectedDog,
      selectedDogId: selectedDog?.id || null,
      selectDog,
    };
  }, [ownerId, needsSignIn, dogs, loading, error, refresh, selectedId, selectDog]);

  return <DogsContext.Provider value={value}>{children}</DogsContext.Provider>;
};

export const useDogs = () => {
  const ctx = useContext(DogsContext);
  if (!ctx) throw new Error('useDogs must be used inside a DogsProvider');
  return ctx;
};

export default DogsContext;
