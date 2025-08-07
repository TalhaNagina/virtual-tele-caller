import React from 'react';
import { Drawer, Toolbar, Box, FormControl, InputLabel, Select, MenuItem, Divider, Stack, Typography, Button } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { Link } from 'react-router-dom';

export default function ControlDrawer({ open, onClose, agents, voices, agent, setAgent, voice, setVoice, isRecording }) {
  return (
    <Drawer
      variant="temporary"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
    >
      <Toolbar />
      <Box sx={{ width: 260, p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Settings</Typography>

        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel id="agent-select-label">Agent</InputLabel>
          <Select
            labelId="agent-select-label"
            value={agent || ''}
            label="Agent"
            onChange={e => setAgent(e.target.value)}
            disabled={isRecording}
          >
            {agents.map(a => (
              <MenuItem key={a.id} value={String(a.id)}>
                {a.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel id="voice-select-label">Voice</InputLabel>
          <Select
            labelId="voice-select-label"
            value={voice || ''}
            label="Voice"
            onChange={e => setVoice(e.target.value)}
            disabled={isRecording}
          >
            {voices.map(v => (
              <MenuItem key={v.id} value={v.id}>
                {v.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Divider sx={{ my: 3 }} />
        <Button
          component={Link}
          to="/admin"
          variant="outlined"
          fullWidth
          startIcon={<SettingsIcon />}
        >
          Manage Agents
        </Button>

      </Box>
    </Drawer>
  );
}
