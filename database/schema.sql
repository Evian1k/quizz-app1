-- ChatzOne Database Schema
-- PostgreSQL Database Schema for Real-time Social Chat App

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For location-based features

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE,
    avatar TEXT,
    bio TEXT,
    date_of_birth DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    interested_in VARCHAR(50), -- JSON array of interests
    location_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_updated_at TIMESTAMP,
    max_distance INTEGER DEFAULT 50, -- km
    age_range_min INTEGER DEFAULT 18,
    age_range_max INTEGER DEFAULT 99,
    preferred_language VARCHAR(10) DEFAULT 'en',
    coins INTEGER DEFAULT 100, -- Starting coins
    is_verified BOOLEAN DEFAULT false,
    is_online BOOLEAN DEFAULT false,
    presence_status VARCHAR(20) DEFAULT 'online' CHECK (presence_status IN ('online', 'away', 'busy', 'invisible')),
    last_seen TIMESTAMP DEFAULT NOW(),
    is_premium BOOLEAN DEFAULT false,
    premium_expires_at TIMESTAMP,
    push_token TEXT,
    notification_settings JSONB DEFAULT '{"messages": true, "matches": true, "calls": true, "marketing": false}',
    privacy_settings JSONB DEFAULT '{"show_distance": true, "show_last_seen": true, "show_online_status": true}',
    verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_location ON users USING GIST (ST_MakePoint(longitude, latitude));
CREATE INDEX idx_users_is_verified ON users(is_verified);
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_users_gender ON users(gender);
CREATE INDEX idx_users_age ON users(date_of_birth);

-- User interests table
CREATE TABLE user_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    interest VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX idx_user_interests_interest ON user_interests(interest);

-- User photos table
CREATE TABLE user_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_photos_user_id ON user_photos(user_id);
CREATE INDEX idx_user_photos_primary ON user_photos(user_id, is_primary);

-- Matches table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user1_liked BOOLEAN DEFAULT false,
    user2_liked BOOLEAN DEFAULT false,
    is_mutual BOOLEAN DEFAULT false,
    user1_super_liked BOOLEAN DEFAULT false,
    user2_super_liked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

CREATE INDEX idx_matches_user1 ON matches(user1_id);
CREATE INDEX idx_matches_user2 ON matches(user2_id);
CREATE INDEX idx_matches_mutual ON matches(is_mutual);
CREATE INDEX idx_matches_created_at ON matches(created_at);

-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participants UUID[] NOT NULL,
    is_blocked BOOLEAN DEFAULT false,
    blocked_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_participants ON conversations USING GIN(participants);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'audio', 'file', 'location')),
    media_url TEXT,
    media_type VARCHAR(50),
    media_metadata JSONB,
    translation JSONB, -- Store translations in different languages
    reply_to_message_id UUID REFERENCES messages(id),
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_type ON messages(type);

-- Message reads table
CREATE TABLE message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX idx_message_reads_user_id ON message_reads(user_id);

-- Message reactions table
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(50) NOT NULL, -- emoji or reaction type
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id, reaction)
);

CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);

-- Calls table
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    call_type VARCHAR(20) NOT NULL CHECK (call_type IN ('voice', 'video')),
    status VARCHAR(20) DEFAULT 'ringing' CHECK (status IN ('ringing', 'connected', 'ended', 'declined', 'missed', 'failed')),
    created_at TIMESTAMP DEFAULT NOW(),
    answered_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration INTEGER, -- in seconds
    end_reason VARCHAR(50), -- 'normal', 'timeout', 'error', etc.
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5)
);

CREATE INDEX idx_calls_caller_id ON calls(caller_id);
CREATE INDEX idx_calls_recipient_id ON calls(recipient_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_created_at ON calls(created_at);

-- Coin transactions table
CREATE TABLE coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('purchase', 'daily_reward', 'referral', 'message', 'call', 'boost', 'premium_match', 'refund')),
    amount INTEGER NOT NULL, -- positive for earning, negative for spending
    description TEXT,
    reference_id UUID, -- Reference to related entity (call_id, message_id, etc.)
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_type ON coin_transactions(type);
CREATE INDEX idx_coin_transactions_created_at ON coin_transactions(created_at);

-- Referrals table
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reward_amount INTEGER DEFAULT 50,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE(referrer_id, referred_id)
);

CREATE INDEX idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX idx_referrals_status ON referrals(status);

-- Blocked users table
CREATE TABLE blocked_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX idx_blocked_users_blocker_id ON blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked_id ON blocked_users(blocked_id);

-- Reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reported_content_type VARCHAR(50) NOT NULL CHECK (reported_content_type IN ('user', 'message', 'photo')),
    reported_content_id UUID NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'fake', 'violence', 'other')),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_content_type ON reports(reported_content_type);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at);

-- User sessions table (for tracking active sessions)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_id VARCHAR(255),
    device_type VARCHAR(50), -- 'ios', 'android', 'web'
    device_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Push notifications table
