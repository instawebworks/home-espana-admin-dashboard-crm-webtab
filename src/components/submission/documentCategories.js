// Client's document coding system (see docs "Document uploads scheme").
// Approved files are named "{code} - {initials} {detail}"; the reviewer can
// edit the generated name freely before approving.

export const CATEGORIES = [
  { code: 1, label: "Application form", hint: "1 - Application form" },
  { code: 2, label: "ID documents", hint: "2 - JS Passport" },
  { code: 3, label: "Income documents", hint: "3 - JS Taxes 2023 (add the year)" },
  { code: 4, label: "Debts / outgoings", hint: "4 - JS Car loan" },
  { code: 5, label: "Credit reports", hint: "5 - JS credit/Equifax UK" },
  { code: 6, label: "Bank / savings", hint: "6 - JS ING….56789 salary and mortgage (bank, last 5 digits, use)" },
  { code: 7, label: "Company information", hint: "7 - Company SL - taxes - 2022" },
];

// Keyword rules mapping a requirement's Document_Type to a category code.
// Checked in order; first match wins ("credit report" must beat the generic
// debt/bank words, so 5 is tested before 4 and 6). Unmatched → null and the
// reviewer picks the category in the dropdown.
const DETECTION_RULES = [
  { code: 1, pattern: /application\s*form|solicitud/i },
  { code: 2, pattern: /passport|pasaporte|\bdni\b|\bnie\b|\btie\b|\bid\b|identity|residenc/i },
  { code: 5, pattern: /credit\s*report|equifax|experian|transunion|asnef|\bcredit\b/i },
  { code: 3, pattern: /payslip|n[oó]mina|tax|irpf|renta|income|pension|salary|p60|employment|contrato|contract/i },
  { code: 4, pattern: /loan|mortgage|hipoteca|debt|deuda|outgoing|pr[eé]stamo/i },
  { code: 6, pattern: /bank|banco|statement|extracto|account|cuenta|saving|ahorro|investment|inversi/i },
  { code: 7, pattern: /company|empresa|sociedad|\bsl\b|\bsa\b|corporate|deed|escritura|accounts/i },
];

export function detectCategory(documentType) {
  const name = (documentType ?? "").trim();
  if (!name) return null;
  const rule = DETECTION_RULES.find((r) => r.pattern.test(name));
  return rule ? rule.code : null;
}

// John Andrew Smith → JS (first + last word; single word → its initial).
export function initialsOf(fullName) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Pre-filled name (without extension) for the reviewer to adjust.
export function buildDefaultName(code, upload) {
  if (code === 1) return "1 - Application form";
  const initials = initialsOf(upload?.Submitted_For);
  const type = (upload?.Document_Type ?? "").trim() || "Document";
  const side =
    upload?.Scan_Type === "Front" || upload?.Scan_Type === "Back"
      ? ` ${upload.Scan_Type.toLowerCase()}`
      : "";
  const prefix = code ? `${code} - ` : "";
  return `${prefix}${initials ? `${initials} ` : ""}${type}${side}`;
}

// The scheme has no sequence number, so identical details would collide;
// per the client, suffix " (2)", " (3)"… only when a name is already taken.
export function ensureUniqueName(baseName, ext, takenNames) {
  const suffix = ext ? `.${ext}` : "";
  const taken = new Set([...takenNames].map((n) => (n ?? "").toLowerCase()));
  let candidate = `${baseName}${suffix}`;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
    candidate = `${baseName} (${n})${suffix}`;
  }
  return candidate;
}
