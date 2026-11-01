'use client';

import { useState, type FormEvent } from 'react';
import type { FeatureProps, Trade } from '@/lib/types';
import { formatDate, money, tradeR, tradeStats } from '@/lib/domain';
import { AttachmentGallery } from './attachments';
import { EmptyState, Field, Icon, Modal, SectionHeading } from './ui';

function TradeEditor({
  trade,
  date,
  currency,
  defaultAccount,
  demo,
  userId,
  onSave,
  onClose,
}: {
  trade: Trade | null;
  date: string;
  currency: string;
  defaultAccount: Trade['account'];
  demo: boolean;
  userId?: string;
  onSave: (trade: Trade) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Trade['status']>(trade?.status ?? 'open');
  const [attachments, setAttachments] = useState(trade?.attachments ?? []);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const close = () => {
    if (!dirty || window.confirm('Discard changes to this trade?')) onClose();
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const number = (key: string) => (text(key) === '' ? null : Number(text(key)));
    const entry = number('entry');
    const exit = number('exit');
    const stop = number('stop');
    const target = number('target');
    const risk = number('risk');
    const netPnl = status === 'closed' ? number('netPnl') : null;
    const fees = number('fees') ?? 0;
    if (entry === null || !Number.isFinite(entry) || entry <= 0)
      return setError('Enter a positive entry price.');
    if ([exit, stop, target, risk].some(value => value !== null && (!Number.isFinite(value) || value <= 0)))
      return setError('Prices and initial risk must be positive, or left blank.');
    if (!Number.isFinite(fees) || fees < 0) return setError('Fees must be zero or greater.');
    if (status === 'closed' && (netPnl === null || !Number.isFinite(netPnl)))
      return setError('Enter the broker-reported net result for a closed trade. Use 0 for break-even.');
    onSave({
      id: trade?.id ?? crypto.randomUUID(),
      date: text('date'),
      symbol: text('symbol') as Trade['symbol'],
      account: text('account') as Trade['account'],
      direction: text('direction') as Trade['direction'],
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
      followedPlan: text('followedPlan') as Trade['followedPlan'],
      thesis: text('thesis'),
      review: text('review'),
      attachments,
    });
  }

  return (
    <Modal title={trade ? 'Review your trade' : 'Record a trade'} onClose={close} wide>
      <p className="muted">
        Capture the decision as well as the outcome. An open trade can be completed later.
      </p>
      <form onSubmit={submit} onChange={() => setDirty(true)} className="stack">
        <div className="form-grid">
          <Field label="Trade date">
            <input name="date" type="date" defaultValue={trade?.date ?? date} required />
          </Field>
          <Field label="Market">
            <select name="symbol" defaultValue={trade?.symbol ?? 'XAUUSD'}>
              <option>XAUUSD</option>
              <option>BTC</option>
              <option>ETH</option>
            </select>
          </Field>
          <Field label="Account">
            <select name="account" defaultValue={trade?.account ?? defaultAccount}>
              <option value="demo">Demo / paper</option>
              <option value="live">Live account</option>
            </select>
          </Field>
          <Field label="Direction">
            <select name="direction" defaultValue={trade?.direction ?? 'long'}>
              <option value="long">Long / buy</option>
              <option value="short">Short / sell</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={e => setStatus(e.target.value as Trade['status'])}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
          <Field label="Setup / strategy">
            <input
              name="setup"
              defaultValue={trade?.setup ?? ''}
              maxLength={120}
              placeholder="e.g. Break and retest"
            />
          </Field>
          <Field label="Entry price">
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
          <Field label="Position size" hint="Include units, e.g. 0.01 lots or 0.02 BTC.">
            <input name="size" defaultValue={trade?.size ?? ''} maxLength={80} placeholder="Size and units" />
          </Field>
          <Field label="Initial stop price">
            <input
              name="stop"
              type="number"
              min="0.00000001"
              step="any"
              defaultValue={trade?.stop ?? ''}
              inputMode="decimal"
            />
          </Field>
          <Field label="Target price">
            <input
              name="target"
              type="number"
              min="0.00000001"
              step="any"
              defaultValue={trade?.target ?? ''}
              inputMode="decimal"
            />
          </Field>
          <Field label={`Initial risk (${currency})`} hint="Money you planned to risk. Used to calculate R.">
            <input
              name="risk"
              type="number"
              min="0.00000001"
              step="any"
              defaultValue={trade?.risk ?? ''}
              inputMode="decimal"
            />
          </Field>
          <Field label={`Fees (${currency})`} hint="For reference; already included in your net result.">
            <input
              name="fees"
              type="number"
              min="0"
              step="any"
              defaultValue={trade?.fees ?? 0}
              inputMode="decimal"
            />
          </Field>
          {status === 'closed' && (
            <>
              <Field label="Exit price">
                <input
                  name="exit"
                  type="number"
                  min="0.00000001"
                  step="any"
                  defaultValue={trade?.exit ?? ''}
                  inputMode="decimal"
                />
              </Field>
              <Field
                label={`Net result (${currency})`}
                hint="Copy your broker's result after fees. Negative for a loss."
              >
                <input
                  name="netPnl"
                  type="number"
                  step="any"
                  defaultValue={trade?.netPnl ?? ''}
                  required
                  inputMode="decimal"
                />
              </Field>
            </>
          )}
          <Field label="How did you feel?">
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
          <Field label="Did you follow your plan?">
            <select name="followedPlan" defaultValue={trade?.followedPlan ?? 'unset'}>
              <option value="unset">Not reviewed yet</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>
        <Field label="Why this trade?">
          <textarea
            name="thesis"
            rows={3}
            maxLength={10000}
            defaultValue={trade?.thesis ?? ''}
            placeholder="The setup, confirmation, and what would invalidate the idea…"
          />
        </Field>
        <Field label="Review & lesson">
          <textarea
            name="review"
            rows={3}
            maxLength={10000}
            defaultValue={trade?.review ?? ''}
            placeholder="What did you execute well? What will you do differently?"
          />
        </Field>
        <div>
          <span className="eyebrow">CHARTS & SCREENSHOTS</span>
          <AttachmentGallery
            attachments={attachments}
            onChange={value => {
              setAttachments(value);
              setDirty(true);
            }}
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
          <button type="button" className="button button-secondary" onClick={close}>
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            Save trade <Icon name="check" size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Trades({ data, update, date, demo, userId }: FeatureProps) {
  const [account, setAccount] = useState<Trade['account']>('demo');
  const [symbol, setSymbol] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{ trade: Trade | null } | null>(null);
  const filtered = data.trades
    .filter(
      trade =>
        trade.account === account &&
        (symbol === 'all' || trade.symbol === symbol) &&
        (status === 'all' || trade.status === status) &&
        `${trade.symbol} ${trade.setup} ${trade.thesis} ${trade.review}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const stats = tradeStats(filtered);
  const reviewed = filtered.filter(trade => trade.followedPlan !== 'unset');
  const adherence = reviewed.length
    ? Math.round((reviewed.filter(trade => trade.followedPlan === 'yes').length / reviewed.length) * 100)
    : null;

  function save(trade: Trade) {
    update(current => ({
      ...current,
      trades: current.trades.some(t => t.id === trade.id)
        ? current.trades.map(t => (t.id === trade.id ? trade : t))
        : [trade, ...current.trades],
    }));
    setAccount(trade.account);
    setEditor(null);
  }
  function remove(trade: Trade) {
    if (window.confirm(`Delete this ${trade.symbol} trade from ${trade.date}? This cannot be undone.`))
      update(current => ({ ...current, trades: current.trades.filter(t => t.id !== trade.id) }));
  }

  return (
    <div className="stack">
      <SectionHeading eyebrow="LEARN FROM EVERY DECISION" title="Your trading journal">
        <button className="button button-primary" onClick={() => setEditor({ trade: null })}>
          <Icon name="plus" size={17} /> Log a trade
        </button>
      </SectionHeading>
      <p className="muted">
        Keep the process honest. Demo and live results stay separate; open trades are excluded from realised
        results.
      </p>
      <div className="filter-bar">
        <div className="segmented" aria-label="Trading account">
          <button
            className={account === 'demo' ? 'active' : ''}
            onClick={() => setAccount('demo')}
            aria-pressed={account === 'demo'}
          >
            Demo / paper
          </button>
          <button
            className={account === 'live' ? 'active' : ''}
            onClick={() => setAccount('live')}
            aria-pressed={account === 'live'}
          >
            Live account
          </button>
        </div>
        <select aria-label="Filter market" value={symbol} onChange={e => setSymbol(e.target.value)}>
          <option value="all">All markets</option>
          <option>XAUUSD</option>
          <option>BTC</option>
          <option>ETH</option>
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
          placeholder="Search setups & notes…"
        />
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="eyebrow">NET RESULT · {account.toUpperCase()}</span>
          <strong>{stats.count ? money(stats.net, data.settings.currency) : '—'}</strong>
          <small>{stats.count} closed trades · after fees</small>
        </div>
        <div className="stat-card">
          <span className="eyebrow">WIN RATE</span>
          <strong>{stats.winRate === null ? '—' : `${Math.round(stats.winRate)}%`}</strong>
          <small>Break-even trades included in total</small>
        </div>
        <div className="stat-card">
          <span className="eyebrow">FOLLOWED THE PLAN</span>
          <strong>{adherence === null ? '—' : `${adherence}%`}</strong>
          <small>{reviewed.length} reviewed trades</small>
        </div>
      </div>
      <section className="panel">
        <SectionHeading title="Trade log">
          <span className="chip">{filtered.length} trades</span>
        </SectionHeading>
        {filtered.length === 0 ? (
          <EmptyState
            icon="chart"
            title={data.trades.length ? 'No trades match these filters' : 'A good decision deserves a record'}
            action={
              <button className="button button-secondary" onClick={() => setEditor({ trade: null })}>
                Record your first trade <Icon name="arrow" size={16} />
              </button>
            }
          >
            Log a setup, your reasoning, and a chart. You can add the result after closing the trade.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date / setup</th>
                  <th>Market</th>
                  <th>Status</th>
                  <th>Net result</th>
                  <th>R</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(trade => (
                  <tr key={trade.id}>
                    <td>
                      <button className="text-button" onClick={() => setEditor({ trade })}>
                        {formatDate(trade.date, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </button>
                      <small className="muted table-subtext">{trade.setup || 'No setup recorded'}</small>
                    </td>
                    <td>
                      <strong>{trade.symbol}</strong>
                      <small className="muted table-subtext">
                        {trade.direction === 'long' ? 'Long / buy' : 'Short / sell'}
                      </small>
                    </td>
                    <td>
                      <span className={`chip ${trade.status === 'open' ? 'chip-amber' : 'chip-green'}`}>
                        {trade.status}
                      </span>
                    </td>
                    <td className={trade.netPnl !== null && trade.netPnl < 0 ? 'negative' : 'positive'}>
                      {trade.status === 'closed' && trade.netPnl !== null
                        ? money(trade.netPnl, data.settings.currency)
                        : '—'}
                    </td>
                    <td>{tradeR(trade) === null ? '—' : `${tradeR(trade)!.toFixed(2)}R`}</td>
                    <td>
                      <div className="inline">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${trade.symbol} trade on ${trade.date}`}
                          onClick={() => setEditor({ trade })}
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${trade.symbol} trade on ${trade.date}`}
                          onClick={() => remove(trade)}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editor && (
        <TradeEditor
          key={editor.trade?.id ?? 'new'}
          trade={editor.trade}
          date={date}
          currency={data.settings.currency}
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
