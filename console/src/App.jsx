import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Overview from './components/Overview';
import Playground from './components/Playground';
import VirtualKeys from './components/VirtualKeys';
import RequestLogs from './components/RequestLogs';
import CacheInspector from './components/CacheInspector';
import LandingPage from './components/LandingPage';
import ErrorBoundary from './components/ErrorBoundary';
import { Github } from 'lucide-react';

const VALID_TABS = ['landing', 'analytics', 'overview', 'playground', 'keys', 'logs', 'cache'];

const getInitialTab = () => {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash && VALID_TABS.includes(hash)) {
    return hash;
  }
  const saved = localStorage.getItem('netra_active_tab');
  if (saved && VALID_TABS.includes(saved) && saved !== 'landing') {
    return saved;
  }
  return 'landing';
};

export default function App() {
  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    localStorage.setItem('netra_active_tab', tab);
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
        localStorage.setItem('netra_active_tab', hash);
      } else if (!hash) {
        setActiveTabState('landing');
        localStorage.setItem('netra_active_tab', 'landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  // Secure runtime admin token resolution: operator localStorage takes priority, defaulting to demo token
  const [adminToken, setAdminTokenState] = useState(() => {
    return localStorage.getItem('netra_admin_token') || 'netra-admin-demo';
  });

  const setAdminToken = (token) => {
    const trimmed = (token || '').trim();
    if (trimmed && trimmed !== 'netra-admin-demo') {
      localStorage.setItem('netra_admin_token', trimmed);
      setAdminTokenState(trimmed);
    } else {
      localStorage.removeItem('netra_admin_token');
      setAdminTokenState('netra-admin-demo');
    }
  };

  return (
    <ThemeProvider>
      <div className="app-container">
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          adminToken={adminToken}
          onUpdateAdminToken={setAdminToken}
          showAdminModal={showAdminModal}
          setShowAdminModal={setShowAdminModal}
        />
        
        <main className="main-content">
          <ErrorBoundary onReset={() => setActiveTab('landing')}>
            {activeTab === 'landing' && <LandingPage adminToken={adminToken} onNavigate={setActiveTab} onOpenAdminModal={() => setShowAdminModal(true)} />}
            {(activeTab === 'analytics' || activeTab === 'overview') && <Overview adminToken={adminToken} onNavigate={setActiveTab} />}
            {activeTab === 'playground' && <Playground adminToken={adminToken} onNavigate={setActiveTab} />}
            {activeTab === 'keys' && <VirtualKeys adminToken={adminToken} />}
            {activeTab === 'logs' && <RequestLogs adminToken={adminToken} />}
            {activeTab === 'cache' && <CacheInspector adminToken={adminToken} onNavigate={setActiveTab} />}
          </ErrorBoundary>
        </main>

        <footer style={{
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
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}

