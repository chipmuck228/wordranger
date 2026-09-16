import { ChoiceTaskRenderer } from "./ChoiceTaskRenderer";
import { TextInputTaskRenderer } from "./TextInputTaskRenderer";
import type { LearningTaskRendererProps } from "./types";

export function RangerTrialTask(props: LearningTaskRendererProps) {
  if (props.task.responseContract.kind === "CHOICE") {
    return <ChoiceTaskRenderer {...props} />;
  }
  if (props.task.responseContract.kind === "TEXT_INPUT") {
    return <TextInputTaskRenderer {...props} />;
  }
  return null;
}
