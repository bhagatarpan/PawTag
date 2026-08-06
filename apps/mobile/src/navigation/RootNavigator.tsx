import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../lib/auth-context';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FullScreenSpinner } from '../components/states/Spinner';
import { colors, typography } from '../theme/tokens';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
          // Unauthenticated screens
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
          // Authenticated screens
          <Stack.Screen name="Home" component={HomeScreen} options={screenOptions} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
