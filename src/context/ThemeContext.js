import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

// Theme colors
const lightTheme = {
  colors: {
    primary: '#6C5CE7',
    primaryDark: '#5A52D5',
    accent: '#A29BFE',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    card: '#FFFFFF',
    text: '#2D3436',
    textSecondary: '#636E72',
    placeholder: '#B2BEC3',
    border: '#DDD6FE',
    error: '#E17055',
    success: '#00B894',
    warning: '#FDCB6E',
    info: '#74B9FF',
    
    // Chat specific colors
    chatBubbleSent: '#6C5CE7',
    chatBubbleReceived: '#F1F3F4',
    chatTextSent: '#FFFFFF',
    chatTextReceived: '#2D3436',
    
    // Status colors
    online: '#00B894',
    offline: '#B2BEC3',
    away: '#FDCB6E',
    
    // Gradient colors
    gradientStart: '#6C5CE7',
    gradientEnd: '#A29BFE',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 16,
    xlarge: 24,
    round: 50,
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: 'bold',
      lineHeight: 40,
    },
    h2: {
      fontSize: 28,
      fontWeight: 'bold',
      lineHeight: 36,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 32,
    },
    h4: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
    },
    body1: {
      fontSize: 16,
      fontWeight: 'normal',
      lineHeight: 24,
    },
    body2: {
      fontSize: 14,
      fontWeight: 'normal',
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: 'normal',
      lineHeight: 16,
    },
    button: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 24,
    },
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
  },
};

const darkTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    primary: '#A29BFE',
    primaryDark: '#8B7EE8',
    accent: '#6C5CE7',
    background: '#1A1A1A',
    surface: '#2D2D2D',
    card: '#2D2D2D',
    text: '#FFFFFF',
    textSecondary: '#B2BEC3',
    placeholder: '#636E72',
    border: '#4A4A4A',
    
    // Chat specific colors
    chatBubbleSent: '#A29BFE',
    chatBubbleReceived: '#3A3A3A',
    chatTextSent: '#FFFFFF',
    chatTextReceived: '#FFFFFF',
    
    // Gradient colors
    gradientStart: '#A29BFE',
    gradientEnd: '#6C5CE7',
  },
};

// Action types
const THEME_ACTIONS = {
  SET_THEME: 'SET_THEME',
  TOGGLE_THEME: 'TOGGLE_THEME',
  SET_SYSTEM_THEME: 'SET_SYSTEM_THEME',
};

// Initial state
const initialState = {
  isDark: false,
  themeMode: 'system', // 'light', 'dark', 'system'
  currentTheme: lightTheme,
};

// Reducer
function themeReducer(state, action) {
  switch (action.type) {
    case THEME_ACTIONS.SET_THEME:
      const newTheme = action.payload === 'dark' ? darkTheme : lightTheme;
      return {
        ...state,
        isDark: action.payload === 'dark',
        themeMode: action.payload === 'system' ? 'system' : action.payload,
        currentTheme: newTheme,
      };
    
    case THEME_ACTIONS.TOGGLE_THEME:
      const toggledTheme = state.isDark ? lightTheme : darkTheme;
      return {
        ...state,
        isDark: !state.isDark,
        themeMode: state.isDark ? 'light' : 'dark',
        currentTheme: toggledTheme,
      };
    
    case THEME_ACTIONS.SET_SYSTEM_THEME:
      const systemTheme = action.payload ? darkTheme : lightTheme;
      return {
        ...state,
        isDark: action.payload,
        currentTheme: systemTheme,
      };
    
    default:
      return state;
  }
}

export function ThemeProvider({ children }) {
  const [state, dispatch] = useReducer(themeReducer, initialState);
  const systemColorScheme = useColorScheme();

  // Load saved theme preference
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Handle system theme changes
  useEffect(() => {
    if (state.themeMode === 'system') {
      dispatch({
        type: THEME_ACTIONS.SET_SYSTEM_THEME,
        payload: systemColorScheme === 'dark',
      });
    }
  }, [systemColorScheme, state.themeMode]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themePreference');
      if (savedTheme) {
        const themeMode = JSON.parse(savedTheme);
        if (themeMode === 'system') {
          dispatch({
            type: THEME_ACTIONS.SET_SYSTEM_THEME,
            payload: systemColorScheme === 'dark',
          });
        } else {
          dispatch({
            type: THEME_ACTIONS.SET_THEME,
            payload: themeMode,
          });
        }
      } else {
        // Default to system theme
        dispatch({
          type: THEME_ACTIONS.SET_SYSTEM_THEME,
          payload: systemColorScheme === 'dark',
        });
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const setTheme = async (themeMode) => {
    try {
      await AsyncStorage.setItem('themePreference', JSON.stringify(themeMode));
      
      if (themeMode === 'system') {
        dispatch({
          type: THEME_ACTIONS.SET_SYSTEM_THEME,
          payload: systemColorScheme === 'dark',
        });
      } else {
        dispatch({
          type: THEME_ACTIONS.SET_THEME,
          payload: themeMode,
        });
      }
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    const newThemeMode = state.isDark ? 'light' : 'dark';
    await setTheme(newThemeMode);
  };

  const contextValue = {
    // State
    isDark: state.isDark,
    themeMode: state.themeMode,
    currentTheme: state.currentTheme,
    colors: state.currentTheme.colors,
    spacing: state.currentTheme.spacing,
    borderRadius: state.currentTheme.borderRadius,
    typography: state.currentTheme.typography,
    shadows: state.currentTheme.shadows,
    
    // Actions
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}