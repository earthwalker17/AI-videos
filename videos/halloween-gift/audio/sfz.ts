/**
 * A small SFZ reader: the subset VSCO 2 CE uses. Headers <control> (default_path), <global>,
 * <master>, <group> and <region>, with opcodes inherited downwards; comments (// and block);
 * values that run to the next opcode or the end of the line (so paths may hold spaces);
 * backslashes in paths become slashes. Unknown opcodes and headers are ignored.
 */

export interface SfzRegion {
  /** POSIX path relative to the library root (default_path + sample) */
  sample: string;
  lokey: number;
  hikey: number;
  keycenter: number;
  lovel: number;
  hivel: number;
  /** dB */
  volume: number;
  /** cents */
  tune: number;
  /** semitones */
  transpose: number;
  /** s */
  attack: number;
  /** s */
  release: number;
  seqLength: number;
  seqPosition: number;
  lorand: number;
  hirand: number;
  /** percent */
  ampVeltrack: number;
  /** sample frames skipped at the start */
  offset: number;
}

const NOTE = /^([a-g])([#b]?)(-?\d+)$/i;
const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** A key value: a MIDI number or a note name (c4 = 60, c#4 = 61, db4 = 61). */
export function parseKey(v: string): number {
  const t = v.trim();
  if (/^-?\d+$/.test(t)) return Number(t);
  const m = NOTE.exec(t);
  if (!m) throw new Error(`sfz: '${v}' is not a key`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PC[m[1].toLowerCase()] + acc;
}

const num = (v: string | undefined, d: number): number => {
  if (v === undefined) return d;
  const x = Number(v.trim());
  return Number.isFinite(x) ? x : d;
};

type Opcodes = Map<string, string>;

/** Strip // line comments and block comments. */
function uncomment(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\r\n]*/g, '');
}

function resolve(control: Opcodes, layers: Opcodes[]): SfzRegion | null {
  const o = new Map<string, string>();
  for (const l of layers) for (const [k, v] of l) o.set(k, v);
  const sample = o.get('sample');
  if (!sample) return null;
  const path = `${control.get('default_path') ?? ''}${sample}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '');
  const key = o.get('key');
  const lokey = o.has('lokey') ? parseKey(o.get('lokey')!) : key ? parseKey(key) : 0;
  const hikey = o.has('hikey') ? parseKey(o.get('hikey')!) : key ? parseKey(key) : 127;
  const keycenter = o.has('pitch_keycenter') ? parseKey(o.get('pitch_keycenter')!) : key ? parseKey(key) : 60;
  return {
    sample: path,
    lokey,
    hikey,
    keycenter,
    lovel: num(o.get('lovel'), 0),
    hivel: num(o.get('hivel'), 127),
    volume: num(o.get('volume'), 0),
    tune: num(o.get('tune'), 0),
    transpose: num(o.get('transpose'), 0),
    attack: num(o.get('ampeg_attack'), 0),
    release: num(o.get('ampeg_release'), 0.001),
    seqLength: num(o.get('seq_length'), 1),
    seqPosition: num(o.get('seq_position'), 1),
    lorand: num(o.get('lorand'), 0),
    hirand: num(o.get('hirand'), 1),
    ampVeltrack: num(o.get('amp_veltrack'), 100),
    offset: num(o.get('offset'), 0),
  };
}

/** Every region of an SFZ text, in file order, with inherited opcodes resolved. */
export function parseSfz(text: string): SfzRegion[] {
  const src = uncomment(text);
  const control: Opcodes = new Map();
  let global: Opcodes = new Map();
  let master: Opcodes = new Map();
  let group: Opcodes = new Map();
  let region: Opcodes | null = null;
  let current: Opcodes | null = null;
  const out: SfzRegion[] = [];
  const flush = () => {
    if (region) {
      const r = resolve(control, [global, master, group, region]);
      if (r) out.push(r);
    }
    region = null;
  };
  // a header, or an opcode name that starts a token (after whitespace or a header)
  const token = /<([A-Za-z_]+)>|(?<![^\s>])([A-Za-z0-9_]+)=/g;
  const matches = [...src.matchAll(token)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m[1] !== undefined) {
      flush();
      switch (m[1].toLowerCase()) {
        case 'control':
          current = control;
          break;
        case 'global':
          global = new Map();
          master = new Map();
          group = new Map();
          current = global;
          break;
        case 'master':
          master = new Map();
          group = new Map();
          current = master;
          break;
        case 'group':
          group = new Map();
          current = group;
          break;
        case 'region':
          region = new Map();
          current = region;
          break;
        default:
          current = null;
      }
      continue;
    }
    const start = (m.index ?? 0) + m[0].length;
    const next = i + 1 < matches.length ? (matches[i + 1].index ?? src.length) : src.length;
    const eol = src.slice(start, next).search(/[\r\n]/);
    const value = src.slice(start, eol < 0 ? next : start + eol).trim();
    current?.set(m[2].toLowerCase(), value);
  }
  flush();
  return out;
}
