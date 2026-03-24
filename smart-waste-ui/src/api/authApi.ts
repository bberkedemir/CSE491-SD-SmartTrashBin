import type { AuthResponse } from '../types/auth';

const API_BASE = '/api/v1/auth';


async function extractErrorMessage(response: Response, context: string): Promise<string> {
    const status = response.status;
    const statusText = response.statusText;
    let detail = '';

    try {
        const body = await response.json();
        detail = body.detail || JSON.stringify(body);
    } catch {
        try {
            detail = await response.text();
        } catch {
            detail = 'Could not read response body';
        }
    }

    const fullMessage = `[${context}] HTTP ${status} (${statusText}): ${detail}`;
    console.error(fullMessage);
    console.error(`[${context}] Request URL: ${API_BASE}/${context.toLowerCase()}`);
    return detail || `HTTP ${status}: ${statusText}`;
}

export const authApi = {
    async login(username: string, password: string): Promise<AuthResponse> {
        console.log(`[LOGIN] Attempting login for username: '${username}'`);

        let response: Response;
        try {
            response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
        } catch (networkError: any) {
            console.error(`[LOGIN] NETWORK ERROR: ${networkError.message}`);
            throw new Error('Cannot connect to the server. Make sure the backend is running.');
        }

        if (!response.ok) {
            const detail = await extractErrorMessage(response, 'LOGIN');
            throw new Error(detail);
        }

        console.log(`[LOGIN] Success for username: '${username}'`);
        return response.json();
    },

    async register(username: string, email: string, full_name: string, password: string): Promise<AuthResponse> {
        console.log(`[REGISTER] Attempting registration: username='${username}', email='${email}'`);

        let response: Response;
        try {
            response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, full_name, password }),
            });
        } catch (networkError: any) {
            console.error(`[REGISTER] NETWORK ERROR: ${networkError.message}`);
            throw new Error('Cannot connect to the server. Make sure the backend is running.');
        }

        if (!response.ok) {
            const detail = await extractErrorMessage(response, 'REGISTER');
            throw new Error(detail);
        }

        console.log(`[REGISTER] Success for username: '${username}'`);
        return response.json();
    },

    async logout(token: string): Promise<void> {
        await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    }
};
