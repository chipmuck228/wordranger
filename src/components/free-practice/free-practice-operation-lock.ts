export type FreePracticeOperationLock = {
  acquire(): number | null;
  release(token: number): void;
  isHeld(): boolean;
  owner(): number | null;
};

/**
 * One in-flight mutation lock. A completion may release only the token it
 * acquired. A stale response cannot clear a newer operation's lock.
 */
export function createFreePracticeOperationLock(): FreePracticeOperationLock {
  let owner: number | null = null;
  let sequence = 0;

  return {
    acquire() {
      if (owner !== null) {
        return null;
      }
      sequence += 1;
      owner = sequence;
      return owner;
    },
    release(token) {
      if (owner === token) {
        owner = null;
      }
    },
    isHeld() {
      return owner !== null;
    },
    owner() {
      return owner;
    },
  };
}
