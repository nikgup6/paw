import { Link, useLocation } from 'react-router-dom';
import { ToySlots, footerToysAllowed } from './fun/SqueakyToy';
import { useToys } from './fun/ToyContext';
import { LEGAL_LINKS, SUPPORT_EMAIL } from '../constants/contact';

const Footer = () => {
  const { pathname } = useLocation();
  const { enabled } = useToys();
  return (
    <>
    {/* A small pile of squeaky toys resting on the footer's top edge. The strip is empty on purpose, so they never cover
        anything above. Not shown on login, signup, admin, the owner app or the quiz page (see FOOTER_TOY_PATHS). */}
    {enabled && footerToysAllowed(pathname) && (
      <div style={{ position: 'relative', height: 100 }}>
        <ToySlots group="footer" page="footer" />
      </div>
    )}
    <footer id="main-footer">
      <div className="footer-logo">Paw Buddy</div>
      <p>India's first dog breed lifestyle advisor</p>
      <div className="footer-links">
        <span>7358444850</span>
        <span>{SUPPORT_EMAIL}</span>
        <Link to="/play">Play</Link>
        {LEGAL_LINKS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
        <Link to="/admin">Admin</Link>
      </div>
    </footer>
    </>
  );
};

export default Footer;
