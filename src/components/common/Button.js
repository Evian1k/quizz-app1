import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
  ...props
}) => {
  const { colors, borderRadius } = useTheme();

  const getButtonStyle = () => {
    const baseStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.large,
      ...getSizeStyle(),
    };

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    return [baseStyle, style];
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          minHeight: 36,
        };
      case 'large':
        return {
          paddingHorizontal: 32,
          paddingVertical: 16,
          minHeight: 56,
        };
      default: // medium
        return {
          paddingHorizontal: 24,
          paddingVertical: 12,
          minHeight: 48,
        };
    }
  };

  const getTextStyle = () => {
    const baseTextStyle = {
      fontWeight: '600',
      textAlign: 'center',
      ...getTextSizeStyle(),
    };

    switch (variant) {
      case 'primary':
        baseTextStyle.color = '#FFFFFF';
        break;
      case 'secondary':
        baseTextStyle.color = colors.primary;
        break;
      case 'outline':
        baseTextStyle.color = colors.primary;
        break;
      case 'ghost':
        baseTextStyle.color = colors.primary;
        break;
      case 'danger':
        baseTextStyle.color = '#FFFFFF';
        break;
      case 'success':
        baseTextStyle.color = '#FFFFFF';
        break;
      default:
        baseTextStyle.color = colors.text;
    }

    if (disabled) {
      baseTextStyle.color = colors.textSecondary;
    }

    return [baseTextStyle, textStyle];
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'small':
        return { fontSize: 14 };
      case 'large':
        return { fontSize: 18 };
      default:
        return { fontSize: 16 };
    }
  };

  const renderContent = () => (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' || variant === 'success' ? '#FFFFFF' : colors.primary}
          style={styles.loader}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={getTextSizeStyle().fontSize + 2}
              color={getTextStyle()[0].color}
              style={styles.iconLeft}
            />
          )}
          <Text style={getTextStyle()}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={getTextSizeStyle().fontSize + 2}
              color={getTextStyle()[0].color}
              style={styles.iconRight}
            />
          )}
        </>
      )}
    </View>
  );

  const handlePress = () => {
    if (!loading && !disabled && onPress) {
      onPress();
    }
  };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handlePress}
        activeOpacity={0.8}
        disabled={loading || disabled}
        {...props}
      >
        <LinearGradient
          colors={disabled ? [colors.border, colors.border] : [colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.large }]}
        />
        {renderContent()}
      </TouchableOpacity>
    );
  }

  const getVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: disabled ? colors.border : colors.primary,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: disabled ? colors.border : colors.error,
        };
      case 'success':
        return {
          backgroundColor: disabled ? colors.border : colors.success,
        };
      default:
        return {
          backgroundColor: colors.surface,
        };
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), getVariantStyle()]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={loading || disabled}
      {...props}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginRight: 8,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

export default Button;