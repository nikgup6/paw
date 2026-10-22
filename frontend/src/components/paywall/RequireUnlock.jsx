import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import usePaywallStatus from './usePaywallStatus';

/* Wraps a page that shows a FULL result (the old /results page). While the
   paywall is on and this account has no access, the visitor is sent to the
   home-page quiz, where the free part and the unlock live. Paywall off, already
   unlocked, or the server unreachable (fails open, like the quiz): the page
   shows as before. */
export default function RequireUnlock({ children }) {
  const { user, loading } = useContext(AuthContext);
  const [status, , settled] = usePaywallStatus(user?.id);
  if (loading || !settled) return null;
  if (status && status.mode !== 'off' && !status.unlocked) return <Navigate to="/?quiz=1" replace />;
  return children;
}
