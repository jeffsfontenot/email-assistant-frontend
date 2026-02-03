import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [view, setView] = useState('login'); // login, settings, emails
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [emails, setEmails] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [deleteQueue, setDeleteQueue] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [checkInterval, setCheckInterval] = useState('12'); // hours

  // Load user data from localStorage or URL on mount
  useEffect(() => {
    // Check URL for auth token (after OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const email = urlParams.get('email');
    
    if (token && email) {
      // New login from OAuth
      const userData = { token, email };
      localStorage.setItem('emailAssistantUser', JSON.stringify(userData));
      setUser(userData);
      setView('emails');
      // Clean URL
      window.history.replaceState({}, document.title, '/');
      fetchAccounts(userData);
      fetchEmails(userData);
    } else {
      // Check for existing session
      const savedUser = localStorage.getItem('emailAssistantUser');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setView('emails');
        fetchAccounts(userData);
        fetchEmails(userData);
      }
    }
  }, []);

  // Fetch linked accounts
  const fetchAccounts = async (userData) => {
    try {
      const response = await fetch(`${API_URL}/api/accounts`, {
        headers: {
          'Authorization': `Bearer ${userData.token}`
        }
      });
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  // Fetch emails from backend
  const fetchEmails = async (userData) => {
    setLoading(true);
    try {
      const userToUse = userData || user;
      const response = await fetch(`${API_URL}/api/emails`, {
        headers: {
          'Authorization': `Bearer ${userToUse.token}`
        }
      });
      const data = await response.json();
      setEmails(data.emails || []);
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
    setLoading(false);
  };

  // Handle OAuth login
  const handleLogin = async (provider) => {
    // In production, this would redirect to OAuth flow
    // For demo, we'll simulate login
    window.location.href = `${API_URL}/auth/${provider}`;
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('emailAssistantUser');
    setUser(null);
    setView('login');
    setEmails([]);
    setAccounts([]);
  };

  // Remove an account
  const removeAccount = async (accountId) => {
    try {
      await fetch(`${API_URL}/api/accounts/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ accountId })
      });
      
      // Refresh accounts and emails
      fetchAccounts(user);
      fetchEmails(user);
    } catch (error) {
      console.error('Error removing account:', error);
    }
  };

  // Toggle email selection
  const toggleEmailSelection = (emailId) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  // Handle archive/delete
  const handleArchiveDelete = () => {
    if (selectedEmails.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const emailsToDelete = Array.from(selectedEmails);
    setShowDeleteConfirm(false);
    
    // Add to delete queue with 2-minute timer
    const queueItem = {
      ids: emailsToDelete,
      timestamp: Date.now(),
      timeout: setTimeout(async () => {
        // Actually delete after 2 minutes
        try {
          await fetch(`${API_URL}/api/emails/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ emailIds: emailsToDelete })
          });
          
          // Remove from UI
          setEmails(emails.filter(e => !emailsToDelete.includes(e.id)));
          setDeleteQueue(deleteQueue.filter(q => q.ids !== emailsToDelete));
        } catch (error) {
          console.error('Error deleting emails:', error);
        }
      }, 120000) // 2 minutes
    };
    
    setDeleteQueue([...deleteQueue, queueItem]);
    setSelectedEmails(new Set());
    
    // Show temporary feedback
    const tempDeleted = emails.filter(e => emailsToDelete.includes(e.id));
    setEmails(emails.map(e => 
      emailsToDelete.includes(e.id) ? { ...e, pendingDelete: true } : e
    ));
  };

  const undoDelete = (queueItem) => {
    clearTimeout(queueItem.timeout);
    setDeleteQueue(deleteQueue.filter(q => q !== queueItem));
    setEmails(emails.map(e => 
      queueItem.ids.includes(e.id) ? { ...e, pendingDelete: false } : e
    ));
  };

  // Update check interval
  const updateCheckInterval = async (hours) => {
    setCheckInterval(hours);
    try {
      await fetch(`${API_URL}/api/settings/interval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ interval: hours })
      });
    } catch (error) {
      console.error('Error updating interval:', error);
    }
  };

  // Open email in native app
  const openEmail = (email) => {
    // Open email in web browser (Gmail/Outlook web)
    const url = email.webLink || `https://mail.google.com/mail/u/0/#inbox/${email.id}`;
    window.open(url, '_blank');
  };

  return (
    <div className="app">
      {/* Login View */}
      {view === 'login' && (
        <div className="login-view">
          <div className="login-container">
            <div className="login-logo">
              <img src="/Email_Assistant_Logo.png" alt="Email Assistant" />
            </div>
            <h1 className="login-title">Email Assistant</h1>
            <p className="login-subtitle">AI-powered email summaries on your schedule</p>
            
            <div className="login-buttons">
              <button className="login-btn gmail" onClick={() => handleLogin('google')}>
                <svg viewBox="0 0 24 24" className="provider-icon">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
                Sign in with Google
              </button>
              
              <button className="login-btn outlook" onClick={() => handleLogin('microsoft')}>
                <svg viewBox="0 0 24 24" className="provider-icon">
                  <path fill="currentColor" d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
                </svg>
                Sign in with Outlook
              </button>
            </div>
            
            <div className="login-features">
              <div className="feature">
                <span className="feature-icon">🤖</span>
                <span>AI Summaries</span>
              </div>
              <div className="feature">
                <span className="feature-icon">⚡</span>
                <span>Auto Checks</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🔒</span>
                <span>Secure & Private</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email List View */}
      {view === 'emails' && (
        <div className="emails-view">
          {/* Header */}
          <div className="app-header">
            <div className="header-content">
              <img src="/Email_Assistant_Logo.png" alt="Logo" className="header-logo" />
              <h1>Email Assistant</h1>
            </div>
            <div className="header-actions">
              <button className="icon-btn" onClick={() => setView('settings')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button className="icon-btn" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Action Bar */}
          {selectedEmails.size > 0 && (
            <div className="action-bar">
              <span className="selected-count">{selectedEmails.size} selected</span>
              <button className="action-btn delete" onClick={handleArchiveDelete}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Archive/Delete
              </button>
            </div>
          )}

          {/* Delete Queue Notifications */}
          {deleteQueue.map((item, index) => (
            <div key={index} className="undo-notification">
              <span>{item.ids.length} email(s) will be deleted in 2 minutes</span>
              <button onClick={() => undoDelete(item)}>Undo</button>
            </div>
          ))}

          {/* Email List */}
          <div className="email-list">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading your emails...</p>
              </div>
            ) : emails.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" className="empty-icon">
                  <path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                <h2>No emails yet</h2>
                <p>We're checking {accounts.length} account(s) on your schedule</p>
                <button className="refresh-btn" onClick={fetchEmails}>Refresh Now</button>
              </div>
            ) : (
              <>
                <div className="email-summary">
                  <div className="summary-stat">
                    <span className="stat-number">{emails.length}</span>
                    <span className="stat-label">Unread Emails</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-number">{accounts.length}</span>
                    <span className="stat-label">Accounts</span>
                  </div>
                  <div className="summary-stat">
                    <span className="stat-number">{checkInterval}h</span>
                    <span className="stat-label">Check Interval</span>
                  </div>
                </div>
                
                {emails.map(email => (
                <div 
                  key={email.id} 
                  className={`email-card ${email.pendingDelete ? 'pending-delete' : ''} ${selectedEmails.has(email.id) ? 'selected' : ''}`}
                >
                  <div className="email-checkbox">
                    <input 
                      type="checkbox"
                      checked={selectedEmails.has(email.id)}
                      onChange={() => toggleEmailSelection(email.id)}
                    />
                  </div>
                  
                  <div className="email-content" onClick={() => openEmail(email)}>
                    <div className="email-header">
                      <div className="email-sender">{email.sender}</div>
                      <div className="email-account">{email.account}</div>
                    </div>
                    <div className="email-subject">{email.subject}</div>
                    <div className="email-summary">
                      <span className="ai-badge">AI</span>
                      {email.summary}
                    </div>
                    <div className="email-meta">
                      <span className="email-time">{email.time}</span>
                    </div>
                  </div>
                </div>
              ))}
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button className="fab" onClick={fetchEmails}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      )}

      {/* Settings View */}
      {view === 'settings' && (
        <div className="settings-view">
          <div className="settings-header">
            <button className="back-btn" onClick={() => setView('emails')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1>Settings</h1>
          </div>

          <div className="settings-content">
            <div className="setting-section">
              <h2>Check Interval</h2>
              <p className="setting-description">How often should we check your emails?</p>
              
              <div className="interval-options">
                {['3', '6', '12', '24'].map(hours => (
                  <button
                    key={hours}
                    className={`interval-btn ${checkInterval === hours ? 'active' : ''}`}
                    onClick={() => updateCheckInterval(hours)}
                  >
                    Every {hours} hours
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-section">
              <h2>Connected Accounts</h2>
              <p className="setting-description">{accounts.length} account(s) connected</p>
              
              <div className="account-list">
                {accounts.map(account => (
                  <div key={account.id} className="account-item">
                    <div className="account-info">
                      <div className={`account-icon ${account.provider}`}>
                        {account.provider === 'google' ? 'G' : 'M'}
                      </div>
                      <div>
                        <div className="account-name">
                          {account.provider === 'google' ? 'Gmail' : 'Outlook'}
                        </div>
                        <div className="account-email">{account.email}</div>
                      </div>
                    </div>
                    <button 
                      className="disconnect-btn" 
                      onClick={() => {
                        if (window.confirm(`Remove ${account.email}?`)) {
                          removeAccount(account.id);
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              
              <button 
                className="add-account-btn"
                onClick={() => handleLogin('google')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Another Gmail Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Archive/Delete Emails?</h2>
            <p>Are you sure you want to delete {selectedEmails.size} email(s)?</p>
            <p className="modal-note">You'll have 2 minutes to undo this action.</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="modal-btn confirm" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
