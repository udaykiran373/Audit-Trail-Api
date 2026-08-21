import React from 'react';
import { Database, ShieldAlert, Users, Layers } from 'lucide-react';
import type { AuditLog } from '../types';

interface DashboardStatsProps {
  totalCount: number;
  items: AuditLog[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ totalCount, items }) => {
  // Compute some quick client-side stats from the visible logs list
  const failureCount = items.filter(
    (item) => item.status === 'FAILED' || item.eventType === 'ERROR'
  ).length;
  
  const uniqueSessions = new Set(items.map((item) => item.sessionId)).size;
  const uniqueUsers = new Set(items.map((item) => item.userId).filter(Boolean)).size;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon" style={{ color: 'var(--accent-blue)', background: 'rgba(0, 98, 255, 0.1)' }}>
          <Database size={22} />
        </div>
        <div className="stat-info">
          <span className="stat-value">{totalCount}</span>
          <span className="stat-title">Total Audit Logs</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ color: 'var(--status-failed)', background: 'rgba(239, 68, 68, 0.1)' }}>
          <ShieldAlert size={22} />
        </div>
        <div className="stat-info">
          <span className="stat-value">{failureCount}</span>
          <span className="stat-title">Active Log Failures</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ color: 'var(--accent-purple)', background: 'rgba(138, 43, 226, 0.1)' }}>
          <Users size={22} />
        </div>
        <div className="stat-info">
          <span className="stat-value">{uniqueSessions}</span>
          <span className="stat-title">Unique Sessions (Page)</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ color: 'var(--status-info)', background: 'rgba(59, 130, 246, 0.1)' }}>
          <Layers size={22} />
        </div>
        <div className="stat-info">
          <span className="stat-value">{uniqueUsers}</span>
          <span className="stat-title">Unique Active Users</span>
        </div>
      </div>
    </div>
  );
};
