// Sound for Echo Tower — everything is synthesised with WebAudio, so there
// are no audio files to load. Replace or extend `play()` cases to add sounds.
// The AudioContext is created lazily on the first user gesture (browser rule).

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = (localStorage.getItem('echoTower.sound') ?? 'on') === 'on';
    this.musicNodes = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('echoTower.sound', this.enabled ? 'on' : 'off');
    if (!this.enabled) this.stopMusic();
    else this.startMusic();
    return this.enabled;
  }

  tone({ freq = 440, type = 'sine', dur = 0.1, vol = 0.2, slide = 0, delay = 0 }) {
    if (!this.enabled || !this.ensureContext()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.08, vol = 0.15, freq = 800, delay = 0 }) {
    if (!this.enabled || !this.ensureContext()) return;
    const t0 = this.ctx.currentTime + delay;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  // Map game events (from logic.step) to sounds.
  play(event) {
    switch (event) {
      case 'step': this.noise({ dur: 0.05, vol: 0.08, freq: 900 }); break;
      case 'statue-step': this.noise({ dur: 0.09, vol: 0.1, freq: 300 }); break;
      case 'bump': this.tone({ freq: 90, type: 'triangle', dur: 0.09, vol: 0.22 }); break;
      case 'push': this.noise({ dur: 0.16, vol: 0.14, freq: 450 }); break;
      case 'splash': {
        this.noise({ dur: 0.3, vol: 0.22, freq: 1200 });
        this.tone({ freq: 300, type: 'sine', dur: 0.25, vol: 0.12, slide: -200 });
        break;
      }
      case 'latch': this.tone({ freq: 220, type: 'square', dur: 0.1, vol: 0.12, slide: -60 }); break;
      case 'door-open': {
        this.tone({ freq: 330, type: 'triangle', dur: 0.09, vol: 0.14 });
        this.tone({ freq: 440, type: 'triangle', dur: 0.12, vol: 0.14, delay: 0.07 });
        break;
      }
      case 'door-close': {
        this.tone({ freq: 440, type: 'triangle', dur: 0.09, vol: 0.12 });
        this.tone({ freq: 300, type: 'triangle', dur: 0.12, vol: 0.12, delay: 0.07 });
        break;
      }
      case 'win': {
        const notes = [392, 494, 587, 784];
        notes.forEach((f, i) =>
          this.tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.16, delay: i * 0.09 })
        );
        break;
      }
    }
  }

  // A very quiet two-chord ambient pad so the tower doesn't feel silent.
  startMusic() {
    if (!this.enabled || !this.ensureContext() || this.musicNodes) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    gain.connect(this.master);
    const oscs = [196, 294, 392].map((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.05 + i * 0.03;
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      osc.start();
      lfo.start();
      return { osc, lfo };
    });
    this.musicNodes = { gain, oscs };
  }

  stopMusic() {
    if (!this.musicNodes) return;
    for (const { osc, lfo } of this.musicNodes.oscs) {
      osc.stop();
      lfo.stop();
    }
    this.musicNodes.gain.disconnect();
    this.musicNodes = null;
  }
}
