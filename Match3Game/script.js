// =============================================================
//  Bonbon-Tausch – einfaches Match-3-Spiel (HTML5 / Vanilla JS)
// =============================================================

const SIZE = 8;          // Spielfeld 8 x 8
const TYPES = 6;         // Anzahl Bonbon-Sorten
const SWAP_TIME = 220;   // ms – muss zur CSS-Transition passen
const POP_TIME = 260;
const FALL_TIME = 300;
const HINT_DELAY = 6000; // ms bis ein Tipp angezeigt wird

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");
const levelEl = document.getElementById("level");
const targetEl = document.getElementById("target");
const bestEl = document.getElementById("best");
const progressEl = document.getElementById("progress-bar");
const comboEl = document.getElementById("combo");
const overlayEl = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const overlayBtn = document.getElementById("overlay-btn");
const restartBtn = document.getElementById("restart-btn");

// grid[row][col] = { type, el }
let grid = [];
let score = 0;
let moves = 0;
let level = 1;
let target = 0;
let busy = false;        // während Animationen keine Eingaben
let selected = null;     // {r, c} bei Klick-Steuerung
let hintTimer = null;
let overlayAction = null;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const randType = () => Math.floor(Math.random() * TYPES);

// ---------- Bestwert (optional, falls localStorage verfügbar) ----------
function loadBest() {
  try { return parseInt(localStorage.getItem("bonbon-best") || "0", 10); } catch (e) { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem("bonbon-best", String(v)); } catch (e) { /* egal */ }
}
let best = loadBest();

// =============================================================
//  Darstellung
// =============================================================
function createTile(type, r, c) {
  const el = document.createElement("div");
  el.className = "tile t" + type;
  el.innerHTML = '<div class="candy"></div>';
  setPos(el, r, c);
  boardEl.appendChild(el);
  return { type, el };
}

function setPos(el, r, c) {
  el.style.setProperty("--x", c);
  el.style.setProperty("--y", r);
}

function updateHud() {
  scoreEl.textContent = score;
  movesEl.textContent = moves;
  levelEl.textContent = level;
  targetEl.textContent = target;
  progressEl.style.width = Math.min(100, (score / target) * 100) + "%";
  if (score > best) { best = score; saveBest(best); }
  bestEl.textContent = best;
}

function showCombo(text) {
  comboEl.textContent = text;
  comboEl.classList.remove("show");
  void comboEl.offsetWidth; // Animation neu starten
  comboEl.classList.add("show");
}

// =============================================================
//  Spielfeld erzeugen
// =============================================================
function buildBoard() {
  boardEl.innerHTML = "";
  do {
    const types = [];
    for (let r = 0; r < SIZE; r++) {
      types[r] = [];
      for (let c = 0; c < SIZE; c++) {
        let t;
        // keine fertigen 3er-Reihen beim Start
        do {
          t = randType();
        } while (
          (c >= 2 && types[r][c - 1] === t && types[r][c - 2] === t) ||
          (r >= 2 && types[r - 1][c] === t && types[r - 2][c] === t)
        );
        types[r][c] = t;
      }
    }
    if (findPossibleMove(types)) {
      grid = types.map((row, r) => row.map((t, c) => createTile(t, r, c)));
      return;
    }
  } while (true);
}

function typeGrid() {
  return grid.map((row) => row.map((cell) => (cell ? cell.type : -1)));
}

// =============================================================
//  Treffer suchen
// =============================================================
// Liefert Liste von Gruppen: [{cells:[[r,c],...]}]
function findMatches() {
  const groups = [];
  // waagerecht
  for (let r = 0; r < SIZE; r++) {
    let run = 1;
    for (let c = 1; c <= SIZE; c++) {
      const same = c < SIZE && grid[r][c] && grid[r][c - 1] && grid[r][c].type === grid[r][c - 1].type;
      if (same) run++;
      else {
        if (run >= 3) {
          const cells = [];
          for (let k = c - run; k < c; k++) cells.push([r, k]);
          groups.push(cells);
        }
        run = 1;
      }
    }
  }
  // senkrecht
  for (let c = 0; c < SIZE; c++) {
    let run = 1;
    for (let r = 1; r <= SIZE; r++) {
      const same = r < SIZE && grid[r][c] && grid[r - 1][c] && grid[r][c].type === grid[r - 1][c].type;
      if (same) run++;
      else {
        if (run >= 3) {
          const cells = [];
          for (let k = r - run; k < r; k++) cells.push([k, c]);
          groups.push(cells);
        }
        run = 1;
      }
    }
  }
  return groups;
}

