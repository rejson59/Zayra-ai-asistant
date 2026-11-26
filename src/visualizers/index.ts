import { AlignJustify, AudioLines, Grip, Waves, type LucideIcon } from 'lucide-react';
import { drawRibbon } from './ribbon';
import { createBars } from './bars';
import { drawStrings } from './strings';
import { drawDots } from './dots';
import type { DrawFn } from './util';

export type ConceptId = 'ribbon' | 'bars' | 'strings' | 'dots';

export interface Concept {
  id: ConceptId;
  label: string;
  hint: string;
  icon: LucideIcon;
  draw: DrawFn;
}

export const CONCEPTS: Concept[] = [
  { id: 'ribbon', label: 'Wstęga', hint: 'Płynące warstwy linii', icon: Waves, draw: drawRibbon },
  { id: 'bars', label: 'Słupki', hint: 'Fala płynąca przez pigułki', icon: AudioLines, draw: createBars() },
  { id: 'strings', label: 'Struny', hint: 'Drgające struny instrumentu', icon: AlignJustify, draw: drawStrings },
  { id: 'dots', label: 'Kropki', hint: 'Jedwabna siatka punktów', icon: Grip, draw: drawDots },
];

export const conceptById = (id: ConceptId) => CONCEPTS.find((c) => c.id === id)!;
