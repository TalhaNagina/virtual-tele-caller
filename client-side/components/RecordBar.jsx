import React, { useRef, useState } from "react";
import {
  Box, IconButton, Tooltip, LinearProgress, Snackbar, Fade
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

export default function RecordBar({ agent, voice, setMessages, setIsRecording }) {
  const [busy,  setBusy]  = useState(false);
  const [snack, setSnack] = useState("");
  const mediaRef = useRef(null);
  const chunks   = useRef([]);

  const toast = m => setSnack(m);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      mediaRef.current = new MediaRecorder(stream);
      mediaRef.current.ondataavailable = e => e.data.size && chunks.current.push(e.data);
      mediaRef.current.onstop = upload;
      chunks.current = [];
      mediaRef.current.start();
      setBusy(true); toast("Recording…");
    } catch { toast("Mic denied"); }
  };

  const stop = () => mediaRef.current?.state === "recording" && mediaRef.current.stop();

  const upload = async () => {
    toast("Sending…");
    const blob = new Blob(chunks.current, { type:"audio/webm" });
    const fd = new FormData();
    fd.append("file", blob);
    fd.append("mimeType", "audio/webm");
    fd.append("voiceId", voice);
    fd.append("agentId", agent);

    const res = await fetch("http://localhost:7000/stt", { method:"POST", body:fd });
    const data = await res.json();
    setMessages(m => [
      ...m,
      { from:"User", text:data.text,  ts:Date.now() },
      { from:"AI",   text:data.reply, ts:Date.now() }
    ]);
    new Audio(`http://localhost:7000/audio?t=${Date.now()}`).play();
    toast("Reply playing");
    setBusy(false);
  };

  return (
    <Box sx={{
      position:"sticky", bottom:0, left:0, right:0,
      bgcolor:"background.paper", px:2, py:1, borderTop:1,
      borderColor:"divider", display:"flex", alignItems:"center"
    }}>
      <Tooltip title={busy ? "Stop" : "Record"} TransitionComponent={Fade}>
        <IconButton color={busy?"error":"primary"} onClick={busy?stop:start}>
          {busy ? <StopIcon /> : <MicIcon />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Replay last reply">
        <IconButton disabled={busy}
                    onClick={()=>new Audio("http://localhost:7000/audio").play()}>
          <PlayArrowIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Reset conversation">
        <IconButton disabled={busy}
                    onClick={async()=>{
                      await fetch("http://localhost:7000/reset",{method:"POST"});
                      setMessages([]); toast("Conversation cleared");
                    }}>
          <RestartAltIcon />
        </IconButton>
      </Tooltip>

      {busy && <LinearProgress sx={{ flex:1, ml:2 }} />}

      <Snackbar open={!!snack} autoHideDuration={3000}
                message={snack} onClose={()=>setSnack("")}
                anchorOrigin={{vertical:"bottom",horizontal:"center"}} />
    </Box>
  );
}
