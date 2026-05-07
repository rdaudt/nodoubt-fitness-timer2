import { BRAND } from '../config';
import { useSettings } from '../services/settingsContext';
import { useTenant } from '../services/tenantContext';
import kobeAiSolutions from '../../media/kobe-ai-solutions.png';

export const AboutPage = () => {
  const { settings } = useSettings();
  const { profile } = useTenant();
  const businessName = profile?.businessName ?? '';
  const coachName = profile?.coachName ?? '';
  const bio = profile?.bio || BRAND.aboutBio;
  const normalizedIgUsername = (profile?.igUsername ?? '').trim().replace(/^@+/, '');
  const dmUrl = normalizedIgUsername ? `https://ig.me/m/${encodeURIComponent(normalizedIgUsername)}` : '';
  const ctaUrl = dmUrl || profile?.socialLinks[0]?.url || BRAND.instagramUrl;
  const ctaLabel = BRAND.ctaLabel;
  const coachPhoto = profile?.coachPhotoUrl ?? '';

  return (
    <section className="about-page">
      <h1 className="screen-title">About {businessName}</h1>
      {coachPhoto && <img src={coachPhoto} alt={coachName} className="owner-photo about-coach-photo" />}
      <p className="about-coach-name">{coachName}</p>
      <p className="about-copy">{bio}</p>
      <a className="primary-btn full pulse" href={ctaUrl} target="_blank" rel="noreferrer">
        {ctaLabel}
      </a>
      {settings.kobeEverywhere && <img src={kobeAiSolutions} alt="Kobe AI Solutions" className="about-kobe-ai-image" />}
    </section>
  );
};
