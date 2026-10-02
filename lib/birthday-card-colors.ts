export const birthdayCardBackgrounds = [
  "#ffe7f1",
  "#ffe8e7",
  "#ffeade",
  "#ffedd7",
  "#fff0d3",
  "#f9f4d4",
  "#eef7d8",
  "#e4fadf",
  "#dbfce9",
  "#d5fcf3",
  "#d3fcfe",
  "#d5faff",
  "#daf7ff",
  "#e2f4ff",
  "#ecf0ff",
  "#f6edff",
  "#ffeaff",
  "#ffe8fb",
] as const;

function preferredColorIndex(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % birthdayCardBackgrounds.length;
}

function hueDistance(left: number, right: number) {
  const distance = Math.abs(left - right) % birthdayCardBackgrounds.length;
  return Math.min(distance, birthdayCardBackgrounds.length - distance);
}

export function birthdayCardColors(seeds: readonly string[]) {
  const used = new Set<number>();

  return seeds.map((seed) => {
    const start = preferredColorIndex(seed);
    let fallback = start;

    for (let step = 0; step < birthdayCardBackgrounds.length; step += 1) {
      const colorIndex = (start + step * 5) % birthdayCardBackgrounds.length;

      if (used.has(colorIndex)) {
        continue;
      }

      fallback = colorIndex;
      const separated = [...used].every((hue) => hueDistance(hue, colorIndex) >= 4);

      if (separated) {
        used.add(colorIndex);
        return birthdayCardBackgrounds[colorIndex];
      }
    }

    used.add(fallback);
    return birthdayCardBackgrounds[fallback];
  });
}
