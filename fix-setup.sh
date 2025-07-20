#!/bin/bash

echo "🔧 Fixing ChatzOne Setup Issues..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install Expo CLI globally if not installed
echo "📦 Installing Expo CLI globally..."
if ! command -v expo &> /dev/null; then
    npm install -g @expo/cli
    echo "✅ Expo CLI installed"
else
    echo "✅ Expo CLI already installed"
fi

# Clean and install root dependencies
echo "🧹 Cleaning and installing frontend dependencies..."
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Install backend dependencies
echo "🔧 Installing backend dependencies..."
cd backend
rm -rf node_modules package-lock.json
npm install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating backend .env file..."
    cp .env.example .env
    echo "✅ Created .env file - please configure your environment variables"
else
    echo "✅ .env file already exists"
fi

cd ..

echo ""
echo "🎉 Setup complete! Here's how to run the app:"
echo ""
echo "1. Start the backend:"
echo "   cd backend && npm run dev"
echo ""
echo "2. In another terminal, start the frontend:"
echo "   expo start"
echo ""
echo "3. Scan the QR code with Expo Go app on your phone"
echo ""
echo "📝 Don't forget to:"
echo "   - Configure your database in backend/.env"
echo "   - Set up PostgreSQL and Redis"
echo "   - Add your OAuth credentials"
echo ""
echo "🚀 Your ChatzOne app is ready to run!"