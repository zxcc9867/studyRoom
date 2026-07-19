export type TimeInputPickerTarget = {
  disabled?: boolean;
  focus?: (options?: FocusOptions) => void;
  showPicker?: () => void;
};

export function openTimeInputPicker(input: TimeInputPickerTarget | null): boolean;
export function isTimeInputPickerKey(key: string): boolean;
