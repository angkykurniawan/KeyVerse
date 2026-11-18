import { Keyboard, LogOut, ShieldCheck, Swords, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';

export type AppPage = 'practice' | 'versus' | 'history' | 'admin';

interface NavbarProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
}

export function Navbar({ activePage, onNavigate }: NavbarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <button type="button" className="brand" onClick={() => onNavigate('practice')}>
          <BrandLogo size="md" />
        </button>

        <nav className="nav-links" aria-label="Menu utama">
          <button
            type="button"
            className={`nav-tab ${activePage === 'practice' ? 'active' : ''}`}
            onClick={() => onNavigate('practice')}
          >
            <Keyboard size={16} />
            Arena Solo
          </button>
          <button
            type="button"
            className={`nav-tab ${activePage === 'versus' ? 'active' : ''}`}
            onClick={() => onNavigate('versus')}
          >
            <Swords size={16} />
            Adu Ketik
          </button>
          <button
            type="button"
            className={`nav-tab ${activePage === 'history' ? 'active' : ''}`}
            onClick={() => onNavigate('history')}
          >
            <Trophy size={16} />
            Klasemen
          </button>
          {user?.role === 'admin' && (
            <button
              type="button"
              className={`nav-tab ${activePage === 'admin' ? 'active' : ''}`}
              onClick={() => onNavigate('admin')}
            >
              <ShieldCheck size={16} />
              Admin HQ
            </button>
          )}
        </nav>

        <div className="nav-right">
          {user && (
            <div className="user-chip">
              <div className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
              <span className="mono" style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                {user.username}
              </span>
              <span className={`role-badge ${user.role}`}>{user.role}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={logout}
            title="Keluar"
            aria-label="Keluar"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
