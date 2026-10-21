# Portfolio

Static portfolio (plain HTML + CSS + vanilla JS, no build step) for GitHub Pages.
Every section is rendered at page load from the JSON files in `data/`, so editing a JSON file is all you need to update the page.

## Content

| File | What it controls |
|---|---|
| `data/profile.json` | Name, surnames, job title, profile image, the **phrase** under the header (a one-line headline of what you do), optional **traits** shown under it as a dot-separated line, social links, and section titles |
| `data/experience.json` | Experience timeline, Technical Expertise and which companies a soft skill was earned at. `tech_stack` is grouped by category, e.g. `{ "Robotics": ["ROS2", "Planning"], "Core Tools": ["Git"] }`: this is the only place tools and competencies are listed. (A plain list still works; its items show under "Other".) |
| `data/expertise.json` | How Technical Expertise looks; it never lists tools. `groups`: the categories `{ name, icon, chart?, note? }` in display order. Each is a radar (at least 3 items; top 8 shown, the rest as "+N more"), or a plain list with `"chart": "list"` or when it has fewer than 3 items. Categories used in `tech_stack` but not listed here still appear, with a default icon. `branches`: timeline rows `{ name, icon, groups }`, active during jobs with something in those categories; hover highlights the matching card, click scrolls to it. Rows with no matching job are hidden. `hidden`: item names to leave out without deleting them from `tech_stack`. `overrides`: per-item fixes, e.g. `{ "C++": { "years": 4, "current": true } }` (`current` = filled dot, used in the current role). `radar_max_years`: the outer ring shared by all radars (e.g. `5` gives "5y+"; longer items sit on the edge but keep their real years in the label; remove it to scale to the longest item). `note`: small text below the whole section. |
| `data/skills.json` | Soft-skill trophies `{ id, title, description, rarity?, progress?, icon?, achieved_at? }`. `achieved_at` lists places that aren't jobs, e.g. `["Personal projects"]`: they show as neutral chips and make the trophy earned even if no job lists it. `rarity` is `bronze`, `silver`, `gold` or `platinum` (default bronze); earned trophies are sorted by it. `icon` is optional (emoji); initials are used otherwise. A skill no experience references is shown as **in development** with a progress bar if it has `progress` (0–100), otherwise it counts towards the anonymous **hidden achievements** card. Note that the JSON is public, so hidden titles can still be read there. |
| `data/contributions.json` | Open-source cards `{ title, company?, date, url? (or repo_url), description?, tags? }`. If `company` matches a company in `experience.json`, its colour and icon are used. Links show `owner/repo` for GitHub, otherwise the site name. While the list is empty (`[]`) the section and its nav link are hidden. |
| `data/projects.json` | Personal Projects, same card format as contributions. A card whose title matches a `"type": "personal"` entry in `experience.json` takes its colour and icon. Each card shows **Active** or **Closed**: from `status` (`"active"`/`"closed"`) if set, else the linked entry's `end_date`, else a `date` of `"Now"`; active ones come first. Cards also take `resource`: an extra URL (or list of URLs) for videos, Hugging Face, LinkedIn posts and so on, shown as a second link (it also works on contributions). Without `company` the card shows "Personal project"; `url` is optional (e.g. for private projects) and `tags` shows the tech used as chips. Hidden while empty. |

An experience entry with `"type": "personal"` is a long-running personal project: it is left out of the Experience timeline (so it never looks like a second job), but its `tech_stack` counts in Technical Expertise, where its bars are striped and the legend tags it "personal", and its `soft_skills` can earn trophies (dashed chip).

Experience entries may also have an optional `short_name` (e.g. `"PoliMi"`), shown instead of `company` when the job's box is too narrow for the full name.

Dates use `MM/YY`. Leave `end_date` empty (or `"present"`) for a current job; it is drawn up to today.

Company icons are relative paths (e.g. `assets/companies/acme.ico`). The profile photo is `assets/profile.jpeg` (set by `image` in `profile.json`; it is also the browser-tab icon).

## Run locally

Browsers block `fetch()` on `file://`, so serve the folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Deploy to GitHub Pages

1. Create a repo named `<username>.github.io`.
2. Push the contents of this folder to the `main` branch.
3. In the repo settings, under **Pages**, set the source to "Deploy from a branch", `main` / root.

The site will be at `https://<username>.github.io`. The `.nojekyll` file makes GitHub serve the files as-is.
