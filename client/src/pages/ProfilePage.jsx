import { useEffect, useState } from 'react';
import { useApi } from '../useApi';
import { useAuth0 } from '@auth0/auth0-react';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const api = useApi();
  const { user } = useAuth0(); 
  
  const [profile, setProfile] = useState(null);
  const [myLots, setMyLots] = useState([]); // Мої лоти
  const [myBids, setMyBids] = useState([]); // Мої ставки
  
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  // Завантаження всіх даних
  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        
        // 1. Профіль
        const profileRes = await api.get('/users/me');
        setProfile(profileRes.data);
        setForm({
          username: profileRes.data.username || '',
          phone_number: profileRes.data.phone_number || '',
          bio: profileRes.data.bio || ''
        });

        // 2. Мої лоти (створені мною)
        const lotsRes = await api.get('/lots/my');
        setMyLots(lotsRes.data);

        // 3. Мої ставки (зроблені мною)
        const bidsRes = await api.get('/bids/my'); // Це новий ендпоінт
        setMyBids(bidsRes.data);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [api]);

  const handleSave = async () => {
    try {
      await api.patch('/users/me', form);
      setIsEditing(false);
      // Оновити дані на екрані
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

  if (loading || !profile) return <div style={{padding: '40px', textAlign: 'center'}}>Завантаження профілю...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      
      {/* --- БЛОК 1: ОСОБИСТА ІНФОРМАЦІЯ --- */}
      <div style={{ 
        background: 'white',
        borderRadius: '16px', 
        padding: '30px', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        marginBottom: '30px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
          <img 
            src={user?.picture} 
            alt="Avatar" 
            style={{ width: '80px', height: '80px', borderRadius: '50%' }} 
          />
          <div>
            <h2 style={{ margin: 0 }}>{profile.username || user?.nickname || 'Користувач'}</h2>
            <p style={{ margin: 0, color: '#666' }}>{profile.email}</p>
          </div>
        </div>

        {!isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={rowStyle}>
              <strong style={{ minWidth: '150px', color: '#555' }}>Ім'я користувача:</strong>
              <span>{profile.username || <span style={{color: '#ccc'}}>Не вказано</span>}</span>
            </div>
            <div style={rowStyle}>
              <strong style={{ minWidth: '150px', color: '#555' }}>Телефон:</strong>
              <span>{profile.phone_number || <span style={{color: '#ccc'}}>Не вказано</span>}</span>
            </div>
            <div style={rowStyle}>
              <strong style={{ minWidth: '150px', color: '#555' }}>Про себе:</strong>
              <p style={{ margin: 0 }}>{profile.bio || <span style={{color: '#ccc'}}>...</span>}</p>
            </div>
            <button onClick={() => setIsEditing(true)} style={editBtnStyle}>Редагувати профіль</button>
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
              <button onClick={handleCancel} style={{...editBtnStyle, background: '#f3f4f6', color: '#333'}}>Скасувати</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        
        {/* --- БЛОК 2: МОЇ ЛОТИ --- */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>📦 Мої лоти</h2>
          
          {myLots.length === 0 ? (
             <p style={{ color: '#999', textAlign: 'center' }}>Ви ще не створили жодного лота</p>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {myLots.map(lot => (
                  <div key={lot.id} style={cardItemStyle}>
                    <div style={{ flex: 1 }}>
                       <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{lot.title}</div>
                       <div style={{ fontSize: '0.9rem', color: '#666' }}>Ціна: ${lot.current_price}</div>
                       <div style={{ 
                          display: 'inline-block', 
                          fontSize: '0.8rem', 
                          padding: '2px 8px', 
                          borderRadius: '10px',
                          background: lot.status === 'active' ? '#d1fae5' : '#fee2e2',
                          color: lot.status === 'active' ? '#065f46' : '#991b1b',
                          marginTop: '5px'
                       }}>
                          {lot.status.toUpperCase()}
                       </div>
                    </div>
                    <Link to={`/lot/${lot.id}`} style={linkBtnStyle}>Перейти</Link>
                  </div>
                ))}
             </div>
          )}
        </div>

        {/* --- БЛОК 3: МОЇ СТАВКИ --- */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>💰 Мої ставки</h2>
          
          {myBids.length === 0 ? (
             <p style={{ color: '#999', textAlign: 'center' }}>Ви ще не робили ставок</p>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {myBids.map(bid => (
                  <div key={bid.id} style={cardItemStyle}>
                    <div style={{ flex: 1 }}>
                       {/* Назва лота, яку ми витягли завдяки LotMinimal */}
                       <div style={{ fontWeight: 'bold' }}>{bid.lot ? bid.lot.title : `Лот #${bid.lot_id}`}</div>
                       <div style={{ color: '#10b981', fontWeight: 'bold' }}>Ваша ставка: ${bid.amount}</div>
                       <div style={{ fontSize: '0.85rem', color: '#999' }}>
                          {new Date(bid.timestamp).toLocaleDateString()} {new Date(bid.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </div>
                       {!bid.is_active && <span style={{fontSize: '0.8rem', color: 'red'}}>Ставка неактивна</span>}
                    </div>
                    <Link to={`/lot/${bid.lot_id}`} style={linkBtnStyle}>Перейти</Link>
                  </div>
                ))}
             </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Стилі
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
  color: '#333'
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  boxSizing: 'border-box',
  fontFamily: 'inherit'
};

const editBtnStyle = {
  padding: '10px 20px',
  backgroundColor: '#6366f1',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 'bold',
  width: '100%'
};

const cardItemStyle = {
  border: '1px solid #eee',
  borderRadius: '10px',
  padding: '15px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  background: '#fcfcfc'
};

const linkBtnStyle = {
  textDecoration: 'none',
  background: '#f3f4f6',
  color: '#333',
  padding: '8px 15px',
  borderRadius: '8px',
  fontSize: '0.9rem',
  fontWeight: 'bold',
  whiteSpace: 'nowrap'
};