import { Link, Navigate, useParams } from 'react-router-dom';
import { useDogs } from '../context/DogsContext';
import { ageFromDob, formatDay } from '../utils/healthStatus';
import { thumb } from '../utils/images';

/* The selected dog's profile, on its own page.

   A read view rather than a form: the details as filed, with one way through to
   editing them. Everything is scoped to the dog id in the URL. */

const Fact = ({ label, value }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value || '—'}</dd>
  </div>
);

const DogProfilePage = () => {
  const { dogId } = useParams();
  const { dogById, loading } = useDogs();
  const dog = dogById(dogId);

  if (loading) {
    return <div className="pb-page"><div className="pb-loading"><span className="pb-spin" aria-hidden="true" /> Loading…</div></div>;
  }
  if (!dog) return <Navigate to="/app" replace />;

  return (
    <div className="pb-page pb-fade">
      <div className="pb-page__head">
        <div>
          <h2 className="pb-page__title">{dog.name}</h2>
          <p className="pb-page__sub">Profile details.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="pb-btn pb-btn--primary" to={`/app/dogs/${dog.id}/edit`}>Edit profile</Link>
          <Link className="pb-btn" to={`/app/dogs/${dog.id}/health`}>Health</Link>
        </div>
      </div>

      <section className="pb-card">
        <div className="pb-prof2">
          <div className="pb-prof2__photo" aria-hidden="true">
            {dog.photo_url ? <img src={thumb(dog.photo_url, 72)} alt="" /> : <span>🐶</span>}
          </div>
          <dl className="pb-prof2__facts">
            <Fact label="Name" value={dog.name} />
            <Fact label="Breed" value={dog.breed} />
            <Fact label="Date of birth" value={dog.dob ? formatDay(dog.dob) : null} />
            <Fact label="Age" value={ageFromDob(dog.dob)} />
            <Fact label="Sex" value={dog.gender} />
            <Fact label="Weight" value={dog.weight_kg ? `${dog.weight_kg} kg` : null} />
            <Fact label="City" value={dog.city} />
          </dl>
        </div>

        {dog.health_complications && (
          <p className="pb-prof2__note">⚠️ {dog.health_complications}</p>
        )}
      </section>

      <style>{`
        .pb-prof2 { display: flex; gap: 22px; flex-wrap: wrap; align-items: flex-start; }
        .pb-prof2__photo {
          flex: 0 0 128px; width: 128px; height: 128px; border-radius: 22px; overflow: hidden;
          background: var(--orange-pale); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; font-size: 52px;
        }
        .pb-prof2__photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pb-prof2__facts {
          flex: 1 1 300px; margin: 0; display: grid; gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        }
        .pb-prof2__facts dt {
          font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em;
          color: var(--text-soft); font-weight: var(--weight-bold);
        }
        .pb-prof2__facts dd { margin: 3px 0 0; font-size: 14.5px; color: var(--brown); font-weight: var(--weight-semibold); }
        .pb-prof2__note {
          margin: 18px 0 0; padding: 11px 13px; border-radius: 11px;
          background: #FFFBF4; border: 1px solid #E9D8B8; color: #9A6B1F; font-size: 13px; line-height: 1.55;
        }
        @media (max-width: 520px) {
          .pb-prof2__photo { flex: 0 0 92px; width: 92px; height: 92px; font-size: 38px; }
        }
      `}</style>
    </div>
  );
};

export default DogProfilePage;
