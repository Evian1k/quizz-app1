import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { socketService } from '../services/SocketService';
import { useAuth } from './AuthContext';
import { NotificationService } from '../services/NotificationService';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Map());

  // Connect socket when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, user]);

  const connectSocket = async () => {
    try {
      await socketService.connect();
      setupEventListeners();
      setIsConnected(true);
      setConnectionError(null);
    } catch (error) {
      console.error('Socket connection failed:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    }
  };

  const disconnectSocket = () => {
    socketService.disconnect();
    setIsConnected(false);
    setOnlineUsers(new Set());
    setTypingUsers(new Map());
  };

  const setupEventListeners = () => {
    // Connection status
    socketService.on('connection_status', ({ connected, reason }) => {
      setIsConnected(connected);
      if (!connected && reason) {
        console.log('Socket disconnected:', reason);
      }
    });

    socketService.on('connection_error', (error) => {
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // User status events
    socketService.on('user_online', ({ userId, username }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });

    socketService.on('user_offline', ({ userId, username }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    });

    // Typing indicators
    socketService.on('user_typing', ({ userId, username, isTyping, conversationId }) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        const key = `${conversationId}_${userId}`;
        
        if (isTyping) {
          newMap.set(key, { userId, username, conversationId });
        } else {
          newMap.delete(key);
        }
        
        return newMap;
      });
    });

    // Message events
    socketService.on('new_message', async (message) => {
      // Show notification if app is in background
      if (message.sender_id !== user?.id) {
        const isEnabled = await NotificationService.isNotificationEnabled('messages');
        if (isEnabled) {
          await NotificationService.showMessageNotification(message, {
            id: message.sender_id,
            firstName: message.first_name,
          });
        }
      }
    });

    // Match events
    socketService.on('match_found', async (match) => {
      const isEnabled = await NotificationService.isNotificationEnabled('matches');
      if (isEnabled) {
        await NotificationService.showMatchNotification(match);
      }
    });

    // Call events
    socketService.on('incoming_call', async (callData) => {
      const isEnabled = await NotificationService.isNotificationEnabled('calls');
      if (isEnabled) {
        await NotificationService.showCallNotification(
          {
            id: callData.callerId,
            firstName: callData.callerName,
          },
          callData.callId,
          callData.callType
        );
      }
    });
  };

  // Socket methods
  const joinConversation = useCallback((conversationId) => {
    if (isConnected) {
      socketService.joinConversation(conversationId);
    }
  }, [isConnected]);

  const leaveConversation = useCallback((conversationId) => {
    if (isConnected) {
      socketService.leaveConversation(conversationId);
    }
  }, [isConnected]);

  const sendMessage = useCallback((conversationId, message) => {
    if (isConnected) {
      socketService.sendMessage(conversationId, message);
    }
  }, [isConnected]);

  const startTyping = useCallback((conversationId) => {
    if (isConnected) {
      socketService.startTyping(conversationId);
    }
  }, [isConnected]);

  const stopTyping = useCallback((conversationId) => {
    if (isConnected) {
      socketService.stopTyping(conversationId);
    }
  }, [isConnected]);

  const reactToMessage = useCallback((messageId, reaction) => {
    if (isConnected) {
      socketService.reactToMessage(messageId, reaction);
    }
  }, [isConnected]);

  const initiateCall = useCallback((recipientId, conversationId, callType = 'video') => {
    if (isConnected) {
      socketService.initiateCall(recipientId, conversationId, callType);
    }
  }, [isConnected]);

  const answerCall = useCallback((callId, answer) => {
    if (isConnected) {
      socketService.answerCall(callId, answer);
    }
  }, [isConnected]);

  const declineCall = useCallback((callId) => {
    if (isConnected) {
      socketService.declineCall(callId);
    }
  }, [isConnected]);

  const endCall = useCallback((callId) => {
    if (isConnected) {
      socketService.endCall(callId);
    }
  }, [isConnected]);

  // WebRTC signaling
  const sendOffer = useCallback((callId, offer) => {
    if (isConnected) {
      socketService.sendOffer(callId, offer);
    }
  }, [isConnected]);

  const sendAnswer = useCallback((callId, answer) => {
    if (isConnected) {
      socketService.sendAnswer(callId, answer);
    }
  }, [isConnected]);

  const sendIceCandidate = useCallback((callId, candidate) => {
    if (isConnected) {
      socketService.sendIceCandidate(callId, candidate);
    }
  }, [isConnected]);

  // Event subscription helpers
  const addEventListener = useCallback((event, callback) => {
    socketService.on(event, callback);
    
    // Return cleanup function
    return () => {
      socketService.off(event, callback);
    };
  }, []);

  const removeEventListener = useCallback((event, callback) => {
    socketService.off(event, callback);
  }, []);

  // Utility functions
  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const getTypingUsers = useCallback((conversationId) => {
    const typing = [];
    typingUsers.forEach((value, key) => {
      if (value.conversationId === conversationId && value.userId !== user?.id) {
        typing.push(value);
      }
    });
    return typing;
  }, [typingUsers, user?.id]);

  const contextValue = {
    // Connection state
    isConnected,
    connectionError,
    
    // User status
    onlineUsers: Array.from(onlineUsers),
    isUserOnline,
    
    // Typing indicators
    getTypingUsers,
    
    // Socket methods
    socket: socketService,
    connectSocket,
    disconnectSocket,
    
    // Chat methods
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    reactToMessage,
    
    // Call methods
    initiateCall,
    answerCall,
    declineCall,
    endCall,
    
    // WebRTC methods
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    
    // Event handling
    addEventListener,
    removeEventListener,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}