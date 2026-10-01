"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { clampToRoom, DOOR_HEIGHT, DOOR_WIDTH, fitImage, hitsObstacle } from "@/lib/gallery-layout";
import { createLimiter } from "@/lib/limiter";
import type { RoomPalette } from "./palette";
import { glowTexture, labelTexture, wallTextTexture, woodFloorTexture } from "./textures";
import type { DoorLink, GalleryWork, RoomScene } from "./types";

const NEAR_DISTANCE = 3.2; // switch to the large image within this distance
export const CAMERA_HEIGHT = 1.6;

// ---------------------------------------------------------------------------
// Image loading (rights-gated route first, museum URL as fallback)

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

function loadTexture(work: GalleryWork, size: "small" | "large"): Promise<THREE.Texture> {
  return queues[size](async () => {
    try {
      return await loadOne(`/api/gallery-image/${work.id}?size=${size}`);
    } catch {
      console.warn(`Gallery image ${work.id} (${size}) failed via /api/gallery-image; trying the museum URL directly.`);
      return loadOne(size === "large" ? work.imageUrl : work.thumbnailUrl);
    }
  });
}

function useWorkTexture(work: GalleryWork, onFailed: (id: number) => void) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);
  const largeRequested = useRef(false);
  const world = useMemo(() => new THREE.Vector3(...work.position), [work.position]);

  useEffect(() => {
    let cancelled = false;
    loadTexture(work, "small")
      .then((t) => (cancelled ? t.dispose() : setTexture(t)))
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        onFailed(work.id);
      });
    return () => {
      cancelled = true;
    };
  }, [work, onFailed]);

  useEffect(() => () => texture?.dispose(), [texture]);

  // Swap in the larger approved image once the visitor walks up to it.
  useFrame(({ camera }) => {
    if (largeRequested.current || !texture) return;
    if (camera.position.distanceTo(world) < NEAR_DISTANCE) {
      largeRequested.current = true;
      loadTexture(work, "large").then(setTexture).catch(() => {});
    }
  });

  const image = texture?.image as { width: number; height: number } | undefined;
  const pixels = image
    ? { width: image.width, height: image.height }
    : work.pixelWidth && work.pixelHeight
      ? { width: work.pixelWidth, height: work.pixelHeight }
      : null;
  return { texture, failed, fit: fitImage({ widthM: work.widthM, heightM: work.heightM }, pixels) };
}

// ---------------------------------------------------------------------------
// Works

type WorkProps = {
  work: GalleryWork;
  onSelect: (id: number) => void;
  onMismatch: (id: number) => void;
  onFailed: (id: number) => void;
};

function ImageSurface({ w, h, texture, failed, work, onSelect }: { w: number; h: number; texture: THREE.Texture | null; failed: boolean; work: GalleryWork; onSelect: (id: number) => void }) {
  return (
    <mesh
      onClick={(e) => {
        e.stopPropagation();
        onSelect(work.id);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <planeGeometry args={[w, h]} />
      {texture ? (
        <meshBasicMaterial map={texture} toneMapped={false} />
      ) : (
        <meshStandardMaterial color={failed ? "#4a3f35" : "#d9d2c5"} />
      )}
    </mesh>
  );
}

const GILT = { color: "#c49a48", metalness: 0.35, roughness: 0.38, emissive: "#3a2a0c", emissiveIntensity: 0.25 };

/** Four bars around the picture, so the frame never covers the image. */
function FrameBars({ w, h, f, depth, z, children }: { w: number; h: number; f: number; depth: number; z: number; children: ReactNode }) {
  const bars: Array<[number, number, number, number]> = [
    [0, h / 2 + f / 2, w + 2 * f, f],
    [0, -h / 2 - f / 2, w + 2 * f, f],
    [-w / 2 - f / 2, 0, f, h],
    [w / 2 + f / 2, 0, f, h],
  ];
  return (
    <group>
      {bars.map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[bw, bh, depth]} />
          {children}
        </mesh>
      ))}
    </group>
  );
}

