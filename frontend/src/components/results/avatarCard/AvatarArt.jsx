import React, { useState } from 'react';
import { AVATAR_OPTIONS, HAIR_COLOUR, findOption } from '../../../constants/avatarOptions';
import DogArt from '../../quiz/DogArt';

/* The drawings for the "See us together" card: a flat avatar, a sofa, and the card itself.
   All original art, all drawn in code (SVG). Nothing is fetched or generated at runtime. */

const HairShape = ({ shape }) => (shape.type === 'circle'
  ? <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={HAIR_COLOUR} />
  : <path d={shape.d} fill={HAIR_COLOUR} />);

/** A seated person, front view. viewBox 0 0 120 150. */
export function Avatar({ skin, hair, outfit, width = 120 }) {
  const sk = findOption(AVATAR_OPTIONS.skins, skin).color;
  const hr = findOption(AVATAR_OPTIONS.hairs, hair);
  const of = findOption(AVATAR_OPTIONS.outfits, outfit).color;
  return (
    <svg viewBox="0 0 120 150" width={width} height={Math.round((width * 150) / 120)} aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      {hr.back.map((s, i) => <HairShape key={`b${i}`} shape={s} />)}
      {/* legs and shoes */}
      <rect x="32" y="100" width="22" height="38" rx="11" fill="#33415C" />
      <rect x="66" y="100" width="22" height="38" rx="11" fill="#33415C" />
      <ellipse cx="43" cy="141" rx="14" ry="6" fill="#FFFFFF" stroke="#011E4A" strokeWidth="2" />
      <ellipse cx="77" cy="141" rx="14" ry="6" fill="#FFFFFF" stroke="#011E4A" strokeWidth="2" />
      {/* neck, top, arms */}
      <rect x="53" y="44" width="14" height="12" fill={sk} />
      <path d="M28 66C28 54 40 49 60 49C80 49 92 54 92 66L95 108L25 108Z" fill={of} />
      <ellipse cx="28" cy="94" rx="8" ry="16" fill={of} />
      <ellipse cx="92" cy="94" rx="8" ry="16" fill={of} />
      <circle cx="30" cy="110" r="7" fill={sk} />
      <circle cx="90" cy="110" r="7" fill={sk} />
      {/* head and face */}
      <circle cx="40" cy="34" r="5" fill={sk} />
      <circle cx="80" cy="34" r="5" fill={sk} />
      <circle cx="60" cy="33" r="21" fill={sk} />
      <circle cx="52" cy="34" r="2.3" fill="#011E4A" />
      <circle cx="68" cy="34" r="2.3" fill="#011E4A" />
      <path d="M52 42C56 47 64 47 68 42" fill="none" stroke="#011E4A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="47" cy="41" r="3.2" fill="#F59B8C" opacity=".45" />
      <circle cx="73" cy="41" r="3.2" fill="#F59B8C" opacity=".45" />
      {hr.front.map((s, i) => <HairShape key={`f${i}`} shape={s} />)}
    </svg>
  );
}

/** A simple flat sofa. viewBox 0 0 900 360. */
export function Sofa({ width = 900 }) {
  return (
    <svg viewBox="0 0 900 360" width={width} height={Math.round((width * 360) / 900)} aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <rect x="90" y="20" width="720" height="210" rx="70" fill="#C9D9EE" />
      <rect x="20" y="130" width="130" height="190" rx="55" fill="#9DB7DB" />
      <rect x="750" y="130" width="130" height="190" rx="55" fill="#9DB7DB" />
      <rect x="110" y="180" width="680" height="140" rx="46" fill="#B4C9E6" />
      <rect x="110" y="180" width="330" height="70" rx="34" fill="#C9D9EE" />
      <rect x="460" y="180" width="330" height="70" rx="34" fill="#C9D9EE" />
      <rect x="95" y="320" width="26" height="36" rx="8" fill="#011E4A" />
      <rect x="779" y="320" width="26" height="36" rx="8" fill="#011E4A" />
      <rect x="640" y="86" width="120" height="110" rx="30" fill="#F5691A" transform="rotate(8 700 140)" />
    </svg>
  );
}

/** The whole 1080 x 1350 card (4:5, Instagram story friendly). Plain inline styles so html2canvas copies it faithfully.
    Props: name (may be empty), avatar ({skin, hair, outfit}), breed (the #1 match), host (the site's address). */
export const cardCaption = (name, breed) => `${name && name.trim() ? name.trim() : 'Me'} + ${breed.name} · matched on PAW BUDDY`;

export default function AvatarCardArt({ id, name, avatar, breed, host, offscreen = false }) {
  const [imgFailed, setImgFailed] = useState(false);
  const who = name && name.trim() ? name.trim() : 'Me';
  return (
    <div
      id={id}
      aria-hidden={offscreen ? 'true' : undefined}
      style={{ width: 1080, height: 1350, boxSizing: 'border-box', padding: '70px 64px 60px', background: 'linear-gradient(180deg,#FBF8F4 0%,#FFE9D8 100%)', color: '#011E4A', fontFamily: "'Satoshi','Segoe UI',sans-serif", position: 'relative', overflow: 'hidden', ...(offscreen ? { position: 'fixed', left: -10000, top: 0 } : null) }}
    >
      <div style={{ position: 'absolute', top: -140, right: -140, width: 420, height: 420, borderRadius: '50%', background: '#FFD9BD', opacity: 0.55 }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 54, letterSpacing: 1 }}>
          <span style={{ color: '#011E4A' }}>PAW </span><span style={{ color: '#F5691A' }}>BUDDY</span>
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 56, fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 66, lineHeight: 1.12 }}>
        {who} + {breed.name}
        <span style={{ fontSize: 40, fontWeight: 600, color: '#4A5568', fontFamily: "'Satoshi',sans-serif" }}> · matched on PAW BUDDY</span>
      </div>

      {/* the scene: sofa, the person, and the matched dog in a round frame on the seat */}
      <div style={{ position: 'relative', marginTop: 40, height: 600 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><Sofa width={952} /></div>
        <div style={{ position: 'absolute', left: 120, bottom: 66 }}><Avatar skin={avatar.skin} hair={avatar.hair} outfit={avatar.outfit} width={350} /></div>
        <div style={{ position: 'absolute', left: 500, bottom: 118, width: 380, height: 380, borderRadius: '50%', border: '12px solid #FFFFFF', boxShadow: '0 0 0 12px #FFD9BD, 0 20px 40px rgba(245,105,26,.3)', background: '#E3ECF7', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {imgFailed ? (
            <DogArt mood="sit" width={340} />
          ) : (
            <img
              src={`/${breed.img}`}
              alt=""
              crossOrigin="anonymous"
              onError={() => setImgFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 40, display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ background: '#F5691A', color: '#011E4A', borderRadius: 999, padding: '14px 40px', fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: 64 }}>
          {breed.matchPercentage}% match
        </div>
        <div style={{ fontSize: 34, fontWeight: 700, color: '#4A5568' }}>{breed.label}</div>
      </div>

      <div style={{ position: 'absolute', left: 64, right: 64, bottom: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 32, fontWeight: 700 }}>Find the dog that fits your life.</div>
        {host && <div style={{ background: '#011E4A', color: '#fff', borderRadius: 999, padding: '12px 30px', fontSize: 30, fontWeight: 700 }}>{host}</div>}
      </div>
    </div>
  );
}
