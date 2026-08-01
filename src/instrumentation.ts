export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.LANGFUSE_ENABLED === "true") {
    const { ensureLangfuseStarted } = await import("./lib/observability/langfuse");
    ensureLangfuseStarted();
  }
}
