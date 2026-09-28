import { UserProfile, WeeklyPlan, TrainingRecord, UserStats, ProjectInstance } from './types';

const KEYS = {
  USER_PROFILE: 'fitness_user_profile',
  WEEKLY_PLAN: 'fitness_weekly_plan',
  TRAINING_RECORDS: 'fitness_training_records',
  USER_STATS: 'fitness_user_stats',
  PROJECT_PLANS: 'fitness_project_plans',
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

  // Project Instance methods
  addProjectInstance: (instance: ProjectInstance): void => {
    const profile = storage.getUserProfile();
    if (profile) {
      profile.projectInstances.push(instance);
      storage.setUserProfile(profile);
    }
  },

  updateProjectInstance: (instanceId: string, updates: Partial<ProjectInstance>): void => {
    const profile = storage.getUserProfile();
    if (profile) {
      const index = profile.projectInstances.findIndex(p => p.id === instanceId);
      if (index >= 0) {
        profile.projectInstances[index] = { ...profile.projectInstances[index], ...updates };
        storage.setUserProfile(profile);
      }
    }
  },

  getProjectInstance: (instanceId: string): ProjectInstance | null => {
    const profile = storage.getUserProfile();
    return profile?.projectInstances.find(p => p.id === instanceId) ?? null;
  },

  getActiveProjectInstances: (): ProjectInstance[] => {
    const profile = storage.getUserProfile();
    return profile?.projectInstances.filter(p => p.status === 'active') ?? [];
  },

  // Per-project weekly plan methods
  getProjectWeeklyPlan: (projectId: string): WeeklyPlan | null => {
    const data = localStorage.getItem(`${KEYS.PROJECT_PLANS}_${projectId}`);
    return data ? JSON.parse(data) : null;
  },

  setProjectWeeklyPlan: (projectId: string, plan: WeeklyPlan): void => {
    localStorage.setItem(`${KEYS.PROJECT_PLANS}_${projectId}`, JSON.stringify(plan));
  },

  // Training records per project
  getProjectTrainingRecords: (projectId: string): TrainingRecord[] => {
    const data = localStorage.getItem(`${KEYS.TRAINING_RECORDS}_${projectId}`);
    return data ? JSON.parse(data) : [];
  },

  addProjectTrainingRecord: (projectId: string, record: TrainingRecord): void => {
    const records = storage.getProjectTrainingRecords(projectId);
    const existingIndex = records.findIndex(r => r.date === record.date);
    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.push(record);
    }
    localStorage.setItem(`${KEYS.TRAINING_RECORDS}_${projectId}`, JSON.stringify(records));
  },

  // Migrate legacy data to new structure
  migrateLegacyData: (): void => {
    const profile = storage.getUserProfile();
    if (profile && !profile.projectInstances) {
      // Migrate selectedProjects to projectInstances
      const instances: ProjectInstance[] = (profile.selectedProjects || []).map((projectId, index) => ({
        id: `legacy_${projectId}_${Date.now()}_${index}`,
        projectId,
        status: 'active' as const,
        startDate: new Date().toISOString().split('T')[0],
        targetWeeks: 6 as const,
        currentWeek: 1,
        trainingDaysPerWeek: profile.maxTrainingDaysPerWeek || 3,
        sessionMinutes: profile.singleSessionMaxMin || 30,
        createdAt: new Date().toISOString(),
      }));
      
      profile.projectInstances = instances;
      profile.onboardingCompleted = true;
      storage.setUserProfile(profile);
    }
  },

  clearAll: (): void => {
    Object.values(KEYS).forEach(key => {
      // Also clear per-project keys
      const keysToRemove = localStorage.keys ? 
        Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(k => k?.startsWith(key)) : 
        [key];
      keysToRemove.forEach(k => k && localStorage.removeItem(k));
    });
    // Clear all fitness-related keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('fitness_')) {
        localStorage.removeItem(key);
      }
    }
  },
};