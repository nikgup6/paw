import { Suspense, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useParams } from 'react-router-dom';
import { useDogs } from '../../context/DogsContext';
import { getDog } from '../../utils/dogs';
import { ageFromDob } from '../../utils/healthStatus';
import { thumb } from '../../utils/images';

/* The Health Records module for ONE dog.

   The dog id comes from the URL and is handed to every child page through the
   outlet context, so each page reads exactly one dog's data and a stale id can
   never leak between them — switching dogs changes the route, which remounts
   the whole module.

   A dog id that doesn't belong to this owner (an old bookmark, a shared link,
   a deleted dog) sends the owner back to the dashboard rather than showing an
   empty module.

   The sidebar stops at "Health"; its sections are tabs here, so the menu stays
   one level deep and the section you're in is visible above the content. */

const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'vaccinations', label: 'Vaccines' },
  { to: 'reminders', label: 'Reminders' },
  { to: 'documents', label: 'Documents' },
];

const HealthLayout = () => {
  const { dogId } = useParams();
  const { dogs, loading, dogById, selectDog } = useDogs();
  const [dog, setDog] = useState(() => dogById(dogId));
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const known = dogById(dogId);
      if (known) {
        // Opening a dog's records makes it the selected dog everywhere, so the
        // dashboard shows the same one when you go back.
        if (!cancelled) { setDog(known); setChecked(true); selectDog(dogId); }
        return;
      }
      if (loading) return;      // the owner's list is still arriving

      // Not in the cached list — confirm with the server before giving up, so a
      // dog created in another tab still opens.
      try {
        const fetched = await getDog(dogId);
        if (!cancelled) setDog(fetched);
      } catch {
        if (!cancelled) setDog(null);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [dogId, dogs, loading, dogById, selectDog]);

  if (loading || !checked) {
    return <div className="pb-page"><div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Opening health records…</div></div>;
  }
  if (!dog) return <Navigate to="/app" replace />;

  const age = ageFromDob(dog.dob);

  return (
    <div className="pb-page pb-fade">
      <div className="pb-health__head">
        <div className="pb-health__dog">
          <div className="pb-health__avatar" aria-hidden="true">
            {dog.photo_url ? <img src={thumb(dog.photo_url, 40)} alt="" /> : <span>🐶</span>}
          </div>
          <div>
            <h2 className="pb-page__title" style={{ marginBottom: 2 }}>{dog.name}</h2>
            <p className="pb-page__sub">
              {[dog.breed, age, dog.weight_kg && `${dog.weight_kg} kg`, dog.city]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      <nav className="pb-tabs" aria-label="Health sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            end={tab.end}
            to={tab.to ? `/app/dogs/${dogId}/health/${tab.to}` : `/app/dogs/${dogId}/health`}
            className={({ isActive }) => `pb-tab ${isActive ? 'is-active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Suspense fallback={<div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading…</div>}>
        <Outlet context={{ dog, dogId }} />
      </Suspense>

      <style>{`
        .pb-health__head { margin-bottom: 14px; }
        .pb-health__dog { display: flex; align-items: center; gap: 13px; }
        .pb-health__avatar {
          flex: 0 0 50px; width: 50px; height: 50px; border-radius: 15px; overflow: hidden;
          background: var(--orange-pale); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; font-size: 24px;
        }
        .pb-health__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .pb-tabs {
          display: flex; gap: 6px; margin-bottom: 18px; overflow-x: auto;
          padding: 5px; border-radius: 14px; background: var(--white); border: 1px solid var(--border);
          scrollbar-width: none;
        }
        .pb-tabs::-webkit-scrollbar { display: none; }
        .pb-tab {
          padding: 9px 16px; border-radius: 10px; white-space: nowrap; text-decoration: none;
          color: var(--text-soft); font-size: 13.5px; font-weight: var(--weight-semibold);
          transition: color .22s ease, background-color .22s ease;
        }
        .pb-tab:hover { color: var(--orange-strong); background: var(--cream); }
        .pb-tab.is-active { color: var(--orange-strong); background: var(--orange-pale); font-weight: var(--weight-bold); }
      `}</style>
    </div>
  );
};

export default HealthLayout;
