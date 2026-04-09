import React, { useState } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { useNavigate } from 'react-router-dom';
import '../auth.css';
import logoPng from '../../assets/logo.png';

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
            console.error(`[LoginPage] Login error:`, err?.message || err);
            setError('Invalid username or password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-root">
            <div className="auth-blob blob-1"></div>
            <div className="auth-blob blob-2"></div>
            
            <div className="auth-split-card">
                {/* Colored Left Panel */}
                <div className="auth-panel-colored">
                    <h2>New Here?</h2>
                    <p>Sign up and discover a smarter way to manage waste with us.</p>
                    <button className="auth-ghost-btn" onClick={() => navigate('/register')} type="button">
                        SIGN UP
                    </button>
                </div>
                
                {/* White Right Panel for Login */}
                <div className="auth-panel-white">
                    <div className="auth-logo-wrapper">
                        <img src={logoPng} alt="SmartTrashBin" className="auth-logo-img" />
                    </div>
                    <h1>Sign In</h1>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={handleLogin} autoComplete="off" className="auth-form">
                        <div className="auth-input-group">
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

                        <div className="auth-input-group">
                            <input
                                className="auth-input"
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button className="auth-main-btn" type="submit" disabled={loading}>
                            {loading ? 'Signing in...' : 'SIGN IN'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
