import React, { useState, useEffect, useRef } from 'react';
import { AppBar, Toolbar, Typography, Box, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MessageBubble from './components/MessageBubble'; 
import RecordBar from './components/voiceRecorder';     
import ControlDrawer from './components/ControlDrawer'; 

export default function TelecallerDashboard() {
    const [messages, setMessages] = useState([]);
    const [agents, setAgents] = useState([]);
    const [voices, setVoices] = useState([]);
    const [activeAgentId, setActiveAgentId] = useState('');
    const [activeVoiceId, setActiveVoiceId] = useState('');
    const [isRecording, setIsRecording] = useState(false); // Managed by RecordBar
    const [drawerOpen, setDrawerOpen] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        // Fetch initial data for agents and voices
        fetch('http://localhost:7000/api/agents')
            .then(res => res.json())
            .then(data => {
                setAgents(data);
                if (data.length > 0) setActiveAgentId(String(data[0].id));
            })
            .catch(err => console.error("Failed to fetch agents:", err));

        fetch('http://localhost:7000/voices')
            .then(res => res.json())
            .then(data => {
                setVoices(data);
                if (data.length > 0) setActiveVoiceId(data[0].id);
            })
            .catch(err => console.error("Failed to fetch voices:", err));
    }, []);

    useEffect(() => {
        // Auto-scroll to the latest message
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="fixed">
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={() => setDrawerOpen(true)}
                        sx={{ mr: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div">
                        Telecaller Dashboard
                    </Typography>
                </Toolbar>
            </AppBar>

            <ControlDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                agents={agents}
                voices={voices}
                agent={activeAgentId}
                setAgent={setActiveAgentId}
                voice={activeVoiceId}
                setVoice={setActiveVoiceId}
                isRecording={isRecording}
            />

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: { xs: 1, sm: 2, md: 3 },
                    pt: '80px', // Push content below the AppBar
                    pb: '80px', // Add padding to avoid overlap with RecordBar
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {messages.length === 0 && (
                    <Box sx={{m: 'auto', color: 'text.secondary'}}>
                        <Typography>Conversation will appear here.</Typography>
                    </Box>
                )}
                {messages.map((msg, index) => (
                    <MessageBubble key={index} from={msg.from} text={msg.text} ts={msg.ts} />
                ))}
                <div ref={scrollRef} />
            </Box>

            <RecordBar
                agent={activeAgentId}
                voice={activeVoiceId}
                setMessages={setMessages}
                setIsRecording={setIsRecording} // Pass the setter to RecordBar
            />
        </Box>
    );
}
