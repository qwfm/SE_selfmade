CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    auth0_sub VARCHAR NOT NULL UNIQUE, -- ID від Google/Auth0
    email VARCHAR NOT NULL,
    username VARCHAR,
    phone_number VARCHAR,
    bio TEXT,
    
    -- Права та Блокування
    is_admin BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    ban_reason VARCHAR,
    ban_until TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Індекс для швидкого пошуку при логіні
CREATE INDEX idx_users_auth0_sub ON users(auth0_sub);


-- 3. Створення таблиці Лотів
CREATE TABLE lots (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    
    -- Ціни
    start_price NUMERIC(10, 2) NOT NULL,
    current_price NUMERIC(10, 2),
    min_step NUMERIC(10, 2) DEFAULT 10.00,
    
    -- Статуси: 'active', 'pending_payment', 'sold', 'closed_unsold'
    status VARCHAR DEFAULT 'active',
    
    -- Головне фото (обкладинка)
    image_url VARCHAR,
    
    -- Налаштування дедлайну оплати (скільки часу дається переможцю)
    payment_deadline_days INTEGER DEFAULT 0 NOT NULL,
    payment_deadline_hours INTEGER DEFAULT 24 NOT NULL,
    payment_deadline_minutes INTEGER DEFAULT 0 NOT NULL,
    
    -- Реальний дедлайн оплати (встановлюється після завершення аукціону)
    payment_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Час закриття без ставок (для відліку 24 годин на відновлення/видалення)
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lots_status ON lots(status);


-- 4. Створення таблиці Картинки Лотів (Галерея)
CREATE TABLE lot_images (
    id SERIAL PRIMARY KEY,
    image_url VARCHAR NOT NULL,
    lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE
);


-- 5. Створення таблиці Ставок
CREATE TABLE bids (
    id SERIAL PRIMARY KEY,
    amount NUMERIC(10, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Якщо користувач не заплатив або забанений -> is_active = FALSE
    is_active BOOLEAN DEFAULT TRUE,
    
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lot_id INTEGER REFERENCES lots(id) ON DELETE CASCADE
);

CREATE INDEX idx_bids_lot_id ON bids(lot_id);


-- 6. Створення таблиці Платежів
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lot_id INTEGER REFERENCES lots(id) ON DELETE CASCADE
);


-- 7. Створення таблиці Сповіщень (Notifications)
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);

CREATE TABLE site_settings (
    key VARCHAR PRIMARY KEY,
    value TEXT NOT NULL
);

-- Вставимо дефолтні правила
INSERT INTO site_settings (key, value) VALUES (
    'rules', 
    '1. Заборонено публікувати нелегальний контент (наркотики, зброя тощо).\n2. Заборонено контент 18+ та насильство.\n3. Поважайте інших учасників аукціону.\n4. Ставки є зобов''язанням купити товар.\n5. Адміністрація має право видалити будь-який лот без попередження.'
);