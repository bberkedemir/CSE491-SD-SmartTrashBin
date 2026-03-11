import React, { useState } from 'react';
import { authApi } from '../../api/authApi';
import '../auth.css';

export default function RegisterPage() {
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
      const response = await authApi.register(username, email, fullName, password);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      window.location.href = '/';
    } catch (err: any) {
      setError('Registration failed. Username or email may already be taken.');
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
        <h1>Register</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleRegister} autoComplete="off">
          <div className="auth-field">
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

          <div className="auth-field">
            <input
              className="auth-input"
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <input
              className="auth-input"
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <select className="auth-input" disabled value="truck_driver">
              <option value="truck_driver">Truck Driver</option>
            </select>
            <p className="auth-role-help">New accounts are registered as Truck Driver by default.</p>
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
                Creating account…
              </span>
            ) : 'Register'}
          </button>
        </form>

        <div className="auth-link-row">
          Already have an account?
          <a href="/login">Log In</a>
        </div>
      </div>
    </div>
  );
}
