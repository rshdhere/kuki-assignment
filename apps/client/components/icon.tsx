import type { ReactNode, SVGProps } from "react";

// Lucide icon paths, drawn at 2px stroke in the current text colour.
const paths = {
  doc: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </>
  ),
  message: (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  flask: (
    <path d="M10 2v7.31L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.31V2M8.5 2h7M7 16h10" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  upload: (
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  ),
  chevrons: <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />,
  panel: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  loader: <path d="M21 12a9 9 0 1 1-6.22-8.56" />,
  "minus-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </>
  ),
  "plus-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8M12 8v8" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  external: <path d="M7 7h10v10M7 17 17 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  dots: (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>
  ),
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="14" height="14" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>
  ),
  "arrow-up": <path d="m5 12 7-7 7 7M12 19V5" />,
  "arrow-right": <path d="M5 12h14M12 5l7 7-7 7" />,
  "arrow-up-right": <path d="M7 17 17 7M7 7h10v10" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths | "play";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "stroke"> {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 16, color, ...rest }: IconProps) {
  if (name === "play") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={color ?? "currentColor"}
        aria-hidden="true"
        {...rest}
      >
        <path d="M7 4v16l13-8z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
