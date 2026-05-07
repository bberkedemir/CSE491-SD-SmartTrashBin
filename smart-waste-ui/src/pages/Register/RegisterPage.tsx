import React, { useState } from 'react';
import { useAuth } from '../../context/AuthProvider';
import { useNavigate } from 'react-router-dom';
import '../auth.css';
import logoPng from '../../assets/logo.png';

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
      console.error(`[RegisterPage] Registration error:`, err?.message || err);
      setError('Registration failed. Username or email may already be taken.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-blob blob-1"></div>
      <div className="auth-blob blob-2"></div>

      <div className="auth-split-card">
        {/* Colored Left Panel for switching to Login */}
        <div className="auth-panel-colored">
          <h2>Welcome Back!</h2>
          <p>To keep connected with us please login with your personal info.</p>
          <button className="auth-ghost-btn" onClick={() => navigate('/login')} type="button">
            SIGN IN
          </button>
        </div>

        {/* White Right Panel for Registering */}
        <div className="auth-panel-white">
          <div className="auth-logo-wrapper">
            <img src={logoPng} alt="SmartTrashBin" className="auth-logo-img" />
          </div>
          <h1>Create Account</h1>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleRegister} autoComplete="off" className="auth-form">
            <div className="auth-input-group">
              <input
                className="auth-input"
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="auth-input-group">
              <input
                className="auth-input"
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-input-group">
              <input
                className="auth-input"
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
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
              {loading ? 'Creating account...' : 'SIGN UP'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
