#!/bin/bash

# ChatzOne Complete Setup Script
# This script sets up the entire ChatzOne application with all dependencies and configurations

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print colored output
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
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root for security reasons."
        exit 1
    fi
}

# Check system requirements
check_system() {
    print_header "CHECKING SYSTEM REQUIREMENTS"
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_success "Linux detected"
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_success "macOS detected"
        OS="macos"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        REQUIRED_NODE="18.0.0"
        if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE" ]; then
            print_success "Node.js $NODE_VERSION found (>= $REQUIRED_NODE required)"
        else
            print_error "Node.js $NODE_VERSION found, but >= $REQUIRED_NODE required"
            print_status "Please install Node.js >= $REQUIRED_NODE from https://nodejs.org/"
            exit 1
        fi
    else
        print_error "Node.js not found"
        print_status "Installing Node.js..."
        install_nodejs
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm $NPM_VERSION found"
    else
        print_error "npm not found"
        exit 1
    fi
    
    # Check PostgreSQL
    if command -v psql &> /dev/null; then
        PG_VERSION=$(psql --version | awk '{print $3}' | cut -d'.' -f1)
        if [ "$PG_VERSION" -ge 12 ]; then
            print_success "PostgreSQL $PG_VERSION found"
        else
            print_warning "PostgreSQL $PG_VERSION found, but version 12+ recommended"
        fi
    else
        print_warning "PostgreSQL not found"
        print_status "Installing PostgreSQL..."
        install_postgresql
    fi
    
    # Check Redis
    if command -v redis-server &> /dev/null; then
        REDIS_VERSION=$(redis-server --version | awk '{print $3}' | cut -d'=' -f2)
        print_success "Redis $REDIS_VERSION found"
    else
        print_warning "Redis not found"
        print_status "Installing Redis..."
        install_redis
    fi
}

# Install Node.js
install_nodejs() {
    if [[ "$OS" == "linux" ]]; then
        # Install Node.js via NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == "macos" ]]; then
        # Install Node.js via Homebrew
        if command -v brew &> /dev/null; then
            brew install node@18
        else
            print_error "Homebrew not found. Please install Node.js manually from https://nodejs.org/"
            exit 1
        fi
    fi
}

