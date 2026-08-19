import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useBreedList } from '../context/BreedsContext';
import { buildLivingConditions } from '../utils/breedUtils';
import { buildWhatsAppEnquiryLink, WHATSAPP_DISPLAY } from '../utils/whatsapp';
import WhatsAppButton from './WhatsAppButton';
import BreederDirectory from './BreederDirectory';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const BreedModal = ({ breed, modalType, onClose, setModalType, user }) => {
  const breedsData = useBreedList();
  const navigate = useNavigate();
  const [compareList, setCompareList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [waLink, setWaLink] = useState('');
  const compareRef = useRef(null);

  useEffect(() => {
    if (modalType === 'compare' && breed) {
      setCompareList([breed]);
    }
  }, [modalType, breed]);

  const downloadPDF = async () => {
    const element = compareRef.current;
    if (!element) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
      pdf.save('pawbuddy-comparison.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const addBreedToCompare = () => {
    const found = breedsData.find(b => b.name.toLowerCase() === searchQuery.trim().toLowerCase());
    if (found) {
      if (!compareList.find(c => c.name === found.name)) {
        setCompareList([...compareList, found]);
      } else {
        alert('Already in comparison.');
      }
      setSearchQuery('');
    } else {
      alert('Breed not found.');
    }
  };

  /** Logged when the user opens a breeder's WhatsApp chat. Best effort only. */
  const logBreederContact = (breeder) => {
    axios.post(`${API_URL}/api/buy`, {
      user_id: user?.id || null,
      user_name: user?.name || 'Guest',
      mobile: user?.mobile || 'Via breeder WhatsApp',
      city: user?.city || 'Not Provided',
      breed_name: breed?.name,
      intent: `Contacted breeder: ${breeder.name} (${breeder.city})`,
      status: "NEW"
    }).catch(() => { /* best effort */ });
  };

  if (!modalType || (!breed && modalType !== 'buy_success')) return null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: 'var(--font-body-family)', padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: modalType === 'image_preview' ? 'transparent' : 'white', padding: modalType === 'image_preview' ? '0' : '30px', borderRadius: '20px', width: '100%', maxWidth: modalType === 'compare' ? '900px' : (modalType === 'full_profile' ? '800px' : (modalType === 'buy' ? '900px' : '500px')), maxHeight: '90dvh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: modalType === 'image_preview' ? '-40px' : '20px', right: modalType === 'image_preview' ? '0' : '20px', background: 'var(--cream)', border: 'none', borderRadius: '50%', width: '35px', height: '35px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>×</button>
        
        {modalType === 'image_preview' && breed && (
          <div style={{ textAlign: 'center', background: 'white', padding: '20px', borderRadius: '15px' }}>
            <img src={`/${breed.img}`} alt={breed.name} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '10px' }} />
            <h3 style={{ marginTop: '15px', color: 'var(--brown)', fontSize: '24px' }}>{breed.name}</h3>
          </div>
        )}
        
        {modalType === 'buy' && breed && (
          <>
            {/* Login removed — the buy request no longer requires an account.
                The "Login Required" screen below is kept but no longer shown. */}
            {false ? (
              <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                <div style={{ fontSize: '50px', marginBottom: '15px' }}>🔒</div>
                <h3 style={{ color: 'var(--brown)', marginBottom: '15px', fontSize: '24px' }}>Login Required</h3>
                <p style={{ color: 'var(--text-soft)', marginBottom: '25px' }}>You must be logged in to request a puppy.</p>
                <button onClick={() => navigate('/login')} style={{ padding: '12px 30px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
                  Log In Now
                </button>
              </div>
            ) : (
              <BreederDirectory
                userCity={user?.city || null}
                breedName={breed.name}
                topBreeds={[]}
                onContact={logBreederContact}
              />
            )}
          </>
        )}

        {modalType === 'buy_success' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
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

        {modalType === 'full_profile' && breed && (
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 250px' }}>
              <img src={`/${breed.img}`} alt={breed.name} style={{ width: '100%', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
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
              <button onClick={() => setModalType('buy')} style={{ width: '100%', padding: '15px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px', fontSize: '16px' }}>
                Request to Buy
              </button>
            </div>
            <div style={{ flex: '2 1 300px' }}>
              <h3 style={{ color: 'var(--brown)', marginBottom: '5px', fontSize: '28px' }}>{breed.name}</h3>
              <p style={{ color: 'var(--text-soft)', marginBottom: '20px', fontStyle: 'italic' }}>{breed.purpose}</p>
              
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: 'var(--orange)', marginBottom: '10px' }}>Good for:</h4>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {breed.tags && breed.tags.map(t => <span key={t} style={{ background: 'var(--orange-pale)', color: 'var(--orange)', padding: '5px 15px', borderRadius: '50px', fontSize: '13px', fontWeight: 600 }}>{t}</span>)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--white)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <h4 style={{ color: 'var(--brown)', marginBottom: '8px', fontSize: '14px' }}>Grooming Needs</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-color)', margin: 0 }}>{breed.grooming}</p>
                </div>
                <div style={{ background: 'var(--white)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <h4 style={{ color: 'var(--brown)', marginBottom: '8px', fontSize: '14px' }}>Time Required</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-color)', margin: 0 }}>{breed.time}</p>
                </div>
              </div>

              <div style={{ background: '#f5f7fa', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
                <h4 style={{ color: '#2c3e50', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🌡️</span> Climate & Housing
                </h4>
                <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{breed.climate}</p>
              </div>

              <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
                <h4 style={{ color: '#e65100', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️</span> Health & Risk
                </h4>
                <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 10px 0' }}><strong>Health Issues:</strong> {breed.health}</p>
                <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}><strong>Risk Profile:</strong> {breed.risk}</p>
              </div>

            </div>
          </div>
        )}

        {modalType === 'compare' && (
          <div>
            <h3 style={{ marginBottom: '10px', color: 'var(--orange)' }}>Compare Breeds</h3>
            <p style={{ marginBottom: '20px', color: 'var(--text-soft)', fontSize: '14px' }}>See how these breeds stack up across different parameters.</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', position: 'relative', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', position: 'relative' }}>
                <input 
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Add a breed to compare... (e.g. Beagle)" 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', fontFamily: 'var(--font-body-family)' }}
                />
                {searchQuery.trim().length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: 'white', border: '1px solid #ddd', borderRadius: '10px', maxHeight: '200px', overflowY: 'auto', zIndex: 10, marginTop: '5px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                    {breedsData.filter(b => b.name.toLowerCase().includes(searchQuery.trim().toLowerCase())).map(b => (
                      <div 
                        key={b.name} 
                        onClick={() => {
                          if (!compareList.find(c => c.name === b.name)) {
                            setCompareList([...compareList, b]);
                          } else {
                            alert('Already in comparison.');
                          }
                          setSearchQuery('');
                        }} 
                        style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #eee', transition: 'background 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.background = '#f9f9f9'}
                        onMouseOut={e => e.currentTarget.style.background = 'white'}
                      >
                        <img src={`/${b.img}`} alt={b.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', marginRight: '10px' }} />
                        {b.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={addBreedToCompare} style={{ padding: '10px 24px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', flex: '0 1 auto', whiteSpace: 'nowrap' }}>Add to Compare</button>
            </div>
            <div ref={compareRef} style={{ overflowX: 'auto', background: 'var(--cream)', borderRadius: '15px', padding: '15px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed', wordWrap: 'break-word', minWidth: '320px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '35%', padding: '10px 5px', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>Feature</th>
                    {compareList.map(b => (
                      <th key={b.name} style={{ width: `${65 / Math.max(1, compareList.length)}%`, padding: '10px 5px', borderBottom: '2px solid rgba(0,0,0,0.1)', textAlign: 'center' }}>
                        <img src={`/${b.img}`} alt={b.name} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginBottom: '5px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                        <div style={{ color: 'var(--brown)', fontSize: '13px' }}>{b.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Size', 'size'], ['Hair Length', 'hair'], ['Shedding', 'shedding'], ['Grooming', 'grooming'],
                    ['Energy Level', 'energy'], ['Climate Suitability', 'climate'], ['Apartment Friendly', 'apt'],
                    ['House Needed', 'house'], ['Monthly Cost', 'cost'], ['Family Risk', 'risk'],
                    ['Daily Time', 'time'], ['Ideal Cities', 'idealCities'], ['Common Health Issues', 'health']
                  ].map(([label, key]) => (
                    <tr key={key}>
                      <td style={{ padding: '12px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', color: 'var(--orange)' }}>{label}</td>
                      {compareList.map(b => (
                        <td key={b.name} style={{ padding: '12px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '13px', textAlign: 'center', color: 'var(--text-color)' }}>{b[key] || '-'}</td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: '12px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', color: 'var(--orange)' }}>Best Living Conditions</td>
                    {compareList.map(b => (
                       <td key={b.name} style={{ padding: '12px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '13px', textAlign: 'left', color: 'var(--text-color)', verticalAlign: 'top' }}>
                         <ul style={{ margin: 0, paddingLeft: '15px' }}>
                           {buildLivingConditions(b).map((cond, i) => (
                             <li key={i} style={{ marginBottom: '6px' }}><strong style={{ color: 'var(--brown)' }}>{cond.label}:</strong> {cond.text}</li>
                           ))}
                         </ul>
                       </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button onClick={downloadPDF} style={{ padding: '12px 24px', background: 'var(--brown)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>Save to PDF</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BreedModal;
