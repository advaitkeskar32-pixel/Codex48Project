import React, { useState, useEffect } from 'react';
import { 
  GitPullRequest, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  MessageSquare, 
  History, 
  FileText, 
  Check, 
  X, 
  Send, 
  Shield, 
  RefreshCw,
  Edit2
} from 'lucide-react';
import { api } from '../api';

export default function ApprovalPipeline({ orgId, activeRole }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReview, setSelectedReview] = useState(null);
  const [detailTab, setDetailTab] = useState('overview'); // overview | revisions | comments | audit
  
  // Drawer action states
  const [newComment, setNewComment] = useState('');
  const [requestChangeNote, setRequestChangeNote] = useState('');
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await api.listReviews(orgId);
      setReviews(data);
    } catch (err) {
      console.error('Failed to list reviews', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [orgId]);

  const loadReviewDetails = async (id) => {
    try {
      const full = await api.getReview(id);
      setSelectedReview(full);
      setEditingContent(full.content);
      setIsEditing(false);
    } catch (err) {
      alert(`Could not load review: ${err.message}`);
    }
  };

  const handleWorkflowAction = async (action, notes = '') => {
    if (!selectedReview) return;
    try {
      const actorMap = {
        creator: { name: 'Maya', role: 'creator' },
        manager: { name: 'Jordan', role: 'manager' },
        reviewer: { name: 'Rachel', role: 'reviewer' },
        admin: { name: 'Aaditya', role: 'admin' },
      };
      const actor = actorMap[activeRole] || actorMap.manager;

      await api.updateWorkflow(selectedReview.id, {
        action,
        actor_name: `${actor.name} (${actor.role})`,
        actor_role: actor.role,
        notes,
      });

      await loadReviewDetails(selectedReview.id);
      await fetchReviews();
      setShowChangeModal(false);
      setRequestChangeNote('');
    } catch (err) {
      alert(`Workflow action failed: ${err.message}`);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedReview) return;
    try {
      const actorMap = {
        creator: { name: 'Maya', role: 'creator' },
        manager: { name: 'Jordan', role: 'manager' },
        reviewer: { name: 'Rachel', role: 'reviewer' },
        admin: { name: 'Aaditya', role: 'admin' },
      };
      const actor = actorMap[activeRole] || actorMap.creator;

      await api.addComment(selectedReview.id, {
        user_name: `${actor.name} (${actor.role})`,
        user_role: actor.role,
        message: newComment,
      });
      setNewComment('');
      loadReviewDetails(selectedReview.id);
    } catch (err) {
      alert(`Comment failed: ${err.message}`);
    }
  };

  const handleSaveRevision = async () => {
    if (!editingContent.trim() || !selectedReview) return;
    try {
      await api.saveRevision(selectedReview.id, {
        content: editingContent,
        change_summary: changeSummary || 'Revised copy',
        actor_name: 'Maya (creator)',
        use_ai: false,
      });
      setIsEditing(false);
      setChangeSummary('');
      await loadReviewDetails(selectedReview.id);
      await fetchReviews();
    } catch (err) {
      alert(`Save revision failed: ${err.message}`);
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px' }}>
      {/* Title & Filter Bar */}
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
            Review & Sign-Off Pipeline
          </h1>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '2px' }}>
            Multi-stage approval pipeline tracking state transitions, version diffs, and audit events.
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'in_review', label: 'In Review' },
            { id: 'changes_requested', label: 'Changes Requested' },
            { id: 'approved', label: 'Approved' },
            { id: 'draft', label: 'Draft' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                background: statusFilter === f.id ? 'var(--bg-tertiary)' : 'transparent',
                color: statusFilter === f.id ? 'var(--text-main)' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: statusFilter === f.id ? 'var(--border-hover)' : 'var(--border-subtle)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
          <button 
            onClick={fetchReviews}
            className="btn btn-secondary btn-sm"
            title="Refresh"
            style={{ padding: '4px 8px' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
            Loading pipeline entries...
          </div>
        ) : filteredReviews.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
            No records found for filter "{statusFilter}".
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '8px 14px', color: 'var(--text-dim)', textAlign: 'left' }}>TITLE / SNIPPET</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>CHANNEL</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>STATUS</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>AUTHOR / REVIEWER</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>ISSUES</th>
                <th style={{ padding: '8px 12px', color: 'var(--text-dim)', textAlign: 'left' }}>REV</th>
                <th style={{ padding: '8px 14px', color: 'var(--text-dim)', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map((r) => (
                <tr 
                  key={r.id}
                  id={`review-row-${r.id}`}
                  style={{ 
                    borderBottom: '1px solid var(--border-subtle)', 
                    cursor: 'pointer',
                  }}
                  onClick={() => loadReviewDetails(r.id)}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '1px', fontFamily: 'var(--font-mono)', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.content_snippet}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.channel}</span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge status-${r.status}`}>
                      {r.status?.toUpperCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>{r.creator_name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{r.assigned_reviewer}</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                    {r.findings_count === 0 ? (
                      <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>0 issues</span>
                    ) : (
                      <span className={`badge ${r.open_count > 0 ? 'badge-high' : 'badge-success'}`}>
                        {r.open_count} open
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    v{r.version}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadReviewDetails(r.id);
                      }}
                      style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      {selectedReview && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(640px, 95vw)',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 500,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tertiary)',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`badge status-${selectedReview.status}`}>
                  {selectedReview.status?.toUpperCase().replace('_', ' ')}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  REV v{selectedReview.version}
                </span>
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                {selectedReview.title}
              </h2>
            </div>

            <button
              id="close-drawer-btn"
              onClick={() => setSelectedReview(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            padding: '0 16px',
          }}>
            {[
              { id: 'overview', label: 'Copy & Rules' },
              { id: 'revisions', label: `Diffs (${selectedReview.revisions?.length || 0})` },
              { id: 'comments', label: `Discussion (${selectedReview.comments?.length || 0})` },
              { id: 'audit', label: 'Audit Trail' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id)}
                style={{
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: detailTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                  color: detailTab === tab.id ? 'var(--text-main)' : 'var(--text-dim)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {detailTab === 'overview' && (
              <div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  background: 'var(--bg-input)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '14px',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                }}>
                  <div>Author: <span style={{ color: 'var(--text-main)' }}>{selectedReview.creator_name}</span></div>
                  <div>Channel: <span style={{ color: 'var(--text-main)' }}>{selectedReview.channel}</span></div>
                  <div>Reviewer: <span style={{ color: 'var(--text-main)' }}>{selectedReview.assigned_reviewer}</span></div>
                  <div>Updated: <span style={{ color: 'var(--text-main)' }}>{selectedReview.updated_at ? new Date(selectedReview.updated_at).toLocaleTimeString() : 'N/A'}</span></div>
                </div>

                {/* Content preview / edit */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      Payload (v{selectedReview.version})
                    </span>
                    {!isEditing ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.6875rem', padding: '1px 6px' }}
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                    ) : (
                      <button
                        onClick={handleSaveRevision}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.6875rem', padding: '1px 6px' }}
                      >
                        Commit Revision
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div>
                      <textarea
                        rows={6}
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          fontSize: '0.8125rem',
                          fontFamily: 'var(--font-mono)',
                          lineHeight: '1.5',
                        }}
                      />
                      <input
                        type="text"
                        value={changeSummary}
                        onChange={(e) => setChangeSummary(e.target.value)}
                        placeholder="Commit message / change summary"
                        style={{
                          width: '100%',
                          marginTop: '4px',
                          padding: '5px 8px',
                          fontSize: '0.75rem',
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      fontSize: '0.8125rem',
                      lineHeight: '1.5',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {selectedReview.content}
                    </div>
                  )}
                </div>

                {/* Findings checklist */}
                <div>
                  <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Rule Evaluation Checklist ({selectedReview.findings?.length || 0})
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(!selectedReview.findings || selectedReview.findings.length === 0) && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                        No rule findings.
                      </div>
                    )}
                    {selectedReview.findings?.map((f, i) => (
                      <div
                        key={f.id || i}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span className={`badge badge-${f.severity || 'low'}`}>{f.rule_id}</span>
                          <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: f.status === 'open' ? '#f87171' : '#4ade80' }}>
                            {f.status?.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-main)', marginTop: '2px' }}>{f.message}</div>
                        {f.suggestion && (
                          <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#93c5fd', marginTop: '2px' }}>
                            Target: "{f.suggestion}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'revisions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(!selectedReview.revisions || selectedReview.revisions.length === 0) && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    No revisions have been saved.
                  </div>
                )}
                {selectedReview.revisions?.map((rev) => (
                  <div key={rev.id} style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#60a5fa', fontSize: '0.75rem' }}>
                        commit: v{rev.version_number} ({rev.created_by})
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(rev.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginBottom: '6px' }}>
                      {rev.change_summary}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '8px',
                      borderRadius: 'var(--radius-sm)',
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-muted)',
                    }}>
                      {rev.content}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {detailTab === 'comments' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {(!selectedReview.comments || selectedReview.comments.length === 0) && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                      No discussion yet. Start the conversation below.
                    </div>
                  )}
                  {selectedReview.comments?.map((c) => (
                    <div key={c.id} style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
                          {c.user_name}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(c.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {c.message}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddComment}>
                  <textarea
                    rows={2}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Leave comment on review..."
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '0.8125rem',
                      marginBottom: '6px',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-secondary btn-sm">
                      <Send size={11} /> Comment
                    </button>
                  </div>
                </form>
              </div>
            )}

            {detailTab === 'audit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                {(!(selectedReview.audit_logs || selectedReview.audit_events)?.length) && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    No audit events recorded yet.
                  </div>
                )}
                {(selectedReview.audit_logs || selectedReview.audit_events)?.map((a) => (
                  <div key={a.id} style={{
                    padding: '8px 10px',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '2px solid var(--border-hover)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)' }}>
                      <span>[{a.action?.toUpperCase()}] {a.actor_name}</span>
                      <span>{new Date(a.created_at).toLocaleTimeString()}</span>
                    </div>
                    {a.notes && <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{a.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              ROLE: {activeRole.toUpperCase()}
            </span>

            <div style={{ display: 'flex', gap: '6px' }}>
              {activeRole === 'creator' && selectedReview.status !== 'in_review' && selectedReview.status !== 'approved' && (
                <button
                  id="wf-submit-review-btn"
                  onClick={() => handleWorkflowAction('submit_for_review', 'Submitted for review.')}
                  className="btn btn-primary btn-sm"
                >
                  <Send size={12} /> Submit for Review
                </button>
              )}

              {(activeRole === 'manager' || activeRole === 'admin') && selectedReview.status !== 'approved' && (
                <>
                  <button
                    id="wf-request-changes-btn"
                    onClick={() => setShowChangeModal(true)}
                    className="btn btn-secondary btn-sm"
                  >
                    Request Changes...
                  </button>
                  <button
                    id="wf-approve-btn"
                    onClick={() => handleWorkflowAction('approve', 'Signed off against brand guidelines and facts.')}
                    className="btn btn-success btn-sm"
                  >
                    <Check size={12} /> Approve
                  </button>
                </>
              )}

              {(activeRole === 'admin' || activeRole === 'manager') && selectedReview.status === 'approved' && (
                <button
                  id="wf-publish-btn"
                  onClick={() => handleWorkflowAction('publish', 'Marked ready for publishing pipeline.')}
                  className="btn btn-primary btn-sm"
                >
                  Mark Published
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Changes Request Note Modal */}
      {showChangeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="glass-panel" style={{ width: '380px', padding: '18px', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '6px' }}>
              Request Changes
            </h3>
            <textarea
              rows={3}
              value={requestChangeNote}
              onChange={(e) => setRequestChangeNote(e.target.value)}
              placeholder="State required revisions..."
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '0.8125rem',
                marginBottom: '10px',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowChangeModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button 
                id="confirm-request-changes-btn"
                onClick={() => handleWorkflowAction('request_changes', requestChangeNote)} 
                className="btn btn-primary btn-sm"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
