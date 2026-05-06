import type { User, UserRole } from '../types/auth';

const API_BASE = '/api/v1/users';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const usersApi = {
    async getUsers(): Promise<User[]> {
        const response = await fetch(`${API_BASE}/`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        return response.json();
    },

    async updateUserRole(userId: number, role: UserRole): Promise<User> {
        const response = await fetch(`${API_BASE}/${userId}/role`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ role }),
        });
        if (!response.ok) throw new Error('Failed to update user role');
        return response.json();
    },

    async updateUserStatus(userId: number, isActive: boolean): Promise<User> {
        const response = await fetch(`${API_BASE}/${userId}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ is_active: isActive }),
        });
        if (!response.ok) throw new Error('Failed to update user status');
        return response.json();
    }
};
