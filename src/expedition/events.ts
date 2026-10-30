/**
 * Space events: a surprise between waypoints that the crew votes its way through. Each
 * choice rolls one result: hull damage or repairs, a points multiplier or a longer / shorter
 * answer window for the next Knowledge Gate. Risky choices pay more on average than safe ones.
 * No imports: scripts/tts-expedition.mjs loads this file to voice the lines.
 */

export interface EventResult {
  /** probability within the option (they sum to 1) */
  p: number;
  /** shown and spoken */
  say: string;
  /** hull change, percentage points */
  hull?: number;
  /** points multiplier for the next gate */
  mult?: number;
  /** seconds added to (or taken from) the next gate's answer window */
  time?: number;
}

export interface SpaceEventOption { id: string; label: string; hint: string; results: EventResult[] }
export interface SpaceEvent { id: string; title: string; intro: string; options: SpaceEventOption[] }

export const EVENTS: SpaceEvent[] = [
  {
    id: 'asteroids', title: 'Asteroid field ahead!',
    intro: 'Asteroid field ahead! Crew, do we thread the gap, or take the long way around?',
    options: [
      { id: 'gap', label: 'Thread the gap', hint: 'Fast and risky', results: [
        { p: 0.6, say: 'Perfect piloting! We slipped through untouched. Daring bonus: one and a half times the points on the next gate!', mult: 1.5 },
        { p: 0.4, say: 'Ouch! A boulder clipped the hull. Damage taken!', hull: -20 },
      ] },
      { id: 'around', label: 'Take the long way', hint: 'Safe but slow', results: [
        { p: 1, say: 'Safe and sound, but the detour cost us time. Ten seconds less on the next question!', time: -10 },
      ] },
    ],
  },
  {
    id: 'flare', title: 'Solar flare!',
    intro: 'Solar flare incoming! Do we raise the shields, or ride the particle wave?',
    options: [
      { id: 'shields', label: 'Raise the shields', hint: 'A little scorched', results: [
        { p: 1, say: 'Shields held! A little scorched, but we are fine.', hull: -5 },
      ] },
      { id: 'ride', label: 'Ride the wave', hint: 'All or nothing', results: [
        { p: 0.5, say: 'What a ride! The flare supercharged our sensors: double points on the next gate!', mult: 2 },
        { p: 0.5, say: 'Too hot! Radiation fried a solar panel. Hull damage!', hull: -25 },
      ] },
    ],
  },
  {
    id: 'probe', title: 'Derelict probe',
    intro: 'We found an old space probe drifting in the dark. Salvage it for parts, or scan it and fly on?',
    options: [
      { id: 'salvage', label: 'Salvage it', hint: 'Spare parts… maybe', results: [
        { p: 0.65, say: 'Jackpot! Spare parts on board. Hull repaired!', hull: 20 },
        { p: 0.35, say: 'Careful! Its old battery sparked. Minor damage!', hull: -10 },
      ] },
      { id: 'scan', label: 'Scan and fly on', hint: 'Science first', results: [
        { p: 1, say: 'Scan complete! Fresh science data: one and a half times the points on the next gate!', mult: 1.5 },
      ] },
    ],
  },
  {
    id: 'comet', title: 'Comet crossing',
    intro: "A comet's tail is crossing our path! Collect some ice, or fly straight through for science?",
    options: [
      { id: 'ice', label: 'Collect ice', hint: 'Coolant for repairs', results: [
        { p: 1, say: 'Ice on board! We melted it into coolant and patched the hull.', hull: 15 },
      ] },
      { id: 'through', label: 'Fly through the tail', hint: 'Dusty science', results: [
        { p: 0.7, say: "Amazing readings from the comet's dust! One and a half times the points on the next gate!", mult: 1.5 },
        { p: 0.3, say: 'Dust storm! Tiny grains sandblasted the hull.', hull: -15 },
      ] },
    ],
  },
  {
    id: 'leak', title: 'Fuel leak!',
    intro: 'Warning! Fuel leak detected! Patch it now, or push on and hope it holds?',
    options: [
      { id: 'patch', label: 'Patch it now', hint: 'Costs time', results: [
        { p: 1, say: 'Leak patched! The repair took a while: ten seconds less on the next question.', time: -10 },
      ] },
      { id: 'push', label: 'Push on', hint: 'Fingers crossed', results: [
        { p: 0.5, say: 'It held! Full speed ahead, and fifteen extra seconds on the next question!', time: 15 },
        { p: 0.5, say: "It didn't hold! Hull damage, crew!", hull: -20 },
      ] },
    ],
  },
  {
    id: 'signal', title: 'Mystery signal',
    intro: "We're picking up a strange radio signal! Do we investigate, or stay on course?",
    options: [
      { id: 'investigate', label: 'Investigate', hint: 'Could be anything', results: [
        { p: 0.6, say: "It's a pulsar, a spinning dead star ticking like a cosmic clock! Science bonus: double points on the next gate!", mult: 2 },
        { p: 0.4, say: 'Just interference from our own radio. We lost time: ten seconds less on the next question.', time: -10 },
      ] },
      { id: 'course', label: 'Stay on course', hint: 'Steady', results: [
        { p: 1, say: 'Steady as she goes. Fifteen extra seconds on the next question!', time: 15 },
      ] },
    ],
  },
];

/** The spoken intro without its opening line when that line is the title (the card shows both). */
export function eventText(e: SpaceEvent): string {
  return e.intro.startsWith(e.title) ? e.intro.slice(e.title.length).trim() : e.intro;
}

export function rollResult(o: SpaceEventOption, r = Math.random()): EventResult {
  for (const x of o.results) { if (r < x.p) return x; r -= x.p; }
  return o.results[o.results.length - 1];
}

/** "Hull −20%", "Next gate ×1.5 points", "Next question +15 s" */
export function effectLabel(x: EventResult): string {
  const parts: string[] = [];
  if (x.hull) parts.push(`Hull ${x.hull > 0 ? '+' : '−'}${Math.abs(x.hull)}%`);
  if (x.mult) parts.push(`Next gate ×${x.mult} points`);
  if (x.time) parts.push(`Next question ${x.time > 0 ? '+' : '−'}${Math.abs(x.time)} s`);
  return parts.join(' · ');
}
