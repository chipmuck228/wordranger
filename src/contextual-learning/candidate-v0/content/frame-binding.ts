import type {
  ContextualFrameBinding,
  ContextualSceneLexemeContent,
} from "./types";

export function frameBindingFor(
  lexeme: Pick<ContextualSceneLexemeContent, "membership">,
  frameId: string,
): ContextualFrameBinding | null {
  return (
    lexeme.membership.frameBindings.find((binding) => binding.frameId === frameId) ??
    null
  );
}
