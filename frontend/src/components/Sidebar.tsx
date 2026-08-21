import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, MessageSquare, FileText, Award, Cpu, LogOut, Video } from 'lucide-react';

interface SidebarProps {
  activePage: 'dashboard' | 'hub' | 'resume' | 'assessment' | 'simulator' | 'interview';
}

const Sidebar: React.FC<SidebarProps> = ({ activePage }) => {
  const activeUser = localStorage.getItem('audit_active_user') || 'anonymous';

  const handleLogout = async () => {
    const activeSessionId = localStorage.getItem('audit_session_id') || '';
    try {
      await fetch('http://localhost:5081/api/auth/logout', { method: 'POST',
        headers:{
          'Content-Type':'application/json',
          'X-Session-ID': activeSessionId
        },
        credentials: 'include' });
    } catch (err) {
      console.error('Logout backend request failed:', err);
    }
    localStorage.removeItem('audit_active_user');
    localStorage.removeItem('audit_session_id');
    window.location.reload();
  };

  const menuItems = [
    { id: 'dashboard', name: 'Audit Dashboard', path: '/', icon: Shield },
    { id: 'hub', name: 'Discussion Hub', path: '/hub', icon: MessageSquare },
    { id: 'resume', name: 'Resume Builder', path: '/resume', icon: FileText },
    { id: 'assessment', name: 'Skill Assessments', path: '/assessment', icon: Award },
    { id: 'interview', name: 'AI Interview', path: '/interview', icon: Video },
    { id: 'simulator', name: 'Event Simulator', path: '/simulate', icon: Cpu },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '260px',
      height: '100vh',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border-color)',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      zIndex: 100,
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Branding header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
          <Shield size={24} style={{ color: 'var(--accent-purple)', filter: 'drop-shadow(0 0 8px var(--accent-purple-glow))' }} />
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
            Achnet Audit
          </span>
        </div>

        {/* Menu Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <Link
                key={item.id}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  color: isActive ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(168, 85, 247, 0.2)' : 'transparent'}`,
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} style={{ color: isActive ? 'var(--accent-purple)' : 'var(--text-secondary)' }} />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer Profile area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border-color)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 8px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            color: 'var(--accent-purple)',
            textTransform: 'uppercase'
          }}>
            {activeUser[0] || '?'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Logged in as</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={activeUser}>
              {activeUser}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{
            width: '100%',
            justifyContent: 'center',
            gap: '8px',
            height: '36px',
            fontSize: '12px',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: 'var(--status-failed)'
          }}
        >
          <LogOut size={12} />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
