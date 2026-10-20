# Portfolio

Static portfolio (plain HTML + CSS + vanilla JS, no build step) for GitHub Pages.
Every section is rendered at page load from the JSON files in `data/`, so editing a JSON file is all you need to update the page.

## Content

| File | What it controls |
|---|---|
| `data/profile.json` | Name, surnames, job title, profile image, the **phrase** under the header, social links, and section titles |
| `data/experience.json` | Experience timeline, Technical Expertise chart, and which companies a soft skill was earned at |
| `data/skills.json` | Soft-skill trophies `{ id, title, description, rarity?, progress?, icon? }`. `rarity` is `bronze`, `silver`, `gold` or `platinum` (default bronze); earned trophies are sorted by it. `icon` is optional (emoji); initials are used otherwise. A skill no experience references is shown as **in development** with a progress bar if it has `progress` (0–100), otherwise it counts towards the anonymous **hidden achievements** card. Note that the JSON is public, so hidden titles can still be read there. |
| `data/contributions.json` | Open-source cards `{ title, company, date, repo_url, description? }`. If `company` matches a company in `experience.json`, its colour and icon are used. |

Dates use `MM/YY`. Leave `end_date` empty (or `"present"`) for a current job; it is drawn up to today.

Company icons are relative paths (e.g. `assets/companies/acme.ico`). Replace `assets/profile.svg` with your photo and update `image` in `profile.json`.

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
