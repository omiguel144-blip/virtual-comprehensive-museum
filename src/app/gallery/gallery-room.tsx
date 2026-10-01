"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clampToRoom, EYE_LEVEL, fitImage } from "@/lib/gallery-layout";
import { createLimiter } from "@/lib/limiter";
import type { GalleryPainting } from "./types";

const WALK_SPEED = 2.2; // m/s, a slow museum stroll
const LOOK_SPEED = 0.004; // radians per pixel dragged
const CAMERA_HEIGHT = 1.6;
const NEAR_DISTANCE = 3.2; // switch to the large image within this distance
const LABEL_DISTANCE = 2.8;

type Props = { paintings: GalleryPainting[]; length: number; width: number; height: number };

function proxyUrl(id: number, size: "small" | "large") {
  return `/api/gallery-image/${id}?size=${size}`;
}

const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous");

function loadOne(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}

// Museum CDNs may refuse bursts, so only a few requests run at once. Small
// images have their own queue so they never wait behind large ones.
const queues = { small: createLimiter(3), large: createLimiter(2) };

/**
 * Loads through our same-origin route first; if that fails, tries the
 * museum's own URL (works when the museum sends CORS headers).
 */
function loadTexture(painting: GalleryPainting, size: "small" | "large"): Promise<THREE.Texture> {
  return queues[size](() => loadTextureNow(painting, size));
}

async function loadTextureNow(painting: GalleryPainting, size: "small" | "large"): Promise<THREE.Texture> {
  try {
    return await loadOne(proxyUrl(painting.id, size));
  } catch {
    const direct = size === "large" ? painting.imageUrl : painting.thumbnailUrl;
    console.warn(`Gallery image ${painting.id} (${size}) failed via /api/gallery-image; trying the museum URL directly.`);
    return loadOne(direct);
  }
}

function Painting({
  painting,
  onSelect,
  onMismatch,
  onFailed,
}: {
  painting: GalleryPainting;
  onSelect: (id: number) => void;
  onMismatch: (id: number) => void;
  onFailed: (id: number) => void;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);
  const largeRequested = useRef(false);
  const world = useMemo(() => new THREE.Vector3(...painting.position), [painting.position]);

  useEffect(() => {
    let cancelled = false;
    loadTexture(painting, "small")
      .then((t) => (cancelled ? t.dispose() : setTexture(t)))
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onFailed(painting.id);
      });
    return () => {
      cancelled = true;
    };
  }, [painting, onFailed]);

  useEffect(() => () => texture?.dispose(), [texture]);

  // Swap in the larger approved image once the visitor walks up to it.
  useFrame(({ camera }) => {
    if (largeRequested.current || !texture) return;
    if (camera.position.distanceTo(world) < NEAR_DISTANCE) {
      largeRequested.current = true;
      loadTexture(painting, "large")
        .then(setTexture)
        .catch(() => {});
    }
  });

  const image = texture?.image as { width: number; height: number } | undefined;
  const pixels = image
    ? { width: image.width, height: image.height }
    : painting.pixelWidth && painting.pixelHeight
      ? { width: painting.pixelWidth, height: painting.pixelHeight }
      : null;
  const fit = fitImage({ widthM: painting.widthM, heightM: painting.heightM }, pixels);

  useEffect(() => {
    if (fit.mismatch) onMismatch(painting.id);
  }, [fit.mismatch, onMismatch, painting.id]);

  const frame = 0.06;
  return (
    <group position={painting.position} rotation={[0, painting.rotationY, 0]}>
      {/* Simple dark frame just behind the painted surface. */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[fit.widthM + frame * 2, fit.heightM + frame * 2, 0.03]} />
        <meshStandardMaterial color="#2b2118" roughness={0.6} />
      </mesh>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(painting.id);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <planeGeometry args={[fit.widthM, fit.heightM]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshStandardMaterial color={failed ? "#5a4a3a" : "#d9d2c5"} />
        )}
      </mesh>
    </group>
  );
}

