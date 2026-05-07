import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import UsersTab from './UsersTab';
import TrucksTab from './TrucksTab';

const UsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto', pb: 8 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', color: '#1e293b' }}>
        Users & Trucks
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Users" />
        <Tab label="Trucks" />
      </Tabs>

      {activeTab === 0 && <UsersTab />}
      {activeTab === 1 && <TrucksTab />}
    </Box>
  );
};

export default UsersPage;
