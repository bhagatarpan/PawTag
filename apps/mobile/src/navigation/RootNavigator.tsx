import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../lib/auth-context';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PetListScreen } from '../screens/pets/PetListScreen';
import { PetDetailScreen } from '../screens/pets/PetDetailScreen';
import { AddPetScreen } from '../screens/pets/AddPetScreen';
import { QRScannerScreen } from '../screens/tags/QRScannerScreen';
import { NFCScannerScreen } from '../screens/tags/NFCScannerScreen';
import { RedeemTagScreen } from '../screens/tags/RedeemTagScreen';
import { HealthRecordsScreen } from '../screens/health/HealthRecordsScreen';
import { SubscriptionScreen } from '../screens/subscriptions/SubscriptionScreen';
import { OrderHistoryScreen } from '../screens/orders/OrderHistoryScreen';
import { LostModeScreen } from '../screens/pets/LostModeScreen';
import { FullScreenSpinner } from '../components/states/Spinner';
import { colors, typography } from '../theme/tokens';
import { Text } from 'react-native';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: undefined;
  PetDetail: { petId: string };
  AddPet: undefined;
  QRScanner: undefined;
  NFCScanner: undefined;
  RedeemTag: { tagId?: string };
  HealthRecords: { petId: string; petName: string };
  Subscriptions: undefined;
  OrderHistory: undefined;
  LostMode: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          borderTopColor: colors.gray[100],
          backgroundColor: colors.white,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.medium,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: () => <Text>🏠</Text> }}
      />
      <Tab.Screen
        name="Pets"
        component={PetListScreen}
        options={{ tabBarLabel: 'Pets', tabBarIcon: () => <Text>🐾</Text> }}
      />
      <Tab.Screen
        name="Scan"
        component={RedeemTagScreen}
        options={{ tabBarLabel: 'Activate', tabBarIcon: () => <Text>🏷️</Text> }}
      />
    </Tab.Navigator>
  );
}

const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.gray[50] },
};

const authScreenOptions = {
  ...screenOptions,
  animation: 'slide_from_right' as const,
};

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenSpinner label="Loading PawTag..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={authScreenOptions} />
            <Stack.Screen name="Register" component={RegisterScreen} options={authScreenOptions} />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={authScreenOptions}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={screenOptions} />
            <Stack.Screen name="PetDetail" component={PetDetailScreen} options={authScreenOptions} />
            <Stack.Screen name="AddPet" component={AddPetScreen} options={authScreenOptions} />
            <Stack.Screen name="QRScanner" component={QRScannerScreen} options={authScreenOptions} />
            <Stack.Screen name="NFCScanner" component={NFCScannerScreen} options={authScreenOptions} />
            <Stack.Screen name="RedeemTag" component={RedeemTagScreen} options={authScreenOptions} />
            <Stack.Screen name="HealthRecords" component={HealthRecordsScreen} options={authScreenOptions} />
            <Stack.Screen name="Subscriptions" component={SubscriptionScreen} options={authScreenOptions} />
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} options={authScreenOptions} />
            <Stack.Screen name="LostMode" component={LostModeScreen} options={authScreenOptions} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
