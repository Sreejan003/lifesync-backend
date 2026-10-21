-- LifeSync Database Migration 003: Supabase Row Level Security (RLS) Policies
-- Target: PostgreSQL / Supabase
-- Description: Enables RLS on all user data tables and establishes strict multi-tenant isolation policies.

-- Helper: Function to check if running in Supabase environment with auth schema
DO $$
BEGIN
    -- Enable Row Level Security on all application tables
    ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS budget_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS wellness_records ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS wellness_sudoku_games ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS wellness_game_progress ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS notification_preferences ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS pomodoro_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS pomodoro_settings ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if re-running migration
    DROP POLICY IF EXISTS "Users can view and update own user profile" ON users;
    DROP POLICY IF EXISTS "Users can only access own tasks" ON tasks;
    DROP POLICY IF EXISTS "Users can only access own events" ON events;
    DROP POLICY IF EXISTS "Users can only access own transactions" ON transactions;
    DROP POLICY IF EXISTS "Users can only access own budget settings" ON budget_settings;
    DROP POLICY IF EXISTS "Users can only access own wellness records" ON wellness_records;
    DROP POLICY IF EXISTS "Users can only access own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can only access own sudoku games" ON wellness_sudoku_games;
    DROP POLICY IF EXISTS "Users can only access own game progress" ON wellness_game_progress;
    DROP POLICY IF EXISTS "Users can only access own notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can only access own notification preferences" ON notification_preferences;
    DROP POLICY IF EXISTS "Users can only access own pomodoro sessions" ON pomodoro_sessions;
    DROP POLICY IF EXISTS "Users can only access own pomodoro settings" ON pomodoro_settings;

    -- Create RLS Policies linking user_id to auth.uid() or matching tenant identity
    -- Note: When called via backend Express connection pool using DATABASE_URL (postgres/service_role),
    -- postgres bypasses RLS or operates with full privilege. These policies protect direct Supabase client access.
    
    CREATE POLICY "Users can view and update own user profile" ON users
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = id::text);

    CREATE POLICY "Users can only access own tasks" ON tasks
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own events" ON events
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own transactions" ON transactions
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own budget settings" ON budget_settings
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own wellness records" ON wellness_records
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own profile" ON profiles
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own sudoku games" ON wellness_sudoku_games
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own game progress" ON wellness_game_progress
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own notifications" ON notifications
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own notification preferences" ON notification_preferences
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own pomodoro sessions" ON pomodoro_sessions
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

    CREATE POLICY "Users can only access own pomodoro settings" ON pomodoro_settings
        FOR ALL USING (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text)
        WITH CHECK (COALESCE(current_setting('request.jwt.claim.sub', true), '')::text = user_id::text);

END $$;
