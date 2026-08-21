import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, User, ArrowRight, ShieldCheck, UserPlus } from 'lucide-react';

const Login: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  // Initialize mock credentials db on mount
  useEffect(() => {
    const existingUsers = localStorage.getItem('audit_users_db');
    if (!existingUsers) {
      const defaultUsers = [
        { username: 'admin', password: 'admin123' },
        { username: 'engineer', password: 'engineer123' },
      ];
      localStorage.setItem('audit_users_db', JSON.stringify(defaultUsers));
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg('Username and password are required.');
      return;
    }

    if (isSignUp) {
      // Sign Up Mode
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }

      try {
        const response = await fetch('http://localhost:5081/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setErrorMsg(errorData.message || 'Failed to create account.');
          return;
        }

        setSuccessMsg('Account created successfully! Switching to Login...');
        setTimeout(() => {
          setIsSignUp(false);
          setPassword('');
          setConfirmPassword('');
          setSuccessMsg('');
        }, 1500);
      } catch (err) {
        setErrorMsg('Failed to connect to the authentication server.');
      }
    } else {
      // Log In Mode
      try {
        const response = await fetch('http://localhost:5081/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password: password.trim() }),
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setErrorMsg(errorData.message || 'Invalid username or password.');
          return;
        }

        const data = await response.json();
        const uniqueSessionId = crypto.randomUUID(); 
        
        localStorage.setItem('audit_active_user', data.username);
        localStorage.setItem('audit_session_id', uniqueSessionId);
        navigate('/');
      } catch (err) {
        setErrorMsg('Failed to connect to the authentication server.');
      }
    }
  };

  return (
    <div
      className="app-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-dark)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px', padding: '16px' }}>
        {/* Brand Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '12px',
              borderRadius: '50%',
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid var(--accent-purple)',
              marginBottom: '12px',
              boxShadow: '0 0 15px rgba(168, 85, 247, 0.2)',
            }}
          >
            <Shield size={32} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary)',
            }}
          >
            Audit Trail Gateway
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Secure Portal Verification System
          </p>
        </div>

        {/* Login/Signup Card */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isSignUp ? <UserPlus size={16} /> : <ShieldCheck size={16} />}
            {isSignUp ? 'Create Admin Account' : 'Security Sign In'}
          </h2>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--status-failed-bg)',
                  border: '1px solid var(--status-failed)',
                  color: 'var(--status-failed)',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--status-success-bg)',
                  border: '1px solid var(--status-success)',
                  color: 'var(--status-success)',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {successMsg}
              </div>
            )}

            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={12} /> Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={12} /> Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter password"
                required
              />
            </div>

            {isSignUp && (
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={12} /> Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="Confirm password"
                  required
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px', marginTop: '8px' }}>
              {isSignUp ? 'Register Account' : 'Access Dashboard'}
              <ArrowRight size={14} />
            </button>
          </form>

          <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '24px 0' }} />

          <div style={{ textAlign: 'center', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
                setSuccessMsg('');
                setUsername('');
                setPassword('');
                setConfirmPassword('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-purple)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>

        {/* Demo hints */}
        {!isSignUp && (
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <p>Demo credentials available:</p>
            <span style={{ color: 'var(--text-primary)' }}>admin</span> / <span>admin123</span> or{' '}
            <span style={{ color: 'var(--text-primary)' }}>engineer</span> / <span>engineer123</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
