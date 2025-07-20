#!/bin/bash

# ChatzOne Development Fix Script
# This script fixes common issues and ensures the app runs properly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Main function
main() {
    print_header "FIXING CHATZONE DEVELOPMENT SETUP"
    
    # Step 1: Clean install frontend dependencies
    print_status "Cleaning and reinstalling frontend dependencies..."
    rm -rf node_modules package-lock.json
    npm install --legacy-peer-deps
    print_success "Frontend dependencies fixed"
    
    # Step 2: Clean install backend dependencies
    print_status "Cleaning and reinstalling backend dependencies..."
    cd backend
    rm -rf node_modules package-lock.json
    npm install
    cd ..
    print_success "Backend dependencies fixed"
    
    # Step 3: Create missing directories
    print_status "Creating missing directories..."
    mkdir -p assets/images
    mkdir -p assets/sounds
    mkdir -p assets/animations
    mkdir -p backend/uploads/chat
    mkdir -p backend/uploads/avatars
    mkdir -p backend/uploads/temp
    mkdir -p backend/logs
    mkdir -p backend/keys
    print_success "Directories created"
    
    # Step 4: Create placeholder asset files if they don't exist
    print_status "Creating placeholder assets..."
    
    # Create a simple PNG placeholder (1x1 transparent pixel)
    if [ ! -f "assets/icon.png" ]; then
        # Create a minimal PNG file (base64 encoded 1x1 transparent pixel)
        echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77kgAAAABJRU5ErkJggg==" | base64 -d > assets/icon.png
    fi
    
    # Copy icon for other required assets
    cp assets/icon.png assets/splash.png 2>/dev/null || true
    cp assets/icon.png assets/adaptive-icon.png 2>/dev/null || true
    cp assets/icon.png assets/favicon.png 2>/dev/null || true
    cp assets/icon.png assets/notification-icon.png 2>/dev/null || true
    
    # Create empty sound files
    touch assets/sounds/message.wav 2>/dev/null || true
    touch assets/sounds/call.wav 2>/dev/null || true
    
    print_success "Placeholder assets created"
    
    # Step 5: Create environment files if they don't exist
    print_status "Setting up environment files..."
    
    # Frontend environment
    if [ ! -f ".env" ]; then
        cat > .env << 'EOF'
# Frontend Environment Configuration
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
EXPO_PUBLIC_APP_NAME=ChatzOne
EXPO_PUBLIC_APP_VERSION=1.0.0
EOF
        print_success "Frontend .env created"
    else
        print_warning "Frontend .env already exists"
    fi
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cd backend
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Backend .env created from example"
        else
            cat > .env << 'EOF'
# Backend Environment Configuration
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# Database Configuration (update with your credentials)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatzone
DB_USER=postgres
DB_PASSWORD=your_password
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/chatzone

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your_jwt_secret_change_this
JWT_EXPIRES_IN=7d

# Development settings
DEBUG=chatzone:*
MOCK_PAYMENTS=true
MOCK_NOTIFICATIONS=true
EOF
            print_success "Backend .env created with defaults"
        fi
        cd ..
    else
        print_warning "Backend .env already exists"
    fi
    
    # Step 6: Fix Expo configuration
    print_status "Fixing Expo configuration..."
    
    # Create a minimal expo configuration that works
    cat > app.json << 'EOF'
{
  "expo": {
    "name": "ChatzOne",
    "slug": "chatzone",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#6C5CE7"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.chatzone.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#6C5CE7"
      },
      "package": "com.chatzone.app",
      "versionCode": 1
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    }
  }
}
EOF
    print_success "Expo configuration fixed"
    
    # Step 7: Install global dependencies if needed
    print_status "Checking global dependencies..."
    
    if ! command -v expo &> /dev/null; then
        print_warning "Expo CLI not found globally, installing..."
        npm install -g @expo/cli
    fi
    
    print_success "Global dependencies checked"
    
    print_header "SETUP COMPLETE!"
    print_success "ChatzOne development environment is ready!"
    echo ""
    print_status "To start development:"
    echo -e "  ${GREEN}Frontend:${NC} npm run dev (or npm start)"
    echo -e "  ${GREEN}Backend:${NC}  cd backend && npm run dev"
    echo ""
    print_status "To run both simultaneously:"
    echo -e "  ${GREEN}./start-dev.sh${NC} (if available)"
    echo ""
    print_warning "Make sure to:"
    echo "  1. Update backend/.env with your database credentials"
    echo "  2. Start PostgreSQL and Redis services"
    echo "  3. Run database migrations if needed"
    echo ""
    print_success "Happy coding! 🚀"
}

# Run main function
main "$@"