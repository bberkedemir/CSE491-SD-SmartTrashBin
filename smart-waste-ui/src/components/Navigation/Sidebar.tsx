import { Box, List, ListItem, ListItemButton, ListItemIcon } from '@mui/material';
import { Map, Dashboard, History } from '@mui/icons-material';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: <Dashboard /> },
  { path: '/route', label: 'Route', icon: <Map /> },
  { path: '/logs', label: 'Logs', icon: <History /> },
];

export const Sidebar: React.FC = () => {
  return (
    <Box
      sx={{
        width: 60,
        height: '100vh',
        bgcolor: '#1976d2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1200,
      }}
    >
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              component={NavLink}
              to={item.path}
              sx={{
                borderRadius: 1,
                minWidth: 48,
                minHeight: 48,
                justifyContent: 'center',
                '&.active': {
                  bgcolor: 'rgba(255,255,255,0.2)',
                },
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: 0,
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                {item.icon}
              </ListItemIcon>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
