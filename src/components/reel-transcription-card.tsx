import { formatDateTime } from "@/lib/format";
import type { TranscriptionStatus } from "@/lib/types";

type Props = {
  eligible: boolean;
  status: TranscriptionStatus;
  model: string | null;
  updatedAt: string | null;
  transcript: string | null;
  error: string | null;
};

function splitTranscript(text: string): string[] {
  // 1. Try double-newline paragraph breaks
  const byDoubleNewline = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (byDoubleNewline.length > 1) return byDoubleNewline;

  // 2. Try single-newline line breaks
  const bySingleNewline = text.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (bySingleNewline.length > 1) return bySingleNewline;

  // 3. No newlines — group sentences every 3 units
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const groups: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    groups.push(sentences.slice(i, i + 3).join(" ").trim());
  }
  return groups.filter(Boolean);
}

function TranscriptBody({ text }: { text: string }) {
  const paragraphs = splitTranscript(text);
  return (
    <div className="mt-4 space-y-3">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-body leading-6 text-foreground">
          {para}
        </p>
      ))}
    </div>
  );
}

function getStatusLabel(status: TranscriptionStatus) {
  switch (status) {
    case "ready": return "Lista";
    case "processing": return "Procesando";
    case "pending": return "Pendiente";
    case "failed": return "Fallida";
    default: return "Sin transcripcion";
  }
}

export function ReelTranscriptionCard({ eligible, status, model, updatedAt, transcript, error }: Props) {
  if (!eligible) {
    return null;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <p className="font-mono text-label uppercase tracking-caps text-muted-foreground">
          Transcripcion
        </p>
      </div>

      <div className="glass-panel rounded-md px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <span className="rounded-full border border-line bg-surface-elevated px-2 py-1 text-label uppercase tracking-caps text-foreground">
            {getStatusLabel(status)}
          </span>
          {model ? <span>Modelo: {model}</span> : null}
          {updatedAt ? <span>Actualizada: {formatDateTime(updatedAt)}</span> : null}
        </div>

        {status === "ready" && transcript ? (
          <TranscriptBody text={transcript} />
        ) : null}

        {status === "pending" ? (
          <p className="mt-4 text-body text-muted-foreground">
            El reel quedo marcado para transcripcion y se procesara en la sync automatica.
          </p>
        ) : null}

        {status === "processing" ? (
          <p className="mt-4 text-body text-muted-foreground">
            La transcripcion se esta generando ahora mismo.
          </p>
        ) : null}

        {status === "failed" ? (
          <p className="mt-4 text-body text-danger">
            {error ?? "No se pudo generar la transcripcion de este reel."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
