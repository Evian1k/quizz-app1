# 🚀 ChatzOne Deployment Guide

This guide covers deploying ChatzOne to various platforms including local development, Railway, Render, and mobile app stores.

## 📋 Prerequisites

### Development Environment
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Expo CLI (`npm install -g @expo/cli`)
- Git

### Production Environment
- Domain name (for backend API)
- SSL certificate (Let's Encrypt recommended)
- Cloud database (PostgreSQL)
- Redis instance
- File storage (AWS S3 or similar)
- Push notification service (Firebase)

## 🏠 Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Clone repository
git clone <repository-url>
cd chatzone

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ..
npm install
```

### 2. Database Setup

#### Option A: Docker Compose (Recommended)
```bash
# Start all services (PostgreSQL, Redis, Backend, pgAdmin)
docker-compose up -d

# Run database migrations
cd backend
npm run migrate
```

#### Option B: Manual Setup
```bash
# Install and start PostgreSQL
createdb chatzone_db

# Install and start Redis
redis-server

# Copy environment file
cd backend
cp .env.example .env

# Edit .env with your database credentials
# Run migrations
npm run migrate
```

### 3. Start Development Servers

```bash
# Terminal 1: Backend API
cd backend
npm run dev

# Terminal 2: React Native Frontend
expo start
```

### 4. Access the Application

- **Backend API**: http://localhost:5000
- **Frontend**: Use Expo Go app or simulator
- **Database Admin**: http://localhost:8080 (pgAdmin)
- **Redis Admin**: http://localhost:8081 (Redis Commander)

## ☁️ Cloud Deployment

### Railway Deployment (Backend)

1. **Create Railway Account**: https://railway.app

2. **Deploy Backend**:
```bash
cd backend

# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway add postgresql
railway add redis
railway deploy
```

3. **Configure Environment Variables**:
```bash
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your_super_secure_jwt_secret
railway variables set GOOGLE_CLIENT_ID=your_google_client_id
railway variables set FACEBOOK_APP_ID=your_facebook_app_id
# Add all other environment variables from .env.example
```

4. **Run Database Migration**:
```bash
railway run npm run migrate
```

### Render Deployment (Alternative)

1. **Create Render Account**: https://render.com

2. **Create PostgreSQL Database**:
   - Go to Dashboard → New → PostgreSQL
   - Note the connection details

3. **Create Redis Instance**:
   - Go to Dashboard → New → Redis
   - Note the connection URL

4. **Deploy Backend**:
   - Connect your GitHub repository
   - Select `backend` as root directory
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Add environment variables

### Vercel Deployment (Frontend Web Version)

```bash
# Install Vercel CLI
npm install -g vercel

# Build for web
expo build:web

# Deploy to Vercel
cd web-build
vercel --prod
```

## 📱 Mobile App Deployment

### iOS App Store

1. **Prerequisites**:
   - Apple Developer Account ($99/year)
   - Xcode (Mac required)
   - iOS device for testing

2. **Build and Submit**:
```bash
# Configure app.json for production
# Update version, bundle identifier, etc.

# Build for iOS
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

### Google Play Store

1. **Prerequisites**:
   - Google Play Console Account ($25 one-time)
   - Keystore for app signing

2. **Build and Submit**:
```bash
# Build for Android
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

## 🔧 Environment Configuration

### Backend Environment Variables

Create `.env` file in `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379

# Server
PORT=5000
NODE_ENV=production
CLIENT_URL=https://your-frontend-domain.com

# Security
JWT_SECRET=your_super_secure_jwt_secret_here
BCRYPT_ROUNDS=12

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# External APIs
OPENAI_API_KEY=your_openai_api_key
GOOGLE_TRANSLATE_API_KEY=your_translate_api_key

# Payments
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Firebase (Push Notifications)
FIREBASE_SERVER_KEY=your_firebase_server_key
FIREBASE_PROJECT_ID=your_firebase_project_id

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,video/mp4
```

### Frontend Configuration

Update `app.json` for production:

```json
{
  "expo": {
    "name": "ChatzOne",
    "slug": "chatzone",
    "version": "1.0.0",
    "privacy": "public",
    "platforms": ["ios", "android"],
    "extra": {
      "apiUrl": "https://your-backend-domain.com/api",
      "socketUrl": "https://your-backend-domain.com"
    }
  }
}
```

## 🔐 Security Checklist

### Backend Security
- [ ] Strong JWT secret (256-bit random string)
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] SQL injection protection
- [ ] File upload restrictions
- [ ] Environment variables secured

### Database Security
- [ ] Database connection encrypted (SSL)
- [ ] Strong database passwords
- [ ] Regular backups configured
- [ ] Access restricted to application only
- [ ] Database monitoring enabled

### Mobile App Security
- [ ] API keys secured (not in source code)
- [ ] Certificate pinning implemented
- [ ] Secure storage for sensitive data
- [ ] Biometric authentication (optional)
- [ ] App obfuscation for production

## 📊 Monitoring and Analytics

### Backend Monitoring
```bash
# Add monitoring dependencies
npm install winston morgan helmet express-rate-limit

# Set up logging
# Configure error tracking (Sentry recommended)
# Set up uptime monitoring
```

### Database Monitoring
- Enable slow query logging
- Set up connection pooling monitoring
- Configure automated backups
- Monitor disk usage and performance

### Mobile App Analytics
- Firebase Analytics integration
- Crash reporting (Crashlytics)
- User engagement tracking
- Performance monitoring

## 🚀 CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy ChatzOne

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm ci
      - run: cd backend && npm test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway deploy --service backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  build-mobile:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx eas build --platform all --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

## 🔄 Database Migrations

### Running Migrations
```bash
# Development
npm run migrate

# Production (Railway)
railway run npm run migrate

# Production (Render)
# Run via Render console or deployment script
```

### Creating New Migrations
```bash
# Create new migration file
touch database/migrations/001_add_user_preferences.sql

# Add migration to migrate.js
# Test migration locally before deploying
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificates configured
- [ ] Domain DNS configured
- [ ] External services (Firebase, Stripe) configured

### Post-Deployment
- [ ] Health checks passing
- [ ] Database connection verified
- [ ] Redis connection verified
- [ ] Socket.io connections working
- [ ] Push notifications working
- [ ] File uploads working
- [ ] Payment processing working
- [ ] Monitoring alerts configured

### Mobile App Release
- [ ] App tested on real devices
- [ ] Store listings prepared
- [ ] Screenshots and descriptions ready
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] App icons and assets finalized

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify network connectivity
   - Ensure database is running

2. **Redis Connection Failed**
   - Check REDIS_URL format
   - Verify Redis instance is running
   - Check network connectivity

3. **Socket.io Not Connecting**
   - Verify CORS configuration
   - Check WebSocket support
   - Ensure proper SSL configuration

4. **Mobile App Build Failed**
   - Check app.json configuration
   - Verify all required permissions
   - Ensure all dependencies are compatible

5. **Push Notifications Not Working**
   - Verify Firebase configuration
   - Check device permissions
   - Test notification service separately

### Performance Optimization

1. **Database**
   - Add database indexes
   - Optimize queries
   - Set up connection pooling
   - Configure read replicas

2. **Backend**
   - Enable gzip compression
   - Add caching headers
   - Optimize image processing
   - Set up CDN for static assets

3. **Mobile App**
   - Optimize bundle size
   - Lazy load components
   - Implement image caching
   - Use native optimizations

## 📞 Support

For deployment issues:
1. Check the logs first
2. Review this documentation
3. Search GitHub issues
4. Create a new issue with logs and environment details

---

**Happy Deploying! 🚀**