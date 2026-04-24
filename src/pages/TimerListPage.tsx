import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../config';
import { TimerCard } from '../components/TimerCard';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';

export const TimerListPage = () => {
  const [timers, setTimers] = useState<Timer[]>([]);

  useEffect(() => {
    TimerRepository.list().then(setTimers);
  }, []);

  return (
    <section className="home-page">
      <div className="section-header">
        <h1 className="screen-title">Your HIIT Timers</h1>
        <Link to="/timer/new" className="primary-btn">
          New Timer
        </Link>
      </div>

      <div className="stack">
        {timers.length === 0 ? <p className="empty">No timers yet. Create your first interval plan.</p> : timers.map((timer) => <TimerCard key={timer.id} timer={timer} />)}
      </div>

      <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer" className="cta-banner">
        {BRAND.ctaLabel}
      </a>

      <div className="home-bottom-media">
        <a
          className="home-sleepy-cat-wrap"
          href="https://www.instagram.com/kobetheabby/"
          target="_blank"
          rel="noreferrer"
          aria-label="Kobe the Abby Instagram"
        >
          <img className="home-sleepy-cat" src="/assets/sleepy-cat-transparent.png" alt="" />
        </a>

        <a
          className="home-qr-wrap"
          href="https://hiit-timer-green.vercel.app/"
          target="_blank"
          rel="noreferrer"
          aria-label="Open app URL"
        >
          <img className="home-qr-image" src="/assets/home-app-qr.png" alt="QR code to open HIIT Timer app" />
        </a>
      </div>
    </section>
  );
};
