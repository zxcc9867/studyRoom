import { archivedCareerResponse } from "../_shared/archived-career.mjs";

// Compatibility tombstone: stale clients and old cron invocations cannot enqueue work.
Deno.serve(archivedCareerResponse);
