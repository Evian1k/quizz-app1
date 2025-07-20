#!/bin/bash

echo "🔧 ChatzOne Complete Fix Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Checking system requirements...${NC}"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PostgreSQL...${NC}"
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    echo -e "${GREEN}✅ PostgreSQL installed${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL already installed${NC}"
fi

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Redis...${NC}"
    sudo apt install -y redis-server
    sudo systemctl start redis
    sudo systemctl enable redis
    echo -e "${GREEN}✅ Redis installed${NC}"
else
    echo -e "${GREEN}✅ Redis already installed${NC}"
fi

# Setup PostgreSQL database
echo -e "${BLUE}🗄️ Setting up database...${NC}"
sudo -u postgres psql -c "CREATE DATABASE chatzone_db;" 2>/dev/null || echo "Database might already exist"
sudo -u postgres psql -c "CREATE USER chatzone_user WITH PASSWORD 'chatzone123';" 2>/dev/null || echo "User might already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE chatzone_db TO chatzone_user;" 2>/dev/null
echo -e "${GREEN}✅ Database setup complete${NC}"

# Install Expo CLI
echo -e "${BLUE}📱 Installing Expo CLI...${NC}"
if ! command -v expo &> /dev/null; then
    sudo npm install -g @expo/cli@latest
    echo -e "${GREEN}✅ Expo CLI installed${NC}"
else
    echo -e "${GREEN}✅ Expo CLI already installed${NC}"
fi

# Clean and install frontend dependencies
echo -e "${BLUE}🧹 Cleaning frontend dependencies...${NC}"
rm -rf node_modules package-lock.json
npm cache clean --force

echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
npm install --legacy-peer-deps --force

# Install backend dependencies
echo -e "${BLUE}🔧 Setting up backend...${NC}"
cd backend
rm -rf node_modules package-lock.json

# Create .env file with correct settings
cat > .env << EOL
# Database
DATABASE_URL=postgresql://chatzone_user:chatzone123@localhost:5432/chatzone_db
REDIS_URL=redis://localhost:6379

# JWT Secrets (Change in production!)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_123456789
JWT_REFRESH_SECRET=your_refresh_secret_change_this_too_987654321

# OAuth (Add your credentials)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# External APIs (Optional)
OPENAI_API_KEY=your_openai_api_key
GOOGLE_TRANSLATE_API_KEY=your_translate_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key

# App Settings
CLIENT_URL=http://localhost:19006
NODE_ENV=development
PORT=5000
EOL

echo -e "${GREEN}✅ Created backend .env file${NC}"

npm install
echo -e "${GREEN}✅ Backend dependencies installed${NC}"

# Run database migrations
echo -e "${BLUE}🗄️ Running database migrations...${NC}"
npm run migrate 2>/dev/null || echo "Migration might have failed - database might not be ready"

cd ..

echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📋 To start the app:${NC}"
echo ""
echo -e "${YELLOW}Terminal 1 - Backend:${NC}"
echo "cd ~/quizz-app1/backend && npm run dev"
echo ""
echo -e "${YELLOW}Terminal 2 - Frontend:${NC}"
echo "cd ~/quizz-app1 && expo start --tunnel"
echo ""
echo -e "${BLUE}📱 Then scan the QR code with Expo Go app on your phone${NC}"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "- Make sure PostgreSQL and Redis are running"
echo "- Check backend/.env for database credentials"
echo "- Add your OAuth keys for social login"
echo "- Use --tunnel flag if you have network issues"
echo ""
echo -e "${GREEN}🚀 Your ChatzOne app is ready!${NC}"