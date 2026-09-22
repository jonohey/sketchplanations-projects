// ---------------------------------------------------------------------------
// Renders the project cards from PROJECTS (see projects-data.js).
// You shouldn't need to edit this file to add or change a project.
// ---------------------------------------------------------------------------

const ICONS = {
  // Echo Tower — a stack of floors with a figure and its statue echo.
  tower: `
    <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="70" y="18" width="60" height="26" rx="2" stroke="currentColor" stroke-width="3"/>
      <rect x="55" y="46" width="90" height="32" rx="2" stroke="currentColor" stroke-width="3"/>
      <rect x="38" y="80" width="124" height="38" rx="2" stroke="currentColor" stroke-width="3"/>
      <rect x="20" y="120" width="160" height="26" rx="2" stroke="currentColor" stroke-width="3"/>
      <circle cx="150" cy="133" r="7" stroke="currentColor" stroke-width="3"/>
      <path d="M150 140v14M144 148h12M144 160l6-8 6 8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <circle cx="95" cy="98" r="6" stroke="currentColor" stroke-width="2.5" opacity="0.55"/>
      <path d="M95 104v11M90 111h10M90 121l5-6 5 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
    </svg>`,

  // Ofman Core Quadrant — a crossed 2x2 grid with four qualities.
  quadrant: `
    <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M120 20v120M30 80h180" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <rect x="42" y="32" width="60" height="36" rx="4" stroke="currentColor" stroke-width="2.5"/>
      <rect x="138" y="32" width="60" height="36" rx="4" stroke="currentColor" stroke-width="2.5" opacity="0.6"/>
      <rect x="42" y="92" width="60" height="36" rx="4" stroke="currentColor" stroke-width="2.5" opacity="0.6"/>
      <rect x="138" y="92" width="60" height="36" rx="4" stroke="currentColor" stroke-width="2.5"/>
      <circle cx="120" cy="80" r="5" fill="currentColor"/>
    </svg>`,

  // First Godot Game — a friendly little robot.
  robot: `
    <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M120 20v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <circle cx="120" cy="15" r="6" stroke="currentColor" stroke-width="3"/>
      <rect x="70" y="34" width="100" height="70" rx="14" stroke="currentColor" stroke-width="3"/>
      <circle cx="98" cy="66" r="8" fill="currentColor"/>
      <circle cx="142" cy="66" r="8" fill="currentColor"/>
      <path d="M96 88q24 14 48 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <rect x="46" y="112" width="148" height="30" rx="8" stroke="currentColor" stroke-width="3"/>
      <path d="M70 104v10M170 104v10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>`,

  // Default fallback for any project that doesn't specify its own icon.
  spark: `
    <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M120 30l10 34 34 10-34 10-10 34-10-34-34-10 34-10z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="60" cy="45" r="4" fill="currentColor" opacity="0.6"/>
      <circle cx="185" cy="120" r="5" fill="currentColor" opacity="0.6"/>
      <circle cx="190" cy="40" r="3" fill="currentColor" opacity="0.6"/>
    </svg>`,
};

function renderProjects(projects) {
  const grid = document.getElementById("grid");
  if (!grid) return;

  grid.innerHTML = projects
    .map((project, i) => {
      const accent = project.accent || "#3a3733";
      const icon = ICONS[project.icon] || ICONS.spark;
      const badge = project.status
        ? `<span class="badge">${escapeHtml(project.status)}</span>`
        : "";
      return `
        <a class="card" href="${escapeAttr(project.url)}" style="--accent: ${accent}; --i: ${i}">
          <span class="card-art" aria-hidden="true">${icon}</span>
          <span class="card-body">
            <span class="card-title">${escapeHtml(project.name)}${badge}</span>
            <span class="card-desc">${escapeHtml(project.description || "")}</span>
          </span>
        </a>`;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function escapeAttr(str) {
  return escapeHtml(str);
}

document.addEventListener("DOMContentLoaded", () => renderProjects(PROJECTS));
