import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { useApi } from './useApi';

// Імпорт сторінок
import MainPage from './pages/MainPage';
import LotsPage from './pages/LotsPage';
import LotDetailPage from './pages/LotDetailPage';
import CreateLotPage from './pages/CreateLotPage';
import ProfilePage from './pages/ProfilePage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import PaymentPage from './pages/PaymentPage';

function App() {
  const { loginWithRedirect, logout, isAuthenticated, user, isLoading: authLoading } = useAuth0();
  const location = useLocation();
  const api = useApi();

  // Стан профілю: null = невідомо, false = не заповнений, true = ок
  const [isProfileComplete, setIsProfileComplete] = useState(null);
  // Стан для повідомлення про бан
  const [banMessage, setBanMessage] = useState(null); 

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/users/me')
        .then(res => {
          // Якщо немає телефону - профіль не заповнений
          if (!res.data.phone_number) {
             setIsProfileComplete(false);
          } else {
             setIsProfileComplete(true);
          }
        })
        .catch(err => {
          // ПЕРЕВІРКА НА БАН (403)
          if (err.response && err.response.status === 403) {
             setBanMessage(err.response.data.detail); // Зберігаємо повідомлення
          } else {
             console.error("Auth check error:", err);
             // Якщо інша помилка (наприклад мережа), пускаємо, щоб не блокувати навічно
             setIsProfileComplete(true); 
          }
        });
    } else {
      // Для гостей перевірка не потрібна
      setIsProfileComplete(true);
    }
  }, [isAuthenticated, api]);

  // 1. СПІННЕР ЗАВАНТАЖЕННЯ
  // Показуємо, поки Auth0 думає АБО поки ми не перевірили профіль/бан
  if (authLoading || (isAuthenticated && isProfileComplete === null && !banMessage)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#6366f1' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner"></div>
          Завантаження...
        </div>
        <style>{`.spinner { width: 50px; height: 50px; border: 4px solid #e5e7eb; border-top: 4px solid #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 2. ЕКРАН БЛОКУВАННЯ (БАН)
  if (banMessage) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fef2f2', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(220,38,38,0.1)', maxWidth: '500px', textAlign: 'center', border: '2px solid #fecaca' }}>
          <div style={{ fontSize: '4rem', marginBottom: '10px' }}>⛔</div>
          <h2 style={{ color: '#991b1b', marginTop: 0, marginBottom: '10px' }}>Доступ заборонено</h2>
          <p style={{ fontSize: '1.1rem', color: '#374151', margin: '20px 0', lineHeight: '1.6', background: '#fff1f2', padding: '15px', borderRadius: '8px' }}>
            {banMessage}
          </p>
          <button 
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            style={{ ...logoutBtnStyle, background: '#ef4444', color: 'white', padding: '12px 24px', fontSize: '1rem', width: '100%' }}
          >
            Вийти з акаунту
          </button>
        </div>
      </div>
    );
  }

  // 3. ЕКРАН ЗАВЕРШЕННЯ РЕЄСТРАЦІЇ
  if (isAuthenticated && isProfileComplete === false) {
    return <CompleteProfilePage onComplete={() => setIsProfileComplete(true)} />;
  }

  const isActive = (path) => location.pathname === path;

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* --- НАВІГАЦІЯ --- */}
      <nav style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem', height: '70px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
            <Link to="/" style={{ textDecoration: 'none', fontSize: '1.5rem', fontWeight: '800', color: '#4f46e5' }}>Bid&Buy</Link>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <Link to="/lots" style={isActive('/lots') ? activeLinkStyle : linkStyle}>Всі лоти</Link>
              {isAuthenticated && <Link to="/create" style={isActive('/create') ? activeLinkStyle : linkStyle}>Створити лот</Link>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {isAuthenticated ? (
              <>
                <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#374151', fontWeight: '500' }}>
                  <img src={user.picture} alt={user.name} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #e5e7eb' }} />
                  <span>{user.nickname}</span>
                </Link>
                <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })} style={logoutBtnStyle}>Вийти</button>
              </>
            ) : (
              <button onClick={() => loginWithRedirect()} style={loginBtnStyle}>Увійти</button>
            )}
          </div>
        </div>
      </nav>

      {/* --- КОНТЕНТ --- */}
      <div style={{ paddingBottom: '40px' }}>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/lots" element={<LotsPage />} />
          <Route path="/lot/:id" element={<LotDetailPage />} />
          <Route path="/create" element={<CreateLotPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/payment/:lotId" element={<PaymentPage />} />
        </Routes>
      </div>

      <style>{`body { margin: 0; background-color: #f9fafb; }`}</style>
    </div>
  );
}

// Стилі
const linkStyle = { textDecoration: 'none', color: '#6b7280', fontWeight: '500', fontSize: '1rem', transition: 'color 0.2s' };
const activeLinkStyle = { ...linkStyle, color: '#4f46e5', fontWeight: '700' };
const logoutBtnStyle = { background: '#fee2e2', color: '#991b1b', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' };
const loginBtnStyle = { background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px rgba(99, 102, 241, 0.3)' };

export default App;