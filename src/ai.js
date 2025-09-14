import { allCells, getAt, canMove, applyMove, hasWinner, key, inBoard } from './abalone.js';

export function legalMoves(state) {
  // List all legal inline moves for the current player
  const moves = [];
  for (const { q, r } of allCells(state.radius)) {
    const v = getAt(state, q, r);
    if (v !== state.turn) continue;
    for (const dir of ['E','NE','NW','W','SW','SE']) {
      const check = canMove(state, [{ q, r }], dir);
      if (check.ok) moves.push({ selection: [{ q, r }], dir });
    }
  }
  return moves;
}

function hexDistanceToCenter(q, r) {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

function distanceToEdge(state, q, r) {
  const R = state.radius;
  const maxCoord = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
  return R - maxCoord;
}

export function evaluate(state, player) {
  const me = player;
  const op = player === 'W' ? 'B' : 'W';

  const captured = (state.captured[me] - state.captured[op]) * 100;

  let meCount = 0, opCount = 0, meCenter = 0, opCenter = 0;
  let meEdgeSafety = 0, opEdgeSafety = 0;

  for (const { q, r } of allCells(state.radius)) {
    const v = getAt(state, q, r);
    if (!v) continue;
    const dist = hexDistanceToCenter(q, r);
    const centerScore = (state.radius - dist);
    const edgeDist = distanceToEdge(state, q, r);
    if (v === me) {
      meCount++;
      meCenter += centerScore;
      meEdgeSafety += edgeDist;
    } else if (v === op) {
      opCount++;
      opCenter += centerScore;
      opEdgeSafety += edgeDist;
    }
  }

  const material = (meCount - opCount) * 10;
  const center = (meCenter - opCenter) * 0.5;
  const edge = (meEdgeSafety - opEdgeSafety) * 2.0;

  return captured + material + center + edge;
}

function isTerminal(state) { return !!hasWinner(state); }

function negamax(state, depth, alpha, beta, player) {
  const winner = hasWinner(state);
  if (winner) {
    const val = winner === player ? 100000 : -100000;
    return { value: val, move: null };
  }
  if (depth === 0) {
    return { value: evaluate(state, player), move: null };
  }
  const moves = legalMoves(state);
  if (moves.length === 0) {
    // Prevent ending up in a state with no moves
    return { value: -50000, move: null };
  }
  let bestVal = -Infinity;
  let bestMove = moves[0];
  for (const m of moves) {
    const res = applyMove(state, m.selection, m.dir);
    if (!res.ok || !res.next) continue;
    const child = negamax(res.next, depth - 1, -beta, -alpha, player);
    const val = -child.value;
    if (val > bestVal) {
      bestVal = val;
      bestMove = m;
    }
    if (val > alpha) alpha = val;
    if (alpha >= beta) break;
  }
  return { value: bestVal, move: bestMove };
}

export function chooseMove(state, options = {}) {
  const { depth = 2 } = options;
  return negamax(state, depth, -Infinity, Infinity, state.turn);
}
