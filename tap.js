// Audio tap for gap-free recording (an AudioWorklet module). It collects the microphone samples and posts
// them to the page in blocks of 2048. It is a file, not a blob: URL, so the page's security rule (CSP) allows it.
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.b = []; this.n = 0; }
  process(inputs) {
    const c = inputs[0] && inputs[0][0];
    if (c) {
      this.b.push(c.slice(0)); this.n += c.length;
      if (this.n >= 2048) {
        const o = new Float32Array(this.n); let p = 0;
        for (const x of this.b) { o.set(x, p); p += x.length; }
        this.port.postMessage(o, [o.buffer]); this.b = []; this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('tap', Tap);
