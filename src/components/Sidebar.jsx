import { Box } from "@mui/material";

const NAV_ITEMS = ["Dashboard", "Templates", "Admins"];

function Sidebar({ activePage, onNavigate }) {
  return (
    <Box
      sx={{
        width: 260,
        minHeight: "100vh",
        bgcolor: "#1b3a6b",
        display: "flex",
        flexDirection: "column",
        py: 3,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          mx: 2,
          mb: 4,
          bgcolor: "white",
          borderRadius: 2,
          px: 2,
          py: 1.5,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <img
          src="/image.png"
          alt="Home España"
          style={{ width: "100%", maxWidth: 100 }}
        />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, px: 1.5 }}>
        {NAV_ITEMS.map((item) => (
          <Box
            key={item}
            onClick={() => onNavigate(item)}
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: 1.5,
              cursor: "pointer",
              bgcolor: activePage === item ? "#2d60c4" : "transparent",
              color: "white",
              fontWeight: activePage === item ? 600 : 400,
              fontSize: 15,
              transition: "background-color 0.15s",
              "&:hover": {
                bgcolor:
                  activePage === item ? "#2d60c4" : "rgba(255,255,255,0.08)",
              },
            }}
          >
            {item}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default Sidebar;
