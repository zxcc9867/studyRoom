import { getOpenRouterConfig } from "../server/ai/openrouter.mjs";

try {
  const config = getOpenRouterConfig();
  // Report readiness only. Do not print config objects containing credentials.
  console.log(config.enabled ? "OpenRouter configuration is ready. No API request was sent." : "OpenRouter is disabled: configure both OPENROUTER_API_KEY and OPENROUTER_MODEL. No API request was sent.");
} catch {
  console.error("Invalid OpenRouter configuration. Check the documented environment variable limits.");
  process.exitCode = 1;
}
