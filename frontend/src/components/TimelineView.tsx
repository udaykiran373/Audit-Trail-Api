import React from 'react';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import type { AuditLog } from '../types';

interface TimelineViewProps {
  logs: AuditLog[];
  title: string;
  onClose: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ logs, title, onClose }) => {
  const getStatusIcon = (status: string) => {
    if (status === 'SUCCESS') {
      return <CheckCircle size={14} style={{ color: 'var(--status-success)', marginLeft: '6px' }} />;
    }
    return <AlertCircle size={14} style={{ color: 'var(--status-failed)', marginLeft: '6px' }} />;
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' .' + String(d.getMilliseconds()).padStart(3, '0');
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeft size={16} />
            Back
          </button>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Journey Timeline</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{title}</p>
          </div>
        </div>
        <div className="live-indicator">
          <div className="pulse-dot"></div>
          <span>{logs.length} Events Sequence</span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No events found for this journey trace.
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1, maxHeight: '60vh', paddingRight: '8px' }}>
          <div className="timeline-container">
            <div className="timeline-line"></div>
            {logs.map((log, index) => (
              <div className="timeline-item" key={log.id || index}>
                <div className="timeline-dot" style={{
                  borderColor: log.status === 'SUCCESS' ? 'var(--status-success)' : 'var(--status-failed)',
                  boxShadow: `0 0 6px ${log.status === 'SUCCESS' ? 'var(--status-success)' : 'var(--status-failed)'}`
                }}></div>
                <div className="timeline-content">
                  <div className="timeline-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-info" style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {log.module}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                        {log.action}
                        {getStatusIcon(log.status)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {formatTime(log.timestamp)}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>Correlation: <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.8 }}>{log.correlationId}</span></span>
                    {log.requestPath && <span>Path: <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.8 }}>{log.requestPath}</span></span>}
                  </div>

                  {Object.keys(log.metadata).length > 0 && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Event Metadata</span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                        {Object.entries(log.metadata).map(([key, val]) => (
                          <div key={key} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: 'var(--accent-cyan)' }}>{key}:</span>{' '}
                            <span style={{ color: 'var(--text-primary)' }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
