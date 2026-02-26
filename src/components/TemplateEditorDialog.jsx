import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useState, useEffect } from "react";

const ZOHO = window.ZOHO;

const CONNECTION = "zoho_crm_conn_used_in_widget_do_not_delete";

// Demo options — will be replaced with real data later
const PASSWORD_FIELD_OPTIONS = [
  "Pass_Deals",
  "Pass_Contacts",
  "Pass_Leads",
  "Pass_Accounts",
];
const WORKDRIVE_FOLDER_OPTIONS = [
  "1212121121212",
  "2323232232323",
  "3434343343434",
];

const REQUIREMENT_OPTIONS = ["Required", "Optional"];

function createField() {
  return {
    id: Date.now() + Math.random(),
    name: "",
    checked: true,
    requirement: "Required",
  };
}

function TemplateEditorDialog({ open, onClose }) {
  const [templateName, setTemplateName] = useState("");
  const [moduleName, setModuleName] = useState(null);
  const [passwordField, setPasswordField] = useState(null);
  const [workdriveFolder, setWorkdriveFolder] = useState(null);
  const [fields, setFields] = useState([createField()]);
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchModules = async () => {
      setModulesLoading(true);
      try {
        const resp = await ZOHO.CRM.CONNECTION.invoke(CONNECTION, {
          url: "https://www.zohoapis.eu/crm/v8/settings/modules",
          method: "GET",
          param_type: 1,
        });
        console.log(resp);
        const list = resp?.details?.statusMessage?.modules ?? [];
        setModules(
          list.map((m) => ({ label: m.plural_label, value: m.api_name })),
        );
      } catch (err) {
        console.error("Failed to fetch modules", err);
      } finally {
        setModulesLoading(false);
      }
    };
    fetchModules();
  }, [open]);

  const handleAddField = () => {
    setFields((prev) => [...prev, createField()]);
  };

  const handleRemoveField = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleFieldChange = (id, key, value) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)),
    );
  };

  const handleClose = () => {
    setTemplateName("");
    setModuleName(null);
    setPasswordField(null);
    setWorkdriveFolder(null);
    setFields([createField()]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          Checklist Template Editor
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Template Name */}
        <Typography variant="caption" color="text.secondary" fontWeight={500}>
          Template Name
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Example: Canada Student Visa"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          sx={{ mt: 0.5, mb: 1 }}
        />

        {/* Module Name */}
        <Typography variant="caption" color="text.secondary" fontWeight={500}>
          Module Name
        </Typography>
        <Autocomplete
          options={modules}
          value={moduleName}
          onChange={(_, val) => setModuleName(val)}
          loading={modulesLoading}
          isOptionEqualToValue={(option, val) => option.value === val.value}
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Select a module"
              sx={{ mt: 0.5, mb: 1 }}
            />
          )}
        />

        {/* Password Field */}
        <Typography variant="caption" color="text.secondary" fontWeight={500}>
          Password Field
        </Typography>
        <Autocomplete
          options={PASSWORD_FIELD_OPTIONS}
          value={passwordField}
          onChange={(_, val) => setPasswordField(val)}
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Select a password field"
              sx={{ mt: 0.5, mb: 1 }}
            />
          )}
        />

        {/* Workdrive Folder ID Field */}
        <Typography variant="caption" color="text.secondary" fontWeight={500}>
          Workdrive Folder ID Field
        </Typography>
        <Autocomplete
          options={WORKDRIVE_FOLDER_OPTIONS}
          value={workdriveFolder}
          onChange={(_, val) => setWorkdriveFolder(val)}
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Select a folder ID field"
              sx={{ mt: 0.5, mb: 2 }}
            />
          )}
        />

        {/* Document Requirements */}
        <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
          Document Requirements
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {fields.map((field) => (
            <Box
              key={field.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                border: "1px solid #e0e4ea",
                borderRadius: 1.5,
                px: 1,
                py: 0.5,
              }}
            >
              <Checkbox
                checked={field.checked}
                onChange={(e) =>
                  handleFieldChange(field.id, "checked", e.target.checked)
                }
                size="small"
                sx={{ color: "#1b3a6b", "&.Mui-checked": { color: "#1b3a6b" } }}
              />

              <TextField
                variant="standard"
                placeholder="Field name"
                value={field.name}
                onChange={(e) =>
                  handleFieldChange(field.id, "name", e.target.value)
                }
                size="small"
                InputProps={{ disableUnderline: true }}
                sx={{ flex: 1 }}
              />

              <Select
                value={field.requirement}
                onChange={(e) =>
                  handleFieldChange(field.id, "requirement", e.target.value)
                }
                size="small"
                variant="standard"
                disableUnderline
                sx={{ fontSize: 13, color: "text.secondary", minWidth: 90 }}
              >
                {REQUIREMENT_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt} sx={{ fontSize: 13 }}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>

              <IconButton
                size="small"
                onClick={() => handleRemoveField(field.id)}
                sx={{ color: "#e53935" }}
              >
                ✕
              </IconButton>
            </Box>
          ))}
        </Box>

        {/* Add Field */}
        <Box
          onClick={handleAddField}
          sx={{
            mt: 1,
            border: "1.5px dashed #c0c8d8",
            borderRadius: 1.5,
            py: 1.25,
            textAlign: "center",
            cursor: "pointer",
            color: "#2d60c4",
            fontWeight: 500,
            fontSize: 14,
            "&:hover": { bgcolor: "#f5f7fa" },
          }}
        >
          + Add Field
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          sx={{ textTransform: "none", borderColor: "#c0c8d8", color: "#333" }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          sx={{
            textTransform: "none",
            bgcolor: "#2d60c4",
            "&:hover": { bgcolor: "#1b3a6b" },
          }}
        >
          Save Template
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TemplateEditorDialog;
