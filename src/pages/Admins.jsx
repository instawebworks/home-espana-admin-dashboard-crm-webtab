import {
  Box,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Collapse,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  IconButton,
  Tabs,
  Tab,
} from "@mui/material";
import { useState, useEffect } from "react";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";

const ZOHO = window.ZOHO;
const ZOHO_BASE = "https://crm.zoho.eu";

const COLUMNS = [
  { label: "Client Name", key: "Client_Name" },
  { label: "Client Email", key: "Client_Email" },
  { label: "Related Module", key: "Related_Module_Name" },
  { label: "Submission Date", key: "Submission_Date" },
  { label: "Doc Uploads", key: "_doc_uploads" },
  { label: "Modified Time", key: "Modified_Time" },
];

const UPLOAD_COLUMNS = [
  { label: "Document Name", key: "Document_Name" },
  { label: "Document Type", key: "Document_Type" },
  { label: "Approval Status", key: "Approval_Status" },
  { label: "Actions", key: "_actions" },
];

const STATUS_STYLES = {
  Pending: { bg: "#fff8e1", color: "#b45309", border: "#fde68a" },
  Approved: { bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7" },
  Rejected: { bg: "#fff1f2", color: "#9f1239", border: "#fecdd3" },
  Missing: { bg: "#fff1f2", color: "#9f1239", border: "#fecdd3" },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? {
    bg: "#f3f4f6",
    color: "#374151",
    border: "#d1d5db",
  };
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 1.5,
        py: 0.25,
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 700,
        bgcolor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {status ?? "—"}
    </Box>
  );
}

function formatCell(key, row) {
  if (key === "Modified_Time" && row.Modified_Time)
    return new Date(row.Modified_Time).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/Madrid",
    });
  if (key === "Submission_Date" && row.Submission_Date)
    return new Date(row.Submission_Date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Madrid",
    });
  if (key === "_doc_uploads") return row.$subforms_count?.Document_Uploads ?? 0;
  return row[key] ?? "—";
}

function formatNoteTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const toDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((toDay(now) - toDay(date)) / 86400000);
  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Europe/Madrid",
  });
  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Yesterday at ${timeStr}`;
  return (
    date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/Madrid",
    }) + ` at ${timeStr}`
  );
}

// ─── Review Document Dialog ────────────────────────────────────────────────

const CONNECTION = "zoho_crm_conn_used_in_widget_do_not_delete";
const WORKDRIVE_CONNECTION = "workdrive_connection_do_not_delete";
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);
const OFFICE_EXTS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

function ReviewDocumentDialog({
  open,
  onClose,
  upload,
  parentRow,
  allUploads,
  attachment,
  onStatusUpdate,
  workdriveFolderId,
}) {
  const [docUrl, setDocUrl] = useState(null);
  const [docLoading, setDocLoading] = useState(false);

  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const ext = upload?.Document_Name?.split(".").pop()?.toLowerCase() ?? "";
  const isImage = IMAGE_EXTS.has(ext);
  const isPdf = ext === "pdf";
  const currentStatus = upload?.Approval_Status;
  const isDecided =
    currentStatus === "Approved" || currentStatus === "Rejected";

  useEffect(() => {
    if (open) {
      setComment("");
      setCommentError(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !upload?.Attachment_ID || !parentRow?.id) return;
    setDocUrl(null);

    // Images: thumbnailUrl is already in the attachment data — no fetch needed
    if (isImage) {
      if (attachment?.thumbnailUrl) setDocUrl(attachment.thumbnailUrl);
      return;
    }

    // PDFs: fetch binary via CONNECTION and convert to data URL =>
    if (!isPdf) return;

    setDocLoading(true);
    const fetchPdf = async () => {
      try {
        const resp = await ZOHO.CRM.CONNECTION.invoke(CONNECTION, {
          url: `https://www.zohoapis.eu/crm/v8/Submission_Logs/${parentRow.id}/Attachments/${upload.Attachment_ID}`,
          method: "GET",
          param_type: 1,
        });
        const content = resp?.details?.statusMessage;
        if (!content || typeof content !== "string") return;
        // Mask each char to 0–255 so btoa() won't throw on high bytes
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
    };
    fetchPdf();
    return () => setDocUrl(null);
  }, [open, upload, parentRow, attachment, isImage, isPdf]);

  const previewUrl = attachment?.$previewUrl
    ? `${ZOHO_BASE}${attachment.$previewUrl}`
    : null;

  const renderPreview = () => {
    if (docLoading)
      return <CircularProgress size={28} sx={{ color: "#1b3a6b" }} />;
    if (docUrl) {
      if (isImage)
        return (
          <img
            src={docUrl}
            alt={upload?.Document_Name}
            style={{
              maxWidth: "100%",
              maxHeight: 280,
              objectFit: "contain",
              borderRadius: 4,
            }}
          />
        );
      if (isPdf)
        return (
          <object
            data={docUrl}
            type="application/pdf"
            width="100%"
            height="300"
            style={{ display: "block" }}
          >
            PDF could not be displayed.
          </object>
        );
    }
    if (OFFICE_EXTS.has(ext))
      return (
        <>
          <InsertDriveFileOutlinedIcon
            sx={{ fontSize: 48, color: "#9ca3af" }}
          />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Word and Excel documents can be previewed through CRM Record only.
            Open the CRM record to preview this document.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              const org =
                attachment?.$previewUrl?.match(/\/crm\/(org\d+)\//)?.[1];
              const mod =
                attachment?.$previewUrl?.match(/[?&]module=([^&]+)/)?.[1];
              if (org && mod)
                window.open(
                  `${ZOHO_BASE}/crm/${org}/tab/${mod}/${parentRow.id}`,
                  "_blank",
                );
            }}
            sx={{
              textTransform: "none",
              fontSize: 12,
              borderColor: "#1b3a6b",
              color: "#1b3a6b",
              "&:hover": { bgcolor: "#1b3a6b", color: "white" },
            }}
          >
            View in CRM Record ↗
          </Button>
        </>
      );
    return (
      <>
        <InsertDriveFileOutlinedIcon sx={{ fontSize: 48, color: "#9ca3af" }} />
        <Typography variant="body2" color="text.secondary">
          Preview not available.
        </Typography>
      </>
    );
  };

  const handleAction = async (status) => {
    if (status === "Rejected" && !comment.trim()) {
      setCommentError(true);
      return;
    }
    setActionLoading(true);
    try {
      let newDocName = null;
      let newAttachmentId = null;
      let base64 = null;

      if (status === "Approved" && upload.Attachment_ID) {
        // Count already-approved docs of the same Document_Type
        const approvedCount = (allUploads ?? []).filter(
          (u) =>
            u.id !== upload.id &&
            u.Document_Type === upload.Document_Type &&
            u.Approval_Status === "Approved",
        ).length;
        const seq = String(approvedCount + 1).padStart(2, "0");
        newDocName = `${upload.Document_Type} ${seq}.${ext}`;

        // Step 1: Download the attachment binary
        const downloadResp = await ZOHO.CRM.CONNECTION.invoke(CONNECTION, {
          url: `https://www.zohoapis.eu/crm/v8/Submission_Logs/${parentRow.id}/Attachments/${upload.Attachment_ID}`,
          method: "GET",
          param_type: 1,
        });
        // const content = downloadResp?.details?.statusMessage;
        if (!downloadResp || typeof downloadResp !== "string") {
          console.error("[ApproveOps] Could not download attachment");
        } else {
          let binaryStr = "";
          for (let i = 0; i < downloadResp.length; i++) {
            binaryStr += String.fromCharCode(downloadResp.charCodeAt(i) & 0xff);
          }
          base64 = btoa(binaryStr);
          console.log(base64);

          // Step 2: Delete the old attachment
          await ZOHO.CRM.CONNECTION.invoke(CONNECTION, {
            url: `https://www.zohoapis.eu/crm/v8/Submission_Logs/${parentRow.id}/Attachments?ids=${upload.Attachment_ID}`,
            method: "DELETE",
            param_type: 1,
          });

          // Step 3: Re-upload with the new name using ZOHO.CRM.API.attachFile
          const byteChars = atob(base64);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteArray[i] = byteChars.charCodeAt(i);
          }
          const file = new File([byteArray], newDocName);
          const uploadResp = await ZOHO.CRM.API.attachFile({
            Entity: "Submission_Logs",
            RecordID: parentRow.id,
            File: { Name: newDocName, Content: file },
          });
          newAttachmentId = uploadResp?.data?.[0]?.details?.id ?? null;
        }
      }

      // Build subform update rows (now includes the new Attachment_ID)
      const allRows = (allUploads ?? []).map((u) => {
        if (u.id !== upload.id) return { id: u.id };
        const row = { id: u.id, Approval_Status: status };
        if (newDocName) row.Document_Name = newDocName;
        if (newAttachmentId) row.Attachment_ID = String(newAttachmentId);
        if (comment.trim()) row.Admin_Comment = comment.trim();
        return row;
      });

      const resp = await ZOHO.CRM.API.updateRecord({
        Entity: "Submission_Logs",
        APIData: { id: parentRow.id, Document_Uploads: allRows },
        Trigger: [],
      });

      if (resp?.data?.[0]?.code === "SUCCESS") {
        console.log("1");
        // Upload to WorkDrive if folder ID exists
        if (status === "Approved" && base64 && workdriveFolderId) {
          console.log("2");
          const wdResp = await ZOHO.CRM.CONNECTION.invoke(
            WORKDRIVE_CONNECTION,
            {
              url: `https://www.zohoapis.eu/workdrive/api/v1/upload?parent_id=${workdriveFolderId}&filename=${encodeURIComponent(newDocName)}&override-name-exist=true`,
              method: "POST",
              param_type: 2,
              body: {
                content: { content: base64, name: newDocName },
              },
            },
          );
          console.log("[ApproveOps] WorkDrive upload response", wdResp);
        }
        onStatusUpdate(
          parentRow.id,
          upload.id,
          status,
          comment.trim(),
          newDocName,
        );
        onClose();
      }
      setActionLoading(false);
    } catch (err) {
      console.error("Failed to update approval status", err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !actionLoading && onClose()}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          Review Document
          {isDecided && <StatusBadge status={currentStatus} />}
        </Box>
        <IconButton size="small" onClick={onClose} disabled={actionLoading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {/* File name bar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 1.25,
            bgcolor: "#f5f7fa",
            borderRadius: 1,
            mb: 2,
            border: "1px solid #e0e4ea",
          }}
        >
          <InsertDriveFileOutlinedIcon
            sx={{ color: "#1b3a6b", fontSize: 20 }}
          />
          <Typography fontWeight={600} fontSize={14} noWrap>
            {upload?.Document_Name ?? "—"}
          </Typography>
        </Box>

        {/* Document preview */}
        <Box
          sx={{
            border: "1px solid #e0e4ea",
            borderRadius: 1,
            mb: 1.5,
            minHeight: 180,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "#f5f7fa",
            p: 2,
            gap: 1.5,
          }}
        >
          {renderPreview()}
          {previewUrl && !OFFICE_EXTS.has(ext) && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => window.open(previewUrl, "_blank")}
              sx={{
                textTransform: "none",
                fontSize: 12,
                borderColor: "#1b3a6b",
                color: "#1b3a6b",
                "&:hover": { bgcolor: "#1b3a6b", color: "white" },
              }}
            >
              Open Full Preview ↗
            </Button>
          )}
        </Box>

        {!isDecided && (
          <>
            {/* Comment field */}
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
            >
              Comment to Client
            </Typography>
            <TextField
              multiline
              minRows={3}
              fullWidth
              size="small"
              placeholder="Add correction note for resubmission, if rejecting..."
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setCommentError(false);
              }}
              error={commentError}
              helperText={
                commentError
                  ? "A comment is required when rejecting a document."
                  : ""
              }
              sx={{ mt: 0.5, mb: 2 }}
            />

            {/* Approve / Reject buttons */}
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button
                fullWidth
                variant="contained"
                disabled={actionLoading}
                onClick={() => handleAction("Approved")}
                sx={{
                  bgcolor: "#16a34a",
                  "&:hover": { bgcolor: "#15803d" },
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                {actionLoading ? (
                  <CircularProgress size={18} sx={{ color: "white" }} />
                ) : (
                  "Approve"
                )}
              </Button>
              <Button
                fullWidth
                variant="contained"
                disabled={actionLoading}
                onClick={() => handleAction("Rejected")}
                sx={{
                  bgcolor: "#dc2626",
                  "&:hover": { bgcolor: "#b91c1c" },
                  textTransform: "none",
                  fontWeight: 700,
                }}
              >
                {actionLoading ? (
                  <CircularProgress size={18} sx={{ color: "white" }} />
                ) : (
                  "Reject"
                )}
              </Button>
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1 }}
            >
              Reject with a clear comment so the client can rectify and
              re-submit.
            </Typography>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Admins Page ──────────────────────────────────────────────────────

