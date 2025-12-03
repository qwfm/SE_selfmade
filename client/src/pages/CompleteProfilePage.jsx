import { useState, useEffect } from 'react';
import { useApi } from '../useApi';
import { useAuth0 } from '@auth0/auth0-react'; 

export default function CompleteProfilePage({ onComplete }) {
  const api = useApi();
  const { logout, user } = useAuth0(); // 2. Дістаємо функцію logout та дані юзера
  const [form, setForm] = useState({ username: '', phone_number: '' });
  const [loading, setLoading] = useState(false);

  // Підтягуємо поточні дані
  useEffect(() => {
    api.get('/users/me').then(res => {
      setForm({
        // Якщо в базі вже є юзернейм - беремо його, якщо ні - пропонуємо нікнейм з Google/Auth0
        username: res.data.username || user?.nickname || '',
        phone_number: res.data.phone_number || '' 
      });
    });
  }, [api, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.phone_number) {
      alert("Будь ласка, заповніть усі поля");
      return;
    }

    setLoading(true);
    try {
      await api.patch('/users/me', form);
      onComplete(); // Сигналізуємо App.jsx, що все готово
    } catch (err) {
      alert("Помилка: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Функція скасування реєстрації
  const handleCancel = () => {
    // Розлогінюємо користувача і повертаємо на головну сторінку сайту
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
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>Ваш нікнейм</label>
            <input 
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              placeholder="CoolUser123"
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>Номер телефону</label>
            <input 
              value={form.phone_number}
              onChange={e => setForm({...form, phone_number: e.target.value})}
              placeholder="+380..."
              style={inputStyle}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '10px'
            }}
          >
            {loading ? 'Збереження...' : 'Продовжити ->'}
          </button>

          {/* Кнопка ВІДМІНИТИ / ВИЙТИ */}
          <button 
            type="button" 
            onClick={handleCancel}
            style={{
              padding: '10px',
              background: 'transparent',
              color: '#ef4444', // Червоний колір для дії виходу
              fontWeight: '600',
              border: '1px solid #fee2e2',
              borderRadius: '8px',
              cursor: 'pointer',
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
  border: '1px solid #d1d5db',
  fontSize: '1rem',
  boxSizing: 'border-box'
};