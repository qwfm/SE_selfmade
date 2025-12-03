import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { useApi } from './useApi'; // Імпортуємо наш хук

// Імпорт сторінок
import MainPage from './pages/MainPage';
import LotsPage from './pages/LotsPage';
import LotDetailPage from './pages/LotDetailPage';
import CreateLotPage from './pages/CreateLotPage';
import ProfilePage from './pages/ProfilePage';
import CompleteProfilePage from './pages/CompleteProfilePage'; // Нова сторінка

function App() {
  const { loginWithRedirect, logout, isAuthenticated, user, isLoading: authLoading } = useAuth0();
  const location = useLocation();
  const api = useApi();

  // Стан: чи заповнив юзер профіль?
  // null = ще не знаємо, false = ні, true = так
  const [isProfileComplete, setIsProfileComplete] = useState(null);

  // Перевіряємо профіль при вході
  useEffect(() => {
    if (isAuthenticated) {
      api.get('/users/me')
        .then(res => {
          // Якщо немає телефону - вважаємо профіль незаповненим
          if (!res.data.phone_number) {
            setIsProfileComplete(false);
          } else {
            setIsProfileComplete(true);
          }
        })
        .catch(err => {
          console.error("Error fetching profile:", err);
          // Якщо помилка, пускаємо (щоб не блокувати навічно), або обробляємо інакше
          setIsProfileComplete(true); 
        });
    } else {
      setIsProfileComplete(true); // Для гостей профіль "заповнений" (не потрібен)
    }
  }, [isAuthenticated, api]); // Залежність від api гарантує, що токен готовий

  // Поки Auth0 думає АБО поки ми перевіряємо базу даних -> спіннер
  if (authLoading || (isAuthenticated && isProfileComplete === null)) {
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
          <div className="spinner"></div>
          Завантаження...
        </div>
        <style>{`
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      </div>
    );
  }

  // ЯКЩО ПРОФІЛЬ НЕ ЗАПОВНЕНИЙ -> БЛОКУЄМО ВСЕ І ПОКАЗУЄМО ФОРМУ
  if (isAuthenticated && isProfileComplete === false) {
    return <CompleteProfilePage onComplete={() => setIsProfileComplete(true)} />;
  }

  // Звичайний рендер додатку
  const isActive = (path) => location.pathname === path;

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* --- HEADER / НАВІГАЦІЯ --- */}
      <nav style={{
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 2rem',
          height: '70px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          
          {/* Логотип та Меню */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
            <Link to="/" style={{ textDecoration: 'none', fontSize: '1.5rem', fontWeight: '800', color: '#4f46e5' }}>
              Bid&Buy
            </Link>

            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <Link 
                to="/lots" 
                style={isActive('/lots') ? activeLinkStyle : linkStyle}
              >
                Всі лоти
              </Link>
              
              {isAuthenticated && (
                <Link 
                  to="/create" 
                  style={isActive('/create') ? activeLinkStyle : linkStyle}
                >
                  Створити лот
                </Link>
              )}
            </div>
          </div>

          {/* Права частина: Профіль та Вхід/Вихід */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {isAuthenticated ? (
              <>
                <Link 
                  to="/profile" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    textDecoration: 'none',
                    color: '#374151',
                    fontWeight: '500'
                  }}
                >
                  <img 
                    src={user.picture} 
                    alt={user.name} 
                    style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #e5e7eb' }} 
                  />
                  <span>{user.nickname}</span>
                </Link>
                
                <button 
                  onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                  style={{
                    background: '#fee2e2',
                    color: '#991b1b',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    transition: 'background 0.2s'
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
                  border: 'none',
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(99, 102, 241, 0.3)',
                  transition: 'transform 0.1s'
                }}
              >
                Увійти
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* --- ОСНОВНИЙ КОНТЕНТ --- */}
      <div style={{ paddingBottom: '40px' }}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/lots" element={<LotsPage />} />
          <Route path="/lot/:id" element={<LotDetailPage />} />
          <Route path="/create" element={<CreateLotPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </div>

      {/* --- ГЛОБАЛЬНІ СТИЛІ --- */}
      <style>{`
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        body {
          margin: 0;
          background-color: #f9fafb; /* Світло-сірий фон для всього сайту */
        }
      `}</style>
    </div>
  );
}

// --- Стилі посилань ---
const linkStyle = {
  textDecoration: 'none',
  color: '#6b7280', // Сірий
  fontWeight: '500',
  fontSize: '1rem',
  transition: 'color 0.2s'
};

const activeLinkStyle = {
  ...linkStyle,
  color: '#4f46e5', // Індиго (активний)
  fontWeight: '700'
};

export default App;