import { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import QuickLoginModal from '../QuickLoginModal';
import PaywallSheet from './PaywallSheet';

/* What happens after "Unlock my full match":

     not signed in  ->  the contact screen (name + mobile)  ->  the paywall sheet
     signed in      ->  the paywall sheet

   Access belongs to the ACCOUNT, so paying needs one. If the account they sign
   into already has access (they paid on another device), the sheet is skipped.

   The step is worked out from who is signed in, not stored: signing in moves
   them on by itself, and an expired sign-in (the sheet signs them out) brings
   the sign-in back by itself.

   Home.jsx only says "open, for this reason" and what to do once unlocked. */

export default function UnlockFlow({ open, status, refreshStatus, onUnlocked, onCancel }) {
  const { user } = useContext(AuthContext);
  // True for the moment between signing in and hearing whether that account
  // already has access, so the sheet does not flash up and vanish.
  const [checking, setChecking] = useState(false);

  const step = !open ? null : !user ? 'signin' : checking ? null : 'sheet';

  const afterSignIn = async () => {
    setChecking(true);
    const s = await refreshStatus();
    setChecking(false);
    if (s?.unlocked) onUnlocked(s);
  };

  const afterPaying = async () => {
    const s = await refreshStatus();
    onUnlocked(s);
  };

  return (
    <>
      <QuickLoginModal
        isOpen={step === 'signin'}
        onSuccess={afterSignIn}
        onClose={onCancel}
        title="Your details first"
        sub="Your unlock is saved on this phone and browser. Just your name and number."
      />
      {/* Mounted only while open, so every opening starts from a clean sheet. */}
      {step === 'sheet' && <PaywallSheet open status={status} onClose={onCancel} onUnlocked={afterPaying} />}
    </>
  );
}
