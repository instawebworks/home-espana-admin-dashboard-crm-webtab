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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { SubmissionDetail } from "../components/submission/SubmissionDetail";
import {
  parseApplicants,
  parseRequirements,
  computeSignoffProgress,
  dealOwnerOf,
  dealNameOf,
  NO_OWNER,
} from "../components/submission/submissionHelpers";
import { useDealNameSearch } from "../hooks/useDealNameSearch";

const ZOHO = window.ZOHO;

const COLUMNS = [
  { label: "Deal Name", key: "_deal_name", maxWidth: 200 },
  { label: "Client Name", key: "Client_Name" },
  { label: "Client Email", key: "Client_Email" },
  { label: "Applicants", key: "_applicants" },
  { label: "Sign-off Progress", key: "_progress" },
  { label: "Submission Date", key: "Submission_Date" },
  { label: "Doc Uploads", key: "_doc_uploads" },
  { label: "Modified Time", key: "Modified_Time" },
];

const DEAL_CANVAS_SUFFIX = "/canvas/434889000031449238";
const DEAL_URL_BASE = "https://crm.zoho.eu/crm/org20080353658/tab/Potentials";

// Same gradients as the applicant chips inside the expanded view.
const AVATAR_GRADIENTS = [
  "linear-gradient(150deg,#3b82f6,#1b3a6b)",
  "linear-gradient(150deg,#8b5cf6,#5b21b6)",
  "linear-gradient(150deg,#0ea5e9,#0c4a6e)",
  "linear-gradient(150deg,#f59e0b,#b45309)",
];

// Sentinel for the "no deal owner recorded" filter option — cannot collide with
// a real owner name.
function initialsOf(name) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function ApplicantsCell({ row }) {
  const applicants = parseApplicants(row, []);
  if (!applicants.length) return "—";
  const shown = applicants.slice(0, 3);
  const extra = applicants.length - shown.length;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {shown.map((name, i) => (
        <Box
          key={name}
          title={name}
          sx={{
            width: 22,
            height: 22,
            borderRadius: "7px",
            display: "grid",
            placeItems: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "white",
            background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
            flexShrink: 0,
          }}
        >
          {initialsOf(name)}
        </Box>
      ))}
      {extra > 0 && (
        <Box
          title={applicants.slice(3).join(", ")}
          sx={{
            width: 22,
            height: 22,
            borderRadius: "7px",
            display: "grid",
            placeItems: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "#475569",
            bgcolor: "#eef1f6",
            flexShrink: 0,
          }}
        >
          +{extra}
        </Box>
      )}
    </Box>
  );
}

