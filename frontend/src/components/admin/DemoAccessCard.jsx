import { useCallback, useEffect, useState } from 'react';
import { cancelDemoAccess, getPaywallStatus } from '../../utils/paywall';

/* Payment demo — this admin account's own paywall access. In live mode an admin
   pays with Razorpay TEST keys (no real money), and that unlocks for a day.
   "Cancel subscription" ends it now so the paywall shows again for the next
   demo. It only ever touches the signed-in admin's account. */

const MODE_LABEL = {
  off: 'Paywall off',
  fake_door: 'Fake door (no money taken)',
  test: 'Razorpay test (no real money)',
  live: 'Razorpay live (real money)',
};

const DemoAccessCard = () => {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try { setStatus(await getPaywallStatus()); } catch { setStatus(null); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cancel = async () => {
    if (!window.confirm('Cancel this admin account’s access? The paywall will show again on your next visit to the quiz.')) return;
    setBusy(true);
    setMessage('');
    try {
      await cancelDemoAccess();
      setMessage('Cancelled. The paywall will show again for your demo.');
      await load();
    } catch (e) {
      setMessage(e?.response?.status === 401 || e?.response?.status === 403
        ? 'Your administrator session has expired. Please sign in again.'
        : 'Couldn’t cancel right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const until = status?.unlocked_until ? new Date(status.unlocked_until) : null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.7)', border: '1px solid white', borderRadius: '20px',
      boxShadow: 'var(--shadow)', padding: '20px 24px', marginBottom: '24px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
    }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--weight-semibold)', color: 'var(--brown)', margin: '0 0 4px' }}>
          Payment demo
        </h3>
        <p style={{ color: 'var(--text-soft)', fontSize: '13px', margin: 0 }}>
          Your payment mode: <strong>{status ? (MODE_LABEL[status.mode] || status.mode) : '—'}</strong>
          {' · '}
          {status?.unlocked && until
            ? <>Unlocked until {until.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
            : status?.unlocked ? 'Unlocked' : 'Not unlocked'}
        </p>
        {message && <p role="status" style={{ color: 'var(--brown)', fontSize: '13px', margin: '6px 0 0' }}>{message}</p>}
      </div>
      <button
        type="button"
        onClick={cancel}
        disabled={busy || !status?.unlocked || status?.mode === 'off'}
        style={{
          padding: '9px 18px', minHeight: '40px', borderRadius: '50px', border: 'none',
          background: '#C62828', color: 'white', fontWeight: 'bold', fontSize: '13px',
          boxShadow: 'var(--shadow)',
          cursor: busy || !status?.unlocked ? 'not-allowed' : 'pointer',
          opacity: busy || !status?.unlocked || status?.mode === 'off' ? 0.5 : 1,
        }}
      >
        {busy ? 'Cancelling…' : 'Cancel subscription'}
      </button>
    </div>
  );
};

export default DemoAccessCard;
