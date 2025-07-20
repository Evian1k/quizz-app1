# 🚀 ChatzOne Quick Start Guide

## ⚡ **Fastest Way to Get Running**

If you're seeing errors, run this **one command** to fix everything:

```bash
./fix-and-run.sh
```

This will:
- ✅ Clean and reinstall all dependencies
- ✅ Create missing directories and files
- ✅ Fix configuration issues
- ✅ Set up environment files
- ✅ Create placeholder assets

## 📱 **Start Development**

### Option 1: Run Both Frontend & Backend Together
```bash
./start-dev.sh
```

### Option 2: Run Separately

**Frontend:**
```bash
npm run dev
# or
npm start
```

**Backend:**
```bash
cd backend
npm run dev
```

## 🔧 **Common Issues & Fixes**

### ❌ **"Missing script: dev"**
**Fix:** The `dev` script has been added to package.json. If still missing, run:
```bash
npm run start
```

### ❌ **"expo-media-library" plugin error**
**Fix:** This has been removed from the configuration. The app will work without it for now.

### ❌ **"nodemon: not found"**
**Fix:** Install backend dependencies:
```bash
cd backend
npm install
```

### ❌ **Missing asset files**
**Fix:** Run the fix script:
```bash
./fix-and-run.sh
```

### ❌ **React version conflicts**
**Fix:** Install with legacy peer deps:
```bash
npm install --legacy-peer-deps
```

## 📦 **What's Working**

✅ **Frontend (React Native/Expo)**
- Basic app structure
- Navigation setup
- Component architecture
- Development server

✅ **Backend (Node.js/Express)**
- API server
- Socket.io real-time features
- Database models
- Authentication routes

## 🎯 **Next Steps**

1. **Start the app** with `./fix-and-run.sh`
2. **Open on your phone** with Expo Go app
3. **Scan QR code** from terminal
4. **Start developing!**

## 🔨 **Development Workflow**

1. **Make changes** to your code
2. **Hot reload** will update automatically
3. **Check terminal** for any errors
4. **Test on device** via Expo Go

## 📱 **Mobile Testing**

1. **Install Expo Go** on your phone:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Connect to same WiFi** as your computer

3. **Scan QR code** shown in terminal

## 🆘 **Still Having Issues?**

1. **Check Node.js version**: `node --version` (need 18+)
2. **Check npm version**: `npm --version`
3. **Clear cache**: `npm start -- --clear`
4. **Restart Metro**: `npx expo start --clear`
5. **Reinstall**: `rm -rf node_modules && npm install`

## 🎉 **Success!**

When everything works, you'll see:
- ✅ Backend server running on `http://localhost:5000`
- ✅ Expo development server with QR code
- ✅ Mobile app loads on your device
- ✅ Hot reload working

**Happy coding! 🚀**