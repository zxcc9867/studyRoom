import {
  authenticate,
  check,
  eligible,
  enqueue,
  loadState,
  reply,
} from "../_shared/coach-store.ts";
import {
  validateCareer,
  validateEvent,
  validateSettings,
} from "../_shared/coach-domain.mjs";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return reply({});
  if (req.method !== "POST") {
    return reply({ error: "POST 요청을 사용하세요." }, 405);
  }
  try {
    const { admin, user } = await authenticate(req);
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 48000) {
          await reader.cancel();
          return reply({ error: "입력 내용이 너무 깁니다." }, 413);
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const raw = new TextDecoder().decode(bytes);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "입력 내용을 확인해 주세요." }, 400);
    }
    if (!body || typeof body.action !== "string") {
      return reply({ error: "작업을 선택해 주세요." }, 400);
    }
    if (body.action === "state" || body.action === "refresh") {
      const state = await loadState(admin, user.id);
      if (state.enabled && state.career) {
        const kind = !state.career.confirmed && !state.career.skills.length
          ? "roadmap"
          : "recommendations";
        if (
          kind === "roadmap" ||
          state.career.confirmed &&
            !state.recommendations.some((r: any) =>
              ["pending", "accepted"].includes(r.status) &&
              Date.parse(r.end_at) > Date.now()
            )
        ) {
          // Empty days remain cached too, avoiding repeated AI calls on each visit.
          const recent = state.jobs.some((j: any) =>
            j.kind === kind && j.status === "done" &&
            Date.parse(j.created_at) > Date.now() - 30 * 60000
          );
          if (!recent) {
            await enqueue(admin, user.id, kind, {
              input_version: state.settings.version,
            });
          }
        }
      }
      return reply(state);
    }
    let input: any;
    if (body.action === "settings") {
      input = validateSettings(body.settings);
      if (input.enabled && !eligible(user.id)) {
        return reply(
          { error: "현재 순차적으로 코치를 공개하고 있습니다." },
          403,
        );
      }
    } else {
      if (!eligible(user.id)) {
        return reply(
          { error: "현재 순차적으로 코치를 공개하고 있습니다." },
          403,
        );
      }
      if (body.action === "save_career") input = validateCareer(body.career);
      else if (body.action === "save_event") {
        input = validateEvent(body.event);
        if (body.event.id) input.id = body.event.id;
      } else if (
        ["accept", "feedback", "delete_event", "mute_today"].includes(
          body.action,
        )
      ) {
        input = {
          id: body.id,
          feedback: body.feedback,
          start_at: body.start_at,
        };
      } else return reply({ error: "지원하지 않는 작업입니다." }, 400);
    }
    const result = check(
      await admin.rpc("coach_mutate", {
        p_user_id: user.id,
        p_action: body.action,
        p_input: input,
      }),
    );
    if (
      ["settings", "save_career", "save_event", "delete_event"].includes(
        body.action,
      )
    ) {
      const state = await loadState(admin, user.id);
      if (state.enabled && state.career) {
        await enqueue(
          admin,
          user.id,
          !state.career.confirmed && !state.career.skills.length
            ? "roadmap"
            : "recommendations",
          { input_version: state.settings.version },
        );
      }
    }
    return reply(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "unauthorized") {
      return reply({ error: "로그인 후 이용해 주세요." }, 401);
    }
    if (["schedule_conflict", "outside_availability"].includes(message)) {
      return reply({ error: "다른 일정과 겹치거나 공부 가능 시간이 아닙니다. 다른 시간을 선택해 주세요." }, 409);
    }
    if (message === "calendar_stale") {
      return reply({ error: "캘린더를 최신 상태로 확인한 후 다시 시도해 주세요." }, 409);
    }
    if (message.startsWith("invalid_")) {
      return reply(
        { error: "입력한 날짜, 시간과 필수 항목을 확인해 주세요." },
        400,
      );
    }
    return reply({
      error:
        "저장하지 못했습니다. 일정이 변경되었을 수 있으니 새로고침 후 다시 확인해 주세요.",
    }, 409);
  }
});
