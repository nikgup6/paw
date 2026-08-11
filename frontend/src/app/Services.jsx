/* Services — intentionally empty.

   The section exists in the sidebar so the shape of the product is visible, but
   there is nothing behind it yet and nothing is faked here. It stays a blank
   canvas until the real thing is designed. */

const Services = () => (
  <div className="pb-page pb-fade">
    <div className="pb-page__head">
      <div>
        <h2 className="pb-page__title">Services</h2>
        <p className="pb-page__sub">Nothing here yet.</p>
      </div>
    </div>

    <section className="pb-card">
      <div className="pb-empty">
        <span className="pb-empty__icon" aria-hidden="true">🧰</span>
        <strong>Services will live here</strong>
        This space is reserved — it’ll be filled in later.
      </div>
    </section>
  </div>
);

export default Services;
