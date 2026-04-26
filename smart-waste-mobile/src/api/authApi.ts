import type { AuthResponse } from '../types';

const API_BASE = '/api/v1/auth';

export const authApi = {
    async login(username: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.detail || 'Login failed');
        }

        return response.json();
    },

    async registerDriver(username: string, email: string, full_name: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE}/register-driver`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, full_name, password }),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.detail || 'Registration failed');
        }

        return response.json();
    },

    async logout(token: string): Promise<void> {
        await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    }
};
