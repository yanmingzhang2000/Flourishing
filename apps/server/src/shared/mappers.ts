/**
 * DB row → contract shape mappers shared by the auth and users modules.
 *
 * Contract shapes (packages/contracts user.ts) use ISO-8601 strings for
 * timestamps; DB rows store epoch integers (ms) or JSON columns. All
 * normalization happens here so no route hand-rolls conversions.
 */

import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  type Profile,
  type User,
} from '@flourish/contracts';
import type { userProfiles, users } from '../db/schema';

type UserRow = typeof users.$inferSelect;
type ProfileRow = typeof userProfiles.$inferSelect;

export function toUserContract(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export function toProfileContract(row: ProfileRow): Profile {
  return {
    userId: row.userId,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    age: row.age,
    experienceLevel: row.experienceLevel as Profile['experienceLevel'],
    targetMinutesPerSession: row.targetMinutesPerSession,
    targetSessionsPerWeek: row.targetSessionsPerWeek,
    injuries: row.injuries ?? [],
    availableEquipment: row.availableEquipment ?? [...DEFAULT_AVAILABLE_EQUIPMENT],
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
