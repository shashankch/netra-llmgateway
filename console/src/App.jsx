import React, { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from './context/ThemeContext';
import { getDefaultAdminToken, getEnvAdminToken, useAdminAuthStatus, checkGatewayHealth, probeAdminAuth, checkUiAuthConfig, logoutUi, getGatewayBaseUrl } from './config/api';
import Navbar from './components/Navbar';
import Overview from './components/Overview';
import Playground from './components/Playground';
import VirtualKeys from './components/VirtualKeys';
import RequestLogs from './components/RequestLogs';
import CacheInspector from './components/CacheInspector';
import LandingPage from './components/LandingPage';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardLockScreen from './components/DashboardLockScreen';
import { VALID_TABS } from './constants/navigation';
import { Github, Bug } from 'lucide-react';

const getInitialTab = () => {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash && VALID_TABS.includes(hash)) {
    return hash;
  }
  return 'landing';
};

export default function App() {
  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (tab === 'landing') {
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } else {
      window.location.hash = tab;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (hash && VALID_TABS.includes(hash)) {
        setActiveTabState(hash);
      } else if (!hash) {
        setActiveTabState('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  // Multi-tier admin token resolution: respects explicit user inputs (even 'netra-admin-demo'),
  // falling back to Vercel/build environment variable, and lastly to demo token
  const [adminToken, setAdminTokenState] = useState(() => {
    return getDefaultAdminToken();
  });
  const authStatus = useAdminAuthStatus();
  const isDemoToken = !adminToken || adminToken === 'netra-admin-demo';

  // Lightweight UI Dashboard Password Protection (NETRA_UI_PASSWORD)
  const [uiAuthConfig, setUiAuthConfig] = useState({ password_required: false, authenticated: true });

  useEffect(() => {
    let mounted = true;
    const fetchAuth = () => {
      checkUiAuthConfig().then(cfg => {
        if (mounted && cfg) setUiAuthConfig(cfg);
      });
    };
    fetchAuth();
    window.addEventListener('netra-ui-auth-changed', fetchAuth);
    window.addEventListener('netra-gateway-url-changed', fetchAuth);
    return () => {
      mounted = false;
      window.removeEventListener('netra-ui-auth-changed', fetchAuth);
      window.removeEventListener('netra-gateway-url-changed', fetchAuth);
    };
  }, []);

  const handleLockUi = async () => {
    await logoutUi();
    setUiAuthConfig(c => ({ ...c, authenticated: false }));
  };

  const handleUnlockUi = () => {
    setUiAuthConfig(c => ({ ...c, authenticated: true }));
  };

  const setAdminToken = async (token) => {
    const trimmed = (token || '').trim();
    let effectiveToken = trimmed;
    if (trimmed) {
      // User explicitly entered or applied a value (whether custom secret or 'netra-admin-demo')
      localStorage.setItem('netra_admin_token', trimmed);
      setAdminTokenState(trimmed);
    } else {
      // Cleared: revert to Vercel/build environment variable, then demo fallback
      localStorage.removeItem('netra_admin_token');
      const envToken = getEnvAdminToken();
      effectiveToken = envToken || 'netra-admin-demo';
      setAdminTokenState(effectiveToken);
    }
    // Actively verify gateway reachability and admin credentials immediately
    checkGatewayHealth();
    await probeAdminAuth(effectiveToken);
  };

  return (
    <ThemeProvider>
      <ErrorBoundary onReset={() => window.location.reload()}>
        <div className="app-container">
          {uiAuthConfig.password_required && !uiAuthConfig.authenticated ? (
            <DashboardLockScreen 
              onUnlock={handleUnlockUi} 
              gatewayUrl={getGatewayBaseUrl()} 
            />
          ) : (
            <>
              <Navbar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                adminToken={adminToken}
                onUpdateAdminToken={setAdminToken}
                showAdminModal={showAdminModal}
                setShowAdminModal={setShowAdminModal}
                passwordRequired={uiAuthConfig.password_required}
                onLockUi={handleLockUi}
              />
              
              <main className="main-content">
                <ErrorBoundary onReset={() => setActiveTab('landing')}>
                  {activeTab === 'landing' && <LandingPage adminToken={adminToken} onNavigate={setActiveTab} onOpenAdminModal={() => setShowAdminModal(true)} />}
                  {(activeTab === 'analytics' || activeTab === 'overview') && <Overview adminToken={adminToken} onNavigate={setActiveTab} onOpenAdminModal={() => setShowAdminModal(true)} />}
                  {activeTab === 'playground' && <Playground adminToken={adminToken} onNavigate={setActiveTab} onOpenAdminModal={() => setShowAdminModal(true)} />}
                  {activeTab === 'keys' && <VirtualKeys adminToken={adminToken} onNavigate={setActiveTab} onOpenAdminModal={() => setShowAdminModal(true)} />}
                  {activeTab === 'logs' && <RequestLogs adminToken={adminToken} onNavigate={setActiveTab} onOpenAdminModal={() => setShowAdminModal(true)} />}
                  {activeTab === 'cache' && <CacheInspector adminToken={adminToken} onNavigate={setActiveTab} onOpenAdminModal={() => setShowAdminModal(true)} />}
                </ErrorBoundary>
              </main>

              <footer className="app-footer" style={{
                borderTop: '1px solid var(--border-subtle)',
                padding: '1.5rem 2rem',
                background: 'var(--bg-surface)',
                marginTop: 'auto',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)'
              }}>
                <div style={{
                  maxWidth: 1400,
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span>NETRA LLM Gateway · Apache 2.0 Open-Core</span>
                    <a 
                      href="https://github.com/shashankch" 
                      target="_blank" 
                      rel="noreferrer"
                      className="author-nav-badge"
                      title="Crafted by Shashank Chandel"
                    >
                      <Github size={13} style={{ opacity: 0.8 }} />
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.72rem' }}>by</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>@shashankch</span>
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <a 
                      href="https://docs-netrallm.avadhanlabs.dev/" 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}
                    >
                      Documentation
                    </a>
                    <a 
                      href="https://github.com/shashankch/netra-llmgateway" 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
                    >
                      GitHub
                    </a>
                    <a 
                      href="https://github.com/shashankch/netra-llmgateway/issues/new" 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
                    >
                      Report Issue
                    </a>
                  </div>
                </div>
              </footer>
            </>
          )}

          {/* Floating Bug / Feedback Action Button */}
        <a
          href="https://github.com/shashankch/netra-llmgateway/issues/new"
          target="_blank"
          rel="noreferrer noopener"
          className="floating-bug-btn"
          title="Report a Bug or Feedback on GitHub"
          aria-label="Report Bug or Feedback"
        >
          <Bug size={14} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
          <span className="floating-bug-text">Report Bug</span>
        </a>

        <Analytics />
      </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

