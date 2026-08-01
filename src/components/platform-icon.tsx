import type { Platform, PlatformFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

function AllIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5">
      <circle cx="5" cy="5" r="1.5" fill="currentColor" />
      <circle cx="11" cy="5" r="1.5" fill="currentColor" />
      <circle cx="5" cy="11" r="1.5" fill="currentColor" />
      <circle cx="11" cy="11" r="1.5" fill="currentColor" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5">
      <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11.5" cy="4.7" r="0.9" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5">
      <path
        d="M9.1 3.1v6.1a2.7 2.7 0 1 1-2.2-2.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.1 3.1c.5 1.1 1.4 1.9 2.8 2.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5">
      <path d="M13.6 5.2a1.8 1.8 0 0 0-1.3-1.3C11.1 3.6 8 3.6 8 3.6s-3.1 0-4.3.3a1.8 1.8 0 0 0-1.3 1.3C2.1 6.4 2.1 8 2.1 8s0 1.6.3 2.8a1.8 1.8 0 0 0 1.3 1.3c1.2.3 4.3.3 4.3.3s3.1 0 4.3-.3a1.8 1.8 0 0 0 1.3-1.3c.3-1.2.3-2.8.3-2.8s0-1.6-.3-2.8Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="m6.7 6.2 3 1.8-3 1.8V6.2Z" fill="currentColor" />
    </svg>
  );
}

export function PlatformIcon({
  platform,
  className,
}: {
  platform: Platform | PlatformFilter;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      {platform === "all" ? <AllIcon /> : null}
      {platform === "instagram" ? <InstagramIcon /> : null}
      {platform === "tiktok" ? <TikTokIcon /> : null}
      {platform === "youtube" ? <YouTubeIcon /> : null}
    </span>
  );
}