# Install PostgreSQL
install_postgresql() {
    if [[ "$OS" == "linux" ]]; then
        sudo apt-get update
        sudo apt-get install -y postgresql postgresql-contrib postgis
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    elif [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install postgresql postgis
            brew services start postgresql
        else
            print_error "Homebrew not found. Please install PostgreSQL manually"
            exit 1
        fi
    fi
}

# Install Redis
install_redis() {
    if [[ "$OS" == "linux" ]]; then
        sudo apt-get update
        sudo apt-get install -y redis-server
        sudo systemctl start redis-server
        sudo systemctl enable redis-server
    elif [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install redis
            brew services start redis
        else
            print_error "Homebrew not found. Please install Redis manually"
            exit 1
        fi
    fi
}

# Setup database
setup_database() {
    print_header "SETTING UP DATABASE"
    
    # Check if PostgreSQL is running
    if ! pgrep -x "postgres" > /dev/null; then
        print_status "Starting PostgreSQL..."
        if [[ "$OS" == "linux" ]]; then
            sudo systemctl start postgresql
        elif [[ "$OS" == "macos" ]]; then
            brew services start postgresql
        fi
    fi
    
    # Create database and user
    print_status "Creating database and user..."
    
    DB_NAME="chatzone"
    DB_USER="chatzone_user"
    DB_PASSWORD=$(openssl rand -base64 32)
    
    # Create user and database
    sudo -u postgres psql << EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF
    
    # Enable PostGIS extension
    sudo -u postgres psql -d $DB_NAME << EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
\q
EOF
    
    print_success "Database created successfully"
    print_status "Database: $DB_NAME"
    print_status "User: $DB_USER"
    print_status "Password: $DB_PASSWORD"
    
    # Store database credentials
    echo "DB_NAME=$DB_NAME" > .db_credentials
    echo "DB_USER=$DB_USER" >> .db_credentials
    echo "DB_PASSWORD=$DB_PASSWORD" >> .db_credentials
}

# Install dependencies
install_dependencies() {
    print_header "INSTALLING DEPENDENCIES"
    
    # Frontend dependencies
    print_status "Installing frontend dependencies..."
    npm install
    
    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    print_success "Dependencies installed successfully"
}

# Setup environment files
setup_environment() {
    print_header "SETTING UP ENVIRONMENT"
    
    # Load database credentials
    if [ -f .db_credentials ]; then
        source .db_credentials
    else
        print_error "Database credentials not found. Please run database setup first."
        exit 1
    fi
    
    # Backend environment
    print_status "Creating backend environment file..."
    cd backend
    
    if [ ! -f .env ]; then
        cp .env.example .env
        
        # Generate JWT secrets
        JWT_SECRET=$(openssl rand -base64 64)
        REFRESH_TOKEN_SECRET=$(openssl rand -base64 64)
        SESSION_SECRET=$(openssl rand -base64 32)
        
        # Update environment file with generated values
        sed -i.bak "s/your_db_password/$DB_PASSWORD/g" .env
        sed -i.bak "s/your_super_secret_jwt_key_change_this_in_production/$JWT_SECRET/g" .env
        sed -i.bak "s/your_super_secret_refresh_token_key/$REFRESH_TOKEN_SECRET/g" .env
        sed -i.bak "s/your_session_secret_key/$SESSION_SECRET/g" .env
        sed -i.bak "s/chatzone/$DB_NAME/g" .env
        sed -i.bak "s/postgres/$DB_USER/g" .env
        
        rm .env.bak
        
        print_success "Backend environment file created"
    else
        print_warning "Backend .env file already exists, skipping..."
    fi
    
    cd ..
    
    # Frontend environment
    print_status "Creating frontend environment file..."
    
    if [ ! -f .env ]; then
        cat > .env << EOF
# Frontend Environment Configuration
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
EXPO_PUBLIC_APP_NAME=ChatzOne
EXPO_PUBLIC_APP_VERSION=1.0.0
EOF
        print_success "Frontend environment file created"
    else
        print_warning "Frontend .env file already exists, skipping..."
    fi
}

# Initialize database schema
init_database() {
    print_header "INITIALIZING DATABASE SCHEMA"
    
    # Load database credentials
    source .db_credentials
    
    print_status "Running database migrations..."
    
    # Run schema creation
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f database/schema.sql
    
    print_success "Database schema initialized successfully"
}

# Create necessary directories
create_directories() {
    print_header "CREATING DIRECTORIES"
    
    # Backend directories
    mkdir -p backend/uploads/chat
    mkdir -p backend/uploads/avatars
    mkdir -p backend/uploads/temp
    mkdir -p backend/logs
    mkdir -p backend/keys
    
    # Frontend directories
    mkdir -p assets/images
    mkdir -p assets/sounds
    mkdir -p assets/animations
    
    print_success "Directories created successfully"
}

# Setup development tools
setup_dev_tools() {
    print_header "SETTING UP DEVELOPMENT TOOLS"
    
    # Install global tools
    print_status "Installing global development tools..."
    
    # Check if Expo CLI is installed
    if ! command -v expo &> /dev/null; then
        npm install -g @expo/cli
        print_success "Expo CLI installed"
    else
        print_success "Expo CLI already installed"
    fi
    
    # Check if nodemon is installed globally
    if ! command -v nodemon &> /dev/null; then
        npm install -g nodemon
        print_success "Nodemon installed"
    else
        print_success "Nodemon already installed"
    fi
    
    # Install PM2 for production
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
        print_success "PM2 installed"
    else
        print_success "PM2 already installed"
    fi
}

# Create PM2 ecosystem file
create_pm2_config() {
    print_header "CREATING PM2 CONFIGURATION"
    
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'chatzone-backend',
      script: './backend/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './backend/logs/err.log',
      out_file: './backend/logs/out.log',
      log_file: './backend/logs/combined.log',
      time: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G'
    }
  ]
};
EOF
    
    print_success "PM2 configuration created"
}

# Create Docker configuration
create_docker_config() {
    print_header "CREATING DOCKER CONFIGURATION"
    
    # Docker Compose for development
    cat > docker-compose.dev.yml << EOF
version: '3.8'

services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: chatzone
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/chatzone
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
EOF
    
    print_success "Docker Compose configuration created"
}

