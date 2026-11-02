/**
 * WAV in and out, without ffmpeg: the score's tracks must be a pure function of their inputs
 * down to the byte, so the writer emits only what the samples determine. Reading accepts what
 * sample libraries ship: PCM 16/24-bit and IEEE float 32-bit, plain or WAVE_FORMAT_EXTENSIBLE,
 * skipping chunks it does not know (LIST, bext, cue, smpl…).
 *
 * Writing: RIFF/WAVE with `fmt ` and `data` only, plus the `fact` chunk the WAV rules require
 * for non-PCM data. Float 32 uses WAVE_FORMAT_IEEE_FLOAT (tag 3) with an 18-byte fmt chunk whose
 * extension size is 0: byte for byte what `ffmpeg -c:a pcm_f32le -bitexact -map_metadata -1`
 * writes (verified in wav.test.ts). 24-bit uses plain PCM (tag 1, 16-byte fmt). No LIST/INFO,
 * no timestamps, no encoder tag: equal samples give equal bytes.
 */

/** Decoded audio: one Float32Array per channel, full scale ±1. */
export interface WavData {
  sampleRate: number;
  channels: Float32Array[];
}

export type WavEncoding = 'f32' | 's24';

const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;
const FORMAT_EXTENSIBLE = 0xfffe;
const S24 = 8_388_608;

const fourcc = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

/** Decode a WAV file's bytes. Throws on anything but PCM 16/24 and float 32. */
export function readWav(bytes: Uint8Array): WavData {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12 || fourcc(bytes, 0) !== 'RIFF' || fourcc(bytes, 8) !== 'WAVE') throw new Error('not a RIFF/WAVE file');
  let fmt: { format: number; channels: number; sampleRate: number; blockAlign: number; bits: number } | null = null;
  let data: { at: number; size: number } | null = null;
  for (let o = 12; o + 8 <= bytes.length && !(fmt && data); ) {
    const id = fourcc(bytes, o);
    const size = v.getUint32(o + 4, true);
    const body = o + 8;
    if (id === 'fmt ') {
      if (size < 16) throw new Error(`fmt chunk of ${size} bytes is too short`);
      let format = v.getUint16(body, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format is the first two bytes of the SubFormat GUID
      if (format === FORMAT_EXTENSIBLE) {
        if (size < 40) throw new Error('WAVE_FORMAT_EXTENSIBLE fmt chunk is too short');
        format = v.getUint16(body + 24, true);
      }
      fmt = { format, channels: v.getUint16(body + 2, true), sampleRate: v.getUint32(body + 4, true), blockAlign: v.getUint16(body + 12, true), bits: v.getUint16(body + 14, true) };
    } else if (id === 'data') {
      // a streamed WAV may claim more than the file holds: take what is there
      data = { at: body, size: Math.min(size, bytes.length - body) };
    }
    o = body + size + (size & 1);
  }
  if (!fmt) throw new Error('no fmt chunk');
  if (!data) throw new Error('no data chunk');
  const { format, channels: ch, bits, blockAlign } = fmt;
  const kind = format === FORMAT_PCM && bits === 16 ? 's16' : format === FORMAT_PCM && bits === 24 ? 's24' : format === FORMAT_FLOAT && bits === 32 ? 'f32' : null;
  if (!kind) throw new Error(`unsupported WAV encoding (format ${format}, ${bits} bits): expected PCM 16/24-bit or float 32-bit`);
  if (ch < 1 || blockAlign !== (ch * bits) / 8) throw new Error(`inconsistent fmt chunk (${ch} channels, ${bits} bits, block ${blockAlign})`);
  const frames = Math.floor(data.size / blockAlign);
  const out = Array.from({ length: ch }, () => new Float32Array(frames));
  const bps = bits / 8;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      const o = data.at + i * blockAlign + c * bps;
      out[c][i] = kind === 'f32' ? v.getFloat32(o, true) : kind === 's16' ? v.getInt16(o, true) / 32768 : ((bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) << 8 >> 8) / S24;
    }
  }
  return { sampleRate: fmt.sampleRate, channels: out };
}

/** Encode channels (equal lengths) as a WAV file: float 32 (default) or 24-bit PCM. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number, encoding: WavEncoding = 'f32'): Uint8Array {
  const ch = channels.length;
  if (ch < 1) throw new Error('a WAV needs at least one channel');
  const n = channels[0].length;
  if (channels.some((c) => c.length !== n)) throw new Error('every channel must have the same length');
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new Error(`invalid sample rate ${sampleRate}`);
  const float = encoding === 'f32';
  const bps = float ? 4 : 3;
  const fmtSize = float ? 18 : 16;
  const dataSize = n * ch * bps;
  const total = 12 + 8 + fmtSize + (float ? 12 : 0) + 8 + dataSize + (dataSize & 1);
  if (total - 8 > 0xffffffff) throw new Error(`${n} samples × ${ch} channels exceed the 4 GiB RIFF limit`);
  const bytes = new Uint8Array(total);
  const v = new DataView(bytes.buffer);
  const tag = (o: number, s: string) => {
    for (let k = 0; k < 4; k++) bytes[o + k] = s.charCodeAt(k);
  };
  tag(0, 'RIFF');
  v.setUint32(4, total - 8, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, fmtSize, true);
  v.setUint16(20, float ? FORMAT_FLOAT : FORMAT_PCM, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * bps, true);
  v.setUint16(32, ch * bps, true);
  v.setUint16(34, bps * 8, true);
  let o = 20 + fmtSize;
  if (float) {
    v.setUint16(36, 0, true); // cbSize: no extension
    tag(o, 'fact');
    v.setUint32(o + 4, 4, true);
    v.setUint32(o + 8, n, true);
    o += 12;
  }
  tag(o, 'data');
  v.setUint32(o + 4, dataSize, true);
  o += 8;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const x = channels[c][i];
      if (float) v.setFloat32(o, x, true);
      else {
        const s = Math.max(-S24, Math.min(S24 - 1, Math.round(x * S24)));
        bytes[o] = s & 0xff;
        bytes[o + 1] = (s >> 8) & 0xff;
        bytes[o + 2] = (s >> 16) & 0xff;
      }
      o += bps;
    }
  }
  return bytes;
}

/** The sample peak of decoded audio (max |x| over every channel). */
export function samplePeak(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  return peak;
}
