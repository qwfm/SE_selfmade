import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../useApi';
import { useAuth0 } from '@auth0/auth0-react';

export default function LotDetailPage() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  
  const [lot, setLot] = useState(null);
  const [bids, setBids] = useState([]);
  const [myDbId, setMyDbId] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Редагування
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', start_price: '', min_step: '' });
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newImagesPreview, setNewImagesPreview] = useState([]);

  // --- DATA FETCHING ---
  const fetchData = async () => {
    if (!id || id === 'undefined') { setError("Error URL"); setLoading(false); return; }
    try {
      setLoading(true);
      const lotRes = await api.get(`/lots/${id}`);
      setLot(lotRes.data);
      setEditForm({
        title: lotRes.data.title, description: lotRes.data.description,
        start_price: lotRes.data.start_price, min_step: lotRes.data.min_step
      });
      if (lotRes.data.images?.length > 0) setActiveImage(lotRes.data.images[0].image_url);
      else setActiveImage(lotRes.data.image_url);
      
      const bidsRes = await api.get(`/bids/${id}`);
      setBids(bidsRes.data);

      if (isAuthenticated) {
          const u = await api.get('/users/me');
          setMyDbId(u.data.id);
      }
    } catch (e) { setError("Лот не знайдено"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id, isAuthenticated]);
  useEffect(() => { return () => newImagesPreview.forEach(url => URL.revokeObjectURL(url)); }, [newImagesPreview]);

  // --- HANDLERS ---
  const handleDeleteExisting = (imgId) => {
      const current = (lot.images?.length || 0) - imagesToDelete.length;
      if (current + newImages.length <= 1) return alert("Мінімум 1 фото!");
      if(!window.confirm("Видалити?")) return;
      setImagesToDelete(p => [...p, imgId]);
  };
  const handleAddNewPhoto = (e) => { /* ... той самий код ... */ 
      const files = Array.from(e.target.files);
      if (!files.length) return;
      const current = (lot.images?.length || 0) - imagesToDelete.length;
      if (current + newImages.length + files.length > 5) return alert("Ліміт 5 фото");
      setNewImages(prev => [...prev, ...files]);
      setNewImagesPreview(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
      e.target.value = '';
  };
  const handleRemoveNewPhoto = (idx) => {
      const current = (lot.images?.length || 0) - imagesToDelete.length;
      if (current + newImages.length <= 1) return alert("Мінімум 1 фото!");
      URL.revokeObjectURL(newImagesPreview[idx]);
      setNewImages(p => p.filter((_, i) => i !== idx));
      setNewImagesPreview(p => p.filter((_, i) => i !== idx));
  };

  const handleSaveEdit = async () => {
    try {
        const fd = new FormData();
        fd.append('title', editForm.title); fd.append('description', editForm.description);
        fd.append('start_price', editForm.start_price); fd.append('min_step', editForm.min_step);
        newImages.forEach(f => fd.append('new_images', f));
        imagesToDelete.forEach(id => fd.append('delete_image_ids', id));
        await api.patch(`/lots/${id}`, fd, { headers: {'Content-Type': 'multipart/form-data'} });
        alert("Оновлено!"); setIsEditing(false); setImagesToDelete([]); setNewImages([]); setNewImagesPreview([]);
        fetchData();
    } catch (e) { alert(e.response?.data?.detail); }
  };

  const handleBid = async () => {
    try { await api.post(`/bids/${id}`, { amount: Number(bidAmount) }); alert("Ставка прийнята!"); setBidAmount(''); fetchData(); } 
    catch (e) { alert(e.response?.data?.detail); }
  };

  const handlePayment = () => navigate(`/payment/${lot.id}`);

  // --- НОВА ЛОГІКА ДЛЯ КНОПОК ---
  
  // 1. ЗАВЕРШИТИ АУКЦІОН (тільки якщо є ставки)
  const handleCloseAuction = async () => {
    if (!window.confirm("Завершити аукціон і визнати поточного лідера переможцем?")) return;
    try { await api.post(`/lots/${id}/close`); fetchData(); } 
    catch (e) { alert(e.response?.data?.detail); }
  };

  // 2. ВИДАЛИТИ ЛОТ (якщо немає ставок)
  const handleDeleteLot = async () => {
      if (!window.confirm("Видалити цей лот безповоротно?")) return;
      try {
          await api.delete(`/lots/${id}`);
          alert("Лот видалено.");
          navigate('/lots'); // Повертаємось до списку
      } catch (e) {
          alert(e.response?.data?.detail || "Помилка видалення");
      }
  };

  if (loading) return <div style={{padding:'40px', textAlign:'center'}}>Завантаження...</div>;
  if (!lot) return null;

  const isPending = lot.status === 'pending_payment';
  const isSold = lot.status === 'sold';
  const activeBids = bids.filter(b => b.is_active !== false);
  const highestBid = activeBids[0];
  const isWinner = isAuthenticated && highestBid && highestBid.user_id === myDbId && (isPending || isSold);
  const isSeller = isAuthenticated && lot.seller_id === myDbId;
  const canEdit = isSeller && activeBids.length === 0 && lot.status === 'active';

  let statusText = "Активний"; let statusColor = "#10b981"; 
  if (isSold) { statusText = "ПРОДАНО"; statusColor = "#ef4444"; }
  else if (isPending) { statusText = "ОЧІКУЄ ОПЛАТИ"; statusColor = "#f59e0b"; }

  const galleryImages = lot.images || [];
  const existingDisplay = galleryImages.filter(img => !imagesToDelete.includes(img.id));
  const totalImgs = existingDisplay.length + newImages.length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', border:'none', background:'none', cursor:'pointer' }}>← Назад</button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '3rem' }}>
        
        {/* ЛІВА: ГАЛЕРЕЯ */}
        <div>
           <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
               {!isEditing ? (
                   <>
                     <div style={{width:'100%', height:'500px', background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        <img src={activeImage || 'https://via.placeholder.com/600'} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} onError={(e)=>e.target.src='https://via.placeholder.com/600'} />
                     </div>
                     {galleryImages.length > 1 && (
                         <div style={{display:'flex', gap:'10px', padding:'10px', overflowX:'auto'}}>
                             {galleryImages.map(img => (
                                 <img key={img.id} src={img.image_url} onClick={()=>setActiveImage(img.image_url)} style={{width:'70px', height:'70px', borderRadius:'8px', cursor:'pointer', border: activeImage===img.image_url?'2px solid blue':'none', objectFit:'cover'}} />
                             ))}
                         </div>
                     )}
                   </>
               ) : (
                   <div style={{padding:'20px'}}>
                       <h3>Фото ({totalImgs}/5)</h3>
                       <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                           {existingDisplay.map(img => (
                               <div key={img.id} style={{position:'relative', width:'80px', height:'80px'}}>
                                   <img src={img.image_url} style={{width:'100%', height:'100%', borderRadius:'8px', objectFit:'cover'}} />
                                   <button onClick={()=>handleDeleteExisting(img.id)} style={{position:'absolute', top:-5, right:-5, background:'red', color:'white', borderRadius:'50%', border:'none', width:'20px', height:'20px', cursor:'pointer'}}>x</button>
                               </div>
                           ))}
                           {newImagesPreview.map((url, i) => (
                               <div key={i} style={{position:'relative', width:'80px', height:'80px'}}>
                                   <img src={url} style={{width:'100%', height:'100%', borderRadius:'8px', border:'2px solid green', objectFit:'cover'}} />
                                   <button onClick={()=>handleRemoveNewPhoto(i)} style={{position:'absolute', top:-5, right:-5, background:'red', color:'white', borderRadius:'50%', border:'none', width:'20px', height:'20px', cursor:'pointer'}}>x</button>
                               </div>
                           ))}
                           {totalImgs < 5 && (
                               <label style={{width:'80px', height:'80px', border:'2px dashed blue', display:'flex', justifyContent:'center', alignItems:'center', cursor:'pointer'}}>
                                   +<input type="file" multiple accept="image/*" onChange={handleAddNewPhoto} style={{display:'none'}} />
                               </label>
                           )}
                       </div>
                   </div>
               )}
           </div>
        </div>

        {/* ПРАВА: ІНФО */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                
                <div style={{fontSize:'0.85rem', color:'#9ca3af', marginBottom:'5px', fontWeight:'bold'}}>LOT #{lot.id}</div>
                {lot.lot_type === 'charity' && <span style={{background:'linear-gradient(135deg, #ec4899, #db2777)', color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'0.8rem', fontWeight:'bold', marginBottom:'10px', display:'inline-block'}}>❤️ Благодійний</span>}

                {isEditing ? (
                    <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                        <label>Назва</label><input value={editForm.title} onChange={e=>setEditForm({...editForm, title:e.target.value})} style={{padding:'8px', width:'100%'}} />
                        <label>Опис</label><textarea value={editForm.description} onChange={e=>setEditForm({...editForm, description:e.target.value})} style={{padding:'8px', width:'100%'}} rows={4} />
                    </div>
                ) : (
                    <>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                            <h1 style={{margin:0}}>{lot.title}</h1>
                            {canEdit && <button onClick={()=>setIsEditing(true)} style={{padding:'5px 10px', background:'#e0e7ff', border:'none', borderRadius:'5px', cursor:'pointer'}}>✎ Ред.</button>}
                        </div>
                        <p>{lot.description}</p>
                    </>
                )}
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                {isEditing ? (
                    <div style={{display:'flex', gap:'10px'}}>
                        <div><label>Ціна</label><input type="number" value={editForm.start_price} onChange={e=>setEditForm({...editForm, start_price:e.target.value})} style={{padding:'8px', width:'100%'}} /></div>
                        <div><label>Крок</label><input type="number" value={editForm.min_step} onChange={e=>setEditForm({...editForm, min_step:e.target.value})} style={{padding:'8px', width:'100%'}} /></div>
                    </div>
                ) : (
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div>
                            <div style={{color:'#666', fontSize:'0.9rem'}}>ПОТОЧНА ЦІНА</div>
                            <div style={{fontSize:'2.5rem', fontWeight:'bold', color:'#4f46e5'}}>${lot.current_price}</div>
                            <div style={{fontSize:'0.9rem'}}>Крок: ${lot.min_step}</div>
                        </div>
                        <div style={{padding:'5px 15px', background:statusColor, color:'white', borderRadius:'10px', fontWeight:'bold'}}>{statusText}</div>
                    </div>
                )}

                {isEditing && (
                    <div style={{marginTop:'20px', display:'flex', gap:'10px'}}>
                        <button onClick={handleSaveEdit} style={{padding:'10px', background:'green', color:'white', border:'none', borderRadius:'5px', cursor:'pointer'}}>Зберегти</button>
                        <button onClick={()=>{setIsEditing(false); setImagesToDelete([]); setNewImages([])}} style={{padding:'10px', background:'#eee', border:'none', borderRadius:'5px', cursor:'pointer'}}>Скасувати</button>
                    </div>
                )}

                {!isEditing && lot.payment_deadline && (
                    <div style={{marginTop:'15px', padding:'10px', background:'#eff6ff', borderRadius:'8px', color:'#1e40af', fontWeight:'bold'}}>
                        Дедлайн оплати: {new Date(lot.payment_deadline).toLocaleString()}
                    </div>
                )}
            </div>

            {/* ПРОДАВЕЦЬ */}
            {lot.seller && (
              <div style={{background:'white', padding:'20px', borderRadius:'16px', boxShadow:'0 4px 6px rgba(0,0,0,0.05)'}}>
                  <div style={{fontSize:'0.9rem', color:'#666'}}>Продавець</div>
                  <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{lot.seller.username || "Користувач"}</div>
                  <div style={{color:'#666'}}>{lot.seller.phone_number}</div>
              </div>
            )}

            {/* --- КЕРУВАННЯ ЛОТОМ (ДИНАМІЧНА КНОПКА) --- */}
            {!isEditing && isSeller && lot.status === 'active' && (
                <div style={{background:'#fffbeb', padding:'20px', borderRadius:'16px', border:'2px solid #fde68a'}}>
                    <h3 style={{marginTop:0, color:'#92400e'}}>Керування лотом</h3>
                    
                    {/* ЯКЩО Є СТАВКИ -> МОЖНА ЗАВЕРШИТИ */}
                    {activeBids.length > 0 ? (
                        <>
                            <p style={{color:'#b45309', marginBottom:'10px'}}>Є активні ставки. Ви можете завершити аукціон, і переможець буде визначений.</p>
                            <button onClick={handleCloseAuction} style={{width:'100%', padding:'12px', background:'#f59e0b', color:'white', fontWeight:'bold', border:'none', borderRadius:'8px', cursor:'pointer'}}>
                                🛑 Завершити аукціон
                            </button>
                        </>
                    ) : (
                        /* ЯКЩО НЕМАЄ СТАВОК -> МОЖНА ТІЛЬКИ ВИДАЛИТИ */
                        <>
                            <p style={{color:'#b45309', marginBottom:'10px'}}>Ставок поки немає. Ви можете видалити лот, якщо передумали продавати.</p>
                            <button onClick={handleDeleteLot} style={{width:'100%', padding:'12px', background:'#ef4444', color:'white', fontWeight:'bold', border:'none', borderRadius:'8px', cursor:'pointer'}}>
                                🗑 Видалити лот
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ДІЇ ПОКУПЦЯ */}
            {!isEditing && !isSold && lot.status === 'active' && !isSeller && (
                <div style={{background:'#eff6ff', padding:'20px', borderRadius:'16px', border:'2px solid #bfdbfe'}}>
                    {isAuthenticated ? (
                        <div style={{display:'flex', gap:'10px'}}>
                            <input type="number" value={bidAmount} onChange={e=>setBidAmount(e.target.value)} placeholder={`Мін: $${Number(lot.current_price)+Number(lot.min_step)}`} style={{flex:1, padding:'10px', borderRadius:'8px', border:'1px solid #ccc'}} />
                            <button onClick={handleBid} style={{padding:'10px 20px', background:'#4f46e5', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>Зробити ставку</button>
                        </div>
                    ) : <button onClick={loginWithRedirect} style={{width:'100%', padding:'10px'}}>Увійдіть щоб зробити ставку</button>}
                </div>
            )}

            {/* ОПЛАТА */}
            {isPending && isWinner && lot.payment_deadline && (
            <div style={{ padding: '2rem', background: '#ecfdf5', borderRadius: '16px', border: '2px solid #d1fae5', textAlign: 'center' }}>
                <h3 style={{ color: '#065f46', marginTop: 0, fontSize: '1.5rem' }}>Вітаємо! Ви перемогли 🎉</h3>
                <p style={{ marginBottom: '1.5rem', color: '#047857', fontSize: '1.1rem' }}>
                    Ваша ставка <strong>${highestBid?.amount}</strong> виграла.
                </p>
                
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                    <button 
                        onClick={handlePayment} 
                        style={{ 
                            padding: '12px 30px', 
                            background: '#10b981', 
                            color: 'white', 
                            fontWeight: '800', 
                            fontSize: '1.1rem', 
                            borderRadius: '12px', 
                            border: 'none', 
                            cursor: 'pointer', 
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' 
                        }}
                    >
                        ПЕРЕЙТИ ДО ОПЛАТИ
                    </button>

                    {/* НОВА КНОПКА ВІДМОВИ */}
                    <button 
                        onClick={async () => {
                            if(!window.confirm("Ви дійсно хочете відмовитись від перемоги? Лот перейде наступному учаснику.")) return;
                            try {
                                await api.delete(`/bids/${highestBid.id}`);
                                alert("Ви відмовились від лоту.");
                                fetchData();
                            } catch (e) {
                                alert(e.response?.data?.detail);
                            }
                        }}
                        style={{ 
                            padding: '12px 20px', 
                            background: 'white', 
                            color: '#ef4444', 
                            fontWeight: 'bold', 
                            fontSize: '1rem', 
                            borderRadius: '12px', 
                            border: '2px solid #fecaca', 
                            cursor: 'pointer' 
                        }}
                    >
                        Відмовитися
                    </button>
                </div>
            </div>
        )}

            

            {/* ІСТОРІЯ СТАВОК */}
            {!isEditing && (
                <div style={{background:'white', padding:'20px', borderRadius:'16px', boxShadow:'0 4px 6px rgba(0,0,0,0.05)'}}>
                    <h3>Історія ставок ({activeBids.length})</h3>
                    {activeBids.map((bid, i) => (
                        <div key={bid.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid #eee', background: i===0?'#f0fdf4':'white'}}>
                            <div><b>${bid.amount}</b> {i===0 && '👑'} <span style={{color:'#888', fontSize:'0.8rem'}}>{bid.user_id===myDbId?'(Ви)':`User #${bid.user_id}`}</span></div>
                            <div style={{color:'#888', fontSize:'0.8rem'}}>{new Date(bid.timestamp).toLocaleString()}</div>
                        </div>
                    ))}
                    {activeBids.length===0 && <div style={{textAlign:'center', color:'#888'}}>Немає ставок</div>}
                </div>
            )}

        </div>
      </div>
    </div>
  );
}