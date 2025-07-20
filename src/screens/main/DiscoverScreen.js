import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Alert,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import UserCard from '../../components/common/UserCard';
import Avatar from '../../components/common/Avatar';
import { ApiService } from '../../services/ApiService';

const DiscoverScreen = ({ navigation }) => {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [noMoreUsers, setNoMoreUsers] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    loadUsers();
    
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await ApiService.get('/users/matches/potential', { limit: 20 });
      
      if (response.matches && response.matches.length > 0) {
        setUsers(response.matches);
        setCurrentIndex(0);
        setNoMoreUsers(false);
      } else {
        setNoMoreUsers(true);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      // Show mock data for demo
      setUsers(generateMockUsers());
    } finally {
      setLoading(false);
    }
  };

  const generateMockUsers = () => [
    {
      id: '1',
      firstName: 'Emma',
      lastName: 'Johnson',
      age: 25,
      bio: 'Love traveling and photography! Always looking for new adventures 📸✈️',
      profilePicture: null,
      isVerified: true,
      isPremium: false,
      distance: 2.5,
      interests: [
        { name: 'Photography' },
        { name: 'Travel' },
        { name: 'Coffee' },
        { name: 'Art' },
      ],
    },
    {
      id: '2',
      firstName: 'Alex',
      lastName: 'Chen',
      age: 28,
      bio: 'Tech enthusiast and coffee lover. Let\'s chat about the latest gadgets! ☕💻',
      profilePicture: null,
      isVerified: true,
      isPremium: true,
      distance: 1.2,
      interests: [
        { name: 'Technology' },
        { name: 'Coffee' },
        { name: 'Gaming' },
      ],
    },
    {
      id: '3',
      firstName: 'Sofia',
      lastName: 'Rodriguez',
      age: 26,
      bio: 'Musician and artist. Love creating and sharing beautiful things 🎵🎨',
      profilePicture: null,
      isVerified: false,
      isPremium: false,
      distance: 5.8,
      interests: [
        { name: 'Music' },
        { name: 'Art' },
        { name: 'Dancing' },
        { name: 'Movies' },
      ],
    },
  ];

  const handleSwipeLeft = async (swipedUser) => {
    try {
      // API call to record the pass
      await ApiService.post('/matches/pass', { userId: swipedUser.id });
      moveToNextUser();
    } catch (error) {
      console.error('Error recording pass:', error);
      moveToNextUser(); // Continue anyway
    }
  };

  const handleSwipeRight = async (swipedUser) => {
    try {
      // API call to record the like
      const response = await ApiService.post('/matches/like', { userId: swipedUser.id });
      
      if (response.matched) {
        // Show match animation/modal
        Alert.alert(
          'It\'s a Match! 🎉',
          `You and ${swipedUser.firstName} liked each other!`,
          [
            {
              text: 'Keep Swiping',
              style: 'cancel',
              onPress: moveToNextUser,
            },
            {
              text: 'Send Message',
              onPress: () => {
                navigation.navigate('Chats', {
                  screen: 'ChatRoom',
                  params: { conversationId: response.conversationId, user: swipedUser },
                });
              },
            },
          ]
        );
      } else {
        moveToNextUser();
      }
    } catch (error) {
      console.error('Error recording like:', error);
      moveToNextUser(); // Continue anyway
    }
  };

  const moveToNextUser = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= users.length) {
      if (!loading) {
        loadUsers(); // Load more users
      }
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const handleUserPress = (selectedUser) => {
    navigation.navigate('UserProfile', { user: selectedUser });
  };

  const handleFilterPress = () => {
    navigation.navigate('DiscoverFilters');
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
        <Avatar
          source={user?.profilePicture ? { uri: user.profilePicture } : null}
          name={`${user?.firstName} ${user?.lastName}`}
          size={40}
          verified={user?.isVerified}
          premium={user?.isPremium}
        />
      </TouchableOpacity>

      <Text style={[styles.headerTitle, { color: colors.text }]}>Discover</Text>

      <TouchableOpacity
        style={[styles.filterButton, { backgroundColor: colors.surface }]}
        onPress={handleFilterPress}
      >
        <Ionicons name="options-outline" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <Animated.View
      style={[
        styles.emptyContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
        <Ionicons name="heart-outline" size={48} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {noMoreUsers ? 'No More People' : 'Loading...'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {noMoreUsers
          ? 'Check back later for more people to discover!'
          : 'Finding amazing people for you...'}
      </Text>
      {noMoreUsers && (
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: colors.primary }]}
          onPress={loadUsers}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  const renderCards = () => {
    if (users.length === 0) return null;

    return (
      <View style={styles.cardsContainer}>
        {users.slice(currentIndex, currentIndex + 3).map((cardUser, index) => (
          <Animated.View
            key={cardUser.id}
            style={[
              styles.cardWrapper,
              {
                zIndex: 3 - index,
                transform: [
                  { scale: 1 - index * 0.05 },
                  { translateY: index * 10 },
                ],
                opacity: 1 - index * 0.3,
              },
            ]}
          >
            {index === 0 && (
              <UserCard
                user={cardUser}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onPress={handleUserPress}
              />
            )}
            {index > 0 && (
              <UserCard
                user={cardUser}
                showActions={false}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </Animated.View>
        ))}
      </View>
    );
  };

  const renderActionButtons = () => (
    <Animated.View
      style={[
        styles.actionButtons,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.actionButton, styles.passButton, { backgroundColor: colors.surface }]}
        onPress={() => users[currentIndex] && handleSwipeLeft(users[currentIndex])}
        disabled={users.length === 0}
      >
        <Ionicons name="close" size={28} color={colors.error} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.superLikeButton]}
        onPress={() => Alert.alert('Super Like', 'Super Like feature coming soon!')}
        disabled={users.length === 0}
      >
        <LinearGradient
          colors={['#FFD700', '#FFA500']}
          style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
        />
        <Ionicons name="star" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.likeButton]}
        onPress={() => users[currentIndex] && handleSwipeRight(users[currentIndex])}
        disabled={users.length === 0}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={[StyleSheet.absoluteFill, { borderRadius: 35 }]}
        />
        <Ionicons name="heart" size={32} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );

  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      {renderHeader()}

      <View style={styles.content}>
        {users.length === 0 ? renderEmptyState() : renderCards()}
      </View>

      {users.length > 0 && renderActionButtons()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cardWrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  refreshButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 30,
    gap: 20,
  },
  actionButton: {
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
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  superLikeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  likeButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
});

export default DiscoverScreen;
