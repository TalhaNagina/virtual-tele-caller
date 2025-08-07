import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { getTheme } from './theme'; // Using your new theme file
import TelecallerDashboard from './TelecallerDashboard';
import AgentManager from './AgentManager';

export default function App() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState(prefersDark ? 'dark' : 'light');

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeProvider theme={getTheme(mode)}>
      <CssBaseline />
        <Routes>
          <Route path="/" element={<TelecallerDashboard toggleTheme={toggleTheme} />} />
          {/* Note: The path for AgentManager is now '/admin' as per your original file */}
          <Route path="/admin" element={<AgentManager toggleTheme={toggleTheme} />} />
        </Routes>
    </ThemeProvider>
  );
}
