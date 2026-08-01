import { getDefaultPlatformConnectionBriefFields } from "@/lib/connection-briefs";
import type { PlatformConnectionBrief } from "@/lib/types";

type ConnectionBriefFormProps = {
  connectionId: string;
  brief?: PlatformConnectionBrief | null;
};

const FIELD_DEFINITIONS = [
  {
    key: "offer",
    label: "Oferta",
    placeholder: "Que ofreces y en que transforma a la empresa.",
    rows: 3,
  },
  {
    key: "idealCustomerProfile",
    label: "Cliente ideal",
    placeholder: "A quien le hablas exactamente.",
    rows: 4,
  },
  {
    key: "corePain",
    label: "Dolor central",
    placeholder: "Problema principal que queres atacar.",
    rows: 4,
  },
  {
    key: "desiredOutcome",
    label: "Resultado deseado",
    placeholder: "Transformacion concreta que busca la audiencia.",
    rows: 4,
  },
  {
    key: "differentiator",
    label: "Diferenciador",
    placeholder: "Por que te tienen que creer a vos.",
    rows: 4,
  },
  {
    key: "toneGuidelines",
    label: "Tono",
    placeholder: "Como tiene que sonar el analisis.",
    rows: 3,
  },
  {
    key: "avoidGuidelines",
    label: "Evitar",
    placeholder: "Que cosas no tiene que hacer ni decir.",
    rows: 3,
  },
  {
    key: "primaryCta",
    label: "CTA principal",
    placeholder: "Que accion debe empujar el contenido.",
    rows: 3,
  },
  {
    key: "notes",
    label: "Notas",
    placeholder: "Contexto adicional opcional para la cuenta.",
    rows: 3,
  },
] as const;

export function ConnectionBriefForm({ connectionId, brief }: ConnectionBriefFormProps) {
  const values = brief ?? {
    id: "default-" + connectionId,
    connectionId,
    ...getDefaultPlatformConnectionBriefFields(),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };

  return (
    <form
      action={`/api/account/connections/${connectionId}/brief`}
      method="post"
      className="mt-5 rounded-md border border-line bg-surface-elevated p-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-micro uppercase tracking-caps text-muted-foreground">
            Brief estrategico
          </p>
          <p className="mt-2 max-w-2xl text-body leading-7 text-muted-foreground">
            Este contexto se guarda por cuenta y se usa en los analisis nuevos de reels,
            TikToks y carruseles.
          </p>
        </div>

        <button
          type="submit"
          className="rounded-sm border border-line px-3.5 py-2 text-body-sm text-muted-foreground transition hover:border-line-strong hover:text-foreground"
        >
          Guardar brief
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {FIELD_DEFINITIONS.map((field) => (
          <label key={field.key} className={field.key === "notes" ? "lg:col-span-2" : "block"}>
            <span className="mb-2 block font-mono text-micro uppercase tracking-caps text-muted-foreground">
              {field.label}
            </span>
            <textarea
              name={field.key}
              defaultValue={values[field.key]}
              rows={field.rows}
              placeholder={field.placeholder}
              className="w-full rounded-md border border-line bg-surface px-3.5 py-3 text-body leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-line-strong"
            />
          </label>
        ))}
      </div>
    </form>
  );
}