// Bildet (r,c) in einem Typ-Raster eine 3er-Reihe?
function matchAt(t, r, c) {
  const v = t[r][c];
  let h = 1, k = c - 1;
  while (k >= 0 && t[r][k] === v) { h++; k--; }
  k = c + 1;
  while (k < SIZE && t[r][k] === v) { h++; k++; }
  if (h >= 3) return true;
  let vv = 1;
  k = r - 1;
  while (k >= 0 && t[k][c] === v) { vv++; k--; }
  k = r + 1;
  while (k < SIZE && t[k][c] === v) { vv++; k++; }
  return vv >= 3;
}

// Sucht einen gültigen Zug; gibt [[r1,c1],[r2,c2]] oder null zurück
function findPossibleMove(t) {
  const dirs = [[0, 1], [1, 0]];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      for (const [dr, dc] of dirs) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= SIZE || c2 >= SIZE) continue;
        [t[r][c], t[r2][c2]] = [t[r2][c2], t[r][c]];
        const ok = matchAt(t, r, c) || matchAt(t, r2, c2);
        [t[r][c], t[r2][c2]] = [t[r2][c2], t[r][c]];
        if (ok) return [[r, c], [r2, c2]];
      }
    }
  }
  return null;
}

// =============================================================
//  Spielzug
// =============================================================
function swapCells(a, b) {
  const A = grid[a.r][a.c], B = grid[b.r][b.c];
  grid[a.r][a.c] = B;
  grid[b.r][b.c] = A;
  setPos(A.el, b.r, b.c);
  setPos(B.el, a.r, a.c);
}

async function trySwap(a, b) {
  if (busy || moves <= 0) return;
  if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return;
  busy = true;
  clearHint();
  clearSelection();

  swapCells(a, b);
  await sleep(SWAP_TIME);

  if (findMatches().length === 0) {
    // ungültig -> zurücktauschen
    swapCells(a, b);
    await sleep(SWAP_TIME);
    busy = false;
    scheduleHint();
    return;
  }

  moves--;
  updateHud();
  await resolveBoard();
  busy = false;
  checkEnd();
  scheduleHint();
}

// Treffer entfernen, nachrutschen lassen, auffüllen – bis keine Treffer mehr
async function resolveBoard() {
  let combo = 1;
  while (true) {
    const groups = findMatches();
    if (groups.length === 0) break;

    // Punkte: 3er = 30, 4er = 60, 5er = 100 … mal Kombo-Faktor
    const cells = new Set();
    let gained = 0;
    for (const g of groups) {
      gained += g.length === 3 ? 30 : g.length === 4 ? 60 : 100 + (g.length - 5) * 50;
      g.forEach(([r, c]) => cells.add(r + "," + c));
    }
    score += gained * combo;
    if (combo > 1) showCombo("Kombo x" + combo + "!");
    else if (groups.some((g) => g.length >= 5)) showCombo("Super!");
    else if (groups.some((g) => g.length === 4)) showCombo("Toll!");
    updateHud();

    // Platzen lassen
    cells.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      grid[r][c].el.classList.add("pop");
    });
    await sleep(POP_TIME);
    cells.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      grid[r][c].el.remove();
      grid[r][c] = null;
    });

    applyGravity();
    await sleep(FALL_TIME + 40);
    combo++;
  }

  // Keine Züge mehr möglich? -> mischen
  if (!findPossibleMove(typeGrid())) {
    showCombo("Mischen …");
    await sleep(500);
    await shuffleBoard();
  }
}

function applyGravity() {
  const newTiles = [];
  for (let c = 0; c < SIZE; c++) {
    // vorhandene Bonbons nach unten schieben
    let write = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) {
      const cell = grid[r][c];
      if (cell) {
        if (r !== write) {
          grid[write][c] = cell;
          grid[r][c] = null;
          setPos(cell.el, write, c);
        }
        write--;
      }
    }
    // neue Bonbons oberhalb des Feldes erzeugen
    const missing = write + 1;
    for (let r = write; r >= 0; r--) {
      const tile = createTile(randType(), r - missing, c);
      tile.el.classList.add("no-anim");
      grid[r][c] = tile;
      newTiles.push([tile, r, c]);
    }
  }
  // Reflow erzwingen, dann an Zielposition fallen lassen
  void boardEl.offsetWidth;
  newTiles.forEach(([tile, r, c]) => {
    tile.el.classList.remove("no-anim");
    setPos(tile.el, r, c);
  });
}

