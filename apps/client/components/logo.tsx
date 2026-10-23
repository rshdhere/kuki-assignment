import { useId } from "react";

/** The KuKi mark: a bitten cookie. Decorative; the wordmark beside it names the app. */
export function Logo({ size = 34 }: { size?: number }) {
  const bite = useId();
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <mask id={bite}>
            <rect width="100" height="100" fill="#fff" />
            <circle cx="88" cy="18" r="16" fill="#000" />
            <circle cx="73" cy="5" r="10" fill="#000" />
          </mask>
        </defs>
        <g mask={`url(#${bite})`}>
          <circle cx="50" cy="52" r="44" fill="#efefef" />
          <rect x="27" y="30" width="13" height="12" rx="3" fill="#2a2a2c" />
          <rect x="44" y="50" width="14" height="13" rx="3.5" fill="#2a2a2c" />
          <rect x="24" y="60" width="11" height="10" rx="3" fill="#2a2a2c" />
          <rect x="64" y="56" width="12" height="12" rx="3" fill="#2a2a2c" />
          <rect x="42" y="76" width="10" height="9" rx="2.5" fill="#2a2a2c" />
        </g>
      </svg>
    </span>
  );
}
