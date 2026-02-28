import {
  Box,
  Typography,
  Button,
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import { useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import TemplateEditorDialog from "../components/TemplateEditorDialog";

const ZOHO = window.ZOHO;

const COLUMNS = [
  { label: "Name", key: "Name" },
  { label: "Module", key: "Module_Name" },
  { label: "Status", key: "Status" },
  { label: "Password Field", key: "Password_Field" },
  { label: "Workdrive Folder ID Field", key: "Workdrive_Folder_ID_FIeld" },
  { label: "Modified Time", key: "Modified_Time" },
];

function formatCell(key, value) {
  if (key === "Modified_Time" && value)
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  return value ?? "—";
}

function Templates({ documentTemplates, onTemplateCreated }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleEditClick = (row) => {
    setEditRecord(row);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditRecord(null);
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      const resp = await ZOHO.CRM.API.deleteRecord({
        Entity: "Document_Templates",
        RecordID: deleteRecord.id,
      });
      if (resp?.data?.[0]?.code === "SUCCESS") {
        setDeleteRecord(null);
        onTemplateCreated(); // refresh the list
      }
    } catch (err) {
      console.error("Failed to delete record", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 2,
        p: 3,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 0.5,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Templates
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={() => { setEditRecord(null); setDialogOpen(true); }}
          sx={{
            bgcolor: "#1b3a6b",
            "&:hover": { bgcolor: "#15306a" },
            textTransform: "none",
          }}
        >
          + Add New Template
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" mt={0.5} mb={2}>
        Manage your document checklist templates here.
      </Typography>

      <TableContainer
        sx={{ maxHeight: 500, border: "1px solid #e0e4ea", borderRadius: 1 }}
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
            {documentTemplates?.length ? (
              documentTemplates.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  sx={{ "&:last-child td": { borderBottom: 0 } }}
                >
                  {COLUMNS.map((col) => (
                    <TableCell
                      key={col.key}
                      sx={{ color: "#333", whiteSpace: "nowrap" }}
                    >
                      {formatCell(col.key, row[col.key])}
                    </TableCell>
                  ))}
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <IconButton
                      size="small"
                      onClick={() => handleEditClick(row)}
                      sx={{ color: "#2d60c4" }}
                      title="Edit"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteRecord(row)}
                      sx={{ color: "#e53935", ml: 0.5 }}
                      title="Delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS.length + 1}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteRecord}
        onClose={() => !deleteLoading && setDeleteRecord(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete{" "}
            <strong>{deleteRecord?.Name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteRecord(null)}
            disabled={deleteLoading}
            sx={{ textTransform: "none", borderColor: "#c0c8d8", color: "#333" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={deleteLoading}
            sx={{
              textTransform: "none",
              bgcolor: "#e53935",
              "&:hover": { bgcolor: "#c62828" },
              minWidth: 100,
            }}
          >
            {deleteLoading ? (
              <CircularProgress size={18} sx={{ color: "white" }} />
            ) : (
              "Delete"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <TemplateEditorDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onTemplateCreated={onTemplateCreated}
        editRecord={editRecord}
      />
    </Box>
  );
}

export default Templates;
