import { SVGProps } from "react";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "stroke"> {
  size?: number;
  sw?: number;
  color?: string;
}

function Svg({ size = 16, sw = 1.8, color = "currentColor", children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Mic: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </Svg>
  ),
  Home: (p: IconProps) => (
    <Svg {...p}>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </Svg>
  ),
  Clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  User: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Svg>
  ),
  ThumbsUp: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 10v11" />
      <path d="M15 6.5 14 10h5.2a2 2 0 0 1 1.94 2.49l-1.6 6.4A2 2 0 0 1 17.6 20.4H7" />
      <path d="M7 10H4.5A1.5 1.5 0 0 0 3 11.5v8A1.5 1.5 0 0 0 4.5 21H7" />
      <path d="M14 10V5.5A2.5 2.5 0 0 0 11.5 3L8 10" />
    </Svg>
  ),
  ThumbsDown: (p: IconProps) => (
    <Svg {...p}>
      <path d="M17 14V3" />
      <path d="M9 17.5 10 14H4.8a2 2 0 0 1-1.94-2.49l1.6-6.4A2 2 0 0 1 6.4 3.6H17" />
      <path d="M17 14h2.5a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 19.5 3H17" />
      <path d="M10 14v4.5a2.5 2.5 0 0 0 2.5 2.5L16 14" />
    </Svg>
  ),
  Sparkle: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </Svg>
  ),
  Message: (p: IconProps) => (
    <Svg {...p}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.4-5A8 8 0 1 1 21 12z" />
    </Svg>
  ),
  People: (p: IconProps) => (
    <Svg {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  Lightbulb: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.74V16h8v-1.26A7 7 0 0 0 12 2z" />
    </Svg>
  ),
  Scale: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3v18" />
      <path d="M5 6h14" />
      <path d="m6 6-4 7h8L6 6z" />
      <path d="m18 6-4 7h8l-4-7z" />
    </Svg>
  ),
  Shield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  ),
  Leaf: (p: IconProps) => (
    <Svg {...p}>
      <path d="M11 20A7 7 0 0 1 4 13c0-6 8-10 16-9-1 8-5 16-11 16z" />
      <path d="M4 21c4-5 8-8 14-11" />
    </Svg>
  ),
  ArrowRight: (p: IconProps) => (
    <Svg {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Svg>
  ),
  ArrowLeft: (p: IconProps) => (
    <Svg {...p}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <polyline points="5 13 10 18 19 7" />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  ),
  X: (p: IconProps) => (
    <Svg {...p}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </Svg>
  ),
  Warn: (p: IconProps) => (
    <Svg {...p}>
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  ),
};
