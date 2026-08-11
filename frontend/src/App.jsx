import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Quiz from './pages/Quiz';
import Results from './pages/Results';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { BreedsProvider } from './context/BreedsContext';
import ErrorBoundary from './components/ErrorBoundary';

/* The signed-in product area is code-split away from the marketing site: a
   visitor who only ever reads the landing page never downloads the dashboard,
   and the Health Records pages only load when one is opened. */
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
  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-soft)', fontFamily: "'Poppins', sans-serif" }}>
    Loading Paw Buddy…
  </div>
);

function App() {
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
          
          await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/visit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitor_id: visitorId })
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
    <AuthProvider>
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
            <Route path="quiz" element={<Quiz />} />
            <Route path="results" element={<Results />} />
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
    </AuthProvider>
  );
}

export default App;
