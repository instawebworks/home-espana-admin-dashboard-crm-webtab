import { useMemo, useState } from "react";
import { buildDashboard, WORKLIST_LIMIT } from "../components/dashboard/dashboardMetrics";
import "./Dashboard.css";

const ic = {
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
  ),
  dots: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
  ),
};

const SEVERITY_ICON = { warning: ic.clock, serious: ic.alert, neutral: ic.dots };

function StatusPill({ severity, children }) {
  return (
    <span className={`db-pill db-pill--${severity}`}>
      {SEVERITY_ICON[severity] ?? ic.dots}
      {children}
    </span>
  );
}

function Card({ title, note, children }) {
  return (
    <section className="db-card">
      <div className="db-card-head">
        <span className="db-card-title">{title}</span>
        {note && <span className="db-card-note">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function formatAge(days) {
  if (days === null || days === undefined) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/* Nominal categories compared by magnitude → one hue for every bar; the value
   is direct-labelled at the tip so nothing depends on hover. */
function BarList({ items, emptyText }) {
  if (!items.length) return <p className="db-empty">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="db-bars">
      {items.map((item) => (
        <div key={item.key} className="db-bar-row">
          <span className="db-bar-name" title={item.label}>
            {item.label}
            {item.sublabel && <span> · {item.sublabel}</span>}
          </span>
          <span className="db-bar-track">
            <span
              className={`db-bar-fill${item.value === 0 ? " db-bar-fill--muted" : ""}`}
              style={{ width: `${Math.max((item.value / max) * 100, item.value === 0 ? 0 : 4)}%` }}
            />
          </span>
          <span className="db-bar-val">
            {item.value}
            {item.caption && <span className="db-bar-sub"> {item.caption}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ submissionLogs, documentTemplates, onOpenSubmission }) {
  const data = useMemo(
    () => buildDashboard(submissionLogs, documentTemplates),
    [submissionLogs, documentTemplates],
  );
  // Hover readout lives in the card header rather than in a floating bubble: an
  // absolutely-positioned tooltip sits outside the plot at the chart's edges and
  // adds scrollable width even at opacity 0, which forced a horizontal scrollbar.
  const [hoverWeek, setHoverWeek] = useState(null);

  const loading = submissionLogs === null || documentTemplates === null;
  const { kpis, funnel, worklist, owners, templateUsage, unusedTemplates, rejections, intake } = data;

  const funnelTotal = funnel.notStarted + funnel.inProgress + funnel.complete;
  const funnelStages = [
    { step: 1, name: "Not started", value: funnel.notStarted },
    { step: 2, name: "In progress", value: funnel.inProgress },
    { step: 3, name: "Fully signed off", value: funnel.complete },
  ];

  const intakeMax = Math.max(...intake.map((w) => w.count), 1);
  const intakePeak = intake.reduce((best, w) => (w.count > best.count ? w : best), intake[0] ?? { count: 0 });
  const shownWorklist = worklist.slice(0, WORKLIST_LIMIT);

  if (loading) {
    return (
      <div className="db-root">
        <div className="db-head">
          <h2 className="db-title">Dashboard</h2>
        </div>
        <section className="db-card">
          <p className="db-empty">Loading submission data…</p>
        </section>
      </div>
    );
  }

  return (
    <div className="db-root">
      <div className="db-head">
        <h2 className="db-title">Dashboard</h2>
        <p className="db-sub">
          Across the latest {kpis.submissions} submission{kpis.submissions === 1 ? "" : "s"} loaded.
        </p>
      </div>

      {/* ── KPI row ── */}
      <div className="db-kpis">
        <div className="db-kpi">
          <div className="db-kpi-label">Submissions</div>
          <div className="db-kpi-value">{kpis.submissions}</div>
          <div className="db-kpi-foot"><b>{kpis.completeCount}</b> fully signed off</div>
        </div>
        <div className="db-kpi">
          <div className="db-kpi-label">Documents received</div>
          <div className="db-kpi-value">{kpis.documents}</div>
          <div className="db-kpi-foot">
            {kpis.awaitingUpload > 0
              ? <><b>{kpis.awaitingUpload}</b> submission{kpis.awaitingUpload === 1 ? "" : "s"} with none yet</>
              : "Every submission has uploads"}
          </div>
        </div>
        <div className="db-kpi">
          <div className="db-kpi-label">Average sign-off</div>
          <div className={`db-kpi-value${kpis.avgCompletion === null ? " db-kpi-empty" : ""}`}>
            {kpis.avgCompletion === null ? "No data" : `${kpis.avgCompletion}%`}
          </div>
          <div className="db-kpi-foot">Across applicant sections</div>
        </div>
        <div className="db-kpi">
          <div className="db-kpi-label">Applicants</div>
          <div className="db-kpi-value">{kpis.applicants}</div>
          <div className="db-kpi-foot"><b>{kpis.jointCount}</b> joint application{kpis.jointCount === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div className="db-grid db-grid--main">
        {/* ── Attention worklist ── */}
        <Card
          title="Needs attention"
          note={worklist.length > shownWorklist.length ? `${shownWorklist.length} of ${worklist.length}` : null}
        >
          {shownWorklist.length === 0 ? (
            <p className="db-empty">Nothing outstanding — every submission is fully signed off.</p>
          ) : (
            <div className="db-list">
              {shownWorklist.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="db-item"
                  onClick={() => onOpenSubmission?.(row.id)}
                  title={`Open ${row.dealName}`}
                >
                  <span className="db-item-main">
                    <span className="db-item-top">
                      <span className="db-item-name">{row.dealName}</span>
                      <StatusPill severity={row.severity}>{row.reason}</StatusPill>
                    </span>
                    <span className="db-item-meta">
                      <span>{row.clientName || "Unknown client"}</span>
                      <span className="db-item-dot">•</span>
                      <span>{row.docs} doc{row.docs === 1 ? "" : "s"}</span>
                      <span className="db-item-dot">•</span>
                      <span>idle {formatAge(row.idleDays)}</span>
                    </span>
                  </span>
                  <span className="db-item-right">
                    <span className="db-item-prog">
                      <span className="db-item-prog-cap">
                        {row.total > 0 ? `${row.signed}/${row.total}` : "no template"}
                      </span>
                      <span className="db-item-prog-track">
                        <span
                          className="db-item-prog-fill"
                          style={{ width: `${row.pct ?? 0}%` }}
                        />
                      </span>
                    </span>
                    <span className="db-chev">{ic.chevron}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="db-foot">
            Ranked by longest without activity. Sign-off counts admin section approvals —
            document-level review status is not available without opening a record.
          </p>
        </Card>

        <div className="db-stack">
          {/* ── Sign-off funnel (ordinal ramp) ── */}
          <Card title="Sign-off progress">
            {funnelTotal === 0 ? (
              <p className="db-empty">No submissions to measure yet.</p>
            ) : (
              <>
                <div className="db-funnel-bar" role="img" aria-label={
                  funnelStages.map((s) => `${s.name}: ${s.value}`).join(", ")
                }>
                  {funnelStages.filter((s) => s.value > 0).map((s) => (
                    <span
                      key={s.step}
                      className={`db-funnel-seg db-funnel-seg--${s.step}`}
                      style={{ width: `${(s.value / funnelTotal) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="db-legend">
                  {funnelStages.map((s) => (
                    <span key={s.step} className="db-legend-row">
                      <span className={`db-legend-key db-legend-key--${s.step}`} />
                      <span className="db-legend-name">{s.name}</span>
                      <span className="db-legend-val">{s.value}</span>
                      <span className="db-legend-pct">
                        {Math.round((s.value / funnelTotal) * 100)}%
                      </span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* ── Intake trend ── */}
          <Card
            title="New submissions"
            note={
              hoverWeek
                ? `week of ${hoverWeek.label} · ${hoverWeek.count} submission${hoverWeek.count === 1 ? "" : "s"}`
                : "last 8 weeks"
            }
          >
            <div className="db-chart">
              <div className="db-yaxis">
                <span>{intakeMax}</span>
                <span>0</span>
              </div>
              <div className="db-plot">
                <span className="db-gridline" style={{ top: 0 }} />
                <span className="db-gridline" style={{ bottom: 0 }} />
                <div className="db-cols" onMouseLeave={() => setHoverWeek(null)}>
                  {intake.map((week) => {
                    const isPeak = week.count === intakePeak.count && week.count > 0;
                    return (
                      <span
                        key={week.start}
                        className={`db-col${hoverWeek?.start === week.start ? " db-col--on" : ""}`}
                        tabIndex={0}
                        aria-label={`Week of ${week.label}: ${week.count} submissions`}
                        onMouseEnter={() => setHoverWeek(week)}
                        onFocus={() => setHoverWeek(week)}
                        onBlur={() => setHoverWeek(null)}
                      >
                        {isPeak && (
                          <span className="db-col-cap" style={{ bottom: `calc(${(week.count / intakeMax) * 100}% + 4px)` }}>
                            {week.count}
                          </span>
                        )}
                        <span
                          className={`db-col-fill${week.count === 0 ? " db-col-fill--zero" : ""}`}
                          style={{ height: week.count === 0 ? "2px" : `${(week.count / intakeMax) * 100}%` }}
                        />
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="db-xaxis">
              {intake.map((week, i) => (
                <span key={week.start} className="db-xtick">
                  {i % 2 === 0 ? week.label : ""}
                </span>
              ))}
            </div>
            <table className="db-sr">
              <caption>New submissions per week</caption>
              <tbody>
                {intake.map((w) => (
                  <tr key={w.start}><th scope="row">Week of {w.label}</th><td>{w.count}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <div className="db-grid db-grid--pair">
        {/* ── Workload by deal owner ── */}
        <Card title="Workload by deal owner">
          <BarList
            emptyText="No deal owners recorded yet."
            items={owners.map((o) => ({
              key: o.name,
              label: o.name,
              value: o.submissions,
              caption: o.pct !== null ? `· ${o.pct}%` : "",
            }))}
          />
          <p className="db-foot">Bar length is submissions held; the percentage is their combined sign-off.</p>
        </Card>

        {/* ── Template usage ── */}
        <Card
          title="Template usage"
          note={unusedTemplates.length ? `${unusedTemplates.length} unused` : null}
        >
          <BarList
            emptyText="No templates found."
            items={templateUsage.map((t) => ({
              key: t.id,
              label: t.name,
              sublabel: t.country,
              value: t.submissions,
            }))}
          />
          {unusedTemplates.length > 0 && (
            <p className="db-foot">
              Never used: {unusedTemplates.map((t) => t.name).join(", ")}.
            </p>
          )}
        </Card>
      </div>

      {/* ── Recent rejections ── */}
      <Card title="Recently rejected documents" note={rejections.length ? `${rejections.length} total` : null}>
        {rejections.length === 0 ? (
          <p className="db-empty">No documents have been rejected.</p>
        ) : (
          <div>
            {rejections.slice(0, 5).map((r) => (
              <div key={`${r.id}-${r.at}`} className="db-rej">
                <span className="db-rej-ic">{ic.x}</span>
                <span className="db-rej-main">
                  <span className="db-rej-doc">{r.docName}</span>
                  <span className="db-rej-meta">
                    {r.dealName}
                    {r.clientName ? ` · ${r.clientName}` : ""}
                  </span>
                </span>
                <span className="db-rej-age">{formatAge(r.ageDays)} ago</span>
              </div>
            ))}
          </div>
        )}
        <p className="db-foot">
          Shows each submission's most recent rejection, so the client knows what to re-send.
        </p>
      </Card>
    </div>
  );
}

export default Dashboard;
