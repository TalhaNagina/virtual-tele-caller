import { Avatar, Box, Typography } from "@mui/material";
import dayjs from "dayjs";

export default function MessageBubble({ from, text, ts }) {
  const mine = from === "User";
  return (
    <Box sx={{
      display: "flex",
      mb: 1.5,
      flexDirection: mine ? "row-reverse" : "row",
      alignItems: "flex-start"
    }}>
      <Avatar sx={{ bgcolor: mine ? "primary.main" : "secondary.main", ml: mine ? 1 : 0, mr: mine ? 0 : 1 }}>
        {from[0]}
      </Avatar>
      <Box sx={{
        maxWidth: 480,
        bgcolor: mine ? "primary.main" : "grey.700",
        color:    mine ? "primary.contrastText" : "grey.100",
        p: 1.5,
        borderRadius: 2
      }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{from}</Typography>
        <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>{text}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {dayjs(ts).format("HH:mm")}
        </Typography>
      </Box>
    </Box>
  );
}
