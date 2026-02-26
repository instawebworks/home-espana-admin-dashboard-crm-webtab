import { Box, Typography } from "@mui/material";

function Admins() {
  return (
    <Box sx={{ bgcolor: "white", borderRadius: 2, p: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      <Typography variant="h6" fontWeight={600}>
        Admins
      </Typography>
      <Typography variant="body2" color="text.secondary" mt={0.5}>
        Manage admin users and permissions here.
      </Typography>
    </Box>
  );
}

export default Admins;
