import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { DogsProvider, useDogs } from '../context/DogsContext';
import '../styles/app.css';

/* The signed-in product area at /app.

   The sidebar is the top level only — Health, Services, Profile, and the dog
   switcher. Opening Health reveals its sections as tabs across the top of the
   content, so the sidebar never grows into a two-level tree.

   Health is hidden until the owner has a dog: there is nothing to file a record
   against before that, so it isn't rendered and its routes redirect to the
   dashboard. */

const Sidebar = ({ onNavigate }) => {
  const { dogs, hasDogs, selectedDogId, selectDog } = useDogs();
  const match = useMatch('/app/dogs/:dogId/*');
  // Which dog the links point at: the one being viewed if you're inside a dog's
  // pages, otherwise the one selected on the dashboard. Every link carries the
  // dog id, so one dog's records can never show while another is selected.
  const activeDogId = match?.params?.dogId || selectedDogId;
  const activeDog = dogs.find((dog) => dog.id === activeDogId);

  return (
    <aside className="pb-side">
      <NavLink to="/" className="pb-side__brand">
        <img src="/logo.png" alt="" />
        <span>Paw Buddy</span>
      </NavLink>

      <div className="pb-side__group">
        {hasDogs && activeDogId ? (
          <>
            {/* The dashboard, but carrying the dog's own name — whose dashboard
                it is matters more than what it's called, and with several dogs
                the name is the only thing that answers that at a glance. */}
            <NavLink
              to="/app"
              end
              className={({ isActive }) => `pb-nav ${isActive ? 'is-active' : ''}`}
              onClick={onNavigate}
            >
              <span className="pb-nav__avatar" aria-hidden="true">
                {activeDog?.photo_url ? <img src={activeDog.photo_url} alt="" /> : '🐶'}
              </span>
              <span className="pb-nav__text">
                {activeDog?.name || 'Dashboard'}
                {/* The caption only earns its line when the label above it is a
                    name. Without a dog it would just say "Dashboard" twice. */}
                {activeDog?.name && <span className="pb-nav__cap">Dashboard</span>}
              </span>
            </NavLink>
            <NavLink
              to={`/app/dogs/${activeDogId}/health`}
              className={({ isActive }) => `pb-nav ${isActive ? 'is-active' : ''}`}
              onClick={onNavigate}
            >
              <span className="pb-nav__icon" aria-hidden="true">💚</span>
              <span className="pb-nav__text">Health</span>
            </NavLink>
            <NavLink
              to="/app/services"
              className={({ isActive }) => `pb-nav ${isActive ? 'is-active' : ''}`}
              onClick={onNavigate}
            >
              <span className="pb-nav__icon" aria-hidden="true">🧰</span>
              <span className="pb-nav__text">Services</span>
            </NavLink>
            <NavLink
              to={`/app/dogs/${activeDogId}/profile`}
              className={({ isActive }) => `pb-nav ${isActive ? 'is-active' : ''}`}
              onClick={onNavigate}
            >
              <span className="pb-nav__icon" aria-hidden="true">🐶</span>
              <span className="pb-nav__text">Profile</span>
            </NavLink>
          </>
        ) : (
          <span className="pb-nav is-locked">
            <span className="pb-nav__icon" aria-hidden="true">🔒</span>
            <span className="pb-nav__text">Save a dog first</span>
          </span>
        )}
      </div>

      {dogs.length > 0 && (
        <div className="pb-side__group">
          <p className="pb-side__label">Switch dog</p>
          {dogs.map((dog) => (
            <NavLink
              key={dog.id}
              to={`/app/dogs/${dog.id}/health`}
              className={`pb-nav ${dog.id === activeDogId ? 'is-active' : ''}`}
              onClick={() => { selectDog(dog.id); onNavigate?.(); }}
            >
              <span className="pb-nav__avatar" aria-hidden="true">
                {dog.photo_url ? <img src={dog.photo_url} alt="" /> : '🐶'}
              </span>
              <span className="pb-nav__text">{dog.name}</span>
            </NavLink>
          ))}
        </div>
      )}
    </aside>
  );
};

/* ---------------------------- mobile navigation ---------------------------- */
/* Below 1024px the sidebar is gone entirely, so these two carry the same job:
   a persistent header naming whose dashboard you're on, and a thumb-reachable
   bar for the four destinations plus the way out.

   Both are rendered unconditionally and hidden with CSS above the breakpoint —
   not mounted conditionally on a width — so a resize can never leave the app
   with no navigation at all while React catches up. */

const MobileDogHeader = ({ dog, onOpen }) => (
  <button type="button" className="pb-mhead" onClick={onOpen}>
    <span className="pb-mhead__avatar" aria-hidden="true">
      {dog?.photo_url ? <img src={dog.photo_url} alt="" /> : '🐶'}
    </span>
    <span className="pb-mhead__text">
      <strong>{dog?.name || 'Your dog'}</strong>
      <em>Dashboard</em>
    </span>
  </button>
);

/* Same icons and the same is-active treatment the sidebar uses, so the bar
   reads as the sidebar rather than as a second navigation language. */
