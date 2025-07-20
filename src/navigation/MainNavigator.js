import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Import screens
import DiscoverScreen from '../screens/main/DiscoverScreen';
import ChatsScreen from '../screens/main/ChatsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import VideoCallScreen from '../screens/calls/VideoCallScreen';
import MatchesScreen from '../screens/main/MatchesScreen';
import CoinsScreen from '../screens/main/CoinsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Chat Stack Navigator
const ChatStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatsList" component={ChatsScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
    </Stack.Navigator>
  );
};

// Profile Stack Navigator
const ProfileStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Coins" component={CoinsScreen} />
    </Stack.Navigator>
  );
};

const MainNavigator = () => {
  const { colors, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Main Tab Navigator */}
      <Stack.Screen name="MainTabs">
        {() => (
          <Tab.Navigator
            initialRouteName="Discover"
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;

                switch (route.name) {
                  case 'Discover':
                    iconName = focused ? 'search' : 'search-outline';
                    break;
                  case 'Matches':
                    iconName = focused ? 'heart' : 'heart-outline';
                    break;
                  case 'Chats':
                    iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                    break;
                  case 'Profile':
                    iconName = focused ? 'person' : 'person-outline';
                    break;
                  default:
                    iconName = 'circle';
                }

                return <Ionicons name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.textSecondary,
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                borderTopWidth: 1,
                paddingBottom: 5,
                paddingTop: 5,
                height: 60,
              },
              tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '600',
                marginTop: 4,
              },
            })}
          >
            <Tab.Screen 
              name="Discover" 
              component={DiscoverScreen}
              options={{
                tabBarLabel: 'Discover',
              }}
            />
            <Tab.Screen 
              name="Matches" 
              component={MatchesScreen}
              options={{
                tabBarLabel: 'Matches',
              }}
            />
            <Tab.Screen 
              name="Chats" 
              component={ChatStackNavigator}
              options={{
                tabBarLabel: 'Chats',
              }}
            />
            <Tab.Screen 
              name="Profile" 
              component={ProfileStackNavigator}
              options={{
                tabBarLabel: 'Profile',
              }}
            />
          </Tab.Navigator>
        )}
      </Stack.Screen>

      {/* Modal Screens */}
      <Stack.Screen 
        name="VideoCall" 
        component={VideoCallScreen}
        options={{
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;