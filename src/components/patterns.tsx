'use client';

import type { Insight } from '@/lib/insights';

const VISIBLE = 5;

export function InsightItem({ insight }: { insight: Insight }) {
  return (
    <li className={`insight insight-${insight.tone}`}>
      <p>{insight.title}</p>
      <small>Based on {insight.evidence}</small>
    </li>
  );
}

export function Patterns({ insights }: { insights: Insight[] }) {
  return (
    <section className="panel patterns">
      <h2>What your data shows</h2>
      {insights.length ? (
        <>
          <ul className="insight-list">
            {insights.slice(0, VISIBLE).map(insight => (
              <InsightItem key={insight.id} insight={insight} />
            ))}
          </ul>
          {insights.length > VISIBLE && (
            <details className="details patterns-more">
              <summary>{insights.length - VISIBLE} more</summary>
              <ul className="insight-list">
                {insights.slice(VISIBLE).map(insight => (
                  <InsightItem key={insight.id} insight={insight} />
                ))}
              </ul>
            </details>
          )}
          <p className="microcopy">
            Counted from your own small sample. These show what happened together, not what caused what.
          </p>
        </>
      ) : (
        <p className="muted">
          Nothing to report yet. Patterns appear once there is enough to compare: three trades on plan and
          three off, two slip days, or four logged cravings.
        </p>
      )}
    </section>
  );
}
