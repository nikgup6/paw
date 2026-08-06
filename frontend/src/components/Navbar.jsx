import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav className="navbar" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', background: 'var(--cream)' }}>
      <Link to="/" style={{ textDecoration: 'none', color: 'var(--brown)', fontSize: '24px', fontWeight: '800' }}>
        🐾 Paw Buddy
      </Link>
      <div>
        {user ? (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span>Welcome, {user.name} 👋</span>
            {user.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
            <Link to="/profile">Profile</Link>
            <button onClick={logout} style={{ background: 'none', border: '1px solid var(--orange)', color: 'var(--orange)', padding: '8px 16px', borderRadius: '50px', cursor: 'pointer' }}>
              Log out
            </button>
          </div>
        ) : (
          <button style={{ background: 'var(--orange)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '50px', cursor: 'pointer' }}>
            Sign In
          </button> // We will connect this to a modal later
        )}
      </div>
    </nav>
  );
};

export default Navbar;
