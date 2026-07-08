/** API publik engine gamifikasi profil. */
export { isProfileGamificationEnabled } from "./flag";
export {
  cumXp,
  levelFromXp,
  levelProgress,
  MAX_LEVEL,
  xpForLevel,
} from "./level";
export { streakMultiplier } from "./streak";
export { grantXp, recomputeProgression, type GrantResult } from "./grant";
export { onVerifiedCheckIn, type CheckInResult } from "./attendance-xp";
export { isTaskOnTime, onTaskDone } from "./task-xp";
export {
  evaluateAchievements,
  evaluateCriteria,
  gatherAchievementFacts,
  type AchievementFacts,
} from "./achievements";
export { runFreshnessGrants } from "./freshness-xp";
export { reconcileGamification, type ReconcileResult } from "./reconcile";
