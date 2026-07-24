/**
 * XP Progression System
 * 
 * Formula: XP required to reach level L = 50 * L * (L - 1)
 * 
 * This produces a quadratic growth curve:
 *   Level 1  →    0 XP
 *   Level 2  →  100 XP
 *   Level 3  →  300 XP
 *   Level 4  →  600 XP
 *   Level 5  → 1000 XP
 *   ...
 * 
 * Each level requires 100 more XP than the previous gap:
 *   L1→L2: 100, L2→L3: 200, L3→L4: 300, L4→L5: 400, ...
 */

/**
 * Get the total XP required to reach a given level.
 * @param {number} level - The level (1-based)
 * @returns {number} Total cumulative XP needed to reach this level
 */
function getXPForLevel(level) {
  if (level <= 1) return 0;
  return 50 * level * (level - 1);
}

/**
 * Determine the user's current level from their total XP.
 * Solves: 50 * L * (L-1) <= totalXP  →  L = floor((1 + sqrt(1 + totalXP/12.5)) / 2)
 * @param {number} totalXP - The user's total accumulated XP
 * @returns {number} The current level (minimum 1)
 */
function getLevelFromXP(totalXP) {
  if (totalXP <= 0) return 1;
  // Solve quadratic: 50L^2 - 50L - totalXP = 0
  // L = (50 + sqrt(2500 + 200*totalXP)) / 100
  const level = Math.floor((50 + Math.sqrt(2500 + 200 * totalXP)) / 100);
  return Math.max(1, level);
}

/**
 * Get detailed XP progress information for a user.
 * @param {number} totalXP - The user's total accumulated XP
 * @returns {Object} Progress details
 */
function getXPProgress(totalXP) {
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
    currentLevelXP,       // XP threshold for current level
    nextLevelXP,          // XP threshold for next level
    xpInCurrentLevel,     // XP earned within current level
    xpRequiredForNextLevel, // Total XP needed to go from current to next level
    xpRemaining,          // XP still needed to reach next level
    percentage            // Progress percentage (0-100)
  };
}

module.exports = { getXPForLevel, getLevelFromXP, getXPProgress };
