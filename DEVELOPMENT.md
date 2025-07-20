# 🛠️ ChatzOne Development Guide

Welcome to the ChatzOne development guide! This document will help you set up your development environment and understand the project structure.

## 🏗️ Project Architecture

```
chatzone/
├── backend/                 # Node.js API Server
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Authentication, validation
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   ├── utils/              # Helper functions
│   ├── config/             # Database and app configuration
│   └── server.js           # Main server file
├── src/                    # React Native Frontend
│   ├── components/         # Reusable UI components
│   ├── screens/            # App screens
│   ├── navigation/         # Navigation setup
│   ├── services/           # API calls and external services
│   ├── context/            # React Context providers
│   └── utils/              # Helper functions
├── database/               # Database schemas and migrations
└── docker-compose.yml      # Development environment setup
```

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/)
- **Redis 6+** - [Download](https://redis.io/download)
- **Expo CLI** - `npm install -g @expo/cli`
- **Docker** (optional but recommended) - [Download](https://www.docker.com/)

### 2. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd chatzone

# Install dependencies
npm install
cd backend && npm install && cd ..
```

### 3. Environment Setup

#### Option A: Docker (Recommended)
```bash
# Start all services
docker-compose up -d

# Run database migrations
cd backend
npm run migrate

# Check if services are running
docker-compose ps
```

#### Option B: Manual Setup
```bash
# Start PostgreSQL and Redis manually
# Create database
createdb chatzone_db

# Copy environment files
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Run migrations
cd backend
npm run migrate
```

### 4. Start Development Servers

```bash
# Terminal 1: Backend API
cd backend
npm run dev

# Terminal 2: Frontend (new terminal)
expo start
```

### 5. Access the Application

- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api-docs (if implemented)
- **Frontend**: Use Expo Go app on your phone or simulator
- **Database Admin**: http://localhost:8080 (pgAdmin - admin@chatzone.com / admin123)
- **Redis Admin**: http://localhost:8081 (Redis Commander)

## 📱 Mobile Development

### Running on Device
1. Install Expo Go app on your phone
2. Scan the QR code from `expo start`
3. The app will load on your device

### Running on Simulator
```bash
# iOS Simulator (Mac only)
expo start --ios

# Android Emulator
expo start --android
```

### Hot Reloading
- Changes to React Native code will automatically reload
- Backend changes require server restart (or use nodemon)

## 🔧 Development Tools

### Recommended VS Code Extensions
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint
- Thunder Client (for API testing)
- PostgreSQL Explorer
- Docker

### Useful Commands

```bash
# Backend
cd backend
npm run dev          # Start development server
npm run migrate      # Run database migrations
npm run seed         # Seed database with sample data
npm test             # Run tests
npm run lint         # Run ESLint

# Frontend
expo start           # Start Expo development server
expo start --clear   # Start with cleared cache
expo doctor          # Check for issues
expo install         # Install compatible packages
```

## 🗃️ Database Management

### Accessing Database
```bash
# Using psql
psql postgresql://chatzone_user:chatzone_password@localhost:5432/chatzone_db

# Using pgAdmin (web interface)
# Navigate to http://localhost:8080
# Login: admin@chatzone.com / admin123
```

### Common Database Operations
```sql
-- View all tables
\dt

-- Check user count
SELECT COUNT(*) FROM users;

-- View recent messages
SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;

-- Check conversation activity
SELECT c.id, u1.username, u2.username, c.last_activity 
FROM conversations c
JOIN users u1 ON c.participant1_id = u1.id
JOIN users u2 ON c.participant2_id = u2.id
ORDER BY c.last_activity DESC;
```

### Creating Migrations
```bash
# Create new migration file
touch database/migrations/002_add_new_feature.sql

# Add to migration script
# Test locally before deploying
```

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test                    # Run all tests
npm test -- --watch        # Run tests in watch mode
npm test -- --coverage     # Run with coverage report
```

### Frontend Testing
```bash
# Unit tests
npm test

# E2E tests (if implemented)
npm run test:e2e
```

### API Testing
Use Thunder Client, Postman, or curl to test API endpoints:

```bash
# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123","firstName":"Test"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 🎨 UI Development

### Design System
- **Primary Color**: #6C5CE7 (Purple)
- **Accent Color**: #A29BFE (Light Purple)
- **Success**: #00B894 (Green)
- **Error**: #E17055 (Red)
- **Warning**: #FDCB6E (Yellow)

### Component Structure
```jsx
// Example component structure
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

const MyComponent = ({ title, onPress }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Button mode="contained" onPress={onPress}>
        Action
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});

export default MyComponent;
```

## 🔌 API Development

### Creating New Endpoints

1. **Create Model** (if needed):
```javascript
// backend/models/NewModel.js
class NewModel {
  static async create(data) {
    // Implementation
  }
  
  static async findById(id) {
    // Implementation
  }
}
```

2. **Create Controller**:
```javascript
// backend/controllers/newController.js
const NewModel = require('../models/NewModel');

const createNew = async (req, res) => {
  try {
    const data = req.body;
    const result = await NewModel.create(data);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createNew };
```

3. **Create Routes**:
```javascript
// backend/routes/new.js
const express = require('express');
const { createNew } = require('../controllers/newController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, createNew);

module.exports = router;
```

4. **Add to Server**:
```javascript
// backend/server.js
const newRoutes = require('./routes/new');
app.use('/api/new', newRoutes);
```

### API Response Format
```javascript
// Success response
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}

// Error response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 🔐 Authentication Flow

### JWT Token Handling
```javascript
// Frontend: API service with token
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiCall = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem('authToken');
  
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
};
```

### Protected Routes
```javascript
// Backend: Protecting routes
const { authenticateToken } = require('../middleware/auth');

router.get('/protected', authenticateToken, (req, res) => {
  // req.user contains authenticated user info
  res.json({ user: req.user });
});
```

## 🔄 State Management

### Context API Usage
```javascript
// Creating a new context
import React, { createContext, useContext, useReducer } from 'react';

const MyContext = createContext();

export const MyProvider = ({ children }) => {
  const [state, dispatch] = useReducer(myReducer, initialState);
  
  return (
    <MyContext.Provider value={{ state, dispatch }}>
      {children}
    </MyContext.Provider>
  );
};

export const useMyContext = () => {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
};
```

## 📡 Real-time Features

### Socket.io Integration

#### Backend Event Handling
```javascript
// backend/utils/socketHandler.js
socket.on('custom_event', async (data) => {
  try {
    // Process data
    const result = await processData(data);
    
    // Emit to specific room
    io.to(`room_${data.roomId}`).emit('custom_response', result);
  } catch (error) {
    socket.emit('error', { message: error.message });
  }
});
```

#### Frontend Socket Usage
```javascript
// Frontend: Using socket
import { useSocket } from '../context/SocketContext';

const MyComponent = () => {
  const { socket, isConnected } = useSocket();
  
  useEffect(() => {
    if (socket) {
      socket.on('custom_response', handleResponse);
      
      return () => {
        socket.off('custom_response', handleResponse);
      };
    }
  }, [socket]);
  
  const sendMessage = () => {
    socket?.emit('custom_event', { data: 'example' });
  };
};
```

## 🔍 Debugging

### Backend Debugging
```bash
# Enable debug logs
DEBUG=* npm run dev

# Node.js inspector
node --inspect server.js

# VS Code debugging configuration
# Add to .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/server.js",
  "env": {
    "NODE_ENV": "development"
  }
}
```

### Frontend Debugging
```bash
# React Native Debugger
# Install: https://github.com/jhen0409/react-native-debugger

# Expo debugging
expo start --dev-client

# Remote debugging
# Shake device → Debug Remote JS
```

### Common Debug Commands
```javascript
// Backend logging
console.log('Debug info:', data);
console.error('Error:', error);

// Frontend logging
console.log('Component state:', state);
console.warn('Warning message');

// Database query debugging
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
console.log('Query result:', result.rows);
```

## 🚀 Performance Optimization

### Backend Optimization
- Use database indexes
- Implement caching with Redis
- Optimize database queries
- Use compression middleware
- Implement rate limiting

### Frontend Optimization
- Lazy load components
- Optimize images
- Use FlatList for large lists
- Implement proper key props
- Minimize re-renders

## 📝 Code Style

### ESLint Configuration
```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "@react-native-community"
  ],
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "always"]
  }
}
```

### Prettier Configuration
```json
// .prettierrc
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true
}
```

## 🤝 Contributing

### Pull Request Process
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Commit Message Format
```
type(scope): description

feat(auth): add Google OAuth login
fix(chat): resolve message ordering issue
docs(readme): update installation instructions
```

## 📚 Learning Resources

### React Native
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)

### Backend Development
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)
- [Socket.io Documentation](https://socket.io/docs/v4/)

### Mobile Development
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [React Native Paper](https://reactnativepaper.com/)

## 🆘 Getting Help

1. **Check Documentation**: Start with this guide and README
2. **Search Issues**: Look through GitHub issues
3. **Ask Questions**: Create a discussion or issue
4. **Community**: Join our Discord/Slack (if available)

---

Happy coding! 🎉