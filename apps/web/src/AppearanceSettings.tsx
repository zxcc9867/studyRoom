import { useId, useSyncExternalStore } from 'react';
import { getAppearanceController, type AppearancePreference } from './appearance.mjs';

const options: {value: AppearancePreference; label: string}[] = [
  {value: 'system', label: '시스템 설정'},
  {value: 'light', label: '라이트'},
  {value: 'dark', label: '다크'},
];

export default function AppearanceSettings() {
  const controller = getAppearanceController(window);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const name = useId();
  return <fieldset className="appearance-settings">
    <legend>화면 테마</legend>
    <div className="appearance-options">{options.map(option => <label key={option.value}>
      <input type="radio" name={name} value={option.value} checked={snapshot.preference === option.value} onChange={() => controller.setPreference(option.value)} />
      <span>{option.label}</span>
    </label>)}</div>
    <p>이 기기에서 사용할 화면 테마를 선택하세요.</p>
    {!snapshot.persistent && <p role="status">테마는 적용했지만 기기에 저장하지 못했어요. 다시 열면 이전 설정으로 돌아갈 수 있어요.</p>}
  </fieldset>;
}
