// Portfolio renderer: every section is built at load time from the JSON files in /data,
// so editing those files is enough to update the page.

const DATA = {
  profile: 'data/profile.json',
  experience: 'data/experience.json',
  skills: 'data/skills.json',
  contributions: 'data/contributions.json',
  expertise: 'data/expertise.json',
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

/**
 * Lays jobs out on a time axis; shared by the Experience timeline and the Technical Expertise rows so both
 * always agree. Returns [{ exp, s, e, lane, slots }] where s/e are the drawn start/end, lane is the row
 * (0 = first) and slots is how many lanes the job shares the track with (1 = full size).
 */
function layoutJobs(jobs) {
  const sorted = [...jobs].sort((a, b) => parseDate(a.start_date) - parseDate(b.start_date));

  // MM/YY dates can't express a same-month handover (one job ends and the next starts that month),
  // so up to one month of overlap counts as back-to-back rather than concurrent.
  const HANDOVER = 32 * 24 * 3600 * 1000; // a month, plus slack for daylight-saving shifts
  const overlaps = (a, b) => a.s < b.e - HANDOVER && b.s < a.e - HANDOVER;

  // Truly overlapping jobs go into separate lanes so nothing hides behind anything else.
  const laneEnds = [];
  const placed = sorted.map((exp) => {
    const s = parseDate(exp.start_date);
    const e = parseEnd(exp.end_date);
    let lane = laneEnds.findIndex((end) => end - s <= HANDOVER);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = e;
    return { exp, s, e, lane };
  });
  // In a handover month the two boxes meet in the middle of it, whichever lane the next job is in.
  // That way a job ending the month before (e.g. 10/21) still ends visibly earlier than one ending
  // in the handover month itself (11/21 → next job starting 11/21).
  const MID_MONTH = 15 * 24 * 3600 * 1000;
  const handovers = [];
  for (const p of placed) {
    for (const q of placed) {
      if (q !== p && q.s > p.s && q.s < p.e && !overlaps(p, q)) handovers.push([p, q]);
    }
  }
  for (const [p, q] of handovers) {
    const boundary = new Date(Math.min(q.s.valueOf() + MID_MONTH, p.e.valueOf()));
    p.e = boundary;
    q.s = boundary;
  }
  // A box only shares the track with the jobs it actually overlaps; otherwise it uses the full size.
  for (const p of placed) {
    p.slots = Math.max(p.lane, ...placed.filter((q) => q !== p && overlaps(p, q)).map((q) => q.lane)) + 1;
  }
  return placed;
}

function renderExperience(experience, scale) {
  const placed = layoutJobs(experience);
  const lanes = Math.max(...placed.map((p) => p.lane)) + 1;

  const track = el('div', { class: 'xp-track', style: { '--lanes': lanes } },
    gridlines(scale),
    // Inset by the same gap that separates the boxes, so the edge boxes don't touch the bars.
    el('div', { class: 'xp-lanes' }, placed.map(({ exp, s, e, lane, slots }) => {
      const dates = `${exp.start_date} – ${formatMMYY(exp.end_date)}`;
      return el('article', {
        class: 'xp-block',
        style: {
          // Position along the time axis and lane; the CSS maps these to left/top or top/left.
          '--pos': `${scale.pct(s)}%`,
          '--len': `${scale.pct(e) - scale.pct(s)}%`,
          '--lane': lane,
          '--slots': slots,
          background: exp.colour,
          color: textOn(exp.colour),
        },
        title: `${exp.company} · ${exp.job_title} · ${dates}`,
        tabindex: '0',
      },
      companyIcon(exp, 'co-icon xp-icon'),
      // Optional "short_name" replaces the full name when the box is too narrow for it.
      el('strong', { class: 'xp-company' },
        el('span', { class: 'name-full' }, exp.company),
        exp.short_name ? el('span', { class: 'name-short' }, exp.short_name) : null),
      el('span', { class: 'xp-role' }, exp.job_title),
      el('span', { class: 'xp-date xp-date-start' }, exp.start_date),
      el('span', { class: 'xp-date xp-date-end' }, formatMMYY(exp.end_date)));
    })));

  // The canvas is sized relative to the shortest job (--span-ratio), so the shortest box is just wide
  // (or, in the vertical layout, tall) enough for its content. When that is wider than the screen the
  // timeline scrolls sideways and opens at "Now", so the current role is seen first.
  const canvas = el('div', { class: 'xp-canvas', style: {
    '--span-ratio': (scale.end - scale.start) / Math.min(...placed.map(({ s, e }) => e - s)),
  } }, track, axis(scale));
  const scroller = el('div', { class: 'xp-scroll', tabindex: '0', 'aria-label': 'Experience timeline' }, canvas);
  const hint = el('p', { class: 'xp-hint', 'aria-hidden': 'true' }, '← Scroll for earlier roles');
  const root = document.getElementById('experience-timeline');
  root.append(scroller, hint);

  const update = () => root.classList.toggle('is-scrollable', scroller.scrollWidth > scroller.clientWidth + 1);
  new ResizeObserver(update).observe(scroller);
  requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; update(); });
  scroller.addEventListener('scroll', () =>
    hint.classList.toggle('at-start', scroller.scrollLeft < 8), { passive: true });
  enableDragScroll(scroller);
}

