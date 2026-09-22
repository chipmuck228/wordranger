"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReleaseWorkspace } from "@/server/contextual-content-release/types";
import {
  createMigrationDraftAction,
  discardLocalDraftAction,
  preflightReleaseAction,
  publishReleaseAction,
  rollbackActiveReleaseAction,
} from "./actions";

function Fingerprint({ value }: { value: string | null }) {
  return <span className="break-all font-mono text-xs">{value ?? "—"}</span>;
}

export function ReleaseWorkspace({
  initial,
}: {
  initial: ReleaseWorkspace;
}) {
  const [workspace, setWorkspace] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "publish" | "rollback">(null);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  async function run(
    work: () => Promise<{ ok: boolean; message?: string; workspace?: ReleaseWorkspace }>,
  ) {
    setBusy(true);
    try {
      const result = await work();
      if (result.workspace) {
        setWorkspace(result.workspace);
      }
      setMessage(
        result.ok
          ? "已从服务端重新加载状态。这是 Experimental Context Lab 内容发布，不会发布到 /train，不代表学习完成，也不修改 Evidence 或掌握度。"
          : result.message ?? "操作失败",
      );
      if (!result.ok) {
        setConfirm(null);
        setConfirmTarget(null);
      }
    } finally {
      setBusy(false);
    }
  }

  const draft = workspace.draft;
  const pointer = workspace.activePointer;
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 overflow-x-hidden px-4 py-8">
      <header className="space-y-2">
        <p className="text-muted-foreground text-xs">内部内容发布</p>
        <h1 className="text-2xl font-semibold">内容发布工具</h1>
        <p data-testid="release-phase-notice" className="text-sm">
          这是 Experimental Context Lab 内容发布。不会发布到 /train，不代表学习完成，也不修改学习 Evidence 或掌握度。
        </p>
        <p data-testid="release-not-published" className="text-sm">
          {workspace.currentRuntime.notice}
        </p>
      </header>

      <section className="space-y-2" aria-labelledby="runtime-heading">
        <h2 id="runtime-heading" className="text-lg font-medium">
          当前 runtime
        </h2>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Content source</dt>
            <dd data-testid="release-content-source">{workspace.currentRuntime.contentSource}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Current runtime</dt>
            <dd data-testid="release-current-runtime">{workspace.currentRuntime.driver}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">当前 pack ID</dt>
            <dd data-testid="release-current-pack">{workspace.currentRuntime.packId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">active pointer revision</dt>
            <dd data-testid="release-pointer-revision">{pointer?.revision ?? "—"}</dd>
          </div>
        </dl>
        <ul className="text-sm">
          {workspace.registry.map((entry) => (
            <li key={entry.packId} data-testid={`release-registry-${entry.packId}`}>
              {entry.packId}: {entry.status} / {entry.approvalBasis}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2" aria-labelledby="targets-heading">
        <h2 id="targets-heading" className="text-lg font-medium">
          六个 targets
        </h2>
        <ol data-testid="release-live-targets" className="space-y-3">
          {workspace.liveTargets.map((target, index) => (
            <li
              key={target.reviewKey}
              data-testid={`release-live-target-${index}`}
              className="bg-card rounded-2xl px-4 py-3 text-sm shadow-sm ring-1 ring-black/5"
            >
              <p className="font-medium">
                {index + 1}. {target.displayLabel} / {target.senseId}
              </p>
              <p>review source: {target.reviewSource}</p>
              <p>
                fingerprint: <Fingerprint value={target.contentFingerprint} />
              </p>
              <p>review revision: {target.reviewRevision}</p>
              <p>approval basis: {target.approvalBasis}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3" aria-labelledby="releases-heading">
        <h2 id="releases-heading" className="text-lg font-medium">
          Releases
        </h2>
        {workspace.releases.length === 0 ? (
          <p data-testid="release-no-draft" className="text-muted-foreground text-sm">
            还没有本地 Draft。
          </p>
        ) : null}
        <ol data-testid="release-list" className="space-y-3">
          {workspace.releases.map((item) => (
            <li
              key={item.releaseId}
              data-testid={`release-card-${item.releaseId}`}
              className="rounded-2xl px-4 py-3 text-sm ring-1 ring-black/5"
            >
              <dl className="grid gap-2 md:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">release id</dt>
                  <dd data-testid={item.releaseId === draft?.releaseId ? "release-id" : undefined}>
                    {item.releaseId}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">scene id</dt>
                  <dd>{item.sceneId}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">status</dt>
                  <dd data-testid={item.releaseId === draft?.releaseId ? "release-status" : `release-status-${item.releaseId}`}>
                    {item.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">revision</dt>
                  <dd data-testid={item.releaseId === draft?.releaseId ? "release-revision" : undefined}>
                    {item.revision}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">target 数量</dt>
                  <dd data-testid={item.releaseId === draft?.releaseId ? "release-target-count" : undefined}>
                    {item.targetCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ACTIVE</dt>
                  <dd data-testid={`release-active-${item.releaseId}`}>
                    {item.isActive ? "ACTIVE" : "not active"}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">approval-chain</dt>
                  <dd data-testid={item.releaseId === draft?.releaseId ? "release-approval-summary" : undefined}>
                    {item.approvalSummary}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">pack fingerprint</dt>
                  <dd>
                    <Fingerprint value={item.packFingerprint} />
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">release fingerprint</dt>
                  <dd data-testid={item.releaseId === draft?.releaseId ? "release-fingerprint" : undefined}>
                    <Fingerprint value={item.releaseFingerprint} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">publishedAt</dt>
                  <dd>{item.publishedAt ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">supersededAt</dt>
                  <dd>{item.supersededAt ?? "—"}</dd>
                </div>
              </dl>
              {item.isActive ? (
                <p className="mt-2 text-sm font-medium" data-testid="release-active-badge">
                  当前 ACTIVE。不重复 Publish。
                </p>
              ) : null}
              {item.status === "DRAFT" ? (
                <Button
                  type="button"
                  className="mt-3"
                  variant="secondary"
                  disabled={!workspace.writeEnabled || busy}
                  onClick={() =>
                    run(() =>
                      preflightReleaseAction({
                        releaseId: item.releaseId,
                        revision: item.revision,
                      }),
                    )
                  }
                >
                  运行 Preflight
                </Button>
              ) : null}
              {item.status === "PREFLIGHT_VALIDATED" ? (
                confirm === "publish" && confirmTarget === item.releaseId ? (
                  <Button
                    type="button"
                    className="mt-3"
                    disabled={!workspace.writeEnabled || busy}
                    data-testid="release-publish-confirm"
                    onClick={() =>
                      run(() =>
                        publishReleaseAction({
                          releaseId: item.releaseId,
                          revision: item.revision,
                        }),
                      )
                    }
                  >
                    确认 Publish
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="mt-3"
                    disabled={!workspace.writeEnabled || busy}
                    data-testid="release-publish"
                    onClick={() => {
                      setConfirm("publish");
                      setConfirmTarget(item.releaseId);
                    }}
                  >
                    Publish
                  </Button>
                )
              ) : null}
              {(item.status === "PUBLISHED" || item.status === "SUPERSEDED") &&
              !item.isActive &&
              pointer ? (
                confirm === "rollback" && confirmTarget === item.releaseId ? (
                  <Button
                    type="button"
                    className="mt-3"
                    variant="secondary"
                    disabled={!workspace.writeEnabled || busy}
                    data-testid="release-rollback-confirm"
                    onClick={() =>
                      run(() =>
                        rollbackActiveReleaseAction({
                          sceneId: item.sceneId,
                          expectedPointerRevision: pointer.revision,
                          targetReleaseId: item.releaseId,
                        }),
                      )
                    }
                  >
                    确认回滚到此版本
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="mt-3"
                    variant="secondary"
                    disabled={!workspace.writeEnabled || busy}
                    data-testid={`release-rollback-${item.releaseId}`}
                    onClick={() => {
                      setConfirm("rollback");
                      setConfirmTarget(item.releaseId);
                    }}
                  >
                    设为活动版本/回滚到此版本
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {draft ? (
        <section className="space-y-2" aria-labelledby="draft-heading">
          <h2 id="draft-heading" className="text-lg font-medium">
            当前可编辑 release
          </h2>
          <p data-testid="release-target-order" className="text-sm">
            {draft.targetEntries.map((item) => item.displayLabel).join(" → ")}
          </p>
          <p data-testid="release-pack-fingerprint" className="text-sm">
            <Fingerprint value={workspace.fingerprints.packFingerprint} />
          </p>
          <p data-testid="release-context-fingerprint" className="text-sm">
            <Fingerprint value={workspace.fingerprints.contextModelFingerprint} />
          </p>
          <ol data-testid="release-draft-targets" className="space-y-3">
            {draft.targetEntries.map((target, index) => (
              <li
                key={target.reviewKey}
                data-testid={`release-draft-target-${index}`}
                className="rounded-2xl px-4 py-3 text-sm ring-1 ring-black/5"
              >
                <p className="font-medium">
                  {target.displayLabel} / {target.target.senseId}
                </p>
                <p>review source: {target.approvalBasis}</p>
                <p>
                  fingerprint: <Fingerprint value={target.contentFingerprint} />
                </p>
                <p>review revision: {target.reviewRevision}</p>
                <p>approval basis: {target.approvalBasis}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="space-y-2" aria-labelledby="preflight-heading">
        <h2 id="preflight-heading" className="text-lg font-medium">
          Preflight结果
        </h2>
        <p data-testid="release-preflight-status" className="text-sm">
          {workspace.preflight.ok === true
            ? "PASS"
            : workspace.preflight.ok === false
              ? "FAIL"
              : "NOT_RUN"}
        </p>
        <ul data-testid="release-preflight-issues" className="space-y-1 text-sm">
          {workspace.preflight.issues.map((item, index) => (
            <li key={`${item.code}-${index}`}>
              {item.code}: {item.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-lg font-medium">
          操作
        </h2>
        {!workspace.writeEnabled ? (
          <p data-testid="release-readonly" className="text-muted-foreground text-sm">
            只读模式。写入需要本地 CONTEXTUAL_CONTENT_RELEASE_WRITE_ENABLED=1。
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            type="button"
            disabled={!workspace.writeEnabled || busy}
            onClick={() => run(() => createMigrationDraftAction())}
          >
            创建迁移 Draft
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => window.location.reload()}
          >
            刷新
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!workspace.writeEnabled || busy || !draft || draft.status === "PUBLISHED"}
            onClick={() =>
              run(() =>
                discardLocalDraftAction({
                  releaseId: draft!.releaseId,
                  revision: draft!.revision,
                }),
              )
            }
          >
            放弃本地 Draft
          </Button>
        </div>
        <p data-testid="release-action-message" className="text-sm">
          {message}
        </p>
        <p data-testid="release-no-train" className="text-muted-foreground text-sm">
          危险操作需要确认，点击后立即禁用，失败不会乐观更新为成功。不会写入 /train。
        </p>
      </section>
    </div>
  );
}
