import { Medal, Trophy } from "lucide-react";
import { getGoalAchievements, type GoalAchievementLike } from "./goalAchievements.mjs";
import "./goalAchievements.css";

type Props = { goals: readonly GoalAchievementLike[] };

export default function GoalAchievementBadges({ goals }: Props) {
  const achievements = getGoalAchievements(goals);

  return (
    <section className="goal-achievements" aria-labelledby="goal-achievements-title">
      <div className="goal-achievements-heading">
        <div>
          <p className="eyebrow">MY ACHIEVEMENTS</p>
          <h2 id="goal-achievements-title"><Trophy size={25} aria-hidden="true" />달성한 목표 <span>{achievements.length}개</span></h2>
        </div>
        <a className="goal-achievements-link" href="#goals">목표 관리</a>
      </div>
      {achievements.length > 0 ? (
        <>
          <p className="goal-achievements-description">직접 달성한 목표가 배지로 모였어요.</p>
          <ul className="goal-achievements-grid">
            {achievements.map((goal) => (
              <li className="goal-achievement-badge" key={goal.id}>
                <span className="goal-achievement-medal"><Medal size={34} aria-hidden="true" /></span>
                <div className="goal-achievement-copy">
                  <span className="goal-achievement-label">목표 달성</span>
                  <h3>{goal.title}</h3>
                </div>
              </li>
            ))}
          </ul>
          <p className="goal-achievements-note">목표를 다시 진행하거나 삭제하면 해당 배지도 사라져요.</p>
        </>
      ) : (
        <div className="goal-achievements-empty">
          <Medal size={36} aria-hidden="true" />
          <p>첫 번째 목표 달성 배지를 모아보세요.</p>
          <span>목표를 이뤘다면 목표 관리에서 ‘목표 달성’을 눌러주세요.</span>
        </div>
      )}
    </section>
  );
}
