import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { LogBox } from 'react-native';

// Import screens
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import SplashScreen from './src/screens/SplashScreen';

// Import services
import { AuthService } from './src/services/AuthService';
import { SocketService } from './src/services/SocketService';
import { NotificationService } from './src/services/NotificationService';

// Import context providers
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SocketProvider } from './src/context/SocketContext';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'Remote debugger',
]);

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createStackNavigator();

// Custom theme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6C5CE7',
    accent: '#A29BFE',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: '#2D3436',
    placeholder: '#636E72',
    error: '#E17055',
    success: '#00B894',
    warning: '#FDCB6E',
  },
};

function AppContent() {
  const { user, isLoading, checkAuthState } = useAuth();
  const { currentTheme } = useTheme();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check authentication state
      await checkAuthState();
      
      // Initialize notification service
      await NotificationService.initialize();
      
      // Request notification permissions
      await NotificationService.requestPermissions();
      
      setIsInitialized(true);
    } catch (error) {
      console.error('App initialization error:', error);
      setIsInitialized(true);
    }
  };

  if (!isInitialized || isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer theme={currentTheme}>
      <StatusBar style="auto" />
      {user ? (
        <SocketProvider>
          <MainNavigator />
        </SocketProvider>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}