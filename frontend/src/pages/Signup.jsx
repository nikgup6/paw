import { useNavigate, useLocation } from 'react-router-dom';
import ContactCapture from '../components/auth/ContactCapture';

/* Sign-up is the contact screen: every Continue makes a new account for this
   browser. There is no password and no sign-in by mobile number (no OTP yet). */
const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  return (
    <div id="auth-section" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--cream)', position: 'relative' }}>
      
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0' }}>
        <img src="/logo.png" alt="Paw Buddy" style={{ width: '140px', mixBlendMode: 'multiply', cursor: 'pointer' }} onClick={() => navigate('/')} />
        <button 
          onClick={() => navigate(-1)}
          style={{
            background: 'var(--orange)', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
            fontFamily: 'var(--font-body-family)', fontWeight: 'var(--weight-semibold)',
            transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(245,124,0,0.3)'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateX(-2px)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
        >
          ← Back
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="auth-box" style={{ maxWidth: '440px', width: '100%' }}>
        <div className="auth-logo">🐾</div>
        <ContactCapture
          title="Join Paw Buddy"
          sub="Tell us who you are to save your matches."
          onDone={() => navigate(from)}
        />

      </div>
      </div>
    </div>
  );
};

export default Signup;
