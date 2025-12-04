// src/pages/CreateLotPage.jsx
import { useState } from 'react';
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
    // Тільки налаштування дедлайну ОПЛАТИ
    payment_deadline_days: 0, 
    payment_deadline_hours: 24, 
    payment_deadline_minutes: 0, 
  });
  
  // Стейт для списку файлів
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 5) {
      alert("Максимум 5 фотографій!");
      return;
    }

    setSelectedFiles(files);

    // Генеруємо прев'ю
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      if (selectedFiles.length > 0) {
        selectedFiles.forEach((file) => {
            formData.append('images', file);
        });
      }

      await api.post('/lots/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      navigate('/lots'); // Повертаємось до списку
    } catch (err) {
      console.error(err);
      alert('Помилка створення лота. Перевірте дані.');
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

          {/* Ціна та Крок (в один ряд) */}
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

          {/* Фотографії (Множинний вибір) */}
          <div>
            <label style={labelStyle}>Фотографії товару (Макс. 5)</label>
            <div style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '24px', textAlign: 'center', background: '#f9fafb', cursor: 'pointer', transition: 'border 0.2s' }}>
              <input 
                type="file" 
                accept="image/*" 
                multiple 
                onChange={handleFileChange}
                style={{ width: '100%', marginBottom: '10px' }}
              />
              <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                 Оберіть до 5 фотографій
              </span>

              {/* Прев'ю сітка */}
              {previewUrls.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {previewUrls.map((url, idx) => (
                        <img key={idx} src={url} alt={`Preview ${idx}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Кнопки */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <button type="button" onClick={() => navigate('/')} style={{ flex: 1, padding: '0.875rem 1.5rem', background: '#f3f4f6', color: '#374151', fontWeight: '600', fontSize: '1rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
              Скасувати
            </button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: '0.875rem 1.5rem', background: loading ? '#9ca3af' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: 'white', fontWeight: '600', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', borderRadius: '8px', border: 'none' }}>
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