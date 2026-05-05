import { BottomNav } from '../components/BottomNav';

export const InvalidUrlPage = () => (
  <div className="app-shell">
    <header className="topbar topbar-invalid">
      <div className="topbar-inner topbar-inner-invalid" />
    </header>

    <main className="screen invalid-url-screen">
      <section className="invalid-url-page" aria-live="polite">
        <h1 className="screen-title">Invalid Timer URL</h1>
        <p className="invalid-url-copy">The timer URL is invalid. Please check the link and try again.</p>
      </section>
    </main>

    <BottomNav clickable={false} />
  </div>
);
