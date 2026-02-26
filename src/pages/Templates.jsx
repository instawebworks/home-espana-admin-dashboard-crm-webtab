import {
  Box,
  Typography,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";
import { useState } from "react";
import TemplateEditorDialog from "../components/TemplateEditorDialog";

const COLUMNS = [
  { label: "Name", key: "Name" },
  { label: "Module", key: "Module_Name" },
  { label: "Status", key: "Status" },
  { label: "Password Field", key: "Password_Field" },
  { label: "Workdrive Folder ID Field", key: "Workdrive_Folder_ID_FIeld" },
  { label: "Modified Time", key: "Modified_Time" },
];

function formatCell(key, value) {
  if (key === "Owner") return value?.name ?? "—";
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

function Templates({ documentTemplates }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 2,
        p: 3,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="h6" fontWeight={600}>
          Templates
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={() => setDialogOpen(true)}
          sx={{ bgcolor: "#1b3a6b", "&:hover": { bgcolor: "#15306a" }, textTransform: "none" }}
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
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS.length}
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

      <TemplateEditorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Box>
  );
}

export default Templates;
