// Scoring for Echo Tower. Deliberately vague to the player: quicker, tidier
// solves score a little higher, but we never show moves or time directly.
// Tune the constants freely — nothing else depends on them.

export function floorScore(moves, seconds) {
  const gain = 1000 - moves * 10 - Math.round(seconds) * 5;
  // Always a satisfying round number, never punishingly low.
  return Math.max(150, Math.round(gain / 10) * 10);
}
