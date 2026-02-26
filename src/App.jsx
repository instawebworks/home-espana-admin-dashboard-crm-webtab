import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import Admins from "./pages/Admins";

const ZOHO = window.ZOHO;

function App() {
  const [initialized, setInitialized] = useState(false); // initialize the widget
  const [documentTemplates, setDocumentTemplates] = useState(null); // keeps all the templates of Templates module
  const [activePage, setActivePage] = useState("Templates");

  useEffect(() => {
    // initialize the app
    ZOHO.embeddedApp.on("PageLoad", function (data) {
      setInitialized(true);
    });

    ZOHO.embeddedApp.init();
  }, []);

  useEffect(() => {
    if (initialized) {
      const fetchData = async () => {
        const existingTemplatesResp = await ZOHO.CRM.API.getAllRecords({
          Entity: "Document_Templates",
          sort_order: "asc",
          per_page: 200,
          page: 1,
        });
        setDocumentTemplates(existingTemplatesResp?.data);
      };

      fetchData();
    }
  }, [initialized]);

  const renderPage = () => {
    switch (activePage) {
      case "Dashboard":
        return <Dashboard />;
      case "Templates":
        return <Templates documentTemplates={documentTemplates} />;
      case "Admins":
        return <Admins />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: "flex", bgcolor: "#eef1f6" }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        {/* Page content */}
        <Box sx={{ p: 2 }}>{renderPage()}</Box>
      </Box>
    </Box>
  );
}

export default App;
