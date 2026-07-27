import {
  parseApplicants,
  normalizeSectionApprovals,
  reqVisibleFor,
  dealNameOf,
  dealOwnerOf,
} from "../submission/submissionHelpers";

// Every figure here is derived from the two arrays App.jsx already loads
// (Submission_Logs + Document_Templates), so the dashboard costs no extra API
// calls. The one thing that is NOT derivable is per-document approval status:
// it lives in the Document_Uploads subform, which list responses omit.

const DAY_MS = 86400000;
const INTAKE_WEEKS = 8;
export const WORKLIST_LIMIT = 6;

function requirementsOf(template) {
  if (!template) return [];
  try {
    const parsed =
      typeof template.Template_JSON === "string"
        ? JSON.parse(template.Template_JSON)
        : template.Template_JSON;
    return parsed?.documentRequirements ?? [];
  } catch {
    return [];
  }
}

// Sign-off = (applicant × visible requirement) pairs the admin has ticked off.
// Requirements come from the log's Template_ID rather than the deal, which keeps
// this free — see the caveat about per-deal "requested" documents in the UI.
function signoffOf(log, requirements) {
  const applicants = parseApplicants(log, []);
  if (!applicants.length || !requirements.length) return { signed: 0, total: 0 };
  const approvals = normalizeSectionApprovals(log.Section_Approvals, applicants);
  let signed = 0;
  let total = 0;
  applicants.forEach((name) => {
    const visible = requirements.filter((req) => reqVisibleFor(req, name));
    total += visible.length;
    const mine = approvals[name] ?? {};
    visible.forEach((req) => { if (mine[req.name] === true) signed += 1; });
  });
  return { signed, total };
}

function docCountOf(log) {
  return log?.$subforms_count?.Document_Uploads ?? 0;
}

function daysSince(iso, now) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

