import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type ButtonProps = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
};

export function Button({ label, variant = 'primary', loading, disabled, ...props }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      className={`items-center justify-center rounded-xl px-5 py-3 ${
        isPrimary
          ? 'bg-primary-500 active:bg-primary-600'
          : 'bg-neutral-100 active:bg-neutral-200 dark:bg-neutral-800'
      } ${isDisabled ? 'opacity-50' : ''}`}
      {...props}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : '#332D25'} />
      ) : (
        <Text
          className={`text-base font-semibold ${
            isPrimary ? 'text-white' : 'text-neutral-800 dark:text-neutral-100'
          }`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
