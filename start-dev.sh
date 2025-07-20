#!/bin/bash

# Start ChatzOne in development mode with error handling
echo "🚀 Starting ChatzOne Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if node_modules exist
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ]; then
    print_warning "Dependencies not found. Running fix script first..."
    ./fix-and-run.sh
fi

# Check if services are running
if ! pgrep -x "postgres" > /dev/null; then
    print_warning "PostgreSQL not running. Attempting to start..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start postgresql 2>/dev/null || print_warning "Could not start PostgreSQL automatically"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql 2>/dev/null || print_warning "Could not start PostgreSQL automatically"
    fi
fi

if ! pgrep -x "redis-server" > /dev/null; then
    print_warning "Redis not running. Attempting to start..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start redis-server 2>/dev/null || redis-server --daemonize yes 2>/dev/null || print_warning "Could not start Redis automatically"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start redis 2>/dev/null || redis-server --daemonize yes 2>/dev/null || print_warning "Could not start Redis automatically"
    fi
fi

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down ChatzOne..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    # Kill any remaining node processes
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "expo start" 2>/dev/null || true
    echo "✅ Shutdown complete"
    exit 0
}

# Set up cleanup trap
trap cleanup SIGINT SIGTERM

# Check if backend directory exists
if [ ! -d "backend" ]; then
    print_error "Backend directory not found!"
    exit 1
fi

# Start backend in background
echo "📡 Starting backend server..."
cd backend

# Check if .env exists
if [ ! -f ".env" ]; then
    print_warning "Backend .env not found. Creating basic configuration..."
    cat > .env << 'EOF'
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
JWT_SECRET=dev_jwt_secret_change_in_production
DEBUG=chatzone:*
MOCK_PAYMENTS=true
MOCK_NOTIFICATIONS=true
EOF
fi

# Start backend with error handling
if command -v npm &> /dev/null; then
    npm run dev &
    BACKEND_PID=$!
    echo "🔧 Backend started with PID: $BACKEND_PID"
else
    print_error "npm not found!"
    exit 1
fi

# Wait a moment for backend to start
sleep 3

# Check if backend is still running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_error "Backend failed to start. Check the logs above."
    exit 1
fi

print_success "Backend is running on http://localhost:5000"

# Go back to root directory
cd ..

# Check if frontend .env exists
if [ ! -f ".env" ]; then
    print_warning "Frontend .env not found. Creating basic configuration..."
    cat > .env << 'EOF'
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
EXPO_PUBLIC_APP_NAME=ChatzOne
EXPO_PUBLIC_APP_VERSION=1.0.0
EOF
fi

# Start frontend
echo "📱 Starting frontend..."

# Check if expo is available
if ! command -v expo &> /dev/null; then
    if command -v npx &> /dev/null; then
        print_warning "Expo CLI not found globally, using npx..."
        npx expo start --dev-client
    else
        print_error "Neither expo nor npx found!"
        cleanup
        exit 1
    fi
else
    expo start --dev-client
fi

# If we reach here, cleanup
cleanup