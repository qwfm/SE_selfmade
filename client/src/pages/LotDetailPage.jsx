import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../useApi';
import { useAuth0 } from '@auth0/auth0-react';

export default function LotDetailPage() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  
  // Стани даних
  const [lot, setLot] = useState(null);
  const [bids, setBids] = useState([]);
  const [myDbId, setMyDbId] = useState(null);
  
  // Стан для Галереї (яка картинка зараз велика)
  const [activeImage, setActiveImage] = useState(null);

  // Стани форми та UI
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- ЗАВАНТАЖЕННЯ ДАНИХ ---
  const fetchData = async () => {
    // 🛑 ЗАХИСТ ВІД UNDEFINED
    if (!id || id === 'undefined') {
        setError("Невірне посилання на лот. Поверніться назад.");
        setLoading(false);
        return;
    }

    try {
      setLoading(true);
      
      // 1. Отримуємо лот
      const lotRes = await api.get(`/lots/${id}`);
      setLot(lotRes.data);
      
      // --- ЛОГІКА ГАЛЕРЕЇ ---
      // Встановлюємо першу картинку як активну
      if (lotRes.data.images && lotRes.data.images.length > 0) {
        setActiveImage(lotRes.data.images[0].image_url);
      } else {
        setActiveImage(lotRes.data.image_url);
      }
      
      // 2. Отримуємо історію ставок
      const bidsRes = await api.get(`/bids/${id}`);
      setBids(bidsRes.data);

      // 3. Якщо ми залогінені, дізнаємось свій внутрішній ID
      if (isAuthenticated) {
          try {
            const userRes = await api.get('/users/me');
            setMyDbId(userRes.data.id);
          } catch (e) {
            console.error("Не вдалося отримати профіль користувача", e);
          }
      }

    } catch (err) {
      console.error(err);
      setError("Не вдалося завантажити лот. Можливо, його не існує.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthenticated]);

  // --- ОБРОБНИКИ ПОДІЙ ---

  const handleBid = async () => {
    try {
      // Endpoint: POST /bids/{lot_id}
      await api.post(`/bids/${id}`, { amount: Number(bidAmount) });
      alert("Ставка успішно прийнята!");
      setBidAmount('');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      alert(`Помилка: ${msg}`);
    }
  };

  const handlePayment = () => {
    navigate(`/payment/${lot.id}`);
  };

  const handleCloseAuction = async () => {
    if (!window.confirm("Ви впевнені? Це зупинить аукціон і призначить поточного лідера переможцем.")) return;
    try {
      await api.post(`/lots/${id}/close`);
      alert("Аукціон завершено! Очікуємо оплати від переможця.");
      fetchData();
    } catch (err) {
      alert(`Помилка: ${err.response?.data?.detail}`);
    }
  };

  // --- ЛОГІКА ВІДОБРАЖЕННЯ (Conditions) ---

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Завантаження даних лота...</div>;
  
  if (error) return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', background: '#fef2f2', color: '#991b1b', borderRadius: '12px', border: '1px solid #fecaca', textAlign: 'center' }}>
        <h3>Помилка</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/')} style={{ marginTop: '10px', padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>
            На головну
        </button>
    </div>
  );
  
  if (!lot) return null;

  const isPendingPayment = lot.status === 'pending_payment';
  const isSold = lot.status === 'sold';
  const isClosedUnsold = lot.status === 'closed_unsold';

  const paymentDeadlineDate = lot.payment_deadline ? new Date(lot.payment_deadline) : null;
  const now = new Date();
  const isPaymentDeadlinePassed = paymentDeadlineDate && now > paymentDeadlineDate;

  // 🔥 ФІЛЬТРАЦІЯ СТАВОК 🔥
  // Ми відкидаємо ставки, де is_active === false (це ті, хто не заплатив)
  const activeBids = bids.filter(b => b.is_active !== false);
  
  // Визначаємо лідера тільки серед АКТИВНИХ ставок
  const highestBid = activeBids.length > 0 ? activeBids[0] : null;

  const isWinner = isAuthenticated && highestBid && highestBid.user_id === myDbId && (isPendingPayment || isSold);
  const isSeller = isAuthenticated && lot.seller_id === myDbId;

  let statusText = "Активний";
  let statusColor = "#10b981"; // Green (Active)
  
  if (isSold) {
      statusText = "ПРОДАНО";
      statusColor = "#ef4444"; // Red
  } else if (isPendingPayment) {
      statusText = "ОЧІКУЄ ОПЛАТИ";
      statusColor = "#f59e0b"; // Amber
  } else if (isClosedUnsold) {
      statusText = "ЗАКРИТО (Без ставок)";
      statusColor = "#6b7280"; // Gray
  }

  const minNextBid = Number(lot.current_price) + Number(lot.min_step);
  const galleryImages = (lot.images && lot.images.length > 0) ? lot.images : [];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      
      {/* Кнопка назад */}
      <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span>←</span> Назад
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '3rem', marginBottom: '2rem' }}>
      
      {/* --- ЛІВА КОЛОНКА: ГАЛЕРЕЯ --- */}
      <div>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          position: 'sticky',
          top: '20px'
        }}>
          {/* ГОЛОВНЕ ФОТО */}
          <div style={{ width: '100%', height: '500px', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
                src={activeImage || 'https://via.placeholder.com/600x400?text=No+Image'} 
                alt={lot.title} 
                style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block'
                }} 
                onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=No+Image'; }}
            />
          </div>

          {/* МІНІАТЮРИ (Показуємо тільки якщо більше 1 картинки) */}
          {galleryImages.length > 1 && (
             <div style={{ 
                 display: 'flex', 
                 gap: '12px', 
                 padding: '16px', 
                 overflowX: 'auto', 
                 borderTop: '1px solid #e5e7eb' 
             }}>
                {galleryImages.map((img) => (
                    <img 
                        key={img.id}
                        src={img.image_url}
                        alt="thumbnail"
                        onClick={() => setActiveImage(img.image_url)}
                        style={{
                            width: '70px',
                            height: '70px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: activeImage === img.image_url ? '3px solid #6366f1' : '1px solid #e5e7eb',
                            opacity: activeImage === img.image_url ? 1 : 0.7,
                            transition: 'all 0.2s',
                            flexShrink: 0
                        }}
                    />
                ))}
             </div>
          )}
        </div>
      </div>

      {/* --- ПРАВА КОЛОНКА: ДЕТАЛІ --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Шапка лота */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <h1 style={{ margin: '0 0 1rem 0', fontSize: '2.5rem', fontWeight: '800', color: '#1f2937', lineHeight: '1.2' }}>
            {lot.title}
          </h1>
          <p style={{ color: '#4b5563', lineHeight: '1.7', fontSize: '1.1rem', margin: 0, whiteSpace: 'pre-wrap' }}>
            {lot.description}
          </p>
        </div>
        
        {/* Картка статусу і ціни */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            paddingBottom: '1.5rem',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: '500' }}>ПОТОЧНА ЦІНА</div>
              <div style={{
                fontSize: '3rem',
                fontWeight: '900',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: '1'
              }}>
                ${lot.current_price}
              </div>
            </div>
            <div style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              backgroundColor: statusColor,
              color: 'white',
              fontWeight: '700',
              fontSize: '0.95rem',
              boxShadow: `0 4px 12px ${statusColor}40`,
              textTransform: 'uppercase'
            }}>
              {statusText}
            </div>
          </div>
          
          {/* Таймер оплати */}
          {lot.payment_deadline ? (
            <div style={{
              padding: '1.25rem',
              background: isPaymentDeadlinePassed ? '#fef2f2' : '#eff6ff',
              borderRadius: '12px',
              border: `2px solid ${isPaymentDeadlinePassed ? '#fecaca' : '#bfdbfe'}`
            }}>
              <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: '600' }}>Дедлайн оплати</div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: isPaymentDeadlinePassed ? '#dc2626' : '#1e40af'
              }}>
                {paymentDeadlineDate.toLocaleString('uk-UA')}
                {isPaymentDeadlinePassed && <span style={{ marginLeft: '0.5rem' }}>⚠️</span>}
              </div>
            </div>
          ) : (
             lot.status === 'active'
          )}
        </div>

        {/* Картка продавця */}
        {lot.seller && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#e0e7ff',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.5rem'
              }}>
                {lot.seller.username ? lot.seller.username[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '4px' }}>Продавець</div>
                <div style={{ fontWeight: '700', color: '#1f2937', fontSize: '1.1rem' }}>{lot.seller.username || "Користувач"}</div>
                {lot.seller.phone_number && <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{lot.seller.phone_number}</div>}
              </div>
          </div>
        )}

        {/* --- ЗОНА ДІЙ --- */}

        {/* 1. Активний лот: Ставки */}
        {!isClosedUnsold && lot.status === 'active' && !isSeller && (
          <div style={{
            background: '#eff6ff',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
            border: '2px solid #e0e7ff'
          }}>
            {!isAuthenticated ? (
              <button onClick={() => loginWithRedirect()} style={{
                width: '100%',
                padding: '1rem',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                fontWeight: '700',
                fontSize: '1.1rem',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
              }}>
                Увійдіть, щоб робити ставки
              </button>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '700', fontSize: '1.1rem', color: '#374151' }}>
                  Ваша ставка (мін: ${minNextBid})
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input 
                    type="number" 
                    value={bidAmount} 
                    onChange={e => setBidAmount(e.target.value)} 
                    placeholder={`$${minNextBid}`}
                    style={{
                      flex: 1,
                      padding: '1rem',
                      fontSize: '1.1rem',
                      borderRadius: '12px',
                      border: '2px solid #cbd5e1',
                      outline: 'none',
                      transition: 'border 0.2s'
                    }}
                  />
                  <button onClick={handleBid} style={{
                    padding: '1rem 2rem',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '1.1rem',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
                  }}>
                    Зробити ставку
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Продавець (власник) */}
        {!isClosedUnsold && isSeller && lot.status === 'active' && (
             <div style={{ background: '#fffbeb', borderRadius: '16px', padding: '1.5rem', border: '2px solid #fde68a' }}>
                 <h3 style={{ marginTop: 0, color: '#92400e', fontSize: '1.2rem' }}>Керування лотом</h3>
                 <p style={{ color: '#b45309', marginBottom: '1rem' }}>
                    Ви можете завершити аукціон зараз. Поточний лідер автоматично стане переможцем.
                 </p>
                 <button 
                    onClick={handleCloseAuction}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        background: '#f59e0b',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '1.1rem',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)'
                    }}
                 >
                    🛑 Завершити аукціон
                 </button>
             </div>
        )}

        {/* 3. Переможець: Оплата */}
        {isPendingPayment && isWinner && !isPaymentDeadlinePassed && (
            <div style={{ padding: '2rem', background: '#ecfdf5', borderRadius: '16px', border: '2px solid #d1fae5', textAlign: 'center' }}>
                <h3 style={{ color: '#065f46', marginTop: 0, fontSize: '1.5rem' }}>Вітаємо! Ви перемогли 🎉</h3>
                <p style={{ marginBottom: '1.5rem', color: '#047857', fontSize: '1.1rem' }}>
                    Ваша ставка <strong>${highestBid?.amount}</strong> виграла.
                </p>
                <button 
                    onClick={handlePayment}
                    style={{
                        padding: '1rem 3rem',
                        background: '#10b981',
                        color: 'white',
                        fontWeight: '800',
                        fontSize: '1.2rem',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                >
                    ПЕРЕЙТИ ДО ОПЛАТИ
                </button>
            </div>
        )}

        {/* 3.1. Переможець прострочив */}
        {isPendingPayment && isWinner && isPaymentDeadlinePassed && (
            <div style={{ padding: '2rem', background: '#fef2f2', borderRadius: '16px', border: '2px solid #fecaca', textAlign: 'center' }}>
                <h3 style={{ color: '#991b1b', marginTop: 0 }}>⚠️ Час вичерпано</h3>
                <p style={{ color: '#b91c1c', fontSize: '1.1rem' }}>
                    Ви не встигли оплатити в строк. Перемога анульована.
                </p>
            </div>
        )}

        {/* 4. Не переможець (але лот очікує оплати) */}
        {isPendingPayment && !isWinner && (
            <div style={{ padding: '1.5rem', background: '#f3f4f6', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ marginTop: 0, color: '#374151' }}>Аукціон завершено</h3>
                <p style={{ color: '#6b7280' }}>
                    Переможець: <strong>{highestBid ? `Користувач #${highestBid.user_id}` : "Ставок не було"}</strong>
                </p>
                {lot.payment_deadline && (
                    <p style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: '600' }}>Очікуємо оплати від переможця...</p>
                )}
            </div>
        )}

        {/* 5. Продано */}
        {lot.status === 'sold' && (
            <div style={{ padding: '2rem', background: '#f0fdf4', borderRadius: '16px', border: '2px solid #bbf7d0', textAlign: 'center' }}>
                <h3 style={{ color: '#166534', marginTop: 0, fontSize: '1.5rem' }}>Лот успішно продано 🔒</h3>
            </div>
        )}

        {/* Історія ставок */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1f2937', fontSize: '1.3rem', fontWeight: '700' }}>
                Історія ставок ({activeBids.length})
            </h3>
            
            {activeBids.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', background: '#f9fafb', borderRadius: '12px', border: '1px dashed #d1d5db' }}>
                    Ставок ще немає. Будьте першим!
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* ТУТ ВАЖЛИВО: Ми рендеримо тільки activeBids */}
                    {activeBids.map((bid, index) => (
                    <div key={bid.id} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '1rem', 
                        background: index === 0 ? '#f0fdf4' : 'white',
                        border: index === 0 ? '2px solid #bbf7d0' : '1px solid #f3f4f6',
                        borderRadius: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {index === 0 && <span style={{ fontSize: '1.5rem' }}>👑</span>}
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1f2937' }}>${bid.amount}</div>
                                <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                                    {bid.user_id === myDbId ? (
                                        <span style={{color: '#6366f1', fontWeight: 'bold'}}>Ви</span>
                                    ) : (
                                        `Користувач #${bid.user_id}`
                                    )}
                                </div>
                            </div>
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                            {new Date(bid.timestamp).toLocaleString('uk-UA')}
                        </div>
                    </div>
                    ))}
                </div>
            )}
        </div>

      </div>
      </div>
    </div>
  );
}