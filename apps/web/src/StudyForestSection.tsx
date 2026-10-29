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
import {
  getWeeklyHabitRewardHistory,
  type WeeklyHabitSession,
  type WeeklyHabitTargetState,
} from "./weeklyHabit.mjs";
import "./forestOverview.css";

type AttendanceDay = {
  local_date: string;
  status: "pending" | "present" | "missed";
};

type StudyForestSectionProps = {
  userId: string;
  todayDateKey: string;
  attendanceDays: AttendanceDay[];
  sessions: WeeklyHabitSession[];
  timeZone: string;
  weeklyHabitTarget: WeeklyHabitTargetState;
};

type AvatarState = StudyForestAvatarPosition & { facing: StudyForestAvatarFacing };

const MEADOW_BOUNDS = { minX: 8, maxX: 92, minY: 42, maxY: 84, step: 4 };
const MANUAL_CONTROL_MS = 8_000;

export default function StudyForestSection({
  userId,
  todayDateKey,
  attendanceDays,
  sessions,
  timeZone,
  weeklyHabitTarget,
}: StudyForestSectionProps) {
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
  const weeklyRewardHistory = useMemo(
    () => getWeeklyHabitRewardHistory({ todayDateKey, timeZone, sessions }),
    [sessions, timeZone, todayDateKey],
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
    if (event.target instanceof Element && event.target.closest(".forest-overview-details")) return;
    const movementKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"];
    if (!movementKeys.includes(event.key)) return;
    event.preventDefault();
    moveAvatar(event.key);
  }

  return (
    <section
      className="history-panel study-forest-panel forest-overview"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="공부의 숲 탐험"
      aria-describedby="forest-movement-hint"
      data-forest-theme={preferences.islandTheme}
    >
      <div className="section-heading forest-overview-heading">
        <div>
          <h2>공부의 숲</h2>
          <p className="section-description">공부를 이어갈수록 나만의 숲이 자라요.</p>
        </div>
      </div>

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
            weeklyHabitTarget={weeklyHabitTarget}
            weeklyRewardCount={weeklyRewardHistory.earnedCount}
            onMoveTarget={moveAvatarTo}
            onInteriorMoveTarget={moveInteriorAvatarTo}
            onSceneModeChange={(mode) => {
              if (mode === "interior") enterCottage();
            }}
          />
          <p id="forest-movement-hint" className="forest-movement-hint">
            장면을 클릭하거나 터치해 이동해요. 키보드는 방향키·WASD를 사용하세요.
          </p>
        </div>

        <div className="forest-status-card">
          <p className="forest-overview-label"><Sprout size={17} aria-hidden="true" /> 지금 자라는 나무</p>
          <h3>{forestState.currentTree.label}</h3>
          <p className="forest-growth-count"><strong>{forestState.currentTree.progressDays}</strong><span> / 7일</span></p>
          <div
            className="forest-progress-track"
            role="progressbar"
            aria-label="이번 나무 성장"
            aria-valuemin={0}
            aria-valuemax={7}
            aria-valuenow={forestState.currentTree.progressDays}
            aria-valuetext={`이번 나무 ${forestState.currentTree.progressDays}일, 7일이면 완성`}
          ><span style={{ width: `${progressPercent}%` }} /></div>
          <p>현재 연속 출석 {forestState.currentStreak}일 · 7일을 이어가면 한 그루가 완성돼요.</p>
          <div className="forest-next-level-card">
            <div><Sparkles size={18} aria-hidden="true" /><span>다음 변화까지 {nextLevel.remainingDays}일</span></div>
            <strong>{nextLevel.title}</strong>
            <p>{nextLevel.description}</p>
            <small className="forest-interior-unlock">집 안 보상 · {nextLevel.interiorUnlock}</small>
          </div>
          <section
            className={`forest-weekly-reward-card ${weeklyHabitTarget.targetReached ? "complete" : ""}`.trim()}
            aria-labelledby="forest-weekly-reward-title"
          >
            <div className="forest-weekly-reward-heading">
              <div>
                <p className="forest-overview-label">최근 7일 · 10분 시작</p>
                <h4 id="forest-weekly-reward-title">
                  {weeklyHabitTarget.targetReached
                    ? "이번 7일 반딧불 화환 완성"
                    : `새 반딧불 화환까지 ${weeklyHabitTarget.remainingTargetDays}일`}
                </h4>
              </div>
              <strong>{weeklyHabitTarget.creditedStartDays}/{weeklyHabitTarget.targetDays}일</strong>
            </div>
            <div
              className="forest-weekly-reward-seeds"
              role="progressbar"
              aria-label="반딧불 화환을 위한 최근 7일 시작"
              aria-valuemin={0}
              aria-valuemax={weeklyHabitTarget.targetDays}
              aria-valuenow={weeklyHabitTarget.creditedStartDays}
              aria-valuetext={`${weeklyHabitTarget.creditedStartDays}일 완료, ${weeklyHabitTarget.remainingTargetDays}일 남음`}
            >
              {Array.from({ length: weeklyHabitTarget.targetDays }, (_, index) => (
                <span
                  key={index}
                  className={index < weeklyHabitTarget.creditedStartDays ? "complete" : ""}
                  aria-hidden="true"
                >
                  <Sprout size={15} />
                </span>
              ))}
            </div>
            <p className="forest-weekly-reward-note">
              {weeklyHabitTarget.targetReached
                ? "완료 세션으로 확정된 화환은 숲에 계속 남아요."
                : "최근 7일 중 5일, 하루 10분을 시작하면 화환을 받아요."}
            </p>
          </section>
        </div>
      </div>

      <details className="forest-overview-details forest-customizer-details">
        <summary><span><MapIcon size={19} aria-hidden="true" /> 숲 꾸미기</span><small>테마 · 집 색상 · 야외 보상</small></summary>
        <section className="forest-customizer" aria-labelledby="forest-customizer-title">
          <div className="forest-customizer-heading">
            <div><h3 id="forest-customizer-title">내 숲 꾸미기</h3></div>
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
        </section>
      </details>
      {preferenceMessage && <p className="forest-customizer-message" role="status">{preferenceMessage}</p>}

      <details className="forest-overview-details forest-growth-details">
        <summary><span><TreePine size={19} aria-hidden="true" /> 성장 단계와 모은 보상</span><small>나무 {completedTreeCount}그루 · 화환 {weeklyRewardHistory.earnedCount}개</small></summary>
        <div className="forest-overview-detail-body">
          <p className="forest-collection-count">완성 나무 {completedTreeCount}그루 · 반딧불 화환 {weeklyRewardHistory.earnedCount}개</p>
          <p>완성한 나무와 보상은 숲에 계속 남아 있어요. 새로운 연속 출석으로 다음 나무를 키워보세요.</p>
          <h3>나무 성장 단계</h3>
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
      </details>

      <details className="forest-overview-details forest-help-details">
        <summary><span>숲 이용 방법</span><small>이동과 보상 안내</small></summary>
        <div className="forest-overview-detail-body">
          <h3>숲을 둘러보세요</h3>
          <p>장면을 클릭하거나 터치해 이동해요. 숲에 초점을 두고 방향키·WASD로도 움직일 수 있어요. 잠시 쉬면 캐릭터가 자동으로 산책해요.</p>
          <p>집 문으로 들어가면 안을 둘러볼 수 있어요. 나올 때도 문을 향해 걸어가세요.</p>
          <h3>나무와 화환은 이렇게 자라요</h3>
          <p>7일 연속 출석하면 나무 한 그루가 완성돼요. 출석을 쉬면 지금 자라는 나무의 연속 기록만 다시 시작해요.</p>
          <p>화환은 최근 7일 중 5일, 하루 10분을 시작하면 받을 수 있어요. 성공한 날마다 나무 둘레의 씨앗 조명이 하나씩 켜지고, 이틀은 쉬어도 괜찮아요. 진행 중인 공부는 씨앗에 먼저 반영되고, 완료 세션으로 저장되면 화환이 확정돼요.</p>
          <p>완성한 나무와 화환은 휴식 뒤에도 사라지지 않아요. 완성한 나무가 늘면 새 테마와 집 색상, 야외 보상이 열려요.</p>
        </div>
      </details>
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
