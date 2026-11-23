// Seeded, deterministic randomness. Everything procedural in the game flows
// through here so a `?seed=` URL always reproduces the same heist.

export function hashSeed(str) {
  let h = 1779033703 ^ String(str).length;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export class RNG {
  constructor(seed) {
    this.s = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  }

  /** Float in [0, 1). mulberry32. */
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) {
    return a + (b - a) * this.next();
  }

  /** Integer in [a, b] inclusive. */
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted(items, weightOf) {
    let total = 0;
    for (const it of items) total += weightOf(it);
    let r = this.next() * total;
    for (const it of items) {
      r -= weightOf(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  fork(label) {
    return new RNG(hashSeed(`${this.s}:${label}`));
  }
}

export function randomSeedString() {
  const a = ['velvet', 'quiet', 'midnight', 'silent', 'sneaky', 'shadow', 'tiptoe', 'hushed', 'ghost', 'feather'];
  const b = ['otter', 'croissant', 'magpie', 'ferret', 'raccoon', 'duck', 'gecko', 'moth', 'pigeon', 'badger'];
  const r = () => Math.floor(Math.random() * 10);
  return `${a[r()]}-${b[r()]}-${Math.floor(Math.random() * 900 + 100)}`;
}
