"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ContentPreviewAsset } from "@/lib/content-media";

type ContentPreviewProps = {
  assets: ContentPreviewAsset[];
  title: string;
  variant?: "default" | "portrait";
  layout?: "grid" | "carousel";
};

function isVideoAsset(asset: ContentPreviewAsset) {
  const mediaType = asset.mediaType?.toUpperCase() ?? "";
  const mediaUrl = asset.mediaUrl?.toLowerCase() ?? "";

  return (
    mediaType.includes("VIDEO") ||
    mediaUrl.endsWith(".mp4") ||
    mediaUrl.endsWith(".mov") ||
    mediaUrl.includes(".mp4?")
  );
}

function PreviewCard({
  asset,
  alt,
  index,
  expanded = false,
  portrait = false,
}: {
  asset: ContentPreviewAsset;
  alt: string;
  index: number;
  expanded?: boolean;
  portrait?: boolean;
}) {
  const isVideo = isVideoAsset(asset);
  const frameClass = portrait
    ? "mx-auto w-full max-w-[22rem] xl:max-w-[50%]"
    : "w-full";
  const mediaWrapperClass = portrait
    ? "aspect-[9/16] min-h-0 w-full"
    : expanded
      ? "min-h-[32rem]"
      : "min-h-[24rem]";
  const mediaClass = portrait
    ? "h-full w-full"
    : expanded
      ? "max-h-[28rem]"
      : "max-h-[20rem]";

  return (
    <article
      className={`overflow-hidden rounded-md border border-line bg-surface-elevated ${frameClass}`}
    >
      <div
        className={`flex items-center justify-center bg-[radial-gradient(circle_at_top,var(--glass-highlight),transparent_58%)] px-5 py-5 ${mediaWrapperClass}`}
      >
        {isVideo && asset.mediaUrl ? (
          <video
            controls
            muted
            playsInline
            preload="metadata"
            poster={asset.thumbnailUrl ?? undefined}
            className={`mx-auto max-w-full rounded-sm object-contain ${mediaClass}`}
          >
            <source src={asset.mediaUrl} />
          </video>
        ) : asset.mediaUrl || asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.mediaUrl ?? asset.thumbnailUrl ?? ""}
            alt={alt}
            className={`mx-auto max-w-full rounded-sm object-contain ${mediaClass}`}
          />
        ) : (
          <div className="px-6 text-center text-body text-muted-foreground">
            La plataforma no devolvio una media utilizable para esta lamina.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-line px-3.5 py-3">
        <span className="font-mono text-label uppercase tracking-caps text-muted-foreground">
          {index + 1 < 10 ? `0${index + 1}` : index + 1}
        </span>
        <span className="text-body-sm text-muted-foreground">{isVideo ? "Video" : "Imagen"}</span>
      </div>
    </article>
  );
}

export function ContentPreview({
  assets,
  title,
  variant = "default",
  layout = "grid",
}: ContentPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (assets.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line px-6 py-14 text-center text-body text-muted-foreground">
        La API de Instagram no devolvio una preview usable para esta pieza.
      </div>
    );
  }

  const isSingleAsset = assets.length === 1;
  const isCarousel = layout === "carousel" && assets.length > 1;
  const portrait = variant === "portrait" && (isSingleAsset || isCarousel);
  const containerClass = isCarousel
    ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 scroll-smooth scrollbar-thin scrollbar-thumb-line-strong scrollbar-track-transparent"
    : isSingleAsset
      ? "grid grid-cols-1"
      : "grid gap-3 md:grid-cols-2 xl:grid-cols-2";

  const scrollBy = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-3 relative group">
      {isCarousel && (
        <div className="absolute inset-y-0 left-0 right-0 pointer-events-none z-10 flex items-center justify-between px-2">
          <button
            type="button"
            onClick={() => scrollBy(-320)}
            className="pointer-events-auto rounded-full bg-surface-elevated/90 border border-line p-2 text-foreground shadow-lg backdrop-blur opacity-0 transition group-hover:opacity-100 hover:bg-surface-hover"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(320)}
            className="pointer-events-auto rounded-full bg-surface-elevated/90 border border-line p-2 text-foreground shadow-lg backdrop-blur opacity-0 transition group-hover:opacity-100 hover:bg-surface-hover"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
      <div className={containerClass} ref={scrollRef}>
        {assets.map((asset, index) => (
          <div key={asset.id} className={isCarousel ? "min-w-full snap-center" : undefined}>
          <PreviewCard
            asset={asset}
            alt={`${title} - vista previa ${index + 1}`}
            index={index}
            expanded={isSingleAsset || isCarousel}
            portrait={portrait}
          />
          </div>
        ))}
      </div>

      <p className="text-body-sm leading-6 text-muted-foreground">
        La preview usa la URL de media o thumbnail disponible en la plataforma. Si una pieza vieja
        no carga, alcanza con volver a sincronizar para refrescarla.
      </p>
    </div>
  );
}
