import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from './ApiService';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
  }

  async connect() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      this.socket = io(API_CONFIG.BASE_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      });

      this.setupEventHandlers();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log('Socket connected successfully');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('Socket connection error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Socket connection failed:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('Socket connected');
      this.emit('connection_status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('Socket disconnected:', reason);
      this.emit('connection_status', { connected: false, reason });
      
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect manually
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.emit('connection_error', error);
      this.reconnect();
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emit('socket_error', error);
    });

    // Message events
    this.socket.on('new_message', (data) => {
      this.emit('new_message', data);
    });

    this.socket.on('message_reaction', (data) => {
      this.emit('message_reaction', data);
    });

    this.socket.on('user_typing', (data) => {
      this.emit('user_typing', data);
    });

    // Call events
    this.socket.on('incoming_call', (data) => {
      this.emit('incoming_call', data);
    });

    this.socket.on('call_answered', (data) => {
      this.emit('call_answered', data);
    });

    this.socket.on('call_declined', (data) => {
      this.emit('call_declined', data);
    });

    this.socket.on('call_ended', (data) => {
      this.emit('call_ended', data);
    });

    // WebRTC signaling
    this.socket.on('webrtc_offer', (data) => {
      this.emit('webrtc_offer', data);
    });

    this.socket.on('webrtc_answer', (data) => {
      this.emit('webrtc_answer', data);
    });

    this.socket.on('webrtc_ice_candidate', (data) => {
      this.emit('webrtc_ice_candidate', data);
    });

    // User status events
    this.socket.on('user_online', (data) => {
      this.emit('user_online', data);
    });

    this.socket.on('user_offline', (data) => {
      this.emit('user_offline', data);
    });

    this.socket.on('match_found', (data) => {
      this.emit('match_found', data);
    });
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.reconnect();
      }
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  // Event emission
  send(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot send event:', event);
    }
  }

  // Event listening
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in socket event callback:', error);
        }
      });
    }
  }

  // Chat methods
  joinConversation(conversationId) {
    this.send('join_conversation', { conversationId });
  }

  leaveConversation(conversationId) {
    this.send('leave_conversation', { conversationId });
  }

  sendMessage(conversationId, message) {
    this.send('send_message', {
      conversationId,
      ...message,
    });
  }

  startTyping(conversationId) {
    this.send('typing_start', { conversationId });
  }

  stopTyping(conversationId) {
    this.send('typing_stop', { conversationId });
  }

  reactToMessage(messageId, reaction) {
    this.send('react_to_message', { messageId, reaction });
  }

  // Call methods
  initiateCall(recipientId, conversationId, callType = 'video') {
    this.send('call_user', {
      recipientId,
      conversationId,
      callType,
    });
  }

  answerCall(callId, answer) {
    this.send('answer_call', { callId, answer });
  }

  declineCall(callId) {
    this.send('decline_call', { callId });
  }

  endCall(callId) {
    this.send('end_call', { callId });
  }

  // WebRTC signaling
  sendOffer(callId, offer) {
    this.send('webrtc_offer', { callId, offer });
  }

  sendAnswer(callId, answer) {
    this.send('webrtc_answer', { callId, answer });
  }

  sendIceCandidate(callId, candidate) {
    this.send('webrtc_ice_candidate', { callId, candidate });
  }

  // Utility methods
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Singleton instance
const socketService = new SocketService();

export { SocketService, socketService };