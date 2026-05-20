import { useEffect } from 'react';
import { BRAND } from '../config';
import { getPerfTraceId, isPerfTriageEnabled, registerExpectedImage, settleImage } from '../services/perfTriage';
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
  const perfEnabled = isPerfTriageEnabled();
  const tracedImageUrl = (url: string): string => {
    if (!perfEnabled || !url.startsWith('/api/tenant-asset?')) {
      return url;
    }
    const traceId = getPerfTraceId();
    if (!traceId) {
      return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}traceId=${encodeURIComponent(traceId)}&route=${encodeURIComponent('/about')}`;
  };

  useEffect(() => {
    if (perfEnabled && coachPhoto) {
      registerExpectedImage('about-coach-photo');
    }
  }, [coachPhoto, perfEnabled]);

  return (
    <section className="about-page">
      <h1 className="screen-title about-title">About {businessName}</h1>
      {coachPhoto && (
        <img
          src={tracedImageUrl(coachPhoto)}
          alt={coachName}
          className="owner-photo about-coach-photo"
          onLoad={(event) => settleImage('about-coach-photo', false, event.currentTarget.currentSrc)}
          onError={() => settleImage('about-coach-photo', true)}
        />
      )}
      <p className="about-coach-name">{coachName}</p>
      <p className="about-copy">{bio}</p>
      <a className="primary-btn full pulse" href={ctaUrl} target="_blank" rel="noreferrer">
        {ctaLabel}
      </a>
      {settings.kobeEverywhere && <img src={kobeAiSolutions} alt="Kobe AI Solutions" className="about-kobe-ai-image" />}
    </section>
  );
};
