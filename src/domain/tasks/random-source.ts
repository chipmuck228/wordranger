export interface RandomSource {
  next(): number;
}

export class SeededRandomSource implements RandomSource {
  private state: number;
  readonly seed: string;

  constructor(seed: string) {
    this.seed = seed;
    this.state = hashSeed(seed);
  }

  next(): number {
    this.state = Math.imul(this.state ^ (this.state >>> 16), 2246822507);
    this.state = Math.imul(this.state ^ (this.state >>> 13), 3266489909);
    const value = (this.state ^= this.state >>> 16) >>> 0;
    return value / 4294967296;
  }
}

export class DefaultRandomSource implements RandomSource {
  next(): number {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0] / 4294967296;
  }
}

function hashSeed(seed: string): number {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

export function shuffleInPlace<T>(items: T[], random: RandomSource): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    const current = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = current;
  }
  return items;
}
