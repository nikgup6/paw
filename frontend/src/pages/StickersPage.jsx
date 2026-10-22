import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import StickerPack from '../components/results/StickerPack';
import { STICKER_PACKS, STICKERS_LIVE } from '../constants/stickers';

/* /stickers — every pack on one page, so it can be linked from a reel or the home page.
   While STICKERS_LIVE is false (no art yet) this route sends people home rather than showing
   a page full of broken images. */
export default function StickersPage() {
  if (!STICKERS_LIVE) return <Navigate to="/" replace />;

  return (
    <div className="pbstp">
      <style>{`
        .pbstp{box-sizing:border-box;max-width:900px;margin:0 auto;padding:24px 16px 72px;background:#FBF8F4;color:#011E4A;font-family:'Satoshi',system-ui,sans-serif}
        .pbstp__kicker{margin:0;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#F5691A}
        .pbstp__h1{margin:6px 0 0;font-family:'Fredoka',sans-serif;font-weight:700;font-size:clamp(28px,7vw,40px);line-height:1.1}
        .pbstp__lede{margin:10px 0 0;font-size:16px;line-height:1.55;color:#4A5568}
        .pbstp__cta{margin-top:30px;text-align:center}
        .pbstp__cta a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:999px;background:#011E4A;color:#fff;font-weight:700;font-size:15px;text-decoration:none}
        @media (min-width:760px){.pbstp{padding:40px 24px 90px}}
      `}</style>

      <header>
        <p className="pbstp__kicker">Sticker packs</p>
        <h1 className="pbstp__h1">Stickers for your dog</h1>
        <p className="pbstp__lede">
          Eight stickers per breed. Tap one to share it, or take the whole pack as a zip.
        </p>
      </header>

      {STICKER_PACKS.map((pack) => (
        <StickerPack key={pack.key} pack={pack} />
      ))}

      <p className="pbstp__cta">
        <Link to="/">Find the breed that fits your life &rarr;</Link>
      </p>
    </div>
  );
}
