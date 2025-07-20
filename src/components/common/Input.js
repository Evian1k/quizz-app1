import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  editable = true,
  style,
  inputStyle,
  containerStyle,
  showPasswordToggle = false,
  ...props
}) => {
  const { colors, borderRadius, spacing } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);
  const animatedLabel = useRef(new Animated.Value(value ? 1 : 0)).current;
  const inputRef = useRef(null);

  useEffect(() => {
    Animated.timing(animatedLabel, {
      toValue: isFocused || value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleRightIconPress = () => {
    if (showPasswordToggle) {
      togglePasswordVisibility();
    } else if (onRightIconPress) {
      onRightIconPress();
    }
  };

  const getLabelStyle = () => {
    return {
      position: 'absolute',
      left: leftIcon ? 48 : 16,
      top: animatedLabel.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 8],
      }),
      fontSize: animatedLabel.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 12],
      }),
      color: animatedLabel.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.placeholder, isFocused ? colors.primary : colors.textSecondary],
      }),
      fontWeight: '500',
      backgroundColor: colors.background,
      paddingHorizontal: 4,
      zIndex: 1,
    };
  };

  const getInputContainerStyle = () => {
    return {
      borderWidth: 2,
      borderColor: error ? colors.error : isFocused ? colors.primary : colors.border,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      minHeight: multiline ? 80 : 56,
      ...style,
    };
  };

  const getInputStyle = () => {
    return {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      paddingHorizontal: 16,
      paddingVertical: multiline ? 16 : 18,
      paddingLeft: leftIcon ? 48 : 16,
      paddingRight: (rightIcon || showPasswordToggle) ? 48 : 16,
      textAlignVertical: multiline ? 'top' : 'center',
      ...inputStyle,
    };
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.inputContainer, getInputContainerStyle()]}>
        {label && (
          <Animated.Text style={getLabelStyle()}>
            {label}
          </Animated.Text>
        )}

        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons
              name={leftIcon}
              size={20}
              color={isFocused ? colors.primary : colors.textSecondary}
            />
          </View>
        )}

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={!label ? placeholder : ''}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          editable={editable}
          style={getInputStyle()}
          {...props}
        />

        {(rightIcon || showPasswordToggle) && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={handleRightIconPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={
                showPasswordToggle
                  ? showPassword
                    ? 'eye-off-outline'
                    : 'eye-outline'
                  : rightIcon
              }
              size={20}
              color={isFocused ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
        </View>
      )}

      {maxLength && value && (
        <Text style={[styles.characterCount, { color: colors.textSecondary }]}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  leftIconContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
  },
  rightIconContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    paddingHorizontal: 4,
  },
});

export default Input;