/**
 * Ordered fact-argument comparison. Direction matters:
 * contains(bowl, soup) is not contains(soup, bowl).
 */

import type { ContextualFactArgument } from "./types";

export function sameAuthoredAndFrameFactArgs(
  authored: readonly ContextualFactArgument[],
  frameArgs: readonly {
    kind: string;
    entityId?: string;
    roleId?: string;
    value?: string | number | boolean;
  }[],
): boolean {
  if (authored.length !== frameArgs.length) {
    return false;
  }
  return authored.every((arg, index) => {
    const frameArg = frameArgs[index];
    if (!frameArg) {
      return false;
    }
    if (arg.kind === "ENTITY") {
      return frameArg.kind === "ENTITY" && frameArg.entityId === arg.entityId;
    }
    if (arg.kind === "ROLE") {
      return frameArg.kind === "ROLE" && frameArg.roleId === arg.roleId;
    }
    return (
      (frameArg.kind === "LITERAL" || frameArg.kind === "VALUE") &&
      String(frameArg.value) === arg.value
    );
  });
}
