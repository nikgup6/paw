import React from 'react';
import { HEAT } from '../../constants/heatData';
import { shareBase } from '../../constants/site';

/* The Instagram-story card (1080 x 1920) that gets turned into an image by html2canvas.
   It is mounted off-screen only while a share is being prepared, then removed.
   Plain inline styles on purpose: html2canvas copies computed styles, and a stylesheet that
   has not applied yet would come out blank. */
export const HEAT_CARD_ID = 'heat-share-card';

export default function HeatShareCard({ breed, city, month, verdict }) {
  const monthName = HEAT.MONTHS[month];
  // The live domain is not set yet (constants/site.js), so this falls back to the current origin
  // and simply prints nothing rather than inventing an address.
  const host = (() => { try { return new URL(shareBase()).host; } catch { return ''; } })();
  return (
    <div
      id={HEAT_CARD_ID}
      style={{
        position: 'fixed', left: -20000, top: 0, width: 1080, height: 1920, boxSizing: 'border-box',
        padding: '120px 90px', background: '#FBF8F4', color: '#011E4A',
        fontFamily: "'Satoshi', 'Segoe UI', sans-serif", display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F5691A' }}>
        Paw Buddy
      </div>

      <div style={{ marginTop: 120, fontSize: 76, lineHeight: 1.15, fontWeight: 700, fontFamily: "'Fredoka', 'Satoshi', sans-serif" }}>
        Will a {breed} survive {city} in {monthName}?
      </div>

      <div style={{ marginTop: 90, padding: '70px 60px', borderRadius: 48, background: verdict.colour, color: '#FFFFFF' }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.9 }}>
          The verdict
        </div>
        <div style={{ marginTop: 18, fontSize: 92, fontWeight: 700, fontFamily: "'Fredoka', 'Satoshi', sans-serif" }}>
          {verdict.label}
        </div>
      </div>

      <div style={{ marginTop: 70, fontSize: 42, lineHeight: 1.45, color: '#4A5568' }}>
        {verdict.reason}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontSize: 30, lineHeight: 1.5, color: '#6B7686' }}>
          A guide, not veterinary advice.
        </div>
        {host && (
          <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 22 }}>
            <span style={{ background: '#011E4A', color: '#fff', borderRadius: 999, padding: '20px 44px', fontSize: 34, fontWeight: 700 }}>
              {host}/heat-check
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
