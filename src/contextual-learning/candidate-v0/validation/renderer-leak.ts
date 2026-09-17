import { FORBIDDEN_RENDERER_ACTIONS } from "../domain/types";

const RENDERER_TOKEN =
  /\b(click|tap|drag|press[_-]?button|open[_-]?modal|canvas|reactcomponent|onclick|screen[-_]?coord)\b/i;

const COORDINATE_KEY = /^(x|y|left|top|clientX|clientY|pageX|pageY)$/;

export function textLeaksRenderer(value: string): boolean {
  if (RENDERER_TOKEN.test(value)) {
    return true;
  }
  return FORBIDDEN_RENDERER_ACTIONS.some((action) =>
    value.toUpperCase().includes(action),
  );
}

export function attributesLeakRenderer(
  attributes: Record<string, string | number | boolean> | undefined,
): boolean {
  if (!attributes) {
    return false;
  }
  return Object.keys(attributes).some((key) => COORDINATE_KEY.test(key));
}

export function collectTextLeaves(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextLeaves(item, acc);
    }
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectTextLeaves(item, acc);
    }
  }
  return acc;
}
