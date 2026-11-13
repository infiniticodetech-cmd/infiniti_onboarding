import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API = `${API_BASE}/api`;

// ─── API HELPER ───────────────────────────────────────────────────────────────
async function request(path, opts = {}) {
  const r = await fetch(API + path, { credentials: 'include', ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}

// ─── DOCUMENT TYPES (Step 3) ──────────────────────────────────────────────────
const DOC_CONFIGS = [
  { key: 'pan',          label: 'PAN Card',                    required: true,  category: 'identity',    accept: '.pdf,.jpg,.jpeg,.png', hint: 'PDF, JPG or PNG', icon: '💳' },
  { key: 'identity',     label: 'Identity Proof',              required: true,  category: 'identity',    accept: '.pdf,.jpg,.jpeg,.png', hint: 'Aadhaar / Passport / Voter ID', icon: '🆔' },
  { key: 'photo',        label: 'Passport-size Photo',         required: true,  category: 'identity',    accept: '.jpg,.jpeg,.png',      hint: 'Recent formal photo (JPG/PNG)', icon: '📷' },
  { key: 'resume',       label: 'Resume / CV',                 required: true,  category: 'identity',    accept: '.pdf,.doc,.docx',      hint: 'Updated CV (PDF preferred)', icon: '📄' },
  { key: 'education',    label: 'Educational Certificates',    required: true,  category: 'employment',  accept: '.pdf,.jpg,.jpeg,.png', hint: 'Degree / provisional certificates', icon: '🎓' },
  { key: 'experienceDoc',label: 'Experience / Relieving Letter', required: true, category: 'employment', accept: '.pdf,.jpg,.jpeg,.png', hint: 'If applicable for experienced hires', icon: '💼' },
  { key: 'offer',        label: 'Signed Offer Letter',         required: false, category: 'employment',  accept: '.pdf,.jpg,.jpeg,.png', hint: 'Signed copy, if requested by HR', icon: '📑' },
  { key: 'bank',         label: 'Bank Proof',                  required: true, category: 'employment',  accept: '.pdf,.jpg,.jpeg,.png', hint: 'Cancelled cheque / passbook', icon: '🏦' },
];

function fmt(bytes) {
  if (!bytes) return '';
  const k = 1024, s = ['B','KB','MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${s[i]}`;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
}

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────
const UI_STATUS = {
  IN_PROGRESS:   { label: 'Draft',         color: 'var(--text-sub)',   bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' },
  SUBMITTED:     { label: 'Under Review',  color: '#fbbf24',           bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  APPROVED:      { label: 'Approved ✓',   color: '#34d399',           bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)' },
  UNDER_REVIEW:  { label: 'Under Review',  color: '#fbbf24',           bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  CHANGES_REQUESTED: { label: 'Under Review', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
  NOT_APPROVED:  { label: 'Not Approved',  color: '#f87171',           bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.35)' },
};

function StatusBadge({ status }) {
  const s = UI_STATUS[status] || UI_STATUS.IN_PROGRESS;
  return (
    <span style={{
      padding: '5px 14px', borderRadius: 20, fontSize: 11.5, fontWeight: 800,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`
    }}>
      {s.label}
    </span>
  );
}

// ─── LOGO HEADER ──────────────────────────────────────────────────────────────
function Header({ user, onLogout, portalLabel }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/logo.png" alt="Infiniti Code Technologies" className="company-logo" />
        <div className="brand-text">
          <span className="brand-name">Infiniti Code</span>
          <span className="brand-sub">TECHNOLOGIES PRIVATE LIMITED</span>
        </div>
      </div>
      <div className="top-right">
        <span className="secure-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Secure Portal
        </span>
        <span className="portal-tag">{portalLabel || 'Onboarding Portal'}</span>
        {user && (
          <div className="user-pill">
            <div className="avatar">{user.email?.slice(0,2).toUpperCase()}</div>
            <span className="user-email-text">{user.email}</span>
            <button className="btn-signout" onClick={onLogout}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW: LOGIN PAGE (HR Admin + Employee tabs)
// ═══════════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [tab, setTab] = useState('employee'); // 'employee' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const d = await request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      onLogin(d.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <Header portalLabel="Employee Onboarding" />
      <main className="login-center">
        <div className="login-hero">
          <img src="/logo.png" alt="Infiniti Code Technologies" className="login-logo" />
          <div className="eyebrow" style={{ marginTop: 20 }}>Welcome Back</div>
          <h1 className="login-headline">
            Your journey<br/>starts <em>here.</em>
          </h1>
          <p className="login-sub">
            Sign in to continue your onboarding journey or manage your team as an HR administrator.
          </p>
        </div>

        <div className="login-card">
          <div className="role-tabs">
            <button
              type="button"
              className={tab === 'employee' ? 'active' : ''}
              onClick={() => { setTab('employee'); setError(''); }}
            >
              👤 Employee
            </button>
            <button
              type="button"
              className={tab === 'admin' ? 'active' : ''}
              onClick={() => { setTab('admin'); setError(''); }}
            >
              🛡️ HR Admin
            </button>
          </div>

          <div className="login-form-head">
            <h2>{tab === 'admin' ? 'Administrator Sign In' : 'Employee Sign In'}</h2>
            <p>{tab === 'admin'
              ? 'Sign in to manage onboarding, invitations, and approvals.'
              : 'Sign in with the credentials you set when activating your invite.'
            }</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={tab === 'admin' ? 'info@infiniticodetech.com' : 'your@email.com'}
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Signing in...' : (tab === 'admin' ? 'Sign In as Administrator' : 'Sign In')}
            </button>
          </form>

          <div className="login-hint">
            New employee? Activate your account using the invitation link sent by HR.
          </div>
        </div>
      </main>
      <footer>© {new Date().getFullYear()} Infiniti Code Technologies Private Limited · All Rights Reserved</footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW: INVITATION ACTIVATION (employee opens invite link)
// ═══════════════════════════════════════════════════════════════════════════════
function ActivationPage({ token, onActivated }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleActivate(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const d = await request('/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      window.history.replaceState({}, '', window.location.pathname);
      onActivated(d.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <Header portalLabel="Account Activation" />
      <main className="login-center" style={{ gridTemplateColumns: '1fr', maxWidth: 480 }}>
        <div className="login-card" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/logo.png" alt="Infiniti Code Technologies" style={{ height: 56, margin: '0 auto 12px', display: 'block' }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Activate your account</h2>
            <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>
              Set a secure password to activate your Infiniti Code Technologies employee account and begin onboarding.
            </p>
          </div>

          <form onSubmit={handleActivate}>
            <div className="field">
              <label>Create password <em>*</em></label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>Confirm password <em>*</em></label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
                autoComplete="new-password"
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Activating...' : 'Activate Account & Continue →'}
            </button>
          </form>
        </div>
      </main>
      <footer>© {new Date().getFullYear()} Infiniti Code Technologies Private Limited</footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW: HR ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function AdminDashboard({ user, onLogout }) {
  const [view, setView] = useState('employees'); // 'employees' | 'invite'
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('/admin/employees');
      setEmployees(data);
    } catch (err) {
      setStatusMsg('Failed to load employees: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError('');
    setInviteUrl('');
    setInviting(true);
    try {
      const d = await request('/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail })
      });
      setInviteUrl(d.inviteUrl);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function updateStatus(id, uiStatus) {
    try {
      await request(`/admin/employees/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: uiStatus })
      });
      setStatusMsg(`Status updated to: ${UI_STATUS[uiStatus]?.label || uiStatus}`);
      await loadEmployees();
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      setStatusMsg('Error: ' + err.message);
    }
  }

  async function downloadDoc(doc) {
    try {
      const r = await request(`/admin/documents/${doc.id}`);
      const a = document.createElement('a');
      a.href = r.downloadUrl;
      a.download = r.fileName || doc.fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setStatusMsg('Download failed: ' + err.message);
    }
  }

  // Parse stored JSON from address field
  function parseProfile(emp) {
    let ext = {};
    try { if (emp.address?.startsWith('{')) ext = JSON.parse(emp.address); } catch {}
    return ext;
  }

  // Convert DB status to UI status key
  function getUiStatus(dbStatus) {
    const map = { SUBMITTED: 'SUBMITTED', APPROVED: 'APPROVED', CHANGES_REQUESTED: 'UNDER_REVIEW', IN_PROGRESS: 'IN_PROGRESS', INVITED: 'IN_PROGRESS' };
    return map[dbStatus] || dbStatus;
  }

  const stats = {
    total: employees.length,
    pending: employees.filter(e => e.status === 'SUBMITTED').length,
    approved: employees.filter(e => e.status === 'APPROVED').length,
    review: employees.filter(e => e.status === 'CHANGES_REQUESTED').length,
    draft: employees.filter(e => ['IN_PROGRESS','INVITED'].includes(e.status)).length,
  };

  return (
    <div className="shell">
      <Header user={user} onLogout={onLogout} portalLabel="HR Admin Portal" />

      <main className="admin-wrap">
        {/* ── SIDEBAR NAV ── */}
        <nav className="admin-nav">
          <div className="nav-logo-block">
            <div style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>
              HR Admin
            </div>
          </div>
          <button
            className={`nav-btn ${view === 'employees' ? 'active' : ''}`}
            onClick={() => setView('employees')}
          >
            <span>👥</span> Employee Applications
          </button>
          <button
            className={`nav-btn ${view === 'invite' ? 'active' : ''}`}
            onClick={() => setView('invite')}
          >
            <span>✉️</span> Create Invitation
          </button>
        </nav>

        {/* ── MAIN CONTENT ── */}
        <div className="admin-content">

          {/* ── CREATE INVITATION VIEW ── */}
          {view === 'invite' && (
            <div>
              <div className="page-header">
                <div className="eyebrow">HR Operations</div>
                <h1>Create Employee Invitation</h1>
                <p>Generate a secure one-time link to invite a new hire to begin their onboarding.</p>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: 6 }}>New Employee Invitation</h3>
                <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 20 }}>
                  Enter the new employee's email address. They will receive a secure activation link valid for 7 days.
                </p>

                <form onSubmit={handleInvite}>
                  <div className="field" style={{ maxWidth: 480 }}>
                    <label>Employee Email Address <em>*</em></label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="newemployee@example.com"
                      required
                    />
                  </div>
                  {inviteError && <div className="form-error" style={{ maxWidth: 480, marginBottom: 12 }}>{inviteError}</div>}
                  <button className="btn btn-primary" type="submit" disabled={inviting}>
                    {inviting ? 'Creating...' : '✉️ Create Invitation Link'}
                  </button>
                </form>

                {inviteUrl && (
                  <div className="invite-result">
                    <div className="invite-result-label">
                      <span style={{ color: '#34d399', fontWeight: 800 }}>✓ Invitation created!</span>
                      <span style={{ color: 'var(--text-sub)', fontSize: 12 }}>Link expires in 7 days</span>
                    </div>
                    <div className="invite-url-box">
                      <span className="invite-url-text">{inviteUrl}</span>
                      <button className="btn-copy" onClick={copyLink}>
                        {copied ? '✓ Copied!' : '📋 Copy Link'}
                      </button>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 10 }}>
                      Share this link securely with the employee via email or message. It can only be used once.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EMPLOYEE APPLICATIONS VIEW ── */}
          {view === 'employees' && (
            <div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div className="eyebrow">HR Operations</div>
                  <h1>Employee Applications</h1>
                  <p>Review submitted onboarding details and update application statuses.</p>
                </div>
                <button className="btn btn-ghost" onClick={loadEmployees} disabled={loading}>
                  {loading ? '⟳ Loading...' : '⟳ Refresh'}
                </button>
              </div>

              {/* Stats */}
              <div className="stats-grid">
                {[
                  { label: 'Total', value: stats.total, color: '#fff' },
                  { label: 'Submitted', value: stats.pending, color: '#fbbf24' },
                  { label: 'Approved', value: stats.approved, color: '#34d399' },
                  { label: 'Under Review', value: stats.review, color: '#60a5fa' },
                  { label: 'Draft', value: stats.draft, color: 'var(--text-sub)' },
                ].map(s => (
                  <div className="stat-card" key={s.label}>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {statusMsg && (
                <div className="toast" style={{ marginBottom: 16 }}>{statusMsg}</div>
              )}

              {loading ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>Loading applications...</div>
              ) : employees.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <h3>No applications yet</h3>
                  <p style={{ color: 'var(--text-sub)', marginTop: 8 }}>Invite employees to begin onboarding and their submissions will appear here.</p>
                  <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setView('invite')}>
                    Create Invitation
                  </button>
                </div>
              ) : (
                <div className="employee-list">
                  {employees.map(emp => {
                    const ext = parseProfile(emp);
                    const uiStatus = getUiStatus(emp.status);
                    const isExpanded = expandedId === emp.id;

                    return (
                      <div className="emp-card" key={emp.id}>
                        {/* Card header — always visible */}
                        <div className="emp-card-header" onClick={() => setExpandedId(isExpanded ? null : emp.id)}>
                          <div className="emp-avatar-name">
                            <div className="emp-avatar">
                              {(emp.fullName || emp.user?.email || '?').slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <div className="emp-name">{emp.fullName || <span style={{ color: 'var(--text-sub)' }}>Name not provided</span>}</div>
                              <div className="emp-email">{emp.user?.email}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <StatusBadge status={uiStatus} />
                            <span style={{ color: 'var(--text-sub)', fontSize: 18, userSelect: 'none' }}>
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </div>
                        </div>

                        {/* Expandable details */}
                        {isExpanded && (
                          <div className="emp-card-body">
                            {/* Info grid */}
                            <div className="emp-info-grid">
                              {[
                                ['Designation', emp.designation],
                                ['Department', ext.department],
                                ['Joining Date', fmtDate(emp.joiningDate)],
                                ['Phone', emp.phone],
                                ['Qualification', ext.qualification],
                                ['Experience', ext.experience],
                                ['Personal Email', ext.personalEmail],
                                ['Date of Birth', fmtDate(ext.dob)],
                                ['Gender', ext.gender],
                                ['Emergency Contact', ext.emergency],
                                ['Previous Employer', ext.employer],
                                ['Application ID', ext.employeeId],
                              ].map(([label, value]) => value ? (
                                <div className="emp-info-item" key={label}>
                                  <small>{label}</small>
                                  <span>{value}</span>
                                </div>
                              ) : null)}
                              {ext.address && (
                                <div className="emp-info-item" style={{ gridColumn: '1 / -1' }} key="address">
                                  <small>Residential Address</small>
                                  <span>{ext.address}</span>
                                </div>
                              )}
                            </div>

                            {/* Documents */}
                            <div className="emp-docs-section">
                              <div className="emp-docs-label">
                                📎 Uploaded Documents ({emp.documents?.length || 0})
                              </div>
                              {emp.documents?.length > 0 ? (
                                <div className="emp-doc-list">
                                  {emp.documents.map(doc => (
                                    <button
                                      key={doc.id}
                                      className="btn-doc"
                                      onClick={() => downloadDoc(doc)}
                                    >
                                      📄 {doc.fileName}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No documents uploaded yet.</span>
                              )}
                            </div>

                            {/* Status Actions */}
                            <div className="emp-actions">
                              <span style={{ fontSize: 12, color: 'var(--text-sub)', marginRight: 8 }}>Update Status:</span>
                              <button
                                className="btn btn-approve"
                                onClick={() => updateStatus(emp.id, 'APPROVED')}
                                disabled={uiStatus === 'APPROVED'}
                              >
                                ✓ Approve
                              </button>
                              <button
                                className="btn btn-review"
                                onClick={() => updateStatus(emp.id, 'UNDER_REVIEW')}
                                disabled={uiStatus === 'UNDER_REVIEW'}
                              >
                                👁 Under Reviewing
                              </button>
                              <button
                                className="btn btn-reject"
                                onClick={() => updateStatus(emp.id, 'NOT_APPROVED')}
                                disabled={uiStatus === 'NOT_APPROVED'}
                              >
                                ✕ Not Approved
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
      <footer>© {new Date().getFullYear()} Infiniti Code Technologies Private Limited · HR Operations Portal</footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW: EMPLOYEE ONBOARDING WIZARD (4-step form)
// ═══════════════════════════════════════════════════════════════════════════════
const STEP_NAMES = ['Personal details', 'Employment details', 'Upload documents', 'Review & submit'];

function OnboardingWizard({ user, onLogout, existingProfile }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [refId, setRefId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [profile, setProfile] = useState({
    name: '', email: user?.email || '', phone: '', dob: '', gender: '', emergency: '', address: '',
    employeeId: '', designation: '', department: '', joining: '', qualification: '', experience: '', employer: '',
    declaration: false
  });

  const [docFiles, setDocFiles] = useState({});

  // Prefill from existing profile if editing
  useEffect(() => {
    if (!existingProfile) return;
    let ext = {};
    try { if (existingProfile.address?.startsWith('{')) ext = JSON.parse(existingProfile.address); } catch {}

    setProfile(prev => ({
      ...prev,
      name: existingProfile.fullName || '',
      email: ext.personalEmail || user?.email || '',
      phone: existingProfile.phone || '',
      dob: ext.dob || '',
      gender: ext.gender || '',
      emergency: ext.emergency || '',
      address: ext.address || '',
      employeeId: ext.employeeId || '',
      designation: existingProfile.designation || '',
      department: ext.department || '',
      joining: existingProfile.joiningDate ? existingProfile.joiningDate.slice(0, 10) : '',
      qualification: ext.qualification || '',
      experience: ext.experience || '',
      employer: ext.employer || '',
    }));
  }, [existingProfile, user]);

  const p = (key, val) => setProfile(prev => ({ ...prev, [key]: val }));

  function validate() {
    setError('');
    if (step === 0) {
      if (!profile.name.trim()) return setError('Full name is required.'), false;
      if (!profile.email.trim() || !/\S+@\S+\.\S+/.test(profile.email)) return setError('Valid personal email is required.'), false;
      if (!profile.phone.trim()) return setError('Mobile number is required.'), false;
      if (!profile.dob) return setError('Date of birth is required.'), false;
      if (!profile.address.trim()) return setError('Residential address is required.'), false;
    }
    if (step === 1) {
      if (!profile.designation.trim()) return setError('Designation is required.'), false;
      if (!profile.joining) return setError('Date of joining is required.'), false;
      if (!profile.qualification.trim()) return setError('Highest qualification is required.'), false;
    }
    if (step === 2) {
      const miss = [];
      if (!docFiles.pan) miss.push('PAN Card');
      if (!docFiles.identity) miss.push('Identity Proof');
      if (!docFiles.photo) miss.push('Passport-size Photo');
      if (!docFiles.resume) miss.push('Resume / CV');
      if (!docFiles.education) miss.push('Educational Certificates');
      if (miss.length) return setError(`Please upload: ${miss.join(', ')}`), false;
    }
    if (step === 3) {
      if (!profile.declaration) return setError('Please accept the declaration before submitting.'), false;
    }
    return true;
  }

  async function handleNext() {
    if (!validate()) return;
    if (step < 3) { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    // Submit
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('profile', JSON.stringify({
        fullName: profile.name, name: profile.name,
        email: profile.email, phone: profile.phone,
        dob: profile.dob, gender: profile.gender,
        emergency: profile.emergency, address: profile.address,
        employeeId: profile.employeeId, designation: profile.designation,
        department: profile.department, joiningDate: profile.joining,
        joining: profile.joining, qualification: profile.qualification,
        experience: profile.experience, employer: profile.employer,
      }));

      Object.entries(docFiles).forEach(([key, file]) => {
        const f = new File([file], `${key}__${file.name}`, { type: file.type });
        fd.append('documents', f);
      });

      await request('/employee/submit', { method: 'POST', body: fd });
      setRefId(`ICT-ONB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="shell">
        <Header user={user} onLogout={onLogout} portalLabel="Employee Portal" />
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 24px' }}>
          <div className="success-screen">
            <div className="success-icon">✓</div>
            <h2>Submission Complete!</h2>
            <p>Your onboarding details and documents have been submitted to Infiniti Code Technologies HR team for review.</p>
            <div className="ref-box">{refId}</div>
            <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 28 }}>
              You will be notified once your application is reviewed. You can log back in anytime to check your status.
            </p>
            <button className="btn btn-ghost" onClick={onLogout}>Sign Out</button>
          </div>
        </main>
        <footer>© {new Date().getFullYear()} Infiniti Code Technologies Private Limited</footer>
      </div>
    );
  }

  return (
    <div className="shell">
      <Header user={user} onLogout={onLogout} portalLabel="Employee Portal" />
      <main className="onboarding-container">

        <div className="welcome-header">
          <div>
            <div className="eyebrow">Welcome Aboard</div>
            <h1>Employee Onboarding</h1>
            <p>Complete your joining formalities. It only takes a few minutes.</p>
          </div>
        </div>

        <div className="wizard-layout">
          {/* SIDEBAR */}
          <aside className="sidebar">
            <div className="side-title">Your onboarding checklist</div>
            <div className="side-sub">Complete each step to submit your details.</div>

            <div className="progress-header">
              <span>Overall progress</span>
              <strong>{Math.round(((step + 1) / 4) * 100)}%</strong>
            </div>
            <div className="progress-track">
              <div className="progress-bar-fill" style={{ width: `${((step + 1) / 4) * 100}%` }} />
            </div>

            <ul className="step-list">
              {STEP_NAMES.map((name, idx) => (
                <li
                  key={name}
                  className={`step-item ${idx === step ? 'active' : ''} ${idx < step ? 'done' : ''}`}
                  onClick={() => idx < step && (setStep(idx), setError(''))}
                  style={{ cursor: idx < step ? 'pointer' : 'default' }}
                >
                  <span className="step-dot">{idx < step ? '✓' : idx + 1}</span>
                  <span>{name}</span>
                </li>
              ))}
            </ul>

            <div className="help-box">
              <strong>Need help?</strong>
              Contact HR at <strong>hr@infiniticodetech.com</strong> if you have questions about the onboarding process.
            </div>
          </aside>

          {/* MAIN PANEL */}
          <section className="panel">

            {/* ── STEP 1: PERSONAL DETAILS ── */}
            {step === 0 && (
              <>
                <div className="panel-head">
                  <div><h2>Personal Information</h2><p>Enter your details as they appear on your official documents.</p></div>
                  <div className="required-badge"><b>*</b> Required</div>
                </div>
                <div className="section-label">Basic details</div>
                <div className="grid">
                  <div className="field"><label>Full name <em>*</em></label><input value={profile.name} onChange={e => p('name', e.target.value)} placeholder="As per official ID" required /></div>
                  <div className="field"><label>Personal email <em>*</em></label><input type="email" value={profile.email} onChange={e => p('email', e.target.value)} placeholder="you@example.com" required /></div>
                  <div className="field"><label>Mobile number <em>*</em></label><input type="tel" value={profile.phone} onChange={e => p('phone', e.target.value)} placeholder="+91 98765 43210" required /></div>
                  <div className="field"><label>Date of birth <em>*</em></label><input type="date" value={profile.dob} onChange={e => p('dob', e.target.value)} required /></div>
                  <div className="field"><label>Gender</label>
                    <select value={profile.gender} onChange={e => p('gender', e.target.value)}>
                      <option value="">Select gender</option>
                      <option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option>
                    </select>
                  </div>
                  <div className="field"><label>Emergency contact number</label><input type="tel" value={profile.emergency} onChange={e => p('emergency', e.target.value)} placeholder="Emergency contact" /></div>
                  <div className="field full"><label>Current residential address <em>*</em></label><textarea rows={2} value={profile.address} onChange={e => p('address', e.target.value)} placeholder="House / flat, street, area, city, state and PIN code" required /></div>
                </div>
                <div className="notice"><strong>Privacy note:</strong> Your information is accessible only to authorised HR personnel.</div>
              </>
            )}

            {/* ── STEP 2: EMPLOYMENT DETAILS ── */}
            {step === 1 && (
              <>
                <div className="panel-head">
                  <div><h2>Employment Information</h2><p>Confirm the role and joining details from your offer letter.</p></div>
                  <div className="required-badge"><b>*</b> Required</div>
                </div>
                <div className="section-label">Joining details</div>
                <div className="grid">
                  <div className="field"><label>Employee / Application ID</label><input value={profile.employeeId} onChange={e => p('employeeId', e.target.value)} placeholder="Provided by HR" /></div>
                  <div className="field"><label>Designation <em>*</em></label><input value={profile.designation} onChange={e => p('designation', e.target.value)} placeholder="e.g. Software Developer" required /></div>
                  <div className="field"><label>Department</label>
                    <select value={profile.department} onChange={e => p('department', e.target.value)}>
                      <option value="">Select department</option>
                      <option>Engineering</option><option>Web Development</option><option>Mobile App Development</option>
                      <option>Design</option><option>Business Development</option><option>Operations</option>
                    </select>
                  </div>
                  <div className="field"><label>Date of joining <em>*</em></label><input type="date" value={profile.joining} onChange={e => p('joining', e.target.value)} required /></div>
                  <div className="field"><label>Highest qualification <em>*</em></label><input value={profile.qualification} onChange={e => p('qualification', e.target.value)} placeholder="e.g. B.Tech, BCA, MBA" required /></div>
                  <div className="field"><label>Previous employment</label>
                    <select value={profile.experience} onChange={e => p('experience', e.target.value)}>
                      <option value="">Select</option><option>Fresher</option><option>Experienced</option>
                    </select>
                  </div>
                  <div className="field full"><label>Previous employer (if applicable)</label><input value={profile.employer} onChange={e => p('employer', e.target.value)} placeholder="Company name" /></div>
                </div>
                <div className="notice"><strong>Tip:</strong> Ensure your designation and joining date match your Infiniti Code Technologies offer letter.</div>
              </>
            )}

            {/* ── STEP 3: DOCUMENT UPLOADS ── */}
            {step === 2 && (
              <>
                <div className="panel-head">
                  <div><h2>Upload Documents</h2><p>Upload clear, readable copies. PDF, JPG or PNG accepted.</p></div>
                  <div className="required-badge"><b>*</b> Required</div>
                </div>

                {['identity', 'employment'].map(cat => (
                  <div key={cat}>
                    <div className="section-label">
                      {cat === 'identity' ? 'Identity & Profile' : 'Education & Employment'}
                    </div>
                    <div className="uploads-grid">
                      {DOC_CONFIGS.filter(d => d.category === cat).map(doc => {
                        const file = docFiles[doc.key];
                        return (
                          <label key={doc.key} className={`upload-card ${file ? 'has-file' : ''}`}>
                            <span className="upload-icon">{doc.icon}</span>
                            <span className="upload-info">
                              <strong>{doc.label} {doc.required && <b style={{ color: '#f43f5e' }}>*</b>}</strong>
                              <small>{file ? `${file.name} (${fmt(file.size)})` : doc.hint}</small>
                            </span>
                            <span className="upload-btn">{file ? '✓' : '+ Upload'}</span>
                            <input type="file" accept={doc.accept} onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) setDocFiles(prev => ({ ...prev, [doc.key]: f }));
                            }} />
                            {file && (
                              <button type="button" style={{ background: 'none', border: 0, color: '#f87171', fontSize: 13, cursor: 'pointer' }}
                                onClick={e => { e.preventDefault(); e.stopPropagation(); setDocFiles(prev => { const c = {...prev}; delete c[doc.key]; return c; }); }}>
                                ✕
                              </button>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="notice"><strong>Important:</strong> All files are stored in encrypted private storage accessible only to authorised HR personnel.</div>
              </>
            )}

            {/* ── STEP 4: REVIEW & DECLARATION ── */}
            {step === 3 && (
              <>
                <div className="panel-head">
                  <div><h2>Review & Declaration</h2><p>Review your details before submitting.</p></div>
                </div>
                <div className="notice" style={{ marginTop: 0 }}>
                  <strong>Before you submit:</strong> Ensure your details are accurate and all required documents are uploaded.
                </div>

                {/* Personal Summary */}
                <div className="review-card">
                  <div className="review-card-head">
                    <h4>Personal Details</h4>
                    <button className="btn-edit" onClick={() => setStep(0)}>✎ Edit</button>
                  </div>
                  <div className="review-grid">
                    {[['Full Name', profile.name], ['Personal Email', profile.email], ['Mobile', profile.phone], ['Date of Birth', fmtDate(profile.dob)], ['Gender', profile.gender], ['Emergency Contact', profile.emergency]].map(([l,v]) => v ? <div key={l} className="review-field"><small>{l}</small><span>{v}</span></div> : null)}
                    {profile.address && <div className="review-field" style={{ gridColumn: '1/-1' }}><small>Address</small><span>{profile.address}</span></div>}
                  </div>
                </div>

                {/* Employment Summary */}
                <div className="review-card">
                  <div className="review-card-head">
                    <h4>Employment Details</h4>
                    <button className="btn-edit" onClick={() => setStep(1)}>✎ Edit</button>
                  </div>
                  <div className="review-grid">
                    {[['App ID', profile.employeeId], ['Designation', profile.designation], ['Department', profile.department], ['Joining Date', fmtDate(profile.joining)], ['Qualification', profile.qualification], ['Experience', profile.experience], ['Previous Employer', profile.employer]].map(([l,v]) => v ? <div key={l} className="review-field"><small>{l}</small><span>{v}</span></div> : null)}
                  </div>
                </div>

                {/* Documents Summary */}
                <div className="review-card">
                  <div className="review-card-head">
                    <h4>Documents ({Object.keys(docFiles).length})</h4>
                    <button className="btn-edit" onClick={() => setStep(2)}>✎ Edit</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {DOC_CONFIGS.map(doc => docFiles[doc.key] ? (
                      <span key={doc.key} style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#bfdbfe', padding: '4px 10px', borderRadius: 8, fontSize: 11.5 }}>
                        ✓ {doc.label}
                      </span>
                    ) : null)}
                  </div>
                </div>

                {/* Declaration */}
                <div className="section-label">Declaration</div>
                <div className="declaration-box">
                  <label className="declaration-label">
                    <input type="checkbox" checked={profile.declaration} onChange={e => p('declaration', e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: '#a855f7', cursor: 'pointer', flex: 'none' }} />
                    <span>I confirm that the information and documents provided by me are true and correct to the best of my knowledge. I understand that HR may contact me if any clarification is needed.</span>
                  </label>
                </div>
              </>
            )}

            {/* Error message */}
            {error && <div className="form-error" style={{ marginTop: 16 }}>{error}</div>}

            {/* Navigation */}
            <div className="wizard-actions">
              <button className="btn btn-ghost" onClick={() => { setStep(s => s - 1); setError(''); }} disabled={step === 0 || submitting}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={handleNext} disabled={submitting}>
                {submitting ? 'Submitting...' : step === 3 ? 'Submit Onboarding →' : 'Continue →'}
              </button>
            </div>
          </section>
        </div>
      </main>
      <footer>© {new Date().getFullYear()} Infiniti Code Technologies Private Limited · Employee Onboarding Portal</footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW: EMPLOYEE DASHBOARD (view/edit own profile + status)
// ═══════════════════════════════════════════════════════════════════════════════
function EmployeeDashboard({ user, onLogout }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const d = await request('/employee/profile');
      setProfileData(d.profile);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (loading) {
    return (
      <div className="shell">
        <Header user={user} onLogout={onLogout} portalLabel="Employee Portal" />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-sub)' }}>Loading your profile...</p>
        </main>
      </div>
    );
  }

  // If no submission yet, or they want to edit → show wizard
  if (!profileData || profileData.status === 'IN_PROGRESS' || editing) {
    return <OnboardingWizard user={user} onLogout={onLogout} existingProfile={profileData} />;
  }

  // Show status view
  const uiStatusMap = {
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    CHANGES_REQUESTED: 'UNDER_REVIEW',
    IN_PROGRESS: 'IN_PROGRESS',
    INVITED: 'IN_PROGRESS'
  };
  const uiStatus = uiStatusMap[profileData.status] || profileData.status;
  let ext = {};
  try { if (profileData.address?.startsWith('{')) ext = JSON.parse(profileData.address); } catch {}

  const statusMessages = {
    SUBMITTED: 'Your onboarding application has been submitted and is awaiting HR review.',
    APPROVED: 'Congratulations! Your onboarding application has been approved.',
    UNDER_REVIEW: 'Your application is currently under review by the HR team. They may contact you for additional information.',
    NOT_APPROVED: 'Your application requires changes. Please contact HR for details and resubmit.',
    IN_PROGRESS: 'Your application is in progress.'
  };

  return (
    <div className="shell">
      <Header user={user} onLogout={onLogout} portalLabel="Employee Portal" />
      <main className="onboarding-container" style={{ maxWidth: 800 }}>

        <div className="welcome-header" style={{ marginBottom: 24 }}>
          <div>
            <div className="eyebrow">My Profile</div>
            <h1>Onboarding Status</h1>
          </div>
          <StatusBadge status={uiStatus} />
        </div>

        {/* Status banner */}
        <div className="card" style={{
          background: uiStatus === 'APPROVED' ? 'rgba(16,185,129,0.08)' : uiStatus === 'UNDER_REVIEW' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)',
          borderColor: uiStatus === 'APPROVED' ? 'rgba(16,185,129,0.3)' : uiStatus === 'UNDER_REVIEW' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)',
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 32 }}>
              {uiStatus === 'APPROVED' ? '🎉' : uiStatus === 'UNDER_REVIEW' ? '👁️' : uiStatus === 'SUBMITTED' ? '⏳' : '📋'}
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#fff', marginBottom: 4 }}><StatusBadge status={uiStatus} /></div>
              <p style={{ color: 'var(--text-sub)', fontSize: 13, margin: '8px 0 0' }}>{statusMessages[uiStatus] || ''}</p>
            </div>
          </div>
        </div>

        {/* Profile summary */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 14 }}>
            <h3 style={{ color: '#fff', margin: 0 }}>Submitted Details</h3>
            <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => setEditing(true)}>
              ✎ Edit & Resubmit
            </button>
          </div>

          <div className="review-grid">
            {[
              ['Full Name', profileData.fullName],
              ['Personal Email', ext.personalEmail],
              ['Mobile', profileData.phone],
              ['Date of Birth', fmtDate(ext.dob)],
              ['Gender', ext.gender],
              ['Emergency Contact', ext.emergency],
              ['Designation', profileData.designation],
              ['Department', ext.department],
              ['Joining Date', fmtDate(profileData.joiningDate)],
              ['Qualification', ext.qualification],
              ['Experience', ext.experience],
              ['Employee ID', ext.employeeId],
              ['Previous Employer', ext.employer],
            ].filter(([,v]) => v).map(([label, value]) => (
              <div key={label} className="review-field">
                <small>{label}</small>
                <span>{value}</span>
              </div>
            ))}
            {ext.address && (
              <div className="review-field" style={{ gridColumn: '1 / -1' }}>
                <small>Residential Address</small>
                <span>{ext.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="card">
          <h3 style={{ color: '#fff', marginBottom: 14 }}>Uploaded Documents ({profileData.documents?.length || 0})</h3>
          {profileData.documents?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {profileData.documents.map(doc => (
                <span key={doc.id} style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#bfdbfe', padding: '6px 12px', borderRadius: 8, fontSize: 12 }}>
                  📄 {doc.fileName}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No documents uploaded yet.</p>
          )}
        </div>
      </main>
      <footer>© {new Date().getFullYear()} Infiniti Code Technologies Private Limited · Employee Portal</footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — routing between views
// ═══════════════════════════════════════════════════════════════════════════════
function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const inviteToken = new URLSearchParams(window.location.search).get('invite');

  // Restore session on load
  useEffect(() => {
    request('/auth/me')
      .then(d => { if (d?.user) setUser(d.user); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function handleLogout() {
    try { await request('/auth/logout', { method: 'POST' }); } catch {}
    setUser(null);
  }

  if (checking) {
    return (
      <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-sub)' }}>
          <img src="/logo.png" alt="Infiniti Code Technologies" style={{ height: 56, marginBottom: 16 }} />
          <p>Loading portal...</p>
        </div>
      </div>
    );
  }

  // 1. Invitation activation flow (employee opens invite link)
  if (inviteToken && !user) {
    return <ActivationPage token={inviteToken} onActivated={u => setUser(u)} />;
  }

  // 2. Not logged in → Login page
  if (!user) {
    return <LoginPage onLogin={u => setUser(u)} />;
  }

  // 3. HR Admin → Admin Dashboard
  if (user.role === 'ADMIN') {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  // 4. Employee → Employee Dashboard (which shows wizard if no submission yet)
  return <EmployeeDashboard user={user} onLogout={handleLogout} />;
}

createRoot(document.getElementById('root')).render(<App />);
