import { Link } from 'react-router-dom';
import { LEGAL_LINKS, SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP } from '../../constants/contact';

/* The shared frame for /terms, /privacy, /refunds and /contact.

   Every page carries a visible DRAFT notice: these are placeholders written so
   the site has the pages a payment gateway checks for. They make no legal
   claims beyond facts about how the site works, and must be replaced with the
   real, reviewed policy text before going live. */

export function ContactLines() {
  return (
    <ul className="pblg__contact">
      <li>Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
      <li>WhatsApp: <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">{SUPPORT_PHONE_DISPLAY}</a></li>
    </ul>
  );
}

export default function LegalPage({ title, updated, children }) {
  return (
    <main className="pblg">
      <style>{CSS}</style>
      {/* TODO: replace with the real policy. Shown on the page on purpose. */}
      <p className="pblg__draft" role="note">
        Draft. This page is a placeholder and will be replaced with our full policy.
      </p>
      <h1 className="pblg__title">{title}</h1>
      {updated && <p className="pblg__updated">Last updated {updated}</p>}
      <div className="pblg__body">{children}</div>
      <nav className="pblg__nav" aria-label="Policies">
        {LEGAL_LINKS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
      </nav>
    </main>
  );
}

const CSS = `
.pblg{box-sizing:border-box;max-width:760px;margin:0 auto;padding:96px 16px 64px;color:#011E4A;font-family:'Figtree',system-ui,sans-serif;line-height:1.6}
.pblg__draft{margin:0 0 20px;padding:10px 14px;border-radius:12px;background:#FFE9B8;color:#5C3D00;font-weight:700;font-size:14px}
.pblg__title{margin:0 0 4px;font-family:'Gabarito',system-ui,sans-serif;font-weight:800;font-size:40px;line-height:1.1;letter-spacing:-.01em}
.pblg__updated{margin:0 0 24px;color:#3C4F6B;font-size:14px}
.pblg__body h2{margin:28px 0 8px;font-family:'Gabarito',system-ui,sans-serif;font-size:22px}
.pblg__body p,.pblg__body li{font-size:16px}
.pblg__body a,.pblg__contact a,.pblg__nav a{color:#C84B0A;font-weight:700}
.pblg__contact{padding-left:20px}
.pblg__nav{display:flex;flex-wrap:wrap;gap:4px 20px;margin-top:40px;padding-top:16px;border-top:1px solid #FFD9BD}
.pblg__nav a{display:inline-flex;align-items:center;min-height:44px}
.pblg :focus-visible{outline:3px solid #F5691A;outline-offset:2px}
@media (max-width:600px){.pblg{padding-top:80px}.pblg__title{font-size:32px}}
`;
