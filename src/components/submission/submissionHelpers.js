// Shared parsing/derivation helpers for Submission_Logs data, used by both the
// expanded detail view (UserUploads) and the summary table (Admins).

export function parseApplicants(submissionLog, uploads) {
  const list = (submissionLog?.Applicants_Listing ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length) return list;
  // Defensive fallback (portal makes Applicants_Listing mandatory).
  return [...new Set((uploads ?? []).map((u) => (u.Submitted_For ?? "").trim()).filter(Boolean))];
}

// Section_Approvals schema: { "<Applicant Name>": { "<Section name>": true } }.
// Legacy entries ({ "<Section>": { section/front/back: true } }) predate the
// per-applicant model and are migrated on read as approved for every applicant;
// the field is rewritten in the new shape on the next checkbox toggle.
export function normalizeSectionApprovals(raw, applicants) {
  let parsed = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return {}; }
  }
  if (!parsed || typeof parsed !== "object") return {};

  const names = applicants.map((n) => n.trim());
  const nameSet = new Set(names);
  const out = {};
  const approve = (name, section) => {
    out[name] = { ...(out[name] ?? {}), [section]: true };
  };

  Object.entries(parsed).forEach(([key, val]) => {
    if (!val || typeof val !== "object") return;
    if (nameSet.has(key.trim())) {
      Object.entries(val).forEach(([section, v]) => {
        if (v === true) approve(key.trim(), section);
      });
    } else {
      const done = val.section === true || (val.front === true && val.back === true);
      if (done) names.forEach((name) => approve(name, key));
    }
  });
  return out;
}

// A requirement with a non-empty `forApplicants` list is scoped to those applicants;
// otherwise it's universal (shown to everyone). Mirrors the client portal's logic.
export function reqVisibleFor(req, name) {
  const list = Array.isArray(req.forApplicants)
    ? req.forApplicants.map((s) => (s ?? "").trim()).filter(Boolean)
    : [];
  if (list.length === 0) return true;
  return list.includes((name ?? "").trim());
}

export function parseRequirements(deal) {
  try {
    const parsed = JSON.parse(deal?.Additional_Template_JSON ?? "{}");
    return parsed.documentRequirements ?? [];
  } catch {
    return [];
  }
}

// Table-level sign-off progress: how many (applicant × visible section) pairs
// the admin has signed off, out of all pairs. Works entirely from list-response
// fields plus the deal record (already fetched for the Deal Name column).
export function computeSignoffProgress(row, requirements) {
  const applicants = parseApplicants(row, []);
  const reqs = requirements ?? [];
  if (!applicants.length || !reqs.length) return null;

  const approvals = normalizeSectionApprovals(row.Section_Approvals, applicants);

  let total = 0;
  let signed = 0;
  applicants.forEach((name) => {
    const visible = reqs.filter((r) => reqVisibleFor(r, name));
    total += visible.length;
    const mine = approvals[name] ?? {};
    visible.forEach((r) => { if (mine[r.name] === true) signed += 1; });
  });

  if (!total) return null;
  return { signed, total };
}
