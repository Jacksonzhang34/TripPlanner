import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithEmail(email: string) {
  const redirectTo = Linking.createURL('auth-callback');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('auth-callback');

  if (Platform.OS === 'web') {
    // Full-page redirect: Google's login page sends a Cross-Origin-Opener-Policy
    // header that severs a popup's connection back to the window that opened it,
    // which breaks the WebBrowser popup + postMessage relay used below on native.
    // A same-window redirect sidesteps that entirely and lands back on
    // (auth)/auth-callback.tsx, which does the actual code exchange.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await exchangeCodeFromUrl(result.url);
  }
}

export async function exchangeCodeFromUrl(url: string) {
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
