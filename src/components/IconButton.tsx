import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: 'md' | 'sm';
  variant?: 'solid' | 'ghost';
}

/** Ikona zamiast etykiety — nazwa pojawia się dopiero w tooltipie. */
export function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  size = 'md',
  variant = 'solid',
}: Props) {
  const [hover, setHover] = useState(false);

  const base =
    size === 'md' ? 'h-11 w-11' : 'h-9 w-9';
  const skin =
    variant === 'ghost'
      ? active
        ? 'bg-accent-soft text-accent'
        : 'text-dim hover:text-ink hover:bg-surface2'
      : active
        ? 'border border-accent/40 bg-accent-soft text-accent'
        : 'border border-line bg-surface text-dim hover:text-ink hover:border-ink/25';

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`grid cursor-pointer place-items-center rounded-full transition-colors duration-300 disabled:cursor-default disabled:opacity-35 ${base} ${skin}`}
      >
        {children}
      </motion.button>
      <AnimatePresence>
        {hover && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold whitespace-nowrap text-ink shadow-sm"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
