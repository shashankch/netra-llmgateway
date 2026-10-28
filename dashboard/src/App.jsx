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
  const [activeTab, setActiveTab] = useState('overview');
  const [adminToken, setAdminToken] = useState('netra-admin-demo');

  return (
    <ThemeProvider>
      <div className="app-container">
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="main-content">
          {activeTab === 'overview' && <Overview adminToken={adminToken} onNavigate={setActiveTab} />}
          {activeTab === 'playground' && <Playground />}
          {activeTab === 'keys' && <VirtualKeys adminToken={adminToken} />}
          {activeTab === 'logs' && <RequestLogs adminToken={adminToken} />}
          {activeTab === 'cache' && <CacheInspector adminToken={adminToken} />}
          {activeTab === 'landing' && <LandingPage onNavigate={setActiveTab} />}
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
              <span>NETRA LLM Gateway & Semantic Vector Cache · Apache 2.0 Open-Core Guarantee</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <a 
                href="/docs" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}
              >
                Documentation (MkDocs)
              </a>
              <a 
                href="https://github.com/shashankch/netra-llmgateway" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
              >
                GitHub Repository
              </a>
              <span>Java 25 LTS · PostgreSQL 18 · Redis 8.0</span>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
