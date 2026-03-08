import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import Admins from "./pages/Admins";

const ZOHO = window.ZOHO;

function App() {
  const [initialized, setInitialized] = useState(false); // initialize the widget
  const [documentTemplates, setDocumentTemplates] = useState(null); // keeps all the templates of Templates module
  const [submissionLogs, setSubmissionLogs] = useState(null); // keeps all the submission logs
  const [activePage, setActivePage] = useState("Templates");

  useEffect(() => {
    // initialize the app
    ZOHO.embeddedApp.on("PageLoad", function (data) {
      setInitialized(true);
    });

    ZOHO.embeddedApp.init();
  }, []);

  const fetchTemplates = async () => {
    const existingTemplatesResp = await ZOHO.CRM.API.getAllRecords({
      Entity: "Document_Templates",
      sort_order: "asc",
      per_page: 200,
      page: 1,
    });
    setDocumentTemplates(existingTemplatesResp?.data);
  };

  const fetchSubmissionLogs = async () => {
    const resp = await ZOHO.CRM.API.getAllRecords({
      Entity: "Submission_Logs",
      sort_order: "desc",
      per_page: 200,
      page: 1,
    });
    setSubmissionLogs(resp?.data);
  };

  useEffect(() => {
    if (initialized) {
      fetchTemplates();
      fetchSubmissionLogs();
    }
  }, [initialized]);

  const renderPage = () => {
    switch (activePage) {
      case "Dashboard":
        return <Dashboard />;
      case "Templates":
        return (
          <Templates
            documentTemplates={documentTemplates}
            onTemplateCreated={fetchTemplates}
          />
        );
      case "Admins":
        return <Admins submissionLogs={submissionLogs} onRefresh={fetchSubmissionLogs} />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: "flex", bgcolor: "#eef1f6", height: "100vh", overflow: "hidden" }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          height: "100%",
        }}
      >
        {/* Page content */}
        <Box sx={{ p: 2, flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {renderPage()}
        </Box>
      </Box>
    </Box>
  );
}

export default App;
