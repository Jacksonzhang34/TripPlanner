import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const { code, error_description: errorDescription } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (errorDescription) {
        console.error('OAuth provider returned an error:', errorDescription);
        setErrorMessage(errorDescription);
        return;
      }

      if (!code) {
        const url = typeof window !== 'undefined' ? window.location.href : '(no window)';
        console.error('auth-callback reached with no code param. Full URL:', url);
        setErrorMessage('Sign-in did not complete. Please try again.');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('exchangeCodeForSession failed:', error.message, error);
        setErrorMessage(error.message);
        return;
      }
      router.replace('/');
    })();
  }, [code, errorDescription]);

  return (
    <View className="flex-1 items-center justify-center gap-2 bg-neutral-50 px-6 dark:bg-neutral-900">
      <Text className="text-neutral-500">{errorMessage ? 'Sign-in failed' : 'Signing in…'}</Text>
      {errorMessage ? <Text className="text-center text-red-600">{errorMessage}</Text> : null}
    </View>
  );
}
