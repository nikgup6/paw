import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
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
import ErrorBoundary from './components/ErrorBoundary';
import VerifiedBadge from './components/VerifiedBadge';

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
      <ErrorBoundary>
        <VerifiedBadge />
        <Routes>
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
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;
