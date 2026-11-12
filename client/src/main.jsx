
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = '/api';

function App() {
  const [inviteToken, setInviteToken] = useState(
    () => new URLSearchParams(window.location.search).get('invite')
  );

  const [mode, setMode] = useState('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [profile, setProfile] = useState({
    fullName: '',
    phone: '',
    address: '',
    designation: '',
    joiningDate: ''
  });

  const [files, setFiles] = useState([]);

  async function request(path, opts = {}) {
    const r = await fetch(API + path, {
      credentials: 'include',
      ...opts
    });

    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      throw Error(d.error || 'Request failed');
    }

    return d;
  }

  // Load employee applications for HR Admin
  async function loadEmployees() {
    setLoadingEmployees(true);

    try {
      const data = await request('/admin/employees');
      setEmployees(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoadingEmployees(false);
    }
  }

  // Automatically load employees after Admin login
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadEmployees();
    }
  }, [user]);

  async function login(e) {
    e.preventDefault();

    try {
      const d = await request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      setUser(d.user);
      setPassword('');
      setMessage('Signed in successfully.');
    } catch (x) {
      setMessage(x.message);
    }
  }

  async function activate(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    try {
      const d = await request('/auth/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: inviteToken,
          password
        })
      });

      setUser(d.user);
      setInviteToken(null);
      setPassword('');
      setConfirmPassword('');

      window.history.replaceState(
        {},
        '',
        window.location.pathname
      );

      setMessage(
        'Your account is activated. Welcome to Infiniti Code!'
      );
    } catch (x) {
      setMessage(x.message);
    }
  }

  async function save(e) {
    e.preventDefault();

    try {
      const fd = new FormData();

      fd.append('profile', JSON.stringify(profile));

      files.forEach(file => {
        fd.append('documents', file);
      });

      await request('/employee/submit', {
        method: 'POST',
        body: fd
      });

      setFiles([]);

      setMessage(
        'Your onboarding information has been submitted for HR review.'
      );
    } catch (x) {
      setMessage(x.message);
    }
  }

  async function invite(e) {
    e.preventDefault();

    try {
      const d = await request('/admin/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      setMessage(
        'Invitation created. Share this one-time link securely: ' +
        d.inviteUrl
      );

      setEmail('');
    } catch (x) {
      setMessage(x.message);
    }
  }

  // Approve or request changes
  async function updateStatus(id, status) {
    const confirmation =
      status === 'APPROVED'
        ? 'Approve this employee application?'
        : 'Request changes to this employee application?';

    if (!window.confirm(confirmation)) return;

    try {
      await request(`/admin/employees/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      setMessage(
        status === 'APPROVED'
          ? 'Employee application approved.'
          : 'Changes requested successfully.'
      );

      await loadEmployees();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function logout() {
    try {
      await request('/auth/logout', {
        method: 'POST'
      });

      setUser(null);
      setEmployees([]);
      setMessage('Signed out successfully.');
    } catch (x) {
      setMessage(x.message);
    }
  }

  function formatDate(date) {
    if (!date) return 'Not provided';

    return new Date(date).toLocaleDateString('en-IN');
  }

  function statusLabel(status) {
    const labels = {
      SUBMITTED: 'Pending Review',
      APPROVED: 'Approved',
      CHANGES_REQUESTED: 'Changes Requested'
    };

    return labels[status] || status || 'Unknown';
  }

  return (
    <div className="shell">

      <header>
        <div className="mark">∞</div>

        <div>
          <b>INFINITI CODE</b>
          <small>TECHNOLOGIES PRIVATE LIMITED</small>
        </div>

        <span className="tag">EMPLOYEE ONBOARDING</span>
      </header>

      <main>

        <section className="hero">
          <p className="eyebrow">WELCOME ABOARD</p>

          <h1>
            Your journey<br />
            starts <em>here.</em>
          </h1>

          <p>
            Complete your onboarding details and submit
            the required documents securely to our HR team.
          </p>
        </section>

        <section className="panel">

          {/* EMPLOYEE ACCOUNT ACTIVATION */}

          {inviteToken && !user ? (

            <form onSubmit={activate}>
              <h2>Activate your employee account</h2>

              <p className="hint">
                Create a password to activate your invitation.
                Your password must contain at least 12 characters.
              </p>

              <label>Create password</label>

              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={12}
                required
                autoComplete="new-password"
              />

              <label>Confirm password</label>

              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                minLength={12}
                required
                autoComplete="new-password"
              />

              <button className="primary" type="submit">
                Activate account
              </button>
            </form>

          ) : (

            <>

              {/* LOGIN TABS */}

              {!user && (
                <div className="tabs">

                  <button
                    type="button"
                    className={mode === 'employee' ? 'active' : ''}
                    onClick={() => {
                      setMode('employee');
                      setMessage('');
                    }}
                  >
                    Employee
                  </button>

                  <button
                    type="button"
                    className={mode === 'admin' ? 'active' : ''}
                    onClick={() => {
                      setMode('admin');
                      setMessage('');
                    }}
                  >
                    HR Admin
                  </button>

                </div>
              )}

              {/* LOGIN */}

              {!user ? (

                <form onSubmit={login}>

                  <h2>
                    {mode === 'admin'
                      ? 'Administrator sign in'
                      : 'Employee sign in'}
                  </h2>

                  <label>Email address</label>

                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />

                  <label>Password</label>

                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />

                  <button className="primary" type="submit">
                    Sign in
                  </button>

                  <p className="hint">
                    Employees must first activate their account
                    using the invitation link provided by HR.
                  </p>

                </form>

              ) : (

                <div>

                  {/* HR ADMIN DASHBOARD */}

                  {user.role === 'ADMIN' ? (

                    <div className="admin-dashboard">

                      <h2>HR Admin Dashboard</h2>

                      <p className="hint">
                        Manage employee invitations and onboarding applications.
                      </p>

                      {/* INVITATION SECTION */}

                      <div className="admin-section">

                        <h3>Invite New Employee</h3>

                        <form onSubmit={invite}>

                          <label>Employee email address</label>

                          <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="employee@example.com"
                            required
                          />

                          <button className="primary" type="submit">
                            Create Invitation
                          </button>

                        </form>

                      </div>

                      {/* EMPLOYEE APPLICATIONS */}

                      <div className="admin-section">

                        <div className="section-heading">

                          <h3>Employee Applications</h3>

                          <button
                            type="button"
                            className="secondary"
                            onClick={loadEmployees}
                            disabled={loadingEmployees}
                          >
                            {loadingEmployees ? 'Loading...' : 'Refresh'}
                          </button>

                        </div>

                        {loadingEmployees ? (

                          <p>Loading employee applications...</p>

                        ) : employees.length === 0 ? (

                          <p className="hint">
                            No employee applications found.
                          </p>

                        ) : (

                          <div className="employee-list">

                            {employees.map(employee => (

                              <div
                                className="employee-card"
                                key={employee.id}
                              >

                                <h3>
                                  {employee.fullName || 'Unnamed Employee'}
                                </h3>

                                <p>
                                  <strong>Email:</strong>{' '}
                                  {employee.user?.email || 'Not available'}
                                </p>

                                <p>
                                  <strong>Phone:</strong>{' '}
                                  {employee.phone || 'Not provided'}
                                </p>

                                <p>
                                  <strong>Designation:</strong>{' '}
                                  {employee.designation || 'Not provided'}
                                </p>

                                <p>
                                  <strong>Address:</strong>{' '}
                                  {employee.address || 'Not provided'}
                                </p>

                                <p>
                                  <strong>Joining Date:</strong>{' '}
                                  {formatDate(employee.joiningDate)}
                                </p>

                                <p>
                                  <strong>Status:</strong>{' '}
                                  <span className="status">
                                    {statusLabel(employee.status)}
                                  </span>
                                </p>

                                {/* DOCUMENTS */}

                                <div className="documents">

                                  <strong>Uploaded Documents</strong>

                                  {employee.documents?.length > 0 ? (

                                    employee.documents.map(doc => (

                                      <p key={doc.id}>

                                        <a
                                          href={`${API}/admin/documents/${doc.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          {doc.fileName} — Download
                                        </a>

                                      </p>

                                    ))

                                  ) : (

                                    <p className="hint">
                                      No documents uploaded.
                                    </p>

                                  )}

                                </div>

                                {/* REVIEW ACTIONS */}

                                {employee.status === 'SUBMITTED' && (

                                  <div className="review-actions">

                                    <button
                                      type="button"
                                      className="primary"
                                      onClick={() =>
                                        updateStatus(
                                          employee.id,
                                          'APPROVED'
                                        )
                                      }
                                    >
                                      Approve
                                    </button>

                                    <button
                                      type="button"
                                      className="secondary"
                                      onClick={() =>
                                        updateStatus(
                                          employee.id,
                                          'CHANGES_REQUESTED'
                                        )
                                      }
                                    >
                                      Request Changes
                                    </button>

                                  </div>

                                )}

                              </div>

                            ))}

                          </div>

                        )}

                      </div>

                    </div>

                  ) : (

                    /* EMPLOYEE ONBOARDING FORM */

                    <div>

                      <h2>Your Onboarding</h2>

                      <form onSubmit={save}>

                        <label>Full name</label>

                        <input
                          required
                          value={profile.fullName}
                          onChange={e =>
                            setProfile({
                              ...profile,
                              fullName: e.target.value
                            })
                          }
                        />

                        <label>Phone</label>

                        <input
                          value={profile.phone}
                          onChange={e =>
                            setProfile({
                              ...profile,
                              phone: e.target.value
                            })
                          }
                        />

                        <label>Address</label>

                        <textarea
                          value={profile.address}
                          onChange={e =>
                            setProfile({
                              ...profile,
                              address: e.target.value
                            })
                          }
                        />

                        <label>Designation</label>

                        <input
                          value={profile.designation}
                          onChange={e =>
                            setProfile({
                              ...profile,
                              designation: e.target.value
                            })
                          }
                        />

                        <label>Joining date</label>

                        <input
                          type="date"
                          value={profile.joiningDate}
                          onChange={e =>
                            setProfile({
                              ...profile,
                              joiningDate: e.target.value
                            })
                          }
                        />

                        <label>Upload documents</label>

                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          multiple
                          onChange={e =>
                            setFiles(Array.from(e.target.files))
                          }
                        />

                        <p className="hint">
                          Maximum 5 files, 5 MB each.
                        </p>

                        <button className="primary" type="submit">
                          Submit Onboarding
                        </button>

                      </form>

                    </div>

                  )}

                  <button
                    className="secondary"
                    type="button"
                    onClick={logout}
                  >
                    Sign out
                  </button>

                </div>

              )}

            </>

          )}

          {message && (
            <div className="message">
              {message}
            </div>
          )}

        </section>

      </main>

      <footer>
        © {new Date().getFullYear()} Infiniti Code Technologies Private Limited
      </footer>

    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