function ProgressCell({ row, requirements }) {
  const prog = computeSignoffProgress(row, requirements);
  if (!prog) return "—";
  const complete = prog.signed >= prog.total;
  const started = prog.signed > 0;
  const palette = complete
    ? { bg: "#e7f6ec", color: "#0f7a37", border: "#b7e4c7" }
    : started
      ? { bg: "#eaf1fe", color: "#1b3a6b", border: "#bcd0f0" }
      : { bg: "#eef1f6", color: "#475569", border: "#e0e4ea" };
  return (
    <Box
      component="span"
      title={`${prog.signed} of ${prog.total} applicant sections signed off`}
      sx={{
        display: "inline-block",
        px: 1.25,
        py: 0.25,
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        bgcolor: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
      }}
    >
      {prog.signed}/{prog.total} signed off
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

function Admins({ submissionLogs, focusLogId }) {
  const [expandedId, setExpandedId] = useState(null);
  const [dealOwnerFilter, setDealOwnerFilter] = useState("");
  const [dealInfoMap, setDealInfoMap] = useState({}); // { dealId: { name, requirements } }
  const search = useDealNameSearch();
  // Field patches applied on top of the list-API rows, so summary columns stay
  // in step with edits made inside an expanded row (and with the fresh record
  // fetched on expand) without refetching all 200 logs.
  const [rowPatches, setRowPatches] = useState({}); // { logId: Partial<row> }

  const handleRecordUpdate = useCallback((logId, patch) => {
    setRowPatches((prev) => {
      const merged = { ...(prev[logId] ?? {}), ...patch };
      const current = prev[logId];
      // Skip the state write when nothing actually changed — the detail view
      // pushes the same values on every expand.
      if (
        current &&
        Object.keys(merged).every(
          (k) => JSON.stringify(merged[k]) === JSON.stringify(current[k]),
        )
      ) {
        return prev;
      }
      return { ...prev, [logId]: merged };
    });
  }, []);

  useEffect(() => {
    if (!submissionLogs?.length) return;
    const uniqueIds = [
      ...new Set(
        submissionLogs
          .filter((r) => r.Related_Module_Name === "Deals" && r.Related_Record_ID)
          .map((r) => r.Related_Record_ID),
      ),
    ];
    if (!uniqueIds.length) return;
    Promise.all(
      uniqueIds.map((id) =>
        ZOHO.CRM.API.getRecord({ Entity: "Deals", RecordID: id })
          .then((resp) => {
            const deal = resp?.data?.[0];
            return {
              id,
              name: deal?.Deal_Name ?? "—",
              owner: deal?.Owner?.name ?? "",
              requirements: parseRequirements(deal),
            };
          })
          .catch(() => ({ id, name: "—", owner: "", requirements: [] })),
      ),
    ).then((results) => {
      const map = {};
      results.forEach(({ id, name, owner, requirements }) => {
        map[id] = { name, owner, requirements };
      });
      setDealInfoMap(map);
    });
  }, [submissionLogs]);

  // Arriving from the dashboard worklist: open that submission and bring it
  // into view (the row may be far down a 200-row table).
  useEffect(() => {
    if (!focusLogId) return;
    setExpandedId(focusLogId);
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`[data-log-row="${focusLogId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusLogId]);

  const handleToggle = (row) => {
    setExpandedId((prev) => (prev === row.id ? null : row.id));
  };

  // Distinct deal owners across the loaded logs, plus an "unassigned" bucket
  // when some record has no owner resolvable yet.
  const dealOwners = useMemo(() => {
    if (!submissionLogs) return { names: [], hasUnassigned: false };
    const names = new Set();
    let hasUnassigned = false;
    submissionLogs.forEach((r) => {
      const owner = dealOwnerOf(r, dealInfoMap);
      if (owner) names.add(owner);
      else hasUnassigned = true;
    });
    return {
      names: [...names].sort((a, b) => a.localeCompare(b)),
      hasUnassigned,
    };
  }, [submissionLogs, dealInfoMap]);

  const ownerFilteredLogs = useMemo(() => {
    if (!submissionLogs) return [];
    if (!dealOwnerFilter) return submissionLogs;
    return submissionLogs.filter((r) => {
      const owner = dealOwnerOf(r, dealInfoMap);
      return dealOwnerFilter === NO_OWNER ? !owner : owner === dealOwnerFilter;
    });
  }, [submissionLogs, dealOwnerFilter, dealInfoMap]);

  // Two complementary sources, unioned:
  //  • local  — substring match over rows already loaded. Instant, and catches
  //             mid-word fragments the API's word-prefix operator cannot.
  //  • remote — Deal_Name search across the whole module, reaching records
  //             outside the loaded page. The owner filter is applied to these
  //             too, so the two controls compose.
  const filteredLogs = useMemo(() => {
    const needle = search.term.trim().toLowerCase();
    if (!needle) return ownerFilteredLogs;

    const local = ownerFilteredLogs.filter((r) =>
      dealNameOf(r, dealInfoMap).toLowerCase().includes(needle),
    );

    const seen = new Set(local.map((r) => r.id));
    const remote = search.results.filter((r) => {
      if (seen.has(r.id)) return false;
      if (!dealOwnerFilter) return true;
      const owner = dealOwnerOf(r, dealInfoMap);
      return dealOwnerFilter === NO_OWNER ? !owner : owner === dealOwnerFilter;
    });

    return [...local, ...remote];
  }, [ownerFilteredLogs, dealInfoMap, dealOwnerFilter, search.term, search.results]);

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
      <Typography variant="body2" color="text.secondary" mt={0.5} mb={1.5}>
        Latest 200 submission records from clients.
      </Typography>

      {/* Filter bar */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 350 }}>
          <InputLabel>Filter by Deal Owner</InputLabel>
          <Select
            value={dealOwnerFilter}
            onChange={(e) => {
              setDealOwnerFilter(e.target.value);
              setExpandedId(null);
            }}
            label="Filter by Deal Owner"
          >
            <MenuItem value="">All Owners</MenuItem>
            {dealOwners.names.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
            {dealOwners.hasUnassigned && (
              <MenuItem value={NO_OWNER}>
                <em>No deal owner</em>
              </MenuItem>
            )}
          </Select>
        </FormControl>

        <TextField
          size="small"
          placeholder="Search by deal name..."
          value={search.term}
          onChange={(e) => search.setTerm(e.target.value)}
          error={search.failed}
          helperText={
            search.failed
              ? "Search failed — showing loaded records only."
              : search.isTooShort
                ? `Type ${search.minChars} characters to search all records`
                : " "
          }
          sx={{ width: 300, "& .MuiFormHelperText-root": { mt: 0.25, mb: -2.5 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  {search.isBusy
                    ? <CircularProgress size={16} sx={{ color: "#6b7280" }} />
                    : <SearchIcon fontSize="small" sx={{ color: "#6b7280" }} />
                  }
                </InputAdornment>
              ),
              endAdornment: search.term ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={search.clear} aria-label="Clear search" sx={{ p: 0.25 }}>
                    <CloseIcon sx={{ fontSize: 16, color: "#6b7280" }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />

        {submissionLogs && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ ml: "auto", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
          >
            Showing {filteredLogs.length} of {submissionLogs.length}
          </Typography>
        )}
      </Box>

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
                    py: 0.75,
                    fontSize: 13,
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
                  py: 0.75,
                  fontSize: 13,
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs?.length ? (
              filteredLogs.map((baseRow) => {
                const patch = rowPatches[baseRow.id];
                const row = patch ? { ...baseRow, ...patch } : baseRow;
                const isOpen = expandedId === row.id;

                const dealInfo = dealInfoMap[row.Related_Record_ID];

                return (
                  <Fragment key={row.id}>
                    <TableRow
                      hover
                      data-log-row={row.id}
                      onClick={() => handleToggle(row)}
                      sx={{ cursor: "pointer" }}
                    >
                      {COLUMNS.map((col) => (
                        <TableCell
                          key={col.key}
                          sx={{
                            color: "#333",
                            whiteSpace: "nowrap",
                            borderBottom: isOpen ? 0 : "1px solid #e0e4ea",
                            py: 0.5,
                            fontSize: 13,
                            ...(col.maxWidth && {
                              maxWidth: col.maxWidth,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }),
                          }}
                        >
                          {col.key === "_deal_name" ? (
                            row.Related_Record_ID && dealNameOf(row, dealInfoMap) ? (
                              <Box
                                component="a"
                                href={`${DEAL_URL_BASE}/${row.Related_Record_ID}${DEAL_CANVAS_SUFFIX}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                  color: "#2d60c4",
                                  fontWeight: 600,
                                  textDecoration: "none",
                                  "&:hover": { textDecoration: "underline" },
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {dealNameOf(row, dealInfoMap)}
                              </Box>
                            ) : "—"
                          ) : col.key === "_applicants" ? (
                            <ApplicantsCell row={row} />
                          ) : col.key === "_progress" ? (
                            <ProgressCell row={row} requirements={dealInfo?.requirements} />
                          ) : formatCell(col.key, row)}
                        </TableCell>
                      ))}
                      <TableCell
                        sx={{
                          borderBottom: isOpen ? 0 : "1px solid #e0e4ea",
                          whiteSpace: "nowrap",
                          py: 0.5,
                        }}
                      >
                        <Button
                          size="small"
                          variant={isOpen ? "contained" : "outlined"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(row);
                          }}
                          sx={{
                            textTransform: "none",
                            fontSize: 12,
                            py: 0.25,
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
                          <SubmissionDetail row={row} onRecordUpdate={handleRecordUpdate} />
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
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
