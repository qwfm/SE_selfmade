import { useEffect, useState } from 'react';
import { useApi } from '../useApi';
import { Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

export default function MainPage() {
  const api = useApi();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const [recentLots, setRecentLots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLots = async () => {
      try {
        const res = await api.get('/lots/');
        
        // 1. Фільтруємо: залишаємо тільки АКТИВНІ
        const activeLots = res.data.filter(lot => lot.status === 'active');
        
        // 2. Сортуємо: найновіші (більший ID) зверху
        const sorted = activeLots.sort((a, b) => b.id - a.id);
        
        // 3. Беремо перші 5
        setRecentLots(sorted.slice(0, 5));
        
      } catch (err) {
        console.error("Помилка завантаження лотів:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLots();
  }, [api]);

  return (
    <div>
      {/* --- HERO SECTION (Банер) --- */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        color: 'white',
        padding: '80px 20px',
        textAlign: 'center',
        borderRadius: '0 0 50% 50% / 20px',
        marginBottom: '40px'
      }}>
        <h1 style={{ fontSize: '3.5rem', margin: '0 0 20px 0', fontWeight: '800' }}>Bid&Buy Marketplace</h1>
        <p style={{ fontSize: '1.25rem', opacity: '0.9', maxWidth: '600px', margin: '0 auto 30px' }}>
          Чесні аукціони, прозорі правила та унікальні лоти. Продавай непотрібне, купуй мрію.
        </p>
        
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <Link to="/lots" style={heroBtnPrimary}>Переглянути всі лоти</Link>
          {!isAuthenticated && (
            <button onClick={() => loginWithRedirect()} style={heroBtnSecondary}>
              Приєднатися
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        
        {/* --- ПРАВИЛА ЗАСТОСУНКУ --- */}
        <div style={{ marginBottom: '60px' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '40px', color: '#1f2937' }}>📋 Як це працює?</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px' }}>
            <div style={ruleCardStyle}>
              <div style={iconStyle}>📝</div>
              <h3>1. Створи лот або зроби ставку</h3>
              <p>Зареєструйся, вистав свій товар на продаж або знайди щось цікаве та запропонуй свою ціну.</p>
            </div>

            <div style={ruleCardStyle}>
              <div style={iconStyle}>⏳</div>
              <h3>2. Дочекайся завершення</h3>
              <p>Аукціон триває доки продавець не вирішить його зупинити. Стеж за статусом "Очікує оплати".</p>
            </div>

            <div style={ruleCardStyle}>
              <div style={iconStyle}>🏆</div>
              <h3>3. Оплати перемогу</h3>
              <p>Якщо твоя ставка найвища — ти маєш обмежений час на оплату. Не встиг? Перемога перейде наступному!</p>
            </div>
          </div>
        </div>

        {/* --- ОСТАННІ ЛОТИ (Тільки активні) --- */}
        <div style={{ marginBottom: '60px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h2 style={{ margin: 0, fontSize: '2rem', color: '#1f2937' }}>🔥 Останні активні лоти</h2>
            <Link to="/lots" style={{ color: '#4f46e5', fontWeight: 'bold', textDecoration: 'none' }}>Всі лоти &rarr;</Link>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center' }}>Завантаження...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '25px' }}>
              {recentLots.map(lot => (
                <Link to={`/lot/${lot.id}`} key={lot.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={lotCardStyle}>
                    <div style={{ height: '180px', overflow: 'hidden', borderBottom: '1px solid #eee' }}>
                      <img 
                        src={lot.image_url || 'https://via.placeholder.com/300x200?text=No+Image'} 
                        alt={lot.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/300x200?text=No+Image'; }}
                      />
                    </div>
                    <div style={{ padding: '15px' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1f2937' }}>{lot.title}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#4f46e5', fontSize: '1.1rem' }}>${lot.current_price}</span>
                        <span style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '10px', background: '#d1fae5', color: '#065f46' }}>
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {recentLots.length === 0 && !loading && (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px', background: '#f9fafb', borderRadius: '10px' }}>
              Наразі немає нових активних лотів. Завітайте пізніше!
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

// --- STYLES ---
const heroBtnPrimary = {
  padding: '12px 24px',
  backgroundColor: 'white',
  color: '#4f46e5',
  fontWeight: 'bold',
  textDecoration: 'none',
  borderRadius: '8px',
  border: '2px solid white',
  transition: 'all 0.2s',
  cursor: 'pointer'
};

const heroBtnSecondary = {
  padding: '12px 24px',
  backgroundColor: 'transparent',
  color: 'white',
  fontWeight: 'bold',
  border: '2px solid white',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const ruleCardStyle = {
  background: 'white',
  padding: '30px',
  borderRadius: '16px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
  textAlign: 'center',
  border: '1px solid #f3f4f6'
};

const iconStyle = {
  fontSize: '3rem',
  marginBottom: '15px',
  background: '#f5f3ff',
  width: '80px',
  height: '80px',
  lineHeight: '80px',
  borderRadius: '50%',
  margin: '0 auto 20px auto'
};

const lotCardStyle = {
  background: 'white',
  borderRadius: '12px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  border: '1px solid #eee',
  overflow: 'hidden',
  transition: 'transform 0.2s',
  cursor: 'pointer',
  height: '100%'
};