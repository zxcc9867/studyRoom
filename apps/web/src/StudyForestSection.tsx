import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { CheckCircle2, LockKeyhole, Map as MapIcon, Sparkles, Sprout, TreePine } from "lucide-react";

import {
  defaultForestPreferences,
  getForestCustomizationCatalog,
  normalizeForestPreferences,
  type ForestCustomizationOption,
  type ForestPreferences,
} from "./forestCustomization.mjs";
import {
  buildStudyForestState,
  forestLevelMilestones,
  getAvatarFacing,
  getAvatarStep,
  getCottageAvatarStep,
  getForestInteriorRewards,
  getNextAutoAvatarStep,
  getNextForestLevelUpdate,
  isCottageEntrancePosition,
  isCottageExitPosition,
  resolveCottageAvatarTarget,
  resolveForestAvatarTarget,
  type StudyForestAvatarFacing,
  type StudyForestAvatarPosition,
} from "./studyForest.mjs";
import { StudyForest3D } from "./StudyForest3D";
import { supabase } from "./supabase";

type AttendanceDay = {
  local_date: string;
  status: "pending" | "present" | "missed";
};

type StudyForestSectionProps = {
  userId: string;
  todayDateKey: string;
  attendanceDays: AttendanceDay[];
};

type AvatarState = StudyForestAvatarPosition & { facing: StudyForestAvatarFacing };

const MEADOW_BOUNDS = { minX: 8, maxX: 92, minY: 42, maxY: 84, step: 4 };
const MANUAL_CONTROL_MS = 8_000;

