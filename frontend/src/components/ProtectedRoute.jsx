import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/* Gate for signed-in and admin-only pages.

   The redirect carries WHERE it came from and WHY. Without that, following the
   "Admin" link while signed out drops you on a generic login form with no
   indication that anything was refused — it just looks like the link is
   broken, which is exactly how it was reported. */

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>; // Could use a spinner here
  }

  const bounce = (reason) => (
    <Navigate to="/login" replace state={{ from: location.pathname, reason }} />
  );

  if (!user) return bounce(requireAdmin ? 'admin' : 'auth');
  if (requireAdmin && user.role !== 'ADMIN') return bounce('admin');

  return children;
};

export default ProtectedRoute;
