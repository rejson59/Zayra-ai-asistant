import { motion } from 'motion/react';
import { Mic } from 'lucide-react';
import type { VoiceState } from '../engine/sim';

interface Props {
  state: VoiceState;
  onClick: () => void;
}

export function MicButton({ state, onClick }: Props) {
  const listening = state === 'listening';
  const speaking = state === 'speaking';

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      onClick={onClick}
      aria-label={listening ? 'Zakończ słuchanie' : 'Rozpocznij rozmowę'}
      className={`relative grid h-[72px] w-[72px] cursor-pointer place-items-center rounded-full border transition-colors duration-300 ${
        listening
          ? 'border-transparent bg-accent text-on-accent'
          : speaking
            ? 'border-accent/45 bg-surface text-accent'
            : 'border-line bg-surface text-ink hover:border-accent/50'
      }`}
    >
      {listening && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-accent"
          animate={{ scale: [1, 1.28], opacity: [0.55, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <Mic size={26} strokeWidth={listening ? 2.2 : 1.8} />
    </motion.button>
  );
}
