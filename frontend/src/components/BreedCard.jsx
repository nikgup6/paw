const BreedCard = ({ breed, rank, reason, onBuy, onCompare, onFullProfile, hideActionButtons, hideBuyButton, hideFullProfileButton, hideCompareButton, onImageClick }) => {
  return (
    <div className="breed-card" onClick={() => onFullProfile && onFullProfile(breed)} style={{ cursor: 'pointer' }}>
      <div className="breed-card-img">
        {(rank || breed.matchPercentage) && <div className="breed-rank">{rank ? `#${rank} ` : ''}{breed.matchPercentage ? `\u2022 ${breed.matchPercentage}% Match` : ''}</div>}
        <img 
          src={`/${breed.img}`} 
          alt={breed.name} 
          onClick={(e) => { e.stopPropagation(); onImageClick && onImageClick(breed); }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
          onError={(e) => { e.target.src = 'https://via.placeholder.com/140?text=Dog'; }}
        />
      </div>
      <div className="breed-card-body">
        <h4 className="breed-name">{breed.name}</h4>
        <p className="breed-reason">{breed.purpose}</p>
        
        {reason && (
          <p style={{ fontSize: '13px', color: 'var(--text-soft)', marginTop: '12px', marginBottom: '12px', lineHeight: 1.5, background: 'rgba(255,107,43,0.05)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--orange)' }}>
            {reason}
          </p>
        )}

        {/* The single worst caveat, next to the reason that sells the breed.
            The engine already computed these; this card just never showed them,
            so a breed needing more space than the owner has read as a clean
            recommendation here while the Full Profile said otherwise. Only the
            first is shown — the card is a summary, and the profile carries the
            rest. */}
        {breed.warnings?.length > 0 && (
          <p style={{ fontSize: '12.5px', color: '#9a6b1f', background: '#fdf3e0', border: '1px solid #f3ddb2', borderRadius: '8px', padding: '8px 10px', margin: '0 0 12px', lineHeight: 1.5 }}>
            ⚠ {breed.warnings[0]}
          </p>
        )}
        <div className="breed-pills">
          {breed.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="pill pill-orange">{tag}</span>
          ))}
        </div>
        {!hideActionButtons && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            {!hideBuyButton && (
              /* High-emphasis CTA — literally the role table's "Buy" example. */
              <button onClick={(e) => { e.stopPropagation(); onBuy && onBuy(breed); }} style={{ flex: 1, padding: '8px', background: 'var(--orange)', color: 'white', border: 'none', borderRadius: '50px', fontWeight: 'var(--weight-bold)', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>Buy</button>
            )}
            {!hideCompareButton && (
              <button onClick={(e) => { e.stopPropagation(); onCompare && onCompare(breed); }} style={{ flex: 1, padding: '8px', background: 'transparent', color: 'var(--orange)', border: '1px solid var(--orange)', borderRadius: '50px', fontWeight: 'var(--weight-semibold)', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>Compare</button>
            )}
            {!hideFullProfileButton && (
              <button onClick={(e) => { e.stopPropagation(); onFullProfile && onFullProfile(breed); }} style={{ flex: 1, padding: '8px', background: 'transparent', color: 'var(--brown)', border: '1px solid var(--brown)', borderRadius: '50px', fontWeight: 'var(--weight-semibold)', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>Full Profile</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BreedCard;
