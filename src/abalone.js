// Abalone core engine (axial hex coordinates, radius 4 board)

export const DIRS = [
  { name: 'E',  dq:  1, dr:  0 },
  { name: 'NE', dq:  1, dr: -1 },
  { name: 'NW', dq:  0, dr: -1 },
  { name: 'W',  dq: -1, dr:  0 },
  { name: 'SW', dq: -1, dr:  1 },
  { name: 'SE', dq:  0, dr:  1 },
];

export const DIR_INDEX = Object.fromEntries(DIRS.map((dir, index) => [dir.name, index]));

export function key(q, r) { return `${q},${r}`; }
export function parseKey(keyStr) { const [q, r] = keyStr.split(',').map(Number); return { q, r }; }

export function inBoard(q, r, radius = 4) {
  return Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(q + r) <= radius;
}

export function allCells(radius = 4) {
  const cells = [];
  for (let qCoord = -radius; qCoord <= radius; qCoord++) {
    for (let rCoord = -radius; rCoord <= radius; rCoord++) {
      if (inBoard(qCoord, rCoord, radius)) cells.push({ q: qCoord, r: rCoord });
    }
  }
  return cells;
}

export function neighbor(q, r, dirName) {
  const dir = DIRS[DIR_INDEX[dirName]];
  return { q: q + dir.dq, r: r + dir.dr };
}

export function add(a, b) { return { q: a.q + b.q, r: a.r + b.r }; }
export function sub(a, b) { return { q: a.q - b.q, r: a.r - b.r }; }

export function equal(a, b) { return a.q === b.q && a.r === b.r; }

export function dirOf(a, b) {
  const delta = sub(b, a);
  for (let index = 0; index < DIRS.length; index++) {
    const dir = DIRS[index];
    if (delta.q === dir.dq && delta.r === dir.dr) return dir.name;
  }
  return null;
}

export function oppDir(dirName) {
  const index = DIR_INDEX[dirName];
  return DIRS[(index + 3) % 6].name;
}

export function cloneState(state) {
  return {
    radius: state.radius,
    turn: state.turn,
    board: new Map(state.board),
    captured: { W: state.captured.W, B: state.captured.B },
  };
}

export function initialState(radius = 4) {
  const state = { radius, turn: 'W', board: new Map(), captured: { W: 0, B: 0 } };
  const cells = allCells(radius);
  // Place initial marbles (classic):
  // Top (White): r = -4 row full, r = -3 full, r = -2 center 3 (q in [0,1,2])
  // Bottom (Black): r = +4 full, r = +3 full, r = +2 center 3 (q in [-2,-1,0])
  for (const { q, r } of cells) {
    if (r === -radius) state.board.set(key(q, r), 'W');
    else if (r === -radius + 1) state.board.set(key(q, r), 'W');
    else if (r === -radius + 2 && [0, 1, 2].includes(q)) state.board.set(key(q, r), 'W');
    else if (r === radius) state.board.set(key(q, r), 'B');
    else if (r === radius - 1) state.board.set(key(q, r), 'B');
    else if (r === radius - 2 && [-2, -1, 0].includes(q)) state.board.set(key(q, r), 'B');
  }
  return state;
}

export function getAt(state, q, r) {
  return state.board.get(key(q, r));
}

export function setAt(state, q, r, value) {
  const cellKey = key(q, r);
  if (value == null) state.board.delete(cellKey); else state.board.set(cellKey, value);
}

export function groupIsLineAndContiguous(coords) {
  // coords: array of {q,r}, size 1..3
  if (coords.length <= 1) {
    return { ok: true, lineDir: null, ordered: coords.slice() };
  }
  const coordSet = new Set(coords.map(cell => key(cell.q, cell.r)));
  // Try each direction as the line direction
  for (let index = 0; index < DIRS.length; index++) {
    const dir = DIRS[index];
    // Find a potential back so that back, back+dir, back+2*dir are all in set (adjust for length)
    for (const cell of coords) {
      const next = { q: cell.q + dir.dq, r: cell.r + dir.dr };
      const next2 = { q: cell.q + 2 * dir.dq, r: cell.r + 2 * dir.dr };
      const key0 = key(cell.q, cell.r);
      const key1 = key(next.q, next.r);
      const key2 = key(next2.q, next2.r);
      if (coords.length === 2) {
        if ((coordSet.has(key1) && !coordSet.has(key2)) || (coordSet.has(key(cell.q - dir.dq, cell.r - dir.dr)) && !coordSet.has(key1))) {
          // Order as [back, front]
          const back = coordSet.has(key1) ? cell : { q: cell.q - dir.dq, r: cell.r - dir.dr };
          const front = coordSet.has(key1) ? next : cell;
          return { ok: true, lineDir: dir.name, ordered: [back, front] };
        }
      } else if (coords.length === 3) {
        if (coordSet.has(key1) && coordSet.has(key2) && !coordSet.has(key(cell.q - dir.dq, cell.r - dir.dr))) {
          return { ok: true, lineDir: dir.name, ordered: [cell, next, next2] };
        }
      }
    }
  }
  return { ok: false, lineDir: null, ordered: [] };
}

