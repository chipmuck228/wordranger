import type { ContentReviewStep } from "@/server/contextual-content-review/types";

export function ReviewStepPanel({
  step,
  hideTargetForm,
  targetForm,
}: {
  step: ContentReviewStep;
  hideTargetForm: boolean;
  targetForm: string;
}) {
  const presentation = step.student.presentation;
  const showForm = !hideTargetForm && Boolean(presentation?.displayForm);
  return (
    <article
      data-review-step={step.stage}
      data-review-title={step.title}
      className="grid min-w-0 gap-4 overflow-x-hidden rounded-3xl ring-1 ring-black/5 md:grid-cols-2"
    >
      <section aria-label="学生看到的内容" className="bg-card min-w-0 p-4">
        <h3 className="mb-2 text-sm font-medium">{step.title}</h3>
        <p className="text-sm leading-relaxed">{step.student.instruction}</p>
        {showForm ? (
          <div className="bg-muted/50 mt-3 rounded-2xl px-3 py-3">
            <p className="text-muted-foreground text-xs">教学曝光，不是独立回忆</p>
            <p className="mt-1 text-lg font-semibold">{presentation?.displayForm}</p>
            {presentation?.meaningGloss ? <p className="mt-1">{presentation.meaningGloss}</p> : null}
            {presentation?.phonetic ? (
              <p className="text-muted-foreground mt-1">{presentation.phonetic}</p>
            ) : null}
          </div>
        ) : null}
        {presentation?.spellingCue ? (
          <p aria-label="拼写提示" className="mt-3 font-mono text-lg tracking-widest">
            {presentation.spellingCue}
          </p>
        ) : null}
        {presentation?.relationCaption ? (
          <p className="mt-3 text-sm">{presentation.relationCaption}</p>
        ) : null}
        {presentation?.contrastCaption ? (
          <p className="mt-3 text-sm">{presentation.contrastCaption}</p>
        ) : null}
        {step.student.frozenTaskPreview ? (
          <div className="mt-3 space-y-2">
            <p className="text-muted-foreground text-xs">
              {step.student.frozenTaskPreview.taskType} · 预览，不可提交
            </p>
            <input
              disabled
              className="border-border h-11 w-full rounded-lg border px-3 text-sm"
              placeholder={
                step.student.frozenTaskPreview.responseContract.kind === "TEXT_INPUT"
                  ? step.student.frozenTaskPreview.responseContract.placeholder
                  : "不可提交"
              }
              aria-label="回忆预览输入"
            />
          </div>
        ) : null}
      </section>
      <aside aria-label="审核信息" className="bg-muted/30 min-w-0 p-4 text-sm">
        <dl className="space-y-1 break-words">
          <div>
            <dt className="text-muted-foreground">step ID</dt>
            <dd>{step.audit.stepId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">purpose</dt>
            <dd>{step.audit.purpose}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">guided / assessable</dt>
            <dd>{step.audit.guidedOrAssessable}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">presented entity IDs</dt>
            <dd>{step.audit.presentedEntityIds.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">presented fact predicates</dt>
            <dd>{step.audit.presentedFactPredicates.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">support exposure</dt>
            <dd>{step.audit.supportExposure.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">lexical form visible</dt>
            <dd>{step.audit.lexicalFormVisible ? "yes" : "no"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">answer leakage</dt>
            <dd data-leakage={step.audit.answerLeakage}>{step.audit.answerLeakage}</dd>
          </div>
        </dl>
        {hideTargetForm ? (
          <p className="text-muted-foreground mt-3 text-xs">
            学生区不得出现目标词形 {targetForm ? "（已隐藏）" : ""}。
          </p>
        ) : null}
      </aside>
    </article>
  );
}