function Frame({ style, w, h }: { style: GalleryWork["frame"]; w: number; h: number }) {
  if (style === "none") return null;
  if (style === "scroll") {
    // Silk mounting with brocade bands, a top stave and a bottom roller.
    const mountW = w + 0.12;
    const top = 0.32;
    const bottom = 0.22;
    return (
      <group>
        <mesh position={[0, (top - bottom) / 2, -0.012]}>
          <planeGeometry args={[mountW, h + top + bottom]} />
          <meshStandardMaterial color="#d9ccb0" roughness={0.9} />
        </mesh>
        <mesh position={[0, h / 2 + top * 0.55, -0.01]}>
          <planeGeometry args={[mountW, top * 0.5]} />
          <meshStandardMaterial color="#7d6a45" roughness={0.8} />
        </mesh>
        <mesh position={[0, -h / 2 - bottom * 0.45, -0.01]}>
          <planeGeometry args={[mountW, bottom * 0.4]} />
          <meshStandardMaterial color="#7d6a45" roughness={0.8} />
        </mesh>
        <mesh position={[0, h / 2 + top, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, mountW + 0.02, 12]} />
          <meshStandardMaterial color="#3a2a1a" />
        </mesh>
        <mesh position={[0, -h / 2 - bottom, 0.005]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.022, mountW + 0.1, 16]} />
          <meshStandardMaterial color="#2a1d12" roughness={0.5} />
        </mesh>
      </group>
    );
  }
  const f = style === "gilt" ? 0.05 + 0.04 * Math.sqrt(w * h) : style === "walnut" ? 0.05 : 0.025;
  const material =
    style === "gilt" ? <meshStandardMaterial {...GILT} /> : <meshStandardMaterial color={style === "walnut" ? "#5a3a24" : "#1b1a19"} roughness={0.6} />;
  // Gilt frames get a narrow darker sight edge next to the picture, then the main moulding.
  const liner = style === "gilt" ? Math.min(0.025, f * 0.3) : 0;
  return (
    <group>
      {liner > 0 && (
        <FrameBars w={w} h={h} f={liner} depth={0.03} z={0.003}>
          <meshStandardMaterial color="#7a5d26" metalness={0.3} roughness={0.5} />
        </FrameBars>
      )}
      <FrameBars w={w + 2 * liner} h={h + 2 * liner} f={f} depth={0.06} z={0.012}>
        {material}
      </FrameBars>
    </group>
  );
}

