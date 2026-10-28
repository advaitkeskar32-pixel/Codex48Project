import React, { useState } from 'react';
import brandGuardLogo from '../assets/brandguard-logo.png';
import { 
  FileText, 
  GitPullRequest, 
  BookOpen, 
  BarChart2, 
  SlidersHorizontal,
  ChevronDown,
  User
} from 'lucide-react';

const ROLES = [
  {
    id: 'creator',
    name: 'Maya',
    roleTag: 'CREATOR',
    title: 'Content Creator',
    desc: 'Authors drafts, runs rule checks, accepts or dismisses fixes',
  },
  {
    id: 'manager',
    name: 'Jordan',
    roleTag: 'MANAGER',
    title: 'Brand Marketing Manager',
    desc: 'Reviews copy against brand policy, requests revisions, grants sign-off',
  },
  {
    id: 'reviewer',
    name: 'Rachel',
    roleTag: 'COMPLIANCE',
    title: 'Legal & Compliance Reviewer',
    desc: 'Audits claims against approved fact sheet and statutory disclosures',
  },
  {
    id: 'admin',
    name: 'Aaditya',
    roleTag: 'ADMIN',
    title: 'Brand Governance Admin',
    desc: 'Maintains rules, facts, documents, and monitors governance telemetry',
  },
];

export default function Header({ 
  activeTab, 
  setActiveTab, 
  activeRole, 
  setActiveRole, 
  pipelineCount = 0,
  orgName = 'Northwind Labs' 
}) {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const currentRoleObj = ROLES.find(r => r.id === activeRole) || ROLES[0];

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--bg-secondary)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {/* Brand Logo & Context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-main)',
            overflow: 'hidden',
          }}>
            <img
              src={brandGuardLogo}
              alt="BrandGuard logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                fontFamily: 'var(--font-heading)', 
                fontSize: '1.05rem', 
                fontWeight: 700,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
              }}>
                BrandGuard
              </span>
              <span style={{
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}>
                v0.1.0
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          background: 'var(--bg-primary)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          <button
            id="nav-tab-studio"
            onClick={() => setActiveTab('studio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'studio' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'studio' ? 'var(--text-main)' : 'var(--text-muted)',
            }}
          >
            <FileText size={14} />
            <span>Studio</span>
          </button>

          <button
            id="nav-tab-pipeline"
            onClick={() => setActiveTab('pipeline')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'pipeline' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'pipeline' ? 'var(--text-main)' : 'var(--text-muted)',
            }}
          >
            <GitPullRequest size={14} />
            <span>Pipeline</span>
            {pipelineCount > 0 && (
              <span style={{
                background: 'rgba(96, 165, 250, 0.15)',
                color: '#60a5fa',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                padding: '0 5px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
              }}>
                {pipelineCount}
              </span>
            )}
          </button>

          <button
            id="nav-tab-brandkit"
            onClick={() => setActiveTab('brandkit')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'brandkit' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'brandkit' ? 'var(--text-main)' : 'var(--text-muted)',
            }}
          >
            <BookOpen size={14} />
            <span>Brand Kit</span>
          </button>

          <button
            id="nav-tab-insights"
            onClick={() => setActiveTab('insights')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'insights' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'insights' ? 'var(--text-main)' : 'var(--text-muted)',
            }}
          >
            <BarChart2 size={14} />
            <span>Insights</span>
          </button>

          <button
            id="nav-tab-demo"
            onClick={() => setActiveTab('demo')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'demo' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'demo' ? 'var(--text-main)' : 'var(--text-muted)',
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Test Cases</span>
          </button>
        </nav>

        {/* Persona Role Switcher */}
        <div style={{ position: 'relative' }}>
          <button
            id="role-switcher-btn"
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              padding: '5px 10px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
          >
            <div style={{
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono)',
              padding: '2px 5px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
              {currentRoleObj.roleTag}
            </div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{currentRoleObj.name}</span>
            <ChevronDown size={14} color="var(--text-dim)" />
          </button>

          {/* Role Dropdown Menu */}
          {roleDropdownOpen && (
            <div 
              id="role-dropdown-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '280px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '6px',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 200,
              }}
            >
              <div style={{ 
                padding: '6px 10px', 
                fontSize: '0.6875rem', 
                color: 'var(--text-dim)', 
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase', 
                letterSpacing: '0.04em' 
              }}>
                Switch User Role
              </div>
              {ROLES.map((role) => (
                <div
                  key={role.id}
                  id={`select-role-${role.id}`}
                  onClick={() => {
                    setActiveRole(role.id);
                    setRoleDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: activeRole === role.id ? 'var(--bg-tertiary)' : 'transparent',
                    borderLeft: activeRole === role.id ? '2px solid var(--primary)' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (activeRole !== role.id) e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeRole !== role.id) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 5px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: activeRole === role.id ? '#60a5fa' : 'var(--text-dim)',
                    fontWeight: 600,
                    marginTop: '1px',
                  }}>
                    {role.roleTag}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {role.name} <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: '0.75rem' }}>({role.title})</span>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '2px', lineHeight: 1.3 }}>
                      {role.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
