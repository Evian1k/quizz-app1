#!/bin/bash

# ChatzOne Setup Script
# This script sets up the complete ChatzOne development environment

set -e  # Exit on any error

echo "🚀 Setting up ChatzOne - Real-time Social Chat App"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if required tools are installed
check_requirements() {
    print_info "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    print_status "Node.js $(node -v) is installed"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_status "npm $(npm -v) is installed"
    
    # Check if Expo CLI is installed
    if ! command -v expo &> /dev/null; then
        print_warning "Expo CLI not found. Installing globally..."
        npm install -g @expo/cli
        print_status "Expo CLI installed"
    else
        print_status "Expo CLI is installed"
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        print_status "Docker is available for easy database setup"
    else
        print_warning "Docker not found. You'll need to set up PostgreSQL and Redis manually"
    fi
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    
    # Install frontend dependencies
    print_info "Installing frontend dependencies..."
    npm install
    print_status "Frontend dependencies installed"
    
    # Install backend dependencies
    print_info "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    print_status "Backend dependencies installed"
}

# Setup environment files
setup_environment() {
    print_info "Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        print_status "Backend .env file created from template"
        print_warning "Please edit backend/.env with your actual configuration"
    else
        print_status "Backend .env file already exists"
    fi
}

# Setup database with Docker
setup_database_docker() {
    print_info "Setting up database with Docker..."
    
    if command -v docker-compose &> /dev/null; then
        # Start database services
        docker-compose up -d postgres redis
        print_status "Database services started with Docker"
        
        # Wait for database to be ready
        print_info "Waiting for database to be ready..."
        sleep 10
        
        # Run migrations
        print_info "Running database migrations..."
        cd backend
        npm run migrate
        cd ..
        print_status "Database migrations completed"
        
    else
        print_warning "Docker Compose not available. Please set up PostgreSQL and Redis manually"
        print_info "See DEVELOPMENT.md for manual setup instructions"
    fi
}

# Setup database manually
setup_database_manual() {
    print_info "Manual database setup instructions:"
    print_info "1. Install PostgreSQL 14+ and create database 'chatzone_db'"
    print_info "2. Install Redis 6+"
    print_info "3. Update backend/.env with your database credentials"
    print_info "4. Run: cd backend && npm run migrate"
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p backend/uploads/profiles
    mkdir -p backend/uploads/media
    mkdir -p backend/logs
    mkdir -p src/assets/images
    mkdir -p src/assets/sounds
    mkdir -p src/assets/animations
    
    print_status "Directories created"
}

# Setup git hooks (if git repo exists)
setup_git_hooks() {
    if [ -d ".git" ]; then
        print_info "Setting up git hooks..."
        
        # Create pre-commit hook for linting
        cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Run linting before commit
echo "Running pre-commit checks..."

# Check backend code
cd backend
if [ -f "package.json" ]; then
    npm run lint --silent
    if [ $? -ne 0 ]; then
        echo "Backend linting failed. Please fix the issues before committing."
        exit 1
    fi
fi
cd ..

# Check frontend code
if [ -f "package.json" ]; then
    npm run lint --silent 2>/dev/null || true
fi

echo "Pre-commit checks passed!"
EOF
        chmod +x .git/hooks/pre-commit
        print_status "Git hooks setup completed"
    fi
}

# Generate sample data
generate_sample_data() {
    print_info "Generating sample data..."
    
    cd backend
    if [ -f "utils/seed.js" ]; then
        npm run seed
        print_status "Sample data generated"
    else
        print_warning "Seed script not found. Sample data not generated."
    fi
    cd ..
}

# Main setup function
main() {
    print_info "Starting ChatzOne setup..."
    
    check_requirements
    install_dependencies
    setup_environment
    create_directories
    setup_git_hooks
    
    # Ask user about database setup
    echo ""
    print_info "Database setup options:"
    echo "1. Use Docker (recommended - automatic setup)"
    echo "2. Manual setup (you'll need to install PostgreSQL and Redis)"
    echo ""
    read -p "Choose option (1 or 2): " db_option
    
    case $db_option in
        1)
            setup_database_docker
            generate_sample_data
            ;;
        2)
            setup_database_manual
            ;;
        *)
            print_warning "Invalid option. Skipping database setup."
            ;;
    esac
    
    echo ""
    print_status "ChatzOne setup completed! 🎉"
    echo ""
    print_info "Next steps:"
    echo "1. Edit backend/.env with your configuration"
    echo "2. Start the backend: cd backend && npm run dev"
    echo "3. Start the frontend: expo start"
    echo "4. Open Expo Go app on your phone and scan the QR code"
    echo ""
    print_info "For detailed development instructions, see DEVELOPMENT.md"
    print_info "For deployment instructions, see DEPLOYMENT.md"
    echo ""
    print_status "Happy coding! 🚀"
}

# Run main function
main