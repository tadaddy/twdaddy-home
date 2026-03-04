const SUITS = ['m', 'p', 's'];
const HONOR = 'z';

function buildWall() {
  const wall = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let i = 0; i < 4; i += 1) wall.push(`${suit}${rank}`);
    }
  }
  for (let rank = 1; rank <= 7; rank += 1) {
    for (let i = 0; i < 4; i += 1) wall.push(`${HONOR}${rank}`);
  }
  return shuffle(wall);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function countTiles(tiles) {
  const m = new Map();
  for (const t of tiles) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

function serializeCounts(map) {
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function canHu(tiles) {
  if (tiles.length % 3 !== 2) return false;
  const counts = countTiles(tiles);
  const entries = serializeCounts(counts);

  for (const [tile, c] of entries) {
    if (c < 2) continue;
    counts.set(tile, c - 2);
    if (canMeldAll(counts)) {
      counts.set(tile, c);
      return true;
    }
    counts.set(tile, c);
  }
  return false;
}

function canMeldAll(counts) {
  let first = null;
  for (const [tile, count] of serializeCounts(counts)) {
    if (count > 0) {
      first = tile;
      break;
    }
  }
  if (!first) return true;

  const c = counts.get(first);
  if (c >= 3) {
    counts.set(first, c - 3);
    if (canMeldAll(counts)) {
      counts.set(first, c);
      return true;
    }
    counts.set(first, c);
  }

  const suit = first[0];
  const rank = Number(first.slice(1));
  if (suit !== HONOR && rank <= 7) {
    const t2 = `${suit}${rank + 1}`;
    const t3 = `${suit}${rank + 2}`;
    if ((counts.get(t2) || 0) > 0 && (counts.get(t3) || 0) > 0) {
      counts.set(first, (counts.get(first) || 0) - 1);
      counts.set(t2, (counts.get(t2) || 0) - 1);
      counts.set(t3, (counts.get(t3) || 0) - 1);
      if (canMeldAll(counts)) {
        counts.set(first, (counts.get(first) || 0) + 1);
        counts.set(t2, (counts.get(t2) || 0) + 1);
        counts.set(t3, (counts.get(t3) || 0) + 1);
        return true;
      }
      counts.set(first, (counts.get(first) || 0) + 1);
      counts.set(t2, (counts.get(t2) || 0) + 1);
      counts.set(t3, (counts.get(t3) || 0) + 1);
    }
  }

  return false;
}

function canPeng(hand, tile) {
  return hand.filter((t) => t === tile).length >= 2;
}

function canChi(hand, tile) {
  const suit = tile[0];
  const rank = Number(tile.slice(1));
  if (suit === HONOR) return [];
  const set = new Set(hand);
  const options = [];
  const patterns = [
    [rank - 2, rank - 1],
    [rank - 1, rank + 1],
    [rank + 1, rank + 2],
  ];
  for (const [a, b] of patterns) {
    if (a < 1 || b > 9) continue;
    const t1 = `${suit}${a}`;
    const t2 = `${suit}${b}`;
    if (set.has(t1) && set.has(t2)) options.push([t1, t2]);
  }
  return options;
}

function sortTiles(tiles) {
  const suitOrder = { m: 0, p: 1, s: 2, z: 3 };
  return [...tiles].sort((a, b) => {
    const sa = suitOrder[a[0]] - suitOrder[b[0]];
    if (sa !== 0) return sa;
    return Number(a.slice(1)) - Number(b.slice(1));
  });
}

module.exports = {
  buildWall,
  canHu,
  canPeng,
  canChi,
  sortTiles,
};