/** Lets mouse users pan a horizontally scrollable element by dragging it. */
function enableDragScroll(node) {
  let startX = 0, startLeft = 0, dragging = false;
  node.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0 || node.scrollWidth <= node.clientWidth) return;
    dragging = true; startX = ev.clientX; startLeft = node.scrollLeft;
    node.setPointerCapture(ev.pointerId);
    node.classList.add('dragging');
  });
  node.addEventListener('pointermove', (ev) => {
    if (dragging) node.scrollLeft = startLeft - (ev.clientX - startX);
  });
  const stop = () => { dragging = false; node.classList.remove('dragging'); };
  node.addEventListener('pointerup', stop);
  node.addEventListener('pointercancel', stop);
}

/** Total time covered by a set of {s, e} spans, merging overlaps so concurrent jobs count once. */
function coveredTime(spans) {
  let total = 0, curS = null, curE = null;
  for (const { s, e } of [...spans].sort((a, b) => a.s - b.s)) {
    if (curE && s <= curE) { if (e > curE) curE = e; continue; }
    if (curE) total += curE - curS;
    curS = s; curE = e;
  }
  if (curE) total += curE - curS;
  return total;
}

const YEAR = 365.25 * 24 * 3600 * 1000;

function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  for (const c of children.flat()) if (c != null) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}

/** Splits a label into lines of roughly `max` characters at word boundaries. */
function wrapWords(text, max = 14) {
  const lines = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= max) lines[lines.length - 1] = last + ' ' + word;
    else lines.push(word);
  }
  return lines;
}

