import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../useApi';
import { useAuth0 } from '@auth0/auth0-react';

export default function LotDetailPage() {
  const { id } = useParams();
  const api = useApi();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  
  // Стани даних
  const [lot, setLot] = useState(null);
  const [bids, setBids] = useState([]);
  const [myDbId, setMyDbId] = useState(null); // Наш ID в базі PostgreSQL
  
  // Стани форми та UI
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- ЗАВАНТАЖЕННЯ ДАНИХ ---
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Отримуємо лот
      const lotRes = await api.get(`/lots/${id}`);
      setLot(lotRes.data);
      
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
      await api.post(`/bids/${id}`, { amount: Number(bidAmount) });
      alert("Ставка успішно прийнята!");
      setBidAmount('');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      alert(`Помилка: ${msg}`);
    }
  };

  const handlePayment = async () => {
    if (!lot) return;
    const confirmPay = window.confirm(`Ви перемогли! Оплатити лот за сумою $${lot.current_price}?`);
    
    if (confirmPay) {
      try {
        await api.post('/payments/', { lot_id: lot.id });
        alert("Оплата успішна! Лот ваш.");
        fetchData();
      } catch (err) {
        const msg = err.response?.data?.detail || err.message;
        alert(`Помилка оплати: ${msg}`);
      }
    }
  };

  // ФУНКЦІЯ ЗАКРИТТЯ АУКЦІОНУ ПРОДАВЦЕМ
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

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Завантаження даних лота...</div>;
  }

  if (error || !lot) {
    return <div style={{ padding: '40px', color: 'red', textAlign: 'center' }}>{error || "Лот не знайдено"}</div>;
  }

  // --- Визначення статусів ---
  const isPendingPayment = lot.status === 'pending_payment';
  const isSold = lot.status === 'sold';
  const isActive = lot.status === 'active';
  const isClosedUnsold = lot.status === 'closed_unsold';

  const paymentDeadlineDate = lot.payment_deadline ? new Date(lot.payment_deadline) : null;
  const now = new Date();
  const isPaymentDeadlinePassed = paymentDeadlineDate && now > paymentDeadlineDate;

  // Визначення переможця
  // (Фільтруємо активні ставки, якщо потрібно, або просто беремо першу)
  const activeBids = bids.filter(b => b.is_active !== false);
  const highestBid = activeBids.length > 0 ? activeBids[0] : null;

  const isWinner = isAuthenticated && highestBid && highestBid.user_id === myDbId && (isPendingPayment || isSold);
  const isSeller = isAuthenticated && lot.seller_id === myDbId;

  // Текстові статуси та кольори
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

  // Мінімальна наступна ставка
  const minNextBid = Number(lot.current_price) + Number(lot.min_step);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '2rem' }}>
      
      {/* ЛІВА КОЛОНКА: КАРТИНКА */}
      <div>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          position: 'sticky',
          top: '100px'
        }}>
          <img 
            src={lot.image_url || 'https://via.placeholder.com/600x400?text=No+Image'} 
            alt={lot.title} 
            style={{ 
              width: '100%', 
              height: '500px',
              objectFit: 'cover',
              display: 'block'
            }} 
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/600x400?text=No+Image';
            }}
          />
        </div>
      </div>

      {/* ПРАВА КОЛОНКА: ДЕТАЛІ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Шапка лота */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <h1 style={{ margin: '0 0 1rem 0', fontSize: '2.5rem', fontWeight: 'bold', color: '#1f2937', lineHeight: '1.2' }}>
            {lot.title}
          </h1>
          <p style={{ color: '#6b7280', lineHeight: '1.7', fontSize: '1.1rem', margin: 0 }}>
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
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Поточна ціна</div>
              <div style={{
                fontSize: '3rem',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                ${lot.current_price}
              </div>
            </div>
            <div style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              backgroundColor: statusColor,
              color: 'white',
              fontWeight: '600',
              fontSize: '0.95rem',
              boxShadow: `0 4px 12px ${statusColor}40`
            }}>
              {statusText}
            </div>
          </div>
          
          {/* Таймер оплати (якщо статус pending_payment) */}
          {paymentDeadlineDate && !isSold && (
            <div style={{
              padding: '1rem',
              background: isPaymentDeadlinePassed ? '#fef2f2' : '#f0f9ff',
              borderRadius: '12px',
              border: `2px solid ${isPaymentDeadlinePassed ? '#fecaca' : '#bfdbfe'}`
            }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Дедлайн оплати</div>
              <div style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: isPaymentDeadlinePassed ? '#dc2626' : '#1e40af'
              }}>
                {paymentDeadlineDate.toLocaleString('uk-UA')}
                {isPaymentDeadlinePassed && <span style={{ marginLeft: '0.5rem' }}>⚠️</span>}
              </div>
            </div>
          )}
        </div>

        {/* Картка продавця */}
        {lot.seller && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#1f2937' }}>Продавець</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#e0e7ff',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.2rem'
              }}>
                {lot.seller.username ? lot.seller.username[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div style={{ fontWeight: '600', color: '#1f2937' }}>{lot.seller.username || "Користувач"}</div>
                <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{lot.seller.email}</div>
                {lot.seller.phone_number && <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{lot.seller.phone_number}</div>}
              </div>
            </div>
          </div>
        )}

        {/* --- ЗОНА ДІЙ --- */}

        {/* 1. Активний лот: Ставки (Тільки для покупців) */}
        {isActive && !isSeller && (
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
                fontWeight: '600',
                fontSize: '1.1rem',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer'
              }}>
                Увійдіть, щоб робити ставки
              </button>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '600', fontSize: '1.1rem', color: '#374151' }}>
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
                      border: '2px solid #e5e7eb'
                    }}
                  />
                  <button onClick={handleBid} style={{
                    padding: '1rem 2rem',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '1.1rem',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer'
                  }}>
                    Зробити ставку
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Продавець (власник) - КНОПКА ЗАКРИТТЯ АУКЦІОНУ */}
        {isActive && isSeller && (
             <div style={{ background: '#fffbeb', borderRadius: '16px', padding: '1.5rem', border: '2px solid #fde68a' }}>
                 <h3 style={{ marginTop: 0, color: '#92400e' }}>Керування лотом</h3>
                 <p style={{ color: '#b45309', marginBottom: '1rem' }}>
                    Ви можете завершити аукціон зараз. Поточний лідер стане переможцем.
                 </p>
                 <button 
                    onClick={handleCloseAuction}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        background: '#f59e0b',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '1.1rem',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                 >
                    🛑 Завершити аукціон
                 </button>
             </div>
        )}

        {/* 3. Переможець: Оплата (З'являється тільки коли аукціон в статусі pending_payment) */}
        {isPendingPayment && isWinner && !isPaymentDeadlinePassed && (
            <div style={{ padding: '2rem', background: '#ecfdf5', borderRadius: '16px', border: '2px solid #d1fae5', textAlign: 'center' }}>
                <h3 style={{ color: '#065f46', marginTop: 0 }}>Вітаємо! Ви перемогли 🎉</h3>
                <p style={{ marginBottom: '1.5rem', color: '#047857' }}>Ваша ставка <strong>${highestBid?.amount}</strong> виграла.</p>
                <button 
                    onClick={handlePayment} 
                    style={{
                        padding: '1rem 3rem',
                        background: '#10b981',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                >
                    Оплатити зараз
                </button>
            </div>
        )}

        {/* 3.1. Переможець прострочив */}
        {isPendingPayment && isWinner && isPaymentDeadlinePassed && (
            <div style={{ padding: '1.5rem', background: '#fef2f2', borderRadius: '16px', border: '2px solid #fecaca', textAlign: 'center' }}>
                <h3 style={{ color: '#991b1b', marginTop: 0 }}>⚠️ Час вичерпано</h3>
                <p style={{ color: '#b91c1c' }}>Ви не встигли оплатити в строк. Перемога анульована.</p>
            </div>
        )}

        {/* 4. Не переможець (інші учасники, коли аукціон чекає оплати) */}
        {isPendingPayment && !isWinner && (
            <div style={{ padding: '1.5rem', background: '#f3f4f6', borderRadius: '16px', border: '2px solid #e5e7eb' }}>
                <h3 style={{ marginTop: 0, color: '#374151' }}>Аукціон зупинено</h3>
                <p style={{ color: '#6b7280' }}>
                    Переможець: <strong>{highestBid ? `Користувач #${highestBid.user_id}` : "Ставок не було"}</strong>
                </p>
                {lot.payment_deadline && (
                    <p style={{ fontSize: '0.9rem', color: '#ef4444' }}>Очікуємо оплати від переможця...</p>
                )}
            </div>
        )}

        {/* 5. Продано */}
        {isSold && (
            <div style={{ padding: '1.5rem', background: '#fef2f2', borderRadius: '16px', border: '2px solid #fecaca', textAlign: 'center' }}>
                <h3 style={{ color: '#ef4444', marginTop: 0 }}>Лот продано 🔒</h3>
            </div>
        )}

        {/* Історія ставок */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1f2937' }}>Історія ставок ({bids.length})</h3>
            
            {bids.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', background: '#f9fafb', borderRadius: '12px' }}>
                    Ставок ще немає. Будьте першим!
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {bids.map((bid, index) => (
                    <div key={bid.id} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '1rem',
                        background: index === 0 ? '#f0fdf4' : 'white',
                        border: index === 0 ? '1px solid #bbf7d0' : '1px solid #f3f4f6',
                        borderRadius: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {index === 0 && <span style={{ fontSize: '1.5rem' }}>👑</span>}
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1f2937' }}>${bid.amount}</div>
                                <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                                    {bid.user_id === myDbId ? <span style={{color: '#6366f1', fontWeight: 'bold'}}>Ви</span> : `Користувач #${bid.user_id}`}
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