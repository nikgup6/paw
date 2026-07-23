import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { buildLivingConditions, generateProsCons } from '../utils/breedUtils';
import { buildWhatsAppEnquiryLink, WHATSAPP_DISPLAY } from '../utils/whatsapp';
import WhatsAppButton from './WhatsAppButton';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const BreedProfileModal = ({ breed, user, onClose }) => {
  const [view, setView] = useState('profile'); // 'profile', 'buy', 'success'
  const [showAuthWarning, setShowAuthWarning] = useState(false);
  const [waLink, setWaLink] = useState('');
  const navigate = useNavigate();

  if (!breed) return null;

  const handleBuyClick = () => {
    // Login removed — the buy/adoption request no longer requires an account.
    // (The "Login Required" warning code below is kept but no longer triggered.)
    setView('buy');
  };

  const submitBuyRequest = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const mobile = formData.get('mobile');
    const intent = formData.get('intent');

    // Open WhatsApp with a pre-filled, per-user/per-breed message. Do this
    // synchronously inside the click so pop-up blockers don't stop it.
    const link = buildWhatsAppEnquiryLink(name, breed.name, intent);
    setWaLink(link);
    window.open(link, '_blank', 'noopener,noreferrer');

    // Still capture the lead in the background (best effort — never blocks WA).
    axios.post(`${API_URL}/api/buy`, {
      user_id: user?.id || null,
      user_name: name,
      mobile: mobile || 'Via WhatsApp',
      city: user?.city || 'Not Provided',
      breed_name: breed.name,
      intent,
      status: "NEW"
    }).catch(() => { /* lead capture is best-effort */ });

    setView('success');
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, fontFamily: "'Fredoka', sans-serif", padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '800px', maxHeight: '90dvh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" title="Close" style={{ position: 'absolute', top: '16px', right: '16px', background: 'var(--cream)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '50%', width: '40px', height: '40px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, color: 'var(--brown)' }}>×</button>

        {showAuthWarning && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.95)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '20px', padding: '20px', textAlign: 'center' }}>
            <h3 style={{ color: '#c62828', marginBottom: '15px', fontSize: '24px' }}>Login Required</h3>
            <p style={{ color: 'var(--text-soft)', marginBottom: '25px', maxWidth: '300px' }}>You need to be logged in to raise a buy request and connect with our verified breeders.</p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => navigate('/login')} style={{ padding: '12px 25px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer' }}>Go to Login</button>
              <button onClick={() => setShowAuthWarning(false)} style={{ padding: '12px 25px', background: 'transparent', color: 'var(--text-soft)', border: '1px solid #ddd', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {view === 'success' && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '50px', marginBottom: '10px' }}>💬</div>
            <h3 style={{ color: 'var(--orange)', marginBottom: '15px' }}>We've opened WhatsApp for you!</h3>
            <p style={{ color: 'var(--text-soft)' }}>Just hit send on the chat to reach us. If WhatsApp didn't open, use the button below or message us at {WHATSAPP_DISPLAY}.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <WhatsAppButton type="button" style={{ padding: '12px 24px' }}>Open WhatsApp</WhatsAppButton>
                </a>
              )}
              <button onClick={onClose} style={{ padding: '12px 30px', background: 'var(--cream)', color: 'var(--brown)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
            </div>
          </div>
        )}

        {view === 'buy' && (
          <div>
            <h3 style={{ marginBottom: '10px', color: 'var(--orange)' }}>Interest in {breed.name}</h3>
            <p style={{ marginBottom: '20px', color: 'var(--text-soft)', fontSize: '14px', background: '#ffe0b2', padding: '10px', borderRadius: '8px' }}>The breeder is only available at Hyderabad currently.</p>
            <form onSubmit={submitBuyRequest} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input name="name" defaultValue={user?.name || ''} placeholder="Your Name" required style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
              <input name="mobile" defaultValue={user?.mobile || ''} placeholder="Mobile Number" required style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
              <select name="intent" required style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }}>
                <option value="">Select Intent</option>
                <option value="Ready to buy immediately">Ready to buy immediately</option>
                <option value="Looking to buy next month">Looking to buy next month</option>
                <option value="Just inquiring">Just inquiring</option>
              </select>
              <WhatsAppButton type="submit" style={{ marginTop: '10px' }} />
              <button type="button" onClick={() => setView('profile')} style={{ padding: '15px', background: 'transparent', color: 'var(--text-soft)', border: 'none', cursor: 'pointer', marginTop: '-5px', fontWeight: 600 }}>← Back to Profile</button>
            </form>
          </div>
        )}

        {view === 'profile' && (
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 250px' }}>
              <img src={`/${breed.img}`} alt={breed.name} style={{ width: '100%', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
              
              <button onClick={handleBuyClick} style={{ width: '100%', marginTop: '20px', padding: '15px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '18px', boxShadow: '0 4px 15px rgba(255,107,43,0.3)' }}>Buy Now</button>
              
              <div style={{ marginTop: '20px', padding: '15px', background: 'var(--cream)', borderRadius: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--orange)' }}>Quick Stats</h4>
                <p style={{ margin: '5px 0', fontSize: '14px' }}><strong style={{color: 'var(--brown)'}}>Size:</strong> {breed.size}</p>
                <p style={{ margin: '5px 0', fontSize: '14px' }}><strong style={{color: 'var(--brown)'}}>Shedding:</strong> {breed.shedding}</p>
                <p style={{ margin: '5px 0', fontSize: '14px' }}><strong style={{color: 'var(--brown)'}}>Energy:</strong> {breed.energy}</p>
                <p style={{ margin: '5px 0', fontSize: '14px' }}><strong style={{color: 'var(--brown)'}}>Apartment Friendly:</strong> {breed.apt}</p>
              </div>
              <div style={{ marginTop: '15px', padding: '15px', background: '#ffebee', borderRadius: '15px' }}>
                 <h4 style={{ margin: '0 0 10px 0', color: '#c62828' }}>Monthly Cost Estimate</h4>
                 <div style={{ margin: 0, color: '#c62828', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                   {(() => {
                     const costStr = breed.cost;
                     const breakdownMatch = costStr.match(/\[Breakdown:\s*(.*?)\]/i);
                     const mainCostMatch = costStr.split('[')[0];
                     const sourceMatch = costStr.match(/\]\s*(Source:.*)/i);

                     const mainCost = mainCostMatch ? mainCostMatch.replace(/\/month/gi, '').trim() : costStr;
                     const breakdownItems = breakdownMatch ? breakdownMatch[1].split('|').map(s => s.trim()) : [];
                     const source = sourceMatch ? sourceMatch[1].replace(/\/month/gi, '').trim() : '';

                     if (breakdownItems.length === 0) {
                       return <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{costStr}</div>;
                     }

                     return (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                         <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px', textAlign: 'center', background: 'rgba(198, 40, 40, 0.1)', padding: '10px', borderRadius: '10px' }}>
                           {mainCost} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>/ month</span>
                         </div>
                         
                         {breakdownItems.map((item, i) => {
                           const parts = item.split(/(?=Rs\.)/i);
                           const label = parts[0]?.trim();
                           const val = parts.slice(1).join('').trim();
                           return (
                             <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: '1px solid rgba(198, 40, 40, 0.1)', paddingBottom: '4px' }}>
                               <span style={{ fontWeight: 600 }}>{label}</span>
                               <span>{val}</span>
                             </div>
                           );
                         })}
                       </div>
                     );
                   })()}
                 </div>
              </div>
            </div>
            <div style={{ flex: '2 1 300px' }}>
              <h3 style={{ color: 'var(--brown)', marginBottom: '5px', fontSize: '28px' }}>{breed.name}</h3>
              <p style={{ color: 'var(--text-soft)', marginBottom: '20px', fontStyle: 'italic' }}>{breed.purpose}</p>


              
              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ color: 'var(--orange)', marginBottom: '15px', fontSize: '18px' }}>Best Living Conditions</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {buildLivingConditions(breed).map((cond, i) => (
                    <div key={i} style={{ background: '#f8f9fa', padding: '12px 15px', borderRadius: '10px', fontSize: '14px' }}>
                      <strong style={{ color: 'var(--brown)' }}>{cond.label}:</strong> {cond.text}
                    </div>
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div style={{ background: 'var(--cream)', padding: '15px', borderRadius: '15px' }}>
                  <h4 style={{ color: 'var(--orange)', marginBottom: '8px' }}>Ideal Indian Cities</h4>
                  <p style={{ fontSize: '14px', margin: 0, color: 'var(--text-soft)' }}>{breed.idealCities}</p>
                </div>
                <div style={{ background: 'var(--cream)', padding: '15px', borderRadius: '15px' }}>
                  <h4 style={{ color: 'var(--orange)', marginBottom: '8px' }}>Common Health Issues</h4>
                  <p style={{ fontSize: '14px', margin: 0, color: 'var(--text-soft)' }}>{breed.health}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BreedProfileModal;
