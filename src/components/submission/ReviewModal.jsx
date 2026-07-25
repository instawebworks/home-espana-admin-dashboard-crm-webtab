import { useState, useEffect } from "react";
import {
  CATEGORIES,
  detectCategory,
  buildDefaultName,
  ensureUniqueName,
} from "./documentCategories";
import "./ReviewModal.css";

const CONNECTION = "zoho_crm_conn_used_in_widget_do_not_delete";
const ZOHO_BASE = "https://crm.zoho.eu";
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);
const OFFICE_EXTS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

function StatusBadge({ status }) {
  return (
    <span className={`rm-status rm-status--${(status ?? "").toLowerCase()}`}>
      {status}
    </span>
  );
}

export function ReviewModal({
  open,
  onClose,
  upload,
  allUploads,
  adminUploads,
  submissionLog,
  attachment,
  workdriveFolderId,
  viewOnly,
  onStatusUpdate,
}) {
  const [docUrl, setDocUrl] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [category, setCategory] = useState(null);
  const [fileName, setFileName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [nameError, setNameError] = useState(false);

  const ext = upload?.Document_Name?.split(".")?.pop()?.toLowerCase() ?? "";
  const isImage = IMAGE_EXTS.has(ext);
  const isPdf = ext === "pdf";
  const currentStatus = upload?.Approval_Status;
  const isDecided =
    viewOnly || currentStatus === "Approved" || currentStatus === "Rejected";

  const previewUrl = attachment?.$previewUrl
    ? `${ZOHO_BASE}${attachment.$previewUrl}`
    : null;

  useEffect(() => {
    if (open) {
      setComment(upload?.Admin_Comment ?? "");
      setCommentError(false);
      setDocUrl(null);
      const detected = detectCategory(upload?.Document_Type);
      setCategory(detected);
      setFileName(buildDefaultName(detected, upload));
      setNameTouched(false);
      setNameError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-syncs the pre-filled name until the reviewer edits it by hand.
  function handleCategoryChange(e) {
    const code = e.target.value ? Number(e.target.value) : null;
    setCategory(code);
    if (!nameTouched) setFileName(buildDefaultName(code, upload));
  }

  useEffect(() => {
    if (!open || !upload?.Attachment_ID || !submissionLog?.id) return;

    if (isImage) {
      if (attachment?.thumbnailUrl) setDocUrl(attachment.thumbnailUrl);
      return;
    }

    if (!isPdf) return;

    setDocLoading(true);
    (async () => {
      try {
        const resp = await window.ZOHO.CRM.CONNECTION.invoke(CONNECTION, {
          url: `https://www.zohoapis.eu/crm/v8/Submission_Logs/${submissionLog.id}/Attachments/${upload.Attachment_ID}`,
          method: "GET",
          param_type: 1,
        });
        const content = resp?.details?.statusMessage;
        if (!content || typeof content !== "string") return;
        let binaryStr = "";
        for (let i = 0; i < content.length; i++) {
          binaryStr += String.fromCharCode(content.charCodeAt(i) & 0xff);
        }
        setDocUrl(`data:application/pdf;base64,${btoa(binaryStr)}`);
      } catch (err) {
        console.error("[DocPreview] PDF fetch failed", err);
      } finally {
        setDocLoading(false);
      }
    })();

    return () => setDocUrl(null);
  }, [open, upload, submissionLog, attachment, isImage, isPdf]);

  const handleAction = async (status) => {
    if (status === "Rejected" && !comment.trim()) {
      setCommentError(true);
      return;
    }
    if (status === "Approved" && !fileName.trim()) {
      setNameError(true);
      return;
    }
    setActionLoading(true);
    try {
      let newDocName = null;
      let newAttachmentId = null;

      if (status === "Approved" && upload.Attachment_ID) {
        const takenNames = [
          ...(allUploads ?? []).filter((u) => u.id !== upload.id),
          ...(adminUploads ?? []),
        ].map((u) => u.Document_Name);
        newDocName = ensureUniqueName(fileName.trim(), ext, takenNames);

        const fnArgs = {
          record_id: String(submissionLog.id),
          attachment_id: String(upload.Attachment_ID),
          new_name: newDocName,
          workdrive_folder_id: workdriveFolderId || "",
        };
        console.log("[ApproveOps] Calling function with args", fnArgs);

        const funcResp = await window.ZOHO.CRM.FUNCTIONS.execute(
          "widget_rename_and_upload_attachment",
          { arguments: JSON.stringify(fnArgs) }
        );
        console.log("[ApproveOps] Function raw response", JSON.stringify(funcResp));

        if (funcResp?.code && funcResp.code !== "success") {
          console.error("[ApproveOps] Function failed", funcResp);
          throw new Error(`Function error: ${funcResp.code} - ${funcResp.message ?? ""}`);
        }

        const output = funcResp?.details?.output
          ? JSON.parse(funcResp.details.output)
          : null;
        console.log("[ApproveOps] Parsed output", output);
        newAttachmentId = output?.new_attachment_id ?? null;
      }

      const allRows = (allUploads ?? []).map((u) => {
        if (u.id !== upload.id) return { id: u.id };
        const row = { id: u.id, Approval_Status: status };
        if (newDocName) row.Document_Name = newDocName;
        if (newAttachmentId) row.Attachment_ID = String(newAttachmentId);
        if (comment.trim()) row.Admin_Comment = comment.trim();
        return row;
      });

      const apiData = { id: submissionLog.id, Document_Uploads: allRows };

      if (status === "Rejected") {
        const madrid = new Date().toLocaleString("en-CA", {
          timeZone: "Europe/Madrid",
          hour12: false,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const [datePart, timePart] = madrid.replace(/, /g, "T").split("T");
        const offset =
          new Date()
            .toLocaleString("en-US", {
              timeZone: "Europe/Madrid",
              timeZoneName: "longOffset",
            })
            .split("GMT")[1] || "+01:00";
        const dateTime = `${datePart}T${timePart}${offset}`;
        apiData.Rejection_Name_Datetime = `${upload.Document_Name} -##- ${dateTime}`;
      }

      const resp = await window.ZOHO.CRM.API.updateRecord({
        Entity: "Submission_Logs",
        APIData: apiData,
        Trigger: ["workflow"],
      });

      if (resp?.data?.[0]?.code === "SUCCESS") {
        onStatusUpdate(upload.id, status, comment.trim(), newDocName, newAttachmentId);
        onClose();
      }
    } catch (err) {
      console.error("Failed to update approval status", err);
    } finally {
      setActionLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="rm-overlay" onClick={() => !actionLoading && onClose()}>
      <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rm-header">
          <div className="rm-header-left">
            <span className="rm-title">Review Document</span>
            {isDecided && <StatusBadge status={currentStatus} />}
          </div>
          <button className="rm-close" onClick={onClose} disabled={actionLoading}>
            &#x2715;
          </button>
        </div>

        {/* File name bar */}
        <div className="rm-filename-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1b3a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="rm-filename">{upload?.Document_Name ?? "—"}</span>
          {previewUrl && !OFFICE_EXTS.has(ext) && (
            <button
              className="rm-open-btn"
              onClick={() => window.open(previewUrl, "_blank")}
            >
              Open Full Preview ↗
            </button>
          )}
        </div>

        {/* Preview area */}
        <div className="rm-preview-box">
          {docLoading ? (
            <p className="rm-preview-msg">Loading preview...</p>
          ) : docUrl ? (
            isImage ? (
              <img src={docUrl} alt={upload?.Document_Name} className="rm-preview-img" />
            ) : isPdf ? (
              <object data={docUrl} type="application/pdf" width="100%" height="300">
                PDF could not be displayed.
              </object>
            ) : null
          ) : OFFICE_EXTS.has(ext) ? (
            <div className="rm-preview-placeholder">
              <FileIcon />
              <p>Word/Excel documents can only be previewed in the CRM record.</p>
            </div>
          ) : (
            <div className="rm-preview-placeholder">
              <FileIcon />
              <p>Preview not available.</p>
            </div>
          )}
        </div>

        {/* Comment + actions */}
        {!isDecided && (
          <>
            <div className="rm-name-section">
              <label className="rm-comment-label">File name on approval</label>
              <div className="rm-name-row">
                <select
                  className="rm-cat-select"
                  value={category ?? ""}
                  onChange={handleCategoryChange}
                  disabled={actionLoading}
                >
                  <option value="">Category…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>
                <div className={`rm-name-wrap${nameError ? " rm-name-wrap--error" : ""}`}>
                  <input
                    className="rm-name-input"
                    type="text"
                    value={fileName}
                    placeholder="File name"
                    onChange={(e) => {
                      setFileName(e.target.value);
                      setNameTouched(true);
                      setNameError(false);
                    }}
                    disabled={actionLoading}
                  />
                  {ext && <span className="rm-name-ext">.{ext}</span>}
                </div>
              </div>
              {category != null && (
                <p className="rm-name-hint">
                  Format: {CATEGORIES.find((c) => c.code === category)?.hint} — add any missing
                  detail before approving.
                </p>
              )}
              {category == null && (
                <p className="rm-name-hint">Pick a category to add the code prefix.</p>
              )}
              {nameError && <p className="rm-error">A file name is required to approve.</p>}
            </div>

            <div className="rm-comment-section">
              <label className="rm-comment-label">Comment to Client</label>
              <textarea
                className={`rm-textarea${commentError ? " rm-textarea--error" : ""}`}
                placeholder="Add correction note for resubmission, if rejecting..."
                value={comment}
                onChange={(e) => { setComment(e.target.value); setCommentError(false); }}
                rows={2}
                disabled={actionLoading}
              />
              {commentError && (
                <p className="rm-error">A comment is required when rejecting a document.</p>
              )}
            </div>

            <div className="rm-actions">
              <button
                className="rm-approve-btn"
                onClick={() => handleAction("Approved")}
                disabled={actionLoading}
              >
                {actionLoading ? "Please wait…" : "Approve"}
              </button>
              <button
                className="rm-reject-btn"
                onClick={() => handleAction("Rejected")}
                disabled={actionLoading}
              >
                {actionLoading ? "Please wait…" : "Reject"}
              </button>
            </div>
            <p className="rm-hint">
              Reject with a clear comment so the client can rectify and re-submit.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
