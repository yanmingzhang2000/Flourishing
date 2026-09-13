import { UserProfile, WeeklyPlan, TrainingRecord, UserStats } from './types';

const KEYS = {
  USER_PROFILE: 'fitness_user_profile',
  WEEKLY_PLAN: 'fitness_weekly_plan',
  TRAINING_RECORDS: 'fitness_training_records',
  USER_STATS: 'fitness_user_stats',
};

export const storage = {
  getUserProfile: (): UserProfile | null => {
    const data = localStorage.getItem(KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : null;
  },

  setUserProfile: (profile: UserProfile): void => {
    localStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
  },

  getWeeklyPlan: (): WeeklyPlan | null => {
    const data = localStorage.getItem(KEYS.WEEKLY_PLAN);
    return data ? JSON.parse(data) : null;
  },

  setWeeklyPlan: (plan: WeeklyPlan): void => {
    localStorage.setItem(KEYS.WEEKLY_PLAN, JSON.stringify(plan));
  },

  getTrainingRecords: (): TrainingRecord[] => {
    const data = localStorage.getItem(KEYS.TRAINING_RECORDS);
    return data ? JSON.parse(data) : [];
  },

  addTrainingRecord: (record: TrainingRecord): void => {
    const records = storage.getTrainingRecords();
    const existingIndex = records.findIndex(r => r.date === record.date);
    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.push(record);
    }
    localStorage.setItem(KEYS.TRAINING_RECORDS, JSON.stringify(records));
  },

  getUserStats: (): UserStats => {
    const data = localStorage.getItem(KEYS.USER_STATS);
    if (data) {
      return JSON.parse(data);
    }
    return {
      totalWorkouts: 0,
      currentStreak: 0,
      longestStreak: 0,
      completedDays: [],
    };
  },

  updateUserStats: (stats: UserStats): void => {
    localStorage.setItem(KEYS.USER_STATS, JSON.stringify(stats));
  },

  clearAll: (): void => {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
  },
};