function startOfWeek(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  const mondayOffset = (d.getDay() + 6) % 7; // week starts Monday
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

// "Passport.png -##- 2026-07-10T14:00:58+02:00"
function parseRejection(raw) {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const [docName, stamp] = value.split(" -##- ");
  if (!docName) return null;
  const at = stamp ? new Date(stamp) : null;
  return {
    docName: docName.trim(),
    at: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null,
  };
}

export function buildDashboard(submissionLogs, documentTemplates, now = Date.now()) {
  const logs = Array.isArray(submissionLogs) ? submissionLogs : [];
  const templates = Array.isArray(documentTemplates) ? documentTemplates : [];

  const templateById = {};
  templates.forEach((t) => { templateById[t.id] = t; });

  const rows = logs.map((log) => {
    const template = templateById[log.Template_ID] ?? null;
    const requirements = requirementsOf(template);
    const { signed, total } = signoffOf(log, requirements);
    const applicants = parseApplicants(log, []);
    const docs = docCountOf(log);
    return {
      log,
      id: log.id,
      dealName: dealNameOf(log, {}) || log.Client_Name || "Untitled submission",
      clientName: log.Client_Name ?? "",
      owner: dealOwnerOf(log, {}),
      templateName: template?.Name ?? null,
      templateId: log.Template_ID ?? null,
      applicantCount: applicants.length,
      docs,
      signed,
      total,
      // null when there is no template/applicant basis to measure against
      pct: total > 0 ? Math.round((signed / total) * 100) : null,
      idleDays: daysSince(log.Modified_Time, now),
      createdAt: log.Created_Time ?? null,
      modifiedAt: log.Modified_Time ?? null,
    };
  });

  // ── Funnel (ordinal: not started → in progress → complete) ────────────────
  const funnel = { notStarted: 0, inProgress: 0, complete: 0 };
  rows.forEach((r) => {
    if (r.total > 0 && r.signed >= r.total) funnel.complete += 1;
    else if (r.signed > 0) funnel.inProgress += 1;
    else funnel.notStarted += 1;
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const measurable = rows.filter((r) => r.pct !== null);
  const kpis = {
    submissions: rows.length,
    documents: rows.reduce((sum, r) => sum + r.docs, 0),
    applicants: rows.reduce((sum, r) => sum + r.applicantCount, 0),
    jointCount: rows.filter((r) => r.applicantCount > 1).length,
    avgCompletion: measurable.length
      ? Math.round(measurable.reduce((sum, r) => sum + r.pct, 0) / measurable.length)
      : null,
    completeCount: funnel.complete,
    awaitingUpload: rows.filter((r) => r.docs === 0).length,
  };

  // ── Worklist: stalest incomplete submissions first ────────────────────────
  const openRows = rows.filter((r) => !(r.total > 0 && r.signed >= r.total));
  const worklist = [...openRows]
    .sort((a, b) => {
      const at = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
      const bt = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
      return at - bt; // oldest activity first
    })
    .map((r) => ({
      ...r,
      reason:
        r.docs === 0
          ? "Awaiting first upload"
          : r.total === 0
            ? "No template linked"
            : r.signed === 0
              ? "Nothing signed off"
              : "Partly signed off",
      severity: r.docs === 0 ? "warning" : r.signed === 0 ? "serious" : "neutral",
    }));

  // ── Workload by deal owner ────────────────────────────────────────────────
  const ownerMap = new Map();
  rows.forEach((r) => {
    const key = r.owner || "Unassigned";
    const entry = ownerMap.get(key) ?? { name: key, submissions: 0, signed: 0, total: 0 };
    entry.submissions += 1;
    entry.signed += r.signed;
    entry.total += r.total;
    ownerMap.set(key, entry);
  });
  const owners = [...ownerMap.values()]
    .map((o) => ({ ...o, pct: o.total > 0 ? Math.round((o.signed / o.total) * 100) : null }))
    .sort((a, b) => b.submissions - a.submissions || a.name.localeCompare(b.name));

  // ── Template usage ────────────────────────────────────────────────────────
  const usageById = new Map();
  rows.forEach((r) => {
    if (!r.templateId) return;
    usageById.set(r.templateId, (usageById.get(r.templateId) ?? 0) + 1);
  });
  const templateUsage = templates
    .map((t) => ({
      id: t.id,
      name: t.Name ?? "Untitled",
      country: t.Allowed_For_Country ?? "",
      requirements: requirementsOf(t).length,
      submissions: usageById.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.submissions - a.submissions || a.name.localeCompare(b.name));
  const unusedTemplates = templateUsage.filter((t) => t.submissions === 0);

  // ── Recent rejections ─────────────────────────────────────────────────────
  const rejections = rows
    .map((r) => {
      const parsed = parseRejection(r.log.Rejection_Name_Datetime);
      if (!parsed) return null;
      return {
        id: r.id,
        dealName: r.dealName,
        clientName: r.clientName,
        docName: parsed.docName,
        at: parsed.at,
        ageDays: daysSince(parsed.at, now),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.at ?? 0) - new Date(a.at ?? 0));

  // ── Intake trend: submissions created per week, last 8 weeks ──────────────
  const currentWeek = startOfWeek(now);
  const buckets = [];
  for (let i = INTAKE_WEEKS - 1; i >= 0; i--) {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ start, count: 0 });
  }
  const firstBucket = buckets[0].start.getTime();
  rows.forEach((r) => {
    if (!r.createdAt) return;
    const created = new Date(r.createdAt).getTime();
    if (Number.isNaN(created) || created < firstBucket) return;
    const weekStart = startOfWeek(created).getTime();
    const bucket = buckets.find((b) => b.start.getTime() === weekStart);
    if (bucket) bucket.count += 1;
  });
  const intake = buckets.map((b) => ({
    start: b.start.toISOString(),
    label: b.start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    count: b.count,
  }));

  return {
    rows,
    kpis,
    funnel,
    worklist,
    owners,
    templateUsage,
    unusedTemplates,
    rejections,
    intake,
    hasTemplates: templates.length > 0,
  };
}
