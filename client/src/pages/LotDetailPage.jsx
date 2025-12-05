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
  
  // Стан для Галереї
  const [activeImage, setActiveImage] = useState(null);

  // Стани форми ставки та UI
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- СТАНИ ДЛЯ РЕДАГУВАННЯ ---
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '', description: '', start_price: '', min_step: ''
  });
  
  // Керування картинками при редагуванні
  const [imagesToDelete, setImagesToDelete] = useState([]); 
  const [newImages, setNewImages] = useState([]); 
  const [newImagesPreview, setNewImagesPreview] = useState([]); 

  // --- ЗАВАНТАЖЕННЯ ДАНИХ ---
  const fetchData = async () => {
    if (!id || id === 'undefined') {
        setError("Невірне посилання на лот. Поверніться назад.");
        setLoading(false);
        return;
    }

    try {
      setLoading(true);
      
      const lotRes = await api.get(`/lots/${id}`);
      setLot(lotRes.data);
      
      // Ініціалізуємо форму
      setEditForm({
        title: lotRes.data.title,
        description: lotRes.data.description,
        start_price: lotRes.data.start_price,
        min_step: lotRes.data.min_step
      });
      
      // Галерея
      if (lotRes.data.images && lotRes.data.images.length > 0) {
        setActiveImage(lotRes.data.images[0].image_url);
      } else {
        setActiveImage(lotRes.data.image_url);
      }
      
      const bidsRes = await api.get(`/bids/${id}`);
      setBids(bidsRes.data);

      if (isAuthenticated) {
          try {
            const userRes = await api.get('/users/me');
            setMyDbId(userRes.data.id);
          } catch (e) { console.error(e); }
      }

    } catch (err) {
      console.error(err);
      setError("Не вдалося завантажити лот.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id, isAuthenticated]);

  useEffect(() => {
      return () => newImagesPreview.forEach(url => URL.revokeObjectURL(url));
  }, [newImagesPreview]);

  // --- ЛОГІКА РЕДАГУВАННЯ КАРТИНОК ---
  const handleDeleteExisting = (imgId) => {
      const currentCount = (lot.images?.length || 0) - imagesToDelete.length;
      const total = currentCount + newImages.length;

      if (total <= 1) {
          alert("Неможливо видалити: у лота повинна бути мінімум одна фотографія.");
          return;
      }

      if(!window.confirm("Видалити це фото?")) return;
      setImagesToDelete(prev => [...prev, imgId]);
  };

  const handleAddNewPhoto = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const currentCount = (lot.images?.length || 0) - imagesToDelete.length;
      const futureCount = currentCount + newImages.length + files.length;

      if (futureCount > 5) {
          alert(`Ліміт 5 фото.`);
          return;
      }

      setNewImages(prev => [...prev, ...files]);
      const urls = files.map(f => URL.createObjectURL(f));
      setNewImagesPreview(prev => [...prev, ...urls]);
      e.target.value = ''; 
  };

  const handleRemoveNewPhoto = (index) => {
      const currentCount = (lot.images?.length || 0) - imagesToDelete.length;
      const total = currentCount + newImages.length;

      if (total <= 1) {
          alert("Неможливо видалити: у лота повинна бути мінімум одна фотографія.");
          return;
      }

      URL.revokeObjectURL(newImagesPreview[index]);
      setNewImages(prev => prev.filter((_, i) => i !== index));
      setNewImagesPreview(prev => prev.filter((_, i) => i !== index));
  };

  // --- ЗБЕРЕЖЕННЯ ---
  const handleSaveEdit = async () => {
    try {
        const formData = new FormData();
        formData.append('title', editForm.title);
        formData.append('description', editForm.description);
        formData.append('start_price', editForm.start_price);
        formData.append('min_step', editForm.min_step);

        newImages.forEach(file => formData.append('new_images', file));
        imagesToDelete.forEach(id => formData.append('delete_image_ids', id));

        await api.patch(`/lots/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        alert("Лот успішно оновлено!");
        setIsEditing(false);
        setImagesToDelete([]);
        setNewImages([]);
        setNewImagesPreview([]);
        
        fetchData(); 
    } catch (err) {
        alert(err.response?.data?.detail || "Помилка при оновленні");
    }
  };

  // --- ІНШІ ОБРОБНИКИ ---
  const handleBid = async () => {
    try {
      await api.post(`/bids/${id}`, { amount: Number(bidAmount) });
      alert("Ставка успішно прийнята!");
      setBidAmount('');
      fetchData();
    } catch (err) {
      alert(`Помилка: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handlePayment = () => navigate(`/payment/${lot.id}`);

  const handleCloseAuction = async () => {
    if (!window.confirm("Ви впевнені?")) return;
    try {
      await api.post(`/lots/${id}/close`);
      alert("Аукціон завершено!");
      fetchData();
    } catch (err) {
      alert(`Помилка: ${err.response?.data?.detail}`);
    }
  };

  const handleRestoreLot = async () => {
      if(!window.confirm("Відновити цей лот?")) return;
      try {
          await api.post(`/lots/${id}/restore`);
          alert("Лот відновлено!");
          fetchData(); 
      } catch (e) {
          alert(e.response?.data?.detail || "Помилка відновлення");
      }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Завантаження...</div>;
  if (!lot) return null;

  // Константи статусів
  const isPendingPayment = lot.status === 'pending_payment';
  const isSold = lot.status === 'sold';
  const isClosedUnsold = lot.status === 'closed_unsold';
  const paymentDeadlineDate = lot.payment_deadline ? new Date(lot.payment_deadline) : null;
  const now = new Date();
  const isPaymentDeadlinePassed = paymentDeadlineDate && now > paymentDeadlineDate;

  // Фільтрація ставок
  const activeBids = bids.filter(b => b.is_active !== false);
  const highestBid = activeBids.length > 0 ? activeBids[0] : null;

  const isWinner = isAuthenticated && highestBid && highestBid.user_id === myDbId && (isPendingPayment || isSold);
  const isSeller = isAuthenticated && lot.seller_id === myDbId;

  const canEdit = isSeller && activeBids.length === 0 && lot.status === 'active';

  let statusText = "Активний";
  let statusColor = "#10b981"; 
  if (isSold) { statusText = "ПРОДАНО"; statusColor = "#ef4444"; }
  else if (isPendingPayment) { statusText = "ОЧІКУЄ ОПЛАТИ"; statusColor = "#f59e0b"; }
  else if (isClosedUnsold) { statusText = "ЗАКРИТО (Без ставок)"; statusColor = "#6b7280"; }

  const minNextBid = Number(lot.current_price) + Number(lot.min_step);
  
  const galleryImages = (lot.images && lot.images.length > 0) ? lot.images : [];
  const existingImagesToDisplay = galleryImages.filter(img => !imagesToDelete.includes(img.id));
  const totalImagesInEditor = existingImagesToDisplay.length + newImages.length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      
      <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span>←</span> Назад
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '3rem', marginBottom: '2rem' }}>
      
      {/* --- ЛІВА КОЛОНКА: ГАЛЕРЕЯ --- */}
      <div>
        <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)', position: 'sticky', top: '20px' }}>
          
          {/* VIEW MODE */}
          {!isEditing && (
              <>
                <div style={{ width: '100%', height: '500px', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                        src={activeImage || 'https://via.placeholder.com/600x400?text=No+Image'} 
                        alt={lot.title} 
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} 
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=No+Image'; }}
                    />
                </div>
                {galleryImages.length > 1 && (
                    <div style={{ display: 'flex', gap: '12px', padding: '16px', overflowX: 'auto', borderTop: '1px solid #e5e7eb' }}>
                        {galleryImages.map((img) => (
                            <img key={img.id} src={img.image_url} alt="thumb" onClick={() => setActiveImage(img.image_url)}
                                style={{
                                    width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer',
                                    border: activeImage === img.image_url ? '3px solid #6366f1' : '1px solid #e5e7eb',
                                    opacity: activeImage === img.image_url ? 1 : 0.7,
                                    transition: 'all 0.2s', flexShrink: 0
                                }}
                            />
                        ))}
                    </div>
                )}
              </>
          )}

          {/* EDIT MODE */}
          {isEditing && (
              <div style={{ padding: '20px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#374151' }}>Керування фото ({totalImagesInEditor}/5)</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                      {existingImagesToDisplay.map(img => (
                          <div key={img.id} style={{ position: 'relative', width: '90px', height: '90px' }}>
                              <img src={img.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                              <button onClick={() => handleDeleteExisting(img.id)} style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: 'white', borderRadius: '50%', width: '24px', height: '24px', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>✕</button>
                          </div>
                      ))}
                      {newImagesPreview.map((url, idx) => (
                          <div key={idx} style={{ position: 'relative', width: '90px', height: '90px' }}>
                              <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '2px solid #10b981' }} />
                              <button onClick={() => handleRemoveNewPhoto(idx)} style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: 'white', borderRadius: '50%', width: '24px', height: '24px', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>✕</button>
                          </div>
                      ))}
                      {totalImagesInEditor < 5 && (
                          <label style={{ width: '90px', height: '90px', borderRadius: '8px', border: '2px dashed #6366f1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#e0e7ff', color: '#4f46e5' }}>
                              <span style={{ fontSize: '24px' }}>+</span>
                              <span style={{ fontSize: '10px' }}>Додати</span>
                              <input type="file" multiple accept="image/*" onChange={handleAddNewPhoto} style={{ display: 'none' }} />
                          </label>
                      )}
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* --- ПРАВА КОЛОНКА: ДЕТАЛІ --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* БЛОК 1: НАЗВА, ОПИС, ТИП */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)' }}>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>Назва</label>
                    <input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} style={{ width: '100%', padding: '10px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>Опис</label>
                    <textarea rows="5" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} style={{ width: '100%', padding: '10px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
            </div>
          ) : (
            <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                        {/* --- ТУТ МИ ДОДАЛИ АЙДІШНІК --- */}
                        <div style={{fontSize: '0.85rem', color: '#9ca3af', marginBottom: '5px', fontWeight: 'bold', letterSpacing: '0.5px'}}>
                            LOT #{lot.id}
                        </div>

                        {/* --- БЕЙДЖ БЛАГОДІЙНОСТІ --- */}
                        {lot.lot_type === 'charity' ? (
                            <span style={{
                                background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                                color: 'white', padding: '4px 10px', borderRadius: '20px',
                                fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-block', marginBottom: '10px'
                            }}>
                                ❤️ Благодійний
                            </span>
                        ) : (
                            // Можна показувати бейдж "Звичайний", а можна ні. Для чистоти дизайну я часто приховую "звичайний".
                            // Але якщо хочете - розкоментуйте:
                            /* <span style={{background:'#f3f4f6', color:'#6b7280', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold', display:'inline-block', marginBottom:'10px'}}>💼 Приватний</span> */
                            null
                        )}
                        <h1 style={{ margin: '0 0 1rem 0', fontSize: '2.5rem', fontWeight: '800', color: '#1f2937', lineHeight: '1.2' }}>{lot.title}</h1>
                    </div>
                    
                    {canEdit && (
                        <button onClick={() => setIsEditing(true)} style={{ background: '#e0e7ff', color: '#4338ca', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}>✎ Редагувати</button>
                    )}
                </div>
                <p style={{ color: '#4b5563', lineHeight: '1.7', fontSize: '1.1rem', margin: 0, whiteSpace: 'pre-wrap' }}>{lot.description}</p>
            </>
          )}
        </div>
        
        {/* БЛОК 2: ЦІНА */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)' }}>
          {isEditing ? (
             <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>Стартова ціна ($)</label>
                    <input type="number" value={editForm.start_price} onChange={e => setEditForm({...editForm, start_price: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>Мін. крок ($)</label>
                    <input type="number" value={editForm.min_step} onChange={e => setEditForm({...editForm, min_step: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
             </div>
          ) : (
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '2px solid #e5e7eb' }}>
                <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: '500' }}>ПОТОЧНА ЦІНА</div>
                    <div style={{ fontSize: '3rem', fontWeight: '900', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: '1' }}>${lot.current_price}</div>
                    <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '5px' }}>Мін. крок: ${lot.min_step}</div>
                </div>
                <div style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', backgroundColor: statusColor, color: 'white', fontWeight: '700', fontSize: '0.95rem', boxShadow: `0 4px 12px ${statusColor}40`, textTransform: 'uppercase' }}>{statusText}</div>
             </div>
          )}

          {isEditing && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button onClick={handleSaveEdit} style={{ background: '#16a34a', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>💾 Зберегти</button>
                  <button onClick={() => { setIsEditing(false); setImagesToDelete([]); setNewImages([]); setNewImagesPreview([]); }} style={{ background: '#f3f4f6', color: '#374151', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Скасувати</button>
              </div>
          )}
          
          {/* Блок Відновлення (Restore) */}
          {!isEditing && isClosedUnsold && isSeller && (
                <div style={{marginTop:'20px', padding:'15px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'8px'}}>
                    <h4 style={{marginTop:0, color:'#9a3412'}}>⚠️ Лот закритий без ставок</h4>
                    <p style={{fontSize:'0.9rem', color:'#c2410c'}}>Цей лот буде видалений через 24 години. Ви можете відновити його зараз.</p>
                    <button onClick={handleRestoreLot} style={{width:'100%', padding:'12px', background:'#ea580c', color:'white', fontWeight:'bold', border:'none', borderRadius:'8px', cursor:'pointer'}}>🔄 Відновити лот</button>
                </div>
          )}

          {/* Таймер оплати */}
          {!isEditing && lot.payment_deadline && (
            <div style={{ padding: '1.25rem', background: isPaymentDeadlinePassed ? '#fef2f2' : '#eff6ff', borderRadius: '12px', border: `2px solid ${isPaymentDeadlinePassed ? '#fecaca' : '#bfdbfe'}` }}>
              <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: '600' }}>Дедлайн оплати</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '700', color: isPaymentDeadlinePassed ? '#dc2626' : '#1e40af' }}>{paymentDeadlineDate.toLocaleString('uk-UA')}</div>
            </div>
          )}
        </div>

        {/* Продавець */}
        {lot.seller && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '4px' }}>Продавець</div>
              <div style={{ fontWeight: '700', color: '#1f2937', fontSize: '1.1rem' }}>{lot.seller.username || "Користувач"}</div>
              {lot.seller.phone_number && <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{lot.seller.phone_number}</div>}
          </div>
        )}

        {/* --- ЗОНА ДІЙ --- */}

        {/* Ставки */}
        {!isEditing && !isClosedUnsold && lot.status === 'active' && !isSeller && (
          <div style={{ background: '#eff6ff', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)', border: '2px solid #e0e7ff' }}>
            {!isAuthenticated ? (
              <button onClick={() => loginWithRedirect()} style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', fontWeight: '700', fontSize: '1.1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)' }}>Увійдіть</button>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '700', fontSize: '1.1rem', color: '#374151' }}>Ваша ставка (мін: ${minNextBid})</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder={`$${minNextBid}`} style={{ flex: 1, padding: '1rem', fontSize: '1.1rem', borderRadius: '12px', border: '2px solid #cbd5e1', outline: 'none' }} />
                  <button onClick={handleBid} style={{ padding: '1rem 2rem', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', fontWeight: '700', fontSize: '1.1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)' }}>Зробити ставку</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Продавець: Завершити */}
        {!isEditing && !isClosedUnsold && isSeller && lot.status === 'active' && activeBids.length > 0 && (
             <div style={{ background: '#fffbeb', borderRadius: '16px', padding: '1.5rem', border: '2px solid #fde68a' }}>
                 <h3 style={{ marginTop: 0, color: '#92400e', fontSize: '1.2rem' }}>Керування лотом</h3>
                 <p style={{ color: '#b45309', marginBottom: '1rem' }}>Ви можете завершити аукціон зараз.</p>
                 <button onClick={handleCloseAuction} style={{ width: '100%', padding: '1rem', background: '#f59e0b', color: 'white', fontWeight: '700', fontSize: '1.1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)' }}>🛑 Завершити аукціон</button>
             </div>
        )}

        {/* Оплата */}
        {isPendingPayment && isWinner && !isPaymentDeadlinePassed && (
            <div style={{ padding: '2rem', background: '#ecfdf5', borderRadius: '16px', border: '2px solid #d1fae5', textAlign: 'center' }}>
                <h3 style={{ color: '#065f46', marginTop: 0, fontSize: '1.5rem' }}>Вітаємо! Ви перемогли 🎉</h3>
                <button onClick={handlePayment} style={{ padding: '1rem 3rem', background: '#10b981', color: 'white', fontWeight: '800', fontSize: '1.2rem', borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>ПЕРЕЙТИ ДО ОПЛАТИ</button>
            </div>
        )}

        {/* Переможець не встиг */}
        {isPendingPayment && isWinner && isPaymentDeadlinePassed && (
            <div style={{ padding: '2rem', background: '#fef2f2', borderRadius: '16px', border: '2px solid #fecaca', textAlign: 'center' }}>
                <h3 style={{ color: '#991b1b', marginTop: 0 }}>⚠️ Час вичерпано</h3>
                <p style={{ color: '#b91c1c', fontSize: '1.1rem' }}>Ви не встигли оплатити в строк. Перемога анульована.</p>
            </div>
        )}

        {/* Не переможець */}
        {isPendingPayment && !isWinner && (
            <div style={{ padding: '1.5rem', background: '#f3f4f6', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ marginTop: 0, color: '#374151' }}>Аукціон завершено</h3>
                <p style={{ color: '#6b7280' }}>Переможець: <strong>{highestBid ? `Користувач #${highestBid.user_id}` : "Ставок не було"}</strong></p>
            </div>
        )}

        {/* Продано */}
        {lot.status === 'sold' && (
            <div style={{ padding: '2rem', background: '#f0fdf4', borderRadius: '16px', border: '2px solid #bbf7d0', textAlign: 'center' }}>
                <h3 style={{ color: '#166534', marginTop: 0, fontSize: '1.5rem' }}>Лот успішно продано 🔒</h3>
            </div>
        )}

        {/* Історія ставок */}
        {!isEditing && (
            <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1f2937', fontSize: '1.3rem', fontWeight: '700' }}>Історія ставок ({activeBids.length})</h3>
                {activeBids.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', background: '#f9fafb', borderRadius: '12px', border: '1px dashed #d1d5db' }}>Ставок ще немає. Будьте першим!</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {activeBids.map((bid, index) => (
                        <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: index === 0 ? '#f0fdf4' : 'white', border: index === 0 ? '2px solid #bbf7d0' : '1px solid #f3f4f6', borderRadius: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {index === 0 && <span style={{ fontSize: '1.5rem' }}>👑</span>}
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1f2937' }}>${bid.amount}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                                        {bid.user_id === myDbId ? <span style={{color: '#6366f1', fontWeight: 'bold'}}>Ви</span> : `Користувач #${bid.user_id}`}
                                    </div>
                                </div>
                            </div>
                            <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{new Date(bid.timestamp).toLocaleString('uk-UA')}</div>
                        </div>
                        ))}
                    </div>
                )}
            </div>
        )}

      </div>
      </div>
    </div>
  );
}