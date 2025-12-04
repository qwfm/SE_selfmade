import { useState } from 'react';
import { useApi } from '../useApi';
import { useNavigate } from 'react-router-dom';

export default function CreateLotPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    title: '', description: '', start_price: '', min_step: 10, 
    payment_deadline_days: 0, payment_deadline_hours: 24, payment_deadline_minutes: 0, 
  });
  
  // Окремий стейт для файлу
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file)); // Для попереднього перегляду
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Використовуємо FormData для відправки файлу
      const formData = new FormData();
      
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('start_price', form.start_price);
      formData.append('min_step', form.min_step);
      formData.append('payment_deadline_days', form.payment_deadline_days);
      formData.append('payment_deadline_hours', form.payment_deadline_hours);
      formData.append('payment_deadline_minutes', form.payment_deadline_minutes);
      
      if (selectedFile) {
        formData.append('image', selectedFile);
      }

      await api.post('/lots/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' } // Важливо!
      });
      
      navigate('/');
    } catch (err) {
      alert("Помилка створення: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        border: '1px solid #f3f4f6'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#1f2937' }}>Створити новий лот</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Назва */}
          <div>
            <label style={labelStyle}>Назва лоту</label>
            <input 
              style={inputStyle}
              required 
              value={form.title}
              onChange={e => setForm({...form, title: e.target.value})} 
              placeholder="iPhone 13 Pro..."
            />
          </div>

          {/* Опис */}
          <div>
            <label style={labelStyle}>Опис</label>
            <textarea 
              style={{...inputStyle, height: '100px', resize: 'vertical'}}
              required 
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})} 
              placeholder="Стан, комплектація, дефекти..."
            />
          </div>

          {/* Ціни */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Стартова ціна ($)</label>
              <input 
                type="number" 
                style={inputStyle}
                required 
                value={form.start_price}
                onChange={e => setForm({...form, start_price: e.target.value})} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Мін. крок ставки ($)</label>
              <input 
                type="number" 
                style={inputStyle}
                required 
                value={form.min_step}
                onChange={e => setForm({...form, min_step: e.target.value})} 
              />
            </div>
          </div>

          {/* Час на оплату */}
          <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '12px' }}>
            <label style={{...labelStyle, marginBottom: '15px'}}>Час на оплату для переможця</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div>
                <span style={hintStyle}>Днів</span>
                <input type="number" style={inputStyle} value={form.payment_deadline_days} onChange={e => setForm({...form, payment_deadline_days: e.target.value})} />
              </div>
              <div>
                <span style={hintStyle}>Годин</span>
                <input type="number" style={inputStyle} value={form.payment_deadline_hours} onChange={e => setForm({...form, payment_deadline_hours: e.target.value})} />
              </div>
              <div>
                <span style={hintStyle}>Хвилин</span>
                <input type="number" style={inputStyle} value={form.payment_deadline_minutes} onChange={e => setForm({...form, payment_deadline_minutes: e.target.value})} />
              </div>
            </div>
          </div>

          {/* ЗАВАНТАЖЕННЯ ЗОБРАЖЕННЯ */}
          <div>
            <label style={labelStyle}>Фото лоту</label>
            <div style={{ border: '2px dashed #d1d5db', padding: '20px', borderRadius: '12px', textAlign: 'center', background: '#f9fafb' }}>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload" style={{ cursor: 'pointer', color: '#4f46e5', fontWeight: 'bold' }}>
                Завантажити фото
              </label>
              <p style={{ margin: '5px 0 0', fontSize: '0.9rem', color: '#6b7280' }}>
                {selectedFile ? selectedFile.name : "Натисніть щоб обрати"}
              </p>
              
              {/* Попередній перегляд */}
              {previewUrl && (
                <div style={{ marginTop: '15px' }}>
                  <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} />
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

const labelStyle = { display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.95rem', color: '#374151' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' };
const hintStyle = { display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px' };