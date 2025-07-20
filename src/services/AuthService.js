import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './ApiService';

class AuthService {
  static async login(credentials) {
    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      
      if (response.token) {
        await AsyncStorage.setItem('authToken', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
      }
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  static async register(userData) {
    try {
      const response = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      
      if (response.token) {
        await AsyncStorage.setItem('authToken', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
      }
      
      return response;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  static async googleLogin(googleData) {
    try {
      const response = await apiRequest('/auth/google', {
        method: 'POST',
        body: JSON.stringify(googleData),
      });
      
      if (response.token) {
        await AsyncStorage.setItem('authToken', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
      }
      
      return response;
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  }

  static async facebookLogin(facebookData) {
    try {
      const response = await apiRequest('/auth/facebook', {
        method: 'POST',
        body: JSON.stringify(facebookData),
      });
      
      if (response.token) {
        await AsyncStorage.setItem('authToken', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
      }
      
      return response;
    } catch (error) {
      console.error('Facebook login error:', error);
      throw error;
    }
  }

  static async logout() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        await apiRequest('/auth/logout', {
          method: 'POST',
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.multiRemove(['authToken', 'user']);
    }
  }

  static async verifyToken(token) {
    try {
      const response = await apiRequest('/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return response.user;
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  static async refreshToken() {
    try {
      const response = await apiRequest('/auth/refresh', {
        method: 'POST',
      });
      
      if (response.token) {
        await AsyncStorage.setItem('authToken', response.token);
      }
      
      return response;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  static async updateProfile(profileData) {
    try {
      const response = await apiRequest('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
      
      if (response.user) {
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
      }
      
      return response.user;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }

  static async getCurrentUser() {
    try {
      const userString = await AsyncStorage.getItem('user');
      return userString ? JSON.parse(userString) : null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  static async getToken() {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Get token error:', error);
      return null;
    }
  }
}

export { AuthService };