import React, { useState, useEffect } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, Tooltip, Avatar, Typography } from '@mui/material';
import { Map, Dashboard, History, Logout, People } from '@mui/icons-material';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: <Dashboard /> },
  { path: '/route', label: 'Route', icon: <Map /> },
  { path: '/logs', label: 'Logs', icon: <History /> },
  { path: '/users', label: 'Users', icon: <People /> },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    // Cleanup on unmount
    return () => document.body.classList.remove('sidebar-open');
  }, [isOpen]);

  const visibleNavItems = navItems.filter(item => {
    if (item.path === '/dashboard' || item.path === '/logs' || item.path === '/users') {
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
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      sx={{
        width: isOpen ? 220 : 60,
        height: '100vh',
        background: 'rgba(15, 97, 11, 0.600)',
        backdropFilter: 'blur(5px)',
        borderRight: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOpen ? 'stretch' : 'center',
        justifyContent: 'space-between',
        py: 2,
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1200,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      {/* User identity at the top */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isOpen ? 'flex-start' : 'center', gap: 1, px: isOpen ? 2 : 0, width: '100%' }}>
        {user && (
          <Tooltip
            title={!isOpen ? `${user.full_name} (${user.role})` : ''}
            placement="right"
            arrow
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1, justifyContent: isOpen ? 'flex-start' : 'center' }}>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: 'rgba(255,255,255,0.25)',
                  color: 'white',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {getInitials(user.full_name)}
              </Avatar>
              {isOpen && (
                <Box sx={{ ml: 1.5, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap' }}>{user.full_name}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                    {user.role === 'admin' ? 'Admin' : 'Truck Driver'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Tooltip>
        )}

        <List sx={{ width: '100%', px: isOpen ? 0 : 0 }}>
          {visibleNavItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                component={NavLink}
                to={item.path}
                sx={{
                  borderRadius: 1,
                  minWidth: 48,
                  minHeight: 48,
                  justifyContent: isOpen ? 'flex-start' : 'center',
                  px: isOpen ? 2 : undefined,
                  '&.active': {
                    bgcolor: 'rgba(0,0,0,0.1)',
                  },
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.05)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: isOpen ? 2 : 0,
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {isOpen && <Typography sx={{ color: 'white', fontWeight: 500 }}>{item.label}</Typography>}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      <List sx={{ width: '100%' }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 1,
              minWidth: 48,
              minHeight: 48,
              justifyContent: isOpen ? 'flex-start' : 'center',
              px: isOpen ? 2 : undefined,
              mx: isOpen ? 2 : 0,
              width: isOpen ? 'auto' : '100%',
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.05)',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: isOpen ? 2 : 0,
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <Logout />
            </ListItemIcon>
            {isOpen && <Typography sx={{ color: 'white', fontWeight: 500 }}>Logout</Typography>}
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
};
