import { useState, useEffect } from 'react';
import { useApi } from '../useApi';
import { useNavigate } from 'react-router-dom';

export default function CreateLotPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    title: '', 
    description: '', 
    start_price: '', 
    min_step: 10, 
    payment_deadline_days: 0, 
    payment_deadline_hours: 24, 
    payment_deadline_minutes: 0, 
  });
  
  // Стейт для списку файлів та їх прев'ю
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  // Очищення пам'яті від URL при розмонтуванні компонента
  useEffect(() => {
    return () => {
        previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  // --- НОВА ФУНКЦІЯ: Додавання фото (APPEND) ---
  const handleAddPhoto = (e) => {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;
    
    // Перевірка ліміту
    if (selectedFiles.length + newFiles.length > 5) {
      alert(`Максимум 5 фотографій! Ви вже додали ${selectedFiles.length}, намагаєтесь додати ще ${newFiles.length}.`);
      // Скидаємо інпут, щоб можна було вибрати заново
      e.target.value = '';
      return;
    }

    // Створюємо прев'ю для нових файлів
    const newUrls = newFiles.map(file => URL.createObjectURL(file));

    // Додаємо нові файли до старих (використовуємо spread operator ...)
    setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
    setPreviewUrls(prevUrls => [...prevUrls, ...newUrls]);

    // Скидаємо значення інпуту, щоб якщо користувач вибере той самий файл знову, подія onChange спрацювала
    e.target.value = '';
  };

  // --- НОВА ФУНКЦІЯ: Видалення конкретного фото ---
  const removePhoto = (indexToRemove) => {
    // Звільняємо пам'ять, яку займало прев'ю
    URL.revokeObjectURL(previewUrls[indexToRemove]);

    // Фільтруємо масиви, залишаючи тільки ті елементи, індекс яких не збігається з тим, що видаляємо
    setSelectedFiles(prevFiles => 
        prevFiles.filter((_, index) => index !== indexToRemove)
    );
    setPreviewUrls(prevUrls => 
        prevUrls.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
        alert("Будь ласка, додайте хоча б одне фото.");
        return;
    }

    setLoading(true);
    
    try {
      const formData = new FormData();
      
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('start_price', form.start_price);
      formData.append('min_step', form.min_step);
      formData.append('payment_deadline_days', form.payment_deadline_days);
      formData.append('payment_deadline_hours', form.payment_deadline_hours);
      formData.append('payment_deadline_minutes', form.payment_deadline_minutes);

      // Додаємо кожне фото окремо
      selectedFiles.forEach((file) => {
          formData.append('images', file);
      });

      await api.post('/lots/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      navigate('/lots'); // Повертаємось до списку
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Помилка створення лота.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 20px', background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: '700px', background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        
        <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: '#111827', marginBottom: '8px', textAlign: 'center' }}>Створити новий лот</h1>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '32px' }}>Заповніть деталі вашого товару для аукціону</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Назва */}
          <div>
            <label style={labelStyle}>Назва лота</label>
            <input 
              type="text" 
              required
              placeholder="Наприклад: iPhone 13 Pro Max"
              value={form.title}
              onChange={e => setForm({...form, title: e.target.value})}
              style={inputStyle}
            />
          </div>

          {/* Опис */}
          <div>
            <label style={labelStyle}>Опис</label>
            <textarea 
              rows="4"
              placeholder="Детальний опис стану товару..."
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
              style={{...inputStyle, resize: 'vertical'}}
            />
          </div>

          {/* Ціна та Крок */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Стартова ціна ($)</label>
              <input 
                type="number" 
                required
                min="0"
                step="0.01"
                value={form.start_price}
                onChange={e => setForm({...form, start_price: e.target.value})}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Мін. крок ставки ($)</label>
              <input 
                type="number" 
                required
                min="1"
                step="1"
                value={form.min_step}
                onChange={e => setForm({...form, min_step: e.target.value})}
                style={inputStyle}
              />
            </div>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />

          {/* Дедлайн оплати */}
          <div>
            <label style={{...labelStyle, color: '#4f46e5'}}>⏳ Час на оплату для переможця</label>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '10px' }}>
               Скільки часу буде у переможця, щоб оплатити лот після завершення аукціону.
            </p>
            <div style={{ display: 'flex', gap: '15px' }}>
               <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Днів</label>
                  <input type="number" min="0" value={form.payment_deadline_days} onChange={e => setForm({...form, payment_deadline_days: e.target.value})} style={inputStyle} />
               </div>
               <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Годин</label>
                  <input type="number" min="0" max="23" value={form.payment_deadline_hours} onChange={e => setForm({...form, payment_deadline_hours: e.target.value})} style={inputStyle} />
               </div>
               <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Хвилин</label>
                  <input type="number" min="0" max="59" value={form.payment_deadline_minutes} onChange={e => setForm({...form, payment_deadline_minutes: e.target.value})} style={inputStyle} />
               </div>
            </div>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />

          {/* --- НОВИЙ БЛОК ЗАВАНТАЖЕННЯ ФОТО --- */}
          <div>
            <label style={labelStyle}>
                Фотографії товару ({selectedFiles.length}/5)
            </label>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '10px' }}>
              
              {/* 1. Відображення вже доданих фото */}
              {previewUrls.map((url, idx) => (
                <div key={url} style={{ position: 'relative', width: '100px', height: '100px' }}>
                    <img 
                        src={url} 
                        alt={`Preview ${idx}`} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid #d1d5db' }} 
                    />
                    {/* Кнопка видалення (хрестик) */}
                    <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        style={{
                            position: 'absolute',
                            top: '-8px',
                            right: '-8px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        ✕
                    </button>
                </div>
              ))}

              {/* 2. Кнопка "+ Додати фото" (Показуємо, якщо менше 5 фото) */}
              {selectedFiles.length < 5 && (
                  <label style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '8px',
                      border: '2px dashed #6366f1',
                      background: '#e0e7ff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#4f46e5',
                      transition: 'all 0.2s'
                  }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold' }}>+</span>
                      <span style={{ fontSize: '12px', marginTop: '4px' }}>Додати</span>
                      {/* Прихований інпут, який спрацьовує при кліку на лейбл */}
                      <input 
                          type="file" 
                          accept="image/*" 
                          multiple // Дозволяємо вибрати кілька за раз, якщо користувач хоче
                          onChange={handleAddPhoto}
                          style={{ display: 'none' }}
                      />
                  </label>
              )}
            </div>
            
            {selectedFiles.length === 0 && (
                 <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '10px' }}>
                    Додайте хоча б одну фотографію, щоб створити лот.
                 </p>
            )}

          </div>

          {/* Кнопки */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <button type="button" onClick={() => navigate('/')} style={{ flex: 1, padding: '0.875rem 1.5rem', background: '#f3f4f6', color: '#374151', fontWeight: '600', fontSize: '1rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
              Скасувати
            </button>
            <button type="submit" disabled={loading || selectedFiles.length === 0} style={{ flex: 2, padding: '0.875rem 1.5rem', background: (loading || selectedFiles.length === 0) ? '#9ca3af' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', fontWeight: '600', fontSize: '1rem', cursor: (loading || selectedFiles.length === 0) ? 'not-allowed' : 'pointer', borderRadius: '8px', border: 'none' }}>
              {loading ? 'Створення...' : 'Створити лот'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '0.95rem',
  fontWeight: '600',
  color: '#374151'
};

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  fontSize: '1rem',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box'
};