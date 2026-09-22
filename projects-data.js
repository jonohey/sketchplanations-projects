// ---------------------------------------------------------------------------
// Sketchplanations Projects — the list of projects shown on the home page.
//
// To add a new project, add an object to the PROJECTS array below. Only
// `name`, `url` and `description` are required — everything else has a
// sensible fallback (see site.js).
//
//   {
//     name: "My New Thing",              // shown as the card title
//     url: "my-new-thing/",               // link to the project folder (relative, trailing slash)
//     description: "One line about it.", // shown under the title
//     accent: "#4f8fce",                  // optional — a hex colour for the card's theme
//     icon: "spark",                      // optional — one of the icons in site.js, defaults to "spark"
//     status: "new",                      // optional — "new" adds a small badge to the card
//   }
//
// That's it — the page picks it up automatically, no other files to touch.
// ---------------------------------------------------------------------------

const PROJECTS = [
  {
    name: "Echo Tower",
    url: "echo-tower/",
    description: "A top-down puzzle game where stone statues echo your every move.",
    accent: "#e0645c",
    icon: "tower",
  },
  {
    name: "Ofman Core Quadrant",
    url: "ofman-quadrant/",
    description: "A guided self-reflection tool built on Daniel Ofman's Core Quadrant model.",
    accent: "#7c6fda",
    icon: "quadrant",
  },
  {
    name: "First Godot Game",
    url: "first-game-test-1/",
    description: "A first Godot game exported for the web — play in the browser.",
    accent: "#2f9e8f",
    icon: "robot",
  },
];
