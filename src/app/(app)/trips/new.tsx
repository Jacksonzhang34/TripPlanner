import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { useCreateTrip } from '@/features/trips/hooks';

export default function NewTrip() {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const createTrip = useCreateTrip();

  function handleDayPress(day: DateData) {
    if (!startDate || (startDate && endDate)) {
      setStartDate(day.dateString);
      setEndDate(null);
    } else if (day.dateString < startDate) {
      setStartDate(day.dateString);
    } else {
      setEndDate(day.dateString);
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const trip = await createTrip.mutateAsync({
        name: name.trim(),
        destination: destination.trim() || null,
        start_date: startDate,
        end_date: endDate,
      });
      router.replace(`/trips/${trip.id}`);
    } catch (err) {
      Alert.alert('Could not create trip', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  const markedDates =
    startDate && endDate
      ? { [startDate]: { startingDay: true, color: '#D97757' }, [endDate]: { endingDay: true, color: '#D97757' } }
      : startDate
        ? { [startDate]: { startingDay: true, endingDay: true, color: '#D97757' } }
        : {};

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <View className="gap-4 px-6 pt-4">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">New trip</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Trip name"
          placeholderTextColor="#8A7E6E"
          className="rounded-xl border border-neutral-200 px-4 py-3 text-base text-neutral-900 dark:border-neutral-700 dark:text-neutral-50"
        />
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="Destination (optional)"
          placeholderTextColor="#8A7E6E"
          className="rounded-xl border border-neutral-200 px-4 py-3 text-base text-neutral-900 dark:border-neutral-700 dark:text-neutral-50"
        />
        <Calendar markingType="period" markedDates={markedDates} onDayPress={handleDayPress} />
        <Button
          label="Create trip"
          onPress={handleCreate}
          loading={createTrip.isPending}
          disabled={!name.trim()}
        />
      </View>
    </SafeAreaView>
  );
}
