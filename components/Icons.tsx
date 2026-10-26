type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const MicIcon = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v3.5M8.5 21.5h7" />
  </svg>
);

export const StopIcon = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const SpeakerIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M4 9.5h3L12 5.5v13L7 14.5H4z" />
    <path d="M16 9a4.2 4.2 0 0 1 0 6" />
    <path d="M18.6 6.4a7.6 7.6 0 0 1 0 11.2" />
  </svg>
);

export const MutedIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M4 9.5h3L12 5.5v13L7 14.5H4z" />
    <path d="M16.5 9.5l4 5M20.5 9.5l-4 5" />
  </svg>
);

export const SendIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M21 3L10.5 13.5" />
    <path d="M21 3l-6.6 18-3.9-7.5L3 9.6z" />
  </svg>
);

export const SettingsIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.4 14.4a7.6 7.6 0 0 0 0-4.8l2-1.2-2-3.4-2 1.1a7.6 7.6 0 0 0-4.1-2.4L13 1.5h-2l-.3 2.2A7.6 7.6 0 0 0 6.6 6L4.6 4.9l-2 3.4 1.9 1.2a7.6 7.6 0 0 0 0 4.8l-1.9 1.3 2 3.4 2-1.2a7.6 7.6 0 0 0 4.1 2.4l.3 2.3h2l.3-2.3a7.6 7.6 0 0 0 4.1-2.4l2 1.2 2-3.4z" />
  </svg>
);

export const PlusIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CloseIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const SparkIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8z" />
    <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </svg>
);

export const DownloadIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" />
    <path d="M4 19.5h16" />
  </svg>
);

export const TrashIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    <path d="M10.5 11v5M13.5 11v5" />
  </svg>
);

export const BrainIcon = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className} aria-hidden>
    <path d="M9.5 4.5A3 3 0 0 0 6.5 7a2.8 2.8 0 0 0-1.5 5 2.9 2.9 0 0 0 1.7 4.9A3 3 0 0 0 12 19V5.6a2.9 2.9 0 0 0-2.5-1.1z" />
    <path d="M14.5 4.5A3 3 0 0 1 17.5 7a2.8 2.8 0 0 1 1.5 5 2.9 2.9 0 0 1-1.7 4.9A3 3 0 0 1 12 19" />
  </svg>
);
