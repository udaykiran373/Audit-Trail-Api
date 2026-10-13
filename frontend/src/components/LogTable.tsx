import React, { useState } from 'react';
import { ArrowUpDown, Copy, Check, Eye } from 'lucide-react';
import type { AuditLog } from '../types';

interface LogTableProps {
  items: AuditLog[];
  onSelectLog: (log: AuditLog) => void;
  onSort: (field: string) => void;
  sortBy?: string;
  isAscending?: boolean;
}

export const LogTable: React.FC<LogTableProps> = ({
  items,
  onSelectLog,
  onSort,
  sortBy,
  isAscending,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return <span className="badge badge-success">Success</span>;
      case 'FAILED':
      case 'ERROR':
        return <span className="badge badge-failed">{status}</span>;
      case 'WARNING':
        return <span className="badge badge-warning">Warning</span>;
      default:
        return <span className="badge badge-info">{status}</span>;
    }
  };

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderSortIndicator = (field: string) => {
    if (sortBy === field) {
      return (
        <span style={{ marginLeft: '4px', display: 'inline-block', color: 'var(--accent-purple)' }}>
          {isAscending ? '▲' : '▼'}
        </span>
      );
    }
    return <ArrowUpDown size={12} style={{ marginLeft: '4px', opacity: 0.4 }} />;
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="table-container">
      {items.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No audit logs found matching the filter criteria.
        </div>
      ) : (
        <table className="audit-table">
          <thead>
            <tr>
              <th onClick={() => onSort('Timestamp')} style={{ cursor: 'pointer' }}>
                Timestamp {renderSortIndicator('Timestamp')}
              </th>
              <th onClick={() => onSort('EventType')} style={{ cursor: 'pointer' }}>
                Event Type {renderSortIndicator('EventType')}
              </th>
              <th onClick={() => onSort('Module')} style={{ cursor: 'pointer' }}>
                Module {renderSortIndicator('Module')}
              </th>
              <th>User ID</th>
              <th>Status</th>
              <th>Correlation ID</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Inspect</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log) => (
              <tr key={log.id} onClick={() => onSelectLog(log)}>
                <td style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                  {formatTimestamp(log.timestamp)}
                </td>
                <td>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: log.eventType === 'AUTHENTICATION' ? 'var(--accent-cyan)' : 'var(--text-primary)',
                    }}
                  >
                    {log.eventType}
                  </span>
                </td>
                <td style={{ fontWeight: 500, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.module}
                </td>
                <td>
                  {log.userId ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{log.userId}</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>anonymous</span>
                  )}
                </td>
                <td>{getStatusBadge(log.status)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', opacity: 0.7 }}>
                      {log.correlationId.substring(0, 8)}...
                    </span>
                    <button
                      onClick={(e) => handleCopy(e, log.correlationId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedId === log.correlationId ? 'var(--status-success)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                      title="Copy Correlation ID"
                    >
                      {copiedId === log.correlationId ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-blue)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                    title="View details"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
