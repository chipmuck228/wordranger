import "server-only";

import {
  CONTEXT_LAB_ERROR_CODES,
  CONTEXT_LAB_LEARNER_ERROR_MESSAGE,
  CONTEXT_LAB_LEARNER_ERROR_TITLE,
  CONTEXT_LAB_NETWORK_MESSAGE,
  CONTEXT_LAB_STALE_MESSAGE,
  type ContextLabCurrentScreen,
  type ContextLabErrorCode,
} from "@/components/context-lab/types";

export class ContextLabError extends Error {
  readonly code: ContextLabErrorCode;
  readonly recoverable: boolean;

  constructor(
    code: ContextLabErrorCode,
    message: string,
    recoverable = false,
  ) {
    super(message);
    this.name = "ContextLabError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

export function errorScreen(
  code: ContextLabErrorCode,
  options: {
    title?: string;
    message?: string;
    recoverable?: boolean;
    detail?: string;
  } = {},
): Extract<ContextLabCurrentScreen, { kind: "ERROR" }> {
  return {
    kind: "ERROR",
    code: options.detail ? `${code}:${options.detail}` : code,
    title: options.title ?? CONTEXT_LAB_LEARNER_ERROR_TITLE,
    message: options.message ?? CONTEXT_LAB_LEARNER_ERROR_MESSAGE,
    recoverable: options.recoverable ?? false,
  };
}

export function staleRunScreen(): Extract<
  ContextLabCurrentScreen,
  { kind: "ERROR" }
> {
  return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_STALE_RUN, {
    message: CONTEXT_LAB_STALE_MESSAGE,
    recoverable: true,
  });
}

export function notFoundRunScreen(): Extract<
  ContextLabCurrentScreen,
  { kind: "ERROR" }
> {
  return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_NOT_FOUND, {
    message: CONTEXT_LAB_LEARNER_ERROR_MESSAGE,
    recoverable: true,
  });
}

export function networkErrorScreen(): Extract<
  ContextLabCurrentScreen,
  { kind: "ERROR" }
> {
  return errorScreen(CONTEXT_LAB_ERROR_CODES.NETWORK_ERROR, {
    message: CONTEXT_LAB_NETWORK_MESSAGE,
    recoverable: true,
  });
}

export function runtimeInvalidScreen(): Extract<
  ContextLabCurrentScreen,
  { kind: "ERROR" }
> {
  return errorScreen(CONTEXT_LAB_ERROR_CODES.CONTEXT_LAB_RUNTIME_INVALID, {
    recoverable: false,
  });
}
