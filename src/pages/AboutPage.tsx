import { BRAND } from '../config';

export const AboutPage = () => {
  return (
    <section>
      <h1 className="screen-title">About NoDoubt Fitness</h1>
      <img src="/assets/owner.jpg" alt="NoDoubt Fitness owner in gym" className="owner-photo" />
      <p className="about-copy">{BRAND.aboutBio}</p>
      <a className="primary-btn full pulse" href={BRAND.instagramUrl} target="_blank" rel="noreferrer">
        {BRAND.ctaLabel}
      </a>
    </section>
  );
};
