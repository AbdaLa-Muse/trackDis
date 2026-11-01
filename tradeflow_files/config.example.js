window.TRADEFLOW_CONFIG = {
  // Public project URL from Supabase Project Settings > API.
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',

  // Browser-safe publishable key. Never put a secret/service-role key here.
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_REPLACE_ME',

  AUTH_FUNCTION: 'tradeflow-auth',
  API_FUNCTION: 'tradeflow-api',

  // Client-side convenience lock. The server token also expires separately.
  AUTO_LOCK_MINUTES: 30
}
