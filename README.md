# 💬 ChatzOne - Real-Time Social Chat App

<div align="center">

![ChatzOne Logo](https://img.shields.io/badge/ChatzOne-Real%20Time%20Chat-6C5CE7?style=for-the-badge&logo=chat&logoColor=white)

[![React Native](https://img.shields.io/badge/React%20Native-61DAFB?style=flat&logo=react&logoColor=black)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io&logoColor=white)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=flat&logo=webrtc&logoColor=white)](https://webrtc.org/)

**A modern, feature-rich social chat application with AI-powered matching, real-time messaging, voice/video calls, and a gamified coin system.**

[🚀 Quick Start](#quick-start) • [📱 Features](#features) • [🛠️ Tech Stack](#tech-stack) • [📖 Documentation](#documentation) • [🔧 Setup](#setup)

</div>

---

## 🎯 **What is ChatzOne?**

ChatzOne is a comprehensive real-time social chat application that brings people together through intelligent matching, seamless communication, and engaging features. Built with modern technologies and production-ready architecture.

### ✨ **Key Highlights**
- 🤖 **AI-Powered Matching** - Smart compatibility algorithms
- 💬 **Real-Time Messaging** - Instant chat with media support
- 📞 **Voice & Video Calls** - High-quality WebRTC implementation
- 🪙 **Gamified Economy** - Coin system with rewards & purchases
- 🌍 **Global Ready** - Multi-language support & auto-translation
- 🔒 **Enterprise Security** - End-to-end encryption & privacy controls
- 📱 **Cross-Platform** - React Native for iOS & Android
- ⚡ **Production Ready** - Scalable architecture with monitoring

---

## 📱 **Features**

### 🔍 **Smart Matching System**
- AI/interest-based user matching
- Advanced filters (gender, location, language, interests)
- Personality-based compatibility scoring
- Location-based discovery with GPS integration

### 💬 **Real-Time Communication**
- Instant text messaging with Socket.io
- High-quality voice calls
- HD video calling with WebRTC
- Media sharing (photos, videos, audio)
- Auto-translation for global conversations
- Typing indicators & read receipts
- Message reactions & replies

### 🪙 **Gamified Experience**
- Coin-based monetization system
- Daily login rewards with streak bonuses
- Earn coins through referrals and activities
- Premium features unlock with coins
- Stripe payment integration
- In-app purchases with multiple packages

### 🛡️ **Privacy & Security**
- End-to-end encryption for calls
- Comprehensive blocking and reporting
- Profile verification system
- Privacy controls for contact sharing
- Content moderation with AI
- Admin dashboard for monitoring

### 🌍 **Global Accessibility**
- Multi-language support (20+ languages)
- Auto-translation powered by Google Translate
- Localized user experience
- Time zone handling
- Cultural preference settings

---

## 🛠️ **Tech Stack**

<table>
<tr>
<td valign="top" width="50%">

### **Frontend (Mobile)**
- **React Native** with Expo
- **React Navigation** for routing
- **React Native Paper** for UI components
- **Socket.io Client** for real-time messaging
- **WebRTC** for video/voice calls
- **Lottie** for animations
- **AsyncStorage** for local data
- **Expo Camera** & **Image Picker** for media

</td>
<td valign="top" width="50%">

### **Backend (Server)**
- **Node.js** with Express.js
- **Socket.io** for real-time communication
- **PostgreSQL** with PostGIS for geolocation
- **Redis** for caching and sessions
- **JWT** for authentication
- **Stripe** for payments
- **Cloudinary** for media storage
- **Google Translate API** for translations

</td>
</tr>
</table>

### **Infrastructure & DevOps**
- **Docker** containerization
- **PM2** process management
- **SSL/TLS** encryption
- **Rate limiting** & security middleware
- **Comprehensive logging** with Winston
- **Health monitoring** & metrics
- **Automated backups**

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- PostgreSQL 12+
- Redis 6+
- Expo CLI
- Git

### **🎯 One-Command Setup**
```bash
# Clone and setup everything automatically
git clone https://github.com/Evian1k/quizz-app1.git
cd quizz-app1
chmod +x setup-complete.sh
./setup-complete.sh
```

### **🏃‍♂️ Start Development**
```bash
# Start all services
./start-dev.sh

# Or start individually
cd backend && npm run dev  # Backend
npm start                  # Frontend (in new terminal)
```

### **📱 Run on Mobile**
1. Install **Expo Go** app on your phone
2. Scan QR code from terminal
3. Start chatting!

---

## 📖 **Documentation**

### **📚 Complete Guides**
- [🔧 Setup Guide](SETUP_COMPLETE.md) - Detailed installation instructions
- [🚀 Deployment Guide](DEPLOYMENT.md) - Production deployment
- [💻 Development Guide](DEVELOPMENT.md) - Development workflow
- [📋 API Documentation](docs/API.md) - Complete API reference

### **🏗️ Project Structure**
```
chatzone/
├── 📱 Frontend (React Native)
│   ├── src/components/     # Reusable UI components
│   ├── src/screens/       # Screen components
│   ├── src/navigation/    # Navigation setup
│   ├── src/services/      # API services
│   ├── src/context/       # React context providers
│   └── assets/            # Images, sounds, animations
│
├── 🔧 Backend (Node.js)
│   ├── routes/            # API endpoints
│   ├── middleware/        # Express middleware
│   ├── utils/             # Utility functions
│   ├── config/            # Configuration files
│   ├── uploads/           # File storage
│   └── logs/              # Application logs
│
├── 🗄️ Database
│   ├── schema.sql         # PostgreSQL schema
│   └── migrations/        # Database migrations
│
├── 🐳 Infrastructure
│   ├── docker-compose.yml # Container setup
│   ├── ecosystem.config.js # PM2 configuration
│   └── setup-complete.sh  # Automated setup
│
└── 📚 Documentation
    └── Complete guides and API docs
```

---

## 🔧 **Configuration**

### **Environment Variables**
```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/chatzone
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_key
CLOUDINARY_URL=your_cloudinary_url
GOOGLE_TRANSLATE_API_KEY=your_google_key

# Frontend (.env)
EXPO_PUBLIC_API_URL=http://localhost:5000/api
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
```

### **Required API Keys**
- **Stripe** - Payment processing
- **Cloudinary** - Media storage
- **Google Translate** - Auto-translation
- **Firebase** - Push notifications
- **Google/Facebook OAuth** - Social login

---

## 📊 **Features in Detail**

<details>
<summary><strong>🔍 AI Matching System</strong></summary>

- **Interest-based matching** with machine learning
- **Location proximity** with customizable radius
- **Age and demographic filters**
- **Compatibility scoring algorithm**
- **Behavioral pattern analysis**
- **Premium matching features**

</details>

<details>
<summary><strong>💬 Real-Time Chat</strong></summary>

- **Socket.io** for instant messaging
- **Media sharing** (photos, videos, audio)
- **Auto-translation** in 20+ languages
- **Typing indicators** and **read receipts**
- **Message reactions** and **replies**
- **Conversation search** and **history**

</details>

<details>
<summary><strong>📞 Voice & Video Calls</strong></summary>

- **WebRTC** for peer-to-peer communication
- **High-quality audio/video**
- **Call history** and **statistics**
- **Coin-based pricing** (3 coins voice, 5 coins video)
- **Call recording** (premium feature)
- **Screen sharing** capability

</details>

<details>
<summary><strong>🪙 Coin Economy</strong></summary>

- **Daily rewards** with streak bonuses
- **Referral system** (50 coins per referral)
- **In-app purchases** via Stripe
- **Multiple coin packages** ($0.99 - $19.99)
- **Premium features** unlock
- **Activity-based rewards**

</details>

---

## 🎯 **Monetization**

### **💰 Revenue Streams**
- **Coin Purchases** - Primary revenue source
- **Premium Subscriptions** - Enhanced features
- **Advertising** - Optional sponsored content
- **Virtual Gifts** - Special occasion items
- **Profile Boosts** - Increased visibility

### **📊 Pricing Strategy**
- **Freemium Model** - Free with premium features
- **Competitive Pricing** - Market-rate coin packages
- **Value Proposition** - Clear benefits for spending
- **Retention Focus** - Daily rewards and streaks

---

## 🚀 **Deployment**

### **🌐 Production Deployment**
```bash
# Production setup
./start-prod.sh

# Monitor with PM2
pm2 monit
pm2 logs chatzone-backend
```

### **🐳 Docker Deployment**
```bash
# Build and run with Docker
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose scale backend=3
```

### **☁️ Cloud Platforms**
- **AWS** - EC2, RDS, ElastiCache, S3
- **Google Cloud** - Compute Engine, Cloud SQL, Memorystore
- **Azure** - App Service, PostgreSQL, Redis Cache
- **Railway/Render** - Simple deployment options

---

## 📈 **Performance & Scaling**

### **⚡ Optimization Features**
- **Redis Caching** - Session and data caching
- **Database Indexing** - Optimized queries
- **Image Compression** - Automatic optimization
- **CDN Integration** - Global content delivery
- **Load Balancing** - Multiple server instances
- **Connection Pooling** - Efficient database connections

### **📊 Monitoring**
- **Real-time Analytics** - User activity tracking
- **Performance Metrics** - Response times and throughput
- **Error Tracking** - Automatic error reporting
- **Health Checks** - System status monitoring
- **Log Aggregation** - Centralized logging

---

## 🔒 **Security**

### **🛡️ Security Features**
- **JWT Authentication** - Secure token-based auth
- **Rate Limiting** - API abuse prevention
- **Input Validation** - SQL injection protection
- **HTTPS/SSL** - Encrypted connections
- **CORS Protection** - Cross-origin security
- **Content Moderation** - AI-powered filtering

### **🔐 Privacy Controls**
- **User Blocking** - Comprehensive blocking system
- **Report System** - Community moderation
- **Data Privacy** - GDPR compliance ready
- **Account Deletion** - Complete data removal
- **Privacy Settings** - Granular controls

---

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **🐛 Bug Reports**
- Use GitHub Issues for bug reports
- Include detailed reproduction steps
- Provide system information and logs

### **✨ Feature Requests**
- Discuss new features in GitHub Discussions
- Follow the feature request template
- Consider implementation complexity

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **React Native Community** - Amazing framework and ecosystem
- **Socket.io Team** - Real-time communication made easy
- **PostgreSQL** - Robust and reliable database
- **Expo Team** - Simplified React Native development
- **Open Source Contributors** - Building amazing tools

---

## 📞 **Support**

### **🆘 Need Help?**
- 📖 Check our [Documentation](docs/)
- 🐛 Report bugs in [Issues](https://github.com/Evian1k/quizz-app1/issues)
- 💬 Join our [Discord Community](https://discord.gg/chatzone)
- 📧 Email: support@chatzone.com

### **🚀 Ready to Launch?**
Follow our [Production Deployment Guide](DEPLOYMENT.md) to get ChatzOne live!

---

<div align="center">

**⭐ Star this repo if you find it helpful!**

Made with ❤️ by the ChatzOne Team

[🚀 Get Started](#quick-start) • [📱 Download App](#) • [🌐 Visit Website](#)

</div>
