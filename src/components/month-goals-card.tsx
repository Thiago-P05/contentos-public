"use client";

import { useEffect, useState } from "react";
import { formatDashboardMetricValue } from "@/lib/dashboard-metrics";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type GoalsDraft = {
  viewsTarget: string;
  followersTarget: string;
};

function GoalProgress({
  label,
  current,
  target,
  metricKey,
}: {
  label: string;
  current: number;
  target: number;
  metricKey: "views" | "follows";
}) {
  const rawProgress = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
  const displayProgress =
    rawProgress > 0 && rawProgress < 1 ? "<1%" : `${Math.round(rawProgress)}%`;

  return (
    <div className="flex w-full flex-col">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-body-sm font-medium text-foreground">{label}</p>
        <p className="text-body-sm text-muted-foreground">{displayProgress}</p>
      </div>
      <p className="mb-3 font-mono text-caption tracking-normal text-muted-foreground tabular-nums">
        {formatDashboardMetricValue(metricKey, current)} de {formatDashboardMetricValue(metricKey, target)}
      </p>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${rawProgress}%`, backgroundColor: "var(--foreground)" }}
        />
      </div>
    </div>
  );
}

function normalizePositiveInteger(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : fallback;
}

function readStoredGoals(
  storageKey: string,
  defaultViewsTarget: number,
  defaultFollowersTarget: number,
) {
  if (typeof window === "undefined") {
    return {
      viewsTarget: defaultViewsTarget,
      followersTarget: defaultFollowersTarget,
    };
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {
        viewsTarget: defaultViewsTarget,
        followersTarget: defaultFollowersTarget,
      };
    }
    const parsed = JSON.parse(raw) as {
      viewsTarget?: unknown;
      followersTarget?: unknown;
      followsTarget?: unknown;
    };

    return {
      viewsTarget:
        typeof parsed.viewsTarget === "number" && parsed.viewsTarget > 0
          ? Math.round(parsed.viewsTarget)
          : defaultViewsTarget,
      followersTarget:
        typeof parsed.followersTarget === "number" && parsed.followersTarget > 0
          ? Math.round(parsed.followersTarget)
          : typeof parsed.followsTarget === "number" && parsed.followsTarget > 0
            ? Math.round(parsed.followsTarget)
            : defaultFollowersTarget,
    };
  } catch {
    return {
      viewsTarget: defaultViewsTarget,
      followersTarget: defaultFollowersTarget,
    };
  }
}

export function MonthGoalsCard({
  viewsValue,
  followersValue,
  defaultViewsTarget,
  defaultFollowersTarget,
  storageKey,
}: {
  viewsValue: number;
  followersValue: number;
  defaultViewsTarget: number;
  defaultFollowersTarget: number;
  storageKey: string;
}) {
  const persistentKey = `dashboard-month-goals:v1:${storageKey}`;
  const initialGoals = {
    viewsTarget: defaultViewsTarget,
    followersTarget: defaultFollowersTarget,
  };

  const [viewsTarget, setViewsTarget] = useState(initialGoals.viewsTarget);
  const [followersTarget, setFollowersTarget] = useState(initialGoals.followersTarget);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<GoalsDraft>({
    viewsTarget: String(initialGoals.viewsTarget),
    followersTarget: String(initialGoals.followersTarget),
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const storedGoals = readStoredGoals(
      persistentKey,
      defaultViewsTarget,
      defaultFollowersTarget,
    );

    setViewsTarget(storedGoals.viewsTarget);
    setFollowersTarget(storedGoals.followersTarget);
    setDraft({
      viewsTarget: String(storedGoals.viewsTarget),
      followersTarget: String(storedGoals.followersTarget),
    });
  }, [persistentKey, defaultViewsTarget, defaultFollowersTarget]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function saveGoals() {
    const nextViews = normalizePositiveInteger(draft.viewsTarget, viewsTarget);
    const nextFollowers = normalizePositiveInteger(draft.followersTarget, followersTarget);

    setViewsTarget(nextViews);
    setFollowersTarget(nextFollowers);
    setDraft({
      viewsTarget: String(nextViews),
      followersTarget: String(nextFollowers),
    });

    window.localStorage.setItem(
      persistentKey,
      JSON.stringify({
        viewsTarget: nextViews,
        followersTarget: nextFollowers,
      }),
    );
  }

  function resetGoals() {
    setViewsTarget(defaultViewsTarget);
    setFollowersTarget(defaultFollowersTarget);
    setDraft({
      viewsTarget: String(defaultViewsTarget),
      followersTarget: String(defaultFollowersTarget),
    });
    window.localStorage.removeItem(persistentKey);
  }

  return (
    <Card className="flex h-full w-full justify-between">
      <CardHeader>
        <CardDescription className="ds-label">Metas del mes</CardDescription>
        <CardTitle className="text-[1.15rem] text-foreground">
          Objetivos
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex w-full flex-col">
          <GoalProgress
            label="Views"
            current={viewsValue}
            target={viewsTarget}
            metricKey="views"
          />
          <div className="my-4 h-px w-full bg-line" />
          <GoalProgress
            label="Seguidores"
            current={followersValue}
            target={followersTarget}
            metricKey="follows"
          />
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch gap-3">
        <Button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          variant="outline"
          className="w-full"
        >
          {isEditing ? "Ocultar editor de metas" : "Editar metas"}
        </Button>

        {isEditing ? (
          <div className="flex flex-col gap-2.5">
            <label className="block text-label uppercase tracking-label text-muted-foreground">
              Meta de views
              <Input
                type="number"
                min={1}
                step={1}
                value={draft.viewsTarget}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    viewsTarget: event.target.value,
                  }))
                }
                className="mt-1 text-body-sm"
              />
            </label>
            <label className="block text-label uppercase tracking-label text-muted-foreground">
              Meta de seguidores
              <Input
                type="number"
                min={1}
                step={1}
                value={draft.followersTarget}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    followersTarget: event.target.value,
                  }))
                }
                className="mt-1 text-body-sm"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={saveGoals}
                className="flex-1"
                size="sm"
              >
                Guardar metas
              </Button>
              <Button
                type="button"
                onClick={resetGoals}
                className="flex-1"
                size="sm"
                variant="outline"
              >
                Restablecer
              </Button>
            </div>
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}
