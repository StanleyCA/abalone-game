import { initialState, allCells, key, getAt, setAt, DIRS, DIR_INDEX, canMove, applyMove, hasWinner, inBoard } from './abalone.js';
import { chooseMove } from './ai.js';
import { startConfetti, stopConfetti, isConfettiActive } from './confetti.js';

const size = 32; // hex radius in px
const SQRT3 = Math.sqrt(3);

function axialToPixel(q, r) {
  const x = size * SQRT3 * (q + r / 2);
  const y = size * 1.5 * r;
  return { x, y };
}

function hexPolygonPath(cx, cy, s) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 30); // pointy top
    const x = cx + s * Math.cos(angle);
    const y = cy + s * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(' ');
}

const ui = {
  state: initialState(),
  selection: [], // array of {q,r}
  cells: [],
  svg: null,
  radius: 4,
  drag: { active: false, startX: 0, startY: 0, startCell: null, pointerId: null, hintedDir: null, didDrag: false },
  confettiStarted: false,
  animating: false,
  ai: { side: 'B', enabled: false, depth: 2, thinking: false },
};

function centerAndScale(cells) {
  const pts = cells.map(c => axialToPixel(c.q, c.r));
  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxY = Math.max(...pts.map(p => p.y));
  const width = maxX - minX + size * 2.4;
  const height = maxY - minY + size * 2.4;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { viewBox: `${(cx - width / 2).toFixed(2)} ${(cy - height / 2).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}` };
}

function renderBoard() {
  const container = document.getElementById('board-container');
  container.innerHTML = '';
  ui.cells = allCells(ui.radius);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('board');
  svg.setAttribute('viewBox', centerAndScale(ui.cells).viewBox);
  ui.svg = svg;

  for (const c of ui.cells) {
    const { x, y } = axialToPixel(c.q, c.r);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-k', key(c.q, c.r));

    const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    hex.setAttribute('points', hexPolygonPath(x, y, size * 0.95));
    hex.classList.add('hex');
    hex.addEventListener('mouseenter', () => hex.classList.add('cell-hover'));
    hex.addEventListener('mouseleave', () => hex.classList.remove('cell-hover'));
    hex.addEventListener('click', () => onCellClick(c));
    // Drag support on group (works for hex/marble area)
    g.addEventListener('pointerdown', (e) => onPointerDown(e, c));

    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', String(x));
    ring.setAttribute('cy', String(y));
    ring.setAttribute('r', String(size * 0.52));
    ring.classList.add('ring', 'hidden');

    const marble = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marble.setAttribute('cx', String(x));
    marble.setAttribute('cy', String(y));
    marble.setAttribute('r', String(size * 0.55));
    marble.classList.add('marble');

    g.appendChild(hex);
    g.appendChild(ring);
    g.appendChild(marble);
    svg.appendChild(g);
  }

  container.appendChild(svg);
  // Global listeners for drag
  svg.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  renderState();
}

function renderState() {
  // Update marbles
  for (const g of ui.svg.querySelectorAll('g')) {
    const k = g.getAttribute('data-k');
    const { q, r } = k.includes(',') ? (() => { const [a,b]=k.split(',').map(Number); return {q:a,r:b}; })() : ({q:0,r:0});
    const marble = g.querySelector('.marble');
    marble.setAttribute('class', 'marble');
    const v = getAt(ui.state, q, r);
    if (v === 'W') marble.classList.add('white');
    else if (v === 'B') marble.classList.add('black');

    const ring = g.querySelector('.ring');
    g.classList.remove('selected');
    ring.classList.add('hidden');
    ring.classList.remove('pulse');
  }
  // Selection rings
  for (const s of ui.selection) {
    const g = ui.svg.querySelector(`g[data-k="${key(s.q, s.r)}"]`);
    if (g) {
      g.classList.add('selected');
      const ring = g.querySelector('.ring');
      ring.classList.remove('hidden');
      ring.classList.add('pulse');
    }
  }

  // UI status
  document.getElementById('turn').textContent = `Turn: ${ui.state.turn === 'W' ? 'White' : 'Black'}`;
  document.getElementById('score').textContent = `W ${ui.state.captured.W} — ${ui.state.captured.B} B`;

  const winner = hasWinner(ui.state);
  const msg = document.getElementById('message');
  if (winner) {
    msg.textContent = `${winner === 'W' ? 'White' : 'Black'} wins!`;
    setDirButtonsEnabled(false);
    if (!ui.confettiStarted) {
      ui.confettiStarted = true;
      startConfetti({ duration: 5000, particleCount: 260 });
    }
  } else {
    msg.textContent = '';
    updateDirButtonsAvailability();
    // ensure confetti is not lingering between games
    if (ui.confettiStarted) {
      ui.confettiStarted = false;
      stopConfetti();
    }
  }

  // If it's AI's turn, let it think and move
  maybeAIMove();
}

