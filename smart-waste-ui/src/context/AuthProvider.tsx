import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthResponse } from '../types/auth';
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

    // On mount: check if we have a stored token and validate it
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) {
            setIsLoading(false);
            return;
        }

        // Validate the token by calling /me
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
                    // Token is invalid or expired — clear it
                    console.warn('[AuthProvider] Stored token is invalid/expired, clearing session');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
            })
            .catch(() => {
                // Network error — keep the session alive, use cached user data
                console.warn('[AuthProvider] Backend unreachable during token validation, using cached session');
                const cachedUser = localStorage.getItem('user');
                if (cachedUser) {
                    try {
                        setUser(JSON.parse(cachedUser));
                        setToken(storedToken);
                    } catch {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                    }
                } else {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
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
        handleAuthResponse(response);
    }, [handleAuthResponse]);

    const register = useCallback(async (username: string, email: string, fullName: string, password: string) => {
        const response = await authApi.register(username, email, fullName, password);
        handleAuthResponse(response);
    }, [handleAuthResponse]);

    const logout = useCallback(async () => {
        try {
            if (token) {
                await authApi.logout(token);
            }
        } catch {
            // Even if API call fails, clear local state
        }
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
