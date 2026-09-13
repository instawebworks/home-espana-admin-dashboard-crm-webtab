import { useState, useRef } from "react";
import { ReviewModal } from "./ReviewModal";
import { AdminUploadDialog } from "./AdminUploadDialog";
import { RequestDocumentDialog } from "./RequestDocumentDialog";
import {
  parseApplicants,
  normalizeSectionApprovals,
  reqVisibleFor,
  parseRequirements,
  belongsToApplicant,
  isUnassigned,
} from "./submissionHelpers";
import "./UserUploads.css";

const ZOHO_BASE = "https://crm.zoho.eu";
const AVATAR_CLASSES = ["uu-av1", "uu-av2", "uu-av3", "uu-av4"];

/* ─────────────────────────  data helpers  ───────────────────────── */

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}

function initials(name) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/* ─────────────────────────  status derivation  ───────────────────────── */

function fileStatus(u) {
  if (u.Approval_Status === "Approved") return "approved";
  if (u.Approval_Status === "Rejected") return "rejected";
  return "pending";
}

// Aggregate one applicant's uploads for a requirement into a single status.
function aggregateStatus(applicantUploads) {
  if (!applicantUploads.length) return "awaiting";
  const st = applicantUploads.map(fileStatus);
  if (st.every((s) => s === "approved")) return "approved";
  if (st.every((s) => s === "rejected")) return "rejected";
  return "pending"; // anything still open, or a mix, needs the admin's eyes
}

function combineSides(a, b) {
  const sides = [a, b];
  if (sides.every((s) => s === "approved")) return "approved";
  if (sides.every((s) => s === "awaiting")) return "awaiting";
  if (sides.includes("pending")) return "pending";
  if (sides.includes("rejected")) return "rejected";
  return "pending"; // partially done (one side in, one not)
}

// "ready" = every uploaded file is approved but the admin hasn't signed off the
// section for this applicant yet (the checkbox). Only that sign-off turns a
// section "approved".
const STATUS_META = {
  approved: { label: "Approved" },
  ready: { label: "Awaiting sign-off" },
  pending: { label: "Needs review" },
  rejected: { label: "Rejected" },
  awaiting: { label: "Awaiting upload" },
};

/* ─────────────────────────  icons  ───────────────────────── */

const ic = {
  doc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  ext: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>
  ),
  caret: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
  ),
};

const STATUS_ICON = { approved: ic.check, ready: ic.check, pending: ic.clock, rejected: ic.x, awaiting: ic.doc };

