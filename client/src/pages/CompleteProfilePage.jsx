import { useState, useEffect } from 'react';
import { useApi } from '../useApi';
import { useAuth0 } from '@auth0/auth0-react';

export default function CompleteProfilePage({ onComplete }) {
  const api = useApi();
  const { logout, user } = useAuth0();
  const [form, setForm] = useState({ username: '', phone_number: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({}); // ДОДАНО: стейт помилок

  useEffect(() => {
    api.get('/users/me').then(res => {
      setForm({
        username: res.data.username || user?.nickname || '',
        phone_number: res.data.phone_number || ''
      });
    });
  }, [api, user]);

  // ДОДАНО: Функція валідації телефону
  const validatePhone = (phone) => {
    // Прибираємо всі символи крім цифр та +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Перевірка формату: починається з +, далі 10-15 цифр
    const phoneRegex = /^\+\d{10,15}$/;
    
    if (!phone.trim()) {
      return "Номер телефону обов'язковий";
    }
    
    if (!phone.startsWith('+')) {
      return "Номер має починатись з + (міжнародний формат)";
    }
    
    if (!phoneRegex.test(cleaned)) {
      return "Невірний формат. Приклад: +380501234567";
    }
    
    return null; // Валідація пройшла
  };

  // ОНОВЛЕНО: Обробник зміни з валідацією
  const handlePhoneChange = (value) => {
    // Дозволяємо тільки цифри, + та пробіли
    const formatted = value.replace(/[^\d+\s]/g, '');
    
    setForm({...form, phone_number: formatted});
    
    // Очищаємо помилку при введенні
    if (errors.phone_number) {
      setErrors({...errors, phone_number: null});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    
    // Валідація username
    const trimmedUsername = form.username.trim();
    if (!trimmedUsername) {
      newErrors.username = "Нікнейм не може бути порожнім";
    } else if (trimmedUsername.length < 2) {
      newErrors.username = "Нікнейм має містити мінімум 2 символи";
    } else if (trimmedUsername.length > 50) {
      newErrors.username = "Нікнейм не може перевищувати 50 символів";
    }

    // Валідація телефону
    const phoneError = validatePhone(form.phone_number);
    if (phoneError) {
      newErrors.phone_number = phoneError;
    }

    // Якщо є помилки - показуємо їх і не відправляємо
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await api.patch('/users/me', {
        username: trimmedUsername, // Відправляємо обрізаний username
        phone_number: form.phone_number.trim()
      });
      onComplete();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setErrors({submit: errorMsg});
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: '#f3f4f6',
      padding: '20px'
    }}>
      <div style={{ 
        background: 'white', 
        padding: '40px', 
        borderRadius: '16px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h2 style={{ textAlign: 'center', color: '#1f2937', marginBottom: '10px' }}>👋 Ласкаво просимо!</h2>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '30px' }}>
          Щоб завершити реєстрацію, будь ласка, вкажіть ваш нікнейм та номер телефону.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
              Ваш нікнейм
            </label>
            <input 
              value={form.username}
              onChange={e => {
                setForm({...form, username: e.target.value});
                if (errors.username) setErrors({...errors, username: null});
              }}
              placeholder="CoolUser123"
              style={{
                ...inputStyle,
                borderColor: errors.username ? '#ef4444' : '#d1d5db'
              }}
              required
            />
            {errors.username && (
              <span style={errorStyle}>{errors.username}</span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
              Номер телефону
            </label>
            <input 
              value={form.phone_number}
              onChange={e => handlePhoneChange(e.target.value)}
              placeholder="+380501234567"
              style={{
                ...inputStyle,
                borderColor: errors.phone_number ? '#ef4444' : '#d1d5db'
              }}
              required
            />
            {errors.phone_number && (
              <span style={errorStyle}>{errors.phone_number}</span>
            )}
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '5px' }}>
              Міжнародний формат: +[код країни][номер]
            </p>
          </div>

          {errors.submit && (
            <div style={{
              padding: '10px',
              background: '#fee2e2',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {errors.submit}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: '12px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '10px',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Збереження...' : 'Продовжити →'}
          </button>

          <button 
            type="button" 
            onClick={handleCancel}
            disabled={loading}
            style={{
              padding: '10px',
              background: 'transparent',
              color: '#ef4444',
              fontWeight: '600',
              border: '1px solid #fee2e2',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0px'
            }}
          >
            Відмінити та вийти
          </button>

        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid',
  fontSize: '1rem',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s'
};

const errorStyle = {
  color: '#ef4444',
  fontSize: '0.8rem',
  marginTop: '4px',
  display: 'block'
};