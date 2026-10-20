import { NeonButton } from './NeonButton';
import { toggleSound, useSoundOn } from '../lib/sound';

/** v3 Phase R: the sound switch, in the top bar and on race day (key: V). */
export function SoundButton() {
  const on = useSoundOn();
  return (
    <NeonButton
      small
      onClick={toggleSound}
      aria-pressed={on}
      title={
        on
          ? 'Sound is on — press to mute (key: V)'
          : 'Sound is off — press to hear the track (key: V)'
      }
    >
      {on ? 'Sound on' : 'Sound off'}
    </NeonButton>
  );
}
