import type { AuthResponse } from '../types/auth';

const API_BASE = '/api/v1/auth';

export const authApi = {
    async login(username: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!response.ok) throw new Error('Login failed');
        return response.json();
    },

    async register(username: string, email: string, full_name: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, full_name, password }),
        });
        if (!response.ok) throw new Error('Registration failed');
        return response.json();
    },

    async logout(): Promise<void> {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                await fetch(`${API_BASE}/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
            } catch {
                // Even if the API call fails, we still want to clear local state
            }
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
};