function WallWork({ work, onSelect, onMismatch, onFailed }: WorkProps) {
  const { texture, failed, fit } = useWorkTexture(work, onFailed);
  useEffect(() => {
    if (fit.mismatch) onMismatch(work.id);
  }, [fit.mismatch, onMismatch, work.id]);
  const label = useMemo(() => labelTexture({ artist: work.artist, title: work.title, date: work.date, medium: work.medium, institution: work.institution }), [work]);
  useEffect(() => () => label.dispose(), [label]);

  const frameOut = work.frame === "gilt" ? 0.075 + 0.04 * Math.sqrt(fit.widthM * fit.heightM) : 0.05;
  const labelX = fit.widthM / 2 + frameOut + 0.2;
  const labelY = Math.min(1.3, work.position[1]) - work.position[1];
  return (
    <group position={work.position} rotation={[0, work.rotationY, 0]}>
      {/* Warm pool of light washing the wall behind the work. */}
      <mesh position={[0, fit.heightM * 0.08, -0.008]}>
        <planeGeometry args={[fit.widthM * 1.6 + 0.5, fit.heightM * 1.5 + 0.5]} />
        <meshBasicMaterial map={glowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {work.frame === "none" && (
        // Textiles hang from a rod.
        <mesh position={[0, fit.heightM / 2 + 0.03, 0.01]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, fit.widthM + 0.16, 12]} />
          <meshStandardMaterial color="#5b4630" metalness={0.3} roughness={0.5} />
        </mesh>
      )}
      <Frame style={work.frame} w={fit.widthM} h={fit.heightM} />
      <ImageSurface w={fit.widthM} h={fit.heightM} texture={texture} failed={failed} work={work} onSelect={onSelect} />
      {(work.frame === "gilt" || work.frame === "walnut") && fit.widthM > 0.4 && (
        // Brass picture light above the frame.
        <mesh position={[0, fit.heightM / 2 + frameOut + 0.08, 0.1]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, Math.min(0.9, fit.widthM * 0.45), 12]} />
          <meshStandardMaterial color="#b08d4a" metalness={0.8} roughness={0.3} />
        </mesh>
      )}
      <mesh position={[labelX, labelY, 0.004]} onClick={(e) => (e.stopPropagation(), onSelect(work.id))}>
        <planeGeometry args={[0.21, 0.14]} />
        <meshBasicMaterial map={label} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CaseWork({ work, onSelect, onMismatch, onFailed }: WorkProps) {
  const { texture, failed, fit } = useWorkTexture(work, onFailed);
  useEffect(() => {
    if (fit.mismatch) onMismatch(work.id);
  }, [fit.mismatch, onMismatch, work.id]);
  const scroll = work.kind === "scroll_case";
  const caseW = scroll ? fit.widthM + 0.4 : Math.max(0.9, fit.widthM + 0.35);
  const caseD = Math.max(scroll ? 0.6 : 0.8, fit.heightM + 0.3);
  const plinthH = scroll ? 0.85 : 0.95;
  const tilt = scroll ? 0.12 : 0.26;
  return (
    <group position={[work.position[0], 0, work.position[2]]} rotation={[0, work.rotationY, 0]}>
      <mesh position={[0, plinthH / 2, 0]}>
        <boxGeometry args={[caseW, plinthH, caseD]} />
        <meshStandardMaterial color="#8c8174" roughness={0.85} />
      </mesh>
      {/* Linen-covered deck */}
      <mesh position={[0, plinthH + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[caseW - 0.06, caseD - 0.06]} />
        <meshStandardMaterial color="#d8d0c0" roughness={1} />
      </mesh>
      <group position={[0, plinthH + 0.06, 0]} rotation={[-Math.PI / 2 + tilt, 0, 0]}>
        <ImageSurface w={fit.widthM} h={fit.heightM} texture={texture} failed={failed} work={work} onSelect={onSelect} />
      </group>
      {/* Glass vitrine */}
      <mesh position={[0, plinthH + 0.2, 0]}>
        <boxGeometry args={[caseW, 0.4, caseD]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.08} roughness={0} metalness={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Work(props: WorkProps) {
  return props.work.kind === "wall" ? <WallWork {...props} /> : <CaseWork {...props} />;
}

// ---------------------------------------------------------------------------
// Architecture

export function RoomShell({ scene }: { scene: RoomScene }) {
  const { length, width, height, palette } = scene;
  const floor = useMemo(() => {
    const t = woodFloorTexture(palette.floor);
    t.repeat.set(length / 2.2, width / 2.2);
    return t;
  }, [palette.floor, length, width]);
  const intro = useMemo(() => wallTextTexture(scene.intro, isLight(palette.wall) ? "#2a2520" : "#f1ebe1"), [scene.intro, palette.wall]);
  useEffect(() => () => (floor.dispose(), intro.dispose()), [floor, intro]);

  const walls: Array<{ pos: [number, number, number]; rot: number; w: number }> = [
    { pos: [0, height / 2, -width / 2], rot: 0, w: length },
    { pos: [0, height / 2, width / 2], rot: Math.PI, w: length },
    { pos: [-length / 2, height / 2, 0], rot: Math.PI / 2, w: width },
    { pos: [length / 2, height / 2, 0], rot: -Math.PI / 2, w: width },
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, width]} />
        <meshStandardMaterial map={floor} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[length, width]} />
        <meshBasicMaterial color={palette.ceiling} />
      </mesh>
      {walls.map((w, i) => (
        <group key={i} position={w.pos} rotation={[0, w.rot, 0]}>
          <mesh>
            <planeGeometry args={[w.w, height]} />
            <meshStandardMaterial color={palette.wall} roughness={0.95} />
          </mesh>
          {/* Baseboard and cornice */}
          <mesh position={[0, -height / 2 + 0.09, 0.012]}>
            <boxGeometry args={[w.w, 0.18, 0.025]} />
            <meshStandardMaterial color={palette.trim} roughness={0.6} />
          </mesh>
          <mesh position={[0, height / 2 - 0.12, 0.03]}>
            <boxGeometry args={[w.w, 0.24, 0.06]} />
            <meshStandardMaterial color={palette.ceiling} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Introductory wall text beside the entrance */}
      <mesh position={[-length / 2 + 0.02, 1.85, -width / 4 - 0.3]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.4, 1.2]} />
        <meshBasicMaterial map={intro} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150;
}

export function DoorMesh({ door, palette, onEnter }: { door: DoorLink; palette: RoomPalette; onEnter: (door: DoorLink) => void }) {
  const title = useMemo(() => wallTextTexture([door.label], isLight(palette.wall) ? "#2a2520" : "#f1ebe1", { width: 1024, height: 160, title: true }), [door.label, palette.wall]);
  useEffect(() => () => title.dispose(), [title]);
  return (
    <group position={door.position} rotation={[0, door.rotationY, 0]}>
      <mesh
        position={[0, 0, 0.01]}
        onClick={(e) => (e.stopPropagation(), onEnter(door))}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
        <meshBasicMaterial color="#14110e" />
      </mesh>
      {/* Architrave */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (DOOR_WIDTH + 0.12)) / 2, 0, 0.02]}>
          <boxGeometry args={[0.12, DOOR_HEIGHT, 0.05]} />
          <meshStandardMaterial color={palette.trim} />
        </mesh>
      ))}
      <mesh position={[0, DOOR_HEIGHT / 2 + 0.06, 0.02]}>
        <boxGeometry args={[DOOR_WIDTH + 0.24, 0.12, 0.05]} />
        <meshStandardMaterial color={palette.trim} />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT / 2 + 0.36, 0.02]}>
        <planeGeometry args={[2.6, 0.41]} />
        <meshBasicMaterial map={title} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Bench({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[2, 0.08, 0.6]} />
        <meshStandardMaterial color="#2b2118" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <boxGeometry args={[1.94, 0.04, 0.54]} />
        <meshStandardMaterial color="#5b2f24" roughness={0.9} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]}>
          <boxGeometry args={[0.08, 0.4, 0.5]} />
          <meshStandardMaterial color="#2b2118" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Visitor: keyboard walking, drag-to-look, gliding, and walking through doors