function Room({ length, width, height }: Omit<Props, "paintings">) {
  const wall = "#ece6dc";
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, width]} />
        <meshStandardMaterial color="#8a6f55" roughness={0.8} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[length, width]} />
        <meshBasicMaterial color="#e9e4dc" />
      </mesh>
      <mesh position={[0, height / 2, -width / 2]}>
        <planeGeometry args={[length, height]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[0, height / 2, width / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[length, height]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[-length / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[length / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={wall} />
      </mesh>
    </group>
  );
}

type Glide = { x: number; z: number; yaw: number } | null;

/** Keyboard walking, drag-to-look, and gliding to a selected painting. */
function Visitor({
  length,
  width,
  paintings,
  glide,
  onGlideDone,
  onNearest,
}: {
  length: number;
  width: number;
  paintings: GalleryPainting[];
  glide: Glide;
  onGlideDone: () => void;
  onNearest: (id: number | null) => void;
}) {
  const gl = useThree((state) => state.gl);
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: -Math.PI / 2, pitch: 0 });
  const nearest = useRef<number | null>(null);
  const placed = useRef(false);

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      look.current.yaw -= (e.clientX - lastX) * LOOK_SPEED;
      look.current.pitch = Math.max(-1.1, Math.min(1.1, look.current.pitch - (e.clientY - lastY) * LOOK_SPEED));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = () => (dragging = false);
    const keyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, select, textarea")) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        keys.current.add(k);
        e.preventDefault();
      }
    };
    const keyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
    };
  }, [gl]);

  useFrame(({ camera }, delta) => {
    if (!placed.current) {
      // Start at the west end of the room, looking down its length.
      camera.position.set(-length / 2 + 1.5, CAMERA_HEIGHT, 0);
      camera.rotation.order = "YXZ";
      placed.current = true;
    }
    const dt = Math.min(delta, 0.1);
    const k = keys.current;
    const pos = camera.position;

    if (glide) {
      const t = 1 - Math.pow(0.02, dt);
      pos.x += (glide.x - pos.x) * t;
      pos.z += (glide.z - pos.z) * t;
      let dyaw = glide.yaw - look.current.yaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      look.current.yaw += dyaw * t;
      look.current.pitch += (0 - look.current.pitch) * t;
      if (Math.hypot(glide.x - pos.x, glide.z - pos.z) < 0.02 && Math.abs(dyaw) < 0.01) onGlideDone();
      if (k.size) onGlideDone();
    } else {
      const forward = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
      const strafe = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
      const turn = (k.has("arrowleft") ? 1 : 0) - (k.has("arrowright") ? 1 : 0);
      look.current.yaw += turn * 1.6 * dt;
      const { yaw } = look.current;
      const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * WALK_SPEED * dt;
      const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * WALK_SPEED * dt;
      const next = clampToRoom(pos.x + dx, pos.z + dz, { length, width });
      pos.x = next.x;
      pos.z = next.z;
    }
    pos.y = CAMERA_HEIGHT;
    camera.rotation.set(look.current.pitch, look.current.yaw, 0);

    // Report the painting the visitor is standing in front of.
    let best: number | null = null;
    let bestDist = LABEL_DISTANCE;
    for (const p of paintings) {
      const d = Math.hypot(p.position[0] - pos.x, p.position[2] - pos.z);
      if (d < bestDist) {
        bestDist = d;
        best = p.id;
      }
    }
    if (best !== nearest.current) {
      nearest.current = best;
      onNearest(best);
    }
  });

  return null;
}

function formatSize(p: GalleryPainting) {
  return `${p.heightCm} × ${p.widthCm} cm`;
}

export function GalleryRoom({ paintings, length, width, height }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [nearest, setNearest] = useState<number | null>(null);
  const [glide, setGlide] = useState<Glide>(null);
  const [mismatched, setMismatched] = useState<Set<number>>(new Set());
  const [failed, setFailed] = useState<Set<number>>(new Set());

  const byId = useMemo(() => new Map(paintings.map((p) => [p.id, p])), [paintings]);
  const shown = byId.get(selected ?? nearest ?? -1) ?? null;

  const select = useCallback(
    (id: number) => {
      const p = byId.get(id);
      if (!p) return;
      setSelected(id);
      // Stand back far enough to see the whole painting, at least 1.6 m.
      const distance = Math.max(1.6, Math.max(p.widthM, p.heightM) * 1.3);
      const facing = p.rotationY === 0 ? 1 : -1; // north wall faces +z
      const target = clampToRoom(p.position[0], p.position[2] + facing * distance, { length, width });
      setGlide({ x: target.x, z: target.z, yaw: p.rotationY });
    },
    [byId, length, width],
  );

  const onMismatch = useCallback((id: number) => {
    setMismatched((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);
  const onFailed = useCallback((id: number) => {
    setFailed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  return (
    <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden rounded border border-border bg-black">
      <Canvas
        camera={{ fov: 60, near: 0.05, far: 100, position: [0, EYE_LEVEL, 0] }}
        dpr={[1, 2]}
        fallback={
          <p className="p-6 text-center text-sm text-white">
            Your browser can&apos;t show the 3D gallery (WebGL is unavailable). Browse the catalog instead.
          </p>
        }
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={["#1a1714"]} />
        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#fffaf0", "#8a7560", 1.2]} />
        <directionalLight position={[0, height, 2]} intensity={0.5} />
        <Room length={length} width={width} height={height} />
        {paintings.map((p) => (
          <Painting key={p.id} painting={p} onSelect={select} onMismatch={onMismatch} onFailed={onFailed} />
        ))}
        <Visitor
          length={length}
          width={width}
          paintings={paintings}
          glide={glide}
          onGlideDone={() => setGlide(null)}
          onNearest={setNearest}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/55 px-3 py-2 text-xs text-white/90">
        Drag to look · W A S D or arrow keys to walk · Click a painting to approach it
      </div>

      {shown && (
        <aside className="absolute bottom-3 left-3 right-3 max-w-md rounded bg-surface/95 p-4 text-sm text-foreground shadow-lg sm:right-auto">
          <h2 className="font-serif text-lg leading-snug">{shown.title}</h2>
          <p className="text-muted">{[shown.artist ?? "Unknown artist", shown.date].filter(Boolean).join(", ")}</p>
          <p className="mt-2">
            {formatSize(shown)} · {shown.institution}
          </p>
          {failed.has(shown.id) && (
            <p className="mt-1 text-xs text-accent">
              This image couldn&apos;t be loaded from {shown.institution}. Run <code>npm run check:images</code> to see
              why; the dev server log also shows the reason.
            </p>
          )}
          {mismatched.has(shown.id) && (
            <p className="mt-1 text-xs text-accent">
              The photo&apos;s proportions differ from the measured size (it may include a frame or be cropped), so it
              is shown at its own proportions within the measured area rather than stretched.
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            {shown.rightsStatement}
            {shown.attributionText ? ` Image: ${shown.attributionText}.` : ""}
          </p>
          <p className="mt-2 flex gap-4 text-xs">
            <Link href={`/artworks/${shown.id}`} className="text-accent underline">
              Details
            </Link>
            <a href={shown.sourceRecordUrl} target="_blank" rel="noreferrer" className="text-accent underline">
              Original record
            </a>
          </p>
        </aside>
      )}
    </div>
  );
}
