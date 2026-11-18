import { useEffect, useState } from 'react';
import { BrandLogo } from './components/BrandLogo';
import { Navbar, type AppPage } from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminPage, type AdminTab } from './pages/AdminPage';
import { HistoryPage } from './pages/HistoryPage';
import { LoginPage } from './pages/LoginPage';
import { PracticePage } from './pages/PracticePage';
import { VersusPage } from './pages/VersusPage';

const PAGE_TITLES: Record<AppPage, string> = {
  practice: 'Arena Solo — KeyVerse',
  versus: 'Adu Ketik vs Kawan — KeyVerse',
  history: 'Klasemen & Progres — KeyVerse',
  admin: 'Admin HQ — KeyVerse',
};

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<AppPage>('practice');
  const [adminInitialTab, setAdminInitialTab] = useState<AdminTab>('users');

  useEffect(() => {
    if (user && user.role !== 'admin' && page === 'admin') {
      setPage('practice');
    }
  }, [user, page]);

  useEffect(() => {
    if (!user) {
      document.title = 'Racer Check-In — KeyVerse';
    } else {
      document.title = PAGE_TITLES[page];
    }
  }, [user, page]);

  const goToAdminAiConfig = () => {
    setAdminInitialTab('ai');
    setPage('admin');
  };

  if (loading) {
    return (
      <div className="login-page">
        <div className="stack-md" style={{ alignItems: 'center' }}>
          <BrandLogo size="lg" />
          <div className="row" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            <span className="spinner" />
            Menyiapkan Arena KeyVerse...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <Navbar
        activePage={page}
        onNavigate={(next) => {
          if (next === 'admin') setAdminInitialTab('users');
          setPage(next);
        }}
      />

      <main className="container">
        {page === 'practice' && <PracticePage onOpenAdminAi={goToAdminAiConfig} />}
        {page === 'versus' && <VersusPage onOpenAdminAi={goToAdminAiConfig} />}
        {page === 'history' && <HistoryPage />}
        {page === 'admin' && user.role === 'admin' && (
          <AdminPage initialTab={adminInitialTab} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
