import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    (async () => {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
      router.replace('/');
    })();
  }, [code]);

  return (
    <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <Text className="text-neutral-500">Signing in…</Text>
    </View>
  );
}
