import { useState } from 'react';
import { Box, Button, LinearProgress } from '@mui/material';
import type { AppNotification } from '../../types/bin';
import { binApi } from '../../api/binApi';

interface FileUploadProps {
    onUploadComplete: () => void;
    onNotification: (notification: AppNotification) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete, onNotification }) => {
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const result = await binApi.upload(file, setUploadProgress);

            if (result.status === 201) {
                onNotification({
                    open: true,
                    message: result.body.message,
                    severity: result.body.results?.skipped_count > 0 ? 'warning' : 'success',
                });
                onUploadComplete();
            } else {
                onNotification({
                    open: true,
                    message: result.body.detail || 'Upload failed',
                    severity: 'error',
                });
            }
        } catch (error) {
            onNotification({
                open: true,
                message: 'Network error during upload. Please try again.',
                severity: 'error',
            });
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            event.target.value = '';
        }
    };

    return (
        <>
            <input
                type="file"
                accept=".json,.txt,.csv"
                onChange={handleUpload}
                style={{ display: 'none' }}
                id="file-upload-input"
            />

            <Button
                variant="contained"
                component="label"
                htmlFor="file-upload-input"
                disabled={isUploading}
                sx={{
                    position: 'absolute',
                    bottom: 70,
                    right: 20,
                    width: '140px',
                    height: '44px',
                    zIndex: 1000,
                    bgcolor: '#007bff',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '14px',
                    borderRadius: '8px',
                    textTransform: 'none',
                    boxShadow: '0 4px 12px rgba(0, 123, 255, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        bgcolor: '#0056b3',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0, 123, 255, 0.4)',
                    },
                    '&:active': { transform: 'translateY(0px)' },
                    '&:disabled': {
                        bgcolor: '#6c757d',
                        color: '#ffffff',
                        boxShadow: 'none',
                    },
                }}
            >
                {isUploading ? `Uploading ${Math.round(uploadProgress)}%` : 'Upload File'}
            </Button>

            {isUploading && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: 120,
                        right: 20,
                        left: 20,
                        zIndex: 999,
                    }}
                >
                    <LinearProgress
                        variant="determinate"
                        value={uploadProgress}
                        sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: 'rgba(255, 255, 255, 0.3)',
                            '& .MuiLinearProgress-bar': {
                                backgroundColor: '#007bff',
                                borderRadius: 3,
                            },
                        }}
                    />
                </Box>
            )}
        </>
    );
};

export default FileUpload;