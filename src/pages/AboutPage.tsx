import { BRAND } from '../config';

export const AboutPage = () => {
  return (
    <section>
      <h1 className="screen-title">About NoDoubt Fitness</h1>
      <img src="/assets/coach-gabe-transparent-cropped.png" alt="Coach Gabe" className="owner-photo about-coach-photo" />
      <p className="about-coach-name">Coach Gabe</p>
      <p className="about-copy">{BRAND.aboutBio}</p>
      <a className="primary-btn full pulse" href={BRAND.instagramUrl} target="_blank" rel="noreferrer">
        {BRAND.ctaLabel}
      </a>
    </section>
  );
};
