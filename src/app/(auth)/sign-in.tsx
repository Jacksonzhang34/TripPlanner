import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { signInWithEmail, signInWithGoogle } from '@/features/auth/api';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleEmailSignIn() {
    if (!email.trim()) return;
    setSending(true);
    try {
      await signInWithEmail(email.trim());
      setSent(true);
    } catch (err) {
      Alert.alert('Could not send magic link', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert('Google sign-in failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">TripPlanner</Text>
          <Text className="text-base text-neutral-500">Plan trips together, one idea at a time.</Text>
        </View>

        {sent ? (
          <View className="gap-2 rounded-xl bg-accent-50 p-4 dark:bg-accent-900">
            <Text className="font-semibold text-accent-700 dark:text-accent-300">Check your email</Text>
            <Text className="text-accent-700 dark:text-accent-300">We sent a sign-in link to {email}.</Text>
          </View>
        ) : (
          <View className="gap-3">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#8A7E6E"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              className="rounded-xl border border-neutral-200 px-4 py-3 text-base text-neutral-900 dark:border-neutral-700 dark:text-neutral-50"
            />
            <Button label="Send magic link" onPress={handleEmailSignIn} loading={sending} />
          </View>
        )}

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
          <Text className="text-sm text-neutral-400">or</Text>
          <View className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
        </View>

        <Button
          label="Continue with Google"
          variant="secondary"
          onPress={handleGoogleSignIn}
          loading={googleLoading}
        />
      </View>
    </SafeAreaView>
  );
}
