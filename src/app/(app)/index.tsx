import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';

export default function TripList() {
  const { session } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">No trips yet</Text>
        <Text className="text-center text-neutral-500">Signed in as {session?.user.email}</Text>
        <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
      </View>
    </SafeAreaView>
  );
}
