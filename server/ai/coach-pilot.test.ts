import {
  eligible,
  loadPilotUsers,
} from "../../supabase/functions/_shared/coach-store.ts";

function admin(rows: string[], error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        limit: async () => ({
          data: rows.map((user_id) => ({ user_id })),
          error,
        }),
      }),
    }),
  };
}
function assert(value: boolean) {
  if (!value) throw Error("assertion failed");
}

Deno.test("pilot removals take effect on the next request", async () => {
  const previous = Deno.env.get("COACH_PILOT_USER_IDS");
  try {
    Deno.env.delete("COACH_PILOT_USER_IDS");
    await loadPilotUsers(admin(["pilot"]));
    assert(eligible("pilot"));
    await loadPilotUsers(admin([]));
    assert(!eligible("pilot"));
  } finally {
    previous === undefined
      ? Deno.env.delete("COACH_PILOT_USER_IDS")
      : Deno.env.set("COACH_PILOT_USER_IDS", previous);
  }
});

Deno.test("explicit empty environment disables database pilots", async () => {
  const previous = Deno.env.get("COACH_PILOT_USER_IDS");
  try {
    Deno.env.set("COACH_PILOT_USER_IDS", "");
    await loadPilotUsers(admin(["pilot"]));
    assert(!eligible("pilot"));
    Deno.env.set("COACH_PILOT_USER_IDS", "env-pilot");
    await loadPilotUsers(admin(["pilot"]));
    assert(eligible("env-pilot") && !eligible("pilot"));
  } finally {
    previous === undefined
      ? Deno.env.delete("COACH_PILOT_USER_IDS")
      : Deno.env.set("COACH_PILOT_USER_IDS", previous);
  }
});

Deno.test("allowlist read failure clears previously granted access", async () => {
  const previous = Deno.env.get("COACH_PILOT_USER_IDS");
  try {
    Deno.env.delete("COACH_PILOT_USER_IDS");
    await loadPilotUsers(admin(["pilot"]));
    let failed = false;
    try {
      await loadPilotUsers(admin([], { message: "storage failure" }));
    } catch {
      failed = true;
    }
    assert(failed && !eligible("pilot"));
  } finally {
    previous === undefined
      ? Deno.env.delete("COACH_PILOT_USER_IDS")
      : Deno.env.set("COACH_PILOT_USER_IDS", previous);
  }
});
