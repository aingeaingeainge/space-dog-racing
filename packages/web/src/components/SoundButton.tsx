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
      <SpeakerIcon on={on} />
      <span className="vh-narrow">{on ? 'Sound on' : 'Sound off'}</span>
    </NeonButton>
  );
}

/** A speaker, with waves when the sound is on and a cross when it is off. Drawn in currentColor. */
function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg className="nb-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
      {on ? (
        <path
          d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6 6 0 0 1 0 8.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M11 6l4 4M15 6l-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
