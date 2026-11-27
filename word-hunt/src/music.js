// Background music: a looping playlist that fades in and out.
// Nothing downloads until music is first turned on.
//
// To change the music, put files in word-hunt/music/ and list them here.
// AAC (.m4a) or MP3 at ~96 kbps is plenty for background listening.

export const ARTIST = "Jono Hey";
export const ARTIST_URL = "https://jonohey.bandcamp.com/";

export const TRACKS = [
  // From "After the Practice" (solo piano version) by Jono Hey.
  { src: "music/after-the-practice.m4a", title: "After the Practice" },
];

const VOLUME = 0.35;
const FADE_IN = 1.5; // seconds
const FADE_OUT = 0.6;

/**
 * on: the player wants music. holds: reasons it's silenced for now
 * (e.g. "paused" while the timer is paused, "hidden" while the tab is away).
 * Music plays when it's on and nothing holds it.
 */
export function createMusic(tracks = TRACKS) {
  let audio = null;
  let ctx = null;
  let gain = null;
  let index = 0;
  let on = false;
  let stopTimer = 0;
  const holds = new Set();

  const shouldPlay = () => on && holds.size === 0;

  function setup() {
    if (audio) return;
    audio = new Audio();
    audio.preload = "auto";
    // One track: loop it seamlessly. Several: play them in turn.
    audio.loop = tracks.length === 1;
    audio.addEventListener("ended", () => {
      index = (index + 1) % tracks.length;
      load();
      if (shouldPlay()) audio.play().catch(() => {});
    });
    // Route through Web Audio so volume and fades work on iPhones too,
    // where <audio>.volume is read-only.
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try {
        ctx = new AC();
        gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
      } catch {
        ctx = gain = null;
      }
    }
    load();
  }

  function load() {
    const t = tracks[index];
    audio.src = t.src;
    if ("mediaSession" in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: ARTIST,
        album: "Word Hunt",
      });
    }
  }

  function fadeTo(value, seconds) {
    if (gain) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(value, now + seconds);
    } else {
      audio.volume = value;
    }
  }

  // Browsers only start sound after a tap or key press. If an attempt is
  // blocked (e.g. music was left on last visit), try again on the next one.
  function retryOnGesture() {
    const go = () => {
      document.removeEventListener("pointerdown", go, true);
      document.removeEventListener("keydown", go, true);
      sync();
    };
    document.addEventListener("pointerdown", go, true);
    document.addEventListener("keydown", go, true);
  }

  function sync() {
    if (!tracks.length) return;
    clearTimeout(stopTimer);
    if (shouldPlay()) {
      setup();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      audio
        .play()
        .then(() => fadeTo(VOLUME, FADE_IN))
        .catch(retryOnGesture);
    } else if (audio && !audio.paused) {
      fadeTo(0, FADE_OUT);
      stopTimer = setTimeout(() => {
        if (!shouldPlay()) audio.pause();
      }, FADE_OUT * 1000 + 50);
    }
  }

  return {
    available: tracks.length > 0,
    get on() {
      return on;
    },
    setOn(value) {
      on = value;
      sync();
    },
    hold(reason) {
      holds.add(reason);
      sync();
    },
    release(reason) {
      holds.delete(reason);
      sync();
    },
  };
}
