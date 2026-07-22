"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import styled, { keyframes } from "styled-components";
import { JourneyLine, JourneyStream } from "./JourneyStream";

const VIOLET = "#8B7CFF";
const LIME = "#C8FF4D";
const DIM = "#39405e";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
`;

const Wrap = styled.div`
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background:
    radial-gradient(
      ellipse 70% 120% at 20% 110%,
      rgba(200, 255, 77, 0.09),
      transparent 60%
    ),
    radial-gradient(
      ellipse 80% 130% at 85% -20%,
      rgba(139, 124, 255, 0.16),
      transparent 65%
    ),
    ${({ theme }) => theme.colors.bgDeep};
  overflow: hidden;
  height: 300px;
  margin-bottom: 1.5rem;
  animation: ${fadeIn} 600ms cubic-bezier(0.22, 1, 0.36, 1) both;

  canvas {
    touch-action: pan-y;
  }

  /* dezente Vignette, damit die Ränder nicht hart abschneiden */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      ellipse 90% 90% at 50% 50%,
      transparent 55%,
      rgba(7, 8, 15, 0.55)
    );
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    height: 360px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Caption = styled.p`
  position: absolute;
  top: 1rem;
  left: 1.35rem;
  z-index: 1;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const Progress = styled.p`
  position: absolute;
  top: 0.9rem;
  right: 1.35rem;
  z-index: 1;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.95rem;
  color: ${({ theme }) => theme.colors.accent};

  small {
    display: block;
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const HoverInfo = styled.p<{ $visible: boolean }>`
  position: absolute;
  bottom: 1rem;
  left: 1.35rem;
  right: 1.35rem;
  z-index: 1;
  font-size: 0.88rem;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: ${({ $visible }) => ($visible ? 1 : 0.75)};
  transform: translateY(${({ $visible }) => ($visible ? "0" : "2px")});
  transition: opacity 220ms ease, transform 220ms ease;

  strong {
    color: ${({ theme }) => theme.colors.text};
  }

  em {
    font-style: normal;
    color: ${({ theme }) => theme.colors.accent};
    font-family: ${({ theme }) => theme.fonts.mono};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
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

/* ------------------------------------------------------------------ *
 * Hilfsmittel
 * ------------------------------------------------------------------ */

/** Weicher radialer Verlauf als Textur – Grundlage jedes Leuchtpunkts. */
function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.75)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.22)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Fester Streckenverlauf, unabhängig von der Zahl der Abschnitte.
 *
 * Würde man die Kurve aus den Stationen selbst bilden, ergäbe ein Kurs mit
 * zwei Abschnitten eine schnurgerade Linie – die Route soll aber immer wie
 * eine Reise aussehen. Deshalb steht die Strecke fest, und die Stationen
 * werden gleichmäßig darauf verteilt.
 */
const ROUTE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-4.35, -0.45, 0.8),
  new THREE.Vector3(-2.55, 0.75, -0.75),
  new THREE.Vector3(-0.75, -0.3, 1.15),
  new THREE.Vector3(1.15, 0.95, -0.45),
  new THREE.Vector3(2.9, -0.2, 0.95),
  new THREE.Vector3(4.35, 0.55, -0.7),
]);

/** Gleichmäßig auf der Strecke verteilte Haltepunkte. */
function journeyPoints(count: number): THREE.Vector3[] {
  if (count === 1) return [ROUTE.getPointAt(0.5)];
  return Array.from({ length: count }, (_, i) =>
    ROUTE.getPointAt(i / (count - 1))
  );
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Ein Lichtpunkt zieht unablässig die Route entlang – der eigentliche
 * "Reisende". Er sorgt dafür, dass die Szene auch bei 0 % Fortschritt
 * lebt, wo es noch keinen leuchtenden Wegabschnitt gibt.
 */
function Traveller({
  curve,
  glowTexture,
  reducedMotion,
}: {
  curve: THREE.CatmullRomCurve3;
  glowTexture: THREE.Texture;
  reducedMotion: boolean;
}) {
  const sprite = useRef<THREE.Sprite>(null);
  const core = useRef<THREE.Mesh>(null);
  const progress = useRef(0);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    progress.current = (progress.current + delta * 0.075) % 1;
    // sanft ein- und ausblenden an den Enden, damit nichts "springt"
    const edge = Math.min(
      1,
      Math.min(progress.current, 1 - progress.current) / 0.08
    );
    const point = curve.getPointAt(progress.current);
    sprite.current?.position.copy(point);
    core.current?.position.copy(point);

    const pulse = 1 + Math.sin(progress.current * Math.PI * 14) * 0.12;
    const scale = 0.62 * pulse * edge;
    sprite.current?.scale.set(scale, scale, 1);
    const material = sprite.current?.material as
      | THREE.SpriteMaterial
      | undefined;
    if (material) material.opacity = 0.85 * edge;
    core.current?.scale.setScalar(Math.max(0.001, edge));
  });

  if (reducedMotion) return null;

  return (
    <>
      <sprite ref={sprite}>
        <spriteMaterial
          map={glowTexture}
          color={LIME}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <mesh ref={core}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color="#f4ffd6" toneMapped={false} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Sternenfeld in mehreren Tiefen
 * ------------------------------------------------------------------ */
function Starfield({ reducedMotion }: { reducedMotion: boolean }) {
  const layers = useMemo(() => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return [
      { count: 90, depth: -5, size: 0.028, opacity: 0.5, speed: 0.012 },
      { count: 60, depth: -3.2, size: 0.04, opacity: 0.68, speed: 0.02 },
      { count: 26, depth: -1.6, size: 0.055, opacity: 0.85, speed: 0.032 },
    ].map((layer) => {
      const positions = new Float32Array(layer.count * 3);
      for (let i = 0; i < layer.count; i += 1) {
        positions[i * 3] = (random() - 0.5) * 16;
        positions[i * 3 + 1] = (random() - 0.5) * 7;
        positions[i * 3 + 2] = layer.depth - random() * 1.5;
      }
      return { ...layer, positions };
    });
  }, []);

  const groups = useRef<(THREE.Object3D | null)[]>([]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    groups.current.forEach((points, i) => {
      if (!points) return;
      // langsame Drift – die vorderen Ebenen schneller (Tiefenwirkung)
      points.position.x += delta * layers[i].speed;
      if (points.position.x > 3) points.position.x = -3;
    });
  });

  return (
    <>
      {layers.map((layer, i) => (
        <points
          key={layer.depth}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[layer.positions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            color={VIOLET}
            size={layer.size}
            transparent
            opacity={layer.opacity}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Eine Station
 * ------------------------------------------------------------------ */
function Station({
  section,
  position,
  glowTexture,
  active,
  isNext,
  intro,
  delay,
  reducedMotion,
  onHover,
  onSelect,
}: {
  section: JourneySection;
  position: THREE.Vector3;
  glowTexture: THREE.Texture;
  active: boolean;
  isNext: boolean;
  /** Fortschritt der Einflug-Animation (0..1), geteilt mit der Szene */
  intro: React.RefObject<number>;
  /** ab wann diese Station erscheint (0..1 der Intro-Dauer) */
  delay: number;
  reducedMotion: boolean;
  onHover: (over: boolean) => void;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const time = useRef(0);

  const color = section.completed ? LIME : section.locked ? DIM : VIOLET;

  useFrame((_, delta) => {
    time.current += delta;
    // gestaffeltes Erscheinen: erst wenn die Kamerafahrt hier angekommen ist
    const t = easeOutCubic(intro.current ?? 1);
    const raw = reducedMotion ? 1 : (t - delay) / 0.28;
    const grown = easeOutCubic(Math.min(1, Math.max(0, raw)));

    if (group.current) {
      group.current.scale.setScalar(grown);
      group.current.visible = grown > 0.01;
    }
    if (core.current) {
      const hover = active ? 1.45 : 1;
      const beat =
        isNext && !reducedMotion ? 1 + Math.sin(time.current * 2.6) * 0.14 : 1;
      core.current.scale.setScalar(hover * beat);
    }
    if (halo.current) {
      const base = section.completed ? 1.15 : section.locked ? 0.5 : 0.85;
      const breathe = reducedMotion
        ? 1
        : 1 + Math.sin(time.current * 1.6 + position.x) * 0.09;
      const scale = base * breathe * (active ? 1.5 : 1);
      halo.current.scale.set(scale, scale, 1);
    }
    if (ring.current && !reducedMotion) {
      ring.current.rotation.z += delta * 0.8;
      const s = 1 + Math.sin(time.current * 2.6) * 0.12;
      ring.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={group} position={position}>
      {/* weicher Lichthof */}
      <sprite ref={halo}>
        <spriteMaterial
          map={glowTexture}
          color={color}
          transparent
          opacity={section.locked ? 0.35 : 0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <mesh
        ref={core}
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
        <sphereGeometry args={[0.15, 28, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={section.completed ? 1.4 : active ? 1.1 : 0.5}
          roughness={0.25}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>

      {/* Ring markiert die Station, an der es weitergeht */}
      {isNext ? (
        <mesh ref={ring} rotation={[Math.PI / 2.6, 0, 0]}>
          <torusGeometry args={[0.34, 0.011, 12, 48]} />
          <meshStandardMaterial
            color={LIME}
            emissive={LIME}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Szene
 * ------------------------------------------------------------------ */
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
  const intro = useRef(0);
  const drag = useRef({ active: false, lastX: 0, rotation: 0 });


  const points = useMemo(() => journeyPoints(sections.length), [sections]);
  // Die Strecke selbst ist fest – so schwingt sie auch bei zwei Stationen
  const curve = ROUTE;

  /** Anteil der Reise, der bereits geschafft ist (0..1) */
  const progress = useMemo(() => {
    if (sections.length === 0) return 0;
    const sum = sections.reduce(
      (acc, s) => acc + Math.min(100, Math.max(0, s.percent)) / 100,
      0
    );
    return Math.min(1, sum / sections.length);
  }, [sections]);


  const glowTexture = useMemo(() => makeGlowTexture(), []);
  const doneColor = useMemo(() => new THREE.Color(LIME), []);
  const openColor = useMemo(() => new THREE.Color(VIOLET), []);
  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  const nextIndex = useMemo(
    () =>
      sections.findIndex(
        (s, i) =>
          !s.completed &&
          !s.locked &&
          sections.slice(0, i).every((p) => p.completed || p.locked)
      ),
    [sections]
  );

  useFrame((state, delta) => {
    // Kamera aus dem Frame-Zustand: sie gehört der Szene, nicht dem Render
    const camera = state.camera;
    intro.current = Math.min(1, intro.current + delta / (reducedMotion ? 0.01 : 1.5));
    const t = easeOutCubic(intro.current);

    // Kamerafahrt: von weit hinten heran, dann ruhiges Schweben
    const idle = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.4);
    const pointerX = reducedMotion ? 0 : state.pointer.x;
    const pointerY = reducedMotion ? 0 : state.pointer.y;

    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      pointerX * 0.55,
      0.05
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      2.9 - 1.15 * t + pointerY * 0.28 + idle * 0.06,
      0.06
    );
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      9.4 - 3.5 * t,
      0.06
    );
    camera.lookAt(0, 0, 0);

    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        drag.current.rotation,
        0.09
      );
    }
  });

  return (
    <group
      ref={group}
      onPointerDown={(e) => {
        drag.current.active = true;
        drag.current.lastX = e.clientX;
      }}
      onPointerUp={() => {
        drag.current.active = false;
      }}
      onPointerMove={(e) => {
        if (!drag.current.active) return;
        drag.current.rotation = THREE.MathUtils.clamp(
          drag.current.rotation + (e.clientX - drag.current.lastX) * 0.005,
          -0.75,
          0.75
        );
        drag.current.lastX = e.clientX;
      }}
    >
      <Starfield reducedMotion={reducedMotion} />

      {/* Die Route: haarfeine Führungslinie, darüber ein Strom aus
          Lichtpartikeln. Bewusst kein Volumen – eine Röhre mit
          halbdurchsichtigem Material sieht ohne Bloom wie ein Schlauch aus. */}
      {points.length > 1 ? (
        <>
          <JourneyLine curve={curve} color="#4d5680" opacity={0.5} />
          <JourneyStream
            curve={curve}
            progress={progress}
            count={260}
            texture={glowTexture}
            doneColor={doneColor}
            openColor={openColor}
            reducedMotion={reducedMotion}
            intro={intro}
          />
          <Traveller
            curve={curve}
            glowTexture={glowTexture}
            reducedMotion={reducedMotion}
          />
        </>
      ) : null}

      {sections.map((section, i) => (
        <Station
          key={section.id}
          section={section}
          position={points[i]}
          glowTexture={glowTexture}
          active={hovered === i}
          isNext={i === nextIndex}
          intro={intro}
          delay={0.25 + (i / Math.max(1, sections.length)) * 0.55}
          reducedMotion={reducedMotion}
          onHover={(over) => onHover(over ? i : null)}
          onSelect={() => onSelect(i)}
        />
      ))}
    </group>
  );
}

/**
 * Lernpfad als 3D-Reise: eine leuchtende Route durch den Kurs, je Abschnitt
 * eine Station. Der zurückgelegte Teil pulsiert, die nächste offene Station
 * trägt einen rotierenden Ring, gesperrte (Drip) bleiben gedimmt. Klick
 * springt zum Abschnitt, Ziehen dreht die Szene, Mausbewegung erzeugt eine
 * leichte Parallaxe.
 *
 * Rein ergänzend-dekorativ (aria-hidden): Die barrierefreie Navigation ist
 * das Inhaltsverzeichnis daneben. Bei prefers-reduced-motion steht alles
 * still.
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

  /* Beim Lernen scrollt man rasch zur Lektion – dann muss hier oben nichts
     mehr gerendert werden. Spart spürbar Rechenzeit und Akku. */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = wrapRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const done = sections.filter((s) => s.completed).length;
  const current = hovered !== null ? sections[hovered] : null;

  if (sections.length === 0) return null;

  return (
    <Wrap aria-hidden ref={wrapRef}>
      <Caption>✦ {title}</Caption>
      <Progress>
        {done}/{sections.length}
        <small>Etappen</small>
      </Progress>
      <Canvas
        camera={{ position: [0, 2.9, 9.4], fov: 46 }}
        frameloop={visible && !reducedMotion ? "always" : "demand"}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 6, 5]} intensity={0.9} />
        <pointLight position={[-5, 2, 2]} intensity={0.8} color={VIOLET} />
        <pointLight position={[4, -1, 3]} intensity={0.5} color={LIME} />
        <Scene
          sections={sections}
          hovered={hovered}
          onHover={setHovered}
          onSelect={(index) => onSelectSection(sections[index].id)}
          reducedMotion={reducedMotion}
        />
      </Canvas>
      <HoverInfo $visible={current !== null}>
        {current ? (
          <>
            <strong>{current.title}</strong> · <em>{Math.round(current.percent)} %</em>
            {current.locked ? " · 🔒 noch gesperrt" : ""}
          </>
        ) : (
          hint
        )}
      </HoverInfo>
    </Wrap>
  );
}
