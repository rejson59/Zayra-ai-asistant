import { AnimatePresence, motion } from 'motion/react';
import { AudioLines, Circle, Mic, Sparkles, type LucideIcon } from 'lucide-react';
import type { VoiceState } from '../engine/sim';

const META: Record<VoiceState, { label: string; icon: LucideIcon }> = {
  idle: { label: 'Gotowa', icon: Circle },
  listening: { label: 'Słucham', icon: Mic },
  thinking: { label: 'Myślę', icon: Sparkles },
  speaking: { label: 'Mówię', icon: AudioLines },
};

export function StatusPill({ state }: { state: VoiceState }) {
  const { label, icon: Icon } = META[state];
  return (
    <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-4">
      <Icon
        size={15}
        strokeWidth={2}
        className={state === 'idle' ? 'text-dim' : 'text-accent'}
      />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="text-[12.5px] font-semibold text-ink"
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
