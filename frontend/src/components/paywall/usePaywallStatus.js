import { useCallback, useEffect, useState } from 'react';
import { getPaywallStatus } from '../../utils/paywall';

/* The server's answer to "is there a paywall, what does it cost, is this account
   unlocked?". Asked when the page loads and whenever the signed-in account
   changes - which is also how someone who paid in their UPI app and closed the
   tab gets in on their next visit: Razorpay's webhook has already unlocked the
   account, and this simply reads that.

   If the server cannot be asked (offline, down), the result is null and the
   quiz runs without a paywall. That fails OPEN on purpose: a pilot visitor
   should never be stuck on a broken gate. It is also no weaker than the gate
   itself, because the matching runs in the browser anyway (see the summary). */

export default function usePaywallStatus(userId) {
  const [status, setStatus] = useState(null);
  const [settled, setSettled] = useState(false);   // the first answer (or failure) has arrived

  useEffect(() => {
    let live = true;
    getPaywallStatus()
      .then((s) => { if (live) { setStatus(s); setSettled(true); } })
      .catch(() => { if (live) { setStatus(null); setSettled(true); } });
    return () => { live = false; };
  }, [userId]);

  /** Ask again now (after signing in or paying); resolves with the fresh status. */
  const refresh = useCallback(async () => {
    try {
      const s = await getPaywallStatus();
      setStatus(s);
      return s;
    } catch {
      setStatus(null);
      return null;
    }
  }, []);

  return [status, refresh, settled];
}
