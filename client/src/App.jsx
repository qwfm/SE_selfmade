// src/App.jsx
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import LotsPage from './pages/LotsPage';
import LotDetailPage from './pages/LotDetailPage';
import CreateLotPage from './pages/CreateLotPage';
import ProfilePage from './pages/ProfilePage';

function App() {
  const { loginWithRedirect, logout, isAuthenticated, user, isLoading } = useAuth0();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '1.2rem',
        color: '#6366f1'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          Завантаження...
        </div>
      </div>
    );
  }

  const isActive = (path) => location.pathname === path;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* HEADER */}
      <nav style={{
        background: 'white',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        padding: '1rem 2rem',
        marginBottom: '2rem',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '2rem'
        }}>
          <Link to="/" style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textDecoration: 'none'
          }}>
            Bid&Buy
          </Link>
          
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flex: 1 }}>
            <Link 
              to="/" 
              style={{
                color: isActive('/') ? '#6366f1' : '#6b7280',
                fontWeight: isActive('/') ? '600' : '400',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: isActive('/') ? '#eef2ff' : 'transparent',
                transition: 'all 0.2s'
              }}
            >
              Всі лоти
            </Link>
            {isAuthenticated && (
              <>
                <Link 
                  to="/create" 
                  style={{
                    color: isActive('/create') ? '#6366f1' : '#6b7280',
                    fontWeight: isActive('/create') ? '600' : '400',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    background: isActive('/create') ? '#eef2ff' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  Створити лот
                </Link>
                <Link 
                  to="/profile" 
                  style={{
                    color: isActive('/profile') ? '#6366f1' : '#6b7280',
                    fontWeight: isActive('/profile') ? '600' : '400',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    background: isActive('/profile') ? '#eef2ff' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  Мій профіль
                </Link>
              </>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isAuthenticated ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {user?.picture && (
                    <img 
                      src={user.picture} 
                      alt={user.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '2px solid #e5e7eb'
                      }}
                    />
                  )}
                  <span style={{ color: '#374151', fontWeight: '500' }}>
                    {user?.name || 'Користувач'}
                  </span>
                </div>
                <button 
                  onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.9rem'
                  }}
                >
                  Вийти
                </button>
              </>
            ) : (
              <button 
                onClick={() => loginWithRedirect()}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  padding: '0.5rem 1.5rem',
                  fontWeight: '600'
                }}
              >
                Увійти
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ROUTES */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem 2rem' }}>
        <Routes>
          <Route path="/" element={<LotsPage />} />
          <Route path="/lot/:id" element={<LotDetailPage />} />
          <Route path="/create" element={<CreateLotPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;