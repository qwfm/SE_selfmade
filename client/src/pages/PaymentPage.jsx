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

  // Стан форми
  const [formData, setFormData] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: ''
  });

  // Стан помилок
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get(`/lots/${lotId}`)
      .then(res => setLot(res.data))
      .catch(err => {
        alert("Не вдалося завантажити дані лота");
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [lotId, api, navigate]);

  // --- ВАЛІДАТОРИ ---

  // 1. Алгоритм Луна (Перевірка справжності номера картки)
  const luhnCheck = (val) => {
    let checksum = 0;
    let j = 1;
    for (let i = val.length - 1; i >= 0; i--) {
      let calc = 0;
      calc = Number(val.charAt(i)) * j;
      if (calc > 9) {
        checksum = checksum + 1;
        calc = calc - 10;
      }
      checksum = checksum + calc;
      j = (j === 1) ? 2 : 1;
    }
    return (checksum % 10) === 0;
  };

  const validateForm = () => {
    const newErrors = {};
    const cleanNumber = formData.cardNumber.replace(/\s/g, '');

    // Валідація номеру картки
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      newErrors.cardNumber = "Невірна довжина номера картки";
    } else if (!luhnCheck(cleanNumber)) {
      newErrors.cardNumber = "Недійсний номер картки (помилка алгоритму Луна)";
    }

    // Валідація власника
    if (!formData.cardName.trim().includes(' ')) {
        newErrors.cardName = "Введіть Ім'я та Прізвище (латиницею)";
    }

    // Валідація дати (MM/YY)
    if (!/^\d{2}\/\d{2}$/.test(formData.expiry)) {
        newErrors.expiry = "Формат: MM/YY";
    } else {
        const [month, year] = formData.expiry.split('/').map(Number);
        const now = new Date();
        const currentYear = Number(String(now.getFullYear()).slice(-2));
        const currentMonth = now.getMonth() + 1;

        if (month < 1 || month > 12) {
            newErrors.expiry = "Невірний місяць";
        } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
            newErrors.expiry = "Картка прострочена";
        }
    }

    // Валідація CVV
    if (!/^\d{3}$/.test(formData.cvv)) {
        newErrors.cvv = "3 цифри";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- ОБРОБКА ВВОДУ (МАСКИ) ---

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cardNumber') {
        // Залишаємо тільки цифри
        const digits = value.replace(/\D/g, '');
        // Групуємо по 4 цифри
        formattedValue = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
        if (formattedValue.length > 19) return; // Обмеження довжини (16 цифр + 3 пробіли)
    } 
    else if (name === 'expiry') {
        // Формат MM/YY
        const digits = value.replace(/\D/g, '');
        if (digits.length >= 3) {
            formattedValue = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
        } else {
            formattedValue = digits;
        }
        if (formattedValue.length > 5) return;
    }
    else if (name === 'cvv') {
        // Тільки 3 цифри
        formattedValue = value.replace(/\D/g, '').slice(0, 3);
    }
    else if (name === 'cardName') {
        // Тільки літери
        formattedValue = value.replace(/[^a-zA-Z\s]/g, '').toUpperCase();
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    // Очищаємо помилку при вводі
    if (errors[name]) {
        setErrors(prev => ({...prev, [name]: null}));
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return; // Якщо є помилки, не відправляємо
    }

    setProcessing(true);

    // Імітація запиту до банку
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      await api.post('/payments/', { lot_id: Number(lotId) });
      
      alert("✅ Оплата успішна! Кошти зараховано.");
      navigate(`/lot/${lotId}`);
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
          <div style={{fontSize: '1.5rem'}}>🔒</div>
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
          
          {/* Номер картки */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Номер картки</label>
            <input 
              name="cardNumber"
              placeholder="0000 0000 0000 0000"
              value={formData.cardNumber}
              onChange={handleInputChange}
              style={{
                  ...styles.input, 
                  borderColor: errors.cardNumber ? '#ef4444' : '#d1d5db'
              }}
              required
            />
            {errors.cardNumber && <span style={styles.errorText}>{errors.cardNumber}</span>}
          </div>

          {/* Власник */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Власник картки</label>
            <input 
              name="cardName"
              placeholder="TARAS SHEVCHENKO"
              value={formData.cardName}
              onChange={handleInputChange}
              style={{
                  ...styles.input, 
                  borderColor: errors.cardName ? '#ef4444' : '#d1d5db'
              }}
              required
            />
            {errors.cardName && <span style={styles.errorText}>{errors.cardName}</span>}
          </div>

          <div style={styles.row}>
            {/* Дата */}
            <div style={{flex: 1}}>
              <label style={styles.label}>Термін дії</label>
              <input 
                name="expiry"
                placeholder="MM/YY"
                value={formData.expiry}
                onChange={handleInputChange}
                style={{
                    ...styles.input, 
                    borderColor: errors.expiry ? '#ef4444' : '#d1d5db'
                }}
                required
              />
              {errors.expiry && <span style={styles.errorText}>{errors.expiry}</span>}
            </div>

            {/* CVV */}
            <div style={{flex: 1}}>
              <label style={styles.label}>CVV</label>
              <input 
                name="cvv"
                type="password"
                placeholder="123"
                value={formData.cvv}
                onChange={handleInputChange}
                style={{
                    ...styles.input, 
                    borderColor: errors.cvv ? '#ef4444' : '#d1d5db'
                }}
                required
              />
              {errors.cvv && <span style={styles.errorText}>{errors.cvv}</span>}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={processing}
            style={{
              ...styles.payButton,
              opacity: processing ? 0.7 : 1,
              cursor: processing ? 'not-allowed' : 'pointer',
              background: processing ? '#6b7280' : '#10b981'
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
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column'
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
    borderWidth: '1px',
    borderStyle: 'solid',
    fontSize: '1rem',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  errorText: {
    color: '#ef4444',
    fontSize: '0.8rem',
    marginTop: '4px'
  },
  row: {
    display: 'flex',
    gap: '20px'
  },
  payButton: {
    width: '100%',
    padding: '14px',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    marginTop: '10px',
    transition: 'background 0.3s'
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