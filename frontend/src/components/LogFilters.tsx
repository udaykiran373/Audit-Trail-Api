import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import type { SearchFilters } from '../types';

interface LogFiltersProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onReset: () => void;
}

export const LogFilters: React.FC<LogFiltersProps> = ({ filters, onChange, onReset }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onChange({
      ...filters,
      [name]: value,
      page: 1, // Reset page to 1 when filters change
    });
  };

  return (
    <div className="filter-bar glass-card" style={{ padding: '20px', gap: '16px' }}>
      {/* Search Input */}
      <div style={{ flex: '1 1 250px', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <Search size={16} />
        </span>
        <input
          type="text"
          name="search"
          placeholder="Search by action, path, user ID..."
          value={filters.search || ''}
          onChange={handleInputChange}
          className="input-field"
          style={{ paddingLeft: '38px' }}
        />
      </div>

      {/* Event Type Filter */}
      <div style={{ flex: '1 1 150px' }}>
        <select
          name="eventType"
          value={filters.eventType || ''}
          onChange={handleInputChange}
          className="input-field"
        >
          <option value="">All Event Types</option>
          <option value="AUTHENTICATION">Authentication</option>
          <option value="INTERVIEW">Interview</option>
          <option value="ASSESSMENT">Assessment</option>
          <option value="API_CALL">API Call</option>
          <option value="API_FAILURE">API Failure</option>
          <option value="ERROR">System Error</option>
          <option value="BUSINESS_EVENT">Business Event</option>
        </select>
      </div>

      {/* Status Filter */}
      <div style={{ flex: '1 1 120px' }}>
        <select
          name="status"
          value={filters.status || ''}
          onChange={handleInputChange}
          className="input-field"
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
      </div>

      {/* Module Filter */}
      <div style={{ flex: '1 1 120px' }}>
        <select
          name="module"
          value={filters.module || ''}
          onChange={handleInputChange}
          className="input-field"
        >
          <option value="">All Modules</option>
          <option value="Auth">Auth</option>
          <option value="Interview">Interview</option>
          <option value="Assessment">Assessment</option>
          <option value="API">API</option>
          <option value="Simulation">Simulation</option>
        </select>
      </div>

      {/* Date Range Inputs */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '1 1 300px' }}>
        <input
          type="datetime-local"
          name="fromDate"
          value={filters.fromDate || ''}
          onChange={handleInputChange}
          className="input-field"
          title="From Date"
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
        <input
          type="datetime-local"
          name="toDate"
          value={filters.toDate || ''}
          onChange={handleInputChange}
          className="input-field"
          title="To Date"
        />
      </div>

      {/* Correlation ID search */}
      <div style={{ flex: '1 1 200px' }}>
        <input
          type="text"
          name="correlationId"
          placeholder="Correlation ID"
          value={filters.correlationId || ''}
          onChange={handleInputChange}
          className="input-field"
        />
      </div>

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="btn btn-secondary"
        style={{ height: '42px' }}
        title="Reset filters"
      >
        <RotateCcw size={16} />
        Reset
      </button>
    </div>
  );
};
