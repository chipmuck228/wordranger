export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function cloneFrozen<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}
