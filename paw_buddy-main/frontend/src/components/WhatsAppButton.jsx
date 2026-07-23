import React from 'react';

// Official WhatsApp glyph (phone in a speech bubble).
export const WhatsAppIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M16.004 0h-.008C7.174 0 .001 7.176.001 16c0 3.5 1.13 6.744 3.05 9.38L1.05 31.36l6.156-1.968A15.9 15.9 0 0 0 16.004 32C24.83 32 32 24.822 32 16S24.83 0 16.004 0zm9.312 22.598c-.386 1.09-1.918 1.994-3.14 2.258-.836.178-1.928.32-5.604-1.204-4.703-1.95-7.73-6.73-7.965-7.04-.226-.31-1.9-2.53-1.9-4.826s1.206-3.42 1.634-3.89c.352-.386.766-.562 1.02-.562.246 0 .492.002.707.012.226.01.53-.086.828.632.306.736 1.04 2.542 1.13 2.728.092.186.152.404.028.65-.116.246-.174.398-.348.612-.174.214-.366.478-.522.642-.174.184-.354.384-.152.73.202.346.898 1.482 1.928 2.4 1.326 1.182 2.444 1.548 2.79 1.722.346.174.548.146.75-.088.202-.234.866-1.01 1.096-1.356.23-.346.46-.288.776-.172.316.116 2.01.948 2.356 1.122.346.174.576.26.662.404.086.146.086.836-.3 1.926z" />
  </svg>
);

// Green, brand-styled "WhatsApp Us" button. Works as a form submit (type="submit")
// or a plain button. Pass any extra style overrides via `style`.
const WhatsAppButton = ({ type = 'button', onClick, children = 'WhatsApp Us', style }) => (
  <button
    type={type}
    onClick={onClick}
    onMouseOver={(e) => { e.currentTarget.style.background = '#1EBE5B'; }}
    onMouseOut={(e) => { e.currentTarget.style.background = '#25D366'; }}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '15px',
      background: '#25D366',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontWeight: 'bold',
      fontSize: '16px',
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
      transition: 'background 0.2s ease',
      ...style,
    }}
  >
    <WhatsAppIcon />
    {children}
  </button>
);

export default WhatsAppButton;
