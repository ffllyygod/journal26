'use client';

import { useEffect, useState } from 'react';
import { addDays, dayDifference, formatDate, todayIn } from '@/lib/domain';
import { exportJson } from '@/lib/export';
import { useWorkspace } from '@/lib/use-workspace';
import { createClient } from '@/lib/supabase/client';
import type { View, Workspace as WorkspaceData, UpdateWorkspace } from '@/lib/types';
import { Daily, Journal } from './daily';
import { Trades } from './trades';
import { Career } from './career';
import { Review } from './review';
import { Settings } from './settings';
import { Icon, type IconName } from './ui';

const navigation: { id: View; label: string; icon: IconName }[] = [
  { id: 'today', label: 'My day', icon: 'sun' },
  { id: 'journal', label: 'Journal', icon: 'book' },
  { id: 'trades', label: 'Trade journal', icon: 'chart' },
  { id: 'career', label: 'Career', icon: 'briefcase' },
  { id: 'review', label: 'Weekly review', icon: 'review' },
];
export function Workspace({ demo = false, userId }: { demo?: boolean; userId?: string }) {
  const store = useWorkspace({ demo, userId });
  if (!store.data)
    return (
      <main className="loading-page">
        <a href="/" className="brand">
          journal<span>26</span>
          <i />
        </a>
        <div className="panel loading-panel">
          <Icon name={store.error ? 'lock' : 'leaf'} size={30} />
          <h1>{store.error ? 'Your journal is still safe.' : 'Opening a fresh page…'}</h1>
          <p>{store.error || 'A moment to settle in.'}</p>
          {store.error && (
            <div className="inline">
              <button className="button button-primary" onClick={store.retry}>
                Try again
              </button>
              <a className="button button-secondary" href="/login">
                Back to sign-in
              </a>
            </div>
          )}
        </div>
      </main>
    );
  return (
    <WorkspaceContent
      data={store.data}
      update={store.update}
      demo={demo}
      userId={userId}
      status={store.status}
      error={store.error}
      retry={store.retry}
      reload={store.reload}
      pending={store.pending}
    />
  );
}
function WorkspaceContent({
  data,
  update,
  demo,
  userId,
  status,
  error,
  retry,
  reload,
  pending,
}: {
  data: WorkspaceData;
  update: UpdateWorkspace;
  demo: boolean;
  userId?: string;
  status: string;
  error: string | null;
  retry: () => void;
  reload: () => void;
  pending: boolean;
}) {
  const [view, setView] = useState<View>('today');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [, tick] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const today = todayIn(data.settings.timezone);
  const date = selectedDate ?? today;
  const challengeDay = dayDifference(data.settings.startDate, today) + 1;
  const progress = Math.min(100, (Math.max(0, challengeDay - 1) / data.settings.duration) * 100);
  const dayLabel =
    challengeDay < 1
      ? 'Starts soon'
      : challengeDay > data.settings.duration
        ? 'Challenge complete'
        : `Day ${String(challengeDay).padStart(2, '0')} of ${data.settings.duration}`;
  const titles: Record<View, string> = {
    today:
      date === today
        ? `A new day${data.settings.name ? `, ${data.settings.name}` : ''}.`
        : date > today
          ? 'A little ahead of yourself.'
          : 'A day worth remembering.',
    journal: 'Your story, in your words.',
    trades: 'Trade. Reflect. Refine.',
    career: 'Build your next chapter.',
    review: 'Look back. Move forward.',
    settings: 'Make this space your own.',
  };
  const subtitles: Record<View, string> = {
    today: 'You don’t have to do everything. Just the things that matter.',
    journal: 'An honest record of the days that are shaping you.',
    trades: 'Understand your decisions, one setup at a time.',
    career: 'Small steps toward a role that’s right for you.',
    review: 'Notice the patterns. Take the lessons into next week.',
    settings: 'Your intentions, your pace, your journal.',
  };
  const props = { data, update, date, demo, userId };
  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function signOut() {
    if (
      pending &&
      !window.confirm(
        'Some changes are not saved. Export your records before signing out to keep them. Sign out anyway?',
      )
    )
      return;
    setSigningOut(true);
    setSignOutError('');
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      window.location.assign('/login');
    } catch {
      setSignOutError('Could not sign out. Please try again.');
      setSigningOut(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href={demo ? '/demo' : '/journal'}>
          journal<span>26</span>
          <i />
        </a>
        <span className="brand-caption">A LITTLE BETTER, EVERY DAY.</span>
        <div className="challenge-badge">
          <span className="challenge-badge-icon">
            <Icon name="leaf" size={18} />
          </span>
          <div>
            <span>THE TWO-MONTH CHAPTER</span>
            <strong>{dayLabel}</strong>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map(item => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {view === item.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <span className="quote-mark">“</span>
            <p>{data.settings.intention}</p>
            <div className="challenge-progress">
              <span style={{ width: `${progress}%` }} />
            </div>
            <span>
              {Math.max(0, data.settings.duration - Math.max(0, challengeDay - 1))} days of possibility
            </span>
          </div>
          <button
            className={`nav-item settings-nav ${view === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Icon name="settings" size={18} />
            <span>Settings & exports</span>
          </button>
          <div className="profile">
            <span className="avatar">{(data.settings.name || 'J').slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{data.settings.name || 'Your private space'}</strong>
              <span>{demo ? 'Browser demo' : 'Personal workspace'}</span>
            </div>
            {!demo && (
              <button
                className="icon-button"
                onClick={() => void signOut()}
                disabled={signingOut}
                aria-label="Sign out"
              >
                <Icon name="logout" size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Your space</span>
            <Icon name="chevron" size={12} />
            <strong>{view === 'settings' ? 'Settings' : navigation.find(n => n.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className={`save-status ${status}`} aria-live="polite">
              <span />
              {status === 'saved'
                ? demo
                  ? 'Saved on this device'
                  : 'All changes saved'
                : status === 'saving'
                  ? 'Saving…'
                  : status === 'conflict'
                    ? 'Sync conflict'
                    : 'Changes not saved'}
            </span>
            <span className="topbar-date">
              {formatDate(today, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              className="icon-button mobile-settings"
              onClick={() => navigate('settings')}
              aria-label="Settings"
            >
              <Icon name="settings" size={19} />
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-strip">
            <span>
              <strong>Demo workspace</strong> · Sample content. Edits stay in this browser.
            </span>
            <a href="/login">
              Private sign-in <Icon name="arrow" size={13} />
            </a>
          </div>
        )}
        {(error || signOutError) && (
          <div className="save-alert" role="alert">
            <div>
              <strong>
                {status === 'conflict'
                  ? 'A newer version was saved on another device.'
                  : 'Your changes need attention.'}
              </strong>
              <p>{error || signOutError}</p>
            </div>
            <div className="inline">
              <button className="button button-secondary button-small" onClick={() => exportJson(data)}>
                Export my draft
              </button>
              {status === 'conflict' ? (
                <button
                  className="button button-primary button-small"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Reload the cloud version? Your unsaved local changes will be replaced. Export your draft first.',
                      )
                    )
                      reload();
                  }}
                >
                  Reload cloud version
                </button>
              ) : (
                <button className="button button-primary button-small" onClick={retry}>
                  Retry save
                </button>
              )}
            </div>
          </div>
        )}
        <main id="main" className="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === 'today'
                  ? `${formatDate(date, { weekday: 'long' }).toUpperCase()} / ${formatDate(date, { month: 'long', day: 'numeric' }).toUpperCase()}`
                  : view === 'review'
                    ? 'THE BIGGER PICTURE'
                    : view === 'settings'
                      ? 'A SPACE THAT FITS YOU'
                      : 'THE WORK BEHIND THE PROGRESS'}
              </span>
              <h1>{titles[view]}</h1>
              <p>{subtitles[view]}</p>
            </div>
            {view !== 'settings' && (
              <div className="date-controls">
                <button
                  className="icon-button"
                  aria-label="Previous day"
                  onClick={() => setSelectedDate(addDays(date, view === 'review' ? -7 : -1))}
                >
                  <Icon name="chevron" size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <label className="date-picker">
                  <Icon name="review" size={15} />
                  <input
                    type="date"
                    aria-label="Selected date"
                    value={date}
                    onChange={e => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label="Next day"
                  onClick={() => setSelectedDate(addDays(date, view === 'review' ? 7 : 1))}
                >
                  <Icon name="chevron" size={16} />
                </button>
                {date !== today && (
                  <button className="today-button" onClick={() => setSelectedDate(null)}>
                    Today
                  </button>
                )}
              </div>
            )}
          </div>
          {!data.settings.configured && view !== 'settings' && (
            <div className="onboarding-banner">
              <div>
                <strong>Your first chapter starts here.</strong>
                <p>Set your name, start date, and daily intentions. Everything stays editable.</p>
              </div>
              <button className="button button-primary button-small" onClick={() => navigate('settings')}>
                Make it mine <Icon name="arrow" size={15} />
              </button>
            </div>
          )}
          {view === 'today' && (
            <Daily
              {...props}
              onPlanTomorrow={() => {
                setSelectedDate(addDays(today, 1));
                navigate('today');
              }}
            />
          )}
          {view === 'journal' && <Journal {...props} onSelectDate={setSelectedDate} />}
          {view === 'trades' && <Trades {...props} />}
          {view === 'career' && <Career {...props} />}
          {view === 'review' && <Review {...props} />}
          {view === 'settings' && <Settings {...props} />}
          <footer className="page-footer">
            <span>Progress is a practice, not a perfect streak.</span>
            <span>
              ONE DAY AT A TIME <Icon name="leaf" size={13} />
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(item => (
          <button
            key={item.id}
            className={view === item.id ? 'active' : ''}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.id === 'review' ? 'Review' : item.id === 'trades' ? 'Trades' : item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
