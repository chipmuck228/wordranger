import { SeededRandomSource } from "@/domain/tasks/random-source";

export function schedulerRandomSeed(sessionId: string): string {
  return `scheduler:${sessionId}`;
}

export function taskRandomSeed(sessionId: string, needId: string): string {
  return `task:${sessionId}:${needId}`;
}

export function createSchedulerRandom(sessionId: string): SeededRandomSource {
  return new SeededRandomSource(schedulerRandomSeed(sessionId));
}

export function createTaskRandom(
  sessionId: string,
  needId: string,
): SeededRandomSource {
  return new SeededRandomSource(taskRandomSeed(sessionId, needId));
}
