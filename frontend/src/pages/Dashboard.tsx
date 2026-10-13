import React, { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import type { AuditLog, SearchFilters, PaginatedResult } from '../types';
import { DashboardStats } from '../components/DashboardStats';
import { LogFilters } from '../components/LogFilters';
import { LogTable } from '../components/LogTable';
import { LogDetailsModal } from '../components/LogDetailsModal';
import { TimelineView } from '../components/TimelineView';
import Sidebar from '../components/Sidebar';
import {API_BASE_URL} from '../config';

// const API_BASE_URL = 'http://localhost:5081/api';

const getHeaders = () => {
  const activeUser = localStorage.getItem('audit_active_user') || 'anonymous';
  const activeSessionId = localStorage.getItem('audit_session_id') || crypto.randomUUID();
  return {
    'X-User-ID': activeUser,
    'X-Session-ID': activeSessionId
  };
};




const getLogById = async (id: string): Promise<AuditLog> => {
  const response = await fetch(`${API_BASE_URL}/audit/${id}`, {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch log details');
  return response.json();
};

const getTimeline = async (userId?: string, sessionId?: string): Promise<AuditLog[]> => {
  const params = new URLSearchParams();
  if (userId) params.append('userId', userId);
  if (sessionId) params.append('sessionId', sessionId);
  const response = await fetch(`${API_BASE_URL}/audit/timeline?${params.toString()}`, {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch timeline');
  return response.json();
};

const DEFAULT_FILTERS: SearchFilters = {
  search: '',
  userId: '',
  sessionId: '',
  eventType: '',
  status: '',
  module: '',
  correlationId: '',
  page: 1,
  pageSize: 15,
  sortBy: 'Timestamp',
  isAscending: false,
};

const Dashboard: React.FC = () => {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [logsResult, setLogsResult] = useState<PaginatedResult<AuditLog>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 15,
    totalPages: 1,
  });
  const [nlpQuery, setNlpQuery] = useState('');
  const [activeNlpQuery, setActiveNlpQuery] = useState('');
  const [timelineLogs, setTimelineLogs] = useState<AuditLog[] | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTimelineView, setIsTimelineView] = useState(false);
  const [directIdLookup, setDirectIdLookup] = useState('');
  const [lastAction, setLastAction] = useState<'UI' | 'NLP'>('UI');

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isTimelineView) {
        const data = await getTimeline(filters.userId, filters.sessionId);
        setTimelineLogs(data);
        return;
      }

      // 1. Build standard filters payload
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      // 2. Determine Endpoint & Apply Priority
      let url = `${API_BASE_URL}/audit?${params.toString()}`;
      
      if (activeNlpQuery && activeNlpQuery.trim() !== '') {
        params.append('query', activeNlpQuery.trim());
        params.append('priority', lastAction); // Tells C# who wins a clash ('UI' or 'NLP')
        url = `${API_BASE_URL}/audit/search/nlp?${params.toString()}`;
      }

      // 3. Fetch Unified Data
      const response = await fetch(url, { headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch unified logs');
      
      const data = await response.json();
      
      // 4. Standardize the result shape for your table
      const currentPageSize = filters.pageSize || 15;
      setLogsResult({
        items: data.items || data.data,
        totalCount: data.totalCount,
        page: data.currentPage || data.page,
        pageSize: currentPageSize,
        totalPages: data.totalPages
      });
      
    } catch (err) {
      console.error("Unified load failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, isTimelineView, activeNlpQuery, lastAction]); // Dependencies updated!

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleFilterChange = (newFilters: SearchFilters) => {
    setLastAction('UI'); // The user clicked a dropdown! UI wins!
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleSort = (field: string) => {
    setLastAction('UI');
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      isAscending: prev.sortBy === field ? !prev.isAscending : true,
      page: 1,
    }));
  };

  const handleTraceJourney = (type: 'user' | 'session', value: string) => {
    setIsTimelineView(true);
    setFilters({
      ...DEFAULT_FILTERS,
      userId: type === 'user' ? value : '',
      sessionId: type === 'session' ? value : '',
    });
    setSelectedLog(null);
  };

  const handleFilterCorrelation = (correlationId: string) => {
    setIsTimelineView(false);
    setFilters({
      ...DEFAULT_FILTERS,
      correlationId: correlationId,
    });
    setSelectedLog(null);
  };

  const handleDirectIdLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directIdLookup.trim()) return;

    setIsLoading(true);
    try {
      const log = await getLogById(directIdLookup.trim());
      setSelectedLog(log);
      setDirectIdLookup('');
    } catch (err) {
      alert('Audit log ID not found in database. Make sure it is a valid 24-character hex ID.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeUser = localStorage.getItem('audit_active_user') || 'Guest';
  const displayedLogs = logsResult.items;
  const handleNlpSearch = async (e?: React.FormEvent, targetPage: number = 1) => {
    if (e) e.preventDefault();
    if (!nlpQuery.trim()) return;

    setLastAction('NLP'); // The user clicked AI search! NLP wins!
    setActiveNlpQuery(nlpQuery.trim()); // Only update this when they hit Search!
    
    // Just update the page filter; loadLogs will automatically run and route it to the NLP endpoint
    setFilters((prev) => ({ ...prev, page: targetPage })); 
  };

  const handleRefresh = () => {
    if (activeNlpQuery.trim() !== '' || nlpQuery.trim() !== '') {
      setNlpQuery('');
      setActiveNlpQuery('');
      setLastAction('UI');
      setFilters(DEFAULT_FILTERS);
    } else {
      loadLogs();
    }
  };
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar activePage="dashboard" />
      
      <div className="dashboard-panel" style={{ flex: 1, marginLeft: '260px', padding: '32px 24px', maxWidth: '1200px', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="neon-title">
              <Shield size={26} style={{ color: 'var(--accent-purple)' }} />
              Enterprise Activity Logging Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Centralized security audit logs, anomaly detection and user journey reconstruction.
            </p>
          </div>
          
          {/* Right side controls */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <form onSubmit={handleDirectIdLookup} style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Lookup Log ID..."
                value={directIdLookup}
                onChange={(e) => setDirectIdLookup(e.target.value)}
                className="input-field"
                style={{ width: '180px', padding: '8px 12px', fontSize: '13px', height: '38px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '13px', height: '38px' }}>
                Lookup
              </button>
            </form>
            <form onSubmit={handleNlpSearch} style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
              <input
                type="text"
                placeholder="e.g., get the modules of type event"
                value={nlpQuery}
                onChange={(e) => setNlpQuery(e.target.value)}
                className="input-field"
                style={{ width: '250px', padding: '8px 12px', fontSize: '13px', height: '38px', border: '1px solid var(--accent-purple)' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '13px', height: '38px', background: 'var(--accent-purple)' }}>
                AI Search
              </button>
            </form>

            <button onClick={handleRefresh} className="btn btn-secondary" disabled={isLoading} style={{ height: '38px' }}>
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
              Refresh Logs
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <DashboardStats totalCount={logsResult.totalCount} items={logsResult.items} />

        {/* Switcher: Timeline vs Table Grid */}
        <div className="view-switcher-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
          <div className="tabs-container">
            <button
              onClick={() => {
                setIsTimelineView(false);
                setFilters(DEFAULT_FILTERS);
              }}
              className={`tab-btn ${!isTimelineView ? 'active' : ''}`}
            >
              Logs Database Grid
            </button>
            <button
              onClick={() => {
                setIsTimelineView(true);
                if (!filters.userId && !filters.sessionId) {
                  setFilters((prev) => ({ ...prev, userId: activeUser }));
                }
              }}
              className={`tab-btn ${isTimelineView ? 'active' : ''}`}
            >
              User Journey Timeline
            </button>
          </div>
        </div>

        {/* Dynamic Display area */}
        {isTimelineView ? (
          <TimelineView
            logs={timelineLogs || []}
            title={filters.userId ? `Tracing logs for user: ${filters.userId}` : `Tracing logs for session: ${filters.sessionId}`}
            onClose={() => {
              setIsTimelineView(false);
              setFilters(DEFAULT_FILTERS);
            }}
          />
        ) : (
          <div>
            <LogFilters
              filters={filters}
              onChange={handleFilterChange}
              onReset={() => setFilters(DEFAULT_FILTERS)}
            />
            <LogTable
              items={displayedLogs} 
              onSelectLog={setSelectedLog}
              onSort={handleSort}
              sortBy={filters.sortBy || 'Timestamp'} 
              isAscending={filters.isAscending ?? false} 
            />

            {/* Pagination footer */}
            {!isLoading && logsResult.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                <button
                  disabled={filters.page === 1}
                  onClick={() => handlePageChange((filters.page || 1) - 1)}
                  className="btn btn-secondary"
                  style={{ opacity: filters.page === 1 ? 0.4 : 1 }}
                >
                  <ArrowLeft size={14} />
                  Prev
                </button>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Page <strong style={{ color: 'var(--text-primary)' }}>{filters.page}</strong> of{' '}
                  {logsResult.totalPages}
                </span>
                <button
                  disabled={filters.page === logsResult.totalPages}
                  onClick={() => handlePageChange((filters.page || 1) + 1)}
                  className="btn btn-secondary"
                  style={{ opacity: filters.page === logsResult.totalPages ? 0.4 : 1 }}
                >
                  Next
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Details drawer popup */}
        {selectedLog && (
          <LogDetailsModal
            log={selectedLog}
            onClose={() => setSelectedLog(null)}
            onTraceJourney={handleTraceJourney}
            onFilterCorrelation={handleFilterCorrelation}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;