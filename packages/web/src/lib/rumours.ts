import { rumoursFor, type GameState, type Rumour } from '@sdr/engine';

export type { Rumour };

/**
 * What they are saying in the Saloon (GDD §9). ⚠️ **v3 Phase L1: the rumours are the engine's now**
 * (`rumoursFor`, output unchanged — the reasoning moved with it). A rumour reads the seed and the
 * calendar two weeks out, which an online seat's view does not hold; the room puts the seat's list on
 * the view instead. Hotseat holds the whole state and works it out here, exactly as before.
 */
export function rumours(s: GameState): Rumour[] {
  return s.rumours ?? rumoursFor(s);
}
