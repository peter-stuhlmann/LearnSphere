"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import styled from "styled-components";

const VIOLET = "#8B7CFF";
const LIME = "#C8FF4D";
const DIM = "#3A3D55";

const Wrap = styled.div`
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background:
    radial-gradient(
      ellipse 90% 130% at 50% -20%,
      rgba(139, 124, 255, 0.12),
      transparent
    ),
    ${({ theme }) => theme.colors.bgDeep};
  overflow: hidden;
  height: 230px;
  margin-bottom: 1.5rem;

  canvas {
    touch-action: pan-y;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    height: 260px;
  }
`;

const Caption = styled.p`
  position: absolute;
  top: 0.9rem;
  left: 1.25rem;
  z-index: 1;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const HoverInfo = styled.p`
  position: absolute;
  bottom: 0.85rem;
  left: 1.25rem;
  right: 1.25rem;
  z-index: 1;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  strong {
    color: ${({ theme }) => theme.colors.accent};
    font-family: ${({ theme }) => theme.fonts.mono};
  }
`;

export interface JourneySection {
  id: string;
  title: string;
  /** Sehanteil des Abschnitts (0..100) */
  percent: number;
  completed: boolean;
  locked: boolean;
}

/** Punkte der Reise: leichte Wellen in y/z entlang der x-Achse. */
function journeyPoints(count: number): THREE.Vector3[] {
  const spread = Math.max(1, count - 1);
  return Array.from({ length: count }, (_, i) => {
    return new THREE.Vector3(
      (i - spread / 2) * (7.5 / spread) * (count > 1 ? 1 : 0),
      Math.sin(i * 1.15) * 0.55,
      Math.cos(i * 0.85) * 1.1
    );
  });
}

function Scene({
  sections,
  hovered,
  onHover,
  onSelect,
  reducedMotion,
}: {
  sections: JourneySection[];
  hovered: number | null;
  onHover: (index: number | null) => void;
  onSelect: (index: number) => void;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const pulse = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const targetRotation = useRef(0);

  const points = useMemo(() => journeyPoints(sections.length), [sections]);
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points),
    [points]
  );

  // Fortschritt entlang der Reise: Mittel der Abschnitts-Anteile
  const progressT = useMemo(() => {
    if (sections.length === 0) return 0;
    const sum = sections.reduce(
      (acc, section) => acc + Math.min(100, section.percent) / 100,
      0
    );
    return Math.min(1, sum / sections.length);
  }, [sections]);

  const progressCurve = useMemo(() => {
    if (progressT <= 0.01 || points.length < 2) return null;
    const sampled = curve.getPoints(120);
    const cut = Math.max(2, Math.floor(sampled.length * progressT));
    return new THREE.CatmullRomCurve3(sampled.slice(0, cut));
  }, [curve, points.length, progressT]);

  // Sternenstaub im Hintergrund (statisch, dekorativ)
  const stars = useMemo(() => {
    const positions = new Float32Array(70 * 3);
    let seed = 42;
    const random = () => {
      // deterministisch (kein Re-Layout bei Re-Render)
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 70; i += 1) {
      positions[i * 3] = (random() - 0.5) * 12;
      positions[i * 3 + 1] = (random() - 0.5) * 5;
      positions[i * 3 + 2] = -2 - random() * 4;
    }
    return positions;
  }, []);

  useFrame((state, delta) => {
    pulse.current += delta;
    if (!group.current) return;
    if (!dragging.current && !reducedMotion) {
      // sanftes Schweben statt Rotation – der Pfad bleibt lesbar
      group.current.position.y = Math.sin(pulse.current * 0.6) * 0.08;
    }
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      targetRotation.current,
      0.08
    );
  });

  return (
    <group
      ref={group}
      onPointerDown={(e) => {
        dragging.current = true;
        lastX.current = e.clientX;
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerMove={(e) => {
        if (dragging.current) {
          targetRotation.current = THREE.MathUtils.clamp(
            targetRotation.current + (e.clientX - lastX.current) * 0.004,
            -0.6,
            0.6
          );
          lastX.current = e.clientX;
        }
      }}
    >
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[stars, 3]}
          />
        </bufferGeometry>
        <pointsMaterial color={VIOLET} size={0.035} transparent opacity={0.6} />
      </points>

      {points.length > 1 ? (
        <mesh>
          <tubeGeometry args={[curve, 80, 0.025, 8, false]} />
          <meshStandardMaterial
            color={DIM}
            emissive={DIM}
            emissiveIntensity={0.25}
            transparent
            opacity={0.8}
          />
        </mesh>
      ) : null}

      {progressCurve ? (
        <mesh>
          <tubeGeometry args={[progressCurve, 80, 0.035, 8, false]} />
          <meshStandardMaterial
            color={LIME}
            emissive={LIME}
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      ) : null}

      {sections.map((section, i) => (
        <JourneyNode
          key={section.id}
          section={section}
          position={points[i]}
          active={hovered === i}
          isNext={
            !section.completed &&
            !section.locked &&
            sections.slice(0, i).every((s) => s.completed || s.locked)
          }
          reducedMotion={reducedMotion}
          onHover={(over) => onHover(over ? i : null)}
          onSelect={() => onSelect(i)}
        />
      ))}
    </group>
  );
}

function JourneyNode({
  section,
  position,
  active,
  isNext,
  reducedMotion,
  onHover,
  onSelect,
}: {
  section: JourneySection;
  position: THREE.Vector3;
  active: boolean;
  isNext: boolean;
  reducedMotion: boolean;
  onHover: (over: boolean) => void;
  onSelect: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    time.current += delta;
    // die nächste offene Station pulsiert sanft
    const base = active ? 1.35 : 1;
    const wobble =
      isNext && !reducedMotion ? 1 + Math.sin(time.current * 2.4) * 0.12 : 1;
    mesh.current.scale.setScalar(base * wobble);
  });

  const color = section.completed ? LIME : section.locked ? DIM : VIOLET;

  return (
    <group position={position}>
      <mesh
        ref={mesh}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
          document.body.style.cursor = section.locked ? "default" : "pointer";
        }}
        onPointerOut={() => {
          onHover(false);
          document.body.style.cursor = "default";
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!section.locked) onSelect();
        }}
      >
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={section.completed ? 0.9 : active ? 0.7 : 0.35}
          toneMapped={false}
        />
      </mesh>
      {/* Ring um die aktuelle Station */}
      {isNext ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.012, 12, 40]} />
          <meshStandardMaterial
            color={LIME}
            emissive={LIME}
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * Lernpfad als 3D-Journey: eine leuchtende Reise durch den Kurs – je
 * Abschnitt eine Station, der Pfad füllt sich mit dem Fortschritt. Klick
 * auf eine Station springt zum Abschnitt. Rein ergänzend-dekorativ; die
 * barrierefreie Navigation ist das Inhaltsverzeichnis daneben (aria-hidden).
 */
export function JourneyPath3D({
  title,
  hint,
  sections,
  onSelectSection,
}: {
  title: string;
  hint: string;
  sections: JourneySection[];
  onSelectSection: (sectionId: string) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  if (sections.length === 0) return null;
  const current = hovered !== null ? sections[hovered] : null;

  return (
    <Wrap aria-hidden>
      <Caption>✦ {title}</Caption>
      <Canvas
        camera={{ position: [0, 1.6, 5.6], fov: 46 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 6, 5]} intensity={1.1} />
        <pointLight position={[-5, 3, -3]} intensity={0.5} color={VIOLET} />
        <Scene
          sections={sections}
          hovered={hovered}
          onHover={setHovered}
          onSelect={(index) => onSelectSection(sections[index].id)}
          reducedMotion={reducedMotion}
        />
      </Canvas>
      <HoverInfo>
        {current ? (
          <span>
            {current.title} ·{" "}
            <strong>{Math.round(current.percent)} %</strong>
            {current.locked ? " · 🔒" : ""}
          </span>
        ) : (
          <span>{hint}</span>
        )}
      </HoverInfo>
    </Wrap>
  );
}