async function shuffleBoard() {
  const types = typeGrid().flat();
  let t;
  do {
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    t = [];
    for (let r = 0; r < SIZE; r++) t.push(types.slice(r * SIZE, r * SIZE + SIZE));
  } while (!findPossibleMove(t) || hasAnyMatch(t));

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      cell.type = t[r][c];
      cell.el.className = "tile t" + cell.type;
    }
  }
  await sleep(200);
}

function hasAnyMatch(t) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (matchAt(t, r, c)) return true;
  return false;
}

// =============================================================
//  Level / Spielende
// =============================================================
function startLevel(lvl, keepScore) {
  level = lvl;
  if (!keepScore) score = 0;
  target = score + 1000 + (lvl - 1) * 500;
  moves = Math.max(15, 25 - (lvl - 1));
  busy = false;
  selected = null;
  hideOverlay();
  buildBoard();
  updateHud();
  scheduleHint();
}

function checkEnd() {
  if (score >= target) {
    clearHint();
    showOverlay(
      "Level " + level + " geschafft!",
      "Du hast " + score + " Punkte. Bereit für Level " + (level + 1) + "?",
      "Weiter",
      () => startLevel(level + 1, true)
    );
  } else if (moves <= 0) {
    clearHint();
    showOverlay(
      "Keine Züge mehr",
      "Dir fehlten " + (target - score) + " Punkte. Versuch es nochmal!",
      "Neu starten",
      () => startLevel(1, false)
    );
  }
}

function showOverlay(title, text, btn, action) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayBtn.textContent = btn;
  overlayAction = action;
  overlayEl.classList.remove("hidden");
}
function hideOverlay() { overlayEl.classList.add("hidden"); }

overlayBtn.addEventListener("click", () => overlayAction && overlayAction());
restartBtn.addEventListener("click", () => startLevel(1, false));

// =============================================================
//  Tipps
// =============================================================
function scheduleHint() {
  clearHint();
  hintTimer = setTimeout(() => {
    if (busy) return;
    const mv = findPossibleMove(typeGrid());
    if (mv) mv.forEach(([r, c]) => grid[r][c].el.classList.add("hint"));
  }, HINT_DELAY);
}
function clearHint() {
  clearTimeout(hintTimer);
  boardEl.querySelectorAll(".hint").forEach((el) => el.classList.remove("hint"));
}

// =============================================================
//  Eingabe: Klicken ODER Wischen (Maus & Touch)
// =============================================================
function cellFromEvent(e) {
  const rect = boardEl.getBoundingClientRect();
  const c = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
  const r = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
  return { r, c };
}

function clearSelection() {
  if (selected && grid[selected.r][selected.c]) grid[selected.r][selected.c].el.classList.remove("selected");
  selected = null;
}

let drag = null; // {start:{r,c}, x, y, done}

boardEl.addEventListener("pointerdown", (e) => {
  if (busy) return;
  const cell = cellFromEvent(e);
  if (!cell) return;
  drag = { start: cell, x: e.clientX, y: e.clientY, done: false };
  boardEl.setPointerCapture(e.pointerId);
});

boardEl.addEventListener("pointermove", (e) => {
  if (!drag || drag.done || busy) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  const threshold = boardEl.getBoundingClientRect().width / SIZE / 3;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
  drag.done = true;
  const s = drag.start;
  const target = Math.abs(dx) > Math.abs(dy)
    ? { r: s.r, c: s.c + Math.sign(dx) }
    : { r: s.r + Math.sign(dy), c: s.c };
  if (target.r >= 0 && target.r < SIZE && target.c >= 0 && target.c < SIZE) trySwap(s, target);
});

boardEl.addEventListener("pointerup", () => {
  if (!drag) return;
  const { start, done } = drag;
  drag = null;
  if (done || busy) return;

  // Klick-Steuerung: erst auswählen, dann Nachbarn anklicken
  if (!selected) {
    selected = start;
    grid[start.r][start.c].el.classList.add("selected");
  } else if (selected.r === start.r && selected.c === start.c) {
    clearSelection();
  } else if (Math.abs(selected.r - start.r) + Math.abs(selected.c - start.c) === 1) {
    trySwap(selected, start);
  } else {
    clearSelection();
    selected = start;
    grid[start.r][start.c].el.classList.add("selected");
  }
});

boardEl.addEventListener("pointercancel", () => { drag = null; });

// Los geht's
startLevel(1, false);
