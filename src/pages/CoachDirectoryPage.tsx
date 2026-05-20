import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CoachDirectoryItem } from '../types';
import { setMyCoachSlug } from '../services/coachDirectory';
import { fetchCoachDirectory } from '../services/tenantApi';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from '../services/authContext';

const PAGE_SIZE = 12;

interface CoachDirectoryPageProps {
  notice?: string;
}

export const CoachDirectoryPage = ({ notice = '' }: CoachDirectoryPageProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CoachDirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetchCoachDirectory(debouncedQuery, page, PAGE_SIZE)
      .then((result) => {
        if (!active) {
          return;
        }
        setItems(result.items);
        setTotal(result.total);
        setHasNextPage(result.hasNextPage);
      })
      .catch(() => {
        if (active) {
          setError('Failed to load coach directory.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, page, reloadToken]);

  const pageLabel = useMemo(() => `Page ${page}`, [page]);

  const openCoach = (item: CoachDirectoryItem) => {
    const ig = item.igUsername.trim().replace(/^@+/, '');
    if (ig) {
      window.open(`https://www.instagram.com/${encodeURIComponent(ig)}/`, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(`/${item.slug}`);
  };

  const setCoach = (item: CoachDirectoryItem) => {
    setMyCoachSlug(item.slug);
    setToast(`${item.coachName || item.businessName} is now My Coach`);
    window.setTimeout(() => navigate(`/${item.slug}`), 250);
  };

  useEffect(() => {
    if (!toast) {
      return;
    }
    const handle = window.setTimeout(() => setToast(''), 2000);
    return () => window.clearTimeout(handle);
  }, [toast]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-user-email">{user?.email ?? ''}</div>
        <div className="topbar-inner">
          <div />
          <div className="brand-text-wrap">
            <p className="brand-name">Best HIIT Timer</p>
          </div>
          <div />
        </div>
      </header>
      <main className="screen">
        <section className="coach-directory-page">
          <h1 className="screen-title">My Coach</h1>
          <p className="timer-meta">Your free Best HIIT Timer App is sponsored by the coaches below.</p>
          <p className="timer-meta">Pick one coach to get started and access HIIT class content they share.</p>
          <p className="timer-meta">Your personal data stays private, and coaches won&apos;t know you selected them.</p>
          {notice && <p className="timer-meta">{notice}</p>}
          <label className="field">
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search coach or business" />
          </label>
          {loading && <p className="timer-meta">Loading coaches...</p>}
          {!loading && error && (
            <div className="stack">
              <p className="error-inline">{error}</p>
              <button className="secondary-btn compact" onClick={() => setReloadToken((value) => value + 1)}>Retry</button>
            </div>
          )}
          {!loading && !error && (
            <div className="stack">
              {items.map((item) => (
                <article
                  key={item.slug}
                  className="coach-card"
                  onClick={() => openCoach(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openCoach(item);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {item.coachPhotoUrl && <img src={item.coachPhotoUrl} alt={item.coachName || item.businessName} className="coach-card-photo" />}
                  <div className="coach-card-copy">
                    <h3>{item.coachName || item.businessName}</h3>
                    <p className="timer-meta">{item.businessName}</p>
                  </div>
                  <button
                    className="primary-btn compact"
                    onClick={(event) => {
                      event.stopPropagation();
                      setCoach(item);
                    }}
                  >
                    Set as My Coach
                  </button>
                </article>
              ))}
              {!items.length && <p className="timer-meta">No coaches found.</p>}
              <p className="timer-meta">{total} coaches</p>
              <div className="actions-row">
                <button className="secondary-btn compact" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
                <span className="timer-meta">{pageLabel}</span>
                <button className="secondary-btn compact" disabled={!hasNextPage} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </div>
          )}
          {toast && <p className="settings-success-inline">{toast}</p>}
        </section>
      </main>
      <BottomNav clickable={false} />
    </div>
  );
};
