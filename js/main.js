// Portfolio renderer: every section is built at load time from the JSON files in /data,
// so editing those files is enough to update the page.

const DATA = {
  profile: 'data/profile.json',
  experience: 'data/experience.json',
  skills: 'data/skills.json',
  contributions: 'data/contributions.json',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NOW = new Date();
// Trophy rarities, highest first. Skills without a valid "rarity" count as bronze.
const RARITIES = ['platinum', 'gold', 'silver', 'bronze'];

// ---------- helpers ----------

async function loadJSON(path) {
  // 'no-cache' revalidates with the server, so JSON edits show up on the next load.
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style') {
      for (const [prop, v] of Object.entries(value)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, v);
        else node.style[prop] = v;
      }
    }
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const isOngoing = (end) => !end || /^(present|now|current)$/i.test(String(end).trim());

/** "MM/YY" -> Date at the first day of that month. Empty/"present" -> today. */
function parseDate(str) {
  if (isOngoing(str)) return new Date(NOW);
  const [mm, yy] = String(str).split('/').map(Number);
  const year = yy < 100 ? 2000 + yy : yy;
  return new Date(year, mm - 1, 1);
}

/** End dates are inclusive months, so "08/22" ends on the first day of 09/22. */
function parseEnd(str) {
  if (isOngoing(str)) return new Date(NOW);
  const d = parseDate(str);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

const formatMMYY = (str) => (isOngoing(str) ? 'Now' : str);

function formatLong(str) {
  const d = parseDate(str);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function yearsBetween(ms) {
  const years = ms / (365.25 * 24 * 3600 * 1000);
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} mo`;
  return `${(Math.round(years * 10) / 10).toString()} yr${years >= 1.05 ? 's' : ''}`;
}

/** Pick black or white text for a hex background using WCAG relative luminance. */
function textOn(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? '#111' : '#fff';
}

/** Shared time scale for Experience and Technical Expertise. */
function buildScale(experience) {
  const starts = experience.map((e) => parseDate(e.start_date));
  const ends = experience.map((e) => parseEnd(e.end_date));
  // The scale starts exactly at the first job so both ends of the bar sit flush against the edges.
  const start = new Date(Math.min(...starts.map(Number)));
  const end = new Date(Math.max(NOW.valueOf(), ...ends.map(Number)));
  const span = end - start;
  const pct = (d) => ((d - start) / span) * 100;
  // January ticks strictly inside the range.
  const years = [];
  for (let y = start.getFullYear() + 1; new Date(y, 0, 1) < end; y++) years.push(y);
  return { start, end, pct, years };
}

function axis(scale) {
  const yearLabel = (y) => [
    el('span', { class: 'y-full' }, y),
    el('span', { class: 'y-short' }, `'${String(y).slice(2)}`)];
  const ticks = [el('span', { class: 'tick tick-start', style: { '--pos': '0%' } }, yearLabel(scale.start.getFullYear()))];
  for (const y of scale.years) {
    const left = scale.pct(new Date(y, 0, 1));
    // Ticks too close to the start label or to "Now" would overlap them.
    const crowded = left < 7 || left > 92;
    const near = left < 12 || left > 85; // only crowded on narrow screens
    const cls = `tick${crowded ? ' tick-crowded' : ''}${near ? ' tick-near' : ''}`;
    ticks.push(el('span', { class: cls, style: { '--pos': `${left}%` } }, yearLabel(y)));
  }
  ticks.push(el('span', { class: 'tick tick-now', style: { '--pos': '100%' } }, 'Now'));
  return el('div', { class: 'axis' }, ticks);
}

function gridlines(scale) {
  return el('div', { class: 'gridlines', 'aria-hidden': 'true' },
    scale.years.map((y) =>
      el('span', { style: { '--pos': `${scale.pct(new Date(y, 0, 1))}%` } })));
}

function companyIcon(exp, cls = 'co-icon') {
  if (!exp?.company_ico) return null;
  return el('img', { class: cls, src: exp.company_ico, alt: '', loading: 'lazy' });
}

// ---------- sections ----------

function renderProfile(p) {
  const fullName = `${p.name} ${p.surnames}`.trim();
  document.title = `${fullName} · Portfolio`;
  document.getElementById('brand').textContent = fullName;
  document.getElementById('name').append(
    el('span', { class: 'first-name' }, p.name), ' ',
    el('span', { class: 'surnames' }, p.surnames));
  document.getElementById('job-title').textContent = p.job_title;
  document.getElementById('phrase').textContent = p.phrase ?? '';
  const avatar = document.getElementById('avatar');
  avatar.src = p.image;
  avatar.alt = `Photo of ${fullName}`;

  document.getElementById('links').append(...(p.links ?? []).map((l) =>
    el('li', {}, el('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.label))));

  for (const [key, title] of Object.entries(p.sections ?? {})) {
    const h = document.querySelector(`[data-title="${key}"]`);
    if (h) h.textContent = title;
  }
  document.getElementById('footer-text').textContent = `© ${NOW.getFullYear()} ${fullName}`;
}

function renderExperience(experience, scale) {
  const sorted = [...experience].sort((a, b) => parseDate(a.start_date) - parseDate(b.start_date));

  // Overlapping jobs go into separate lanes so nothing hides behind anything else.
  const laneEnds = [];
  const placed = sorted.map((exp) => {
    const s = parseDate(exp.start_date);
    const e = parseEnd(exp.end_date);
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = e;
    return { exp, s, e, lane };
  });

  const track = el('div', { class: 'xp-track', style: {
    '--lanes': laneEnds.length,
    // Vertical layout: total length relative to the shortest job, so the shortest box just fits its content.
    '--span-ratio': (scale.end - scale.start) / Math.min(...placed.map(({ s, e }) => e - s)),
  } },
    gridlines(scale),
    // Inset by the same gap that separates the boxes, so the edge boxes don't touch the bars.
    el('div', { class: 'xp-lanes' }, placed.map(({ exp, s, e, lane }) => {
      const dates = `${exp.start_date} – ${formatMMYY(exp.end_date)}`;
      return el('article', {
        class: 'xp-block',
        style: {
          // Position along the time axis and lane; the CSS maps these to left/top or top/left.
          '--pos': `${scale.pct(s)}%`,
          '--len': `${scale.pct(e) - scale.pct(s)}%`,
          '--lane': lane,
          background: exp.colour,
          color: textOn(exp.colour),
        },
        title: `${exp.company} · ${exp.job_title} · ${dates}`,
        tabindex: '0',
      },
      companyIcon(exp, 'co-icon xp-icon'),
      el('strong', { class: 'xp-company' }, exp.company),
      el('span', { class: 'xp-role' }, exp.job_title),
      el('span', { class: 'xp-date xp-date-start' }, exp.start_date),
      el('span', { class: 'xp-date xp-date-end' }, formatMMYY(exp.end_date)));
    })));

  document.getElementById('experience-timeline').append(track, axis(scale));
}

function renderTech(experience, scale) {
  // tool -> experiences that used it
  const tools = new Map();
  for (const exp of experience) {
    for (const tool of exp.tech_stack ?? []) {
      if (!tools.has(tool)) tools.set(tool, []);
      tools.get(tool).push(exp);
    }
  }

  const rows = [...tools.entries()].map(([tool, exps]) => {
    const spans = exps
      .map((exp) => ({ exp, s: parseDate(exp.start_date), e: parseEnd(exp.end_date) }))
      .sort((a, b) => a.s - b.s);
    // Merge overlapping intervals so concurrent jobs aren't counted twice.
    let total = 0, curS = null, curE = null;
    for (const { s, e } of spans) {
      if (curE && s <= curE) { if (e > curE) curE = e; continue; }
      if (curE) total += curE - curS;
      curS = s; curE = e;
    }
    if (curE) total += curE - curS;
    return { tool, spans, first: spans[0].s, total };
  }).sort((a, b) => a.first - b.first || b.total - a.total || a.tool.localeCompare(b.tool));

  const legendSeen = new Set();
  const legend = el('ul', { class: 'legend' }, experience
    .filter((e) => !legendSeen.has(e.company) && legendSeen.add(e.company))
    .map((exp) => el('li', {},
      el('span', { class: 'legend-swatch', style: { background: exp.colour } }, companyIcon(exp)),
      exp.company)));

  // Periods with the same tool that follow each other (gap of ~1 month or less) are drawn as one
  // continuous bar: the earlier period stretches to meet the next and the shared edges are squared off.
  const JOIN_GAP = 45 * 24 * 3600 * 1000;
  const bars = (tool, spans) => spans.map(({ exp, s, e }, i) => {
    const prev = spans[i - 1], next = spans[i + 1];
    const joinPrev = prev && s - prev.e <= JOIN_GAP;
    const joinNext = next && next.s - e <= JOIN_GAP;
    const end = joinNext && next.s > e ? next.s : e;
    return el('div', {
      class: `tech-bar${joinPrev ? ' join-prev' : ''}${joinNext ? ' join-next' : ''}`,
      style: {
        left: `${scale.pct(s)}%`,
        width: `${scale.pct(end) - scale.pct(s)}%`,
        background: exp.colour,
      },
      title: `${tool} @ ${exp.company} (${exp.start_date} – ${formatMMYY(exp.end_date)})`,
    }, companyIcon(exp, 'co-icon bar-icon'));
  });

  const chart = el('div', { class: 'tech-grid' },
    rows.flatMap(({ tool, spans, total }) => [
      el('div', { class: 'tech-label' },
        el('span', { class: 'tool-name' }, tool),
        el('span', { class: 'tool-years' }, yearsBetween(total))),
      el('div', { class: 'tech-track' }, gridlines(scale), bars(tool, spans)),
    ]),
    // Dates below the chart, as in the experience timeline.
    el('div', { class: 'tech-label tech-axis-spacer' }),
    el('div', { class: 'tech-axis' }, axis(scale)));

  document.getElementById('tech-chart').append(legend, chart);
}

function renderSkills(skills, experience) {
  const earned = new Map(skills.map((s) => [s.id, []]));
  for (const exp of experience) {
    for (const id of exp.soft_skills ?? []) {
      if (earned.has(id) && !earned.get(id).some((e) => e.company === exp.company)) {
        earned.get(id).push(exp);
      }
    }
  }

  const rank = (skill) => {
    const r = RARITIES.indexOf(String(skill.rarity).toLowerCase());
    return r === -1 ? RARITIES.length - 1 : r;
  };
  // Only earned trophies are shown, highest rarity first (JSON order within a rarity).
  // Unearned ones stay anonymous, like Steam's hidden achievements: only their count is revealed.
  // Three kinds of skill:
  //  - earned: referenced by an experience -> full trophy, highest rarity first
  //  - in development: not earned yet but has "progress" (0-100) -> shown with a progress bar
  //  - hidden: neither -> anonymous, only the count is revealed (Steam-style)
  const isEarned = (s) => earned.get(s.id).length > 0;
  const progressOf = (s) => Math.max(0, Math.min(100, Math.round(Number(s.progress))));
  const unlocked = skills.filter(isEarned).sort((a, b) => rank(a) - rank(b));
  const developing = skills
    .filter((s) => !isEarned(s) && s.progress != null && !Number.isNaN(Number(s.progress)))
    .sort((a, b) => progressOf(b) - progressOf(a));
  const hidden = skills.length - unlocked.length - developing.length;
  const glyphOf = (skill) => skill.icon || skill.title.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  // Header: a tally of earned trophies by rarity (no "x / y" ratio).
  document.getElementById('trophy-tally').append(...RARITIES
    .map((rarity) => [rarity, unlocked.filter((s) => RARITIES[rank(s)] === rarity).length])
    .filter(([, n]) => n > 0)
    .map(([rarity, n]) => el('li', { class: `tally rarity-${rarity}`, title: `${n} ${rarity}` },
      el('span', { class: 'tally-dot', 'aria-hidden': 'true' }), `${n} ${rarity}`)));

  const cards = unlocked.map((skill) => {
    const rarity = RARITIES[rank(skill)];
    return el('article', { class: `badge rarity-${rarity}` },
      el('div', { class: 'badge-medal', 'aria-hidden': 'true' }, el('span', { class: 'badge-glyph' }, glyphOf(skill))),
      el('span', { class: 'badge-rarity' }, rarity),
      el('h3', { class: 'badge-title' }, skill.title),
      el('p', { class: 'badge-desc' }, skill.description),
      el('div', { class: 'badge-achieved' },
        el('p', { class: 'badge-achieved-label' }, 'Achieved at:'),
        el('ul', { class: 'badge-companies' },
          earned.get(skill.id).map((exp) => el('li', { style: { '--co': exp.colour } }, companyIcon(exp), exp.company)))));
  });

  for (const skill of developing) {
    const pct = progressOf(skill);
    cards.push(el('article', { class: `badge badge-dev rarity-${RARITIES[rank(skill)]}`, style: { '--p': pct } },
      el('div', { class: 'medal-wrap', 'aria-hidden': 'true' },
        el('span', { class: 'dev-ring' }),
        el('div', { class: 'badge-medal' }, el('span', { class: 'badge-glyph' }, glyphOf(skill)))),
      el('span', { class: 'badge-rarity' }, 'In development'),
      el('h3', { class: 'badge-title' }, skill.title),
      el('p', { class: 'badge-desc' }, skill.description),
      el('div', { class: 'badge-achieved' },
        el('p', { class: 'badge-achieved-label' }, 'Progress:'),
        el('div', { class: 'dev-progress' },
          el('span', { class: 'dev-bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': `${skill.title} progress` },
            el('span', { style: { width: `${pct}%` } })),
          el('span', { class: 'dev-pct' }, `${pct}%`)))));
  }

  if (hidden > 0) {
    cards.push(el('article', { class: 'badge badge-hidden' },
      el('div', { class: 'badge-medal', 'aria-hidden': 'true' }, el('span', { class: 'badge-glyph' }, '?')),
      el('span', { class: 'badge-rarity' }, 'Hidden'),
      el('h3', { class: 'badge-title' }, `+${hidden} hidden achievement${hidden === 1 ? '' : 's'}`),
      el('p', { class: 'badge-desc' }, 'Details will be revealed once unlocked.'),
      // Same bottom box as the other cards; the rarity stays a mystery too.
      el('div', { class: 'badge-achieved' },
        el('p', { class: 'badge-achieved-label' }, 'Rarity:'),
        el('p', { class: 'hidden-rarity' },
          el('span', { class: 'hidden-rarity-dots', 'aria-hidden': 'true' },
            [...RARITIES].reverse().map((r) => el('span', { class: `tally-dot rarity-${r}` }))),
          'Unknown'))));
  }

  document.getElementById('skills-grid').append(...cards);
}

function renderContributions(contributions, experience) {
  const byCompany = new Map(experience.map((e) => [e.company.toLowerCase(), e]));
  const sorted = [...contributions].sort((a, b) => parseDate(b.date) - parseDate(a.date));

  document.getElementById('contributions-grid').append(...sorted.map((c) => {
    const exp = byCompany.get(String(c.company).toLowerCase());
    const repo = c.repo_url.replace(/^https?:\/\/(www\.)?github\.com\//, '');
    return el('article', { class: 'card', style: { '--co': exp?.colour ?? 'var(--accent)' } },
      el('div', { class: 'card-meta' },
        el('span', { class: 'card-company' }, companyIcon(exp), c.company),
        el('time', { datetime: parseDate(c.date).toISOString().slice(0, 7) }, formatLong(c.date))),
      el('h3', { class: 'card-title' }, c.title),
      c.description ? el('p', { class: 'card-desc' }, c.description) : null,
      el('a', { class: 'card-link', href: c.repo_url, target: '_blank', rel: 'noopener' },
        githubIcon(), el('span', {}, repo), el('span', { 'aria-hidden': 'true' }, '→')));
  }));
}

function githubIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z');
  svg.append(path);
  return svg;
}

// ---------- theme toggle ----------

function setupTheme() {
  const root = document.documentElement;
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = root.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
  });
}

// ---------- boot ----------

async function main() {
  setupTheme();
  try {
    const [profile, experience, skills, contributions] = await Promise.all(
      Object.values(DATA).map(loadJSON));
    const scale = buildScale(experience);
    renderProfile(profile);
    renderExperience(experience, scale);
    renderTech(experience, scale);
    renderSkills(skills, experience);
    renderContributions(contributions, experience);
  } catch (err) {
    console.error(err);
    document.querySelector('main').prepend(el('div', { class: 'load-error' },
      el('strong', {}, 'Could not load portfolio data. '),
      location.protocol === 'file:'
        ? 'Browsers block fetch() on file:// — serve the folder with a local server (see README).'
        : String(err.message)));
  }
}

main();
