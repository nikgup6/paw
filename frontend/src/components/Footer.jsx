import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer id="main-footer">
      <div className="footer-logo">Paw Buddy</div>
      <p>India's first dog breed lifestyle advisor</p>
      <div className="footer-links">
        <span>7358444850</span>
        <span>pawbuddy.br@gmail.com</span>
        <Link to="/admin">Admin</Link>
      </div>
    </footer>
  );
};

export default Footer;