const MobileTabs = ({ activeDogId, onSwitchDog, onHome, isDashboard }) => (
  <nav className="pb-tabbar" aria-label="Sections">
    <NavLink
      to={activeDogId ? `/app/dogs/${activeDogId}/health` : '/app'}
      className={({ isActive }) => `pb-tabbar__item ${isActive ? 'is-active' : ''}`}
    >
      <span aria-hidden="true">💚</span><span>Health</span>
    </NavLink>
    <NavLink
      to="/app/services"
      className={({ isActive }) => `pb-tabbar__item ${isActive ? 'is-active' : ''}`}
    >
      <span aria-hidden="true">🧰</span><span>Services</span>
    </NavLink>
    <NavLink
      to={activeDogId ? `/app/dogs/${activeDogId}/profile` : '/app'}
      className={({ isActive }) => `pb-tabbar__item ${isActive ? 'is-active' : ''}`}
    >
      <span aria-hidden="true">🐶</span><span>Profile</span>
    </NavLink>
    <button type="button" className="pb-tabbar__item" onClick={onSwitchDog}>
      <span aria-hidden="true">🔄</span><span>Switch Dog</span>
    </button>
    <button type="button" className="pb-tabbar__item" onClick={onHome}>
      <span aria-hidden="true">🏠</span><span>Home</span>
    </button>
  </nav>
);

const PAGE_TITLES = [
  [/^\/app\/?$/, 'Dashboard'],
  [/^\/app\/services/, 'Services'],
  [/^\/app\/dogs\/new/, 'Your dog’s profile'],
  [/\/edit$/, 'Your dog’s profile'],
  [/\/profile$/, 'Profile'],
  [/\/health/, 'Health'],
];

const titleFor = (pathname) =>
  (PAGE_TITLES.find(([pattern]) => pattern.test(pathname)) || [null, 'Paw Buddy'])[1];

const Shell = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { dogs, selectedDogId, selectDog } = useDogs();
  const match = useMatch('/app/dogs/:dogId/*');
  /* Identical resolution to the sidebar's: the dog you're looking at wins over
     the one merely selected, so the header can never name a different dog from
     the one the page below it is showing. */
  const activeDogId = match?.params?.dogId || selectedDogId;
  const activeDog = dogs.find((dog) => dog.id === activeDogId);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <div className={`pb-app ${menuOpen ? 'is-menu-open' : ''}`}>
      <Sidebar onNavigate={() => setMenuOpen(false)} />
      <div className="pb-scrim" onClick={() => setMenuOpen(false)} />

      <div className="pb-main">
        {/* Replaces the sidebar's pinned dog card below the breakpoint. Tapping
            it always returns to that dog's dashboard, from any tab. */}
        {activeDog && <MobileDogHeader dog={activeDog} onOpen={() => navigate('/app')} />}

        <header className="pb-top">
          <button
            type="button"
            className="pb-top__burger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            ☰
          </button>
          <h1 className="pb-top__title">{titleFor(location.pathname)}</h1>
          {offline && (
            <span className="pb-offline-pill" title="No connection — showing the last saved documents.">
              📡 Offline
            </span>
          )}
          <nav className="pb-top__actions">
            <NavLink to="/app" end className={({ isActive }) => `pb-btn pb-btn--sm ${isActive ? 'is-on' : ''}`}>
              Dashboard
            </NavLink>
            <NavLink to="/app/dogs/new" className="pb-btn pb-btn--sm">+ Dog</NavLink>
            <button type="button" className="pb-btn pb-btn--sm" onClick={() => navigate('/')}>Home</button>
          </nav>
        </header>

        <Suspense fallback={<div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading…</div>}>
          <Outlet />
        </Suspense>
      </div>

      <MobileTabs
        activeDogId={activeDogId}
        onSwitchDog={() => setSwitcherOpen(true)}
        onHome={() => navigate('/')}
      />

      {/* The app's existing overlay/modal shell wrapping the dashboard's own
          dog-picker markup — no new interaction pattern, and selecting here
          updates the header and every tab together because they all read the
          same selectedDogId. */}
      {switcherOpen && (
        <div
          className="pb-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Switch dog"
          onClick={() => setSwitcherOpen(false)}
        >
          <div className="pb-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="pb-modal__bar">
              <span>Switch dog</span>
              <button type="button" onClick={() => setSwitcherOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="pb-modal__body">
              {dogs.length === 0 ? (
                <p className="pb-card__sub">No dogs yet.</p>
              ) : (
                <div className="pb-switch pb-switch--stack">
                  {dogs.map((dog) => (
                    <button
                      key={dog.id}
                      type="button"
                      className={`pb-switch__dog ${dog.id === activeDogId ? 'is-on' : ''}`}
                      aria-pressed={dog.id === activeDogId}
                      onClick={() => {
                        selectDog(dog.id);
                        setSwitcherOpen(false);
                        // Land on the dashboard for the newly chosen dog rather
                        // than the same sub-page, which may not exist for it.
                        navigate('/app');
                      }}
                    >
                      <span className="pb-switch__avatar" aria-hidden="true">
                        {dog.photo_url ? <img src={dog.photo_url} alt="" loading="lazy" /> : '🐶'}
                      </span>
                      <span className="pb-switch__meta">
                        <strong>{dog.name}</strong>
                        <em>{dog.breed || 'Dog'}</em>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="pb-modal__actions">
              <button
                type="button"
                className="pb-btn"
                onClick={() => { setSwitcherOpen(false); navigate('/app/dogs/new'); }}
              >
                ＋ Add a dog
              </button>
              <button type="button" className="pb-btn pb-btn--primary" onClick={() => setSwitcherOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AppShell = () => (
  <DogsProvider>
    <Shell />
  </DogsProvider>
);

export default AppShell;
