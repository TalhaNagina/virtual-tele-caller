import React, { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Tooltip, LinearProgress, Snackbar, Fade, Button, Typography } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

export default function RecordBar({ agent, voice, setMessages }) {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [status, setStatus] = useState("Idle");
    const [volume, setVolume] = useState(0);
    const [snack, setSnack] = useState("");

    // Refs for all the Web Audio API and recording logic
    const audioContextRef = useRef(null);
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const silenceTimerRef = useRef(null);
    const animationFrameRef = useRef(null);
    const isSpeakingRef = useRef(false);

    // This useEffect hook contains the entire "Session Model" logic
    useEffect(() => {
        const startSession = async () => {
            if (!agent || !voice) {
                setSnack("Please select an agent and voice first.");
                return;
            }
            setStatus("Initializing...");
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;

                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContextRef.current.createMediaStreamSource(stream);
                const analyser = audioContextRef.current.createAnalyser();
                analyser.fftSize = 512;
                analyser.minDecibels = -60;
                source.connect(analyser);
                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                audioChunksRef.current = [];

                mediaRecorderRef.current.ondataavailable = e => {
                    if (e.data.size > 0) audioChunksRef.current.push(e.data);
                };

                mediaRecorderRef.current.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    audioChunksRef.current = [];

                    if (audioBlob.size < 200 || !isSessionActive) return;

                    setStatus("Processing...");
                    const formData = new FormData();
                    formData.append("file", audioBlob);
                    formData.append("agentId", agent);
                    formData.append("voiceId", voice);

                    try {
                        const res = await fetch("http://localhost:7000/stt", { method: "POST", body: formData });
                        const data = await res.json();
                        setMessages(prev => [
                            ...prev,
                            { from: 'User', text: data.text?.trim() || "(...)", ts: Date.now() },
                            { from: 'AI', text: data.reply?.trim() || "(...)", ts: Date.now() }
                        ]);
                        setStatus("Playing...");
                        const audio = new Audio(`http://localhost:7000/audio?t=${Date.now()}&voiceId=${voice}`);
                        audio.onended = () => setStatus("Listening...");
                        await audio.play();
                    } catch (err) {
                        setSnack("Error processing audio.");
                        setStatus("Error");
                    }
                };

                const detect = () => {
                    if (!streamRef.current) return;
                    analyser.getByteFrequencyData(dataArray);
                    const currentVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    setVolume(currentVolume);

                    if (currentVolume > 5) {
                        clearTimeout(silenceTimerRef.current);
                        if (!isSpeakingRef.current) {
                            isSpeakingRef.current = true;
                            setStatus("Recording...");
                            if (mediaRecorderRef.current.state !== 'recording') mediaRecorderRef.current.start();
                        }
                    } else if (isSpeakingRef.current) {
                        silenceTimerRef.current = setTimeout(() => {
                            if (mediaRecorderRef.current.state === 'recording') {
                                mediaRecorderRef.current.stop();
                                isSpeakingRef.current = false;
                            }
                        }, 5000);
                    }
                    animationFrameRef.current = requestAnimationFrame(detect);
                };
                setStatus("Listening...");
                detect();
            } catch (err) {
                setSnack("Microphone access denied.");
                setStatus("Mic Error");
                setIsSessionActive(false);
            }
        };

        const stopSession = () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
            isSpeakingRef.current = false;
            setVolume(0);
            setStatus("Idle");
        };

        if (isSessionActive) {
            startSession();
        } else {
            stopSession();
        }

        return () => stopSession();
    }, [isSessionActive, agent, voice, setMessages]);

    const handleReset = async () => {
        await fetch("http://localhost:7000/reset", { method: "POST" });
        setMessages([]);
        setSnack("Conversation cleared");
    };

    return (
        <Box sx={{
            position: "sticky", bottom: 0, left: 0, right: 0,
            bgcolor: "background.paper", px: 2, py: 1, borderTop: 1,
            borderColor: "divider", display: "flex", alignItems: "center", gap: 2
        }}>
            <Button
                variant="contained"
                color={isSessionActive ? "error" : "primary"}
                onClick={() => setIsSessionActive(!isSessionActive)}
                disabled={!agent || !voice}
                startIcon={isSessionActive ? <StopIcon /> : <MicIcon />}
                sx={{ borderRadius: '50px', textTransform: 'none', minWidth: '160px' }}
            >
                {isSessionActive ? 'End Session' : 'Start Session'}
            </Button>

            <Tooltip title="Replay last reply">
                <span>
                    <IconButton disabled={isSessionActive} onClick={() => new Audio(`http://localhost:7000/audio?t=${Date.now()}`).play()}>
                        <PlayArrowIcon />
                    </IconButton>
                </span>
            </Tooltip>

            <Tooltip title="Reset conversation">
                <span>
                    <IconButton disabled={isSessionActive} onClick={handleReset}>
                        <RestartAltIcon />
                    </IconButton>
                </span>
            </Tooltip>

            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                {isSessionActive && <LinearProgress variant="determinate" value={Math.min(volume * 2, 100)} sx={{ flex: 1 }} />}
                <Typography variant="caption" sx={{ minWidth: '100px', textAlign: 'center' }}>
                    Status: {status}
                </Typography>
            </Box>

            <Snackbar open={!!snack} autoHideDuration={3000} message={snack} onClose={() => setSnack("")} />
        </Box>
    );
}
