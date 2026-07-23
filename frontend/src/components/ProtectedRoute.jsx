import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div>Loading...</div>; // Could use a spinner here
  }

  if (!user) {
    return <Navigate to="/login" replace />; 
  }

  if (requireAdmin && user.role !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