function onCellClick(cell) {
  if (ui.drag.didDrag) { ui.drag.didDrag = false; return; }
  const v = getAt(ui.state, cell.q, cell.r);
  const isSelected = ui.selection.length === 1 && ui.selection[0].q === cell.q && ui.selection[0].r === cell.r;
  if (isSelected) {
    // Toggle off
    ui.selection = [];
    renderState();
    return;
  }
  if (!v) return; // only select occupied
  if (v !== ui.state.turn) return; // only current player's marbles
  // Single-select only
  ui.selection = [cell];
  renderState();
}

// Drag-to-move
const DIR_UNIT = {
  E:  [ 1, 0],
  NE: [ 0.5, -Math.sqrt(3)/2],
  NW: [-0.5, -Math.sqrt(3)/2],
  W:  [-1, 0],
  SW: [-0.5,  Math.sqrt(3)/2],
  SE: [ 0.5,  Math.sqrt(3)/2],
};

function nearestDir(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  let best = null, bestDot = -Infinity;
  const ux = dx / len, uy = dy / len;
  for (const name of Object.keys(DIR_UNIT)) {
    const [vx, vy] = DIR_UNIT[name];
    const dot = ux * vx + uy * vy;
    if (dot > bestDot) { bestDot = dot; best = name; }
  }
  return best;
}

function highlightDirButton(dirName) {
  for (const btn of document.querySelectorAll('button.dir')) {
    if (btn.dataset.dir === dirName) btn.classList.add('active');
    else btn.classList.remove('active');
  }
}

function clearDirHighlights() {
  for (const btn of document.querySelectorAll('button.dir')) btn.classList.remove('active');
}

function onPointerDown(e, cell) {
  // Only start drag on current player's marble cells
  const v = getAt(ui.state, cell.q, cell.r);
  if (v !== ui.state.turn) return; // ignore empty/opponent cells
  // Do NOT alter selection here; allows multi-select with clicks.
  ui.drag.active = true;
  ui.drag.didDrag = false;
  ui.drag.startX = e.clientX;
  ui.drag.startY = e.clientY;
  ui.drag.startCell = cell;
  ui.drag.pointerId = e.pointerId;
  try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch {}
}

function onPointerMove(e) {
  if (!ui.drag.active) return;
  if (ui.drag.pointerId != null && e.pointerId !== ui.drag.pointerId) return;
  const dx = e.clientX - ui.drag.startX;
  const dy = e.clientY - ui.drag.startY;
  const dist = Math.hypot(dx, dy);
  const threshold = 12; // px to start suggesting a direction
  if (dist < threshold) {
    clearDirHighlights();
    ui.drag.hintedDir = null;
    return;
  }
  ui.drag.didDrag = true;
  // If starting drag on a non-selected own marble, set selection now to that single cell
  const inSel = ui.selection.some(s => s.q === ui.drag.startCell.q && s.r === ui.drag.startCell.r);
  if (!inSel) {
    ui.selection = [ui.drag.startCell];
    renderState();
  }
  const dir = nearestDir(dx, dy);
  ui.drag.hintedDir = dir;
  highlightDirButton(dir);
}

function onPointerUp(e) {
  if (!ui.drag.active) return;
  if (ui.drag.pointerId != null && e.pointerId !== ui.drag.pointerId) return;
  const dx = e.clientX - ui.drag.startX;
  const dy = e.clientY - ui.drag.startY;
  const dist = Math.hypot(dx, dy);
  const threshold = 12;
  const dir = dist >= threshold ? nearestDir(dx, dy) : null;
  clearDirHighlights();
  ui.drag.active = false;
  ui.drag.pointerId = null;
  const moved = !!dir;
  if (moved && ui.selection.length && !ui.animating) {
    const check = canMove(ui.state, ui.selection, dir);
    if (!check.ok) {
      showMessage(check.reason || 'Illegal move');
    } else {
      const res = applyMove(ui.state, ui.selection, dir);
      if (res.ok) {
        runAnimatedMove(dir, ui.state, res.next).then(() => {
          ui.state = res.next;
          ui.selection = [];
          renderState();
        }).catch(() => {
          ui.state = res.next;
          ui.selection = [];
          renderState();
        });
      } else {
        showMessage(res.reason || 'Illegal move');
      }
    }
  }
}

