# Guía: replicar este diseño con el preset shadcn

Manual para montar el mismo sistema de diseño en otro proyecto. Está escrito
desde la migración real de ContentOS, así que incluye las trampas que
efectivamente aparecieron, no solo la teoría.

**Preset:** `b3XpoFP53I`

```
style        radix-rhea    baseColor  neutral      theme       neutral
chartColor   neutral       iconLibrary lucide      radius      default (0.625rem)
font         inter         fontHeading geist       menuAccent  bold
```

Rhea es el style compacto de shadcn (una Luma más densa): mismo lenguaje
redondeado, controles y gaps más chicos. Pensado para interfaces con mucha
densidad de información — dashboards, tablas, paneles.

---

## 1. Inspeccionar antes de aplicar

Los códigos de preset son opacos. No los decodifiques a mano ni intentes
adivinar la URL: hay un comando de solo lectura.

```bash
pnpm dlx shadcn@latest preset decode b3XpoFP53I
```

Devuelve style, baseColor, fuentes, radius e icon library. Corrélo siempre
primero: si el radius o las fuentes no son lo que esperabas, te enterás antes
de que te pise medio proyecto.

---

## 2. Aplicarlo

```bash
git checkout -b rebrand/<nombre>       # imprescindible
pnpm dlx shadcn@latest apply --preset b3XpoFP53I --yes
git diff > .artifacts/apply.diff       # guardar ANTES de tocar nada
```

### Qué toca

| Archivo | Qué le hace |
|---|---|
| `components.json` | reescribe `style`, agrega `rtl`, `menuColor`, `menuAccent`, `registries` |
| `globals.css` | **aditivo** — agrega sus tokens, no borra los tuyos |
| `layout.tsx` | cablea las fuentes (`--font-sans`, `--font-heading`, `--font-mono`) |
| `components/ui/*` | **reescribe** los primitivos que detecte, al estilo nuevo |
| `lib/utils.ts` | **lo sobreescribe entero** |
| `package.json` | agrega `shadcn`, `radix-ui`, `tw-animate-css` |

### ⚠️ La que duele: `lib/utils.ts`

El apply reemplaza el archivo completo por su versión (solo `cn()` con
`twMerge`). Si tenías helpers ahí, **desaparecen**. En ContentOS se llevó seis
funciones puestas.

Después de aplicar, comparar exports:

```bash
git show HEAD:src/lib/utils.ts | grep '^export'
grep '^export' src/lib/utils.ts
```

y volver a pegar lo que falte, conservando el `cn()` nuevo.

### Alternativas menos invasivas

```bash
# solo theme y/o fuentes, no toca componentes
pnpm dlx shadcn@latest apply --preset <code> --only theme,font

# solo config + CSS vars, cero cambios en componentes
pnpm dlx shadcn@latest init --preset <code> --force --no-reinstall
```

### Buena noticia

Sobre `globals.css` el apply es **aditivo**: no perdés tokens custom. Verificalo
comparando nombres de propiedad antes/después:

```bash
grep -oE '^\s+--[a-z0-9-]+:' globals-before.css | tr -d ' :' | sort -u > /tmp/a
grep -oE '^\s+--[a-z0-9-]+:' src/app/globals.css | tr -d ' :' | sort -u > /tmp/b
comm -23 /tmp/a /tmp/b     # perdidos — debe dar vacío
```

Lo que **sí** hace es agregar sus valores *al final* de `:root`, pisando los
tuyos por orden de cascada. Eso lleva al punto siguiente.

---

## 3. Estructura de `globals.css`

shadcn asume `:root` = light y `.dark` = dark. Si tu app usa un atributo,
redefinís el variant y listo — no hace falta migrar a clases.

```css
@import "tailwindcss" source("../");   /* ver §9 */
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark ([data-theme="dark"] &);

:root { /* LIGHT */ }
[data-theme="dark"] { /* DARK */ }

@theme inline { /* puente de color → utilities */ }
@theme { /* escalas: tipografía, tracking */ }

@layer base { /* resets, focus */ }
@layer components { /* clases .ds-* propias */ }

@keyframes …
@utility …
```

### Reglas del esqueleto

**El orden importa.** Lo que está fuera de `@layer` le gana a *todas* las
utilities de Tailwind v4. Si tus clases de diseño viven sin capa, ninguna
utility puede sobreescribirlas. Metelas en `@layer components`.

**Paridad de temas.** Todo token de `:root` debe tener gemelo en el bloque dark.
Excepciones legítimas: geometría (`--radius`, `--r-*`), derivados
(`--ring-offset-background: var(--background)`) y colores de marca. Verificable:

