-- ============================================================
-- Adds platform_connection_briefs: the strategic context for each account —
-- offer, ICP, pain, outcome, tone, CTA, notes.
--
-- This is what separates the AI analysis from generic advice. Without a brief
-- the model can only judge performance; with one it can also judge whether a
-- piece was aligned with what the account is actually trying to do.
-- ai_insights grows the columns needed to store that richer verdict.
-- ============================================================

create table if not exists public.platform_connection_briefs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.platform_connections(id) on delete cascade,
  offer text not null default '',
  ideal_customer_profile text not null default '',
  core_pain text not null default '',
  desired_outcome text not null default '',
  differentiator text not null default '',
  tone_guidelines text not null default '',
  avoid_guidelines text not null default '',
  primary_cta text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists platform_connection_briefs_connection_id_key
  on public.platform_connection_briefs (connection_id);

drop trigger if exists set_platform_connection_briefs_updated_at on public.platform_connection_briefs;
create trigger set_platform_connection_briefs_updated_at
before update on public.platform_connection_briefs
for each row execute function public.set_updated_at();

alter table public.ai_insights
  add column if not exists improvements jsonb not null default '[]'::jsonb;

alter table public.ai_insights
  add column if not exists hook_type text;

alter table public.ai_insights
  add column if not exists hook_assessment text;

alter table public.ai_insights
  add column if not exists evidence_mode text not null default 'text_only';

insert into public.platform_connection_briefs (
  connection_id,
  offer,
  ideal_customer_profile,
  core_pain,
  desired_outcome,
  differentiator,
  tone_guidelines,
  avoid_guidelines,
  primary_cta,
  notes
)
select
  id,
  'Ahorro tiempo y dinero a empresas con Inteligencia Artificial.',
  'Hombre de 35 a 45 anos, dueno de una pyme o empresa estable, con familia, estabilidad economica y poco tiempo. Tiene bajo conocimiento tecnico en inteligencia artificial, pero quiere crecer la empresa, ahorrar tiempo y ganar mas dinero sin sacrificar su vida personal.',
  'Le falta tiempo. Siente que el negocio depende demasiado de el, no puede dedicarle el tiempo que quiere a su familia, quiere aprender y crecer pero no llega.',
  'Quiere recuperar tiempo, crecer la empresa sin estar pendiente todo el dia y ganar mas dinero sin sacrificar a su familia.',
  'Conozco bien los problemas del empresario pyme y tengo experiencia aplicando inteligencia artificial y automatizaciones en empresas para resolverlos de forma realista.',
  'Profesional, educado y tranquilo. Claro, simple y directo. Sin tecnicismos innecesarios. Tiene que sonar entendible para alguien no tecnico.',
  'Evitar tono demasiado tecnico, academico, marketinero, soberbio o exageradamente vendedor. No recomendar complejidad innecesaria ni jerga dificil.',
  'Buscar que la audiencia comente una palabra para abrir conversacion por Instagram DM y prospectar desde ahi.',
  ''
from public.platform_connections
on conflict (connection_id) do nothing;