// Helpers for animations
function getCenter(q, r) { return axialToPixel(q, r); }
function parseKeyStr(k) { const [q, r] = k.split(',').map(Number); return { q, r }; }

function computeMoveDiff(prev, next, dirName) {
  const d = DIRS[DIR_INDEX[dirName]];
  const moved = [];
  const ejected = [];

  // Build lookup for prev positions
  const prevMap = new Map();
  for (const [k, v] of prev.board.entries()) {
    const { q, r } = parseKeyStr(k);
    prevMap.set(k, { q, r, color: v });
  }

  const movedSet = new Set();
  // Seed movedSet with sources that are vacated in next but whose destination has same color
  for (const [k, node] of prevMap.entries()) {
    const v = node.color;
    if (next.board.get(k) === v) continue; // still occupied by same color -> maybe moved due to chain, handle later
    const to = { q: node.q + d.dq, r: node.r + d.dr };
    if (inBoard(to.q, to.r, prev.radius) && next.board.get(key(to.q, to.r)) === v) {
      movedSet.add(k);
    }
  }
  // Propagate moves forward along the direction when the piece behind moved
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, node] of prevMap.entries()) {
      if (movedSet.has(k)) continue;
      const v = node.color;
      const behindKey = key(node.q - d.dq, node.r - d.dr);
      const to = { q: node.q + d.dq, r: node.r + d.dr };
      if (movedSet.has(behindKey) && inBoard(to.q, to.r, prev.radius) && next.board.get(key(to.q, to.r)) === v) {
        movedSet.add(k);
        changed = true;
      }
    }
  }
  // Materialize moved array
  for (const k of movedSet) {
    const node = prevMap.get(k);
    moved.push({ color: node.color, from: { q: node.q, r: node.r }, to: { q: node.q + d.dq, r: node.r + d.dr } });
  }

  // Ejected detection: any opponent piece that left its source and whose next step is off-board
  const moverColor = prev.turn;
  const cand = [];
  for (const [k, v] of prev.board.entries()) {
    const { q, r } = parseKeyStr(k);
    if (next.board.get(k) === v) continue; // didn't leave
    const to = { q: q + d.dq, r: r + d.dr };
    if (v !== moverColor && !inBoard(to.q, to.r, prev.radius)) {
      cand.push({ color: v, from: { q, r } });
    }
  }
  // In inline moves, at most the front-most opponent(s) can be ejected.
  // Animate all candidates; engine guarantees legality.
  for (const item of cand) ejected.push(item);
  return { moved, ejected };
}

function classForColor(c) { return c === 'W' ? 'white' : 'black'; }

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateTranslateAttr(g, from, to, duration, fadeOut = false) {
  return new Promise((resolve) => {
    const start = performance.now();
    function step(now) {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const e = easeInOut(t);
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      g.setAttribute('transform', `translate(${x}, ${y})`);
      if (fadeOut) g.style.opacity = String(1 - e);
      if (t < 1) requestAnimationFrame(step); else resolve();
    }
    requestAnimationFrame(step);
  });
}

function runAnimatedMove(dirName, prevState, nextState, duration = 1000) {
  if (!ui.svg) return Promise.resolve();
  const { moved, ejected } = computeMoveDiff(prevState, nextState, dirName);
  if (moved.length === 0 && ejected.length === 0) return Promise.resolve();
  ui.animating = true;
  setDirButtonsEnabled(false);
  // Hide source marbles to avoid duplicates while animating
  const hidden = [];
  for (const m of moved) {
    const g = ui.svg.querySelector(`g[data-k="${key(m.from.q, m.from.r)}"]`);
    if (g) { const circ = g.querySelector('.marble'); if (circ) { circ.style.opacity = '0'; hidden.push(circ); } }
  }
  for (const m of ejected) {
    const g = ui.svg.querySelector(`g[data-k="${key(m.from.q, m.from.r)}"]`);
    if (g) { const circ = g.querySelector('.marble'); if (circ) { circ.style.opacity = '0'; hidden.push(circ); } }
  }
  // Create overlay layer
  let layer = ui.svg.querySelector('#anim-layer');
  if (layer) layer.remove();
  layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.setAttribute('id', 'anim-layer');
  ui.svg.appendChild(layer);

  const promises = [];
  for (const m of moved) {
    const from = getCenter(m.from.q, m.from.r);
    const to = getCenter(m.to.q, m.to.r);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', String(size * 0.55));
    c.setAttribute('cx', '0');
    c.setAttribute('cy', '0');
    c.setAttribute('class', `marble ${classForColor(m.color)}`);
    g.appendChild(c);
    g.setAttribute('transform', `translate(${from.x}, ${from.y})`);
    layer.appendChild(g);
    promises.push(animateTranslateAttr(g, from, to, duration));
  }
  const d = DIRS[DIR_INDEX[dirName]];
  const stepPix = axialToPixel(d.dq, d.dr);
  for (const m of ejected) {
    const from = getCenter(m.from.q, m.from.r);
    const to = { x: from.x + stepPix.x * 2.2, y: from.y + stepPix.y * 2.2 };
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', String(size * 0.55));
    c.setAttribute('cx', '0');
    c.setAttribute('cy', '0');
    c.setAttribute('class', `marble ${classForColor(m.color)}`);
    g.appendChild(c);
    g.setAttribute('transform', `translate(${from.x}, ${from.y})`);
    layer.appendChild(g);
    promises.push(animateTranslateAttr(g, from, to, duration + 120, true));
  }

  return Promise.allSettled(promises).then(() => {
    for (const el of hidden) el.style.opacity = '';
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    ui.animating = false;
    updateDirButtonsAvailability();
  });
}

