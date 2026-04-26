import React, { useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { useNavigate } from 'react-router-dom';
import logoPng from '../assets/logo.png';

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register(username, email, fullName, password);
            navigate('/', { replace: true });
        } catch (err: any) {
            setError(err?.message || 'Registration failed. Please try again.');
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
                <h1>Driver Sign Up</h1>
                <p className="auth-subtitle">Register as Truck Driver</p>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleRegister} autoComplete="off">
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
                        <span className="input-icon">@</span>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <span className="input-icon">N</span>
                        <input
                            type="text"
                            placeholder="Full Name"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            required
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
                        {loading ? 'Registering...' : 'SIGN UP'}
                    </button>
                </form>

                <p className="auth-link">
                    Already have an account?{' '}
                    <span onClick={() => navigate('/login')}>Sign In</span>
                </p>
            </div>
        </div>
    );
}
