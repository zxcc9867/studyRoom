import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { getOpenRouterConfig } from "../server/ai/openrouter.mjs";

// CI-only adapter: stdin carries values, and child output is never logged.
export function syncOpenRouterEnvironment(env = process.env, run = spawnSync) {
  const key = env.OPENROUTER_API_KEY?.trim();
  const model = env.OPENROUTER_MODEL?.trim();
  if (!key && !model) return { skipped: true, count: 0 };
  if (!key || !model) throw new Error("Set both GitHub secret OPENROUTER_API_KEY and variable OPENROUTER_MODEL before syncing.");
  const config = getOpenRouterConfig(env); // Validate the entire plan before any external write.
  if (!env.VERCEL_TOKEN || !env.VERCEL_PROJECT_ID || !env.VERCEL_ORG_ID) {
    throw new Error("Vercel deployment credentials and project IDs are required.");
  }
  const values = {
    OPENROUTER_API_KEY: key,
    OPENROUTER_MODEL: config.model,
    OPENROUTER_MAX_TOKENS: env.OPENROUTER_MAX_TOKENS?.trim() || "1024",
    OPENROUTER_TIMEOUT_MS: env.OPENROUTER_TIMEOUT_MS?.trim() || "20000",
    OPENROUTER_SITE_URL: env.OPENROUTER_SITE_URL?.trim() || "https://study-room-attendance.vercel.app",
    OPENROUTER_APP_NAME: env.OPENROUTER_APP_NAME?.trim() || "Study Room",
  };
  for (const [name, value] of Object.entries(values)) {
    const args = ["env", "add", name, "production", "--force", "--token", env.VERCEL_TOKEN];
    if (name === "OPENROUTER_API_KEY") args.push("--sensitive");
    const result = run("vercel", args, { input: value, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 60_000, env });
    if (result.error || result.status !== 0) {
      // Vercel error output may contain values. Never forward it to CI logs.
      throw new Error(`OpenRouter environment sync failed for ${name}; deployment stopped. Correct the configuration and rerun.`);
    }
  }
  return { skipped: false, count: Object.keys(values).length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = syncOpenRouterEnvironment();
    console.log(result.skipped ? "OpenRouter sync skipped: no GitHub key/model pair; existing Vercel values were preserved." : `OpenRouter server environment synced (${result.count} variables).`);
  } catch {
    console.error("OpenRouter environment sync failed. Check key/model pair, configuration limits and Vercel access; no secret values are logged.");
    process.exitCode = 1;
  }
}
