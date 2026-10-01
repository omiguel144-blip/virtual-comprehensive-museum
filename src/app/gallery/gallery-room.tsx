"use client";

import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { clampToRoom } from "@/lib/gallery-layout";
import { Bench, CAMERA_HEIGHT, DoorMesh, RoomShell, Visitor, Work, type Glide } from "./scene";
import type { DoorLink, RoomScene } from "./types";

export function GalleryRoom({ scene }: { scene: RoomScene }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [nearest, setNearest] = useState<number | null>(null);
  const [glide, setGlide] = useState<Glide>(null);
  const [mismatched, setMismatched] = useState<Set<number>>(new Set());
  const [failed, setFailed] = useState<Set<number>>(new Set());

  const byId = useMemo(() => new Map(scene.works.map((w) => [w.id, w])), [scene.works]);
  const shown = byId.get(selected ?? nearest ?? -1) ?? null;

  const select = useCallback(
    (id: number) => {
      const w = byId.get(id);
      if (!w) return;
      setSelected(id);
      // Stand in front of the work: back far enough to see it whole, closer for cases.
      const distance = w.kind === "wall" ? Math.max(1.6, Math.max(w.widthM, w.heightM) * 1.3) : 1.2;
      const nx = Math.sin(w.rotationY);
      const nz = Math.cos(w.rotationY);
      const target = clampToRoom(w.position[0] + nx * distance, w.position[2] + nz * distance, scene, 0.5);
      setGlide({ x: target.x, z: target.z, yaw: w.rotationY });
    },
    [byId, scene],
  );

  const onMismatch = useCallback((id: number) => setMismatched((p) => (p.has(id) ? p : new Set(p).add(id))), []);
  const onFailed = useCallback((id: number) => setFailed((p) => (p.has(id) ? p : new Set(p).add(id))), []);
  const onDoor = useCallback((door: DoorLink) => router.push(door.href), [router]);

  return (
    <div className="relative h-[72vh] min-h-[440px] w-full overflow-hidden rounded border border-border bg-black">
      <Canvas
        camera={{ fov: 60, near: 0.05, far: 200, position: [0, CAMERA_HEIGHT, 0] }}
        dpr={[1, 2]}
        fallback={
          <p className="p-6 text-center text-sm text-white">
            Your browser can&apos;t show the 3D gallery (WebGL is unavailable). Browse the catalog instead.
          </p>
        }
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={["#14110e"]} />
        {/* Soft gallery light: walls stay a little darker so the works glow. */}
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#fff6e8", "#5a4a3a", 0.75]} />
        <directionalLight position={[2, scene.height, 3]} intensity={0.35} />
        <RoomShell scene={scene} />
        {scene.works.map((w) => (
          <Work key={w.id} work={w} onSelect={select} onMismatch={onMismatch} onFailed={onFailed} />
        ))}
        {scene.doors.map((d) => (
          <DoorMesh key={d.side} door={d} palette={scene.palette} onEnter={onDoor} />
        ))}
        {scene.bench && <Bench position={scene.bench} />}
        <Visitor scene={scene} glide={glide} onGlideDone={() => setGlide(null)} onNearest={setNearest} onDoor={onDoor} />
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] space-y-1">
        <p className="inline-block rounded bg-black/60 px-3 py-1.5 font-serif text-base text-white">{scene.title}</p>
        <p className="block w-fit rounded bg-black/50 px-3 py-1 text-xs text-white/85">
          Drag to look · W A S D or arrows to walk · Click a work or a doorway
        </p>
      </div>

      {shown && (
        <aside className="absolute bottom-3 left-3 right-3 max-w-md rounded bg-surface/95 p-4 text-sm text-foreground shadow-lg sm:right-auto">
          <h2 className="font-serif text-lg leading-snug">{shown.title}</h2>
          <p className="text-muted">{[shown.artist ?? "Unknown artist", shown.date].filter(Boolean).join(", ")}</p>
          <p className="mt-2">
            {shown.heightCm} × {shown.widthCm} cm · {shown.institution}
          </p>
          {failed.has(shown.id) && (
            <p className="mt-1 text-xs text-accent">
              This image couldn&apos;t be loaded from {shown.institution}. Run <code>npm run check:images</code> to see why.
            </p>
          )}
          {mismatched.has(shown.id) && (
            <p className="mt-1 text-xs text-accent">
              The photo&apos;s proportions differ from the measured size (it may include a frame or be cropped), so it is
              shown at its own proportions within the measured area rather than stretched.
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
