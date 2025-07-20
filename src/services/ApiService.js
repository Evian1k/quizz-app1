import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API Configuration
const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? (Platform.OS === 'ios' ? 'http://localhost:5000' : 'http://10.0.2.2:5000')
    : 'https://your-production-api.com',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

class ApiService {
  static async getAuthHeaders() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      return token ? { 'Authorization': `Bearer ${token}` } : {};
    } catch (error) {
      console.error('Error getting auth headers:', error);
      return {};
    }
  }

  static async request(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}/api${endpoint}`;
    const authHeaders = await this.getAuthHeaders();
    
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      timeout: API_CONFIG.TIMEOUT,
      ...options,
    };

    let lastError;
    
    for (let attempt = 0; attempt < API_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 401) {
            // Token expired, try to refresh
            try {
              await this.refreshToken();
              const newAuthHeaders = await this.getAuthHeaders();
              config.headers = { ...config.headers, ...newAuthHeaders };
              
              // Retry the original request
              const retryResponse = await fetch(url, config);
              if (!retryResponse.ok) {
                throw new ApiError(retryResponse.status, await retryResponse.text());
              }
              return await retryResponse.json();
            } catch (refreshError) {
              // Refresh failed, logout user
              await AsyncStorage.multiRemove(['authToken', 'user']);
              throw new ApiError(401, 'Authentication failed');
            }
          }
          
          const errorText = await response.text();
          throw new ApiError(response.status, errorText);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          lastError = new ApiError(408, 'Request timeout');
        }
        
        if (attempt === API_CONFIG.RETRY_ATTEMPTS - 1) {
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY * (attempt + 1)));
      }
    }
    
    throw lastError;
  }

  static async refreshToken() {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await this.getAuthHeaders()),
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          await AsyncStorage.setItem('authToken', data.token);
        }
        return data;
      }
      
      throw new Error('Token refresh failed');
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  // HTTP Methods
  static get(endpoint, params = {}) {
    const queryString = Object.keys(params).length 
      ? '?' + new URLSearchParams(params).toString() 
      : '';
    return this.request(`${endpoint}${queryString}`);
  }

  static post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // File upload
  static async uploadFile(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    
    formData.append('file', {
      uri: file.uri,
      type: file.type || 'image/jpeg',
      name: file.name || 'upload.jpg',
    });

    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    const authHeaders = await this.getAuthHeaders();
    
    return this.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        ...authHeaders,
      },
      body: formData,
    });
  }
}

// Custom API Error class
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Convenience function for backward compatibility
const apiRequest = (endpoint, options) => ApiService.request(endpoint, options);

export { ApiService, ApiError, apiRequest, API_CONFIG };