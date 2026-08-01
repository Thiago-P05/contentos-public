import { formatRelative } from "@/lib/format";
import type { PlatformComment } from "@/lib/types";

export function RecentCommentsPanel({ comments }: { comments: PlatformComment[] }) {
  return (
    <section className="ds-animate-in ds-delay-4 glass-panel rounded-lg p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">
            Comentarios
          </p>
          <h2 className="mt-2 text-[1.2rem] font-semibold tracking-display text-foreground">
            Comentarios recientes
          </h2>
        </div>
        <p className="text-body-sm text-muted-foreground">Feedback real sincronizado desde la plataforma.</p>
      </div>

      {comments.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-line px-5 py-10 text-center text-body text-muted-foreground">
          Todavia no hay comentarios sincronizados para esta cuenta o periodo.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {comments.map((comment) => (
            <article
              key={comment.id}
              className="rounded-md border border-line bg-surface-elevated px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-body font-medium text-foreground">
                  {comment.authorDisplayName ?? comment.authorUsername ?? "Usuario"}
                </p>
                <p className="shrink-0 text-caption text-muted-foreground">
                  {formatRelative(comment.commentedAt)}
                </p>
              </div>
              <p className="mt-2 text-body leading-6 text-muted-foreground">{comment.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