# Generate SSL certificates for development
generate_ssl_certs() {
    print_header "GENERATING SSL CERTIFICATES"
    
    if [ ! -d "backend/keys" ]; then
        mkdir -p backend/keys
    fi
    
    # Generate self-signed certificate for development
    openssl req -x509 -newkey rsa:4096 -keyout backend/keys/private.key -out backend/keys/certificate.crt -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"
    
    print_success "SSL certificates generated for development"
    print_warning "Remember to use proper SSL certificates in production"
}

# Create startup scripts
create_scripts() {
    print_header "CREATING STARTUP SCRIPTS"
    
    # Development start script
    cat > start-dev.sh << 'EOF'
#!/bin/bash

# Start ChatzOne in development mode
echo "🚀 Starting ChatzOne Development Environment..."

# Check if services are running
if ! pgrep -x "postgres" > /dev/null; then
    echo "Starting PostgreSQL..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start postgresql
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql
    fi
fi

if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start redis-server
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start redis
    fi
fi

# Start backend in background
echo "Starting backend server..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "Starting frontend..."
cd .. && npm start

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
EOF
    
    chmod +x start-dev.sh
    
    # Production start script
    cat > start-prod.sh << 'EOF'
#!/bin/bash

# Start ChatzOne in production mode
echo "🚀 Starting ChatzOne Production Environment..."

# Start with PM2
pm2 start ecosystem.config.js --env production

echo "✅ ChatzOne started in production mode"
echo "📊 Monitor with: pm2 monit"
echo "📋 View logs with: pm2 logs"
echo "🔄 Restart with: pm2 restart chatzone-backend"
EOF
    
    chmod +x start-prod.sh
    
    # Stop script
    cat > stop.sh << 'EOF'
#!/bin/bash

# Stop ChatzOne services
echo "🛑 Stopping ChatzOne..."

# Stop PM2 processes
pm2 stop chatzone-backend 2>/dev/null || echo "PM2 process not running"

# Kill any remaining processes
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true

echo "✅ ChatzOne stopped"
EOF
    
    chmod +x stop.sh
    
    print_success "Startup scripts created"
}

