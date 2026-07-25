import { useState } from "react";
import "./AdminUploadDialog.css";

const PORTAL_URL = process.env.REACT_APP_PORTAL_URL ?? "";

async function uploadAttachment(recordId, file) {
  const formData = new FormData();
  formData.append("submissionLogId", recordId);
  formData.append("file", file, file.name);
  const res = await fetch(`${PORTAL_URL}/api/widget/upload-attachment`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const json = await res.json();
  if (!json.attachmentId) throw new Error(json.error || "Upload failed");
  return json.attachmentId;
}

export function AdminUploadDialog({ open, onClose, reqName, submissionLog, adminUploads, uploadedFor = "", onUploaded }) {
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function reset() {
    setFile(null);
    setComment("");
    setError(null);
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!file) { setError("Please select a file."); return; }
    setLoading(true);
    setError(null);
    try {
      console.log("[AdminUpload] Uploading", { record_id: submissionLog.id, file_name: file.name, uploaded_for: uploadedFor });

      const attachmentId = await uploadAttachment(submissionLog.id, file);

      const existingRows = (adminUploads ?? []).map((u) => ({ id: u.id }));
      const newRow = {
        Document_Name: file.name,
        Document_Type: reqName,
        Attachment_ID: attachmentId,
        Uploaded_For: uploadedFor,
        ...(comment.trim() && { Additional_Comment: comment.trim() }),
      };

      const resp = await window.ZOHO.CRM.API.updateRecord({
        Entity: "Submission_Logs",
        APIData: { id: submissionLog.id, Admin_Uploads: [...existingRows, newRow] },
        Trigger: [],
      });

      if (resp?.data?.[0]?.code !== "SUCCESS") {
        throw new Error("Subform update failed");
      }

      onUploaded(newRow, attachmentId);
      handleClose();
    } catch (err) {
      console.error("[AdminUpload] Error", err);
      setError("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="au-overlay" onClick={handleClose}>
      <div className="au-modal" onClick={(e) => e.stopPropagation()}>
        <div className="au-header">
          <div className="au-header-left">
            <span className="au-title">Upload Document</span>
            <span className="au-req-name">
              {reqName}
              {uploadedFor && <> · for <strong>{uploadedFor}</strong></>}
            </span>
          </div>
          <button className="au-close" onClick={handleClose} disabled={loading}>&#x2715;</button>
        </div>

        <div className="au-body">
          <label className="au-file-zone">
            <input
              type="file"
              className="au-file-input"
              accept="image/*,.pdf"
              onChange={(e) => {
                const selected = e.target.files[0] ?? null;
                if (selected && selected.type !== "application/pdf" && !selected.type.startsWith("image/")) {
                  setError("Only images and PDFs are allowed.");
                  setFile(null);
                } else {
                  setFile(selected);
                  setError(null);
                }
              }}
              disabled={loading}
            />
            {file ? (
              <span className="au-file-selected">{file.name}</span>
            ) : (
              <span className="au-file-placeholder">Click to choose a file</span>
            )}
          </label>

          <textarea
            className="au-textarea"
            placeholder="Additional comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            disabled={loading}
          />

          {error && <p className="au-error">{error}</p>}
        </div>

        <div className="au-footer">
          <button className="au-submit-btn" onClick={handleSubmit} disabled={loading || !file}>
            {loading ? "Uploading…" : "Upload"}
          </button>
          <button className="au-cancel-btn" onClick={handleClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
