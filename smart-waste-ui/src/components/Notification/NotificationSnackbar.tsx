import { Snackbar, Alert } from '@mui/material';
import type { AppNotification } from '../../types/bin';

interface NotificationSnackbarProps {
    notification: AppNotification;
    onClose: () => void;
}

const NotificationSnackbar: React.FC<NotificationSnackbarProps> = ({
    notification,
    onClose,
}) => (
    <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 2000 }}
    >
        <Alert onClose={onClose} severity={notification.severity} sx={{ minWidth: 300, fontSize: 14 }}>
            {notification.message}
        </Alert>
    </Snackbar>
);

export default NotificationSnackbar;