export function isPlayersGroup(state, coords, player) {
  return coords.every(cell => getAt(state, cell.q, cell.r) === player);
}

// Build up to a 3-long inline group that includes `cell`, oriented back->front along `dirName`.
function buildInlineGroupFromSingle(state, cell, dirName) {
  const player = state.turn;
  const dir = DIRS[DIR_INDEX[dirName]];
  const group = [ { q: cell.q, r: cell.r } ];

  // Add ahead (movement direction)
  let cursor = { q: cell.q + dir.dq, r: cell.r + dir.dr };
  while (group.length < 3 && inBoard(cursor.q, cursor.r, state.radius) && getAt(state, cursor.q, cursor.r) === player) {
    group.push({ q: cursor.q, r: cursor.r });
    cursor = { q: cursor.q + dir.dq, r: cursor.r + dir.dr };
  }
  return group;
}

// Broadside group building removed

function maybeAugmentInlineGroup(state, ordered, dirName, lineDir) {
  if (ordered.length !== 2) return null;
  const player = state.turn;
  const dir = DIRS[DIR_INDEX[dirName]];
  const forwardFromStart = lineDir && dirName === oppDir(lineDir);
  const front = forwardFromStart ? ordered[0] : ordered[1];
  const nextFront = { q: front.q + dir.dq, r: front.r + dir.dr };
  if (!inBoard(nextFront.q, nextFront.r, state.radius)) return null;
  const occupant = getAt(state, nextFront.q, nextFront.r);
  if (occupant !== player) return null;
  // Build augmented ordered in back->front orientation of lineDir
  if (forwardFromStart) {
    // Moving backward: new back is nextFront
    return [nextFront, ordered[0], ordered[1]];
  } else {
    // Moving forward: new front is nextFront
    return [ordered[0], ordered[1], nextFront];
  }
}

export function inlineMove(state, groupOrdered, dirName, lineDir) {
  // Returns { ok, next, pushes: n, ejected: n }
  const dir = DIRS[DIR_INDEX[dirName]];
  // Determine front-most in movement direction
  const forwardFromStart = lineDir && dirName === oppDir(lineDir);
  const frontIndex = forwardFromStart ? 0 : groupOrdered.length - 1;
  const front = groupOrdered[frontIndex];
  const player = state.turn;
  const nextFront = { q: front.q + dir.dq, r: front.r + dir.dr };
  if (!inBoard(nextFront.q, nextFront.r, state.radius)) {
    return { ok: false, reason: 'Off the board', next: null };
  }
  const nextFrontOccupant = getAt(state, nextFront.q, nextFront.r);
  if (!nextFrontOccupant) {
    // Simple slide: shift every piece one step forward along dir if spaces are free
    const nextState = cloneState(state);
    // Move in safe order to avoid overwrites
    if (forwardFromStart) {
      for (let i = 0; i < groupOrdered.length; i++) {
        const cell = groupOrdered[i];
        const target = { q: cell.q + dir.dq, r: cell.r + dir.dr };
        setAt(nextState, target.q, target.r, player);
        setAt(nextState, cell.q, cell.r, null);
      }
    } else {
      for (let i = groupOrdered.length - 1; i >= 0; i--) {
        const cell = groupOrdered[i];
        const target = { q: cell.q + dir.dq, r: cell.r + dir.dr };
        setAt(nextState, target.q, target.r, player);
        setAt(nextState, cell.q, cell.r, null);
      }
    }
    nextState.turn = player === 'W' ? 'B' : 'W';
    return { ok: true, next: nextState, pushes: 0, ejected: 0 };
  }
  if (nextFrontOccupant === player) {
    return { ok: false, reason: 'Cannot push your own marbles', next: null };
  }
  // Else opponent in front. Count contiguous opponents ahead.
  let opponentCount = 0;
  let scanPos = nextFront;
  while (inBoard(scanPos.q, scanPos.r, state.radius) && getAt(state, scanPos.q, scanPos.r) && getAt(state, scanPos.q, scanPos.r) !== player) {
    opponentCount++;
    scanPos = { q: scanPos.q + dir.dq, r: scanPos.r + dir.dr };
    if (opponentCount > 3) break; // safety
  }
  if (opponentCount >= groupOrdered.length) {
    return { ok: false, reason: 'Not enough marbles to push', next: null };
  }
  // Cell beyond opponent line
  let beyond = scanPos;
  const beyondInBoard = inBoard(beyond.q, beyond.r, state.radius);
  const beyondOccupant = beyondInBoard ? getAt(state, beyond.q, beyond.r) : null;
  if (beyondInBoard && beyondOccupant) {
    return { ok: false, reason: 'Opponent is backed', next: null };
  }
  // Execute push: move our group forward; shift opponents forward; opponents off-board get ejected
  const nextState = cloneState(state);
  // Move opponents from farthest to nearest
  let ejectedCount = 0;
  if (opponentCount > 0) {
    // Positions of opponent pieces: start at nextFront, count opponentCount steps
    const opponentPositions = [];
    let pos = nextFront;
    for (let i = 0; i < opponentCount; i++) { opponentPositions.push(pos); pos = { q: pos.q + dir.dq, r: pos.r + dir.dr }; }
    // Move from far to near
    for (let i = opponentPositions.length - 1; i >= 0; i--) {
      const from = opponentPositions[i];
      const target = { q: from.q + dir.dq, r: from.r + dir.dr };
      if (inBoard(target.q, target.r, state.radius)) {
        setAt(nextState, target.q, target.r, getAt(state, from.q, from.r));
      } else {
        // Ejected
        ejectedCount++;
      }
      setAt(nextState, from.q, from.r, null);
    }
  }
  // Move our group forward
  if (forwardFromStart) {
    for (let i = 0; i < groupOrdered.length; i++) {
      const cell = groupOrdered[i];
      const target = { q: cell.q + dir.dq, r: cell.r + dir.dr };
      setAt(nextState, target.q, target.r, player);
      setAt(nextState, cell.q, cell.r, null);
    }
  } else {
    for (let i = groupOrdered.length - 1; i >= 0; i--) {
      const cell = groupOrdered[i];
      const target = { q: cell.q + dir.dq, r: cell.r + dir.dr };
      setAt(nextState, target.q, target.r, player);
      setAt(nextState, cell.q, cell.r, null);
    }
  }
  // Update captured
  if (ejectedCount > 0) {
    nextState.captured[player] += ejectedCount;
  }
  nextState.turn = player === 'W' ? 'B' : 'W';
  return { ok: true, next: nextState, pushes: opponentCount, ejected: ejectedCount };
}

