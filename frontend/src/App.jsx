import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ContentStudio from './components/ContentStudio';
import ApprovalPipeline from './components/ApprovalPipeline';
import BrandKitManager from './components/BrandKitManager';
import GovernanceDashboard from './components/GovernanceDashboard';
import DemoShowcase from './components/DemoShowcase';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('studio');
  const [activeRole, setActiveRole] = useState('creator');
  const [orgId, setOrgId] = useState(1);
  const [orgName, setOrgName] = useState('BrandGuard');
  const [pipelineCount, setPipelineCount] = useState(0);
  const [presets, setPresets] = useState([]);

  const refreshAppData = async () => {
    try {
      const [presetsData, reviewsData, orgData] = await Promise.all([
        api.getDemoPresets(orgId),
        api.listReviews(orgId),
        api.getOrg(orgId).catch(() => ({ name: 'BrandGuard' })),
      ]);
      setPresets(presetsData);
      setOrgName(orgData.name || 'BrandGuard');
      const pending = (reviewsData || []).filter(r => r.status === 'in_review' || r.status === 'changes_requested');
      setPipelineCount(pending.length);
    } catch (err) {
      console.warn('Sync notice:', err.message);
    }
  };

  useEffect(() => {
    refreshAppData();
  }, [orgId]);

  const handleLoadPresetFromDemo = (presetId) => {
    setActiveTab('studio');
    setTimeout(() => {
      const selectEl = document.getElementById('preset-picker-select');
      if (selectEl) {
        selectEl.value = presetId;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, 100);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        pipelineCount={pipelineCount}
        orgName={orgName}
      />

      {/* Main App View */}
      <main style={{ flex: 1, paddingBottom: '30px' }}>
        {activeTab === 'studio' && (
          <ContentStudio
            orgId={orgId}
            activeRole={activeRole}
            onReviewCreated={refreshAppData}
            presets={presets}
          />
        )}

        {activeTab === 'pipeline' && (
          <ApprovalPipeline
            orgId={orgId}
            activeRole={activeRole}
          />
        )}

        {activeTab === 'brandkit' && (
          <BrandKitManager
            orgId={orgId}
          />
        )}

        {activeTab === 'insights' && (
          <GovernanceDashboard
            orgId={orgId}
          />
        )}

        {activeTab === 'demo' && (
          <DemoShowcase
            presets={presets}
            onLoadPreset={handleLoadPresetFromDemo}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        padding: '12px 20px',
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div>
            BrandGuard v0.1.0 &middot; Inkloom AI Brand Governance &middot; Team Brand New Minds (CMRIT, Bengaluru)
          </div>
          <div>
            Deterministic rules + Grounded verification &middot; WCAG 2.2 AA/AAA
          </div>
        </div>
      </footer>
    </div>
  );
}
