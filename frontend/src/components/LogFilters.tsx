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
          <option value="Authentication">Authentication</option>
          <option value="Interview">Interview</option>
          <option value="Assessment">Assessment</option>
          <option value="Resume">Resume</option>
          <option value="Hub">Hub</option>
          <option value="API">API</option>
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

      <div style={{ flex: '1 1 150px' }}>
        <select
          name="module"
          value={filters.module || ''}
          onChange={handleInputChange}
          className="input-field"
        >
          <option value="">All Modules (Actions)</option>
          <optgroup label="Assessment & Interview">
            <option value="Opened">Opened</option>
            <option value="PermissionsGranted">Permissions Granted</option>
            <option value="Started">Started</option>
            <option value="ProctoringWarning">Proctoring Warning</option>
            <option value="Submitted">Submitted</option>
            <option value="Completed">Completed</option>
            <option value="InterviewCompleted">Interview Completed</option>
          </optgroup>
          <optgroup label="Authentication">
            <option value="USER_REGISTERED">User Registered</option>
            <option value="LOGIN_SUCCESS">Login Success</option>
            <option value="LOGIN_FAILED">Login Failed</option>
            <option value="LOGOUT">Logout</option>
          </optgroup>
          <optgroup label="Hub / Posts">
            <option value="VIEW_HUB">View Hub</option>
            <option value="CREATE_POST">Create Post</option>
            <option value="LIKE_POST">Like Post</option>
            <option value="UNLIKE_POST">Unlike Post</option>
            <option value="DELETE_POST">Delete Post</option>
          </optgroup>
          <optgroup label="Resume">
            <option value="VIEW_RESUME">View Resume</option>
            <option value="RESUME_UPDATED">Resume Updated</option>
            <option value="RESUME_DOWNLOADED">Resume Downloaded</option>
          </optgroup>
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