function updateDirButtonsAvailability() {
  const buttons = document.querySelectorAll('button.dir');
  const enable = ui.selection.length > 0;
  for (const btn of buttons) {
    btn.disabled = !enable;
  }
}

function setDirButtonsEnabled(enabled) {
  for (const btn of document.querySelectorAll('button.dir')) btn.disabled = !enabled;
}

function onDirClick(dirName) {
  if (!ui.selection.length || ui.animating) return;
  const check = canMove(ui.state, ui.selection, dirName);
  if (!check.ok) {
    showMessage(check.reason || 'Illegal move');
    return;
  }
  const res = applyMove(ui.state, ui.selection, dirName);
  if (!res.ok) {
    showMessage(res.reason || 'Illegal move');
    return;
  }
  runAnimatedMove(dirName, ui.state, res.next).then(() => {
    ui.state = res.next;
    ui.selection = [];
    renderState();
  }).catch(() => {
    ui.state = res.next;
    ui.selection = [];
    renderState();
  });
}

function showMessage(text) {
  const el = document.getElementById('message');
  el.textContent = text;
  if (text) {
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(() => { el.textContent = ''; }, 800);
  }
}

function setupControls() {
  for (const btn of document.querySelectorAll('button.dir')) {
    btn.addEventListener('click', () => onDirClick(btn.dataset.dir));
  }
  document.getElementById('resetBtn').addEventListener('click', () => {
    ui.state = initialState();
    ui.selection = [];
    renderState();
    if (ui.confettiStarted) { ui.confettiStarted = false; stopConfetti(); }
  });

  const aiSideEl = document.getElementById('aiSide');
  if (aiSideEl) {
    // Initialize from current value
    if (aiSideEl.value && aiSideEl.value !== 'off') { ui.ai.enabled = true; ui.ai.side = aiSideEl.value; }
    aiSideEl.addEventListener('change', () => {
      const v = aiSideEl.value;
      if (v === 'off') { ui.ai.enabled = false; }
      else { ui.ai.enabled = true; ui.ai.side = v; }
      maybeAIMove();
    });
  }
}

function maybeAIMove() {
  if (!ui.ai.enabled) return;
  if (ui.animating || ui.ai.thinking) return;
  const turn = ui.state.turn;
  const aiPlaysThisTurn = ui.ai.side === 'both' || turn === ui.ai.side;
  if (!aiPlaysThisTurn) return;
  // Delay slightly to let UI update and avoid tight loops
  ui.ai.thinking = true;
  setTimeout(() => {
    try {
      const best = chooseMove(ui.state, { depth: ui.ai.depth });
      const move = best.move;
      if (!move) { ui.ai.thinking = false; return; }
      const res = applyMove(ui.state, move.selection, move.dir);
      if (!res.ok) { ui.ai.thinking = false; return; }
      runAnimatedMove(move.dir, ui.state, res.next).then(() => {
        ui.state = res.next;
        ui.selection = [];
        ui.ai.thinking = false;
        renderState();
      }).catch(() => {
        ui.state = res.next;
        ui.selection = [];
        ui.ai.thinking = false;
        renderState();
      });
    } catch (e) {
      ui.ai.thinking = false;
    }
  }, 200);
}

// Startup
renderBoard();
setupControls();
