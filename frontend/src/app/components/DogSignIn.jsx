import { useState } from 'react';
import ContactCapture from '../../components/auth/ContactCapture';
import LegacyNumberLogin from '../../components/auth/LegacyNumberLogin';

/* Shown by the /app area when nobody is signed in: dog profiles and their
   health records need an account (the server refuses them otherwise).

   - New here: the contact form gives this browser an account; then they can
     create a dog profile as before.
   - Already have a dog profile: number-only sign-in (TEMPORARY, until OTP;
     only numbers on the server's allowlist work).
   After either, DogsContext moves this browser's old dogs to the account and
   loads the list - no reload needed. */
const DogSignIn = () => {
  const [existing, setExisting] = useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px' }}>
      <div className="auth-box" style={{ maxWidth: 440, width: '100%', animation: 'none' }}>
        {existing ? (
          <>
            <h2 className="auth-title">Welcome back</h2>
            <p className="auth-sub">Sign in with the number your dog profile was made with.</p>
            <LegacyNumberLogin />
            <p style={{ textAlign: 'center', margin: '14px 0 0', fontSize: 14 }}>
              <button type="button" className="auth-signup" onClick={() => setExisting(false)}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--orange)', fontWeight: 700, font: 'inherit' }}>
                New here? Start with your details
              </button>
            </p>
          </>
        ) : (
          <>
            <ContactCapture
              title="Sign in to your dog profiles"
              sub="Your dogs' records are private to your account. New here? Give your details to start."
            />
            <p style={{ textAlign: 'center', margin: '14px 0 0', fontSize: 14 }}>
              <button type="button" className="auth-signup" onClick={() => setExisting(true)}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--orange)', fontWeight: 700, font: 'inherit' }}>
                Already have a dog profile? Sign in with your number
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default DogSignIn;
