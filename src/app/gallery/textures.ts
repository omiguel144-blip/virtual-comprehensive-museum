import * as THREE from "three";

/** Procedural textures drawn on canvases: no external assets to license or load. */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function toTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Seeded random so the floor looks the same on every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Oak plank floor in two tones; repeat it across the room. */
export function woodFloorTexture([a, b]: [string, string]) {
  const [c, g] = canvas(512, 512);
  const rand = rng(7);
  const plank = 64;
  for (let row = 0; row < 512 / plank; row++) {
    let x = -rand() * 300;
    while (x < 512) {
      const len = 180 + rand() * 260;
      g.fillStyle = rand() > 0.5 ? a : b;
      g.fillRect(x, row * plank, len, plank);
      g.globalAlpha = 0.08;
      for (let i = 0; i < 14; i++) {
        g.fillStyle = rand() > 0.5 ? "#000" : "#fff";
        g.fillRect(x, row * plank + rand() * plank, len, 1 + rand() * 2);
      }
      g.globalAlpha = 0.35;
      g.fillStyle = "#1a120b";
      g.fillRect(x, row * plank, 2, plank);
      g.globalAlpha = 1;
      x += len;
    }
    g.fillStyle = "rgba(20,12,6,0.45)";
    g.fillRect(0, row * plank, 512, 2);
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Soft warm pool of light that sits on the wall behind a picture. */
let glow: THREE.Texture | null = null;
export function glowTexture() {
  if (glow) return glow;
  const [c, g] = canvas(256, 256);
  const grad = g.createRadialGradient(128, 110, 10, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,240,215,0.28)");
  grad.addColorStop(0.55, "rgba(255,232,200,0.09)");
  grad.addColorStop(1, "rgba(255,220,170,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  glow = toTexture(c);
  return glow;
}

function wrap(g: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

/** Museum wall label: artist, title, date, medium, lender. 3:2 card. */
export function labelTexture(l: { artist: string | null; title: string; date: string | null; medium: string | null; institution: string }) {
  const [c, g] = canvas(600, 400);
  g.fillStyle = "#f6f3ec";
  g.fillRect(0, 0, 600, 400);
  g.fillStyle = "#1f1b16";
  let y = 62;
  g.font = "600 34px Georgia, 'Times New Roman', serif";
  for (const line of wrap(g, l.artist ?? "Unknown artist", 540, 1)) {
    g.fillText(line, 30, y);
    y += 44;
  }
  g.font = "italic 32px Georgia, 'Times New Roman', serif";
  for (const line of wrap(g, l.title, 540, 3)) {
    g.fillText(line, 30, y);
    y += 40;
  }
  g.font = "28px Georgia, 'Times New Roman', serif";
  if (l.date) {
    g.fillText(wrap(g, l.date, 540, 1)[0], 30, y);
    y += 38;
  }
  g.fillStyle = "#5a5148";
  g.font = "24px system-ui, sans-serif";
  if (l.medium) {
    for (const line of wrap(g, l.medium, 540, 2)) {
      g.fillText(line, 30, y);
      y += 32;
    }
  }
  g.fillText(wrap(g, l.institution, 540, 1)[0], 30, Math.max(y + 6, 370));
  return toTexture(c);
}

/** Large wall text for the room introduction or a doorway title. */
export function wallTextTexture(lines: string[], color: string, opts: { width?: number; height?: number; title?: boolean } = {}) {
  const w = opts.width ?? 1024;
  const h = opts.height ?? 512;
  const [c, g] = canvas(w, h);
  g.fillStyle = color;
  let y = opts.title ? h / 2 + 28 : 90;
  lines.forEach((text, i) => {
    g.font = i === 0 ? `500 ${opts.title ? 84 : 64}px Georgia, 'Times New Roman', serif` : "30px system-ui, sans-serif";
    for (const line of wrap(g, text, w - 80, i === 0 ? 2 : 4)) {
      g.fillText(line, 40, y);
      y += i === 0 ? 76 : 44;
    }
    y += 18;
  });
  return toTexture(c);
}
