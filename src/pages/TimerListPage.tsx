import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../config';
import { TimerCard } from '../components/TimerCard';
import { TimerRepository } from '../services/storage';
import type { Timer } from '../types';
import victorianGym3 from '../../media/victorian-gym-3.png';

export const TimerListPage = () => {
  const [timers, setTimers] = useState<Timer[]>([]);

  useEffect(() => {
    TimerRepository.list().then(setTimers);
  }, []);

  const onDeleteTimer = async (id: string) => {
    const ok = window.confirm('Delete this timer?');
    if (!ok) {
      return;
    }
    await TimerRepository.remove(id);
    setTimers((prev) => prev.filter((timer) => timer.id !== id));
  };

  return (
    <section className="home-page">
      <div className="section-header">
        <h1 className="screen-title">Your HIIT Timers</h1>
        <Link to="/timer/new" className="primary-btn">
          New Timer
        </Link>
      </div>

      <div className="stack">
        {timers.length === 0
          ? <p className="empty">No timers yet. Create your first interval plan.</p>
          : timers.map((timer) => <TimerCard key={timer.id} timer={timer} onDelete={onDeleteTimer} />)}
      </div>

      <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer" className="cta-banner">
        {BRAND.ctaLabel}
      </a>

      <a
        className="home-victorian-wrap"
        href="https://www.instagram.com/kobetheabby/"
        target="_blank"
        rel="noreferrer"
        aria-label="Kobe the Abby Instagram"
      >
        <img className="home-victorian-image" src={victorianGym3} alt="" />
      </a>
    </section>
  );
};
