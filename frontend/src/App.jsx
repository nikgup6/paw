import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import Home from './pages/Home';
import Explore from './pages/Explore';
import RequireUnlock from './components/paywall/RequireUnlock';
import { Terms, Privacy, Refunds, Contact } from './pages/legal/LegalPages';
import Results from './pages/Results';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import OwnerSurvey from './pages/OwnerSurvey';
import StickersPage from './pages/StickersPage';
import { captureAttribution, getAttribution } from './utils/attribution';
import { API_URL, sessionId, saveProgress, trackOnce } from './utils/analytics';
import ProtectedRoute from './components/ProtectedRoute';
import { BreedsProvider } from './context/BreedsContext';
import ErrorBoundary from './components/ErrorBoundary';

/* The signed-in product area is code-split away from the marketing site: a
   visitor who only ever reads the landing page never downloads the dashboard,
   and the Health Records pages only load when one is opened. */
/* The "Walk the dog" game is code-split too: the main bundle never carries it. */
const Play = lazy(() => import('./pages/Play'));
/* The heat check is its own page and carries the climate table, so it is code-split as well. */
const HeatCheck = lazy(() => import('./pages/HeatCheck'));
const AppShell = lazy(() => import('./app/AppShell'));
const Dashboard = lazy(() => import('./app/Dashboard'));
const DogForm = lazy(() => import('./app/DogForm'));
const DogProfilePage = lazy(() => import('./app/DogProfilePage'));
const Services = lazy(() => import('./app/Services'));
const HealthLayout = lazy(() => import('./app/health/HealthLayout'));
const HealthOverview = lazy(() => import('./app/health/Overview'));
const Vaccinations = lazy(() => import('./app/health/Vaccinations'));
const DocumentVault = lazy(() => import('./app/health/DocumentVault'));
const Reminders = lazy(() => import('./app/health/Reminders'));

const AppFallback = () => (
  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-soft)', fontFamily: 'var(--font-body-family)' }}>
    Loading Paw Buddy…
  </div>
);

// Read the UTM / referrer / device ONCE per browser session, as early as possible,
// so every event (even ones fired by child components) already knows its channel.
captureAttribution();

function App() {
  // One site_visit per browser session, plus the first-touch source saved on this
  // session's quiz_progress row (the server only ever writes it once).
  useEffect(() => {
    const first = getAttribution() || captureAttribution();
    trackOnce('site_visit', 'site_visit_session', { landing_path: first?.landing_path || window.location.pathname });
    if (first) saveProgress({ attribution: first });
  }, []);

  useEffect(() => {
    const trackAnonymousVisit = async () => {
      // Check if user is NOT logged in and hasn't been tracked yet in this session
      if (!localStorage.getItem('pb_token') && !sessionStorage.getItem('pb_anon_tracked')) {
        try {
          let visitorId = localStorage.getItem('pb_visitor_id');
          if (!visitorId) {
            visitorId = crypto.randomUUID();
            localStorage.setItem('pb_visitor_id', visitorId);
          }
          
          await fetch(`${API_URL}/api/analytics/visit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // session_id joins this legacy visit record to the funnel's events
            body: JSON.stringify({ visitor_id: visitorId, session_id: sessionId })
          });
          
          sessionStorage.setItem('pb_anon_tracked', 'true');
        } catch (err) {
          console.error("Failed to track visit", err);
        }
      }
    };
    
    // Slight delay to allow auth state to resolve if returning with token
    setTimeout(trackAnonymousVisit, 1000);
  }, []);

  return (
    <>
      {/* One breed fetch for the whole app; consumers read it via useBreeds(). */}
      <BreedsProvider>
      <ErrorBoundary>
        <Suspense fallback={<AppFallback />}>
        <Routes>
          {/* The product area. Health Records lives under a dog id, so every
              page in it is scoped to exactly one dog by its own URL. */}
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="services" element={<Services />} />
            <Route path="dogs/new" element={<DogForm />} />
            <Route path="dogs/:dogId/edit" element={<DogForm />} />
            <Route path="dogs/:dogId/profile" element={<DogProfilePage />} />
            <Route path="dogs/:dogId/health" element={<HealthLayout />}>
              <Route index element={<HealthOverview />} />
              <Route path="vaccinations" element={<Vaccinations />} />
              <Route path="documents" element={<DocumentVault />} />
              <Route path="reminders" element={<Reminders />} />
            </Route>
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>

          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="explore" element={<Explore />} />
            {/* The old standalone quiz now leads to the home-page quiz, where the
                paywall lives (Quiz.jsx is kept, just no longer routed). */}
            <Route path="quiz" element={<Navigate to="/?quiz=1" replace />} />
            {/* Existing Dog Owner intake — 8 questions, then Add-a-Dog. */}
            <Route path="owner-survey" element={<OwnerSurvey />} />
            <Route path="results" element={<RequireUnlock><Results /></RequireUnlock>} />
            {/* Shareable sticker pack; redirects home while STICKERS_LIVE is false. */}
            <Route path="stickers" element={<StickersPage />} />
            {/* "Will it survive?" — the breed/city/month heat lookup. Read-only, no backend. */}
            <Route path="heat-check" element={<HeatCheck />} />
            {/* Policy pages a payment gateway checks for (placeholders; see pages/legal). */}
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="refunds" element={<Refunds />} />
            <Route path="contact" element={<Contact />} />
            {/* Public mini-game. Not part of the quiz, the results or the lead gate. */}
            <Route path="play" element={<Play />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route 
              path="profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="admin" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
          </Route>
        </Routes>
        </Suspense>
      </ErrorBoundary>
      </BreedsProvider>
    </>
  );
}

export default App;
