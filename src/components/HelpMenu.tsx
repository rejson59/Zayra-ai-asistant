import { AnimatePresence, motion } from 'motion/react';
import { CircleHelp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from './IconButton';

const SHORTCUTS: Array<[string, string]> = [
  ['Spacja', 'Rozmowa / przerwanie'],
  ['T', 'Motyw jasny / ciemny'],
  ['C', 'Napisy na żywo'],
  ['Esc', 'Zatrzymaj'],
];

export function HelpMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <IconButton label="Skróty klawiszowe" active={open} onClick={() => setOpen((o) => !o)}>
        <CircleHelp size={18} />
      </IconButton>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="absolute top-13 right-0 z-40 w-64 rounded-3xl border border-line bg-surface p-4 shadow-xl shadow-black/10"
            >
              <div className="flex flex-col gap-2.5">
                {SHORTCUTS.map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-medium text-dim">{desc}</span>
                    <kbd className="rounded-lg border border-line bg-surface2 px-2 py-0.5 text-[11px] font-bold text-ink">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