function renderTech(experience, expertise, scale) {
  const spanOf = (exp) => ({ exp, s: parseDate(exp.start_date), e: parseEnd(exp.end_date) });
  const root = document.getElementById('tech-chart');

  // Each job's tech_stack is grouped by category: { "Robotics": ["ROS2", ...], "Core Tools": [...] }.
  // A plain list (the original format) still works: its items go to "Other".
  // expertise.json only says how categories look; it never lists the items themselves.
  const OTHER = 'Other';
  const hidden = new Set(expertise.hidden ?? []);
  const overrides = expertise.overrides ?? {};
  const techOf = (exp) => {
    const ts = exp.tech_stack ?? [];
    const pairs = Array.isArray(ts)
      ? ts.map((name) => [OTHER, name])
      : Object.entries(ts).flatMap(([group, names]) => names.map((name) => [group, name]));
    return pairs.filter(([, name]) => !hidden.has(name)).map(([group, name]) => ({ group, name }));
  };
  const jobsIn = (groupNames) => experience.filter((exp) => techOf(exp).some((t) => groupNames.includes(t.group)));

  // category -> item -> experiences. Jobs are read oldest first, so items keep a stable order.
  const byGroup = new Map();
  for (const exp of [...experience].sort((a, b) => parseDate(a.start_date) - parseDate(b.start_date))) {
    for (const { group, name } of techOf(exp)) {
      if (!byGroup.has(group)) byGroup.set(group, new Map());
      const items = byGroup.get(group);
      if (!items.has(name)) items.set(name, []);
      items.get(name).push(exp);
    }
  }

  /**
   * Time used, companies, and whether the current role uses it, all derived from experience.json.
   * expertise.json "overrides" can replace them per item: { "C++": { "years": 4, "current": true } }.
   */
  const stat = (name, exps) => {
    const o = overrides[name] ?? {};
    return {
      name,
      ms: o.years != null ? Number(o.years) * YEAR : coveredTime(exps.map(spanOf)),
      companies: [...new Set(exps.map((e) => e.company))],
      current: typeof o.current === 'boolean' ? o.current : exps.some((e) => isOngoing(e.end_date)),
    };
  };

  // Highlight, in the branch timeline, the companies where an item was used.
  const focusCompanies = (companies) => {
    root.classList.toggle('focus', !!companies);
    for (const bar of root.querySelectorAll('.tech-bar')) {
      bar.classList.toggle('hl', !!companies && companies.includes(bar.dataset.company));
    }
  };

  // ---------- branches: one timeline row per career branch ----------

  // Bars use the same layout as the Experience timeline: overlapping jobs share the row as half-height
  // bars and same-month handovers meet mid-month. Corners that touch another bar are squared off so
  // consecutive jobs read as one continuous bar.
  const TOUCH = 2 * 24 * 3600 * 1000;
  const bars = (name, placed) => placed.map((p) => {
    const { exp, s, e, lane, slots } = p;
    // Each corner is squared only if a touching bar covers it vertically, e.g. a full-height bar that
    // follows a half-height one keeps its other corner rounded. Heights are fractions of the row (0 = top).
    const top = (x) => x.lane / x.slots, bottom = (x) => (x.lane + 1) / x.slots;
    const covers = (q, y) => top(q) - 1e-6 <= y && y <= bottom(q) + 1e-6;
    const before = placed.filter((q) => q !== p && Math.abs(q.e - s) < TOUCH); // bars ending where this starts
    const after = placed.filter((q) => q !== p && Math.abs(q.s - e) < TOUCH); // bars starting where this ends
    const square = {
      tl: before.some((q) => covers(q, top(p))), bl: before.some((q) => covers(q, bottom(p))),
      tr: after.some((q) => covers(q, top(p))), br: after.some((q) => covers(q, bottom(p))),
    };
    const corners = Object.entries(square).filter(([, on]) => on).map(([c]) => ` sq-${c}`).join('');
    return el('div', {
      class: `tech-bar${corners}${slots > 1 ? ' shared' : ''}`,
      'data-company': exp.company,
      style: {
        left: `${scale.pct(s)}%`, width: `${scale.pct(e) - scale.pct(s)}%`, background: exp.colour,
        '--lane': lane, '--slots': slots,
      },
      title: `${name} @ ${exp.company} (${exp.start_date} – ${formatMMYY(exp.end_date)})`,
    }, companyIcon(exp, 'co-icon bar-icon'));
  });

  const branchRows = (expertise.branches ?? []).map((b) => {
    // A branch is active during the jobs that have something in one of its categories.
    const groupNames = b.groups ?? [];
    const jobs = jobsIn(groupNames);
    if (!jobs.length) return null; // e.g. Mobile until a job lists something under it
    const placed = layoutJobs(jobs);
    // Linked to the card of its first category (or "radar", if set): hover highlights it, click scrolls to it.
    const target = b.radar ?? groupNames[0];
    const linked = byGroup.has(target);
    const row = el('div', {
      class: `disc${linked ? ' disc-linked' : ''}`,
      ...(linked ? { role: 'button', tabindex: '0', 'aria-label': `${b.name}: show the ${target} breakdown` } : {}),
    },
    el('div', { class: 'disc-label' },
      el('span', { class: 'disc-icon', 'aria-hidden': 'true' }, b.icon),
      el('span', {},
        el('span', { class: 'disc-name' }, b.name),
        el('span', { class: 'disc-years' }, yearsBetween(coveredTime(jobs.map(spanOf)))))),
    el('div', { class: 'tech-track' }, gridlines(scale), bars(b.name, placed)));
    if (linked) {
      const card = () => document.querySelector(`[data-radar="${CSS.escape(target)}"]`);
      row.addEventListener('mouseenter', () => card()?.classList.add('linked'));
      row.addEventListener('mouseleave', () => card()?.classList.remove('linked'));
      const go = () => card()?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      row.addEventListener('click', go);
      row.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); }
      });
    }
    return row;
  }).filter(Boolean);

  const legendSeen = new Set();
  const legend = el('ul', { class: 'legend' }, experience
    .filter((e) => !legendSeen.has(e.company) && legendSeen.add(e.company))
    .map((exp) => el('li', {},
      el('span', { class: 'legend-swatch', style: { background: exp.colour } }, companyIcon(exp)),
      exp.company)));

  root.append(legend, el('div', { class: 'disc-list' }, branchRows,
    el('div', { class: 'disc disc-axis' }, el('div', { class: 'disc-label' }), el('div', { class: 'tech-axis' }, axis(scale)))));

  // ---------- radars: one spider chart per area, all on the same year rings ----------

  // Categories in expertise.json order, then any others found in the data (shown with a default icon).
  const config = new Map((expertise.groups ?? []).map((g) => [g.name, g]));
  const groups = [...new Set([...config.keys(), ...byGroup.keys()])]
    .filter((name) => byGroup.has(name))
    .map((name) => ({ icon: '•', ...config.get(name), name, stats: [...byGroup.get(name)].map(([n, exps]) => stat(n, exps)) }));

  const cardHead = (g, total) => el('header', { class: 'radar-head' },
    el('span', { class: 'disc-icon', 'aria-hidden': 'true' }, g.icon ?? ''),
    el('span', {},
      el('h3', { class: 'radar-title' }, g.name),
      el('span', { class: 'disc-years' }, `${yearsBetween(total)} of experience`)));
  const tipOf = (x) => `${x.name} · ${yearsBetween(x.ms)} · ${x.companies.join(', ') || 'manual estimate'}`
    + (x.current ? ' · in current role' : '');

  // "chart": "list" categories (e.g. Core Tools) are a plain list with the years beside each item, so tools
  // used in every job don't stretch the radars' shared scale. A category with fewer than 3 items can't make
  // a radar, so it is shown as a list too.
  const MIN_AXES = 3, MAX_AXES = 8;
  const asList = (g) => g.chart === 'list' || g.stats.length < MIN_AXES;
  const listCards = groups.filter(asList).map((g) => {
    const stats = [...g.stats].sort((a, b) => b.ms - a.ms);
    return el('article', { class: 'list-card', 'data-radar': g.name },
      cardHead(g, coveredTime(jobsIn([g.name]).map(spanOf))),
      el('ul', { class: 'tool-list' }, stats.map((x) => el('li', { title: tipOf(x) },
        el('span', { class: `key-dot${x.current ? ' current' : ''}`, 'aria-hidden': 'true' }),
        el('span', { class: 'tool-list-name' }, x.name),
        el('span', { class: 'tool-list-years' }, yearsBetween(x.ms))))),
      g.note ? el('p', { class: 'card-note' }, g.note) : null);
  });

  const radars = groups.filter((g) => !asList(g)).map((g) => {
    // Keep the longest-used items, in their original order so the shape stays stable.
    const top = new Set([...g.stats].sort((a, b) => b.ms - a.ms).slice(0, MAX_AXES));
    return {
      ...g,
      shown: g.stats.filter((x) => top.has(x)),
      more: g.stats.filter((x) => !top.has(x)),
      total: coveredTime(jobsIn([g.name]).map(spanOf)),
    };
  });
  // Section-wide note (expertise.json "note"), placed after all the charts since it applies to all of them.
  const sectionNote = expertise.note ? el('p', { class: 'section-note' }, expertise.note) : null;
  if (!radars.length) {
    document.getElementById('tech').append(...listCards, sectionNote ?? '');
    return;
  }

  // Shared scale for every radar. The outer ring is "radar_max_years" from expertise.json (e.g. 5 → "5y+"):
  // anything used longer sits on the edge, and its label still shows the real years.
  // Without that setting the outer ring is the longest item, rounded up.
  const longest = Math.max(...radars.flatMap((r) => r.shown.map((x) => x.ms / YEAR)));
  const capped = Number(expertise.radar_max_years) > 0;
  const top = capped ? Number(expertise.radar_max_years) : longest;
  const step = top > 8 ? 2 : 1; // rings every year, or every 2 years for long scales
  const outer = Math.max(step, Math.ceil(top / step) * step);

  const W = 380, H = 330, cx = W / 2, cy = H / 2, R = 112;
  const radarSvg = (r) => {
    const n = r.shown.length;
    const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const at = (i, radius) => [cx + radius * Math.cos(angle(i)), cy + radius * Math.sin(angle(i))];
    const pts = (radii) => radii.map((rad, i) => at(i, rad).map((v) => v.toFixed(1)).join(',')).join(' ');

    const rings = [];
    for (let y = step; y <= outer; y += step) {
      const rad = (y / outer) * R;
      rings.push(svgEl('polygon', { class: 'radar-ring', points: pts(r.shown.map(() => rad)) }));
      // Label every other ring (and the outer one) so the centre doesn't get crowded.
      if ((y / step) % 2 === 0 || y === outer) {
        const label = y === outer && capped ? `${y}y+` : `${y}y`;
        rings.push(svgEl('text', { class: 'radar-ring-label', x: cx + 4, y: cy - rad + 3 }, label));
      }
    }
    const spokes = r.shown.map((_, i) => {
      const [x, y] = at(i, R);
      return svgEl('line', { class: 'radar-spoke', x1: cx, y1: cy, x2: x, y2: y });
    });
    const value = (x) => (Math.min(x.ms / YEAR, outer) / outer) * R;
    const area = svgEl('polygon', { class: 'radar-area', points: pts(r.shown.map(value)) });

    const items = r.shown.map((x, i) => {
      const [px, py] = at(i, value(x));
      const [lx, ly] = at(i, R + 14);
      const anchor = lx > cx + 6 ? 'start' : lx < cx - 6 ? 'end' : 'middle';
      const lines = wrapWords(x.name);
      const lineH = 13;
      const extra = lines.length * lineH; // name lines below the first, plus the years line
      // Push labels away from the chart: up above the top, down below the bottom, centred at the sides.
      const dy = ly < cy - R * 0.5 ? -extra : ly > cy + R * 0.5 ? 0 : -extra / 2;
      const g = svgEl('g', { class: 'radar-item', tabindex: '0' },
        svgEl('title', {}, tipOf(x)),
        svgEl('circle', { class: 'radar-hit', cx: px, cy: py, r: 10 }),
        svgEl('circle', { class: `radar-point${x.current ? ' current' : ''}`, cx: px, cy: py, r: 4 }),
        svgEl('text', { class: 'radar-label', x: lx, y: ly + dy + 4, 'text-anchor': anchor },
          lines.map((line, k) => svgEl('tspan', { x: lx, dy: k ? lineH : 0 }, line)),
          svgEl('tspan', { class: 'radar-years', x: lx, dy: lineH }, yearsBetween(x.ms))));
      g.addEventListener('mouseenter', () => focusCompanies(x.companies));
      g.addEventListener('mouseleave', () => focusCompanies(null));
      g.addEventListener('focus', () => focusCompanies(x.companies));
      g.addEventListener('blur', () => focusCompanies(null));
      return g;
    });

    return svgEl('svg', {
      class: 'radar', viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': `${r.name}: ${r.shown.map((x) => `${x.name} ${yearsBetween(x.ms)}`).join(', ')}`,
    }, rings, spokes, area, items);
  };

  const cards = radars.map((r) => el('article', { class: 'radar-card', 'data-radar': r.name },
    cardHead(r, r.total),
    radarSvg(r),
    r.more.length
      ? el('p', { class: 'radar-more' }, `+${r.more.length} more: ${r.more.map((x) => `${x.name} (${yearsBetween(x.ms)})`).join(', ')}`)
      : null,
    r.note ? el('p', { class: 'card-note' }, r.note) : null));

  const scroller = el('div', { class: 'radar-scroll', tabindex: '0', 'aria-label': 'Expertise breakdown by area' }, cards);
  const hint = el('span', { class: 'radar-hint', 'aria-hidden': 'true' }, 'Scroll for more →');
  const foot = el('div', { class: 'radar-foot' },
    el('span', { class: 'radar-key' },
      el('span', { class: 'key-dot current' }), 'In current role',
      el('span', { class: 'key-dot' }), 'Used previously',
      el('span', { class: 'key-note' }, '· rings = years of use')),
    hint);
  const breakdown = el('div', { class: 'radar-section' }, scroller, foot);
  document.getElementById('tech').append(breakdown, ...listCards, sectionNote ?? '');

  const update = () => {
    breakdown.classList.toggle('is-scrollable', scroller.scrollWidth > scroller.clientWidth + 1);
    hint.classList.toggle('at-end', scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 8);
  };
  new ResizeObserver(update).observe(scroller);
  scroller.addEventListener('scroll', update, { passive: true });
  enableDragScroll(scroller);
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
  // "achieved_at" in skills.json lists places that aren't jobs (personal projects, courses...); a trophy
  // counts as earned if a job lists it in soft_skills or it has any of these.
  const extraOf = (s) => (Array.isArray(s.achieved_at) ? s.achieved_at : []).filter(Boolean);
  const isEarned = (s) => earned.get(s.id).length > 0 || extraOf(s).length > 0;
  const progressOf = (s) => Math.max(0, Math.min(100, Math.round(Number(s.progress))));
  const unlocked = skills.filter(isEarned).sort((a, b) => rank(a) - rank(b));
  const developing = skills
    .filter((s) => !isEarned(s) && s.progress != null && !Number.isNaN(Number(s.progress)))
    .sort((a, b) => progressOf(b) - progressOf(a));
  const hidden = skills.length - unlocked.length - developing.length;
  const glyphOf = (skill) => skill.icon || skill.title.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  // Each card has a tag for the header chips' filter: its rarity if earned, 'dev' if in development,
  // null for the hidden card (only shown without a filter).
  const cards = unlocked.map((skill) => {
    const rarity = RARITIES[rank(skill)];
    return { tag: rarity, node: el('article', { class: `badge rarity-${rarity}` },
      el('div', { class: 'badge-medal', 'aria-hidden': 'true' }, el('span', { class: 'badge-glyph' }, glyphOf(skill))),
      el('span', { class: 'badge-rarity' }, rarity),
      el('h3', { class: 'badge-title' }, skill.title),
      el('p', { class: 'badge-desc' }, skill.description),
      el('div', { class: 'badge-achieved' },
        el('p', { class: 'badge-achieved-label' }, 'Achieved at:'),
        el('ul', { class: 'badge-companies' },
          earned.get(skill.id).map((exp) => el('li', { style: { '--co': exp.colour } }, companyIcon(exp), exp.company)),
          extraOf(skill).map((name) => el('li', { class: 'chip-other' }, name))))) };
  });

  for (const skill of developing) {
    const pct = progressOf(skill);
    cards.push({ tag: 'dev', node: el('article', { class: `badge badge-dev rarity-${RARITIES[rank(skill)]}`, style: { '--p': pct } },
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
          el('span', { class: 'dev-pct' }, `${pct}%`)))) });
  }

  if (hidden > 0) {
    cards.push({ tag: null, node: el('article', { class: 'badge badge-hidden' },
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
          'Unknown'))) });
  }

  // ---------- rarity filter (header chips) + pagination ----------

  const PAGE_SIZE = 8;
  let filter = null; // a rarity, or null for everything
  let page = 0;
  const grid = document.getElementById('skills-grid');
  const pager = el('nav', { class: 'pager', 'aria-label': 'Soft skills pages' });
  grid.after(pager);

  // Header chips: earned trophies per rarity (no "x / y" ratio), plus the in-development ones. Clicking a
  // chip shows only those trophies; clicking it again shows everything. The hidden card only appears
  // without a filter.
  const tally = document.getElementById('trophy-tally');
  const chipSpecs = [
    ...RARITIES.map((rarity) => ({
      tag: rarity, cls: `rarity-${rarity}`, label: rarity, what: `${rarity} trophies`,
      n: unlocked.filter((s) => RARITIES[rank(s)] === rarity).length,
    })),
    { tag: 'dev', cls: 'tally-dev', label: 'in development', what: 'trophies in development', n: developing.length },
  ];
  const chips = chipSpecs.filter((c) => c.n > 0).map((c) => {
    const btn = el('button', { type: 'button', class: `tally ${c.cls}`, 'aria-pressed': 'false' },
      el('span', { class: 'tally-dot', 'aria-hidden': 'true' }), `${c.n} ${c.label}`);
    btn.addEventListener('click', () => { filter = filter === c.tag ? null : c.tag; page = 0; render(); });
    return { ...c, btn };
  });
  tally.append(...chips.map(({ btn }) => el('li', {}, btn)));

  const goTo = (n) => {
    page = n;
    render();
    // Keep the top of the grid in view when the new page is shorter than the old one.
    if (grid.getBoundingClientRect().top < 0) document.getElementById('skills').scrollIntoView({ block: 'start' });
  };

  function render() {
    const visible = filter ? cards.filter((c) => c.tag === filter) : cards;
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    grid.replaceChildren(...visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((c) => c.node));

    tally.classList.toggle('filtering', !!filter);
    for (const { tag, what, btn } of chips) {
      btn.setAttribute('aria-pressed', String(tag === filter));
      btn.title = tag === filter ? 'Show all trophies' : `Show only ${what}`;
    }

    pager.hidden = pages <= 1;
    if (pager.hidden) return pager.replaceChildren();
    const pageBtn = (label, target, attrs = {}) => {
      const b = el('button', { type: 'button', class: 'pager-btn', ...attrs }, label);
      b.addEventListener('click', () => goTo(target));
      return b;
    };
    pager.replaceChildren(
      pageBtn('‹', page - 1, { 'aria-label': 'Previous page', disabled: page === 0 ? '' : null }),
      ...Array.from({ length: pages }, (_, i) => pageBtn(String(i + 1), i, {
        'aria-label': `Page ${i + 1}`, 'aria-current': i === page ? 'page' : null,
      })),
      pageBtn('›', page + 1, { 'aria-label': 'Next page', disabled: page === pages - 1 ? '' : null }));
  }
  render();
}

function renderContributions(contributions, experience) {
  // Nothing to show yet: hide the section and its nav link.
  if (!contributions.length) {
    document.getElementById('contributions').hidden = true;
    document.querySelector('.nav-links a[href="#contributions"]')?.setAttribute('hidden', '');
    return;
  }
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
    const [profile, experience, skills, contributions, expertise] = await Promise.all(
      Object.values(DATA).map(loadJSON));
    const scale = buildScale(experience);
    renderProfile(profile);
    renderExperience(experience, scale);
    renderTech(experience, expertise, scale);
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
