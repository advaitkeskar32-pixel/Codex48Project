import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  FileText, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  BookOpen, 
  Sliders
} from 'lucide-react';
import { api } from '../api';

export default function BrandKitManager({ orgId }) {
  const [activeSection, setActiveSection] = useState('palette'); // palette | facts | terms | docs
  const [org, setOrg] = useState(null);
  const [facts, setFacts] = useState([]);
  const [terms, setTerms] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Contrast Simulator State
  const [fgColor, setFgColor] = useState('#cccccc');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [largeText, setLargeText] = useState(false);
  const [wcagLevel, setWcagLevel] = useState('AA');
  const [contrastResult, setContrastResult] = useState(null);

  // Modals
  const [showAddFact, setShowAddFact] = useState(false);
  const [newFact, setNewFact] = useState({
    key: '',
    statement: '',
    value: '',
    unit: '',
    keywords: '',
    source: '',
    valid_from: '2026-01-01',
  });

  const [showAddTerm, setShowAddTerm] = useState(false);
  const [newTerm, setNewTerm] = useState({
    kind: 'terminology',
    phrase: '',
    preferred: '',
    reason: '',
    severity: 'medium',
  });

  const loadBrandKit = async () => {
    setLoading(true);
    try {
      const [orgData, factsData, termsData, docsData] = await Promise.all([
        api.getOrg(orgId),
        api.getFacts(orgId),
        api.getTerms(orgId),
        api.getDocuments(orgId),
      ]);
      setOrg(orgData);
      setFacts(factsData);
      setTerms(termsData);
      setDocs(docsData);
    } catch (err) {
      console.error('Failed to load brand kit', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrandKit();
  }, [orgId]);

  const runContrastCheck = async () => {
    try {
      const res = await api.checkContrast(orgId, {
        fg: fgColor,
        bg: bgColor,
        large_text: largeText,
        level: wcagLevel,
      });
      setContrastResult(res);
    } catch (err) {
      console.error('Contrast error', err);
    }
  };

  useEffect(() => {
    runContrastCheck();
  }, [fgColor, bgColor, largeText, wcagLevel]);

  const handleSaveFact = async (e) => {
    e.preventDefault();
    try {
      await api.addFact(orgId, {
        ...newFact,
        value: newFact.value ? parseFloat(newFact.value) : null,
        keywords: newFact.keywords.split(',').map(s => s.trim()).filter(Boolean),
      });
      setShowAddFact(false);
      setNewFact({ key: '', statement: '', value: '', unit: '', keywords: '', source: '', valid_from: '2026-01-01' });
      const f = await api.getFacts(orgId);
      setFacts(f);
    } catch (err) {
      alert(`Add fact failed: ${err.message}`);
    }
  };

  const handleDeleteFact = async (factId) => {
    if (!window.confirm('Delete approved fact?')) return;
    try {
      await api.deleteFact(orgId, factId);
      setFacts(facts.filter(f => f.id !== factId));
    } catch (err) {
      alert(`Delete fact failed: ${err.message}`);
    }
  };

  const handleSaveTerm = async (e) => {
    e.preventDefault();
    try {
      await api.addTerm(orgId, newTerm);
      setShowAddTerm(false);
      setNewTerm({ kind: 'terminology', phrase: '', preferred: '', reason: '', severity: 'medium' });
      const t = await api.getTerms(orgId);
      setTerms(t);
    } catch (err) {
      alert(`Add term failed: ${err.message}`);
    }
  };

  const handleDeleteTerm = async (termId) => {
    if (!window.confirm('Delete terminology rule?')) return;
    try {
      await api.deleteTerm(orgId, termId);
      setTerms(terms.filter(t => t.id !== termId));
    } catch (err) {
      alert(`Delete term failed: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '14px',
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Brand Rules & Fact Configuration
          </h1>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '2px' }}>
            Source material database: palette hexes, WCAG contrast validator, verified facts, and term rules.
          </div>
        </div>

        {/* Section Tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'palette', label: 'Palette & WCAG' },
            { id: 'facts', label: `Facts (${facts.length})` },
            { id: 'terms', label: `Terms & Bans (${terms.length})` },
            { id: 'docs', label: `Documents (${docs.length})` },
          ].map(sec => (
            <button
              key={sec.id}
              id={`brandkit-tab-${sec.id}`}
              onClick={() => setActiveSection(sec.id)}
              style={{
                background: activeSection === sec.id ? 'var(--bg-tertiary)' : 'transparent',
                color: activeSection === sec.id ? 'var(--text-main)' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: activeSection === sec.id ? 'var(--border-hover)' : 'var(--border-subtle)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* Palette & Contrast */}
      {activeSection === 'palette' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Palette Swatches */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              Corporate Color Palette
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '14px' }}>
              Images and styles are evaluated against these hex definitions.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px', marginBottom: '18px' }}>
              {(org?.palette || ['#1F4E79', '#F2A900', '#FFFFFF', '#222222']).map((hex, i) => (
                <div key={i} style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                }}>
                  <div style={{ height: '48px', backgroundColor: hex }} />
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-main)' }}>
                      {hex}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '4px' }}>
                PROTECTED PRODUCT NAMES
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(org?.product_names || ['FlowDesk']).map((p, idx) => (
                  <span key={idx} className="badge badge-purple" style={{ fontSize: '0.75rem' }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* WCAG Contrast Validator */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              WCAG 2.2 Contrast Ratio Calculator
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '14px' }}>
              Evaluates contrast formula ratio (L1 + 0.05) / (L2 + 0.05) against AA/AAA standards.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>
                  FOREGROUND
                </label>
                <input
                  type="text"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  style={{ width: '100%', padding: '5px 8px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>
                  BACKGROUND
                </label>
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  style={{ width: '100%', padding: '5px 8px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            {/* Simulated text */}
            <div style={{
              backgroundColor: bgColor,
              color: fgColor,
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>Brand Text Sample</div>
              <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>The quick brown fox jumps over the lazy dog.</div>
            </div>

            {/* Contrast result */}
            {contrastResult && (
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: contrastResult.passes ? '#4ade80' : '#f87171' }}>
                      {contrastResult.ratio}:1
                    </span>
                    <span className={`badge ${contrastResult.passes ? 'badge-success' : 'badge-high'}`}>
                      {contrastResult.passes ? 'PASSES WCAG AA' : 'FAILS WCAG AA'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    Threshold: {contrastResult.required}:1
                  </div>
                </div>

                {!contrastResult.passes && contrastResult.finding?.suggestion && (
                  <div style={{ textAlign: 'right', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>
                    Suggested: {contrastResult.finding.suggestion}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Facts */}
      {activeSection === 'facts' && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Approved Fact Sheet Database
            </span>
            <button
              id="add-fact-btn"
              onClick={() => setShowAddFact(true)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '2px 8px' }}
            >
              <Plus size={12} /> Add Fact
            </button>
          </div>

          <table style={{ width: '100%', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>KEY</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>APPROVED STATEMENT</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>NORMALIZED VALUE</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>KEYWORDS</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>SOURCE</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'right' }}>DEL</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((fact) => (
                <tr key={fact.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#60a5fa' }}>{fact.key}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-main)', maxWidth: '280px' }}>{fact.statement}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#4ade80' }}>
                    {fact.value !== null && fact.value !== undefined ? `${fact.value.toLocaleString()} ${fact.unit || ''}` : 'N/A'}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    {(fact.keywords || []).join(', ')}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fact.source}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDeleteFact(fact.id)}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Terms */}
      {activeSection === 'terms' && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Terminology & Prohibited Phrases
            </span>
            <button
              id="add-term-btn"
              onClick={() => setShowAddTerm(true)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '2px 8px' }}
            >
              <Plus size={12} /> Add Rule
            </button>
          </div>

          <table style={{ width: '100%', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>TYPE</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>PHRASE</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>PREFERRED</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>SEVERITY</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>RATIONALE</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'right' }}>DEL</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((term) => (
                <tr key={term.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                      {term.kind?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#f87171' }}>"{term.phrase}"</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#4ade80' }}>
                    {term.preferred ? `"${term.preferred}"` : '-'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge badge-${term.severity}`}>{term.severity?.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-dim)', maxWidth: '280px' }}>{term.reason}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDeleteTerm(term.id)}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Docs */}
      {activeSection === 'docs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {docs.map((doc) => (
            <div key={doc.id} className="glass-panel" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <FileText size={16} color="#60a5fa" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{doc.title}</span>
              </div>
              <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                passages: {doc.passages} | kind: {doc.kind}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Fact Modal */}
      {showAddFact && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSaveFact} className="glass-panel" style={{ width: '420px', padding: '18px', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>Add Approved Fact</h3>
            <input
              type="text" required placeholder="Fact key (e.g. active_users)"
              value={newFact.key} onChange={e => setNewFact({ ...newFact, key: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', marginBottom: '8px' }}
            />
            <textarea
              rows={2} required placeholder="Approved statement"
              value={newFact.statement} onChange={e => setNewFact({ ...newFact, statement: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', marginBottom: '8px' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <input
                type="number" step="any" placeholder="Normalized value (optional)"
                value={newFact.value} onChange={e => setNewFact({ ...newFact, value: e.target.value })}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem' }}
              />
              <input
                type="text" placeholder="Unit (optional)"
                value={newFact.unit} onChange={e => setNewFact({ ...newFact, unit: e.target.value })}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem' }}
              />
            </div>
            <input
              type="text" placeholder="Keywords (comma separated)"
              value={newFact.keywords} onChange={e => setNewFact({ ...newFact, keywords: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', marginBottom: '8px' }}
            />
            <input
              type="text" placeholder="Proof source document"
              value={newFact.source} onChange={e => setNewFact({ ...newFact, source: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', marginBottom: '14px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button type="button" onClick={() => setShowAddFact(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">Save Fact</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Term Modal */}
      {showAddTerm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleSaveTerm} className="glass-panel" style={{ width: '420px', padding: '18px', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>Add Terminology Rule</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <select
                value={newTerm.kind} onChange={e => setNewTerm({ ...newTerm, kind: e.target.value })}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem' }}
              >
                <option value="terminology">Terminology</option>
                <option value="banned_phrase">Banned Phrase</option>
              </select>
              <select
                value={newTerm.severity} onChange={e => setNewTerm({ ...newTerm, severity: e.target.value })}
                style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <input
              type="text" required placeholder="Phrase to flag"
              value={newTerm.phrase} onChange={e => setNewTerm({ ...newTerm, phrase: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', marginBottom: '8px' }}
            />
            <input
              type="text" placeholder="Preferred replacement"
              value={newTerm.preferred} onChange={e => setNewTerm({ ...newTerm, preferred: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', marginBottom: '8px' }}
            />
            <input
              type="text" placeholder="Brand rationale"
              value={newTerm.reason} onChange={e => setNewTerm({ ...newTerm, reason: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', fontSize: '0.78rem', marginBottom: '14px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button type="button" onClick={() => setShowAddTerm(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">Save Rule</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
