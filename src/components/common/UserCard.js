import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { useTheme } from '../../context/ThemeContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.9;
const CARD_HEIGHT = screenHeight * 0.7;

const UserCard = ({
  user,
  onSwipeLeft,
  onSwipeRight,
  onPress,
  showActions = true,
  compact = false,
  style,
}) => {
  const { colors, borderRadius, spacing, shadows } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = useState(false);

  const cardWidth = compact ? CARD_WIDTH * 0.7 : CARD_WIDTH;
  const cardHeight = compact ? CARD_HEIGHT * 0.6 : CARD_HEIGHT;

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const onGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: translateX,
          translationY: translateY,
        },
      },
    ],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX: tx, translationY: ty, velocityX } = event.nativeEvent;
      
      // Determine swipe direction
      if (Math.abs(tx) > 100 || Math.abs(velocityX) > 500) {
        if (tx > 0) {
          // Swipe right (like)
          animateSwipe(screenWidth + 100, 0, () => onSwipeRight?.(user));
        } else {
          // Swipe left (pass)
          animateSwipe(-screenWidth - 100, 0, () => onSwipeLeft?.(user));
        }
      } else {
        // Snap back
        animateToCenter();
      }
    }
  };

  const animateSwipe = (toX, toY, callback) => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: toX,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(translateY, {
        toValue: toY,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(rotate, {
        toValue: toX > 0 ? 1 : -1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      callback?.();
      resetCard();
    });
  };

  const animateToCenter = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: false,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: false,
      }),
      Animated.spring(rotate, {
        toValue: 0,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const resetCard = () => {
    translateX.setValue(0);
    translateY.setValue(0);
    rotate.setValue(0);
  };

  const handleLike = () => {
    animateSwipe(screenWidth + 100, 0, () => onSwipeRight?.(user));
  };

  const handlePass = () => {
    animateSwipe(-screenWidth - 100, 0, () => onSwipeLeft?.(user));
  };

  const handlePress = () => {
    setIsPressed(true);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsPressed(false);
      onPress?.(user);
    });
  };

  const rotateInterpolate = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const likeOpacity = translateX.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = translateX.interpolate({
    inputRange: [-100, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const cardStyle = {
    width: cardWidth,
    height: cardHeight,
    transform: [
      { translateX },
      { translateY },
      { rotate: rotateInterpolate },
      { scale },
    ],
  };

  const age = calculateAge(user.dateOfBirth || user.date_of_birth);
  const distance = user.distance ? `${Math.round(user.distance)}km away` : null;

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
    >
      <Animated.View style={[styles.container, cardStyle, style]}>
        <TouchableOpacity
          style={styles.card}
          onPress={handlePress}
          activeOpacity={0.95}
        >
          {/* Background Image or Avatar */}
          <View style={[styles.imageContainer, { borderRadius: borderRadius.xlarge }]}>
            {user.profilePicture || user.profile_picture ? (
              <Avatar
                source={{ uri: user.profilePicture || user.profile_picture }}
                size={cardWidth * 0.8}
                style={styles.mainAvatar}
              />
            ) : (
              <Avatar
                name={`${user.firstName || user.first_name} ${user.lastName || user.last_name}`}
                size={cardWidth * 0.4}
                style={styles.mainAvatar}
              />
            )}

            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={[styles.gradient, { borderRadius: borderRadius.xlarge }]}
            />

            {/* Like/Pass Overlays */}
            <Animated.View style={[styles.likeOverlay, { opacity: likeOpacity }]}>
              <Text style={styles.likeText}>LIKE</Text>
            </Animated.View>

            <Animated.View style={[styles.passOverlay, { opacity: passOpacity }]}>
              <Text style={styles.passText}>PASS</Text>
            </Animated.View>
          </View>

          {/* User Info */}
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.text }]}>
                {user.firstName || user.first_name}
                {age && `, ${age}`}
              </Text>
              <View style={styles.badges}>
                {user.isVerified && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
                {user.isPremium && (
                  <Ionicons name="diamond" size={18} color={colors.warning} />
                )}
              </View>
            </View>

            {user.bio && (
              <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={2}>
                {user.bio}
              </Text>
            )}

            {distance && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.distance, { color: colors.textSecondary }]}>
                  {distance}
                </Text>
              </View>
            )}

            {/* Interests */}
            {user.interests && user.interests.length > 0 && (
              <View style={styles.interestsContainer}>
                {user.interests.slice(0, 3).map((interest, index) => (
                  <View key={index} style={[styles.interestTag, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.interestText, { color: colors.primary }]}>
                      {interest.name || interest}
                    </Text>
                  </View>
                ))}
                {user.interests.length > 3 && (
                  <View style={[styles.interestTag, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.interestText, { color: colors.textSecondary }]}>
                      +{user.interests.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Action Buttons */}
          {showActions && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.passButton, { backgroundColor: colors.surface }]}
                onPress={handlePass}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={24} color={colors.error} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.likeButton]}
                onPress={handleLike}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
                />
                <Ionicons name="heart" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    overflow: 'hidden',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mainAvatar: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -100,
    marginLeft: -100,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  likeOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(76, 217, 100, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    transform: [{ rotate: '15deg' }],
  },
  likeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  passOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    transform: [{ rotate: '-15deg' }],
  },
  passText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bio: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  distance: {
    fontSize: 14,
    marginLeft: 4,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  interestTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 20,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  passButton: {
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  likeButton: {
    // Gradient applied via LinearGradient component
  },
});

export default UserCard;