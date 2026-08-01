import { upsertPlatformConnectionBrief } from "@/lib/supabase/repository";
import { enforceApiRouteSecurity, logRouteError } from "@/lib/request-security";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request, { params }: RouteProps) {
  const { id } = await params;

  try {
    await enforceApiRouteSecurity(request, {
      bucket: "connection-brief",
      rateLimit: { limit: 15, windowSeconds: 300 },
    });

    const formData = await request.formData();
    await upsertPlatformConnectionBrief(id, {
      offer: readField(formData, "offer"),
      idealCustomerProfile: readField(formData, "idealCustomerProfile"),
      corePain: readField(formData, "corePain"),
      desiredOutcome: readField(formData, "desiredOutcome"),
      differentiator: readField(formData, "differentiator"),
      toneGuidelines: readField(formData, "toneGuidelines"),
      avoidGuidelines: readField(formData, "avoidGuidelines"),
      primaryCta: readField(formData, "primaryCta"),
      notes: readField(formData, "notes"),
    });

    return NextResponse.redirect(new URL(`/account?briefSaved=${id}`, request.url), 303);
  } catch (error) {
    logRouteError("api-connection-brief", error);
    return NextResponse.redirect(new URL("/account?error=brief", request.url), 303);
  }
}
