import React from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const Avatar = ({
  source,
  size = 50,
  name,
  status,
  showStatus = false,
  showBorder = false,
  borderColor,
  onPress,
  style,
  verified = false,
  premium = false,
  onlineIndicator = false,
  ...props
}) => {
  const { colors, borderRadius } = useTheme();

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return colors.online;
      case 'away':
        return colors.away;
      case 'offline':
        return colors.offline;
      default:
        return colors.online;
    }
  };

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  const borderStyle = showBorder ? {
    borderWidth: 3,
    borderColor: borderColor || colors.primary,
  } : {};

  const renderAvatar = () => {
    if (source && (typeof source === 'string' || source.uri)) {
      return (
        <Image
          source={typeof source === 'string' ? { uri: source } : source}
          style={[avatarStyle, borderStyle]}
          {...props}
        />
      );
    }

    // Fallback to initials with gradient background
    return (
      <View style={[avatarStyle, borderStyle]}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
        <Text
          style={[
            styles.initialsText,
            {
              fontSize: size * 0.4,
              color: '#FFFFFF',
            },
          ]}
        >
          {getInitials(name)}
        </Text>
      </View>
    );
  };

  const renderStatusIndicator = () => {
    if (!showStatus && !onlineIndicator) return null;

    const indicatorSize = size * 0.25;
    const indicatorStyle = {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: indicatorSize,
      height: indicatorSize,
      borderRadius: indicatorSize / 2,
      backgroundColor: getStatusColor(),
      borderWidth: 2,
      borderColor: colors.background,
    };

    return <View style={indicatorStyle} />;
  };

  const renderVerifiedBadge = () => {
    if (!verified) return null;

    const badgeSize = size * 0.3;
    return (
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: colors.primary,
            top: -2,
            right: -2,
          },
        ]}
      >
        <Ionicons
          name="checkmark"
          size={badgeSize * 0.6}
          color="#FFFFFF"
        />
      </View>
    );
  };

  const renderPremiumBadge = () => {
    if (!premium) return null;

    const badgeSize = size * 0.3;
    return (
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: colors.warning,
            top: verified ? badgeSize : -2,
            right: -2,
          },
        ]}
      >
        <Ionicons
          name="diamond"
          size={badgeSize * 0.6}
          color="#FFFFFF"
        />
      </View>
    );
  };

  const AvatarComponent = onPress ? TouchableOpacity : View;

  return (
    <AvatarComponent
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      {renderAvatar()}
      {renderStatusIndicator()}
      {renderVerifiedBadge()}
      {renderPremiumBadge()}
    </AvatarComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  initialsText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export default Avatar;