// Broadside moves removed

export function canMove(state, selection, dirName) {
  // selection: array of {q,r}
  if (selection.length === 0) return { ok: false, reason: 'Select a marble' };
  if (!isPlayersGroup(state, selection, state.turn)) return { ok: false, reason: 'Move your own marbles' };
  const { ok, lineDir, ordered } = groupIsLineAndContiguous(selection);
  if (!ok) return { ok: false, reason: 'Select contiguous line' };
  if (lineDir === null) {
    // Single marble: attempt inline by auto-extending group in the chosen direction
    const autoGroup = buildInlineGroupFromSingle(state, selection[0], dirName);
    const inlineTest = inlineMove(state, autoGroup, dirName, dirName);
    return inlineTest.ok ? { ok: true, type: 'inline' } : { ok: false, reason: inlineTest.reason || 'Illegal move' };
  }
  // If dir is colinear with lineDir (or opposite), it's an inline move
  const isInline = dirName === lineDir || dirName === oppDir(lineDir);
  if (isInline) {
    let orderedGroup = ordered;
    if (orderedGroup.length === 2) {
      const augmented = maybeAugmentInlineGroup(state, orderedGroup, dirName, lineDir);
      if (augmented) orderedGroup = augmented;
    }
    const result = inlineMove(state, orderedGroup, dirName, lineDir);
    return result.ok ? { ok: true, type: 'inline' } : { ok: false, reason: result.reason };
  }
  // Broadside moves are disabled
  return { ok: false, reason: 'Only inline moves' };
}

export function applyMove(state, selection, dirName) {
  const { ok, lineDir, ordered } = groupIsLineAndContiguous(selection);
  if (selection.length === 1 || lineDir === null) {
    // Try inline auto-extended group first
    const autoGroup = buildInlineGroupFromSingle(state, selection[0], dirName);
    return inlineMove(state, autoGroup, dirName, dirName);
  }
  const isInline = dirName === lineDir || dirName === oppDir(lineDir);
  if (isInline) {
    let orderedGroup = ordered;
    if (orderedGroup.length === 2) {
      const augmented = maybeAugmentInlineGroup(state, orderedGroup, dirName, lineDir);
      if (augmented) orderedGroup = augmented;
    }
    return inlineMove(state, orderedGroup, dirName, lineDir);
  }
  // Broadside moves are disabled
  return { ok: false, reason: 'Only inline moves', next: null };
}

export function hasWinner(state) {
  if (state.captured.W >= 6) return 'W';
  if (state.captured.B >= 6) return 'B';
  return null;
}
