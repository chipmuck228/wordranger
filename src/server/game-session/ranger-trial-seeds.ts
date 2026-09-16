import { SeededRandomSource } from "@/domain/tasks/random-source";

export function schedulerRandomSeed(gameType: string, sessionId: string): string {
  return `scheduler:${gameType}:${sessionId}`;
}

export function taskRandomSeed(
  gameType: string,
  sessionId: string,
  needId: string,
): string {
  return `task:${gameType}:${sessionId}:${needId}`;
}

export function createSchedulerRandom(
  gameType: string,
  sessionId: string,
): SeededRandomSource {
  return new SeededRandomSource(schedulerRandomSeed(gameType, sessionId));
}

export function createTaskRandom(
  gameType: string,
  sessionId: string,
  needId: string,
): SeededRandomSource {
  return new SeededRandomSource(taskRandomSeed(gameType, sessionId, needId));
}
