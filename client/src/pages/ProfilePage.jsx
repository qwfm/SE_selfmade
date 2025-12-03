import { useEffect, useState, useMemo } from 'react';
import { useApi } from '../useApi';
import { useAuth0 } from '@auth0/auth0-react';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const api = useApi();
  const { user } = useAuth0(); 
  
  const [profile, setProfile] = useState(null);
  const [myLots, setMyLots] = useState([]);
  const [myBids, setMyBids] = useState([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  // --- СТАНИ ФІЛЬТРІВ ---
  const [lotsFilter, setLotsFilter] = useState('all');
  const [bidsFilter, setBidsFilter] = useState('all');

  // Завантаження всіх даних
  const loadAll = async () => {
    try {
      setLoading(true);
      
      const profileRes = await api.get('/users/me');
      setProfile(profileRes.data);
      setForm({
        username: profileRes.data.username || '',
        phone_number: profileRes.data.phone_number || '',
        bio: profileRes.data.bio || ''
      });

      const lotsRes = await api.get('/lots/my');
      setMyLots(lotsRes.data);

      const bidsRes = await api.get('/bids/my');
      setMyBids(bidsRes.data);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // --- ЛОГІКА ФІЛЬТРАЦІЇ (useMemo для оптимізації) ---
  
  const filteredLots = useMemo(() => {
    return myLots.filter(lot => {
      if (lotsFilter === 'all') return true;
      return lot.status === lotsFilter;
    });
  }, [myLots, lotsFilter]);

  const filteredBids = useMemo(() => {
    return myBids.filter(bid => {
      if (bidsFilter === 'all') return true;
      // Якщо лот видалено або дані неповні, пропускаємо або показуємо (залежить від логіки)
      if (!bid.lot) return false; 
      return bid.lot.status === bidsFilter;
    });
  }, [myBids, bidsFilter]);


  // --- ОБРОБНИКИ ПРОФІЛЮ ---
  const handleSave = async () => {
    try {
      await api.patch('/users/me', form);
      setIsEditing(false);
      const res = await api.get('/users/me');
      setProfile(res.data);
    } catch (err) {
      alert("Помилка збереження: " + err.message);
    }
  };

  const handleCancel = () => {
    setForm({
      username: profile.username || '',
      phone_number: profile.phone_number || '',
      bio: profile.bio || ''
    });
    setIsEditing(false);
  };

  const handleDeleteLot = async (lotId) => {
    if (!window.confirm("Ви дійсно хочете видалити цей лот?")) return;
    try {
      await api.delete(`/lots/${lotId}`);
      alert("Лот видалено!");
      loadAll();
    } catch (err) {
      alert("Помилка видалення: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCancelBid = async (bidId) => {
    if (!window.confirm("Ви впевнені, що хочете скасувати цю ставку?")) return;
    try {
      await api.delete(`/bids/${bidId}`);
      alert("Ставку скасовано!");
      loadAll();
    } catch (err) {
      alert("Помилка: " + (err.response?.data?.detail || err.message));
    }
  };

  if (loading || !profile) return (
    <div style={{padding: '100px 20px', textAlign: 'center', color: '#6b7280'}}>
      <div className="spinner" style={{margin: '0 auto 20px'}}></div>
      Завантаження профілю...
      <style>{`
        .spinner { width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top: 4px solid #6366f1; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* --- БЛОК 1: ОСОБИСТА ІНФОРМАЦІЯ --- */}
      <div style={{ 
        background: 'white',
        borderRadius: '16px', 
        padding: '30px', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        marginBottom: '30px',
        border: '1px solid #f3f4f6'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
          <img 
            src={user?.picture} 
            alt="Avatar" 
            style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #e0e7ff' }} 
          />
          <div>
            <h2 style={{ margin: 0, color: '#1f2937' }}>{profile.username || user?.nickname || 'Користувач'}</h2>
            <p style={{ margin: 0, color: '#6b7280' }}>{profile.email}</p>
          </div>
        </div>

        {!isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={rowStyle}>
              <strong style={{ minWidth: '150px', color: '#4b5563' }}>Ім'я користувача:</strong>
              <span style={{ color: '#111827' }}>{profile.username || <span style={{color: '#9ca3af'}}>Не вказано</span>}</span>
            </div>
            <div style={rowStyle}>
              <strong style={{ minWidth: '150px', color: '#4b5563' }}>Телефон:</strong>
              <span style={{ color: '#111827' }}>{profile.phone_number || <span style={{color: '#9ca3af'}}>Не вказано</span>}</span>
            </div>
            <div style={rowStyle}>
              <strong style={{ minWidth: '150px', color: '#4b5563' }}>Про себе:</strong>
              <p style={{ margin: 0, color: '#111827' }}>{profile.bio || <span style={{color: '#9ca3af'}}>...</span>}</p>
            </div>
            <button onClick={() => setIsEditing(true)} style={editBtnStyle}>✎ Редагувати профіль</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={labelStyle}>Ім'я користувача</label>
              <input style={inputStyle} value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
            </div>
            <div>
              <label style={labelStyle}>Телефон</label>
              <input style={inputStyle} value={form.phone_number} onChange={e => setForm({...form, phone_number: e.target.value})} placeholder="+380..." />
            </div>
            <div>
              <label style={labelStyle}>Про себе</label>
              <textarea style={{...inputStyle, height: '80px', resize: 'vertical'}} value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={handleSave} style={{...editBtnStyle, background: '#10b981', color: 'white'}}>Зберегти</button>
              <button onClick={handleCancel} style={{...editBtnStyle, background: '#f3f4f6', color: '#374151'}}>Скасувати</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        
        {/* --- БЛОК 2: МОЇ ЛОТИ --- */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1f2937' }}>📦 Мої лоти</h2>
            <select 
              value={lotsFilter} 
              onChange={(e) => setLotsFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">Всі</option>
              <option value="active">Активні</option>
              <option value="pending_payment">Очікують оплати</option>
              <option value="sold">Продані</option>
              <option value="closed_unsold">Закриті</option>
            </select>
          </div>
          
          {filteredLots.length === 0 ? (
             <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
               {lotsFilter === 'all' ? 'Ви ще не створили жодного лота' : 'Лотів з таким статусом немає'}
             </p>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {filteredLots.map(lot => (
                  <div key={lot.id} style={cardItemStyle}>
                    <div style={{ flex: 1 }}>
                       <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '5px' }}>{lot.title}</div>
                       <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Ціна: <span style={{color: '#4f46e5', fontWeight: 'bold'}}>${lot.current_price}</span></div>
                       <div style={{ marginTop: '8px' }}>
                          <span style={getStatusBadgeStyle(lot.status)}>
                            {getStatusLabel(lot.status)}
                          </span>
                       </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
                        <Link to={`/lot/${lot.id}`} style={linkBtnStyle}>Перейти</Link>
                        {/* Кнопка видалення тільки для активних або закритих без ставок лотів */}
                        {(lot.status === 'active' || lot.status === 'closed_unsold') && (
                            <button 
                                onClick={() => handleDeleteLot(lot.id)}
                                style={deleteBtnStyle}
                                title="Видалити лот"
                            >
                                Видалити
                            </button>
                        )}
                    </div>
                  </div>
                ))}
             </div>
          )}
        </div>

        {/* --- БЛОК 3: МОЇ СТАВКИ --- */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #f3f4f6' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1f2937' }}>💰 Мої ставки</h2>
            <select 
              value={bidsFilter} 
              onChange={(e) => setBidsFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">Всі</option>
              <option value="active">Активні лоти</option>
              <option value="pending_payment">Очікують оплати</option>
              <option value="sold">Завершені</option>
            </select>
          </div>
          
          {filteredBids.length === 0 ? (
             <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
               {bidsFilter === 'all' ? 'Ви ще не робили ставок' : 'Ставок з таким статусом немає'}
             </p>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {filteredBids.map(bid => (
                  <div key={bid.id} style={cardItemStyle}>
                    <div style={{ flex: 1 }}>
                       {/* Назва лота */}
                       <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                         {bid.lot ? bid.lot.title : <span style={{color:'red'}}>Лот видалено</span>}
                       </div>
                       
                       <div style={{ color: '#10b981', fontWeight: 'bold' }}>Ваша ставка: ${bid.amount}</div>
                       
                       <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '5px' }}>
                          {new Date(bid.timestamp).toLocaleDateString()} {new Date(bid.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </div>
                       
                       {!bid.is_active && <span style={{fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold'}}>✖ Ставка неактивна</span>}
                       
                       {bid.lot && (
                           <div style={{marginTop: '5px'}}>
                               <span style={{fontSize: '0.8rem', color: '#6b7280'}}>Статус лота: </span>
                               <span style={getStatusBadgeStyle(bid.lot.status, true)}>
                                   {getStatusLabel(bid.lot.status)}
                               </span>
                           </div>
                       )}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
                        {bid.lot && <Link to={`/lot/${bid.lot_id}`} style={linkBtnStyle}>Перейти</Link>}
                        
                        {/* Кнопка скасування ставки (тільки якщо вона активна і лот активний) */}
                        {bid.is_active && bid.lot && bid.lot.status === 'active' && (
                          <button 
                            onClick={() => handleCancelBid(bid.id)}
                            style={deleteBtnStyle}
                            title="Скасувати ставку"
                          >
                            Скасувати
                          </button>
                        )}
                    </div>
                  </div>
                ))}
             </div>
          )}
        </div>

      </div>
    </div>
  );
}

// --- СТИЛІ ТА ХЕЛПЕРИ ---

const getStatusLabel = (status) => {
    switch(status) {
      case 'active': return 'Активний';
      case 'sold': return 'Продано';
      case 'pending_payment': return 'Очікує оплати';
      case 'closed_unsold': return 'Закрито (Не продано)';
      default: return status;
    }
};

const getStatusBadgeStyle = (status, isSmall = false) => {
    let bg = '#f3f4f6';
    let color = '#374151';
    
    if (status === 'active') { bg = '#dcfce7'; color = '#166534'; }
    else if (status === 'sold') { bg = '#fee2e2'; color = '#991b1b'; }
    else if (status === 'pending_payment') { bg = '#fef3c7'; color = '#92400e'; }
    
    return {
        display: 'inline-block',
        fontSize: isSmall ? '0.75rem' : '0.8rem',
        padding: isSmall ? '2px 6px' : '3px 10px',
        borderRadius: '12px',
        background: bg,
        color: color,
        fontWeight: '600'
    };
};

const rowStyle = {
  display: 'flex',
  borderBottom: '1px solid #f9f9f9',
  paddingBottom: '10px'
};

const labelStyle = {
  display: 'block',
  fontWeight: 'bold',
  marginBottom: '5px',
  fontSize: '14px',
  color: '#374151'
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
  fontFamily: 'inherit'
};

const selectStyle = {
    padding: '5px 10px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '0.9rem',
    color: '#374151',
    cursor: 'pointer',
    outline: 'none'
};

const editBtnStyle = {
  padding: '10px 20px',
  backgroundColor: '#6366f1',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  width: '100%',
  transition: 'background 0.2s'
};

const cardItemStyle = {
  border: '1px solid #f3f4f6',
  borderRadius: '12px',
  padding: '15px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '15px',
  background: '#fff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

const linkBtnStyle = {
  textDecoration: 'none',
  background: '#f3f4f6',
  color: '#374151',
  padding: '6px 12px',
  borderRadius: '6px',
  fontSize: '0.85rem',
  fontWeight: '600',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  minWidth: '80px'
};

const deleteBtnStyle = {
    background: 'transparent',
    color: '#ef4444',
    border: '1px solid #fee2e2',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    minWidth: '80px',
    fontWeight: '500'
};