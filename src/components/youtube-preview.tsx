"use client";

import { useState } from "react";
import { Play } from "lucide-react";

type YouTubePreviewProps = {
  embedUrl: string;
  thumbnailUrl: string | null;
  title: string;
};

export function YouTubePreview({ embedUrl, thumbnailUrl, title }: YouTubePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface-elevated">
      <div className="relative aspect-video overflow-hidden bg-black">
        {isPlaying ? (
          <iframe
            src={embedUrl}
            title={title}
            className="size-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="group absolute inset-0 flex items-center justify-center overflow-hidden bg-black text-white"
            aria-label={`Reproducir ${title} en YouTube`}
          >
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt=""
                className="size-full object-cover opacity-85 transition duration-500 group-hover:scale-[1.02] group-hover:opacity-100"
              />
            ) : null}
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
            <span className="relative grid size-14 place-items-center rounded-full bg-red-600 shadow-[0_10px_35px_rgba(220,38,38,0.4)] transition duration-200 group-hover:scale-110 group-focus-visible:scale-110">
              <Play className="ml-0.5 size-6 fill-current" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      <p className="border-t border-line px-3.5 py-3 text-body-sm text-muted-foreground">
        El reproductor de YouTube se carga solo al reproducir el video.
      </p>
    </div>
  );
}