export type Glide = { x: number; z: number; yaw: number } | null;

const WALK_SPEED = 2.2; // m/s, a slow museum stroll
const LOOK_SPEED = 0.004; // radians per pixel dragged

export function Visitor({
  scene,
  glide,
  onGlideDone,
  onNearest,
  onDoor,
}: {
  scene: RoomScene;
  glide: Glide;
  onGlideDone: () => void;
  onNearest: (id: number | null) => void;
  onDoor: (door: DoorLink) => void;
}) {
  const gl = useThree((state) => state.gl);
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: -Math.PI / 2, pitch: 0 });
  const nearest = useRef<number | null>(null);
  const placed = useRef(false);
  const leaving = useRef(false);

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
      // Start just inside the entrance, looking down the room toward the anchor.
      camera.position.set(-scene.length / 2 + 1.6, CAMERA_HEIGHT, 0);
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
      if ((Math.hypot(glide.x - pos.x, glide.z - pos.z) < 0.02 && Math.abs(dyaw) < 0.01) || k.size) onGlideDone();
    } else {
      const forward = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
      const strafe = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
      const turn = (k.has("arrowleft") ? 1 : 0) - (k.has("arrowright") ? 1 : 0);
      look.current.yaw += turn * 1.6 * dt;
      const { yaw } = look.current;
      const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * WALK_SPEED * dt;
      const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * WALK_SPEED * dt;
      const next = clampToRoom(pos.x + dx, pos.z + dz, scene, 0.5);
      if (!hitsObstacle(next.x, next.z, scene.obstacles)) {
        pos.x = next.x;
        pos.z = next.z;
      } else if (!hitsObstacle(next.x, pos.z, scene.obstacles)) {
        pos.x = next.x; // slide along the obstacle
      } else if (!hitsObstacle(pos.x, next.z, scene.obstacles)) {
        pos.z = next.z;
      }

      // Walking into a doorway goes through it.
      if (!leaving.current && forward > 0) {
        for (const door of scene.doors) {
          const atWall = Math.abs(Math.abs(pos.x) - (scene.length / 2 - 0.5)) < 0.05 && Math.sign(pos.x) === Math.sign(door.position[0]);
          if (atWall && Math.abs(pos.z - door.position[2]) < DOOR_WIDTH / 2) {
            leaving.current = true;
            onDoor(door);
          }
        }
      }
    }
    pos.y = CAMERA_HEIGHT;
    camera.rotation.set(look.current.pitch, look.current.yaw, 0);

    // Report the work the visitor is standing in front of.
    let best: number | null = null;
    let bestDist = 2.8;
    for (const w of scene.works) {
      const d = Math.hypot(w.position[0] - pos.x, w.position[2] - pos.z);
      if (d < bestDist) {
        bestDist = d;
        best = w.id;
      }
    }
    if (best !== nearest.current) {
      nearest.current = best;
      onNearest(best);
    }
  });

  return null;
}
