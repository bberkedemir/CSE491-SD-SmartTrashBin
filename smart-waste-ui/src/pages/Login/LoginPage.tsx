import React, { useState } from 'react';
import { authApi } from '../../api/authApi';
import '../auth.css';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await authApi.login(username, password);
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            window.location.href = '/';
        } catch (err: any) {
            setError('Invalid username or password. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-root">
            {/* Background decorative dots */}
            <span className="auth-deco" style={{ top: '8%', left: '12%' }}>+</span>
            <span className="auth-deco" style={{ top: '15%', right: '10%' }}>+</span>
            <span className="auth-deco" style={{ bottom: '20%', left: '7%' }}>○</span>
            <span className="auth-deco" style={{ bottom: '10%', right: '15%' }}>+</span>
            <span className="auth-deco" style={{ top: '55%', left: '4%' }}>○</span>
            <span className="auth-deco" style={{ top: '40%', right: '5%' }}>+</span>

            {/* Logo */}
            <div className="auth-logo">
                <div className="auth-logo-icon">S</div>
                <div className="auth-logo-text">
                    Smart<span>TrashBin</span>
                </div>
            </div>

            {/* Card */}
            <div className="auth-card">
                <h1>Log In</h1>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleLogin} autoComplete="off">
                    <div className="auth-field">
                        <input
                            className="auth-input"
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="auth-field">
                        <input
                            className="auth-input"
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button className="auth-btn" type="submit" disabled={loading}>
                        {loading ? (
                            <span className="auth-btn-loading">
                                <span className="auth-spinner" />
                                Signing in…
                            </span>
                        ) : 'Log In'}
                    </button>
                </form>
                <div className="auth-link-row">
                    Don't have an account?
                    <a href="/register">Register</a>
                </div>
            </div>
        </div>
    );
}
