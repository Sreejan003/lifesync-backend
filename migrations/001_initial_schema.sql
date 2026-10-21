-- LifeSync Database Migration 001: Initial Core Schema
-- Target: PostgreSQL / Supabase
-- Description: Core relational schema for users, tasks, events, budget, wellness, and soothing games

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar_letter VARCHAR(5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'Study',
    deadline DATE,
    priority VARCHAR(20) DEFAULT 'Medium',
    status VARCHAR(20) DEFAULT 'Pending',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Calendar Events Table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time VARCHAR(10) DEFAULT '09:00',
    event_type VARCHAR(50) DEFAULT 'Study',
    reminder BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Budget Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Budget Settings Table
CREATE TABLE IF NOT EXISTS budget_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    monthly_budget NUMERIC(10, 2) DEFAULT 0,
    runway_sum NUMERIC(10, 2) DEFAULT 0,
    runway_buffer_pct INTEGER DEFAULT 15,
    night_safe_limit NUMERIC(10, 2) DEFAULT 0,
    night_safe_spent NUMERIC(10, 2) DEFAULT 0,
    night_safe_locked BOOLEAN DEFAULT FALSE
);

-- 6. Mental Wellness Records Table
CREATE TABLE IF NOT EXISTS wellness_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mood VARCHAR(30) NOT NULL,
    note TEXT,
    stress INTEGER DEFAULT 2,
    energy INTEGER DEFAULT 3,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Student Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100),
    email VARCHAR(255),
    university VARCHAR(255) DEFAULT NULL,
    major VARCHAR(255) DEFAULT NULL,
    year_semester VARCHAR(100) DEFAULT NULL,
    student_id VARCHAR(100) DEFAULT NULL,
    currency VARCHAR(10) DEFAULT '₹',
    xp INTEGER DEFAULT 0,
    notifications_enabled BOOLEAN DEFAULT TRUE
);

-- 8. Wellness Sudoku Games Table
CREATE TABLE IF NOT EXISTS wellness_sudoku_games (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    puzzle_id VARCHAR(100),
    difficulty VARCHAR(20) DEFAULT 'medium',
    is_completed BOOLEAN DEFAULT FALSE,
    time_seconds INTEGER DEFAULT 0,
    mistakes_count INTEGER DEFAULT 0,
    hints_used INTEGER DEFAULT 0,
    checks_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Wellness Game Progress Table
CREATE TABLE IF NOT EXISTS wellness_game_progress (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    scramble_xp INTEGER DEFAULT 0,
    scramble_streak INTEGER DEFAULT 0,
    scramble_best_streak INTEGER DEFAULT 0,
    scramble_words_completed INTEGER DEFAULT 0,
    scramble_hints_used INTEGER DEFAULT 0,
    scramble_last_played TIMESTAMP WITH TIME ZONE,
    riddles_attempted INTEGER DEFAULT 0,
    riddles_solved INTEGER DEFAULT 0,
    riddles_xp INTEGER DEFAULT 0,
    riddles_last_played TIMESTAMP WITH TIME ZONE,
    breathing_cycles INTEGER DEFAULT 0,
    breathing_sessions INTEGER DEFAULT 0,
    breathing_last_session TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_wellness_records_user_id ON wellness_records(user_id);
CREATE INDEX IF NOT EXISTS idx_wellness_records_date ON wellness_records(date);
CREATE INDEX IF NOT EXISTS idx_sudoku_user_id ON wellness_sudoku_games(user_id);
