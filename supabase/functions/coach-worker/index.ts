import {
  adminClient,
  check,
  eligible,
  enqueue,
  executeCoachJob,
  loadPilotUsers,
  reply,
} from "../_shared/coach-store.ts";
import {
  analyzeRepositories,
  syncGoogle,
} from "../_shared/coach-integrations.ts";
import { localParts } from "../_shared/coach-domain.mjs";

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (
    req.method !== "POST" || !secret ||
    req.headers.get("x-cron-secret") !== secret
  ) return reply({ error: "Unauthorized" }, 401);
  const admin = adminClient();
  let completed = 0, failed = 0;
  try {
    await loadPilotUsers(admin);
    const settings = check(
      await admin.from("coach_settings").select("user_id,version").eq(
        "enabled",
        true,
      ).limit(100),
    );
    for (const setting of settings as any[]) {
      if (!eligible(setting.user_id)) continue;
      const careers = check(
        await admin.from("coach_careers").select("confirmed,skills").eq(
          "user_id",
          setting.user_id,
        ).eq("status", "active").maybeSingle(),
      ) as any;
      if (!careers) continue;
      const recent = check(
        await admin.from("coach_jobs").select("kind,created_at,status").eq(
          "user_id",
          setting.user_id,
        ).gte("created_at", new Date(Date.now() - 86400000).toISOString())
          .order("created_at", { ascending: false }).limit(40),
      ) as any[];
      const connections = check(
        await admin.from("coach_connections").select(
          "provider,last_synced_at,status",
        ).eq("user_id", setting.user_id).neq("status", "disconnected"),
      ) as any[];
      for (const c of connections) {
        const kind = c.provider === "google"
            ? "google_sync"
            : "github_analysis",
          period = c.provider === "google" ? 15 * 60000 : 86400000;
        if (
          !recent.some((j) =>
            j.kind === kind && Date.parse(j.created_at) > Date.now() - period
          )
        ) await enqueue(admin, setting.user_id, kind);
      }
      const kind = !careers.confirmed && !careers.skills.length
        ? "roadmap"
        : "recommendations";
      const profile = check(
        await admin.from("profiles").select("time_zone").eq(
          "user_id",
          setting.user_id,
        ).maybeSingle(),
      ) as any;
      const day =
        localParts(Date.now(), profile?.time_zone || "Asia/Seoul").date;
      const recommendations = check(
        await admin.from("coach_recommendations").select("id").eq(
          "user_id",
          setting.user_id,
        ).eq("local_date", day).in("status", ["pending", "accepted"]).gt(
          "end_at",
          new Date().toISOString(),
        ).limit(1),
      ) as any[];
      if (
        (kind === "roadmap" || careers.confirmed && !recommendations.length) &&
        !recent.some((j) =>
          j.kind === kind && Date.parse(j.created_at) > Date.now() - 30 * 60000
        )
      ) {
        await enqueue(admin, setting.user_id, kind, {
          input_version: setting.version,
        });
      }
    }
    // Sequential small batch keeps total time bounded; leases survive worker crashes.
    const jobs = check(
      await admin.rpc("coach_claim_jobs", { p_limit: 1 }),
    ) as any[];
    for (const job of jobs) {
      try {
        if (!eligible(job.user_id)) throw Error("disabled");
        if (job.kind === "google_sync") await syncGoogle(admin, job.user_id);
        else if (job.kind === "github_analysis") {
          await analyzeRepositories(admin, job.user_id);
        } else await executeCoachJob(admin, job);
        check(
          await admin.rpc("coach_finish_job", {
            p_id: job.id,
            p_lease: job.lease,
            p_status: "done",
          }),
        );
        completed++;
      } catch (error) {
        const code =
          error instanceof Error && /^[a-z_]{1,40}$/.test(error.message)
            ? error.message
            : "worker_failed";
        check(
          await admin.rpc("coach_finish_job", {
            p_id: job.id,
            p_lease: job.lease,
            p_status: "failed",
            p_error: code,
          }),
        );
        failed++;
      }
    }
    return reply({ completed, failed });
  } catch {
    return reply({ error: "Worker unavailable" }, 503);
  }
});