# Create comprehensive README
create_readme() {
    print_header "CREATING DOCUMENTATION"
    
    cat > SETUP_COMPLETE.md << 'EOF'
# ChatzOne - Complete Setup Guide

## 🎉 Installation Complete!

ChatzOne has been successfully set up on your system. Here's everything you need to know:

## 📁 Project Structure

```
chatzone/
├── backend/                 # Node.js/Express backend
│   ├── routes/             # API routes
│   ├── models/             # Database models
│   ├── middleware/         # Express middleware
│   ├── utils/              # Utility functions
│   ├── uploads/            # File uploads
│   └── logs/               # Application logs
├── src/                    # React Native frontend
│   ├── components/         # Reusable components
│   ├── screens/           # Screen components
│   ├── navigation/        # Navigation setup
│   ├── services/          # API services
│   └── context/           # React context
├── database/              # Database schemas and migrations
├── assets/                # Static assets
└── docs/                  # Documentation
```

## 🚀 Getting Started

### Development Mode

1. **Start all services:**
   ```bash
   ./start-dev.sh
   ```

2. **Or start services individually:**
   ```bash
   # Backend only
   cd backend && npm run dev
   
   # Frontend only
   npm start
   ```

### Production Mode

1. **Start production server:**
   ```bash
   ./start-prod.sh
   ```

2. **Monitor services:**
   ```bash
   pm2 monit
   ```

## 🔧 Configuration

### Backend Configuration

Edit `backend/.env` to configure:
- Database connection
- API keys (Stripe, Google, Firebase)
- External services
- Security settings

### Frontend Configuration

Edit `.env` to configure:
- API endpoints
- App settings
- Feature flags

## 📱 Mobile App Development

### Running on Device

1. **Install Expo Go app** on your phone
2. **Scan QR code** from terminal
3. **Or run on simulator:**
   ```bash
   npm run ios     # iOS simulator
   npm run android # Android emulator
   ```

### Building for Production

1. **Configure app.json** with your app details
2. **Build for iOS:**
   ```bash
   eas build --platform ios
   ```
3. **Build for Android:**
   ```bash
   eas build --platform android
   ```

## 🗄️ Database Management

### Access Database
```bash
psql -h localhost -U chatzone_user -d chatzone
```

### Run Migrations
```bash
cd backend && npm run migrate
```

### Backup Database
```bash
pg_dump -h localhost -U chatzone_user chatzone > backup.sql
```

## 🔐 Security

### SSL Certificates

- Development certificates are auto-generated
- For production, replace certificates in `backend/keys/`
- Update environment variables for HTTPS

### Environment Variables

- Never commit `.env` files
- Use different keys for production
- Rotate secrets regularly

## 🎯 Features

### Core Features
- ✅ User authentication (email, Google, Facebook)
- ✅ Real-time messaging
- ✅ Voice/video calls
- ✅ AI-powered matching
- ✅ Coin system
- ✅ Multi-language support
- ✅ Push notifications

### Premium Features
- 🎯 Advanced matching algorithms
- 🎯 Priority support
- 🎯 Enhanced privacy controls
- 🎯 Unlimited messaging

## 📊 Monitoring

### Application Logs
```bash
# View backend logs
tail -f backend/logs/combined.log

# PM2 logs
pm2 logs chatzone-backend
```

### Database Monitoring
```bash
# PostgreSQL stats
psql -h localhost -U chatzone_user -d chatzone -c "SELECT * FROM pg_stat_activity;"
```

### Redis Monitoring
```bash
redis-cli monitor
```

## 🔧 Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   lsof -ti:5000 | xargs kill -9
   ```

2. **Database connection error:**
   - Check PostgreSQL is running
   - Verify credentials in `.env`
   - Check firewall settings

3. **Redis connection error:**
   - Check Redis is running
   - Verify Redis URL in `.env`

4. **Frontend won't start:**
   - Clear Metro cache: `npx react-native start --reset-cache`
   - Delete node_modules and reinstall

### Getting Help

1. Check logs in `backend/logs/`
2. Review environment configuration
3. Ensure all services are running
4. Check firewall and port settings

## 🚀 Deployment

### Production Checklist

- [ ] Update environment variables
- [ ] Configure SSL certificates
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Set up CDN for static assets
- [ ] Configure load balancer
- [ ] Set up error tracking (Sentry)

### Deployment Options

1. **VPS/Dedicated Server**
2. **Docker containers**
3. **Cloud platforms** (AWS, Google Cloud, Azure)
4. **Managed services** (Railway, Render, Heroku)

## 📞 Support

For technical support or questions:
- Check documentation in `/docs`
- Review error logs
- Check GitHub issues
- Contact development team

---

## 🎊 Congratulations!

Your ChatzOne application is ready to use. Start building amazing connections!
EOF
    
    print_success "Complete documentation created"
}

# Main setup function
main() {
    print_header "CHATZONE COMPLETE SETUP"
    echo -e "${CYAN}Welcome to ChatzOne - Real-time Social Chat App${NC}"
    echo -e "${CYAN}This script will set up everything you need to get started.${NC}"
    echo ""
    
    # Check if user wants to continue
    read -p "Do you want to continue with the setup? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Setup cancelled by user"
        exit 0
    fi
    
    # Run setup steps
    check_root
    check_system
    setup_database
    install_dependencies
    create_directories
    setup_environment
    init_database
    setup_dev_tools
    create_pm2_config
    create_docker_config
    generate_ssl_certs
    create_scripts
    create_readme
    
    # Final success message
    print_header "SETUP COMPLETE!"
    print_success "ChatzOne has been successfully set up!"
    echo ""
    print_status "Next steps:"
    echo -e "  1. Review and update configuration files:"
    echo -e "     ${YELLOW}- backend/.env${NC} (API keys, database settings)"
    echo -e "     ${YELLOW}- .env${NC} (frontend settings)"
    echo ""
    echo -e "  2. Start the development server:"
    echo -e "     ${GREEN}./start-dev.sh${NC}"
    echo ""
    echo -e "  3. Open your mobile app:"
    echo -e "     ${GREEN}Scan the QR code with Expo Go app${NC}"
    echo ""
    print_status "For detailed instructions, see SETUP_COMPLETE.md"
    print_status "Database credentials saved in .db_credentials"
    echo ""
    print_success "Happy coding! 🚀"
}

# Run main function
main "$@"