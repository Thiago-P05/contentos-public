import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeMcpAuditEvent } from "@/lib/mcp/audit";
import type { McpAuthContext } from "@/lib/mcp/auth";
import {
  getMcpBusinessBrief,
  getMcpContentDetail,
  getMcpPerformanceOverview,
  getMcpScriptContext,
  getMcpThumbnail,
  getMcpTranscript,
  listMcpConnections,
  searchMcpContent,
} from "@/lib/mcp/content";

const platformSchema = z.enum(["instagram", "tiktok", "youtube"]);
const platformFilterSchema = z.union([platformSchema, z.literal("all")]);
const dashboardRangeSchema = z.enum(["day", "week", "month", "quarter", "year", "all", "last30", "last60", "last90"]);

function toolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo completar la consulta.";
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

async function runTool<T>(
  auth: McpAuthContext,
  toolName: string,
  connectionId: string | undefined,
  execute: () => Promise<T>,
  resultCount: (value: T) => number | null = () => null,
) {
  const startedAt = Date.now();

  try {
    const value = await execute();
    await writeMcpAuditEvent({
      userId: auth.userId,
      clientId: auth.clientId,
      toolName,
      connectionId,
      resultCount: resultCount(value),
      durationMs: Date.now() - startedAt,
      status: "success",
    });
    return toolResult(value);
  } catch (error) {
    await writeMcpAuditEvent({
      userId: auth.userId,
      clientId: auth.clientId,
      toolName,
      connectionId,
      durationMs: Date.now() - startedAt,
      status: "error",
    });
    return toolError(error);
  }
}

async function runThumbnailTool(auth: McpAuthContext, contentId: string) {
  const startedAt = Date.now();

  try {
    const thumbnail = await getMcpThumbnail(contentId);
    await writeMcpAuditEvent({
      userId: auth.userId,
      clientId: auth.clientId,
      toolName: "get_content_thumbnail",
      durationMs: Date.now() - startedAt,
      status: "success",
    });

    return {
      content: [
        { type: "image" as const, data: thumbnail.data, mimeType: thumbnail.mimeType },
        {
          type: "text" as const,
          text: JSON.stringify({ contentId: thumbnail.contentId, sourceUrl: thumbnail.sourceUrl }),
        },
      ],
    };
  } catch (error) {
    await writeMcpAuditEvent({
      userId: auth.userId,
      clientId: auth.clientId,
      toolName: "get_content_thumbnail",
      durationMs: Date.now() - startedAt,
      status: "error",
    });
    return toolError(error);
  }
}

export function createContentMcpServer(auth: McpAuthContext) {
  const server = new McpServer({ name: "contentos", version: "0.1.0" });

  server.registerTool(
    "list_connections",
    {
      title: "List content accounts",
      description: "Lista las cuentas de redes sociales activas disponibles para consultar.",
      inputSchema: { platform: platformFilterSchema.optional().default("all") },
      annotations: { readOnlyHint: true },
    },
    ({ platform }) => runTool(auth, "list_connections", undefined, () => listMcpConnections(platform), (value) => value.length),
  );

  server.registerTool(
    "get_business_brief",
    {
      title: "Get business brief",
      description: "Obtiene el brief de negocio, audiencia, tono y CTA de una cuenta.",
      inputSchema: { connectionId: z.string().uuid() },
      annotations: { readOnlyHint: true },
    },
    ({ connectionId }) => runTool(auth, "get_business_brief", connectionId, () => getMcpBusinessBrief(connectionId)),
  );

  server.registerTool(
    "search_content",
    {
      title: "Search analyzed content",
      description: "Busca contenido propio por texto, plataforma, cuenta o fecha y devuelve metricas y analisis resumidos.",
      inputSchema: {
        query: z.string().trim().min(1).max(200).optional(),
        platform: platformFilterSchema.optional().default("all"),
        connectionId: z.string().uuid().optional(),
        publishedAfter: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(30).optional().default(12),
        sort: z.enum(["recent", "views"]).optional().default("recent"),
      },
      annotations: { readOnlyHint: true },
    },
    (input) => runTool(auth, "search_content", input.connectionId, () => searchMcpContent(input), (value) => value.length),
  );

  server.registerTool(
    "get_content_detail",
    {
      title: "Get content detail",
      description: "Obtiene metricas historicas y analisis de una pieza de contenido ya identificada.",
      inputSchema: { contentId: z.string().uuid() },
      annotations: { readOnlyHint: true },
    },
    ({ contentId }) => runTool(auth, "get_content_detail", undefined, () => getMcpContentDetail(contentId)),
  );

  server.registerTool(
    "get_content_transcript",
    {
      title: "Get content transcript",
      description: "Obtiene una parte paginada de la transcripcion de una pieza de contenido.",
      inputSchema: {
        contentId: z.string().uuid(),
        offset: z.number().int().min(0).optional().default(0),
        limit: z.number().int().min(1).max(10000).optional().default(5000),
      },
      annotations: { readOnlyHint: true },
    },
    (input) => runTool(auth, "get_content_transcript", undefined, () => getMcpTranscript(input)),
  );

  server.registerTool(
    "get_content_thumbnail",
    {
      title: "Get content thumbnail",
      description: "Obtiene la miniatura publica de una pieza de contenido como imagen para analizarla visualmente.",
      inputSchema: { contentId: z.string().uuid() },
      annotations: { readOnlyHint: true },
    },
    ({ contentId }) => runThumbnailTool(auth, contentId),
  );

  server.registerTool(
    "get_performance_overview",
    {
      title: "Get performance overview",
      description: "Obtiene totales y evolucion de rendimiento real para una cuenta o plataforma.",
      inputSchema: {
        range: dashboardRangeSchema.optional().default("month"),
        platform: platformFilterSchema.optional().default("all"),
        connectionId: z.string().uuid().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (input) => runTool(auth, "get_performance_overview", input.connectionId, () => getMcpPerformanceOverview(input)),
  );

  server.registerTool(
    "get_script_context",
    {
      title: "Get script context",
      description: "Prepara brief, referencias de contenido, metricas, analisis y extractos de transcripciones para crear un guion basado en datos reales.",
      inputSchema: {
        topic: z.string().trim().min(2).max(200),
        platform: platformSchema,
        connectionId: z.string().uuid(),
        objective: z.string().trim().min(2).max(200).optional(),
        format: z.string().trim().min(2).max(80).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (input) => runTool(auth, "get_script_context", input.connectionId, () => getMcpScriptContext(input), (value) => value.references.length),
  );

  return server;
}
