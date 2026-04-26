import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthResponse } from '../types';
import { authApi } from '../api/authApi';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, email: string, fullName: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) {
            setIsLoading(false);
            return;
        }

        fetch('/api/v1/auth/me', {
            headers: { 'Authorization': `Bearer ${storedToken}` },
        })
            .then(res => {
                if (res.ok) {
                    return res.json().then((userData: User) => {
                        setToken(storedToken);
                        setUser(userData);
                        localStorage.setItem('user', JSON.stringify(userData));
                    });
                } else {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
            })
            .catch(() => {
                const cachedUser = localStorage.getItem('user');
                if (cachedUser) {
                    try {
                        setUser(JSON.parse(cachedUser));
                        setToken(storedToken);
                    } catch {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                    }
                }
            })
            .finally(() => setIsLoading(false));
    }, []);

    const handleAuthResponse = useCallback((response: AuthResponse) => {
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        const response = await authApi.login(username, password);
        // Only allow truck_driver role on mobile app
        if (response.user.role !== 'truck_driver') {
            throw new Error('Bu uygulama sadece sürücüler içindir. Lütfen web uygulamasını kullanın.');
        }
        handleAuthResponse(response);
    }, [handleAuthResponse]);

    const register = useCallback(async (username: string, email: string, fullName: string, password: string) => {
        const response = await authApi.registerDriver(username, email, fullName, password);
        handleAuthResponse(response);
    }, [handleAuthResponse]);

    const logout = useCallback(async () => {
        try {
            if (token) await authApi.logout(token);
        } catch { /* continue */ }
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }, [token]);

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
