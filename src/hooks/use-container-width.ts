"use client";

import { useEffect, useRef, useState } from "react";

export function useContainerWidth(fallback = 300) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.max(entry.contentRect.width, fallback));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fallback]);

  return { ref, width };
}
