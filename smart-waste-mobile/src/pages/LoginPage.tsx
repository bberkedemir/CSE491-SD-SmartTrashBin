import React, { useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useNavigate } from 'react-router-dom';
import logoPng from '../assets/logo.png';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            navigate('/', { replace: true });
        } catch (err: any) {
            setError(err?.message || 'Giris basarisiz. Tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <img src={logoPng} alt="SmartWaste" />
                </div>
                <h1>Driver Sign In</h1>
                <p className="auth-subtitle">Smart Waste Collection</p>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleLogin} autoComplete="off">
                    <div className="input-group">
                        <span className="input-icon">U</span>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="input-group">
                        <span className="input-icon">P</span>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button className="btn-primary" type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'SIGN IN'}
                    </button>
                </form>

                <p className="auth-link">
                    Don't have an account?{' '}
                    <span onClick={() => navigate('/register')}>Sign Up</span>
                </p>
            </div>
        </div>
    );
}
