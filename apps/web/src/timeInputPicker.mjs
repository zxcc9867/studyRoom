export function openTimeInputPicker(input) {
  if (!input || input.disabled) return false;

  input.focus?.({ preventScroll: true });
  if (typeof input.showPicker !== "function") return false;

  try {
    input.showPicker();
    return true;
  } catch {
    return false;
  }
}

export function isTimeInputPickerKey(key) {
  return key === "Enter" || key === " ";
}
