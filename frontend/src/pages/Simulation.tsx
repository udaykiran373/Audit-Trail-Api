import React, { useState } from 'react';
import { RefreshCw, Play, Pause, Square, CheckSquare, ShieldAlert, Cpu } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const API_BASE_URL = 'http://localhost:5081/api';

const getHeaders = (userId: string, sessionId: string) => ({
  'Content-Type': 'application/json',
  'X-Session-ID': sessionId,
  'X-User-ID': userId,
});

const simulateInterview = async (action: string, userId: string, sessionId: string) => {
  const response = await fetch(`${API_BASE_URL}/simulation/interview/${action.toLowerCase()}`, {
    method: 'POST',
    headers: getHeaders(userId, sessionId),
    body: JSON.stringify({ userId, sessionId }),
  });
  if (!response.ok) throw new Error(`Failed to simulate interview action: ${action}`);
  return response.json();
};

const simulateAssessment = async (userId: string, sessionId: string, score: number, passed: boolean) => {
  const response = await fetch(`${API_BASE_URL}/simulation/assessment`, {
    method: 'POST',
    headers: getHeaders(userId, sessionId),
    body: JSON.stringify({ userId, sessionId, score, passed }),
  });
  if (!response.ok) throw new Error('Failed to simulate assessment');
  return response.json();
};

const simulateApiFailure = async (userId: string, sessionId: string) => {
  const response = await fetch(`${API_BASE_URL}/simulation/api-failure`, {
    method: 'POST',
    headers: getHeaders(userId, sessionId),
    body: JSON.stringify({ userId, sessionId }),
  });
  return response.json().catch(() => ({ error: 'Connection failure logged.' }));
};

const Simulation: React.FC = () => {
  const [sessionId, setSessionId] = useState('sess_portal_default');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const activeUser = localStorage.getItem('audit_active_user') || 'Guest';

  const triggerToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  const generateNewSession = () => {
    const newSessId = 'sess_' + Math.random().toString(36).substring(2, 11);
    setSessionId(newSessId);
    triggerToast(`Session ID regenerated: ${newSessId}`, 'success');
  };

  const runSimulation = async (actionKey: string, apiCall: () => Promise<any>) => {
    setLoadingAction(actionKey);
    try {
      const res = await apiCall();
      triggerToast(res.message || 'Simulation event successfully logged.', 'success');
    } catch (err: any) {
      triggerToast(err.message || 'Simulation logged failure state.', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar activePage="simulator" />

      <div style={{ flex: 1, marginLeft: '260px', padding: '32px 24px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          
          {/* Simulator Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
            <div>
              <h2 className="neon-title">
                <Cpu size={24} style={{ color: 'var(--accent-purple)' }} />
                Audit Event Simulator
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Perform actions as <strong style={{ color: 'var(--accent-purple)' }}>{activeUser}</strong> to write live logs.
              </p>
            </div>

            <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: 0 }} />

            {/* Context Setup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 className="section-title" style={{ fontSize: '13px', marginBottom: '8px' }}>
                Simulation Context Settings
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Simulating for Logged-In User:</span>
                <strong style={{ color: 'var(--text-primary)', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'block' }}>
                  {activeUser}
                </strong>
              </div>

              <div>
                <label className="form-label">Active Session ID</label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="input-field"
                  placeholder="Session identifier..."
                />
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button onClick={generateNewSession} className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }}>
                  <RefreshCw size={12} />
                  Regen Session
                </button>
              </div>
            </div>

            {/* Interview Lifecycle */}
            <div className="simulation-group">
              <h4 className="form-label" style={{ fontWeight: 600 }}>Interview Lifecycle</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  disabled={loadingAction !== null}
                  onClick={() => runSimulation('int_start', () => simulateInterview('START', activeUser, sessionId))}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', fontSize: '12px' }}
                >
                  <Play size={13} style={{ color: 'var(--accent-blue)' }} />
                  Start Interview
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    disabled={loadingAction !== null}
                    onClick={() => runSimulation('int_pause', () => simulateInterview('PAUSE', activeUser, sessionId))}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    <Pause size={13} style={{ color: 'var(--status-warning)' }} />
                    Pause
                  </button>
                  <button
                    disabled={loadingAction !== null}
                    onClick={() => runSimulation('int_resume', () => simulateInterview('RESUME', activeUser, sessionId))}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px' }}
                  >
                    <Play size={13} style={{ color: 'var(--status-info)' }} />
                    Resume
                  </button>
                </div>
                <button
                  disabled={loadingAction !== null}
                  onClick={() => runSimulation('int_complete', () => simulateInterview('COMPLETE', activeUser, sessionId))}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', fontSize: '12px' }}
                >
                  <Square size={13} style={{ color: 'var(--status-success)' }} />
                  Complete Interview
                </button>
              </div>
            </div>

            {/* Assessment Simulators */}
            <div className="simulation-group">
              <h4 className="form-label" style={{ fontWeight: 600 }}>Assessments</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  disabled={loadingAction !== null}
                  onClick={() => runSimulation('assess_pass', () => simulateAssessment(activeUser, sessionId, 85, true))}
                  className="btn btn-secondary"
                  style={{ fontSize: '12px' }}
                >
                  <CheckSquare size={13} style={{ color: 'var(--status-success)' }} />
                  Simulate Assessment Pass
                </button>
                <button
                  disabled={loadingAction !== null}
                  onClick={() => runSimulation('assess_fail', () => simulateAssessment(activeUser, sessionId, 40, false))}
                  className="btn btn-secondary"
                  style={{ fontSize: '12px' }}
                >
                  <ShieldAlert size={13} style={{ color: 'var(--status-failed)' }} />
                  Simulate Assessment Fail
                </button>
              </div>
            </div>

            {/* API Failures */}
            <div className="simulation-group">
              <h4 className="form-label" style={{ fontWeight: 600 }}>API Failures</h4>
              <button
                disabled={loadingAction !== null}
                onClick={() => runSimulation('api_fail', () => simulateApiFailure(activeUser, sessionId))}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'flex-start', fontSize: '12px' }}
              >
                <ShieldAlert size={13} style={{ color: 'var(--status-failed)' }} />
                Trigger Mock Server Crash (500 Error)
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Toast Alert */}
      {toast.show && (
        <div className={`notification-toast ${toast.type}`} style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '12px 20px',
          borderRadius: '8px',
          background: toast.type === 'success' ? 'var(--status-success-bg)' : 'var(--status-failed-bg)',
          border: `1px solid ${toast.type === 'success' ? 'var(--status-success)' : 'var(--status-failed)'}`,
          color: toast.type === 'success' ? 'var(--status-success)' : 'var(--status-failed)',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
          zIndex: 1000,
          animation: 'modalSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default Simulation;
