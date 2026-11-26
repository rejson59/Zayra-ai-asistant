import { motion } from 'motion/react';
import { CONCEPTS, type ConceptId } from '../visualizers';

interface Props {
  value: ConceptId;
  onChange: (id: ConceptId) => void;
}

/** Przełącznik koncepcji wizualizacji — pigułka z sprężynowym wskaźnikiem. */
export function ConceptDock({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Koncepcje wizualizacji"
      className="flex items-center gap-1 rounded-full border border-line bg-surface p-1"
    >
      {CONCEPTS.map((c) => {
        const active = c.id === value;
        const Icon = c.icon;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c.id)}
            className={`relative flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors duration-300 sm:px-4 ${
              active ? 'text-ink' : 'text-dim hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId="concept-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-full bg-surface2"
              />
            )}
            <Icon
              size={15}
              strokeWidth={2}
              className={`relative z-10 ${active ? 'text-accent' : ''}`}
            />
            <span className="relative z-10 hidden sm:inline">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
