# 🔧 ChatzOne Quick Fix Guide

## 🚨 Issues to Fix:

1. **Database connection error** - PostgreSQL not configured
2. **Expo CLI not installed** - Missing global package
3. **React version conflicts** - Package dependency issues
4. **Security vulnerabilities** - Outdated packages

## ✅ Complete Fix Solution:

### Step 1: Install PostgreSQL and Redis
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE chatzone_db;
CREATE USER chatzone_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE chatzone_db TO chatzone_user;
\q

# Install Redis
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

### Step 2: Configure Backend Environment
```bash
cd ~/quizz-app1/backend
# Edit the .env file with correct database credentials
nano .env
```

**Update .env file:**
```env
# Database
DATABASE_URL=postgresql://chatzone_user:your_secure_password@localhost:5432/chatzone_db
REDIS_URL=redis://localhost:6379

# JWT (generate secure keys)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_REFRESH_SECRET=your_refresh_secret_change_this_too

# App Settings
CLIENT_URL=http://localhost:19006
NODE_ENV=development
PORT=5000
```

### Step 3: Install Expo CLI and Fix Frontend
```bash
# Install Expo CLI globally
sudo npm install -g @expo/cli@latest

# Go to project root
cd ~/quizz-app1

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Install with legacy peer deps to avoid conflicts
npm install --legacy-peer-deps --force
```

### Step 4: Test the Setup
```bash
# Terminal 1: Start backend
cd ~/quizz-app1/backend
npm run dev

# Terminal 2: Start frontend (in new terminal)
cd ~/quizz-app1
expo start --tunnel
```

## 🚀 Alternative: Docker Setup (Easier)
```bash
cd ~/quizz-app1
docker-compose up -d postgres redis
# Wait for containers to start, then run backend
cd backend && npm run dev
```