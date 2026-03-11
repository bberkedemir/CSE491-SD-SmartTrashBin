import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { Sidebar } from './components/Navigation/Sidebar';
import RoutingPage from './pages/RoutingPage/RoutingPage';
import Dashboard from './pages/Dashboard/Dashboard';
import LogsPage from './pages/LogsPage/LogsPage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const token = localStorage.getItem('token');

  if (!token) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

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
