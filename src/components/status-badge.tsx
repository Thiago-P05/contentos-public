import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  active: "Activa",
  disconnected: "Desconectada",
  error: "Error",
  running: "En curso",
  completed: "Completado",
  failed: "Error",
  pending: "Pendiente",
  ready: "Listo",
  fallback: "Fallback",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-body-sm",
        status === "running" ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-[5px] shrink-0 rounded-full",
          status === "running" ? "animate-pulse bg-foreground" : "bg-secondary",
        )}
      />
      {labels[status] ?? status}
    </span>
  );
}
