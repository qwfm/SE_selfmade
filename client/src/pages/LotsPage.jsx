import { useEffect, useState, useMemo } from 'react';
import { useApi } from '../useApi';
import { Link } from 'react-router-dom';

export default function LotsPage() {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Стейт для фільтрів
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'price_asc', 'price_desc'
  const [filterStatus, setFilterStatus] = useState('active'); // 'all', 'active', 'sold', etc.

  const api = useApi();

  useEffect(() => {
    setLoading(true);
    api.get('/lots/')
      .then(res => setLots(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [api]);

  // --- ЛОГІКА ФІЛЬТРАЦІЇ ТА СОРТУВАННЯ ---
  const filteredLots = useMemo(() => {
    return lots
      .filter(lot => {
        // Фільтр пошуку
        const matchesSearch = lot.title.toLowerCase().includes(searchTerm.toLowerCase());
        // Фільтр статусу
        const matchesStatus = filterStatus === 'all' 
          ? true 
          : lot.status === filterStatus;
          
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return Number(a.current_price) - Number(b.current_price);
        if (sortBy === 'price_desc') return Number(b.current_price) - Number(a.current_price);
        // default: newest (за ID, бо вищі ID = новіші)
        return b.id - a.id;
      });
  }, [lots, searchTerm, sortBy, filterStatus]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="spinner"></div>
        <p>Завантаження лотів...</p>
        <style>{styles.spinnerKeyframes}</style>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      
      {/* Заголовок сторінки */}
      <div style={styles.header}>
        <h1 style={styles.title}>Усі лоти</h1>
        <p style={styles.subtitle}>
          Переглядайте активні аукціони та історію продажів
        </p>
      </div>

      {/* --- ПАНЕЛЬ ПОШУКУ ТА ФІЛЬТРІВ --- */}
      <div style={styles.filtersContainer}>
        {/* Пошук */}
        <input 
          type="text" 
          placeholder="🔍 Пошук лотів..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{...styles.controlInput, flex: 2}}
        />
        
        {/* Фільтр Статусу */}
        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{...styles.controlInput, flex: 1}}
        >
          <option value="active">🟢 Тільки активні</option>
          <option value="all">🌐 Всі лоти</option>
          <option value="pending_payment">⏳ Очікують оплати</option>
          <option value="sold">🔴 Продані</option>
          <option value="closed_unsold">⚫ Закриті (не продані)</option>
        </select>

        {/* Сортування */}
        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value)}
          style={{...styles.controlInput, flex: 1}}
        >
          <option value="newest">🕒 Спочатку нові</option>
          <option value="price_asc">📉 Від дешевих</option>
          <option value="price_desc">📈 Від дорогих</option>
        </select>
      </div>

      {/* Список лотів */}
      {filteredLots.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <p>
            {searchTerm 
              ? `За запитом "${searchTerm}" нічого не знайдено.` 
              : "Лотів з такими параметрами немає."}
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredLots.map(lot => (
            <Link 
              to={`/lot/${lot.id}`} 
              key={lot.id} 
              style={styles.cardLink}
            >
              <div 
                style={styles.card}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                }}
              >
                {/* Зображення лота */}
                <div style={styles.imageContainer}>
                  <img 
                    src={lot.image_url || 'https://via.placeholder.com/400x300?text=No+Image'} 
                    alt={lot.title} 
                    style={styles.image}
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=No+Image'; }}
                  />
                  <div style={styles.idBadge}>ID: {lot.id}</div>
                  {lot.status === 'sold' && (
                    <div style={styles.soldBadgeOverlay}>ПРОДАНО</div>
                  )}
                </div>
                
                {/* Інформація про лот */}
                <div style={styles.cardContent}>
                  <h3 style={styles.cardTitle}>{lot.title}</h3>
                  
                  <div style={styles.priceContainer}>
                    <span style={styles.priceLabel}>
                      {lot.status === 'sold' ? 'Продано за' : 'Поточна ставка'}
                    </span>
                    <div style={{
                      ...styles.priceValue,
                      color: lot.status === 'sold' ? '#ef4444' : '#4f46e5'
                    }}>${lot.current_price}</div>
                  </div>
                  
                  <div style={styles.cardFooter}>
                    <span style={styles.statusBadge}>
                      <span style={{ 
                        ...styles.statusDot, 
                        background: getStatusColor(lot.status)
                      }}></span>
                      {getStatusLabel(lot.status)}
                    </span>
                    <span style={styles.detailsLink}>Детальніше →</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Стилі для анімації спіннера */}
      <style>{styles.spinnerKeyframes}</style>
      <style>{`
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
      `}</style>
    </div>
  );
}

