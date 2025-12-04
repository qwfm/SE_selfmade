import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState, useRef } from 'react';
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
  const { loginWithRedirect, logout, isAuthenticated, user } = useAuth0();
  const api = useApi();
  
  const [isProfileComplete, setIsProfileComplete] = useState(null);
  
  // Нотифікації
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/users/me')
        .then(res => setIsProfileComplete(!!res.data.phone_number))
        .catch(() => {});

      fetchNotifications();
    }
  }, [isAuthenticated, api]);

  const fetchNotifications = async () => {
      try {
          const res = await api.get('/users/notifications');
          setNotifications(res.data);
      } catch (e) { console.error(e); }
  };

  // --- ЛОГІКА ВІДКРИТТЯ ТА "ПРОЧИТАННЯ" ---
  const handleToggleNotifications = async () => {
      if (!showNotifDropdown) {
          // Якщо ми ВІДКРИВАЄМО список:
          setShowNotifDropdown(true);
          
          // 1. Якщо є непрочитані - відправляємо запит на бекенд
          const hasUnread = notifications.some(n => !n.is_read);
          if (hasUnread) {
              try {
                  await api.post('/users/notifications/read');
                  // 2. Оновлюємо локальний стан (прибираємо червоний кружечок миттєво)
                  setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
              } catch (e) { console.error("Error marking read", e); }
          }
      } else {
          // Закриваємо
          setShowNotifDropdown(false);
      }
  };

  useEffect(() => {
      function handleClickOutside(event) {
          if (notifRef.current && !notifRef.current.contains(event.target)) {
              setShowNotifDropdown(false);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifRef]);

  if (isAuthenticated && isProfileComplete === false) {
    return <CompleteProfilePage onComplete={() => setIsProfileComplete(true)} />;
  }

  // Рахуємо тільки ті, де is_read === false
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: '#111827' }}>
      
      <nav style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <Link to="/" style={{ textDecoration: 'none', fontSize: '1.5rem', fontWeight: '900', color: '#4f46e5' }}>
            Bid&Buy ⚡
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Link to="/lots" style={linkStyle}>Всі лоти</Link>
            
            {isAuthenticated ? (
              <>
                <Link to="/create" style={linkStyle}>Створити лот</Link>
                
                {/* ДЗВІНОЧОК */}
                <div style={{ position: 'relative' }} ref={notifRef}>
                    <button 
                        onClick={handleToggleNotifications}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '5px' }}
                    >
                        <span style={{ fontSize: '1.4rem' }}>🔔</span>
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '0', right: '0',
                                background: '#ef4444', color: 'white',
                                fontSize: '0.7rem', fontWeight: 'bold',
                                borderRadius: '50%', width: '18px', height: '18px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifDropdown && (
                        <div style={{
                            position: 'absolute', right: 0, top: '40px',
                            width: '320px', background: 'white',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                            borderRadius: '12px', border: '1px solid #e5e7eb',
                            overflow: 'hidden', zIndex: 200
                        }}>
                            <div style={{ padding: '12px', borderBottom: '1px solid #f3f4f6', fontWeight: 'bold', background: '#f9fafb' }}>
                                Сповіщення
                            </div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                                        Немає повідомлень
                                    </div>
                                ) : (
                                    notifications.map(note => (
                                        <div key={note.id} style={{ padding: '12px', borderBottom: '1px solid #f3f4f6', fontSize: '0.9rem', background: note.is_read ? 'white' : '#eff6ff' }}>
                                            <p style={{ margin: '0 0 5px 0', lineHeight: '1.4' }}>{note.message}</p>
                                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                                {new Date(note.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <Link to="/profile" style={linkStyle}>Профіль</Link>
                <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })} style={logoutBtnStyle}>Вийти</button>
              </>
            ) : (
              <button onClick={() => loginWithRedirect()} style={loginBtnStyle}>Увійти</button>
            )}
          </div>
        </div>
      </nav>

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

const linkStyle = { textDecoration: 'none', color: '#6b7280', fontWeight: '500', fontSize: '1rem', transition: 'color 0.2s', cursor: 'pointer' };
const logoutBtnStyle = { background: '#fee2e2', color: '#991b1b', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' };
const loginBtnStyle = { background: '#4f46e5', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' };

export default App;