CREATE TABLE push_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_push_notifications_user_id ON push_notifications(user_id);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);
CREATE INDEX idx_push_notifications_created_at ON push_notifications(created_at);

-- User activity log
CREATE TABLE user_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    activity_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX idx_user_activity_log_type ON user_activity_log(activity_type);
CREATE INDEX idx_user_activity_log_created_at ON user_activity_log(created_at);

-- Admin users table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'moderator' CHECK (role IN ('super_admin', 'admin', 'moderator')),
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_active ON admin_users(is_active);

-- App settings table
CREATE TABLE app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_app_settings_key ON app_settings(setting_key);

-- Functions and Triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check if match is mutual
CREATE OR REPLACE FUNCTION check_mutual_match()
RETURNS TRIGGER AS $$
BEGIN
    -- Update is_mutual when both users have liked each other
    UPDATE matches 
    SET is_mutual = true 
    WHERE id = NEW.id 
    AND user1_liked = true 
    AND user2_liked = true;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to check mutual matches
CREATE TRIGGER check_mutual_match_trigger 
    AFTER INSERT OR UPDATE ON matches 
    FOR EACH ROW EXECUTE FUNCTION check_mutual_match();

-- Function to calculate user age
CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM AGE(birth_date));
END;
$$ language 'plpgsql';

-- Function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance(lat1 DECIMAL, lon1 DECIMAL, lat2 DECIMAL, lon2 DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ST_DistanceSphere(
        ST_MakePoint(lon1, lat1),
        ST_MakePoint(lon2, lat2)
    ) / 1000; -- Convert to kilometers
END;
$$ language 'plpgsql';

-- Insert default app settings
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
('coin_prices', '{"small": {"coins": 100, "price": 0.99}, "medium": {"coins": 500, "price": 4.99}, "large": {"coins": 1200, "price": 9.99}, "mega": {"coins": 2500, "price": 19.99}}', 'Coin package pricing'),
('daily_reward', '{"base_amount": 10, "streak_bonuses": {"7": 5, "30": 10}}', 'Daily login reward settings'),
('message_costs', '{"text": 1, "media": 2}', 'Cost in coins for different message types'),
('call_costs', '{"voice": 3, "video": 5}', 'Cost in coins for different call types'),
('max_matches_per_day', '50', 'Maximum number of matches a user can make per day'),
('verification_required', 'true', 'Whether users need to be verified to use the app'),
('maintenance_mode', 'false', 'Whether the app is in maintenance mode');

-- Create initial admin user (password: admin123 - CHANGE THIS!)
INSERT INTO admin_users (email, password_hash, name, role) VALUES
('admin@chatzone.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Admin', 'super_admin');

-- Create views for common queries

-- View for user profiles with calculated age
CREATE VIEW user_profiles AS
SELECT 
    u.*,
    calculate_age(u.date_of_birth) as age,
    COALESCE(
        (SELECT photo_url FROM user_photos WHERE user_id = u.id AND is_primary = true LIMIT 1),
        u.avatar
    ) as profile_photo,
    (SELECT COUNT(*) FROM user_photos WHERE user_id = u.id) as photo_count,
    (SELECT array_agg(interest) FROM user_interests WHERE user_id = u.id) as interests
FROM users u;

-- View for mutual matches with user details
CREATE VIEW mutual_matches AS
SELECT 
    m.id,
    m.user1_id,
    m.user2_id,
    m.created_at,
    u1.name as user1_name,
    u1.avatar as user1_avatar,
    u2.name as user2_name,
    u2.avatar as user2_avatar
FROM matches m
JOIN users u1 ON m.user1_id = u1.id
JOIN users u2 ON m.user2_id = u2.id
WHERE m.is_mutual = true;

-- View for conversation summaries
CREATE VIEW conversation_summaries AS
SELECT 
    c.id,
    c.participants,
    c.created_at,
    c.updated_at,
    (
        SELECT json_build_object(
            'id', m.id,
            'content', m.content,
            'type', m.type,
            'sender_id', m.sender_id,
            'created_at', m.created_at
        )
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
    ) as last_message,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
FROM conversations c;

COMMENT ON DATABASE chatzone IS 'ChatzOne - Real-time Social Chat Application Database';
COMMENT ON TABLE users IS 'User accounts and profiles';
COMMENT ON TABLE matches IS 'User likes and matches';
COMMENT ON TABLE conversations IS 'Chat conversations between users';
COMMENT ON TABLE messages IS 'Individual messages in conversations';
COMMENT ON TABLE calls IS 'Voice and video call records';
COMMENT ON TABLE coin_transactions IS 'User coin balance transactions';
COMMENT ON TABLE blocked_users IS 'Users blocked by other users';
COMMENT ON TABLE reports IS 'User reports for inappropriate content';

-- Grant permissions (adjust as needed for your deployment)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chatzone_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chatzone_app;