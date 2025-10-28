import { createClient } from '@supabase/supabase-js';

// Force the correct URL - ignore any environment variables
const supabaseUrl = 'https://noqfwkxzmvpkorcaymcb.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcWZ3a3h6bXZwa29yY2F5bWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTgzMTgsImV4cCI6MjA2MDk5NDMxOH0.LNozVpUNhbNR09WGCb79vKgUnrtflG2bEwPKQO7Q1oM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: '10',
    },
  },
}); 