/**
 * Narrator lines for Streamer Mode. The clips are pre-rendered by scripts/tts-expedition.mjs
 * into public/expedition/voice/<key>.mp3, where the key is a hash of the exact text, so the
 * script and the cockpit agree on file names without a manifest and an edited line simply
 * gets a new clip. No imports: the Node script loads this file directly.
 */

export const VOICE_DIR = '/expedition/voice/';
export const VOICE_ID = 'eve';

/** FNV-1a, 32 bit, hex */
export function voiceKey(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const spoken = (title: string): string => title.replace(/\s+—\s+Home$/, '');
const ORD = ['one', 'two', 'three'];

export const CALL = {
  voteOpen: 'Route vote! Crew, where do we go next? Cast your votes now!',
  voteClosed: 'The votes are in!',
  voteTie: "It's a tie! Your host breaks it.",
  engines: 'Engines on! Next waypoint coming up.',
  enginesBoard: "Engines on! Let's check the leaderboard.",
  lock: "Time's up! Answers locked.",
  tenLeft: 'Ten seconds left!',
  pass: 'Gate cleared! Engines unlocked!',
  failAccuracy: 'Not quite, crew. The engines stay locked. Let\u2019s try another question!',
  failQuorum: 'Not enough answers to power the engines. We need more crew on deck!',
  override: 'Emergency override engaged!',
  finalApproach: 'All three gates open. Final approach!',
  practiceStart: "Practice run! Let's warm up right here at home.",
  practiceDone: 'Practice run complete. This crew is ready for the real thing!',
  bossIntro: 'Boss gate! Double points, and the crew needs sixty percent correct to break through!',
  bossFail: 'The boss gate held, and the ship took a hit!',
  hullBreach: "Hull breach! Emergency repairs. We're heading back to the start of this route!",
  eventVoteClosed: 'Decision made! Here we go!',
} as const;

export const destinationLine = (title: string): string => `New destination: ${spoken(title)}!`;
export const discoveredLine = (title: string): string => `${spoken(title)} discovered! Outstanding work, crew!`;
export const gateLine = (gate: number, name: string): string => `Waypoint reached! Knowledge Gate ${ORD[gate]} ahead: ${name}.`;
