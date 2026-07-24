/**
 * XP Progression Utilities (Frontend)
 * 
 * Formula: XP required to reach level L = 50 * L * (L - 1)
 * Quadratic growth: L1→L2: 100, L2→L3: 200, L3→L4: 300, ...
 */

export function getXPForLevel(level) {
  if (level <= 1) return 0;
  return 50 * level * (level - 1);
}

export function getLevelFromXP(totalXP) {
  if (totalXP <= 0) return 1;
  const level = Math.floor((50 + Math.sqrt(2500 + 200 * totalXP)) / 100);
  return Math.max(1, level);
}

export function getXPProgress(totalXP) {
  const currentLevel = getLevelFromXP(totalXP);
  const currentLevelXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  const xpInCurrentLevel = totalXP - currentLevelXP;
  const xpRequiredForNextLevel = nextLevelXP - currentLevelXP;
  const xpRemaining = nextLevelXP - totalXP;
  const percentage = xpRequiredForNextLevel > 0
    ? Math.min(100, Math.round((xpInCurrentLevel / xpRequiredForNextLevel) * 100))
    : 100;
  return {
    currentLevel,
    totalXP,
    currentLevelXP,
    nextLevelXP,
    xpInCurrentLevel,
    xpRequiredForNextLevel,
    xpRemaining,
    percentage
  };
}
