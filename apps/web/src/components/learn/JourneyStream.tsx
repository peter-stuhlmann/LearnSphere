"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Der Weg als Strom aus Lichtpartikeln statt als Röhre.
 *
 * Eine Röhre mit halbdurchsichtigem Material sieht ohne echtes Bloom immer
 * nach Schlauch aus – die Zylinderkanten bleiben sichtbar. Punkte mit weicher
 * Textur und additiver Mischung ergeben dagegen wirkliches Leuchten: Wo viele
 * Partikel dicht beieinander liegen, entsteht ein heller Kern, an den Rändern
 * fällt es weich ab.
 *
 * Die Partikel wandern der Route entlang. Auf dem bereits gelernten Teil
 * fließen sie dicht, hell und zügig; davor bleiben vereinzelte, matte
 * Funken – die Strecke ist erkennbar, wirkt aber noch "unbelebt".
 */

const SAMPLES = 420;

export function JourneyStream({
  curve,
  progress,
  count,
  texture,
  doneColor,
  openColor,
  reducedMotion,
  intro,
}: {
  curve: THREE.CatmullRomCurve3;
  /** Anteil der Route, der geschafft ist (0..1) */
  progress: number;
  count: number;
  texture: THREE.Texture;
  doneColor: THREE.Color;
  openColor: THREE.Color;
  reducedMotion: boolean;
  intro: React.RefObject<number>;
}) {
  const points = useRef<THREE.Points>(null);

  /* Die Kurve einmalig in gleichmäßige Stützpunkte zerlegen – pro Bild
     hunderte Male getPointAt aufzurufen wäre unnötig teuer. */
  const samples = useMemo(() => curve.getSpacedPoints(SAMPLES), [curve]);

  /* Anfangsdaten. Fortgeschrieben wird pro Bild ausschließlich über die
     Attribute der Geometrie – diese Arrays bleiben unangetastet, damit der
     Compiler keine Mutation von gemerkten Werten sieht. */
  const { initialPositions, initialColors, seeds } = useMemo(() => {
    const initialPositions = new Float32Array(count * 3);
    const initialColors = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 2);
    let seed = 1337;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i += 1) {
      seeds[i * 2] = random(); // Startposition auf der Route
      seeds[i * 2 + 1] = 0.55 + random() * 0.9; // eigenes Tempo
    }
    return { initialPositions, initialColors, seeds };
  }, [count]);

  useFrame((state) => {
    const mesh = points.current;
    if (!mesh) return;

    const introT = intro.current ?? 1;
    const time = reducedMotion ? 0.35 : state.clock.elapsedTime;
    const position = mesh.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const color = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    const positionArray = position.array as Float32Array;

    for (let i = 0; i < count; i += 1) {
      const start = seeds[i * 2];
      const speed = seeds[i * 2 + 1];
      // wandert von hinten nach vorn und beginnt dann wieder
      const t = (start + time * 0.045 * speed) % 1;

      // Beim Erscheinen läuft die Route von links auf
      const revealed = t <= introT;
      const sample = samples[Math.min(SAMPLES, Math.floor(t * SAMPLES))];

      positionArray[i * 3] = sample.x;
      positionArray[i * 3 + 1] = sample.y;
      positionArray[i * 3 + 2] = sample.z;

      const done = t <= progress;
      const base = done ? doneColor : openColor;
      // erledigt: heller Kern mit leichtem Flackern; offen: matte Funken
      const flicker = done
        ? 0.75 + Math.sin(time * 3 + start * 40) * 0.25
        : 0.2 + Math.sin(time * 1.4 + start * 22) * 0.06;
      const strength = (revealed ? 1 : 0) * flicker;

      color.setXYZ(i, base.r * strength, base.g * strength, base.b * strength);
    }

    position.needsUpdate = true;
    color.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[initialPositions, 3]}
        />
        <bufferAttribute attach="attributes-color" args={[initialColors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.16}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Haarfeine Grundlinie der Route. Eine echte Linie (statt eines Volumens)
 * kann per Definition nicht wie ein Schlauch aussehen – sie liefert nur die
 * Führung, das Leuchten kommt von den Partikeln darüber.
 */
export function JourneyLine({
  curve,
  color,
  opacity,
}: {
  curve: THREE.CatmullRomCurve3;
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => {
    const points = curve.getSpacedPoints(220);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [curve]);

  return (
    <primitive
      object={
        new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity,
            depthWrite: false,
          })
        )
      }
    />
  );
}
