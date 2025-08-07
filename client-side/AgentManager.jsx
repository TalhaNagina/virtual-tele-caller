import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Box, Paper, TextField, Button, List, ListItem, ListItemText, IconButton, Snackbar, CircularProgress, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function AgentManager() {
    const [agents, setAgents] = useState([]);
    const [voices, setVoices] = useState([]);
    const [newAgent, setNewAgent] = useState({
        name: '',
        prompt: '',
        role: '',
        goal: '',
        voice_id: ''
    });
    const [loading, setLoading] = useState(false);
    const [snack, setSnack] = useState('');

    const fetchAgents = () => {
        fetch('http://localhost:7000/api/agents')
            .then(res => res.json())
            .then(data => setAgents(data))
            .catch(err => console.error("Failed to fetch agents:", err));
    };

    const fetchVoices = () => {
        fetch('http://localhost:7000/voices')
            .then(res => res.json())
            .then(data => setVoices(data))
            .catch(err => console.error("Failed to fetch voices:", err));
    };

    useEffect(() => {
        fetchAgents();
        fetchVoices();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewAgent(prev => ({ ...prev, [name]: value }));
    };

    const handleGeneratePrompt = async () => {
        if (!newAgent.role || !newAgent.goal) {
            setSnack('Please provide a role and goal to generate a prompt.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('http://localhost:7000/api/generate-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newAgent.role, goal: newAgent.goal }),
            });
            const data = await res.json();
            if (data.prompt) {
                setNewAgent(prev => ({ ...prev, prompt: data.prompt }));
                setSnack('Prompt generated successfully!');
            } else {
                setSnack('Failed to generate prompt.');
            }
        } catch (error) {
            setSnack('An error occurred while generating the prompt.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAgent = async () => {
        const { name, prompt, voice_id } = newAgent;
        if (!name || !prompt) {
            setSnack('Agent Name and System Prompt are required.');
            return;
        }
        await fetch('http://localhost:7000/api/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, prompt, voice_id }),
        });
        setNewAgent({ name: '', prompt: '', role: '', goal: '', voice_id: '' });
        fetchAgents();
        setSnack('Agent created!');
    };

    const handleDeleteAgent = async (id) => {
        await fetch(`http://localhost:7000/api/agents/${id}`, { method: 'DELETE' });
        fetchAgents();
        setSnack('Agent deleted.');
    };

    return (
        <>
            <AppBar position="static">
                <Toolbar>
                    <IconButton component={RouterLink} to="/" edge="start" color="inherit" aria-label="back">
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Agent Management
                    </Typography>
                </Toolbar>
            </AppBar>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
                <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
                    <Typography variant="h5" gutterBottom>Create New Agent</Typography>
                    <TextField fullWidth label="Agent Name" name="name" value={newAgent.name} onChange={handleInputChange} sx={{ mb: 2 }} />
                    <Typography variant="h6" gutterBottom>AI Prompt Generator</Typography>
                    <TextField fullWidth label="Agent Role (e.g., 'Library Assistant')" name="role" value={newAgent.role} onChange={handleInputChange} sx={{ mb: 2 }} />
                    <TextField fullWidth label="Agent Goal (e.g., 'Help patrons find books')" name="goal" value={newAgent.goal} onChange={handleInputChange} sx={{ mb: 2 }} />
                    <Button variant="contained" onClick={handleGeneratePrompt} disabled={loading} startIcon={<AutoFixHighIcon />}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Generate Prompt'}
                    </Button>
                    <TextField fullWidth multiline rows={6} label="System Prompt" name="prompt" value={newAgent.prompt} onChange={handleInputChange} sx={{ mt: 2, mb: 2 }} />
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel id="voice-select-label">Agent Voice</InputLabel>
                        <Select
                            labelId="voice-select-label"
                            id="voice-select"
                            name="voice_id"
                            value={newAgent.voice_id}
                            label="Agent Voice"
                            onChange={handleInputChange}
                        >
                            <MenuItem value=""><em>Default</em></MenuItem>
                            {voices.map((voice) => (
                                <MenuItem key={voice.id} value={voice.id}>{voice.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button variant="contained" color="primary" onClick={handleCreateAgent}>Create Agent</Button>
                </Paper>

                <Paper sx={{ p: { xs: 2, md: 3 } }}>
                    <Typography variant="h5" gutterBottom>Existing Agents</Typography>
                    <List>
                        {agents.map(agent => (
                            <ListItem key={agent.id} secondaryAction={
                                <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteAgent(agent.id)}>
                                    <DeleteIcon />
                                </IconButton>
                            }>
                                <ListItemText primary={agent.name} secondary={agent.prompt.substring(0, 100) + '...'} />
                            </ListItem>
                        ))}
                    </List>
                </Paper>
            </Box>
            <Snackbar open={!!snack} autoHideDuration={3000} message={snack} onClose={() => setSnack('')} />
        </>
    );
}
