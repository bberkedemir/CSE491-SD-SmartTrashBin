import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthProvider';
import { Sidebar } from './components/Navigation/Sidebar';
import RoutingPage from './pages/RoutingPage/RoutingPage';
import Dashboard from './pages/Dashboard/Dashboard';
import LogsPage from './pages/LogsPage/LogsPage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import 'leaflet/dist/leaflet.css';
import './App.css';

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
});

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Sidebar />
      <Box sx={{ width: '100%', height: '100%' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/route" replace />} />
          <Route path="/route" element={<RoutingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="*" element={<Navigate to="/route" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;