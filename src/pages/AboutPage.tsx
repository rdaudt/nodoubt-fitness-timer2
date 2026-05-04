import { BRAND } from '../config';
import { useSettings } from '../services/settingsContext';
import { useTenant } from '../services/tenantContext';
import kobeAiSolutions from '../../media/kobe-ai-solutions.png';
import coachGabeAndKobe from '../../media/coach-gabe-and-kobe.png';

export const AboutPage = () => {
  const { settings } = useSettings();
  const { profile } = useTenant();
  const businessName = profile?.businessName || BRAND.businessName;
  const coachName = profile?.coachName || 'Coach Gabe';
  const bio = profile?.bio || BRAND.aboutBio;
  const cta = profile?.socialLinks[0] ?? { label: BRAND.ctaLabel, url: BRAND.instagramUrl };
  const coachPhoto = profile?.coachPhotoUrl || coachGabeAndKobe;

  return (
    <section className="about-page">
      <h1 className="screen-title">About {businessName}</h1>
      <img src={coachPhoto} alt={coachName} className="owner-photo about-coach-photo" />
      <p className="about-coach-name">{coachName}</p>
      <p className="about-copy">{bio}</p>
      <a className="primary-btn full pulse" href={cta.url} target="_blank" rel="noreferrer">
        {cta.label}
      </a>
      {settings.kobeEverywhere && <img src={kobeAiSolutions} alt="Kobe AI Solutions" className="about-kobe-ai-image" />}
    </section>
  );
};
