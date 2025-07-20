# 💬 ChatzOne - Real-Time Social Chat App

A modern, feature-rich social chat application with AI-powered matching, real-time messaging, voice/video calls, and a gamified coin system.

---

## 🚀 Features

### 🔍 **Smart Matching**
- AI/interest-based user matching
- Advanced filters (gender, location, language, interests)
- Personality-based compatibility scoring

### 💬 **Real-Time Communication**
- Instant text messaging with Socket.io
- High-quality voice calls
- HD video calling with WebRTC
- Media sharing (photos, audio, emojis)
- Auto-translation for global conversations

### 🪙 **Gamified Experience**
- Coin-based monetization system
- Daily login rewards
- Earn coins through referrals and activities
- Premium features unlock with coins

### 🛡️ **Privacy & Security**
- End-to-end encryption for calls
- Comprehensive blocking and reporting
- Profile verification system
- Privacy controls for contact sharing

### 🌍 **Global Accessibility**
- Multi-language support
- Auto-translation powered by Google Translate
- Localized user experience

---

## 🛠 Tech Stack

### **Frontend (Mobile)**
- **React Native** with Expo
- **React Navigation** for routing
- **React Native Paper** for UI components
- **Socket.io Client** for real-time messaging
- **WebRTC** for video/voice calls
- **Lottie** for animations

### **Backend**
- **Node.js** with Express
- **Socket.io** for real-time features
- **JWT** authentication
- **Bcrypt** for password hashing
- **Multer** for file uploads

### **Database**
- **PostgreSQL** for user data and coins
- **Redis** for session management and caching

### **External Services**
- **Google Translate API** for auto-translation
- **Firebase Cloud Messaging** for push notifications
- **Stripe** for payment processing
- **Google/Facebook OAuth** for social login

### **AI & Matching**
- **OpenAI API** for interest analysis
- Custom matching algorithm
- Behavioral pattern recognition

---

## 🏗️ Project Structure

```
chatzone/
├── frontend/                 # React Native mobile app
│   ├── components/          # Reusable UI components
│   ├── screens/            # App screens
│   ├── navigation/         # Navigation setup
│   ├── services/           # API calls and external services
│   ├── utils/              # Helper functions
│   └── assets/             # Images, fonts, animations
├── backend/                 # Node.js API server
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Authentication, validation
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   ├── utils/              # Helper functions
│   └── config/             # Database and app configuration
└── database/               # Database schemas and migrations
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Expo CLI
- Mobile device or emulator

### 1. Clone and Install
```bash
git clone <repository-url>
cd chatzone
npm install
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
# Configure your environment variables
npm run dev
```

### 3. Setup Database
```bash
# Create PostgreSQL database
createdb chatzone_db

# Run migrations
npm run migrate
```

### 4. Start Frontend
```bash
cd frontend
npm install
expo start
```

---

## 📱 App Screens

1. **Authentication** - Login/Register with social options
2. **Profile Setup** - Interests, photos, preferences
3. **Discovery** - AI-powered user matching
4. **Chat List** - Active conversations
5. **Chat Room** - Real-time messaging with media
6. **Video Call** - HD video/voice calling
7. **Coins Store** - Purchase and manage coins
8. **Settings** - Privacy, notifications, language

---

## 🔧 Configuration

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/chatzone_db
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
FACEBOOK_APP_ID=your_facebook_app_id

# External APIs
OPENAI_API_KEY=your_openai_key
GOOGLE_TRANSLATE_KEY=your_translate_key
STRIPE_SECRET_KEY=your_stripe_key

# Firebase
FIREBASE_SERVER_KEY=your_firebase_key
```

---

## 🎯 Development Roadmap

### Week 1: Foundation
- [x] Project setup and architecture
- [x] User authentication system
- [x] Basic profile management
- [x] Database schema design

### Week 2: Core Features
- [ ] Real-time messaging with Socket.io
- [ ] Basic matchmaking algorithm
- [ ] File upload and media sharing
- [ ] Push notifications

### Week 3: Advanced Features
- [ ] Video/voice calling with WebRTC
- [ ] AI-powered matching system
- [ ] Auto-translation integration
- [ ] Coin system implementation

### Week 4: Polish & Deploy
- [ ] UI/UX refinements
- [ ] Security hardening
- [ ] Performance optimization
- [ ] Production deployment

---

## 🚀 Deployment

### Backend (Railway/Render)
```bash
# Build and deploy
npm run build
npm run deploy
```

### Mobile App
```bash
# Build for production
expo build:android
expo build:ios
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎉 Acknowledgments

- Socket.io for real-time communication
- WebRTC for video/voice calling
- OpenAI for AI matching capabilities
- React Native community for mobile development