function StatusPill({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.awaiting;
  return (
    <span className={`uu-pill uu-pill--${status}`}>
      <span className="uu-pill-ic">{STATUS_ICON[status]}</span>
      {meta.label}
    </span>
  );
}

/* ─────────────────────────  presentational pieces  ───────────────────────── */

function FileRow({ upload, baseViewOnly, attachMap, submissionLog, workdriveFolderId, allUploads, onReview }) {
  const st = fileStatus(upload);
  return (
    <div className="uu-file">
      <span className="uu-file-name">{upload.Document_Name}</span>
      {isUnassigned(upload.Submitted_For) && (
        <span className="uu-unassigned" title="No applicant recorded on this upload — shown under every applicant">
          Unassigned
        </span>
      )}
      <span className="uu-file-date">{formatDate(upload.Created_Time)}</span>
      <StatusPill status={st} />
      <button
        className="uu-btn uu-btn-ghost"
        onClick={() =>
          onReview({
            upload,
            allUploads,
            attachment: attachMap[upload.Attachment_ID] ?? null,
            submissionLog,
            workdriveFolderId,
            viewOnly: baseViewOnly || st === "approved" || st === "rejected",
          })
        }
      >
        {st === "pending" ? "Review" : "View"}
      </button>
    </div>
  );
}

function AdminStrip({ items, attachMap }) {
  if (!items.length) return null;
  return (
    <div className="uu-admin">
      <div className="uu-admin-lbl">
        Admin documents <span className="uu-admin-cnt">{items.length}</span>
      </div>
      {items.map((item, idx) => {
        const attach = attachMap[item.Attachment_ID];
        const previewUrl = attach?.$previewUrl ? `${ZOHO_BASE}${attach.$previewUrl}` : null;
        return (
          <div key={idx} className="uu-admin-item">
            <span className="uu-admin-doc-ic">{ic.doc}</span>
            <div className="uu-admin-info">
              <span className="uu-admin-name">
                {item.Document_Name}
                {isUnassigned(item.Uploaded_For) && (
                  <span className="uu-unassigned" title="No applicant recorded on this upload — shown under every applicant">
                    Unassigned
                  </span>
                )}
              </span>
              {item.Additional_Comment && (
                <span className="uu-admin-comment">{item.Additional_Comment}</span>
              )}
            </div>
            {previewUrl && (
              <button className="uu-link-view" onClick={() => window.open(previewUrl, "_blank")}>
                View {ic.ext}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FinalizeRow({ label, checked, loading, onChange }) {
  return (
    <label className="uu-finalize">
      <input type="checkbox" checked={checked} onChange={onChange} disabled={loading} className="uu-finalize-cb" />
      <span className="uu-finalize-lbl">{loading ? "Saving…" : label}</span>
    </label>
  );
}

/* ─────────────────────────  main  ───────────────────────── */

export function UserUploads({ deal, submissionLog, attachMap, onRecordUpdate }) {
  const [uploads, setUploads] = useState(submissionLog?.Document_Uploads ?? []);
  const [adminUploads, setAdminUploads] = useState(submissionLog?.Admin_Uploads ?? []);
  const [localAttachMap, setLocalAttachMap] = useState({});
  const mergedAttachMap = { ...attachMap, ...localAttachMap };
  const [reviewDialog, setReviewDialog] = useState(null);
  const reviewSnapshot = useRef(null);
  if (reviewDialog) reviewSnapshot.current = reviewDialog;

  const [sectionApprovalsCache, setSectionApprovalsCache] = useState(() => {
    const initialApplicants = parseApplicants(submissionLog, submissionLog?.Document_Uploads ?? []);
    const initial = normalizeSectionApprovals(submissionLog?.Section_Approvals, initialApplicants);
    return submissionLog?.id ? { [submissionLog.id]: initial } : {};
  });
  const [sectionApprovalLoading, setSectionApprovalLoading] = useState({});
  const [uploadDialogReq, setUploadDialogReq] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [extraRequirements, setExtraRequirements] = useState([]);
  const [toast, setToast] = useState(null);
  const [activeApplicant, setActiveApplicant] = useState(0);
  const [filter, setFilter] = useState("all");
  const [awaitingOpen, setAwaitingOpen] = useState(false);

  const requirements = [...parseRequirements(deal), ...extraRequirements];
  const applicants = parseApplicants(submissionLog, uploads);
  const activeApplicantName = applicants[activeApplicant] ?? applicants[0] ?? "";
  const workdriveFolderId = deal?.easyworkdriveforcrm__Workdrive_Folder_ID_EXT ?? null;
  const rowId = submissionLog?.id;
  const sectionApprovals = sectionApprovalsCache[rowId] ?? {};

  // Build the per-applicant view of a single requirement.
  function buildReqView(req, applicantName) {
    const isFrontBack = req.scanType === "Front & Back";
    const mine = uploads.filter(
      (u) => u.Document_Type === req.name && belongsToApplicant(u.Submitted_For, applicantName)
    );
    const approvedByAdmin = sectionApprovals[applicantName]?.[req.name] === true;
    const hasApprovedFile = mine.some((u) => u.Approval_Status === "Approved");

    let sides = null;
    let derived;

    if (isFrontBack) {
      const buildSide = (side) => {
        const files = mine.filter((u) => u.Scan_Type === side);
        return { side, files, status: aggregateStatus(files) };
      };
      const front = buildSide("Front");
      const back = buildSide("Back");
      derived = combineSides(front.status, back.status);
      sides = { front, back };
    } else {
      derived = aggregateStatus(mine);
    }

    // File approvals alone never approve the section — that takes the admin's
    // per-applicant checkbox. Fully-approved files without sign-off = "ready".
    const status = approvedByAdmin ? "approved" : derived === "approved" ? "ready" : derived;

    const adminItems = adminUploads.filter(
      (u) => u.Document_Type === req.name && belongsToApplicant(u.Uploaded_For, applicantName)
    );

    // Checkbox appears once at least one of this applicant's files is approved
    // (and stays visible when checked, so the sign-off can be revoked).
    return { req, isFrontBack, status, sides, mine, approvedByAdmin, canToggle: hasApprovedFile, adminItems };
  }

  const views = requirements
    .filter((req) => reqVisibleFor(req, activeApplicantName))
    .map((req) => buildReqView(req, activeApplicantName));

  // Progress summary for the active applicant.
  const counts = { approved: 0, ready: 0, pending: 0, rejected: 0, awaiting: 0 };
  views.forEach((v) => { counts[v.status] += 1; });
  const total = views.length;

  // Per-applicant mini-labels for the tabs.
  function summaryFor(name) {
    const reqs = requirements.filter((req) => reqVisibleFor(req, name));
    const c = { approved: 0, ready: 0, pending: 0, total: reqs.length };
    reqs.forEach((req) => {
      const s = buildReqView(req, name).status;
      if (s === "approved") c.approved += 1;
      else if (s === "ready") c.ready += 1;
      else if (s === "pending") c.pending += 1;
    });
    return c;
  }

  const submittedViews = views.filter((v) => v.status !== "awaiting");
  const awaitingViews = views.filter((v) => v.status === "awaiting");
  const awaitingRequired = awaitingViews.filter((v) => v.req.requirement === "Required").length;

  const filteredViews = submittedViews.filter((v) => {
    if (filter === "all") return true;
    if (filter === "review") return v.status === "pending";
    if (filter === "ready") return v.status === "ready";
    if (filter === "approved") return v.status === "approved";
    return false; // "await" handled by the group below
  });
  const showAwaiting = (filter === "all" || filter === "await") && awaitingViews.length > 0;

  // Toggle the per-applicant section sign-off; always writes the full map in
  // the new schema, which also migrates any legacy-format field value.
  async function handleSectionToggle(reqName, value) {
    const applicant = activeApplicantName;
    const loadingKey = `${rowId}__${applicant}__${reqName}`;
    setSectionApprovalLoading((prev) => ({ ...prev, [loadingKey]: true }));
    try {
      const current = sectionApprovalsCache[rowId] ?? {};
      const forApplicant = { ...(current[applicant] ?? {}) };
      if (value) forApplicant[reqName] = true;
      else delete forApplicant[reqName];
      const updated = { ...current, [applicant]: forApplicant };
      if (!Object.keys(forApplicant).length) delete updated[applicant];
      const resp = await window.ZOHO.CRM.API.updateRecord({
        Entity: "Submission_Logs",
        APIData: { id: rowId, Section_Approvals: JSON.stringify(updated) },
        Trigger: [],
      });
      if (resp?.data?.[0]?.code === "SUCCESS") {
        setSectionApprovalsCache((prev) => ({ ...prev, [rowId]: updated }));
        // Keep the summary table's sign-off column in step with this change.
        onRecordUpdate?.(rowId, { Section_Approvals: JSON.stringify(updated) });
      }
    } catch (err) {
      console.error("Failed to update section approval", err);
    } finally {
      setSectionApprovalLoading((prev) => {
        const next = { ...prev };
        delete next[loadingKey];
        return next;
      });
    }
  }

  function handleRequestSent({ requirement, email, emailOk }) {
    if (requirement) setExtraRequirements((prev) => [...prev, requirement]);
    const text = emailOk
      ? (email ? `Document requested — emailed to ${email}` : "Document requested")
      : "Document added to the portal — but the email could not be sent";
    setToast({ text, ok: emailOk });
    window.setTimeout(() => setToast(null), 5000);
  }

  async function handleAdminUploaded(newRow, attachmentId) {
    setAdminUploads((prev) => [...prev, { ...newRow, id: `temp_${attachmentId}` }]);
    if (submissionLog?.id) {
      try {
        const resp = await window.ZOHO.CRM.API.getRelatedRecords({
          Entity: "Submission_Logs",
          RecordID: submissionLog.id,
          RelatedList: "Attachments",
          page: 1,
          per_page: 200,
        });
        const newAttach = (resp?.data ?? []).find((a) => String(a.id) === attachmentId);
        if (newAttach) {
          setLocalAttachMap((prev) => ({ ...prev, [attachmentId]: newAttach }));
        }
      } catch (e) {
        console.error("[AdminUpload] Failed to fetch attachment metadata", e);
      }
    }
  }

  async function handleStatusUpdate(uploadId, status, comment, newDocName, newAttachmentId) {
    setUploads((prev) =>
      prev.map((u) => {
        if (u.id !== uploadId) return u;
        return {
          ...u,
          Approval_Status: status,
          ...(comment && { Admin_Comment: comment }),
          ...(newDocName && { Document_Name: newDocName }),
          ...(newAttachmentId && { Attachment_ID: String(newAttachmentId) }),
        };
      })
    );

    if (newAttachmentId && submissionLog?.id) {
      try {
        const resp = await window.ZOHO.CRM.API.getRelatedRecords({
          Entity: "Submission_Logs",
          RecordID: submissionLog.id,
          RelatedList: "Attachments",
          page: 1,
          per_page: 200,
        });
        const newAttach = (resp?.data ?? []).find(
          (a) => String(a.id) === String(newAttachmentId)
        );
        if (newAttach) {
          setLocalAttachMap((prev) => ({ ...prev, [String(newAttachmentId)]: newAttach }));
        }
      } catch (e) {
        console.error("[UserUploads] Failed to fetch new attachment metadata", e);
      }
    }
  }

  const fileRowProps = {
    attachMap: mergedAttachMap,
    submissionLog,
    workdriveFolderId,
    allUploads: uploads,
    onReview: setReviewDialog,
  };

  function renderCard(v) {
    const { req, isFrontBack, status, sides, mine, approvedByAdmin, canToggle, adminItems } = v;
    const toggleRow = (approvedByAdmin || canToggle) && (
      <FinalizeRow
        label={
          approvedByAdmin
            ? `Section approved for ${activeApplicantName}`
            : `Approve this section for ${activeApplicantName}`
        }
        checked={approvedByAdmin}
        loading={!!sectionApprovalLoading[`${rowId}__${activeApplicantName}__${req.name}`]}
        onChange={() => handleSectionToggle(req.name, !approvedByAdmin)}
      />
    );

    return (
      <article key={req.id} className={`uu-card uu-card--${status}`} data-status={status}>
        <span className={`uu-card-ic uu-card-ic--${status}`}>{STATUS_ICON[status]}</span>
        <div className="uu-card-main">
          <div className="uu-card-head">
            <span className="uu-card-name">{req.name}</span>
            <span className={`uu-tag ${req.requirement === "Required" ? "uu-tag--req" : "uu-tag--opt"}`}>
              {req.requirement === "Optional" ? "If applicable" : req.requirement}
            </span>
            {isFrontBack && <span className="uu-tag uu-tag--side">Front &amp; Back</span>}
            <span className="uu-card-head-right">
              <StatusPill status={status} />
              <button className="uu-btn uu-btn-soft" onClick={() => setUploadDialogReq(req.name)}>
                {ic.plus} Upload
              </button>
            </span>
          </div>

          {toggleRow}

          {/* Section signed off although this applicant has no file (legacy migration) */}
          {approvedByAdmin && mine.length === 0 && (
            <div className="uu-card-note">{ic.check} Approved for {activeApplicantName} — no separate file was needed</div>
          )}

          {isFrontBack ? (
            <div className="uu-sides">
              {["front", "back"].map((key) => {
                const side = sides[key];
                return (
                  <div key={key} className="uu-side">
                    <div className="uu-side-head">
                      <span className="uu-side-lbl">{side.side.toUpperCase()}</span>
                      <StatusPill status={side.status} />
                    </div>
                    {side.files.length > 0 ? (
                      side.files.map((u) => (
                        <FileRow key={u.id} upload={u} baseViewOnly={approvedByAdmin} {...fileRowProps} />
                      ))
                    ) : (
                      <p className="uu-empty">No {side.side.toLowerCase()} upload yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            mine.length > 0 && (
              <div className="uu-files">
                {mine.map((u) => (
                  <FileRow key={u.id} upload={u} baseViewOnly={approvedByAdmin} {...fileRowProps} />
                ))}
              </div>
            )
          )}

          <AdminStrip items={adminItems} attachMap={mergedAttachMap} />
        </div>
      </article>
    );
  }

  return (
    <div className="uu-root">
      {/* Top bar — request-document action (top right) */}
      <div className="uu-topbar">
        <button className="uu-request-btn" onClick={() => setRequestOpen(true)}>
          {ic.send} Request document
        </button>
      </div>

      {/* Applicant selector */}
      {applicants.length > 0 && (
        <div className="uu-applicants">
          {applicants.map((name, i) => {
            const s = summaryFor(name);
            const mini = `${s.approved}/${s.total} approved${s.ready ? ` · ${s.ready} to sign off` : ""}${s.pending ? ` · ${s.pending} to review` : ""}`;
            return (
              <button
                key={name}
                className={`uu-appl${activeApplicant === i ? " active" : ""}`}
                onClick={() => { setActiveApplicant(i); setFilter("all"); }}
              >
                <span className={`uu-avatar ${AVATAR_CLASSES[i % AVATAR_CLASSES.length]}`}>{initials(name)}</span>
                <span className="uu-appl-who">
                  <b>{name}</b>
                  <span className="uu-appl-mini">{mini}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Progress + filters */}
      {total > 0 && (
        <div className="uu-summary">
          <div className="uu-meter">
            <div className="uu-bar">
              {counts.approved > 0 && <span className="uu-seg uu-seg--g" style={{ width: `${(counts.approved / total) * 100}%` }} />}
              {counts.ready > 0 && <span className="uu-seg uu-seg--r" style={{ width: `${(counts.ready / total) * 100}%` }} />}
              {counts.pending > 0 && <span className="uu-seg uu-seg--w" style={{ width: `${(counts.pending / total) * 100}%` }} />}
              {counts.rejected > 0 && <span className="uu-seg uu-seg--b" style={{ width: `${(counts.rejected / total) * 100}%` }} />}
            </div>
            <div className="uu-meter-cap"><b>{counts.approved}/{total}</b> documents approved</div>
          </div>
          <div className="uu-filters">
            {[
              ["all", "All", total],
              ["review", "Needs review", counts.pending],
              ["ready", "To sign off", counts.ready],
              ["approved", "Approved", counts.approved],
              ["await", "Awaiting", counts.awaiting],
            ].map(([key, label, n]) => (
              <button
                key={key}
                className={`uu-chip${filter === key ? " active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {label} <span className="uu-chip-n">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="uu-list">
        {filteredViews.map(renderCard)}

        {filter === "await" && filteredViews.length === 0 && awaitingViews.length === 0 && (
          <p className="uu-empty uu-empty--center">Nothing awaiting — everything's been submitted.</p>
        )}
        {filter !== "await" && filteredViews.length === 0 && !showAwaiting && (
          <p className="uu-empty uu-empty--center">No documents in this view.</p>
        )}

        {showAwaiting && (
          <div className={`uu-await-group${awaitingOpen || filter === "await" ? " open" : ""}`}>
            <button
              className="uu-await-head"
              aria-expanded={awaitingOpen || filter === "await"}
              onClick={() => setAwaitingOpen((o) => !o)}
            >
              <span className="uu-await-ic">{ic.plus}</span>
              <span className="uu-await-text">
                <span className="uu-await-title">Not yet submitted</span>
                <span className="uu-await-desc">
                  {awaitingViews.length} document{awaitingViews.length !== 1 ? "s" : ""}
                  {awaitingRequired > 0
                    ? <> · <span className="uu-await-required">{awaitingRequired} required</span></>
                    : " · nothing blocking"}
                </span>
              </span>
              <span className="uu-await-caret">{ic.caret}</span>
            </button>
            <div className="uu-await-body">
              {awaitingViews.map((v) => (
                <div key={v.req.id} className="uu-await-row">
                  <span className="uu-await-name">{v.req.name}</span>
                  <span className={`uu-tag ${v.req.requirement === "Required" ? "uu-tag--req" : "uu-tag--opt"}`}>
                    {v.req.requirement === "Optional" ? "If applicable" : v.req.requirement}
                  </span>
                  <button className="uu-btn uu-btn-soft" onClick={() => setUploadDialogReq(v.req.name)}>
                    {ic.plus} Upload
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {reviewSnapshot.current && (
        <ReviewModal
          open={!!reviewDialog}
          onClose={() => setReviewDialog(null)}
          upload={reviewSnapshot.current.upload}
          allUploads={uploads}
          adminUploads={adminUploads}
          submissionLog={reviewSnapshot.current.submissionLog}
          attachment={reviewSnapshot.current.attachment}
          workdriveFolderId={reviewSnapshot.current.workdriveFolderId}
          viewOnly={reviewSnapshot.current.viewOnly}
          onStatusUpdate={handleStatusUpdate}
          deal={deal}
        />
      )}

      <AdminUploadDialog
        open={!!uploadDialogReq}
        onClose={() => setUploadDialogReq(null)}
        reqName={uploadDialogReq ?? ""}
        submissionLog={submissionLog}
        adminUploads={adminUploads}
        uploadedFor={activeApplicantName}
        onUploaded={handleAdminUploaded}
      />

      <RequestDocumentDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        deal={deal}
        applicants={applicants}
        onSent={handleRequestSent}
      />

      {toast && (
        <div className={`uu-toast${toast.ok ? "" : " uu-toast--warn"}`} role="status">
          <span className="uu-toast-ic">{toast.ok ? ic.check : ic.clock}</span>
          <span className="uu-toast-msg">{toast.text}</span>
        </div>
      )}
    </div>
  );
}
