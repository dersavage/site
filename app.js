const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (d, o) => new Date(d + "T00:00:00").toLocaleDateString("en", o);

let M, pages = [], byId = {}, bodies = {}, token = 0;

/* ---------- links: a page with a "url" in pages.json opens that address directly ---------- */
const href = p => p.url || "#" + p.id;
const ext = p => (p.url ? ' target="_blank" rel="noopener"' : "");
const extClass = p => (p.url ? " ext" : "");
function secLink(s) {            // a section that holds one external page links straight to it
  const ps = pages.filter(p => p.section === s.id);
  return ps.length === 1 && ps[0].url ? ps[0] : null;
}

/* ---------- load ---------- */
async function boot() {
  try {
    M = await (await fetch("pages.json")).json();
  } catch (e) {
    $("#content").innerHTML = "<h1>Can't load pages.json</h1><p>If you opened index.html by double-clicking, browsers block that. " +
      "Run <code>python3 -m http.server</code> in this folder and open <code>http://localhost:8000</code>. On GitHub Pages it just works.</p>";
    return;
  }
  pages = M.pages;
  pages.forEach(p => (byId[p.id] = p));
  buildNav();
  route();
}

async function body(p) {
  if (p.url) return "";
  if (bodies[p.id] != null) return bodies[p.id];
  let t = await (await fetch(p.file)).text();
  if (p.file.endsWith(".md")) {
    t = t.replace(/^(---|\+\+\+)[\s\S]*?\n\1\s*\n/, "");           // drop front matter
    t = window.marked ? marked.parse(t) : "<pre>" + esc(t) + "</pre>";
  }
  return (bodies[p.id] = t);
}

/* ---------- sidebar ---------- */
function buildNav() {
  let h = '<a href="#" data-id="">Home</a>';
  if (byId.about) h += '<a href="#about" data-id="about">About</a>';
  M.sections.forEach(s => {
    const one = secLink(s);
    h += `<a class="group${one ? " ext" : ""}" href="${one ? one.url : "#" + s.id}"${one ? ext(one) : ""} data-id="${s.id}">${esc(s.title)}</a>`;
    if (one) return;                                       // single external link: the heading is the link
    pages.filter(p => p.section === s.id).forEach(p => {
      h += `<a class="${extClass(p).trim()}" href="${href(p)}"${ext(p)} data-id="${p.id}">${esc(p.title)}</a>`;
    });
  });
  $("#nav").innerHTML = h;
}
function setActive(id) {
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("active", a.dataset.id === id));
  const a = $("#nav a.active");
  if (a) a.scrollIntoView({ block: "nearest" });
  $("#sidebar").classList.remove("open");
}

/* ---------- routes ---------- */
function route() {
  Stars.stop();                                            // only the home page animates
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return home();
  if (byId[h] && !byId[h].url) return page(byId[h]);
  const s = M.sections.find(s => s.id === h);
  if (s) return section(s);
  const el = document.getElementById(h);                     // in-page anchor (footnotes, headings)
  if (el && $("#content").contains(el)) { el.scrollIntoView(); return; }
  home();
}
addEventListener("hashchange", route);

function chrome(title) {
  document.title = title ? title + " · Jan Savage" : "Jan Savage";
  $("#pager").innerHTML = "";
  scrollTo(0, 0);
}

function home() {
  setActive(""); chrome("");
  $("#content").innerHTML = "";
  $("#content").appendChild($("#home").content.cloneNode(true));
  $("#home-cards")?.insertAdjacentHTML("beforeend", (byId.about ? '<a class="card" href="#about"><b>About</b><span>Who I am</span></a>' : "") +
    M.sections.map(s => {
      const n = pages.filter(p => p.section === s.id).length, one = secLink(s);
      return `<a class="card${one ? " ext" : ""}" href="${one ? one.url : "#" + s.id}"${one ? ext(one) : ""}><b>${esc(s.title)}</b>` +
        `<span>${n} ${n === 1 ? "entry" : "entries"}</span></a>`;
    }).join(""));
  Stars.start();
}

function section(s) {
  setActive(s.id); chrome(s.title);
  let html = `<h1>${esc(s.title)}</h1>`, year = null;
  pages.filter(p => p.section === s.id).forEach(p => {
    const y = p.date.slice(0, 4);
    if (y !== year) { html += (year ? "</ul>" : "") + `<div class="year">${y}</div><ul class="posts">`; year = y; }
    html += `<li><a class="${extClass(p).trim()}" href="${href(p)}"${ext(p)}><span class="t">${esc(p.title)}</span>` +
      (p.rating ? `<span class="rating">${esc(p.rating)}</span>` : "") +
      `<span class="d">${fmt(p.date, { month: "short", day: "numeric" })}</span></a></li>`;
  });
  $("#content").innerHTML = html + (year ? "</ul>" : "");
}

async function page(p) {
  const t = ++token;
  setActive(p.id); chrome(p.title);
  $("#content").innerHTML = '<p class="muted">Loading…</p>';
  let b;
  try { b = await body(p); } catch (e) { b = "<p>Couldn't load this page.</p>"; }
  if (t !== token) return;                                   // user already navigated away
  const meta = (p.rating ? `<span class="rating">${esc(p.rating)}</span>` : "") +
    (p.date ? `<span>${fmt(p.date, { year: "numeric", month: "short", day: "numeric" })}</span>` : "");
  $("#content").innerHTML = `<h1>${esc(p.title)}</h1>${meta ? `<div class="meta">${meta}</div>` : ""}<div class="prose">${b}</div>`;
  if (p.section) {                                           // newer / older within the section
    const list = pages.filter(x => x.section === p.section && !x.url), i = list.indexOf(p);
    const l = (x, w) => x ? `<a href="#${x.id}"><small>${w}</small>${esc(x.title)}</a>` : "<span></span>";
    $("#pager").innerHTML = l(list[i - 1], "Newer") + l(list[i + 1], "Older");
  }
}