function Admins({ submissionLogs, onRefresh }) {
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [uploadsCache, setUploadsCache] = useState({}); // { recordId: upload[] }
  const [attachmentsCache, setAttachmentsCache] = useState({}); // { recordId: { attachmentId: attachment } }
  const [notesCache, setNotesCache] = useState({}); // { recordId: note[] }
  const [relatedRecordCache, setRelatedRecordCache] = useState({}); // { recordId: related module record }
  const [loadingId, setLoadingId] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null); // { upload, parentRow, attachment }

  const handleToggle = async (row) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    setActiveTab(0);
    if (uploadsCache[row.id]) return;
    setLoadingId(row.id);
    try {
      // Fetch subform uploads, CRM attachments, notes, and related module record in parallel
      const [recordResp, attachResp, notesResp, relatedResp] =
        await Promise.all([
          ZOHO.CRM.API.getRecord({
            Entity: "Submission_Logs",
            RecordID: row.id,
          }),
          ZOHO.CRM.API.getRelatedRecords({
            Entity: "Submission_Logs",
            RecordID: row.id,
            RelatedList: "Attachments",
            page: 1,
            per_page: 200,
          }),
          ZOHO.CRM.API.getRelatedRecords({
            Entity: "Submission_Logs",
            RecordID: row.id,
            RelatedList: "Notes",
            page: 1,
            per_page: 200,
          }),
          row.Related_Module_Name && row.Related_Record_ID
            ? ZOHO.CRM.API.getRecord({
                Entity: row.Related_Module_Name,
                RecordID: row.Related_Record_ID,
              })
            : Promise.resolve(null),
        ]);

      const uploads = recordResp?.data?.[0]?.Document_Uploads ?? [];

      // Build a map: attachment id → attachment object
      const attachMap = {};
      (attachResp?.data ?? []).forEach((a) => {
        attachMap[a.id] = a;
      });

      setUploadsCache((prev) => ({ ...prev, [row.id]: uploads }));
      setAttachmentsCache((prev) => ({ ...prev, [row.id]: attachMap }));
      setNotesCache((prev) => ({ ...prev, [row.id]: notesResp?.data ?? [] }));
      setRelatedRecordCache((prev) => ({
        ...prev,
        [row.id]: relatedResp?.data?.[0] ?? null,
      }));
    } catch (err) {
      console.error("Failed to fetch record data", err);
      setUploadsCache((prev) => ({ ...prev, [row.id]: [] }));
      setNotesCache((prev) => ({ ...prev, [row.id]: [] }));
    } finally {
      setLoadingId(null);
    }
  };

  const handleStatusUpdate = (
    parentId,
    uploadId,
    status,
    comment,
    newDocName,
  ) => {
    setUploadsCache((prev) => ({
      ...prev,
      [parentId]: (prev[parentId] ?? []).map((u) =>
        u.id === uploadId
          ? {
              ...u,
              Approval_Status: status,
              ...(comment && { Admin_Comment: comment }),
              ...(newDocName && { Document_Name: newDocName }),
            }
          : u,
      ),
    }));
  };

  const totalCols = COLUMNS.length + 1;

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 2,
        p: 3,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Typography variant="h6" fontWeight={600}>
        Client Submissions
      </Typography>
      <Typography variant="body2" color="text.secondary" mt={0.5} mb={2}>
        Latest 200 submission records from clients.
      </Typography>

      <TableContainer
        sx={{
          flex: 1,
          overflow: "auto",
          border: "1px solid #e0e4ea",
          borderRadius: 1,
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableCell
                  key={col.key}
                  sx={{
                    bgcolor: "#f5f7fa",
                    fontWeight: 600,
                    color: "#1b3a6b",
                    borderBottom: "2px solid #e0e4ea",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
              <TableCell
                sx={{
                  bgcolor: "#f5f7fa",
                  fontWeight: 600,
                  color: "#1b3a6b",
                  borderBottom: "2px solid #e0e4ea",
                  whiteSpace: "nowrap",
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {submissionLogs?.length ? (
              submissionLogs.map((row) => {
                const isOpen = expandedId === row.id;
                const isLoading = loadingId === row.id;
                const uploads = uploadsCache[row.id] ?? [];
                const attachMap = attachmentsCache[row.id] ?? {};
                const notes = notesCache[row.id] ?? [];

                return (
                  <>
                    <TableRow key={row.id} hover>
                      {COLUMNS.map((col) => (
                        <TableCell
                          key={col.key}
                          sx={{
                            color: "#333",
                            whiteSpace: "nowrap",
                            borderBottom: isOpen ? 0 : "1px solid #e0e4ea",
                          }}
                        >
                          {formatCell(col.key, row)}
                        </TableCell>
                      ))}
                      <TableCell
                        sx={{
                          borderBottom: isOpen ? 0 : "1px solid #e0e4ea",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Button
                          size="small"
                          variant={isOpen ? "contained" : "outlined"}
                          onClick={() => handleToggle(row)}
                          sx={{
                            textTransform: "none",
                            fontSize: 12,
                            bgcolor: isOpen ? "#1b3a6b" : undefined,
                            borderColor: "#1b3a6b",
                            color: isOpen ? "white" : "#1b3a6b",
                            "&:hover": { bgcolor: "#1b3a6b", color: "white" },
                          }}
                        >
                          {isOpen ? "Close" : "Review"}
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow key={`${row.id}-expand`}>
                      <TableCell
                        colSpan={totalCols}
                        sx={{
                          p: 0,
                          borderBottom: isOpen ? "2px solid #e0e4ea" : 0,
                        }}
                      >
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <Box
                            sx={{ bgcolor: "#f9fafb", px: 3, pt: 1.5, pb: 2 }}
                          >
                            {/* Tabs */}
                            <Tabs
                              value={activeTab}
                              onChange={(_, v) => setActiveTab(v)}
                              sx={{
                                mb: 1.5,
                                minHeight: 36,
                                "& .MuiTab-root": {
                                  minHeight: 36,
                                  textTransform: "none",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "#6b7280",
                                  px: 2,
                                },
                                "& .Mui-selected": { color: "#1b3a6b" },
                                "& .MuiTabs-indicator": { bgcolor: "#1b3a6b" },
                              }}
                            >
                              <Tab label="User Uploads" />
                              <Tab label="User Messages" />
                            </Tabs>

                            {isLoading ? (
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "center",
                                  py: 2,
                                }}
                              >
                                <CircularProgress
                                  size={24}
                                  sx={{ color: "#1b3a6b" }}
                                />
                              </Box>
                            ) : activeTab === 0 ? (
                              /* ── User Uploads tab ── */
                              <Table
                                size="small"
                                sx={{
                                  tableLayout: "fixed",
                                  width: "100%",
                                  bgcolor: "white",
                                  borderRadius: 1,
                                  overflow: "hidden",
                                }}
                              >
                                <TableHead>
                                  <TableRow>
                                    {UPLOAD_COLUMNS.map((col) => (
                                      <TableCell
                                        key={col.key}
                                        sx={{
                                          bgcolor: "#eef1f6",
                                          fontWeight: 600,
                                          color: "#1b3a6b",
                                          borderBottom: "2px solid #e0e4ea",
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {col.label}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {uploads.length ? (
                                    uploads.map((upload, idx) => (
                                      <TableRow key={idx} hover>
                                        {UPLOAD_COLUMNS.map((col) => (
                                          <TableCell
                                            key={col.key}
                                            sx={{
                                              color: "#333",
                                              borderBottom: "1px solid #e0e4ea",
                                              whiteSpace: "nowrap",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                            }}
                                          >
                                            {col.key === "Approval_Status" ? (
                                              <StatusBadge
                                                status={upload.Approval_Status}
                                              />
                                            ) : col.key === "_actions" ? (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() =>
                                                  setReviewDialog({
                                                    upload,
                                                    parentRow: row,
                                                    allUploads: uploads,
                                                    attachment:
                                                      attachMap[
                                                        upload.Attachment_ID
                                                      ] ?? null,
                                                    workdriveFolderId:
                                                      relatedRecordCache[row.id]
                                                        ?.easyworkdriveforcrm__Workdrive_Folder_ID_EXT ??
                                                      null,
                                                  })
                                                }
                                                sx={{
                                                  textTransform: "none",
                                                  fontSize: 12,
                                                  borderColor: "#1b3a6b",
                                                  color: "#1b3a6b",
                                                  "&:hover": {
                                                    bgcolor: "#1b3a6b",
                                                    color: "white",
                                                  },
                                                }}
                                              >
                                                Review
                                              </Button>
                                            ) : (
                                              (upload[col.key] ?? "—")
                                            )}
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    ))
                                  ) : (
                                    <TableRow>
                                      <TableCell
                                        colSpan={UPLOAD_COLUMNS.length}
                                        align="center"
                                        sx={{ py: 2, color: "text.secondary" }}
                                      >
                                        No uploads found.
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            ) : (
                              /* ── User Messages tab ── */
                              <Box
                                sx={{
                                  bgcolor: "white",
                                  border: "1px solid #e0e4ea",
                                  borderRadius: 1,
                                  p: 2,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                  maxHeight: 320,
                                  overflowY: "auto",
                                }}
                              >
                                {notes.length ? (
                                  notes.map((note) => (
                                    <Box
                                      key={note.id}
                                      sx={{
                                        display: "flex",
                                        gap: 1.5,
                                        alignItems: "flex-start",
                                      }}
                                    >
                                      {/* Avatar */}
                                      <Box
                                        sx={{
                                          width: 34,
                                          height: 34,
                                          borderRadius: "50%",
                                          bgcolor: "#1b3a6b",
                                          color: "white",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: 13,
                                          fontWeight: 700,
                                          flexShrink: 0,
                                          mt: 0.25,
                                        }}
                                      >
                                        {(row.Client_Name ??
                                          "?")[0].toUpperCase()}
                                      </Box>

                                      {/* Bubble */}
                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Box
                                          sx={{
                                            display: "flex",
                                            alignItems: "baseline",
                                            gap: 1,
                                            mb: 0.5,
                                          }}
                                        >
                                          <Typography
                                            fontWeight={700}
                                            fontSize={13}
                                            color="#1b3a6b"
                                            noWrap
                                          >
                                            {row.Client_Name ?? "Unknown"}
                                          </Typography>
                                          <Typography
                                            fontSize={11}
                                            color="text.secondary"
                                            flexShrink={0}
                                          >
                                            {note.Created_Time
                                              ? formatNoteTime(
                                                  note.Created_Time,
                                                )
                                              : "—"}
                                          </Typography>
                                        </Box>
                                        <Box
                                          sx={{
                                            bgcolor: "#eef3ff",
                                            border: "1px solid #d0ddf7",
                                            borderRadius: "0 10px 10px 10px",
                                            px: 1.75,
                                            py: 1,
                                          }}
                                        >
                                          {note.Note_Title && (
                                            <Typography
                                              fontSize={11}
                                              fontWeight={700}
                                              color="#1b3a6b"
                                              mb={0.25}
                                            >
                                              {note.Note_Title}
                                            </Typography>
                                          )}
                                          <Typography
                                            fontSize={13}
                                            color="#333"
                                            sx={{
                                              whiteSpace: "pre-wrap",
                                              wordBreak: "break-word",
                                            }}
                                          >
                                            {note.Note_Content ?? "—"}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    </Box>
                                  ))
                                ) : (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    textAlign="center"
                                    py={2}
                                  >
                                    No messages found.
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={totalCols}
                  align="center"
                  sx={{ py: 4, color: "text.secondary" }}
                >
                  No Records Found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ReviewDocumentDialog
        open={!!reviewDialog}
        onClose={() => setReviewDialog(null)}
        upload={reviewDialog?.upload}
        parentRow={reviewDialog?.parentRow}
        allUploads={reviewDialog?.allUploads}
        attachment={reviewDialog?.attachment}
        onStatusUpdate={handleStatusUpdate}
        workdriveFolderId={reviewDialog?.workdriveFolderId}
      />
    </Box>
  );
}

export default Admins;