// Допоміжні функції для кольорів статусів
const getStatusColor = (status) => {
  switch(status) {
    case 'active': return '#10b981'; // Green
    case 'sold': return '#ef4444'; // Red
    case 'pending_payment': return '#f59e0b'; // Amber
    case 'closed_unsold': return '#6b7280'; // Gray
    default: return '#6b7280';
  }
};

const getStatusLabel = (status) => {
  switch(status) {
    case 'active': return 'Активний';
    case 'sold': return 'Продано';
    case 'pending_payment': return 'Очікує оплати';
    case 'closed_unsold': return 'Закрито';
    default: return status;
  }
};

// --- ОБ'ЄКТ ЗІ СТИЛЯМИ ---
const styles = {
  pageContainer: {
    maxWidth: '1200px', 
    margin: '0 auto', 
    padding: '40px 20px',
    minHeight: '80vh'
  },
  loadingContainer: {
    textAlign: 'center', 
    padding: '100px 20px', 
    color: '#6b7280',
    fontSize: '1.2rem'
  },
  header: {
    marginBottom: '30px',
    textAlign: 'center'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 15px 0'
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '1.1rem',
    maxWidth: '600px',
    margin: '0 auto'
  },
  filtersContainer: {
    display: 'flex',
    gap: '15px',
    marginBottom: '40px',
    maxWidth: '900px',
    margin: '0 auto 40px auto',
    flexWrap: 'wrap'
  },
  controlInput: {
    padding: '12px 20px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    fontSize: '1rem',
    background: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    outline: 'none',
    minWidth: '200px',
    cursor: 'pointer'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px',
    background: '#f9fafb',
    borderRadius: '16px',
    color: '#6b7280',
    fontSize: '1.2rem'
  },
  grid: {
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
    gap: '30px'
  },
  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block'
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    border: '1px solid #f3f4f6',
    transition: 'all 0.3s ease',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  },
  imageContainer: {
    height: '220px',
    overflow: 'hidden',
    position: 'relative',
    background: '#f3f4f6'
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.5s ease'
  },
  idBadge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(255,255,255,0.95)',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: '#4f46e5',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  soldBadgeOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-15deg)',
    background: 'rgba(239, 68, 68, 0.9)',
    color: 'white',
    padding: '10px 20px',
    fontSize: '1.5rem',
    fontWeight: '800',
    border: '3px solid white',
    borderRadius: '8px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
  },
  cardContent: {
    padding: '24px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  cardTitle: {
    margin: '0 0 15px 0',
    fontSize: '1.25rem',
    color: '#1f2937',
    lineHeight: '1.4',
    fontWeight: '700'
  },
  priceContainer: {
    marginBottom: '20px'
  },
  priceLabel: {
    fontSize: '0.85rem',
    color: '#6b7280',
    display: 'block',
    marginBottom: '4px'
  },
  priceValue: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#4f46e5'
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb'
  },
  statusBadge: {
    fontSize: '0.85rem',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: '500',
    background: '#f3f4f6',
    padding: '4px 10px',
    borderRadius: '20px'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block'
  },
  detailsLink: {
    color: '#6366f1',
    fontWeight: '600',
    fontSize: '0.9rem'
  },
  spinnerKeyframes: `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
};