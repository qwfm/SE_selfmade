import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../useApi';

export default function PaymentPage() {
  const { lotId } = useParams();
  const api = useApi();
  const navigate = useNavigate();

  const [lot, setLot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Стан форми (фейкові дані)
  const [formData, setFormData] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: ''
  });

  useEffect(() => {
    // Завантажуємо дані про лот, щоб знати суму
    api.get(`/lots/${lotId}`)
      .then(res => setLot(res.data))
      .catch(err => {
        alert("Не вдалося завантажити дані лота");
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [lotId, api, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Проста маска для номера картки (лише цифри)
    if (name === 'cardNumber' && !/^\d*$/.test(value.replace(/\s/g, ''))) return;
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setProcessing(true);

    // 1. Імітація затримки банку (2 секунди)
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // 2. Реальний запит на бекенд
      await api.post('/payments/', { lot_id: Number(lotId) });
      
      // Успіх
      alert("Оплата успішна! Транзакція підтверджена.");
      navigate(`/lot/${lotId}`); // Повертаємось на лот
    } catch (err) {
      alert("Помилка оплати: " + (err.response?.data?.detail || err.message));
      setProcessing(false);
    }
  };

  if (loading) return <div style={styles.centerMsg}>Ініціалізація платежу...</div>;
  if (!lot) return <div style={styles.centerMsg}>Лот не знайдено</div>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        
        {/* Заголовок */}
        <div style={styles.header}>
          <h2 style={{margin: 0, color: '#1f2937'}}>Secure Checkout</h2>
          <div style={{fontSize: '2rem'}}>🔒</div>
        </div>

        {/* Інфо про замовлення */}
        <div style={styles.orderSummary}>
          <div style={styles.summaryRow}>
            <span>Оплата за лот:</span>
            <strong>{lot.title}</strong>
          </div>
          <div style={styles.summaryRow}>
            <span>Сума до сплати:</span>
            <span style={styles.totalPrice}>${lot.current_price}</span>
          </div>
        </div>

        {/* Форма картки */}
        <form onSubmit={handlePay} style={styles.form}>
          <div>
            <label style={styles.label}>Номер картки</label>
            <input 
              name="cardNumber"
              placeholder="0000 0000 0000 0000"
              maxLength="19"
              value={formData.cardNumber}
              onChange={handleInputChange}
              style={styles.input}
              required
            />
          </div>

          <div>
            <label style={styles.label}>Власник картки</label>
            <input 
              name="cardName"
              placeholder="TARAS SHEVCHENKO"
              value={formData.cardName}
              onChange={handleInputChange}
              style={{...styles.input, textTransform: 'uppercase'}}
              required
            />
          </div>

          <div style={styles.row}>
            <div style={{flex: 1}}>
              <label style={styles.label}>Термін дії (MM/YY)</label>
              <input 
                name="expiry"
                placeholder="12/26"
                maxLength="5"
                value={formData.expiry}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
            </div>
            <div style={{flex: 1}}>
              <label style={styles.label}>CVV</label>
              <input 
                name="cvv"
                type="password"
                placeholder="123"
                maxLength="3"
                value={formData.cvv}
                onChange={handleInputChange}
                style={styles.input}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={processing}
            style={{
              ...styles.payButton,
              opacity: processing ? 0.7 : 1,
              cursor: processing ? 'not-allowed' : 'pointer'
            }}
          >
            {processing ? (
              <span>🔄 Обробка транзакції...</span>
            ) : (
              <span>Сплатити ${lot.current_price}</span>
            )}
          </button>
          
          <button 
            type="button" 
            onClick={() => navigate(`/lot/${lotId}`)}
            style={styles.cancelButton}
            disabled={processing}
          >
            Скасувати
          </button>
        </form>

      </div>
    </div>
  );
}

// --- Стилі ---
const styles = {
  container: {
    minHeight: '80vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#f3f4f6',
    padding: '20px'
  },
  centerMsg: {
    textAlign: 'center', 
    padding: '50px', 
    fontSize: '1.2rem', 
    color: '#6b7280'
  },
  card: {
    background: 'white',
    width: '100%',
    maxWidth: '450px',
    borderRadius: '16px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  header: {
    background: '#f9fafb',
    padding: '20px 30px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  orderSummary: {
    padding: '20px 30px',
    background: '#eff6ff',
    borderBottom: '1px solid #e5e7eb'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '10px',
    color: '#374151'
  },
  totalPrice: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#2563eb'
  },
  form: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#4b5563'
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '1rem',
    boxSizing: 'border-box'
  },
  row: {
    display: 'flex',
    gap: '20px'
  },
  payButton: {
    width: '100%',
    padding: '14px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    marginTop: '10px'
  },
  cancelButton: {
    width: '100%',
    padding: '10px',
    background: 'transparent',
    color: '#6b7280',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline'
  }
};