/* ---------- landing-page stars ----------
   Cheap by design: one small pre-drawn glow sprite, ~50 stars, 30 fps cap, 1x resolution,
   stops completely off the home page and while the tab is hidden, and is static if the
   visitor has "reduce motion" turned on. */
const Stars = (() => {
  const cv = $("#stars"), cx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let W = 0, H = 0, stars = [], sprite = null, raf = 0, last = 0, on = false;

  function makeSprite() {                                    // light blue on dark themes, deeper blue on light ones
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    const n = parseInt(bg.slice(1), 16);
    const lum = isNaN(n) ? 0 : (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255;
    const c = lum > 0.5 ? "70,140,235" : "150,205,255";
    sprite = document.createElement("canvas"); sprite.width = sprite.height = 32;
    const g = sprite.getContext("2d"), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, `rgba(${c},1)`); r.addColorStop(.25, `rgba(${c},.55)`); r.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  }
  function seed() {
    W = cv.width = innerWidth; H = cv.height = innerHeight;
    const n = Math.min(70, Math.round(W * H / 20000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      s: 6 + Math.random() * 16,                              // glow size in px
      a: .10 + Math.random() * .25,                           // low alpha: faint on purpose
      vx: (Math.random() - .5) * 10, vy: -(3 + Math.random() * 10),   // slow upward drift
      p: Math.random() * 6.28, w: .4 + Math.random() * 1.2    // twinkle phase / speed
    }));
  }
  function draw(dt) {
    cx.clearRect(0, 0, W, H);
    for (const s of stars) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.p += s.w * dt;
      if (s.y < -20) { s.y = H + 20; s.x = Math.random() * W; }
      if (s.x < -20) s.x = W + 20; else if (s.x > W + 20) s.x = -20;
      cx.globalAlpha = s.a * (.65 + .35 * Math.sin(s.p));
      cx.drawImage(sprite, s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
    }
    cx.globalAlpha = 1;
  }
  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return;                                // ~30 fps is plenty for slow drift
    draw(Math.min((t - last) / 1000, .1)); last = t;
  }
  function run() {
    cancelAnimationFrame(raf);
    if (!on) return;
    if (reduce.matches) { draw(0); return; }
    last = performance.now(); raf = requestAnimationFrame(loop);
  }
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (on) { seed(); run(); } }, 150); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else run(); });

  return {
    start() { on = true; cv.hidden = false; makeSprite(); seed(); run(); },
    stop()  { on = false; cancelAnimationFrame(raf); cv.hidden = true; },
    recolor() { if (on) { makeSprite(); run(); } }
  };
})();

/* ---------- theme ---------- */
const sel = $("#theme-select");
sel.value = document.documentElement.dataset.theme || "light";
if (sel.value !== document.documentElement.dataset.theme) sel.value = "light";
sel.onchange = () => {
  document.documentElement.dataset.theme = sel.value;
  try { localStorage.setItem("theme", sel.value); } catch (e) {}
  Stars.recolor();
};

/* ---------- misc ---------- */
$("#year").textContent = new Date().getFullYear();
$("#menu-btn").onclick = () => $("#sidebar").classList.toggle("open");

/* ---------- search (reads every page once, on first open) ---------- */
const modal = $("#modal"), q = $("#q"), results = $("#results");
let index = null;
async function openSearch() {
  modal.hidden = false; q.value = ""; q.focus(); results.innerHTML = "<li style='padding:12px'>Loading…</li>";
  if (!index) {
    const tmp = document.createElement("div");
    index = await Promise.all(pages.map(async p => {
      try { tmp.innerHTML = await body(p); } catch (e) { tmp.innerHTML = ""; }
      return { p, text: tmp.textContent.replace(/\s+/g, " ").trim() };
    }));
  }
  render(q.value);
}
function render(term) {
  term = term.toLowerCase().trim();
  const hits = (index || []).map(x => {
    const ti = x.p.title.toLowerCase().includes(term), i = x.text.toLowerCase().indexOf(term);
    return { x, ti, i, score: term ? (ti ? 2 : 0) + (i >= 0 ? 1 : 0) : 1 };
  }).filter(h => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
  results.innerHTML = hits.map(h => {
    const snip = term && h.i >= 0 ? "…" + h.x.text.slice(Math.max(0, h.i - 40), h.i + 80) + "…" : "";
    return `<li><a href="${href(h.x.p)}"${ext(h.x.p)}><b>${esc(h.x.p.title)}</b><small>${esc(snip)}</small></a></li>`;
  }).join("") || "<li style='padding:12px'>No results</li>";
}
$("#search-btn").onclick = openSearch;
q.oninput = () => render(q.value);
modal.onclick = e => { if (e.target === modal || e.target.closest("a")) modal.hidden = true; };
q.onkeydown = e => { if (e.key === "Enter") results.querySelector("a")?.click(); };
addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
  if (e.key === "Escape") modal.hidden = true;
});

boot();
