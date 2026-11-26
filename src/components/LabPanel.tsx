import { AudioLines, Circle, Mic, Play, Sparkles } from 'lucide-react';
import type { VoiceState } from '../engine/sim';
import { IconButton } from './IconButton';

interface Props {
  state: VoiceState;
  onForce: (s: VoiceState) => void;
  onDemo: () => void;
}

/** Podgląd stanów — wymusza stan albo odtwarza całą sekwencję rozmowy. */
export function LabPanel({ state, onForce, onDemo }: Props) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-1">
      <IconButton label="Demo rozmowy" size="sm" variant="ghost" onClick={onDemo}>
        <Play size={15} />
      </IconButton>
      <span className="mx-1 h-4 w-px bg-line" />
      <IconButton
        label="Gotowa"
        size="sm"
        variant="ghost"
        active={state === 'idle'}
        onClick={() => onForce('idle')}
      >
        <Circle size={14} />
      </IconButton>
      <IconButton
        label="Słucham"
        size="sm"
        variant="ghost"
        active={state === 'listening'}
        onClick={() => onForce('listening')}
      >
        <Mic size={15} />
      </IconButton>
      <IconButton
        label="Myślę"
        size="sm"
        variant="ghost"
        active={state === 'thinking'}
        onClick={() => onForce('thinking')}
      >
        <Sparkles size={15} />
      </IconButton>
      <IconButton
        label="Mówię"
        size="sm"
        variant="ghost"
        active={state === 'speaking'}
        onClick={() => onForce('speaking')}
      >
        <AudioLines size={15} />
      </IconButton>
    </div>
  );
}
