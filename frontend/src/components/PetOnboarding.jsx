import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { useBreedList } from '../context/BreedsContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const PetOnboarding = ({ onComplete, onCancel }) => {
  const breedsData = useBreedList();
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState(1);
  
  // Step 1 Form Data
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [ageDisplay, setAgeDisplay] = useState('');
  const [gender, setGender] = useState('Male');
  const [breed, setBreed] = useState('');
  const [healthComplications, setHealthComplications] = useState('');
  
  // Breed Autocomplete State
  const [breedQuery, setBreedQuery] = useState('');
  const [showBreedSuggestions, setShowBreedSuggestions] = useState(false);
  const [filteredBreeds, setFilteredBreeds] = useState([]);

  // Step 2 Document Scanner State
  const [dragActive, setDragActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [scanResult, setScanResult] = useState(null);

  // Age Calculator Observer
  useEffect(() => {
    if (!dob) {
      setAgeDisplay('');
      return;
    }
    const birthDate = new Date(dob);
    const today = new Date();
    if (isNaN(birthDate.getTime()) || birthDate > today) {
      setAgeDisplay('Invalid Date');
      return;
    }

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0) {
      years--;
      months += 12;
    }

    if (years === 0 && months === 0) {
      const diffTime = Math.abs(today - birthDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setAgeDisplay(`${diffDays} day${diffDays > 1 ? 's' : ''} old`);
    } else {
      const yearsText = years > 0 ? `${years} year${years > 1 ? 's' : ''}` : '';
      const monthsText = months > 0 ? `${months} month${months > 1 ? 's' : ''}` : '';
      const text = [yearsText, monthsText].filter(Boolean).join(', ');
      setAgeDisplay(`${text} old`);
    }
  }, [dob]);

  // Breed Autocomplete Filter
  useEffect(() => {
    if (!breedQuery) {
      setFilteredBreeds([]);
      return;
    }
    const filtered = breedsData.filter(b => 
      b.name.toLowerCase().includes(breedQuery.toLowerCase())
    ).slice(0, 5);
    setFilteredBreeds(filtered);
  }, [breedQuery]);

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!name || !dob || !gender || !breed) {
      alert("Please fill in all mandatory fields.");
      return;
    }
    setStep(2);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file) => {
    setFileUploaded(true);
    setUploadedFileName(file.name);
    setIsScanning(true);

    // Simulate OCR scanning process
    setTimeout(() => {
      setIsScanning(false);
      // Hardcoded mock OCR parsing data
      const adminDate = new Date();
      adminDate.setMonth(adminDate.getMonth() - 2); // 2 months ago
      
      const parsedVaccines = [
        { name: "Rabies", date: adminDate.toISOString().split('T')[0], status: "Completed" },
        { name: "DHPP (Distemper, Hepatitis, Parvovirus)", date: adminDate.toISOString().split('T')[0], status: "Completed" },
        { name: "Bordetella (Kennel Cough)", date: new Date(adminDate.setMonth(adminDate.getMonth() + 1)).toISOString().split('T')[0], status: "Completed" }
      ];

      // Reminders (Booster in 10-11 months from now)
      const r1 = new Date();
      r1.setMonth(r1.getMonth() + 10);
      const r2 = new Date();
      r2.setMonth(r2.getMonth() + 11);

      const parsedReminders = [
        { vaccine: "Rabies Booster", date: r1.toISOString().split('T')[0], priority: "High" },
        { vaccine: "DHPP Booster", date: r1.toISOString().split('T')[0], priority: "Medium" },
        { vaccine: "Bordetella Booster", date: r2.toISOString().split('T')[0], priority: "Low" }
      ];

      setScanResult({
        vaccines: parsedVaccines,
        reminders: parsedReminders
      });
    }, 2500);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleSaveProfile = async (useScannerResults = true) => {
    const petProfileData = {
      user_id: user?.id,
      name,
      dob,
      age_display: ageDisplay,
      gender,
      breed,
      health_complications: healthComplications || "None",
      vaccines: useScannerResults && scanResult ? scanResult.vaccines : [],
      reminders: useScannerResults && scanResult ? scanResult.reminders : []
    };

    try {
      await axios.post(`${API_URL}/api/pets/`, petProfileData);
      alert("Pet profile successfully saved!");
      onComplete();
    } catch (err) {
      console.error(err);
      alert("Failed to save pet profile. Please try again.");
    }
  };

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '20px' }}>
      <div 
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: 'clamp(20px, 5vw, 40px)',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative'
        }}
      >
        <button 
          onClick={onCancel}
          style={{
            position: 'absolute', top: '20px', right: '25px',
            background: 'none', border: 'none', fontSize: '24px',
            cursor: 'pointer', color: 'var(--text-soft)', fontWeight: 'bold'
          }}
        >
          &times;
        </button>

        {step === 1 ? (
          <div>
            <h2 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', marginBottom: '10px', fontSize: '28px', textAlign: 'center' }}>
              🐾 Create Pet Profile
            </h2>
            <p style={{ color: 'var(--text-soft)', textAlign: 'center', marginBottom: '30px', fontSize: '15px' }}>
              Step 1 of 2: Enter details about your furry companion.
            </p>

            <form onSubmit={handleNextStep}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="auth-field" style={{ marginBottom: 0 }}>
                  <label style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>Dog's Name *</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. Max, Bella" 
                    required 
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  />
                </div>

                <div className="auth-field" style={{ marginBottom: 0 }}>
                  <label style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>Gender *</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                    {['Male', 'Female'].map(g => (
                      <button
                        type="button"
                        key={g}
                        onClick={() => setGender(g)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: gender === g ? '2px solid var(--orange)' : '2px solid #EAE4DE',
                          background: gender === g ? 'var(--orange-pale)' : 'white',
                          color: gender === g ? 'var(--orange)' : 'var(--text-soft)',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontFamily: "'Poppins', sans-serif",
                          transition: 'all 0.2s'
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="auth-field" style={{ marginBottom: 0, position: 'relative' }}>
                  <label style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>Date of Birth (DOB) *</label>
                  <input 
                    type="date" 
                    value={dob} 
                    onChange={(e) => setDob(e.target.value)} 
                    required 
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  />
                  {ageDisplay && (
                    <div style={{ fontSize: '12px', color: 'var(--orange)', fontWeight: 600, marginTop: '5px', paddingLeft: '2px' }}>
                      🎂 {ageDisplay}
                    </div>
                  )}
                </div>

                <div className="auth-field" style={{ marginBottom: 0, position: 'relative' }}>
                  <label style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>Breed *</label>
                  <input 
                    type="text" 
                    value={breedQuery} 
                    onChange={(e) => { setBreedQuery(e.target.value); setBreed(e.target.value); setShowBreedSuggestions(true); }}
                    onFocus={() => setShowBreedSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowBreedSuggestions(false), 200)}
                    placeholder="Search breed..." 
                    required 
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  />
                  
                  <AnimatePresence>
                    {showBreedSuggestions && filteredBreeds.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: 'white', border: '1px solid #EAE4DE', borderRadius: '12px',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden'
                        }}
                      >
                        {filteredBreeds.map(b => (
                          <div 
                            key={b.id} 
                            onClick={() => { setBreed(b.name); setBreedQuery(b.name); setShowBreedSuggestions(false); }}
                            style={{ padding: '10px 15px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid #F5F0EB' }}
                            onMouseDown={(e) => e.preventDefault()} // prevents input blur before click
                            onMouseOver={e => e.currentTarget.style.background = 'var(--cream)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--brown)', fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>{b.name}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="auth-field" style={{ marginBottom: '25px' }}>
                <label style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>Health Complications (Optional)</label>
                <textarea 
                  value={healthComplications} 
                  onChange={(e) => setHealthComplications(e.target.value)} 
                  placeholder="e.g. Food allergies, minor joint pain, surgery history..." 
                  style={{
                    width: '100%', minHeight: '80px', padding: '12px 16px', borderRadius: '12px',
                    border: '2px solid #EAE4DE', fontSize: '14px', fontFamily: "'Poppins', sans-serif",
                    outline: 'none', resize: 'vertical'
                  }}
                />
              </div>

              <button 
                type="submit" 
                className="auth-btn" 
                style={{ fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Proceed to Vaccine Scanner →
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h2 style={{ fontFamily: "'Fredoka', sans-serif", color: 'var(--brown)', marginBottom: '10px', fontSize: '28px', textAlign: 'center' }}>
              🛡️ Vaccine Record Scanner
            </h2>
            <p style={{ color: 'var(--text-soft)', textAlign: 'center', marginBottom: '30px', fontSize: '15px' }}>
              Step 2 of 2: Upload vaccination files to parse records & calculate boosters.
            </p>

            {!fileUploaded ? (
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                style={{
                  border: dragActive ? '2px dashed var(--orange)' : '2px dashed #EAE4DE',
                  borderRadius: '16px',
                  background: dragActive ? 'var(--orange-pale)' : '#FCFAF7',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📄</div>
                <h4 style={{ color: 'var(--brown)', marginBottom: '5px', fontFamily: "'Poppins', sans-serif" }}>
                  Drag & Drop vaccine records/PDF/Image here
                </h4>
                <p style={{ color: 'var(--text-soft)', fontSize: '12px', marginBottom: '20px' }}>
                  Supports PDF, PNG, JPG files
                </p>
                
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <label 
                    htmlFor="file-upload"
                    className="hero-btn"
                    style={{ padding: '8px 18px', cursor: 'pointer', fontSize: '13px', boxShadow: 'none' }}
                  >
                    📷 Camera Capture
                  </label>
                  <label 
                    htmlFor="file-upload"
                    className="hero-btn hero-btn-secondary"
                    style={{ padding: '8px 18px', cursor: 'pointer', fontSize: '13px', boxShadow: 'none' }}
                  >
                    📂 Browse Files
                  </label>
                  <input 
                    id="file-upload" 
                    type="file" 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }}
                    accept="image/*,application/pdf"
                  />
                </div>
              </div>
            ) : (
              <div>
                {isScanning ? (
                  <div 
                    style={{
                      border: '2px solid #EAE4DE',
                      borderRadius: '16px',
                      padding: '40px 20px',
                      textAlign: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      background: '#FCFAF7'
                    }}
                  >
                    {/* Laser Scanner animation overlay */}
                    <div 
                      style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                        background: 'linear-gradient(90deg, rgba(208,92,25,0) 0%, rgba(208,92,25,1) 50%, rgba(208,92,25,0) 100%)',
                        boxShadow: '0 0 10px var(--orange)',
                        animation: 'laserScan 2.5s infinite linear'
                      }}
                    />
                    
                    <div style={{ fontSize: '40px', marginBottom: '15px', animation: 'pulse 1s infinite alternate' }}>🐕</div>
                    <h3 style={{ color: 'var(--brown)', fontFamily: "'Fredoka', sans-serif", fontSize: '20px', marginBottom: '10px' }}>
                      AI Matchmaker OCR Scanner
                    </h3>
                    <p style={{ color: 'var(--text-soft)', fontSize: '14px' }}>
                      Analyzing document: <strong>{uploadedFileName}</strong>
                    </p>
                    <p style={{ color: 'var(--orange)', fontSize: '12px', fontWeight: 'bold', marginTop: '10px' }}>
                      Extracting vaccine types and dates...
                    </p>
                  </div>
                ) : (
                  <div>
                    {scanResult && (
                      <div style={{ background: '#FCFAF7', border: '1px solid #EAE4DE', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                        <div style={{ color: '#27AE60', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                          ✓ Records parsed successfully from {uploadedFileName}
                        </div>
                        
                        <h4 style={{ color: 'var(--brown)', fontFamily: "'Poppins', sans-serif", borderBottom: '1px solid #EAE4DE', paddingBottom: '5px', marginBottom: '10px' }}>
                          💉 Extracted Vaccines
                        </h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #EAE4DE' }}>
                              <th style={{ padding: '8px 5px', color: 'var(--brown)' }}>Vaccine</th>
                              <th style={{ padding: '8px 5px', color: 'var(--brown)' }}>Administered Date</th>
                              <th style={{ padding: '8px 5px', color: 'var(--brown)' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scanResult.vaccines.map((v, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #F5F0EB' }}>
                                <td style={{ padding: '8px 5px', fontWeight: 600 }}>{v.name}</td>
                                <td style={{ padding: '8px 5px' }}>{v.date}</td>
                                <td style={{ padding: '8px 5px', color: '#27AE60', fontWeight: 'bold' }}>{v.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <h4 style={{ color: 'var(--brown)', fontFamily: "'Poppins', sans-serif", borderBottom: '1px solid #EAE4DE', paddingBottom: '5px', marginBottom: '10px' }}>
                          📅 Calculated Calendar Reminders
                        </h4>
                        <div>
                          {scanResult.reminders.map((rem, idx) => (
                            <div 
                              key={idx} 
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 12px', background: rem.priority === 'High' ? '#FFF5F5' : rem.priority === 'Medium' ? '#FFFBEA' : '#F5FBFF',
                                borderLeft: `4px solid ${rem.priority === 'High' ? '#EB5757' : rem.priority === 'Medium' ? '#F2C94C' : '#2F80ED'}`,
                                borderRadius: '8px', marginBottom: '8px', fontSize: '13px'
                              }}
                            >
                              <div>
                                <strong style={{ color: 'var(--brown)' }}>{rem.vaccine}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--text-soft)' }}>Booster due</div>
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--brown)' }}>📅 {rem.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '15px', marginTop: '25px', width: '100%' }}>
              <button 
                type="button" 
                onClick={() => handleSaveProfile(false)}
                className="hero-btn hero-btn-secondary"
                style={{ flex: 1, padding: '12px 20px', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}
              >
                Skip Scanner
              </button>
              
              <button 
                type="button" 
                onClick={() => handleSaveProfile(true)}
                disabled={!fileUploaded || isScanning}
                className="hero-btn"
                style={{ flex: 2, padding: '12px 20px', fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}
              >
                Process & Save Profile
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes laserScan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default PetOnboarding;
