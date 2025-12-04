import { useEffect, useState, useMemo } from 'react';
import { useApi } from '../useApi';
import { useAuth0 } from '@auth0/auth0-react';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const api = useApi();
  const { user, logout } = useAuth0(); 
  
  const [profile, setProfile] = useState(null);
  const [myLots, setMyLots] = useState([]);
  const [myBids, setMyBids] = useState([]);
  
  // Стани редагування профілю
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  // --- АДМІНСЬКІ СТАНИ ---
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSearch, setAdminSearch] = useState('');
  
  // Логіка видалення лоту
  const [lotIdToDelete, setLotIdToDelete] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false); // <--- НОВЕ: Модалка видалення
  const [deleteReason, setDeleteReason] = useState('');          // <--- НОВЕ: Причина видалення

  // Модальне вікно бану
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTargetId, setBanTargetId] = useState(null);
  const [banForm, setBanForm] = useState({ reason: '', is_permanent: false, duration_days: 7 });

  // Фільтри користувача
  const [lotsFilter, setLotsFilter] = useState('all');
  const [bidsFilter, setBidsFilter] = useState('all');

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

      // Якщо адмін - завантажуємо список юзерів
      if (profileRes.data.is_admin) {
          fetchAdminUsers();
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
      try {
          const res = await api.get('/admin/users');
          setAdminUsers(res.data);
      } catch (e) { console.error("Admin fetch error", e); }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // --- ФІЛЬТРИ ---
  const filteredLots = useMemo(() => myLots.filter(l => lotsFilter === 'all' || l.status === lotsFilter), [myLots, lotsFilter]);
  
  const filteredBids = useMemo(() => myBids.filter(b => {
      if (bidsFilter === 'all') return true;
      if (!b.lot) return false;
      return b.lot.status === bidsFilter;
  }), [myBids, bidsFilter]);
  
  const filteredAdminUsers = useMemo(() => {
      return adminUsers.filter(u => 
        (u.username || '').toLowerCase().includes(adminSearch.toLowerCase()) || 
        (u.email || '').toLowerCase().includes(adminSearch.toLowerCase())
      );
  }, [adminUsers, adminSearch]);

  // --- ОБРОБНИКИ ---
  const handleSave = async () => {
    try {
      await api.patch('/users/me', form);
      setIsEditing(false);
      loadAll();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteLot = async (lotId) => {
    if (!window.confirm("Видалити лот?")) return;
    try { await api.delete(`/lots/${lotId}`); alert("Лот видалено"); loadAll(); } 
    catch (err) { alert(err.response?.data?.detail); }
  };

  const handleCancelBid = async (bidId) => {
    if (!window.confirm("Скасувати ставку?")) return;
    try { await api.delete(`/bids/${bidId}`); alert("Ставку скасовано"); loadAll(); } 
    catch (err) { alert(err.response?.data?.detail); }
  };

  const handleCancel = () => {
    setForm({
      username: profile.username || '',
      phone_number: profile.phone_number || '',
      bio: profile.bio || ''
    });
    setIsEditing(false);
  };

  // --- АДМІНСЬКІ ДІЇ ---
  
  // 1. Натискання кнопки "ЗНИЩИТИ ЛОТ" -> Відкриває модалку
  const handleAdminDeleteLotClick = () => {
      if (!lotIdToDelete) return;
      setDeleteReason(''); // Очищаємо поле причини
      setShowDeleteModal(true);
  };

  // 2. Підтвердження в модалці -> API запит з причиною
  const confirmDeleteLot = async () => {
      if (!deleteReason.trim()) {
          alert("Будь ласка, вкажіть причину видалення.");
          return;
      }
      
      try {
          // Передаємо reason як query parameter
          await api.delete(`/admin/lots/${lotIdToDelete}?reason=${encodeURIComponent(deleteReason)}`);
          alert(`Лот ${lotIdToDelete} знищено, власника повідомлено.`);
          setLotIdToDelete('');
          setShowDeleteModal(false);
          loadAll();
      } catch (err) {
          alert("Помилка: " + err.response?.data?.detail);
      }
  };

  const openBanModal = (userId) => {
      setBanTargetId(userId);
      setBanForm({ reason: '', is_permanent: false, duration_days: 7 });
      setShowBanModal(true);
  };

  const handleBlockUser = async () => {
      try {
          await api.post(`/admin/users/${banTargetId}/block`, banForm);
          alert("Користувача заблоковано, його лоти видалено.");
          setShowBanModal(false);
          fetchAdminUsers();
      } catch (err) {
          alert("Помилка: " + err.response?.data?.detail);
      }
  };

  const handleUnblockUser = async (userId) => {
      if (!window.confirm("Розблокувати користувача?")) return;
      try {
          await api.post(`/admin/users/${userId}/unblock`);
          alert("Користувача розблоковано.");
          fetchAdminUsers();
      } catch (err) {
          alert("Помилка: " + err.response?.data?.detail);
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
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
          <img 
            src={user?.picture} 
            alt="Avatar" 
            style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid #e0e7ff' }} 
          />
          <div>
            <h2 style={{ margin: 0, color: '#1f2937' }}>
                {profile.username || user?.nickname || 'Користувач'}
                {profile.is_admin && <span style={{color:'red', fontSize:'0.6em', marginLeft:'10px', verticalAlign:'middle', border:'1px solid red', padding:'2px 6px', borderRadius:'4px'}}>ADMIN</span>}
            </h2>
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

      {/* --- АДМІН ПАНЕЛЬ (Тільки для адмінів) --- */}
      {profile.is_admin && (
          <div style={{...cardStyle, border:'2px solid #fee2e2', marginTop:'30px', boxShadow:'0 10px 15px -3px rgba(220, 38, 38, 0.1)'}}>
              <h2 style={{color:'#b91c1c', marginTop:0, marginBottom:'20px', borderBottom:'1px solid #fecaca', paddingBottom:'10px'}}>🛡️ Панель Адміністратора</h2>
              
              {/* Видалення лота */}
              <div style={{background:'#fef2f2', padding:'20px', borderRadius:'12px', marginBottom:'30px', border:'1px solid #fecaca'}}>
                  <h4 style={{marginTop:0, color:'#991b1b'}}>🔥 Екстрене видалення лота</h4>
                  <div style={{display:'flex', gap:'10px'}}>
                      <input 
                        type="number" 
                        placeholder="ID лота" 
                        value={lotIdToDelete}
                        onChange={e => setLotIdToDelete(e.target.value)}
                        style={inputStyle}
                      />
                      <button onClick={handleAdminDeleteLotClick} style={{...editBtnStyle, background:'#ef4444', color:'white', width:'auto', whiteSpace:'nowrap'}}>ЗНИЩИТИ ЛОТ</button>
                  </div>
              </div>

              {/* Список юзерів */}
              <h4 style={{color:'#1f2937'}}>👥 Користувачі</h4>
              <input 
                placeholder="Пошук користувача (ім'я/email)..." 
                value={adminSearch} 
                onChange={e => setAdminSearch(e.target.value)}
                style={{...inputStyle, marginBottom:'15px'}}
              />
              
              <div style={{maxHeight:'400px', overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:'8px'}}>
                  <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.9rem'}}>
                      <thead style={{background:'#f9fafb', position:'sticky', top:0}}>
                          <tr>
                              <th style={thStyle}>ID</th>
                              <th style={thStyle}>User</th>
                              <th style={thStyle}>Email</th>
                              <th style={thStyle}>Статус</th>
                              <th style={thStyle}>Дії</th>
                          </tr>
                      </thead>
                      <tbody>
                          {filteredAdminUsers.map(u => (
                              <tr key={u.id} style={{borderBottom:'1px solid #eee', background: u.is_blocked ? '#fff5f5' : 'white'}}>
                                  <td style={tdStyle}>{u.id}</td>
                                  <td style={tdStyle}><strong>{u.username || 'No Name'}</strong></td>
                                  <td style={tdStyle}>{u.email}</td>
                                  <td style={tdStyle}>
                                      {u.is_blocked 
                                        ? <span style={{color:'#ef4444', fontWeight:'bold', background:'#fee2e2', padding:'2px 8px', borderRadius:'12px', fontSize:'0.8rem'}}>BANNED</span> 
                                        : <span style={{color:'#10b981', fontWeight:'bold', background:'#dcfce7', padding:'2px 8px', borderRadius:'12px', fontSize:'0.8rem'}}>Active</span>
                                      }
                                  </td>
                                  <td style={tdStyle}>
                                      {!u.is_admin && (
                                          u.is_blocked ? (
                                              <button onClick={() => handleUnblockUser(u.id)} style={{...linkBtnStyle, background:'#10b981', color:'white'}}>Розбанити</button>
                                          ) : (
                                              <button onClick={() => openBanModal(u.id)} style={{...linkBtnStyle, background:'#ef4444', color:'white'}}>ЗАБАНИТИ</button>
                                          )
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* МОДАЛКА БАНУ */}
      {showBanModal && (
          <div style={modalOverlayStyle}>
              <div style={modalContentStyle}>
                  <h3 style={{marginTop:0, color:'#b91c1c'}}>🚫 Блокування користувача</h3>
                  
                  <div style={{marginBottom:'15px'}}>
                    <label style={labelStyle}>Причина бану:</label>
                    <input 
                        style={inputStyle} 
                        value={banForm.reason} 
                        onChange={e => setBanForm({...banForm, reason: e.target.value})}
                        placeholder="Наприклад: Шахрайство"
                    />
                  </div>
                  
                  <div style={{marginBottom:'15px'}}>
                      <label style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer'}}>
                          <input 
                            type="checkbox" 
                            checked={banForm.is_permanent}
                            onChange={e => setBanForm({...banForm, is_permanent: e.target.checked})}
                            style={{width:'20px', height:'20px'}}
                          /> 
                          <span style={{fontWeight:'bold'}}>Бан назавжди</span>
                      </label>
                  </div>

                  {!banForm.is_permanent && (
                      <div style={{marginBottom:'15px'}}>
                          <label style={labelStyle}>Тривалість (днів):</label>
                          <input 
                            type="number" 
                            style={inputStyle}
                            value={banForm.duration_days}
                            onChange={e => setBanForm({...banForm, duration_days: Number(e.target.value)})}
                          />
                      </div>
                  )}

                  <p style={{fontSize:'0.85rem', color:'#ef4444', background:'#fef2f2', padding:'10px', borderRadius:'6px'}}>
                      ⚠️ Увага: Всі активні лоти та ставки цього користувача будуть автоматично видалені системою.
                  </p>

                  <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                      <button onClick={handleBlockUser} style={{...editBtnStyle, background:'#ef4444', color:'white'}}>Підтвердити БАН</button>
                      <button onClick={() => setShowBanModal(false)} style={{...editBtnStyle, background:'#f3f4f6', color:'#374151'}}>Скасувати</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- НОВА МОДАЛКА ВИДАЛЕННЯ ЛОТУ --- */}
      {showDeleteModal && (
          <div style={modalOverlayStyle}>
              <div style={modalContentStyle}>
                  <h3 style={{marginTop:0, color:'#b91c1c'}}>🔥 Видалення лота #{lotIdToDelete}</h3>
                  <p style={{fontSize:'0.9rem', color:'#666'}}>
                      Лот буде видалено безповоротно. Власнику буде надіслано сповіщення.
                  </p>
                  
                  <div style={{marginBottom:'15px'}}>
                      <label style={labelStyle}>Причина видалення:</label>
                      <textarea 
                          placeholder="Наприклад: Продаж заборонених товарів..." 
                          value={deleteReason} 
                          onChange={e => setDeleteReason(e.target.value)} 
                          style={{...inputStyle, height:'80px', resize:'vertical'}} 
                      />
                  </div>
                  
                  <div style={{display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'20px'}}>
                      <button onClick={confirmDeleteLot} style={{...editBtnStyle, background:'#ef4444', color:'white'}}>Підтвердити</button>
                      <button onClick={()=>setShowDeleteModal(false)} style={{...editBtnStyle, background:'#f3f4f6', color:'#374151'}}>Скасувати</button>
                  </div>
              </div>
          </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop:'30px' }}>
        
        {/* --- БЛОК 2: МОЇ ЛОТИ --- */}
        <div style={cardStyle}>
          
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
        <div style={cardStyle}>
          
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
                       <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                         {bid.lot ? bid.lot.title : <span style={{color:'red'}}>Лот видалено</span>}
                       </div>
                       
                       <div style={{ color: '#10b981', fontWeight: 'bold' }}>Ваша ставка: ${bid.amount}</div>
                       
                       <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '5px' }}>
                         {new Date(bid.timestamp).toLocaleDateString()} {new Date(bid.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </div>
                       
                       {!bid.is_active && <span style={{fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold'}}>✖ Ставка неактивна (Термін оплати минув)</span>}
                       
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

const cardStyle = { 
    background: 'white', 
    borderRadius: '16px', 
    padding: '30px', 
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)', 
    marginBottom: '30px', 
    border: '1px solid #f3f4f6' 
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
  minWidth: '80px',
  border:'none',
  cursor:'pointer'
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

// Admin table styles
const thStyle = { padding:'12px', textAlign:'left', borderBottom:'2px solid #e5e7eb', color:'#4b5563' };
const tdStyle = { padding:'12px', borderBottom:'1px solid #f3f4f6', color:'#374151' };

const modalOverlayStyle = { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000 };
const modalContentStyle = { background:'white', padding:'30px', borderRadius:'16px', width:'450px', maxWidth:'90%', boxShadow:'0 20px 25px -5px rgba(0, 0, 0, 0.1)' };