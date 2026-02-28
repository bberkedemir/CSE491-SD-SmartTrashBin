import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { Sidebar } from './components/Navigation/Sidebar';
import RoutingPage from './pages/RoutingPage/RoutingPage';
import Dashboard from './pages/Dashboard/Dashboard';
import LogsPage from './pages/LogsPage/LogsPage';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Box sx={{ display: 'flex' }}>
        <Sidebar />
        <Box sx={{ flexGrow: 1, ml: '60px' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/route" replace />} />
            <Route path="/route" element={<RoutingPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/logs" element={<LogsPage />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}

export default App;
