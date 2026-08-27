import { Link } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';
import { useTrips } from '@/features/trips/hooks';

export default function TripList() {
  const { session } = useAuth();
  const { data: trips, isLoading } = useTrips();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <View className="flex-row items-center justify-between px-6 pt-4">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Your trips</Text>
        <Link href="/join" asChild>
          <Button label="Join" variant="secondary" />
        </Link>
      </View>

      {isLoading ? null : trips && trips.length > 0 ? (
        <FlatList
          data={trips}
          keyExtractor={(trip) => trip.id}
          contentContainerClassName="gap-3 px-6 py-4"
          renderItem={({ item }) => (
            <Link href={`/trips/${item.id}`} asChild>
              <View className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{item.name}</Text>
                {item.destination ? (
                  <Text className="text-neutral-500">{item.destination}</Text>
                ) : null}
              </View>
            </Link>
          )}
        />
      ) : (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">No trips yet</Text>
          <Text className="text-center text-neutral-500">Signed in as {session?.user.email}</Text>
        </View>
      )}

      <View className="gap-3 px-6 pb-4">
        <Link href="/trips/new" asChild>
          <Button label="New Trip" />
        </Link>
        <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
      </View>
    </SafeAreaView>
  );
}