export default function StudyForestSection({ userId, todayDateKey, attendanceDays }: StudyForestSectionProps) {
  const [avatar, setAvatar] = useState<AvatarState>({ x: 52, y: 64, facing: "down" });
  const [interiorAvatar, setInteriorAvatar] = useState<AvatarState>({ x: 50, y: 80, facing: "up" });
  const [manualUntilMs, setManualUntilMs] = useState(0);
  const [sceneMode, setSceneMode] = useState<"island" | "interior">("island");
  const [preferences, setPreferences] = useState<ForestPreferences>(defaultForestPreferences);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState("");

  const forestState = useMemo(
    () => buildStudyForestState({ todayDateKey, attendanceDays }),
    [attendanceDays, todayDateKey],
  );
  const completedTreeCount = forestState.placedTrees.length;
  const progressPercent = Math.round((forestState.currentTree.progressDays / 7) * 100);
  const nextLevel = getNextForestLevelUpdate(forestState.currentTree.progressDays);
  const interiorRewards = getForestInteriorRewards(forestState.currentTree.progressDays, completedTreeCount);
  const customizationCatalog = useMemo(
    () => getForestCustomizationCatalog(completedTreeCount),
    [completedTreeCount],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadPreferences() {
      const { data, error } = await supabase
        .from("study_forest_preferences")
        .select("island_theme,cottage_accent,featured_reward")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setPreferenceMessage(`섬 꾸미기 설정을 불러오지 못했어요: ${error.message}`);
        return;
      }
      setPreferences(normalizeForestPreferences(data, completedTreeCount));
    }

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [completedTreeCount, userId]);

  useEffect(() => {
    if (sceneMode !== "island") return;
    const timer = window.setInterval(() => {
      const currentMs = Date.now();
      if (currentMs < manualUntilMs) return;
      setAvatar((current) => getNextAutoAvatarStep(current, Math.floor(currentMs / 2400), MEADOW_BOUNDS));
    }, 2200);
    return () => window.clearInterval(timer);
  }, [manualUntilMs, sceneMode]);

  async function savePreferences(next: ForestPreferences) {
    const normalized = normalizeForestPreferences(next, completedTreeCount);
    setPreferences(normalized);
    setPreferenceBusy(true);
    setPreferenceMessage("");
    try {
      const { error } = await supabase.from("study_forest_preferences").upsert({
        user_id: userId,
        island_theme: normalized.islandTheme,
        cottage_accent: normalized.cottageAccent,
        featured_reward: normalized.featuredReward,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setPreferenceMessage("섬 꾸미기 설정을 저장했어요.");
    } catch (error) {
      setPreferenceMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPreferenceBusy(false);
    }
  }

  function enterCottage() {
    setInteriorAvatar({ x: 50, y: 80, facing: "up" });
    setSceneMode("interior");
  }

  function leaveCottage() {
    setAvatar({ x: 27, y: 59, facing: "down" });
    setSceneMode("island");
    setManualUntilMs(Date.now() + MANUAL_CONTROL_MS);
  }

  function moveAvatar(key: string) {
    setManualUntilMs(Date.now() + MANUAL_CONTROL_MS);
    if (sceneMode === "interior") {
      const next = getCottageAvatarStep(interiorAvatar, key, {}, interiorRewards);
      setInteriorAvatar(next);
      if (isCottageExitPosition(next)) leaveCottage();
      return;
    }

    const movingTowardDoor = key === "ArrowUp" || key === "w" || key === "W";
    if (movingTowardDoor && isCottageEntrancePosition(avatar)) {
      enterCottage();
      return;
    }
    setAvatar(getAvatarStep(avatar, key, MEADOW_BOUNDS));
  }

  function moveAvatarTo(target: { x: number; y: number }) {
    if (sceneMode !== "island") return;
    setManualUntilMs(Date.now() + MANUAL_CONTROL_MS);
    setAvatar((current) => {
      const resolved = resolveForestAvatarTarget(current, target, MEADOW_BOUNDS);
      return { ...resolved, facing: getAvatarFacing(current, resolved) };
    });
  }

  function moveInteriorAvatarTo(target: { x: number; y: number }) {
    if (sceneMode !== "interior") return;
    setManualUntilMs(Date.now() + MANUAL_CONTROL_MS);
    const resolved = resolveCottageAvatarTarget(interiorAvatar, target, {}, interiorRewards);
    setInteriorAvatar({ ...resolved, facing: getAvatarFacing(interiorAvatar, resolved) });
    if (isCottageExitPosition(resolved)) leaveCottage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const movementKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"];
    if (!movementKeys.includes(event.key)) return;
    event.preventDefault();
    moveAvatar(event.key);
  }

  return (
    <section
      className="history-panel study-forest-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="공부의 숲 탐험"
      data-forest-theme={preferences.islandTheme}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">study forest</p>
          <h2>공부의 숲</h2>
          <p className="section-description">7일 연속 출석으로 나무와 새로운 섬 장식을 완성해 보세요.</p>
        </div>
        <div className="forest-badges">
          <span className="pill"><TreePine size={16} /> 완성 나무 {completedTreeCount}그루</span>
          <span className="pill"><Sprout size={16} /> {progressPercent}%</span>
        </div>
      </div>

      {completedTreeCount > 0 ? (
        <div className="success-message forest-celebration">
          <strong>완성한 나무와 보상은 숲에 계속 남아 있어요.</strong>
          <span>새로운 연속 출석으로 다음 나무를 키워보세요.</span>
        </div>
      ) : (
        <div className="message forest-celebration">
          <strong>첫 나무가 자라고 있어요.</strong>
          <span>7일을 이어가면 한 그루가 완성돼 숲에 남아요.</span>
        </div>
      )}

      <div className="study-forest-grid">
        <div className="study-forest-scene-card">
          <StudyForest3D
            completedTreeCount={completedTreeCount}
            currentTreeStage={forestState.currentTree.stage}
            currentTreeProgressDays={forestState.currentTree.progressDays}
            avatar={avatar}
            interiorAvatar={interiorAvatar}
            sceneMode={sceneMode}
            customization={preferences}
            onMoveTarget={moveAvatarTo}
            onInteriorMoveTarget={moveInteriorAvatarTo}
            onSceneModeChange={(mode) => {
              if (mode === "interior") enterCottage();
            }}
          />
          <div className="forest-controls" aria-label="캐릭터 이동">
            <button type="button" onClick={() => moveAvatar("ArrowUp")} aria-label="위로 이동">↑</button>
            <div>
              <button type="button" onClick={() => moveAvatar("ArrowLeft")} aria-label="왼쪽 이동">←</button>
              <button type="button" onClick={() => moveAvatar("ArrowDown")} aria-label="아래로 이동">↓</button>
              <button type="button" onClick={() => moveAvatar("ArrowRight")} aria-label="오른쪽 이동">→</button>
            </div>
            <p>방향키·WASD, 화면 터치, 위 버튼으로 섬과 집 안을 걸어보세요.</p>
          </div>
        </div>

        <div className="forest-status-card">
          <p className="eyebrow">tree status</p>
          <h3>{forestState.currentTree.label}</h3>
          <div className="forest-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
          <p>현재 연속 출석 {forestState.currentStreak}일 · 이번 나무 {forestState.currentTree.progressDays}/7일</p>
          <div className="forest-next-level-card">
            <div><Sparkles size={19} /><span>다음 변화까지 {nextLevel.remainingDays}일</span></div>
            <strong>{nextLevel.title}</strong>
            <p>{nextLevel.description}</p>
            <small className="forest-interior-unlock">집 안 보상 · {nextLevel.interiorUnlock}</small>
          </div>
          <ol className="forest-level-roadmap" aria-label="나무 성장 단계">
            {forestLevelMilestones.map((milestone) => {
              const progressDays = forestState.currentTree.progressDays;
              const state = progressDays >= milestone.days ? "complete" : nextLevel.targetDays === milestone.days ? "next" : "locked";
              return (
                <li key={milestone.days} data-state={state}>
                  <span>{milestone.days}일</span>
                  <div><strong>{milestone.label}</strong><small>{milestone.update}</small><small className="forest-interior-unlock">{milestone.interiorUnlock}</small></div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <section className="forest-customizer" aria-labelledby="forest-customizer-title">
        <div className="forest-customizer-heading">
          <div><p className="eyebrow">island atelier</p><h3 id="forest-customizer-title">내 숲 꾸미기</h3></div>
          <MapIcon size={28} />
        </div>
        <CustomizationGroup
          title="섬 테마"
          options={customizationCatalog.themes}
          selected={preferences.islandTheme}
          busy={preferenceBusy}
          onSelect={(islandTheme) => void savePreferences({ ...preferences, islandTheme })}
        />
        <CustomizationGroup
          title="집 포인트 색상"
          options={customizationCatalog.accents}
          selected={preferences.cottageAccent}
          busy={preferenceBusy}
          onSelect={(cottageAccent) => void savePreferences({ ...preferences, cottageAccent })}
        />
        <CustomizationGroup
          title="대표 야외 보상"
          options={customizationCatalog.rewards}
          selected={preferences.featuredReward}
          busy={preferenceBusy}
          onSelect={(featuredReward) => void savePreferences({ ...preferences, featuredReward })}
        />
        {preferenceMessage && <p className="forest-customizer-message" role="status">{preferenceMessage}</p>}
      </section>
    </section>
  );
}

function CustomizationGroup<T extends string>({ title, options, selected, busy, onSelect }: {
  title: string;
  options: Array<ForestCustomizationOption<T> & { unlocked: boolean; remainingTrees: number }>;
  selected: T;
  busy: boolean;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="forest-customizer-group">
      <div className="forest-customizer-category-heading">
        <strong>{title}</strong>
        <small>컬렉션에서 아이템을 선택하세요</small>
      </div>
      <div className="forest-customizer-options">
        {options.map((option) => {
          const isSelected = selected === option.id;
          const cardLabel = option.unlocked ? option.label : "잠긴 비밀 아이템";
          return (
            <button
              type="button"
              key={option.id}
              className={`forest-item-card ${isSelected ? "selected" : ""}`}
              disabled={busy || !option.unlocked}
              aria-label={option.unlocked ? option.label : `${cardLabel}, 완성 나무 ${option.remainingTrees}그루 후 공개`}
              aria-pressed={option.unlocked ? isSelected : undefined}
              onClick={() => onSelect(option.id)}
            >
              <span className="forest-item-state" aria-hidden="true">
                {isSelected ? <CheckCircle2 size={17} /> : option.unlocked ? <Sparkles size={17} /> : <LockKeyhole size={17} />}
              </span>
              <span
                className="forest-item-orb"
                data-locked={!option.unlocked}
                style={option.color ? { color: option.color } : undefined}
              >
                <span aria-hidden="true">{option.unlocked ? option.symbol : "?"}</span>
              </span>
              <span className="forest-item-copy">
                <b>{option.unlocked ? option.label : "비밀 아이템"}</b>
                <small>
                  {option.unlocked ? option.description ?? "선택해서 바로 적용해요." : `완성 나무 ${option.remainingTrees}그루 후 공개`}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}