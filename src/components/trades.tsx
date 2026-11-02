'use client';

import { useState, type FormEvent } from 'react';
import {
  breakdown,
  dayGuardrails,
  levelProblem,
  needsReview,
  plannedRR,
  tradeAnalytics,
  type BreakdownRow,
} from '@/lib/analytics';
import { addDays, currentDay, formatDate, MISTAKE_TAGS, money, sessionAt, tradeR } from '@/lib/domain';
import type { FeatureProps, Settings, Trade, TradeSession } from '@/lib/types';
import { AttachmentGallery } from './attachments';
import { EquityCurve } from './charts';
import { EmptyState, Field, Icon, Modal, SectionHeading } from './ui';

const SESSION_LABELS: Record<Exclude<TradeSession, ''>, string> = {
  asia: 'Asia',
  london: 'London',
  newyork: 'New York',
};

function clockIn(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

export function TradeEditor({
  trade,
  date,
  settings,
  trades,
  defaultAccount,
  demo,
  userId,
  onSave,
  onClose,
}: {
  trade: Trade | null;
  date: string;
  settings: Settings;
  trades: Trade[];
  defaultAccount: Trade['account'];
  demo: boolean;
  userId?: string;
  onSave: (trade: Trade) => void;
  onClose: () => void;
}) {
  const currency = settings.currency;
  const [status, setStatus] = useState<Trade['status']>(trade?.status ?? 'open');
  const [attachments, setAttachments] = useState(trade?.attachments ?? []);
  const [rulesChecked, setRulesChecked] = useState<string[]>(trade?.rulesChecked ?? []);
  const [mistakes, setMistakes] = useState<string[]>(trade?.mistakes ?? []);
  const [defaults] = useState(() => ({ time: clockIn(settings.timezone), session: sessionAt() }));
  const [rr, setRr] = useState<number | null>(trade ? plannedRR(trade) : null);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [followedPlan, setFollowedPlan] = useState(trade?.followedPlan ?? 'unset');
  const close = () => {
    if (uploading) {
      setError('Wait for the image upload to finish before closing this trade.');
      return;
    }
    if (!dirty || window.confirm('Discard changes to this trade?')) onClose();
  };
  const guard = dayGuardrails(trades, trade?.date ?? date, settings);
  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter(value => value !== item) : [...list, item];

  function onFormChange(event: FormEvent<HTMLFormElement>) {
    setDirty(true);
    const form = new FormData(event.currentTarget);
    const read = (key: string) => {
      const value = String(form.get(key) ?? '').trim();
      return value === '' ? null : Number(value);
    };
    const entry = read('entry');
    setRr(entry === null ? null : plannedRR({ entry, stop: read('stop'), target: read('target') }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) {
      setError('Wait for the image upload to finish before saving this trade.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const number = (key: string) => (text(key) === '' ? null : Number(text(key)));
    const entry = number('entry');
    const exit = number('exit');
    const stop = number('stop');
    const target = number('target');
    const risk = number('risk');
    const netPnl = status === 'closed' ? number('netPnl') : null;
    const fees = form.has('fees') ? (number('fees') ?? 0) : (trade?.fees ?? 0);
    const symbol = text('symbol').toUpperCase();
    const direction = text('direction') as Trade['direction'];
    if (!symbol) return setError('Enter the market, such as XAUUSD.');
    if (entry === null || !Number.isFinite(entry) || entry <= 0)
      return setError('Enter a positive entry price.');
    if ([exit, stop, target, risk].some(value => value !== null && (!Number.isFinite(value) || value <= 0)))
      return setError('Prices and initial risk must be positive, or left blank.');
    if (!Number.isFinite(fees) || fees < 0) return setError('Fees must be zero or greater.');
    if (status === 'closed' && (netPnl === null || !Number.isFinite(netPnl)))
      return setError('Enter the broker-reported net result for a closed trade. Use 0 for break-even.');
    const problem = levelProblem(direction, entry, stop, target);
    if (problem) return setError(problem);
    onSave({
      id: trade?.id ?? crypto.randomUUID(),
      date: text('date'),
      time: text('time'),
      session: text('session') as TradeSession,
      symbol,
      account: text('account') as Trade['account'],
      direction,
      status,
      setup: text('setup'),
      entry,
      exit: status === 'closed' ? exit : null,
      stop,
      target,
      size: text('size'),
      risk,
      netPnl,
      fees,
      emotion: text('emotion'),
      followedPlan: form.has('followedPlan')
        ? (text('followedPlan') as Trade['followedPlan'])
        : (trade?.followedPlan ?? 'unset'),
      grade: form.has('grade') ? (text('grade') as Trade['grade']) : (trade?.grade ?? ''),
      mistakes,
      rulesChecked,
      thesis: text('thesis'),
      review: form.has('review') ? text('review') : (trade?.review ?? ''),
      attachments,
    });
  }

  const planSelect = (label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <select
        name="followedPlan"
        value={followedPlan}
        onChange={e => setFollowedPlan(e.target.value as Trade['followedPlan'])}
      >
        <option value="unset">Not recorded</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </Field>
  );
  const when = (
    <>
      <Field label="Date">
        <input name="date" type="date" defaultValue={trade?.date ?? date} required />
      </Field>
      <Field label="Entry time">
        <input name="time" type="time" defaultValue={trade?.time ?? defaults.time} />
      </Field>
      <Field label="Session">
        <select name="session" defaultValue={trade?.session ?? defaults.session}>
          <option value="">Not recorded</option>
          {Object.entries(SESSION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Position size" hint="With units: 0.01 lots, 0.02 BTC">
        <input name="size" defaultValue={trade?.size ?? ''} maxLength={80} />
      </Field>
    </>
  );
  const entrySection = (
    <>
      <div className="form-grid form-grid-three">
        <Field label="Market">
          <input
            name="symbol"
            list="trade-symbols"
            defaultValue={trade?.symbol ?? settings.symbols[0] ?? ''}
            required
            maxLength={20}
            autoCapitalize="characters"
          />
          <datalist id="trade-symbols">
            {settings.symbols.map(symbol => (
              <option key={symbol} value={symbol} />
            ))}
          </datalist>
        </Field>
        <Field label="Direction">
          <select name="direction" defaultValue={trade?.direction ?? 'long'}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </Field>
        <Field label="Account">
          <select name="account" defaultValue={trade?.account ?? defaultAccount}>
            <option value="demo">Demo</option>
            <option value="live">Live</option>
          </select>
        </Field>
        <Field label="Entry">
          <input
            name="entry"
            type="number"
            min="0.00000001"
            step="any"
            defaultValue={trade?.entry}
            required
            inputMode="decimal"
          />
        </Field>
        <Field label="Stop">
          <input
            name="stop"
            type="number"
            min="0.00000001"
            step="any"
            defaultValue={trade?.stop ?? ''}
            inputMode="decimal"
          />
        </Field>
        <Field label="Target">
          <input
            name="target"
            type="number"
            min="0.00000001"
            step="any"
            defaultValue={trade?.target ?? ''}
            inputMode="decimal"
          />
        </Field>
      </div>
      <p className="planned-rr" aria-live="polite">
        {rr === null
          ? 'Add a stop and target to see reward to risk.'
          : `Reward to risk is 1 : ${rr.toFixed(2)}`}
      </p>
      <div className="form-grid form-grid-three">
        <Field label={`Risk (${currency})`} hint="Used to calculate R">
          <input
            name="risk"
            type="number"
            min="0.00000001"
            step="any"
            defaultValue={trade?.risk ?? ''}
            inputMode="decimal"
          />
        </Field>
        <Field label="Setup">
          <input name="setup" list="trade-setups" defaultValue={trade?.setup ?? ''} maxLength={120} />
          <datalist id="trade-setups">
            {[...new Set(trades.map(item => item.setup).filter(Boolean))].map(setup => (
              <option key={setup} value={setup} />
            ))}
          </datalist>
        </Field>
        <Field label="Feeling going in">
          <select name="emotion" defaultValue={trade?.emotion ?? ''}>
            <option value="">Not recorded</option>
            <option>Calm</option>
            <option>Confident</option>
            <option>Hesitant</option>
            <option>FOMO</option>
            <option>Frustrated</option>
            <option>Rushed</option>
          </select>
        </Field>
      </div>
      {settings.tradingRules.length > 0 && (
        <fieldset className="rule-check">
          <legend>
            Before you enter{' '}
            <span>
              {rulesChecked.filter(rule => settings.tradingRules.includes(rule)).length} of{' '}
              {settings.tradingRules.length}
            </span>
          </legend>
          {settings.tradingRules.map(rule => (
            <label key={rule}>
              <input
                type="checkbox"
                checked={rulesChecked.includes(rule)}
                onChange={() => {
                  setRulesChecked(toggle(rulesChecked, rule));
                  setDirty(true);
                }}
              />
              <span>{rule}</span>
            </label>
          ))}
        </fieldset>
      )}
      <Field label="Why this trade?">
        <textarea
          className="own-words"
          name="thesis"
          rows={3}
          maxLength={10000}
          defaultValue={trade?.thesis ?? ''}
          placeholder="The setup, the confirmation, what would prove it wrong"
        />
      </Field>
    </>
  );
  const closedSection = (
    <div className="after-trade stack">
      <div className="form-grid form-grid-three">
        <Field label={`Net result (${currency})`} hint="From your broker, after fees">
          <input
            name="netPnl"
            type="number"
            step="any"
            defaultValue={trade?.netPnl ?? ''}
            required
            inputMode="decimal"
            autoFocus
          />
        </Field>
        <Field label="Exit">
          <input
            name="exit"
            type="number"
            min="0.00000001"
            step="any"
            defaultValue={trade?.exit ?? ''}
            inputMode="decimal"
          />
        </Field>
        <Field label={`Fees (${currency})`} hint="For reference only">
          <input
            name="fees"
            type="number"
            min="0"
            step="any"
            defaultValue={trade?.fees ?? 0}
            inputMode="decimal"
          />
        </Field>
        {planSelect('Followed the plan?')}
        <Field label="Setup quality">
          <select name="grade" defaultValue={trade?.grade ?? ''}>
            <option value="">Not graded</option>
            <option value="A">A: exactly my setup</option>
            <option value="B">B: acceptable</option>
            <option value="C">C: should have skipped</option>
          </select>
        </Field>
      </div>
      <div>
        <span className="field-label">Mistakes</span>
        <div className="tag-row">
          {MISTAKE_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              className={`tag ${mistakes.includes(tag) ? 'tag-on' : ''}`}
              aria-pressed={mistakes.includes(tag)}
              onClick={() => {
                setMistakes(toggle(mistakes, tag));
                setDirty(true);
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      <Field label="Review">
        <textarea
          className="own-words"
          name="review"
          rows={3}
          maxLength={10000}
          defaultValue={trade?.review ?? ''}
          placeholder="What went well? What changes next time?"
        />
      </Field>
    </div>
  );

  return (
    <Modal
      title={
        !trade
          ? 'Log a trade'
          : status === 'open'
            ? `${trade.symbol}: open position`
            : `${trade.symbol}: review`
      }
      onClose={close}
      wide
    >
      {!trade && (guard.tradeLimitHit || guard.lossLimitHit) && (
        <div className="guard-alert" role="alert">
          <div>
            <strong>
              {guard.lossLimitHit
                ? 'Your daily loss limit is hit.'
                : 'You have reached your trade limit today.'}
            </strong>
            <p>You set this rule with a clear head. If you still take this trade, log it and tag why.</p>
          </div>
        </div>
      )}
      <form onSubmit={submit} onChange={onFormChange} className="stack">
        {/* The entry fields stay mounted in one place: moving them would discard what was typed. */}
        {status === 'open' ? (
          <button
            type="button"
            className="button button-secondary button-full"
            onClick={() => {
              setStatus('closed');
              setDirty(true);
            }}
          >
            {trade ? 'Close this trade' : 'Already closed? Add the result'}
          </button>
        ) : (
          <>
            {closedSection}
            <button type="button" className="text-button" onClick={() => setStatus('open')}>
              Still open
            </button>
          </>
        )}
        <details
          className={`details ${status === 'open' ? 'details-flat' : ''}`}
          open={status === 'open' || !trade}
        >
          <summary>Entry details</summary>
          <div className="stack">
            {entrySection}
            {status === 'open' &&
              planSelect(
                'Followed your entry plan?',
                'Holding overnight? Answering this and giving a reason completes the day’s trade step.',
              )}
            <details className="details">
              <summary>Date, time, session and size</summary>
              <div className="form-grid">{when}</div>
            </details>
          </div>
        </details>
        <div>
          <span className="field-label">Charts</span>
          <AttachmentGallery
            attachments={attachments}
            onChange={value => {
              setAttachments(value);
              setDirty(true);
            }}
            onBusyChange={setUploading}
            demo={demo}
            userId={userId}
          />
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={close} disabled={uploading}>
            Cancel
          </button>
          <button className="button button-primary" type="submit" disabled={uploading}>
            {uploading ? 'Uploading image…' : 'Save trade'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function upsertTrade<T extends { trades: Trade[] }>(current: T, trade: Trade): T {
  return {
    ...current,
    trades: current.trades.some(t => t.id === trade.id)
      ? current.trades.map(t => (t.id === trade.id ? trade : t))
      : [trade, ...current.trades],
  };
}

function Breakdown({ rows, label, currency }: { rows: BreakdownRow[]; label: string; currency: string }) {
  if (!rows.length)
    return <p className="muted">Nothing to compare yet. Closed trades with this detail will appear here.</p>;
  return (
    <div className="table-wrap">
      <table className="data-table compact-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th>Trades</th>
            <th>Net</th>
            <th>Win rate</th>
            <th>Avg R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              <td>{row.key}</td>
              <td>{row.count}</td>
              <td className={row.net < 0 ? 'negative' : 'positive'}>{money(row.net, currency)}</td>
              <td>{Math.round(row.winRate)}%</td>
              <td>{row.avgR === null ? '—' : `${row.avgR.toFixed(2)}R`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CUTS = {
  Market: { label: 'Market', key: (t: Trade) => t.symbol },
  Setup: { label: 'Setup', key: (t: Trade) => t.setup },
  Session: { label: 'Session', key: (t: Trade) => (t.session ? SESSION_LABELS[t.session] : '') },
  Emotion: { label: 'Feeling', key: (t: Trade) => t.emotion },
  Mistakes: { label: 'Mistake', key: (t: Trade) => t.mistakes },
} as const;

export function Trades({ data, update, date, demo, userId }: FeatureProps) {
  const [account, setAccount] = useState<Trade['account']>('demo');
  const [symbol, setSymbol] = useState('all');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [search, setSearch] = useState('');
  const [cut, setCut] = useState<keyof typeof CUTS>('Mistakes');
  const [editor, setEditor] = useState<{ trade: Trade | null } | null>(null);
  const currency = data.settings.currency;
  const today = currentDay(data.settings);
  const since = period === 'all' ? '' : addDays(today, -Number(period) + 1);
  const symbols = [...new Set([...data.settings.symbols, ...data.trades.map(t => t.symbol)])];
  const filtered = data.trades
    .filter(
      trade =>
        trade.account === account &&
        trade.date >= since &&
        (symbol === 'all' || trade.symbol === symbol) &&
        (status === 'all' || trade.status === status) &&
        `${trade.symbol} ${trade.setup} ${trade.thesis} ${trade.review} ${trade.mistakes.join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const stats = tradeAnalytics(filtered);
  const signed = (value: number | null, suffix = '') =>
    value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`;

  function save(trade: Trade) {
    update(current => upsertTrade(current, trade));
    setAccount(trade.account);
    setEditor(null);
  }
  function remove(trade: Trade) {
    if (window.confirm(`Delete this ${trade.symbol} trade from ${trade.date}? This cannot be undone.`))
      update(current => ({ ...current, trades: current.trades.filter(t => t.id !== trade.id) }));
  }

  return (
    <div className="stack">
      <div className="filter-bar">
        <button className="button button-primary" onClick={() => setEditor({ trade: null })}>
          <Icon name="plus" size={15} /> Log a trade
        </button>
        <div className="segmented" role="group" aria-label="Trading account">
          <button
            className={account === 'demo' ? 'active' : ''}
            onClick={() => setAccount('demo')}
            aria-pressed={account === 'demo'}
          >
            Demo
          </button>
          <button
            className={account === 'live' ? 'active' : ''}
            onClick={() => setAccount('live')}
            aria-pressed={account === 'live'}
          >
            Live
          </button>
        </div>
        <select aria-label="Filter period" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <select aria-label="Filter market" value={symbol} onChange={e => setSymbol(e.target.value)}>
          <option value="all">All markets</option>
          {symbols.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select aria-label="Filter trade status" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <input
          type="search"
          aria-label="Search trades"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search setups, notes, mistakes"
        />
      </div>
      {stats.lossStreak >= 2 && (
        <div className="guard-alert" role="status">
          <div>
            <strong>{stats.lossStreak} losses in a row.</strong>
            <p>Step away from the chart and review before the next entry.</p>
          </div>
        </div>
      )}
      {stats.count > 0 && (
        <div className="stat-grid stat-grid-six">
          <div className="stat-card">
            <span className="stat-label">Net, {account}</span>
            <strong className={stats.net < 0 ? 'negative' : ''}>
              {stats.count ? money(stats.net, currency) : '—'}
            </strong>
            <small>{stats.count} closed, after fees</small>
          </div>
          <div className="stat-card">
            <span className="stat-label">Win rate</span>
            <strong>{stats.winRate === null ? '—' : `${Math.round(stats.winRate)}%`}</strong>
            <small>
              {stats.wins} won, {stats.losses} lost, {stats.breakeven} even
            </small>
          </div>
          <div className="stat-card">
            <span className="stat-label">Average R</span>
            <strong>{signed(stats.avgR, 'R')}</strong>
            <small>
              {stats.rCount ? `${stats.rCount} trades with risk set` : 'Enter initial risk to measure R'}
            </small>
          </div>
          <div className="stat-card">
            <span className="stat-label">Expectancy</span>
            <strong>{stats.expectancy === null ? '—' : money(stats.expectancy, currency)}</strong>
            <small>Average result per trade</small>
          </div>
          <div className="stat-card">
            <span className="stat-label">Max drawdown</span>
            <strong>{stats.count ? money(stats.maxDrawdown, currency) : '—'}</strong>
            <small>Profit factor {stats.profitFactor === null ? '—' : stats.profitFactor.toFixed(2)}</small>
          </div>
          <div className="stat-card">
            <span className="stat-label">On plan</span>
            <strong>{stats.adherence === null ? '—' : `${Math.round(stats.adherence)}%`}</strong>
            <small>{stats.reviewedCount} reviewed trades</small>
          </div>
        </div>
      )}
      {stats.count > 0 && stats.count < 20 && (
        <p className="microcopy">
          Under 20 closed trades: treat these numbers as notes, not as evidence of an edge.
        </p>
      )}
      {stats.count > 0 && (
        <div className="analytics-grid">
          <section className="panel">
            <SectionHeading title="Cumulative result" />
            <EquityCurve points={stats.equity} currency={currency} />
          </section>
          <section className="panel">
            <SectionHeading title="What pays and what costs" />
            <div className="segmented segmented-wrap" role="group" aria-label="Compare trades by">
              {(Object.keys(CUTS) as (keyof typeof CUTS)[]).map(key => (
                <button
                  key={key}
                  className={cut === key ? 'active' : ''}
                  aria-pressed={cut === key}
                  onClick={() => setCut(key)}
                >
                  {key}
                </button>
              ))}
            </div>
            <Breakdown
              rows={breakdown(filtered, CUTS[cut].key)}
              label={CUTS[cut].label}
              currency={currency}
            />
          </section>
        </div>
      )}
      <section className="panel">
        <SectionHeading title="Trade log">
          <span className="chip">{filtered.length} trades</span>
        </SectionHeading>
        {filtered.length === 0 ? (
          <EmptyState
            icon="chart"
            title={data.trades.length ? 'No trades match these filters' : 'No trades yet'}
            action={
              <button className="button button-secondary" onClick={() => setEditor({ trade: null })}>
                Log a trade
              </button>
            }
          >
            Log the entry now and add the result when it closes. Stats appear after the first closed trade.
          </EmptyState>
        ) : (
          <div className="trade-cards">
            {filtered.map(trade => {
              const r = tradeR(trade);
              return (
                <article className="trade-card" key={trade.id}>
                  <button className="trade-card-main" onClick={() => setEditor({ trade })}>
                    <span className="trade-card-head">
                      <strong>{trade.symbol}</strong>
                      <span className="muted">{trade.direction === 'long' ? 'Long' : 'Short'}</span>
                      <span
                        className={`chip ${trade.status === 'open' ? 'chip-amber' : needsReview(trade) ? 'chip-amber' : 'chip-green'}`}
                      >
                        {trade.status === 'open' ? 'Open' : needsReview(trade) ? 'Needs review' : 'Reviewed'}
                      </span>
                    </span>
                    <span className="muted trade-card-meta">
                      {formatDate(trade.date, { month: 'short', day: 'numeric' })}
                      {trade.time && `, ${trade.time}`}
                      {trade.setup && `, ${trade.setup}`}
                      {trade.mistakes.length > 0 && `. ${trade.mistakes.join(', ')}`}
                    </span>
                  </button>
                  <div className="trade-card-result">
                    <strong className={trade.netPnl !== null && trade.netPnl < 0 ? 'negative' : 'positive'}>
                      {trade.status === 'closed' && trade.netPnl !== null
                        ? money(trade.netPnl, currency)
                        : '—'}
                    </strong>
                    <small className="muted">{r === null ? '' : `${r.toFixed(2)}R`}</small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${trade.symbol} trade on ${trade.date}`}
                    onClick={() => remove(trade)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {editor && (
        <TradeEditor
          key={editor.trade?.id ?? 'new'}
          trade={editor.trade}
          date={date}
          settings={data.settings}
          trades={data.trades}
          defaultAccount={account}
          demo={demo}
          userId={userId}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
