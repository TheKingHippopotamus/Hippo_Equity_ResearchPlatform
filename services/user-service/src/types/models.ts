// User Preferences Model
export interface UserPreferences {
  userId: string;
  language: string;
  theme?: 'light' | 'dark';
  notificationsEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Database row type
export interface UserPreferencesRow {
  id: string;
  user_id: string;
  language: string;
  theme: string | null;
  notifications_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

