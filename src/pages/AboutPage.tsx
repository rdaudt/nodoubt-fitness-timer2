import { BRAND } from '../config';

export const AboutPage = () => {
  return (
    <section className="about-page">
      <h1 className="screen-title">About NoDoubt Fitness</h1>
      <img src="/assets/coach-with-cat.png" alt="Coach Gabe with Kobe the Abby" className="owner-photo about-coach-photo" />
      <p className="about-coach-name">Coach Gabe</p>
      <p className="about-coach-subname">(and Kobe the Abby)</p>
      <p className="about-copy">{BRAND.aboutBio}</p>
      <a className="primary-btn full pulse" href={BRAND.instagramUrl} target="_blank" rel="noreferrer">
        {BRAND.ctaLabel}
      </a>
      <a className="about-kobe-btn full" href="https://www.instagram.com/kobetheabby/" target="_blank" rel="noreferrer">
        DM Kobe
      </a>
    </section>
  );
};
