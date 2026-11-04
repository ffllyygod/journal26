'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { addDays, currentDay, dayDifference, formatDate, weekStart } from '@/lib/domain';
import { describeConflict } from '@/lib/merge';
import { exportJson } from '@/lib/export';
import { useWorkspace } from '@/lib/use-workspace';
import { createClient } from '@/lib/supabase/client';
import type { View, Workspace as WorkspaceData, UpdateWorkspace } from '@/lib/types';
import { Daily, Journal } from './daily';
import { Trades } from './trades';
import { Career } from './career';
import { Review } from './review';
import { Settings } from './settings';
import { UrgeButton } from './urge';
import { Board } from './board';
import { WritingWelcome } from './writing-welcome';
import { forgetFocusSession } from './focus';
import { Setup } from './setup';
import { Icon, type IconName } from './ui';

const navigation: { id: View; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'sun' },
  { id: 'journal', label: 'Journal', icon: 'book' },
  { id: 'trades', label: 'Trades', icon: 'chart' },
  { id: 'career', label: 'Career', icon: 'briefcase' },
  { id: 'review', label: 'Review', icon: 'review' },
];
export function Workspace({ demo = false, userId }: { demo?: boolean; userId?: string }) {
  const store = useWorkspace({ demo, userId });
  if (!store.data)
    return (
      <main className="loading-page">
        <Link href="/" className="brand">
          journal26
        </Link>
        <div className="panel loading-panel">
          <h1>{store.error ? 'Could not open your journal' : 'Opening your journal…'}</h1>
          {store.error && <p>{store.error}</p>}
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
      key={store.data.resetId ?? 'original'}
      data={store.data}
      update={store.update}
      demo={demo}
      userId={userId}
      status={store.status}
      error={store.error}
      notice={store.notice}
      conflicts={store.conflicts}
      retry={store.retry}
      reload={store.reload}
      keepMine={store.keepMine}
      forgetDevice={store.forgetDevice}
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
  notice,
  conflicts,
  retry,
  reload,
  keepMine,
  forgetDevice,
  pending,
}: {
  data: WorkspaceData;
  update: UpdateWorkspace;
  demo: boolean;
  userId?: string;
  status: string;
  error: string | null;
  notice: string | null;
  conflicts: string[];
  retry: () => void;
  reload: () => void;
  keepMine: () => void;
  forgetDevice: () => void;
  pending: boolean;
}) {
  const [view, setView] = useState<View>('today');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [writingFocusDate, setWritingFocusDate] = useState<string | null>(null);
  const [, tick] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const today = currentDay(data.settings);
  const date = selectedDate ?? today;
  const viewedDay = dayDifference(data.settings.startDate, date) + 1;
  const viewedLabel =
    viewedDay < 1
      ? `${1 - viewedDay} days before the start`
      : viewedDay > data.settings.duration
        ? 'After the challenge'
        : `Day ${viewedDay} of ${data.settings.duration}`;
  const reviewStart = weekStart(date);
  const shortDate = (value: string) => formatDate(value, { month: 'short', day: 'numeric' });
  const headings: Record<View, { title: string; note?: string }> = {
    today: { title: viewedLabel, note: formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' }) },
    journal: { title: 'Journal' },
    trades: { title: 'Trades' },
    career: { title: 'Career' },
    review: { title: 'Review', note: `${shortDate(reviewStart)} to ${shortDate(addDays(reviewStart, 6))}` },
    settings: { title: 'Settings' },
  };
  const props = { data, update, date, demo, userId };
  function navigate(next: View) {
    setWritingFocusDate(null);
    setView(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function selectDate(next: string | null) {
    setWritingFocusDate(null);
    setSelectedDate(next);
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
      forgetDevice();
      forgetFocusSession();
      // A full page load drops every in-memory copy of the journal from this tab.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    } catch {
      setSignOutError('Could not sign out. Please try again.');
      setSigningOut(false);
    }
  }
  if (!data.settings.configured) return <Setup data={data} update={update} today={today} />;
  const step = view === 'review' ? 7 : 1;
  const unit = view === 'review' ? 'week' : 'day';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href={demo ? '/demo' : '/journal'}>
          journal26
        </a>
        <nav aria-label="Main navigation">
          {navigation.map(item => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p className="own-words sidebar-why">{data.settings.intention}</p>
          <button
            className={`nav-item settings-nav ${view === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Icon name="settings" size={18} />
            <span>Settings</span>
          </button>
          <div className="profile">
            <strong>{data.settings.name || 'Signed in'}</strong>
            {!demo && (
              <button
                className="icon-button"
                onClick={() => void signOut()}
                disabled={signingOut}
                aria-label="Sign out"
              >
                <Icon name="logout" size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <a className="brand topbar-brand" href={demo ? '/demo' : '/journal'}>
            journal26
          </a>
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
          <button
            className="icon-button mobile-settings"
            onClick={() => navigate('settings')}
            aria-label="Settings"
          >
            <Icon name="settings" size={18} />
          </button>
        </header>
        <main id="main" className="main-content">
          {demo && (
            <div className="demo-strip">
              <span>Sample data. Edits stay in this browser.</span>
              <a href="/login">Sign in</a>
            </div>
          )}
          {notice && !error && (
            <div className="sync-notice" role="status">
              {notice}
            </div>
          )}
          {(error || signOutError) && (
            <div className="save-alert" role="alert">
              <div>
                <strong>
                  {status === 'conflict'
                    ? conflicts.includes('resetId')
                      ? 'A challenge restart changed this journal'
                      : 'Two devices changed the same thing'
                    : 'Not synced yet'}
                </strong>
                <p>{error || signOutError}</p>
                {conflicts.length > 0 && (
                  <ul className="conflict-list">
                    {conflicts.map(path => (
                      <li key={path}>{describeConflict(path)}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="inline">
                <button className="button button-secondary button-small" onClick={() => exportJson(data)}>
                  Export my draft
                </button>
                {status === 'conflict' ? (
                  <>
                    <button className="button button-secondary button-small" onClick={reload}>
                      Use the cloud version
                    </button>
                    {conflicts.length > 0 && (
                      <button className="button button-primary button-small" onClick={keepMine}>
                        {conflicts.includes('resetId') ? 'Keep restarted version' : 'Keep this device’s'}
                      </button>
                    )}
                  </>
                ) : (
                  <button className="button button-primary button-small" onClick={retry}>
                    Retry now
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>{headings[view].title}</h1>
              {headings[view].note && <p>{headings[view].note}</p>}
            </div>
            {(view === 'today' || view === 'journal' || view === 'review') && (
              <div className="date-controls">
                <button
                  className="icon-button"
                  aria-label={`Previous ${unit}`}
                  onClick={() => selectDate(addDays(date, -step))}
                >
                  <Icon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <input
                  type="date"
                  aria-label="Selected date"
                  value={date}
                  onChange={e => {
                    if (e.target.value) selectDate(e.target.value);
                  }}
                />
                <button
                  className="icon-button"
                  aria-label={`Next ${unit}`}
                  onClick={() => selectDate(addDays(date, step))}
                >
                  <Icon name="chevron" size={15} />
                </button>
                {date !== today && (
                  <button className="today-button" onClick={() => selectDate(null)}>
                    Today
                  </button>
                )}
              </div>
            )}
          </div>
          {view === 'today' && date <= today && (
            <WritingWelcome
              data={data}
              date={date}
              today={today}
              onWrite={() => {
                navigate('journal');
                setWritingFocusDate(date);
              }}
              onSelect={selectDate}
            />
          )}
          {view === 'today' && <Board data={data} date={date} today={today} onSelect={selectDate} />}
          {view === 'today' && (
            <Daily
              key={date}
              {...props}
              onPlanTomorrow={() => {
                selectDate(addDays(date, 1));
                navigate('today');
              }}
              onSelectDate={selectDate}
              onNavigate={navigate}
            />
          )}
          {view === 'journal' && (
            <Journal {...props} autoFocus={writingFocusDate === date} onSelectDate={selectDate} />
          )}
          {view === 'trades' && <Trades {...props} />}
          {view === 'career' && <Career {...props} />}
          {view === 'review' && <Review {...props} />}
          {view === 'settings' && <Settings {...props} canRestart={status === 'saved' && !pending} />}
        </main>
      </div>
      <UrgeButton data={data} update={update} today={today} />
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(item => (
          <button
            key={item.id}
            className={view === item.id ? 'active' : ''}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