```bash
awk '/^:root \{/,/^\}/' src/app/globals.css | grep -oE '^\s+--[a-z0-9-]+:' | tr -d ' :' | sort -u > /tmp/light
awk '/^\[data-theme="dark"\] \{/,/^\}/' src/app/globals.css | grep -oE '^\s+--[a-z0-9-]+:' | tr -d ' :' | sort -u > /tmp/dark
comm -23 /tmp/light /tmp/dark
```

**`@theme` vs `@theme inline`.** `inline` solo hace de puente (no emite las
variables); `@theme` a secas **sí** las emite, así que podés usarlas con `var()`
fuera de utilities. Las escalas van en `@theme`.

**Anti-FOUC.** Script síncrono en `<head>`, antes del CSS:

```tsx
<script dangerouslySetInnerHTML={{ __html:
  `(function(){try{var t=localStorage.getItem('app.theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`
}} />
```

Y `suppressHydrationWarning` en `<html>`, porque el script muta el DOM antes de
que React hidrate.

---

## 4. La trampa principal: semántica de tokens

**`--muted`, `--secondary` y `--accent` son SUPERFICIES, no colores de texto.**

Es la convención de shadcn y no es negociable: los componentes del preset la
asumen. Los grises de texto salen de `--muted-foreground`.

```
✅ bg-muted        text-muted-foreground     text-secondary-foreground
❌ text-muted      text-secondary            text-accent
```

Si el proyecto venía usando `text-muted` como gris de texto (muy común cuando el
CSS se escribió a mano), al adoptar el preset **el texto se vuelve invisible**:
gris casi blanco sobre fondo casi blanco. En ContentOS eran 235 call sites.

Medilo antes de empezar:

```bash
grep -rEo 'text-(muted|secondary|accent)[^-a-z]' src --include=*.tsx | wc -l
```

Y barrelo con lookahead negativo para no romper los `-foreground` existentes:

```bash
perl -pi -e 's/\btext-muted\b(?!-)/text-muted-foreground/g' <archivos>
```

> No inventes un token `--text-secondary` para salir del paso: en `@theme`, un
> `--text-*` genera una utility de **font-size**, no de color. Choca con la
> escala tipográfica.

---

## 5. La trampa que más cuesta: el radius

**El radius solo llega a elementos que lo referencian.**

Si venías de un diseño plano (`--radius: 0`), nadie escribió nunca `rounded-*`
porque no hacía falta. Cambiás el token a `0.625rem` y **no pasa nada visible**:
los `<div className="border border-border bg-card">` siguen cuadrados.

Encontralos:

```bash
grep -rhoE 'className="[^"]*(bg-card|bg-surface|border-border)[^"]*"' src --include=*.tsx \
  | grep -v rounded | wc -l
```

En ContentOS eran 83.

### El patrón "losa cosida"

Los dashboards suelen componerse como una grilla continua donde los paneles
comparten bordes (`border-t-0`, `border-l-0`), no como cards separadas.
Redondear cada celda rompe la grilla.

**El marco va en el wrapper, los hijos solo llevan el divisor:**

```tsx
// ✅
<div className="overflow-hidden rounded-lg border border-border bg-card shadow-float">
  <StatCardsRow />                                   {/* celdas: border-l */}
  <Chart className="border-t border-border" />
  <div className="grid grid-cols-3 border-t border-border">…</div>
  <Table className="border-t border-border" />
</div>

// ❌ cada hijo con su borde completo
<div className="overflow-hidden rounded-lg">
  <div className="border border-border border-t-0">…</div>
</div>
```

El caso ❌ tiene dos defectos: duplica cada costura (2px en vez de 1) y, sobre
todo, **el clip redondeado le come los píxeles del borde exterior** — los bordes
se ven cortados en los laterales.

### Escala

```css
--radius: 0.625rem;
--r-sm: calc(var(--radius) - 4px);
--r-md: calc(var(--radius) - 2px);
--r-lg: var(--radius);
--r-xl: calc(var(--radius) + 4px);
--r-pill: 9999px;
```

y en `@theme inline` cablear `--radius-sm/md/lg/xl` a esos. Así volver a plano
es cambiar **una** línea.

---

## 6. Tipografía

El preset trae Inter (body) + Geist (headings). Conservá una mono para labels y
números tabulares si la UI muestra métricas.

```tsx
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geist = Geist({ subsets: ["latin"], variable: "--font-heading" });
const mono  = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
```

### Escala semántica

Los proyectos hechos a mano acumulan `text-[Npx]` arbitrarios (ContentOS tenía
210 usos con 11 valores distintos). Colapsalos:

```css
@theme {
  --text-micro:   0.5625rem;  /* 9px  */
  --text-label:   0.625rem;   /* 10px */
  --text-caption: 0.6875rem;  /* 11px */
  --text-body-sm: 0.75rem;    /* 12px */
  --text-body:    0.8125rem;  /* 13px */
  --text-lead:    0.875rem;   /* 14px */
  --text-title:   1.0625rem;  /* 17px */
}
```

### Tracking: usá nombres propios

```css
@theme {
  --tracking-display:   -0.04em;
  --tracking-snug:      -0.02em;
  --tracking-label:      0.12em;
  --tracking-caps:       0.2em;
  --tracking-caps-wide:  0.28em;
}
```

**No los llames `tight` / `wide` / `wider`**: esos nombres redefinen la escala
core de Tailwind y cambian el significado de clases que ya usás en otro lado.

Criterio de fin: `grep -rEo 'text-\[[0-9.]+px\]' src` devuelve 0.

---

## 7. Colores de datos

Tres familias distintas, no las mezcles:

| Familia | Cuándo | Cómo |
|---|---|---|
| **Series semánticas** | métricas con significado (views, likes, errores) | un token por métrica, hue propio, valor por tema |
| **Rampa categórica** | cuentas, países, edades — sin significado inherente | `--chart-1..5` del preset (neutros) |
| **Marca / plataforma** | Instagram, YouTube, logo | token propio, una sola fuente de verdad |

```css
:root {
  --series-views: oklch(0.55 0.17 149);   /* light: bajá lightness */
  --series-likes: oklch(0.62 0.15 90);
}
[data-theme="dark"] {
  --series-views: oklch(0.75 0.19 149);   /* dark: subila */
  --series-likes: oklch(0.80 0.15 90);
}
```

Con `chartColor: neutral`, la rampa categórica del preset es **escala de grises**.
Es deliberado: si la categoría no significa nada, distinguirla por valor y no por
hue es lo correcto y no compite con las series que sí significan algo.

**Nunca hardcodees hexes en la capa de datos.** Si el archivo que define las
métricas tiene `color: "#22c55e"`, ese color no puede cambiar entre temas.
Pasalo a `color: "var(--series-views)"`.

### Charts (recharts)

Todo el chrome sale de tokens, nada de `rgba(255,255,255,…)` — eso es invisible
en fondo claro:

```tsx
<CartesianGrid stroke="var(--chart-grid)" />
<XAxis tick={{ fill: "var(--chart-label)" }} />
<Tooltip cursor={{ stroke: "var(--chart-crosshair)" }} />
```

**Donuts:** usá `cx="50%" cy="50%"`, no números. Un `cx={65}` en un chart de 140
lo descentra 5px respecto de cualquier label absoluto que pongas encima. Y si
hay label en el centro, dejá que el tooltip se escape de la caja:

```tsx
<Tooltip allowEscapeViewBox={{ x: true, y: true }} offset={16}
         wrapperStyle={{ zIndex: 20, pointerEvents: "none" }} />
```

---

## 8. Profundidad

Para que los paneles "floten" sin que se note el truco, tres capas en vez de una
sombra dura:

```css
:root {
  --shadow-float:
    0 1px 2px rgba(0, 0, 0, 0.04),        /* contacto */
    0 4px 12px -6px rgba(0, 0, 0, 0.08),  /* media */
    0 16px 40px -24px rgba(0, 0, 0, 0.12);/* difusa */
}
[data-theme="dark"] {
  --shadow-float:
    0 1px 2px rgba(0, 0, 0, 0.30),
    0 4px 12px -6px rgba(0, 0, 0, 0.45),
    0 16px 40px -24px rgba(0, 0, 0, 0.65);
}
```

Registralo en `@theme inline` como `--shadow-float: var(--shadow-float)` para
tener la utility `shadow-float`.

Dark necesita valores **más opacos**: una sombra suave sobre fondo negro no se
ve. No reutilices los de light.

Aplicalo a todo lo que sea "burbuja" — incluidos los controles (segmented
selectors, botones de acción). Si los paneles flotan y los filtros no, los
filtros se leen como parte del fondo.

---

## 9. Colisiones de nombres

Al mover clases propias a `@layer components`, dejan de ganarle a las utilities
y aparecen choques que antes estaban tapados:

| Tu clase | Choca con | Solución |
|---|---|---|
| `.animate-in` | `tw-animate-css` | prefijar: `ds-animate-in` |
| `.delay-1..6` | `delay-*` de Tailwind (transition-delay) | prefijar: `ds-delay-N` |
| `--tracking-tight` | escala core de Tailwind | nombre propio |
| `--text-<algo>` | genera font-size, no color | no usarlo para colores |

### Scanning de Tailwind v4

Por defecto Tailwind escanea **todo el repo**, incluidos `.md`. Si documentás una
clase con un glob (`rounded-[var(--r-*)]`), la compila como CSS real y **rompe el
build**:

```
Parsing CSS source code failed: border-radius: var(--r-*)
Unexpected token Delim('*')
```

Acotá el scan al código:

```css
@import "tailwindcss" source("../");   /* desde src/app/globals.css → src/ */
```

Esto además evita que se escaneen snapshots o backups con clases viejas.

---

## 10. Un solo vocabulario por widget

El error de fondo cuando un rebranding "no se aplica del todo": conviven dos
sistemas para lo mismo — una capa de clases CSS y los primitivos de shadcn.
Tocás uno y el otro queda viejo.

Auditalo:

```bash
grep -rFo '<Badge' src --include=*.tsx | wc -l      # primitivo
grep -rFo 'ds-status-' src --include=*.tsx | wc -l  # clase equivalente
```

En ContentOS `<Badge>` estaba instalado con **cero usos** mientras había tres
implementaciones de badge a mano.

**Regla:** si shadcn tiene el primitivo, usá el primitivo. `Button`, `Input`,
`Badge`, `Switch`, `Label`, `Dialog`, `Table`.

**Excepción legítima:** las utilidades de superficie. Una clase `.ds-card` que
solo aplica fondo + sombra + radio **no** es duplicado de `<Card>`, que es un
componente compuesto con Header/Content/Footer y su propio `--card-spacing`.
Convivir ahí está bien; forzar la migración es churn con riesgo.

Extraé lo que esté copiado entre páginas. Si el mismo control está definido en
dos archivos, cada cambio hay que hacerlo dos veces y tarde o temprano uno queda
sin hacer.

---

## 11. Verificación

### Automática

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

### Greps de cierre (todos deben dar 0)

```bash
grep -rEo 'text-\[[0-9.]+px\]' src --include=*.tsx        # escala tipográfica
grep -rEo 'tracking-\[' src --include=*.tsx               # tracking
grep -rEo 'text-(muted|secondary)[^-a-z]' src --include=*.tsx
grep -rEo 'rgba\((255,\s*255,\s*255|0,\s*0,\s*0)' src --include=*.tsx
grep -rEo '#[0-9a-fA-F]{6}' src --include=*.tsx           # salvo marca
```

### Sobre el CSS compilado, no solo el exit code

```bash
css=$(find .next -name "*.css" -path "*static*" | head -1)
grep -c '\.text-body[^a-z-]' "$css"    # las clases nuevas se emiten
```

### Visual — lo más importante

**Un build verde no dice nada sobre si el rebranding se ve.** Los dos errores más
caros de esta migración (el radius que no llegaba, los switches cuadrados)
pasaron typecheck, lint, tests y build sin una queja.

Capturá **antes de empezar**, todas las rutas × ambos temas:

```js
// scripts/capture-ui-baseline.mjs
await context.addInitScript(
  `try { localStorage.setItem('app.theme', ${JSON.stringify(theme)}); } catch (e) {}`
);
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
```

Si la app tiene login, el script tiene que pasarlo (credenciales por env, nunca
commiteadas). Sin eso el harness solo llega a `/login` y quedás ciego justo en
las pantallas que importan.

---

## 12. Orden sugerido

Un commit por paso, para poder revertir granular:

1. Commitear todo lo pendiente + capturar baseline visual
2. `apply --preset` crudo, guardar el diff
3. Reconciliar `globals.css` (estructura, paridad, radius) y restaurar `utils.ts`
4. Fuentes
5. Escala tipográfica + tracking
6. Semántica de tokens (`text-muted` → `text-muted-foreground`)
7. Radius en los contenedores que nunca lo declararon
8. Colores de datos → tokens
9. Primitivos: migrar lo que esté duplicado
10. Limpieza de CSS muerto + docs
11. Capturar el "después" y comparar

---

## 13. Resumen de errores a evitar

1. **`utils.ts`**: el apply lo sobreescribe entero. Compará exports después.
2. **`text-muted` invisible**: `--muted` es superficie. Barré antes de mirar la UI.
3. **El radius no se ve**: solo llega a quien lo referencia. Buscá los contenedores sin `rounded-*`.
4. **Bordes cortados**: en losas cosidas el marco va en el wrapper, no en cada hijo.
5. **`animate-in` / `delay-N`**: chocan al entrar en `@layer components`. Prefijá.
6. **Build roto por un `.md`**: acotá el scan con `source("../")`.
7. **Sombras de light reusadas en dark**: no se ven. Valores propios por tema.
8. **Donuts descentrados**: `cx="50%"`, no números.
9. **Build verde ≠ diseño aplicado**: verificá con capturas, no con el exit code.
