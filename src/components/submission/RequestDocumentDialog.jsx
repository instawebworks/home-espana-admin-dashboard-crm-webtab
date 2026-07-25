import { useState } from "react";
import "./RequestDocumentDialog.css";

const MS_AV = ["rd-av1", "rd-av2", "rd-av3", "rd-av4"];

function initials(name) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Broker-initiated "request a document" dialog.
 * Collects a required name, optional multi-line specifications and the sender —
 * the applicant(s) the document is requested from (a multi-select sourced from
 * the submission's Applicants_Listing; auto-selected when there's only one).
 * Calls the `widget_request_document` Deluge function which emails the deal's
 * client.
 */
export function RequestDocumentDialog({ open, onClose, deal, applicants = [], onSent }) {
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [requirement, setRequirement] = useState("Required");
  const [selected, setSelected] = useState([]);
  const [msOpen, setMsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prevOpen, setPrevOpen] = useState(false);

  const recipient = deal?.Email ?? "";

  // On the closed→open transition: auto-select the sole applicant, else start empty.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelected(applicants.length === 1 ? [applicants[0]] : []);
      setMsOpen(false);
    }
  }

  function reset() {
    setName("");
    setSpec("");
    setRequirement("Required");
    setSelected([]);
    setMsOpen(false);
    setError(null);
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  function toggleSender(applicant) {
    setSelected((prev) =>
      prev.includes(applicant) ? prev.filter((n) => n !== applicant) : [...prev, applicant]
    );
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Document name is required.");
      return;
    }
    if (!deal?.id) {
      setError("Deal is not loaded yet.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // New requirement, matching the existing Additional_Template_JSON schema exactly.
      const newReq = {
        uploadCount: 1,
        name: name.trim(),
        checked: true,
        id: Date.now() + Math.random(),
        requirement,
        scanType: "Single",
        additionalInstructions: spec.trim(),
        fileTypes: ["PDF", "PNG", "JPG", "JPEG"],
        // Per-applicant scoping: when set, only these applicants see the row.
        // Omitted entirely for a universal doc (no sender selected).
        ...(selected.length > 0 && { forApplicants: selected }),
      };

      // 1) Append to the deal's template so the doc appears in the client portal
      //    (done in JS so JSON.parse/stringify preserves the existing entries verbatim).
      let template;
      try {
        template = JSON.parse(deal.Additional_Template_JSON ?? "{}");
      } catch {
        template = {};
      }
      if (!template || typeof template !== "object") template = {};
      if (!Array.isArray(template.documentRequirements)) template.documentRequirements = [];
      template.documentRequirements = [...template.documentRequirements, newReq];

      const upd = await window.ZOHO.CRM.API.updateRecord({
        Entity: "Deals",
        APIData: { id: String(deal.id), Additional_Template_JSON: JSON.stringify(template) },
        Trigger: [],
      });
      if (upd?.data?.[0]?.code !== "SUCCESS") {
        throw new Error("Could not add the document to the client portal.");
      }

      // 2) Email the client. Non-fatal — the document is already on the portal.
      let emailOk = true;
      try {
        const fnArgs = {
          deal_id: String(deal.id),
          doc_name: name.trim(),
          specification: spec.trim(),
          sender: selected.join(", "),
        };
        console.log("[RequestDocument] Calling function with args", fnArgs);
        const funcResp = await window.ZOHO.CRM.FUNCTIONS.execute(
          "widget_request_document",
          { arguments: JSON.stringify(fnArgs) }
        );
        console.log("[RequestDocument] Function raw response", JSON.stringify(funcResp));
        if (funcResp?.code && funcResp.code !== "success") emailOk = false;
        const output = funcResp?.details?.output
          ? JSON.parse(funcResp.details.output)
          : null;
        if (output?.status !== "success") emailOk = false;
      } catch (e) {
        console.error("[RequestDocument] Email step failed", e);
        emailOk = false;
      }

      onSent({ requirement: newReq, email: recipient, emailOk });
      reset();
      onClose();
    } catch (err) {
      console.error("[RequestDocument] Error", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const triggerLabel =
    selected.length === 0
      ? (applicants.length ? "Select applicant(s)" : "No applicants on this submission")
      : null;

  return (
    <div className="rd-overlay" onClick={handleClose}>
      <div className="rd-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rd-header">
          <div className="rd-header-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </div>
          <div className="rd-header-text">
            <span className="rd-title">Request a document</span>
            <span className="rd-sub">
              {recipient
                ? <>An email will be sent to <strong>{recipient}</strong></>
                : "No email address on this deal"}
            </span>
          </div>
          <button className="rd-close" onClick={handleClose} disabled={loading} aria-label="Close">
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div className="rd-body">
          <label className="rd-field">
            <span className="rd-label">Document name <span className="rd-req">*</span></span>
            <input
              className="rd-input"
              type="text"
              placeholder="e.g. Last 3 payslips"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              disabled={loading}
              autoFocus
            />
          </label>

          <div className="rd-field">
            <span className="rd-label">Requirement</span>
            <div className="rd-seg">
              {[["Required", "Required"], ["Optional", "If applicable"]].map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  className={`rd-seg-btn${requirement === val ? " active" : ""}`}
                  onClick={() => setRequirement(val)}
                  disabled={loading}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <label className="rd-field">
            <span className="rd-label">Specifications</span>
            <textarea
              className="rd-textarea"
              placeholder="Any details the client should know (format, date range, who it's for…)"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </label>

          {/* Sender — applicant multi-select */}
          <div className="rd-field">
            <span className="rd-label">Sender {applicants.length > 1 && <span className="rd-hint">— select one or more</span>}</span>
            <div className="rd-ms">
              <button
                type="button"
                className={`rd-ms-trigger${msOpen ? " open" : ""}`}
                onClick={() => setMsOpen((o) => !o)}
                disabled={loading || applicants.length === 0}
              >
                <span className="rd-ms-value">
                  {selected.length > 0 ? (
                    selected.map((n) => (
                      <span key={n} className="rd-ms-chip">
                        {n}
                        <span
                          className="rd-ms-chip-x"
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => { e.stopPropagation(); toggleSender(n); }}
                        >
                          &#x2715;
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="rd-ms-ph">{triggerLabel}</span>
                  )}
                </span>
                <svg className="rd-ms-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>

              {msOpen && applicants.length > 0 && (
                <>
                  <div className="rd-ms-backdrop" onClick={() => setMsOpen(false)} />
                  <div className="rd-ms-panel" role="listbox" aria-multiselectable="true">
                    {applicants.map((applicant, i) => {
                      const checked = selected.includes(applicant);
                      return (
                        <button
                          type="button"
                          key={applicant}
                          role="option"
                          aria-selected={checked}
                          className={`rd-ms-opt${checked ? " checked" : ""}`}
                          onClick={() => toggleSender(applicant)}
                        >
                          <span className={`rd-ms-av ${MS_AV[i % MS_AV.length]}`}>{initials(applicant)}</span>
                          <span className="rd-ms-name">{applicant}</span>
                          <span className="rd-ms-box">
                            {checked && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {error && <p className="rd-error">{error}</p>}
        </div>

        {/* Footer */}
        <div className="rd-footer">
          <button className="rd-cancel" onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="rd-submit"
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !recipient}
          >
            {loading ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}
