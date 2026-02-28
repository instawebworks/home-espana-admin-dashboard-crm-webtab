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
import { useState, useEffect, useRef } from "react";

const ZOHO = window.ZOHO;

const CONNECTION = "zoho_crm_conn_used_in_widget_do_not_delete";

const REQUIREMENT_OPTIONS = ["Required", "Optional"];

const FILE_TYPE_OPTIONS = [
  "PDF",
  "PNG",
  "JPG",
  "JPEG",
  "HEIC",
  "WebP",
  "GIF",
  "TIFF",
  "DOC",
  "DOCX",
  "XLS",
  "XLSX",
  "PPT",
  "PPTX",
  "TXT",
  "CSV",
];

function createField() {
  return {
    id: Date.now() + Math.random(),
    name: "",
    checked: true,
    requirement: "Required",
    fileTypes: [],
    uploadCount: 1,
  };
}

function TemplateEditorDialog({
  open,
  onClose,
  onTemplateCreated,
  editRecord,
}) {
  const [templateName, setTemplateName] = useState("");
  const [moduleName, setModuleName] = useState(null);
  const [passwordField, setPasswordField] = useState(null);
  const [workdriveFolder, setWorkdriveFolder] = useState(null);
  const [fields, setFields] = useState([createField()]);
  const [modules, setModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [moduleFields, setModuleFields] = useState([]);
  const [moduleFieldsLoading, setModuleFieldsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Holds passwordField/workdriveFolder to restore after module fields load in edit mode
  const pendingFieldsRef = useRef(null);

  const isEditMode = !!editRecord;

  // Fetch modules on open; pre-fill form if editing
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
        const list =
          resp?.details?.statusMessage?.modules?.filter(
            (modules) =>
              modules?.api_supported === true &&
              modules?.status === "visible" &&
              (modules?.generated_type === "default" ||
                modules?.generated_type === "custom") &&
              modules?.editable === true,
          ) ?? [];
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

    if (editRecord) {
      const parsed =
        typeof editRecord.Template_JSON === "string"
          ? JSON.parse(editRecord.Template_JSON)
          : editRecord.Template_JSON;

      setTemplateName(parsed.templateName || editRecord.Name || "");
      setFields(
        parsed.documentRequirements?.length
          ? parsed.documentRequirements
          : [createField()],
      );

      // Store pending values — restored after module fields are fetched
      pendingFieldsRef.current = {
        passwordField: parsed.passwordField || null,
        workdriveFolder: parsed.workdriveFolder || null,
      };

      setModuleName(parsed.moduleName || null);
    }
  }, [open, editRecord]);

  // Fetch module fields whenever module changes; restore edit values if pending
  useEffect(() => {
    setPasswordField(null);
    setWorkdriveFolder(null);
    setModuleFields([]);
    if (!moduleName) return;

    const fetchFields = async () => {
      setModuleFieldsLoading(true);
      try {
        const resp = await ZOHO.CRM.CONNECTION.invoke(CONNECTION, {
          url: `https://www.zohoapis.eu/crm/v8/settings/fields?module=${moduleName.value}`,
          method: "GET",
          param_type: 1,
        });
        const list =
          resp?.details?.statusMessage?.fields.filter(
            (fields) => fields?.data_type === "text",
          ) ?? [];
        const mapped = list.map((f) => ({
          label: f.display_label,
          value: f.api_name,
        }));
        setModuleFields(mapped);

        // Restore pending values from edit mode
        if (pendingFieldsRef.current) {
          const { passwordField: pf, workdriveFolder: wf } =
            pendingFieldsRef.current;
          if (pf) {
            const match = mapped.find((f) => f.value === pf.value);
            if (match) setPasswordField(match);
          }
          if (wf) {
            const match = mapped.find((f) => f.value === wf.value);
            if (match) setWorkdriveFolder(match);
          }
          pendingFieldsRef.current = null;
        }
      } catch (err) {
        console.error("Failed to fetch fields", err);
      } finally {
        setModuleFieldsLoading(false);
      }
    };

    fetchFields();
  }, [moduleName]);

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

  const handleSubmit = async () => {
    const newErrors = {};
    if (!templateName.trim())
      newErrors.templateName = "Template name is required.";
    if (!moduleName) newErrors.moduleName = "Module name is required.";
    if (!passwordField) newErrors.passwordField = "Password field is required.";
    if (!workdriveFolder)
      newErrors.workdriveFolder = "Workdrive folder ID field is required.";
    if (fields.some((f) => !f.name.trim()))
      newErrors.fieldNames =
        "All document requirement fields must have a name.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const recordData = {
      Name: templateName,
      Module_Name: moduleName?.label,
      Password_Field: passwordField?.label,
      Workdrive_Folder_ID_FIeld: workdriveFolder?.label,
      Status: "Active",
      Template_JSON: {
        templateName,
        moduleName,
        passwordField,
        workdriveFolder,
        documentRequirements: fields,
      },
    };
    console.log(recordData);

    if (isEditMode) {
      const updatedResp = await ZOHO.CRM.API.updateRecord({
        Entity: "Document_Templates",
        APIData: { id: editRecord.id, ...recordData },
        Trigger: ["workflow"],
      });
      if (updatedResp?.data?.[0]?.code === "SUCCESS") {
        handleClose();
        onTemplateCreated();
      }
    } else {
      const createdResp = await ZOHO.CRM.API.insertRecord({
        Entity: "Document_Templates",
        APIData: recordData,
        Trigger: ["workflow"],
      });
      if (createdResp?.data?.[0]?.code === "SUCCESS") {
        handleClose();
        onTemplateCreated();
      }
    }
  };

  const handleClose = () => {
    setTemplateName("");
    setModuleName(null);
    setPasswordField(null);
    setWorkdriveFolder(null);
    setFields([createField()]);
    setErrors({});
    pendingFieldsRef.current = null;
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          {isEditMode ? "Edit Checklist Template" : "Checklist Template Editor"}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Row 1: Template Name + Module Name */}
        <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={500}
            >
              Template Name
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Put a Name here"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                setErrors((p) => ({ ...p, templateName: undefined }));
              }}
              error={!!errors.templateName}
              helperText={errors.templateName}
              sx={{ mt: 0.5 }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={500}
            >
              Module Name
            </Typography>
            <Autocomplete
              options={modules}
              value={moduleName}
              onChange={(_, val) => {
                setModuleName(val);
                setErrors((p) => ({ ...p, moduleName: undefined }));
              }}
              loading={modulesLoading}
              isOptionEqualToValue={(option, val) => option.value === val.value}
              size="small"
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select a module"
                  error={!!errors.moduleName}
                  helperText={errors.moduleName}
                  sx={{ mt: 0.5 }}
                />
              )}
            />
          </Box>
        </Box>

        {/* Row 2: Password Field + Workdrive Folder ID Field */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={500}
            >
              Password Field
            </Typography>
            <Autocomplete
              options={moduleFields.filter(
                (f) => f.value !== workdriveFolder?.value,
              )}
              value={passwordField}
              onChange={(_, val) => {
                setPasswordField(val);
                setErrors((p) => ({ ...p, passwordField: undefined }));
              }}
              loading={moduleFieldsLoading}
              disabled={!moduleName}
              isOptionEqualToValue={(option, val) => option.value === val.value}
              size="small"
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={
                    moduleName
                      ? "Select a password field"
                      : "Select a module first"
                  }
                  error={!!errors.passwordField}
                  helperText={errors.passwordField}
                  sx={{ mt: 0.5 }}
                />
              )}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={500}
            >
              Workdrive Folder ID Field
            </Typography>
            <Autocomplete
              options={moduleFields.filter(
                (f) => f.value !== passwordField?.value,
              )}
              value={workdriveFolder}
              onChange={(_, val) => {
                setWorkdriveFolder(val);
                setErrors((p) => ({ ...p, workdriveFolder: undefined }));
              }}
              loading={moduleFieldsLoading}
              disabled={!moduleName}
              isOptionEqualToValue={(option, val) => option.value === val.value}
              size="small"
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={
                    moduleName
                      ? "Select a folder ID field"
                      : "Select a module first"
                  }
                  error={!!errors.workdriveFolder}
                  helperText={errors.workdriveFolder}
                  sx={{ mt: 0.5 }}
                />
              )}
            />
          </Box>
        </Box>

        {/* Document Requirements */}
        <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
          Document Requirements
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {fields.map((field) => (
            <Box
              key={field.id}
              sx={{
                border: `1px solid ${errors.fieldNames && !field.name.trim() ? "#e53935" : "#e0e4ea"}`,
                borderRadius: 1.5,
                px: 1,
                pt: 0.5,
                pb: 1,
              }}
            >
              {/* Line 1: checkbox, name, remove */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Checkbox
                  checked={field.checked}
                  onChange={(e) =>
                    handleFieldChange(field.id, "checked", e.target.checked)
                  }
                  size="small"
                  sx={{
                    color: "#1b3a6b",
                    "&.Mui-checked": { color: "#1b3a6b" },
                  }}
                />

                <TextField
                  variant="standard"
                  placeholder="Field name"
                  value={field.name}
                  onChange={(e) => {
                    handleFieldChange(field.id, "name", e.target.value);
                    setErrors((p) => ({ ...p, fieldNames: undefined }));
                  }}
                  size="small"
                  slotProps={{ input: { disableUnderline: true } }}
                  sx={{ flex: 1 }}
                />

                <IconButton
                  size="small"
                  onClick={() => handleRemoveField(field.id)}
                  sx={{ color: "#e53935" }}
                >
                  ✕
                </IconButton>
              </Box>

              {/* Line 2: file types, requirement, upload count */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  pl: 1.5,
                  mt: 0.5,
                }}
              >
                <Autocomplete
                  multiple
                  options={FILE_TYPE_OPTIONS}
                  value={field.fileTypes}
                  onChange={(_, val) =>
                    handleFieldChange(field.id, "fileTypes", val)
                  }
                  size="small"
                  disableCloseOnSelect
                  slotProps={{ chip: { size: "small" } }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={
                        field.fileTypes.length === 0 ? "File types" : ""
                      }
                    />
                  )}
                  sx={{ flex: 1 }}
                />

                <TextField
                  type="number"
                  size="small"
                  label="Upload Count"
                  value={field.uploadCount}
                  onChange={(e) =>
                    handleFieldChange(
                      field.id,
                      "uploadCount",
                      Math.max(1, Number(e.target.value)),
                    )
                  }
                  slotProps={{ htmlInput: { min: 1 } }}
                  sx={{ width: 130 }}
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
              </Box>
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
          onClick={handleSubmit}
          sx={{
            textTransform: "none",
            bgcolor: "#2d60c4",
            "&:hover": { bgcolor: "#1b3a6b" },
          }}
        >
          {isEditMode ? "Update Template" : "Save Template"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TemplateEditorDialog;
