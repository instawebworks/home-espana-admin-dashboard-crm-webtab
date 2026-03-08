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
} from "@mui/material";
import { useState } from "react";

const ZOHO = window.ZOHO;

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
  Pending:  { bg: "#fff8e1", color: "#b45309", border: "#fde68a" },
  Approved: { bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7" },
  Rejected: { bg: "#fff1f2", color: "#9f1239", border: "#fecdd3" },
  Missing:  { bg: "#fff1f2", color: "#9f1239", border: "#fecdd3" },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" };
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

function Admins({ submissionLogs, onRefresh }) {
  const [expandedId, setExpandedId] = useState(null);
  const [uploadsCache, setUploadsCache] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const handleToggle = async (row) => {
    // Collapse if already open
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(row.id);

    // Use cache if already fetched
    if (uploadsCache[row.id]) return;

    setLoadingId(row.id);
    try {
      const resp = await ZOHO.CRM.API.getRecord({
        Entity: "Submission_Logs",
        RecordID: row.id,
      });
      const data = resp?.data?.[0];
      setUploadsCache((prev) => ({ ...prev, [row.id]: data?.Document_Uploads ?? [] }));
    } catch (err) {
      console.error("Failed to fetch record", err);
      setUploadsCache((prev) => ({ ...prev, [row.id]: [] }));
    } finally {
      setLoadingId(null);
    }
  };

  const totalCols = COLUMNS.length + 1; // +1 for Actions column

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
        sx={{ flex: 1, overflow: "auto", border: "1px solid #e0e4ea", borderRadius: 1 }}
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

                return (
                  <>
                    {/* Main row */}
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
                      <TableCell sx={{ borderBottom: isOpen ? 0 : "1px solid #e0e4ea", whiteSpace: "nowrap" }}>
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

                    {/* Expandable sub-row */}
                    <TableRow key={`${row.id}-expand`}>
                      <TableCell
                        colSpan={totalCols}
                        sx={{ p: 0, borderBottom: isOpen ? "2px solid #e0e4ea" : 0 }}
                      >
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <Box sx={{ bgcolor: "#f9fafb", px: 3, py: 2 }}>
                            {isLoading ? (
                              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                                <CircularProgress size={24} sx={{ color: "#1b3a6b" }} />
                              </Box>
                            ) : (
                              <Table
                                size="small"
                                sx={{ tableLayout: "fixed", width: "100%", bgcolor: "white", borderRadius: 1, overflow: "hidden" }}
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
                                              <StatusBadge status={upload.Approval_Status} />
                                            ) : col.key === "_actions" ? (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                  textTransform: "none",
                                                  fontSize: 12,
                                                  borderColor: "#1b3a6b",
                                                  color: "#1b3a6b",
                                                  "&:hover": { bgcolor: "#1b3a6b", color: "white" },
                                                }}
                                              >
                                                Review
                                              </Button>
                                            ) : (
                                              upload[col.key] ?? "—"
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
    </Box>
  );
}

export default Admins;
