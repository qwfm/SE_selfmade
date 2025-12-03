// src/pages/CreateLotPage.jsx
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
    image_url: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { 
        ...form, 
        payment_deadline_days: Number(form.payment_deadline_days),
        payment_deadline_hours: Number(form.payment_deadline_hours),
        payment_deadline_minutes: Number(form.payment_deadline_minutes),
        start_price: Number(form.start_price),
        min_step: Number(form.min_step)
      };
      await api.post('/lots/', payload);
      navigate('/');
    } catch (err) {
      alert("Помилка створення: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          margin: '0 0 0.5rem 0',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Створити новий лот
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
          Заповніть форму нижче, щоб створити новий аукціонний лот
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Назва */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#374151',
                fontSize: '0.95rem'
              }}>
                Назва лоту *
              </label>
              <input
                type="text"
                placeholder="Наприклад: Антикварна ваза"
                required
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  fontSize: '1rem'
                }}
              />
            </div>

            {/* Опис */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#374151',
                fontSize: '0.95rem'
              }}>
                Опис *
              </label>
              <textarea
                placeholder="Детальний опис лоту..."
                required
                rows={5}
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Ціни */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: '#374151',
                  fontSize: '0.95rem'
                }}>
                  Стартова ціна ($) *
                </label>
                <input
                  type="number"
                  placeholder="100"
                  required
                  min="0"
                  step="0.01"
                  value={form.start_price}
                  onChange={e => setForm({...form, start_price: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: '#374151',
                  fontSize: '0.95rem'
                }}>
                  Мінімальний крок ($)
                </label>
                <input
                  type="number"
                  placeholder="10"
                  min="0"
                  step="0.01"
                  value={form.min_step}
                  onChange={e => setForm({...form, min_step: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
            </div>

            {/* Термін оплати */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#374151',
                fontSize: '0.95rem'
              }}>
                Термін оплати для переможця
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '0.5rem'
              }}>
                <div>
                  <label style={{
                    fontSize: '0.85rem',
                    color: '#6b7280',
                    display: 'block',
                    marginBottom: '0.5rem'
                  }}>
                    Дні
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.payment_deadline_days}
                    onChange={e => setForm({...form, payment_deadline_days: e.target.value})}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    fontSize: '0.85rem',
                    color: '#6b7280',
                    display: 'block',
                    marginBottom: '0.5rem'
                  }}>
                    Години
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={form.payment_deadline_hours}
                    onChange={e => setForm({...form, payment_deadline_hours: e.target.value})}
                    placeholder="24"
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    fontSize: '0.85rem',
                    color: '#6b7280',
                    display: 'block',
                    marginBottom: '0.5rem'
                  }}>
                    Хвилини
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={form.payment_deadline_minutes}
                    onChange={e => setForm({...form, payment_deadline_minutes: e.target.value})}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>
              <small style={{
                color: '#6b7280',
                fontSize: '0.875rem',
                display: 'block'
              }}>
                ⏱️ Термін, протягом якого переможець має оплатити лот після закриття аукціону
              </small>
            </div>

            {/* URL картинки */}
            <div>
              <label style={{
                display: 'block',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#374151',
                fontSize: '0.95rem'
              }}>
                URL картинки
              </label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={form.image_url}
                onChange={e => setForm({...form, image_url: e.target.value})}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  fontSize: '1rem'
                }}
              />
              {form.image_url && (
                <div style={{ marginTop: '1rem' }}>
                  <img
                    src={form.image_url}
                    alt="Preview"
                    style={{
                      width: '100%',
                      maxHeight: '300px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Кнопки */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginTop: '1rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  flex: 1,
                  padding: '0.875rem 1.5rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '1rem'
                }}
              >
                Скасувати
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2,
                  padding: '0.875rem 1.5rem',
                  background: loading
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Створення...' : 'Створити лот'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}