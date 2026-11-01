import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Overview from './components/Overview';
import Playground from './components/Playground';
import VirtualKeys from './components/VirtualKeys';
import RequestLogs from './components/RequestLogs';
import CacheInspector from './components/CacheInspector';
import LandingPage from './components/LandingPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [adminToken, setAdminToken] = useState('netra-admin-demo');

  return (
    <ThemeProvider>
      <div className="app-container">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="main-content">
          {activeTab === 'landing' && <LandingPage onNavigate={setActiveTab} />}
          {(activeTab === 'analytics' || activeTab === 'overview') && <Overview adminToken={adminToken} onNavigate={setActiveTab} />}
          {activeTab === 'playground' && <Playground />}
          {activeTab === 'keys' && <VirtualKeys adminToken={adminToken} />}
          {activeTab === 'logs' && <RequestLogs adminToken={adminToken} />}
          {activeTab === 'cache' && <CacheInspector adminToken={adminToken} />}
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
            <div>
              <span>NETRA LLM Gateway · Crafted with precision by </span>
              <a 
                href="https://github.com/shashankch" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none' }}
              >
                Shashank Chandel
              </a>
              <span style={{ color: 'var(--text-muted)' }}> · Apache 2.0 Open-Core</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <a 
                href="https://shashankch.github.io/netra-llmgateway/" 
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

