import React from 'react';
import { X, Copy, Terminal, History, Tag } from 'lucide-react';
import type { AuditLog } from '../types';

interface LogDetailsModalProps {
  log: AuditLog | null;
  onClose: () => void;
  onTraceJourney: (type: 'user' | 'session', value: string) => void;
  onFilterCorrelation: (correlationId: string) => void;
}

export const LogDetailsModal: React.FC<LogDetailsModalProps> = ({
  log,
  onClose,
  onTraceJourney,
  onFilterCorrelation,
}) => {
  if (!log) return null;

  const handleCopyId = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied Correlation ID to clipboard!');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <Terminal size={18} style={{ color: 'var(--accent-purple)' }} />
            Audit Log Inspection
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Action Header Summary */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <span className="badge badge-info" style={{ marginBottom: '8px' }}>
              {log.eventType}
            </span>
            <h4 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {log.module}
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Logged on {new Date(log.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Details Metadata grid */}
          <div className="details-grid">
            <div>
              <div className="detail-label">User ID</div>
              <div className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {log.userId || 'Anonymous (Not Auth)'}
              </div>
            </div>
            <div>
              <div className="detail-label">Session ID</div>
              <div className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {log.sessionId}
              </div>
            </div>
            <div>
              <div className="detail-label">Execution Status</div>
              <div className="detail-value">
                <span
                  style={{
                    color: log.status === 'SUCCESS' ? 'var(--status-success)' : 'var(--status-failed)',
                    fontWeight: 600,
                  }}
                >
                  {log.status}
                </span>
              </div>
            </div>
            <div>
              <div className="detail-label">IP Address</div>
              <div className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {log.ipAddress}
              </div>
            </div>
            <div>
              <div className="detail-label">Correlation ID</div>
              <div
                className="detail-value"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{log.correlationId}</span>
                <button
                  onClick={() => handleCopyId(log.correlationId)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer' }}
                  title="Copy ID"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* User Agent */}
          <div>
            <div className="detail-label">User Agent</div>
            <div className="detail-value" style={{ fontSize: '12px', whiteSpace: 'normal', wordBreak: 'break-all' }}>
              {log.userAgent}
            </div>
          </div>

          {/* Context path */}
          {log.requestPath && (
            <div>
              <div className="detail-label">Request Route Path</div>
              <div className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                {log.requestPath}
              </div>
            </div>
          )}

          {/* Metadata JSON Block */}
          <div>
            <div className="detail-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Tag size={12} />
              Metadata payload
            </div>
            <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
          </div>

          {/* Journey Link Actions */}
          <div style={{ marginTop: '10px' }}>
            <div className="detail-label" style={{ marginBottom: '8px' }}>
              Journey Tracking Actions
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {log.userId && (
                <button onClick={() => onTraceJourney('user', log.userId!)} className="btn btn-secondary">
                  <History size={14} />
                  Trace User Journey
                </button>
              )}
              <button onClick={() => onTraceJourney('session', log.sessionId)} className="btn btn-secondary">
                <History size={14} />
                Trace Session Journey
              </button>
              <button onClick={() => onFilterCorrelation(log.correlationId)} className="btn btn-secondary">
                <Terminal size={14} />
                Filter Correlation Logs
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-primary">
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
