# Ofman Core Quadrant

A short, guided self-reflection tool built on Daniel Ofman's Core Quadrant
model. Answer eleven questions about your core quality, pitfall, challenge
and allergy, and get back a personalised diagram and summary.

**Try it:** https://jonohey.github.io/sketchplanations-projects/ofman-quadrant/

A [Sketchplanations](https://sketchplanations.com) experiment. Model and
questions adapted from Daniel Ofman's [Core Quality
work](https://www.corequality.nl/?lang=en).

## How it's built

- React + Tailwind CSS, built with Vite. Source lives in [`app/`](app/).
- The SVG diagram on the results screen sizes its boxes from the text it
  holds — nothing is hardcoded — using a lightweight character-width
  estimate rather than a real canvas measurement, so it stays dependency-free.
- No backend: all eleven answers stay in memory for the session and are
  never sent anywhere.

## Developing

```bash
cd app
npm install
npm run dev
```

## Building and deploying

This repo's GitHub Pages is a "legacy" setup that serves the `main` branch
root directly — there's no Actions workflow that publishes a `dist/`
folder. So the build output is committed straight into this project folder
(`ofman-quadrant/index.html` and `ofman-quadrant/assets/`), which is what
actually gets served at the URL above. The `app/` folder holds the
buildable source; `app/dist/` (git-ignored) is Vite's raw build output.

To rebuild and redeploy after a change:

```bash
cd app
npm run build
rm -rf ../assets ../index.html
cp -r dist/assets ../assets
cp dist/index.html ../index.html
```

Then commit the changes under `ofman-quadrant/` (both `app/src/...` and the
regenerated `index.html` / `assets/`).
