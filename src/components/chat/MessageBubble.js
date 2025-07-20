import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import Avatar from '../common/Avatar';

const MessageBubble = ({
  message,
  isOwnMessage,
  showAvatar = true,
  showTime = true,
  onPress,
  onLongPress,
  onReaction,
  style,
}) => {
  const { colors, borderRadius, spacing } = useTheme();
  const [showReactions, setShowReactions] = useState(false);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    // Group reactions by emoji
    const reactionGroups = message.reactions.reduce((groups, reaction) => {
      if (!groups[reaction.emoji]) {
        groups[reaction.emoji] = [];
      }
      groups[reaction.emoji].push(reaction);
      return groups;
    }, {});

    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(reactionGroups).map(([emoji, reactions]) => (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionBubble,
              { backgroundColor: colors.surface },
            ]}
            onPress={() => onReaction?.(emoji)}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
              {reactions.length}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderMessageContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <View>
            <Image
              source={{ uri: message.imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
            {message.content && (
              <Text style={[styles.messageText, getTextStyle()]}>
                {message.content}
              </Text>
            )}
          </View>
        );
      
      case 'voice':
        return (
          <View style={styles.voiceMessage}>
            <TouchableOpacity style={styles.playButton}>
              <Ionicons
                name="play"
                size={20}
                color={isOwnMessage ? '#FFFFFF' : colors.primary}
              />
            </TouchableOpacity>
            <View style={styles.voiceWaveform}>
              {/* Voice waveform visualization */}
              <View style={[styles.waveBar, getWaveBarStyle()]} />
              <View style={[styles.waveBar, getWaveBarStyle()]} />
              <View style={[styles.waveBar, getWaveBarStyle()]} />
              <View style={[styles.waveBar, getWaveBarStyle()]} />
              <View style={[styles.waveBar, getWaveBarStyle()]} />
            </View>
            <Text style={[styles.voiceDuration, getTextStyle()]}>
              {message.duration || '0:00'}
            </Text>
          </View>
        );
      
      default:
        return (
          <Text style={[styles.messageText, getTextStyle()]}>
            {message.content}
          </Text>
        );
    }
  };

  const getBubbleStyle = () => {
    const baseStyle = {
      backgroundColor: isOwnMessage ? colors.chatBubbleSent : colors.chatBubbleReceived,
      borderRadius: borderRadius.large,
      paddingHorizontal: 16,
      paddingVertical: 12,
      maxWidth: '80%',
      minWidth: 60,
    };

    if (isOwnMessage) {
      baseStyle.borderBottomRightRadius = 4;
    } else {
      baseStyle.borderBottomLeftRadius = 4;
    }

    return baseStyle;
  };

  const getTextStyle = () => ({
    color: isOwnMessage ? colors.chatTextSent : colors.chatTextReceived,
    fontSize: 16,
    lineHeight: 22,
  });

  const getWaveBarStyle = () => ({
    backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.primary,
  });

  const handleLongPress = () => {
    setShowReactions(true);
    onLongPress?.(message);
  };

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.messageContainer,
          {
            flexDirection: isOwnMessage ? 'row-reverse' : 'row',
            alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
          },
        ]}
      >
        {/* Avatar */}
        {showAvatar && !isOwnMessage && (
          <Avatar
            source={message.sender?.profilePicture ? { uri: message.sender.profilePicture } : null}
            name={`${message.sender?.firstName} ${message.sender?.lastName}`}
            size={32}
            style={styles.avatar}
          />
        )}

        <View style={styles.bubbleContainer}>
          {/* Message Bubble */}
          <TouchableOpacity
            style={getBubbleStyle()}
            onPress={() => onPress?.(message)}
            onLongPress={handleLongPress}
            activeOpacity={0.8}
          >
            {renderMessageContent()}
          </TouchableOpacity>

          {/* Message Status */}
          {isOwnMessage && (
            <View style={styles.statusContainer}>
              {message.status === 'sending' && (
                <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              )}
              {message.status === 'sent' && (
                <Ionicons name="checkmark" size={12} color={colors.textSecondary} />
              )}
              {message.status === 'delivered' && (
                <View style={styles.doubleCheck}>
                  <Ionicons name="checkmark" size={12} color={colors.textSecondary} />
                  <Ionicons 
                    name="checkmark" 
                    size={12} 
                    color={colors.textSecondary} 
                    style={styles.secondCheck} 
                  />
                </View>
              )}
              {message.status === 'read' && (
                <View style={styles.doubleCheck}>
                  <Ionicons name="checkmark" size={12} color={colors.primary} />
                  <Ionicons 
                    name="checkmark" 
                    size={12} 
                    color={colors.primary} 
                    style={styles.secondCheck} 
                  />
                </View>
              )}
            </View>
          )}

          {/* Reactions */}
          {renderReactions()}

          {/* Timestamp */}
          {showTime && (
            <Text
              style={[
                styles.timestamp,
                {
                  color: colors.textSecondary,
                  textAlign: isOwnMessage ? 'right' : 'left',
                },
              ]}
            >
              {formatTime(message.createdAt || message.timestamp)}
            </Text>
          )}
        </View>
      </View>

      {/* Translation */}
      {message.translation && (
        <View
          style={[
            styles.translationContainer,
            {
              backgroundColor: colors.surface,
              alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          <Text style={[styles.translationText, { color: colors.textSecondary }]}>
            Translation: {message.translation}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  messageContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  avatar: {
    marginHorizontal: 8,
  },
  bubbleContainer: {
    flex: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 4,
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 150,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 20,
    gap: 2,
  },
  waveBar: {
    width: 3,
    height: 12,
    borderRadius: 1.5,
  },
  voiceDuration: {
    fontSize: 12,
    marginLeft: 8,
  },
  statusContainer: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginRight: 4,
  },
  doubleCheck: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondCheck: {
    marginLeft: -8,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    marginHorizontal: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  translationContainer: {
    marginTop: 8,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  translationText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default MessageBubble;