import { useState } from 'react';
import { Icon, authenticate, DEMO_USERS } from '../../shared/shared.jsx';
import './Login.css';

export default function Login({ onLogin }) {
  const [role,     setRole]     = useState('clinician');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');

  /* Pre-fill demo credentials when switching tabs */
  function handleRoleSwitch(r) {
    setRole(r);
    setError('');
    const demo = DEMO_USERS.find(u => u.role === (r === 'clinician' ? 'doctor' : 'patient'));
    setEmail(demo.email);
    setPassword(demo.password);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const user = authenticate(email.trim(), password);
    if (!user) { setError('Invalid email or password. Please try again.'); return; }
    if (role === 'clinician' && user.role !== 'doctor') {
      setError('This account does not have clinician access.'); return;
    }
    if (role === 'patient' && user.role !== 'patient') {
      setError('This account does not have patient access.'); return;
    }
    onLogin(user);
  }

  const demo = DEMO_USERS.find(u => u.role === (role === 'clinician' ? 'doctor' : 'patient'));

  return (
    <div className="login-shell">
      <nav className="login-topbar">
        <Icon.Logo size={22} />
        <div>
          <div className="login-topbar-name">Recover<span>AI</span></div>
          <div className="login-topbar-tag">Rehabilitation Intelligence Platform</div>
        </div>
      </nav>

      <main className="login-main">
        <div className="login-card">
          <div className="login-card-header">
            <h1>Sign In to RecoverAI</h1>
            <p>Select your role and enter your credentials to continue</p>
          </div>

          {/* Role selector tabs */}
          <div className="role-tabs">
            <div
              className={`role-tab clinician ${role === 'clinician' ? 'active' : ''}`}
              onClick={() => handleRoleSwitch('clinician')}
            >
              <div className="role-tab-icon">
                <Icon.Clipboard size={18} />
              </div>
              <div className="role-tab-label">Clinician / Therapist</div>
            </div>
            <div
              className={`role-tab patient ${role === 'patient' ? 'active' : ''}`}
              onClick={() => handleRoleSwitch('patient')}
            >
              <div className="role-tab-icon">
                <Icon.Heart size={18} />
              </div>
              <div className="role-tab-label">Patient</div>
            </div>
          </div>

          {/* Form */}
          <form className="login-form" onSubmit={handleSubmit}>
            {/* Demo hint */}
            <div className="demo-hint">
              <strong>Demo account —</strong> Email: <strong>{demo.email}</strong> &nbsp;·&nbsp;
              Password: <strong>{demo.password}</strong>
            </div>

            <div className="form-group">
              <label className="form-label"><Icon.User size={13} />Email address</label>
              <div className="form-input-wrap">
                <span className="form-input-icon"><Icon.User size={14} /></span>
                <input
                  className="form-input"
                  type="email"
                  placeholder={demo.email}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label"><Icon.Lock size={13} />Password</label>
              <div className="form-input-wrap">
                <span className="form-input-icon"><Icon.Lock size={14} /></span>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="login-error">
                <Icon.Alert size={13} />
                {error}
              </div>
            )}

            <button className="login-submit" type="submit">
              <Icon.ArrowRight size={14} />
              Sign In as {role === 'clinician' ? 'Clinician' : 'Patient'}
            </button>
          </form>

          <div className="login-footer">
            RecoverAI v1.0 &nbsp;·&nbsp; Congressional App Challenge 2026–27 &nbsp;·&nbsp; Demo environment — no real patient data
          </div>
        </div>
      </main>
    </div>
  );
}
