import { Box, List, ListItem, ListItemButton, ListItemIcon, Tooltip, Avatar, Typography } from '@mui/material';
import { Map, Dashboard, History, Logout } from '@mui/icons-material';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: <Dashboard /> },
  { path: '/route', label: 'Route', icon: <Map /> },
  { path: '/logs', label: 'Logs', icon: <History /> },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  const visibleNavItems = navItems.filter(item => {
    if (item.path === '/dashboard' || item.path === '/logs') {
      return isAdmin;
    }
    return true;
  });

  const handleLogout = () => {
    logout();
  };

  // Get initials from full_name (e.g. "John Doe" -> "JD")
  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Box
      sx={{
        width: 60,
        height: '100vh',
        bgcolor: '#1976d2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2,
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1200,
      }}
    >
      {/* User identity at the top */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        {user && (
          <Tooltip
            title={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{user.full_name}</Typography>
                <Typography variant="caption">{user.username}</Typography>
                <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                  {user.role === 'admin' ? 'Admin' : 'Truck Driver'}
                </Typography>
              </Box>
            }
            placement="right"
            arrow
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'rgba(255,255,255,0.25)',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                mb: 1,
              }}
            >
              {getInitials(user.full_name)}
            </Avatar>
          </Tooltip>
        )}

        <List>
          {visibleNavItems.map((item) => (
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

      <List>
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 1,
              minWidth: 48,
              minHeight: 48,
              justifyContent: 'center',
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
              <Logout />
            </ListItemIcon>
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
};
