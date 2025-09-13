let canvas, ctx, rafId = null, running = false, particles = [], startTime = 0, dur = 0;

function makeCanvas() {
  if (canvas && ctx) return { canvas, ctx };
  canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);
  onResize();
  window.addEventListener('resize', onResize);
  return { canvas, ctx };
}

function onResize() {
  if (!canvas) return;
  canvas.width = Math.floor(window.innerWidth * window.devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * window.devicePixelRatio);
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  if (ctx) ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function rand(min, max) { return Math.random() * (max - min) + min; }

function createParticles(count) {
  const colors = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b5179e', '#f72585'];
  const w = window.innerWidth, h = window.innerHeight;
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: rand(0, w),
      y: rand(-h * 0.2, -40),
      vx: rand(-1.2, 1.2),
      vy: rand(2.5, 5.2),
      g: rand(0.015, 0.035),
      s: rand(6, 12),
      r: rand(0, Math.PI * 2),
      vr: rand(-0.2, 0.2),
      color: colors[(Math.random() * colors.length) | 0],
      shape: Math.random() < 0.5 ? 'rect' : 'circ',
      life: rand(0.85, 1),
    });
  }
  return arr;
}

function drawParticle(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.r);
  ctx.fillStyle = p.color;
  if (p.shape === 'rect') {
    ctx.fillRect(-p.s * 0.5, -p.s * 0.3, p.s, p.s * 0.6);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, p.s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function step(ts) {
  if (!running) return;
  if (!startTime) startTime = ts;
  const t = ts - startTime;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = window.innerWidth, h = window.innerHeight;
  for (const p of particles) {
    p.vy += p.g;
    p.x += p.vx + Math.sin((p.y + t * 0.002) * 0.05) * 0.5;
    p.y += p.vy;
    p.r += p.vr;
    drawParticle(p);
    // recycle if goes below screen while running
    if (p.y - p.s > h && t < dur) {
      p.x = rand(0, w); p.y = rand(-h * 0.2, -20); p.vx = rand(-1.2, 1.2); p.vy = rand(2.5, 5.2);
    }
  }
  if (t < dur) {
    rafId = requestAnimationFrame(step);
  } else {
    // fade out and stop soon
    if (t < dur + 1200) {
      ctx.globalAlpha = Math.max(0, 1 - (t - dur) / 1200);
      rafId = requestAnimationFrame(step);
    } else {
      stopConfetti();
    }
  }
}

export function startConfetti({ duration = 4000, particleCount = 220 } = {}) {
  if (running) return;
  const c = makeCanvas();
  startTime = 0;
  dur = duration;
  particles = createParticles(particleCount);
  running = true;
  rafId = requestAnimationFrame(step);
}

export function stopConfetti() {
  if (!running && !canvas) return;
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  particles = [];
  if (canvas && canvas.parentNode) {
    window.removeEventListener('resize', onResize);
    canvas.parentNode.removeChild(canvas);
  }
  canvas = null; ctx = null;
}

export function isConfettiActive() { return running; }

