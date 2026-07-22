"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useLocale } from "next-intl";
import * as THREE from "three";
import styled, { keyframes } from "styled-components";
import { JourneyLine, JourneyStream } from "./JourneyStream";

/* Zwei Farben tragen die ganze Szene: Blau heißt "offen", Gold heißt
   "geschafft" – bei Planeten, Ringen und der Abschlusssonne gleichermaßen. */
const BLUE = "#5AA9FF";
/** blasses Blau der Prüfungsringe, solange die Prüfung offen ist */
const RING_BLUE = "#9CC6FF";
/** gesperrte Abschnitte: dasselbe Blau, nur weit heruntergedimmt */
const DIM = "#2f4a72";
const GOLD = "#F5C542";
const SUN = "#FFD782";
/** Violett bleibt dem Sternenhintergrund vorbehalten */
const VIOLET = "#8B7CFF";

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
  /** hat dieser Abschnitt eine Zwischenprüfung? */
  hasQuiz: boolean;
  quizPassed: boolean;
  /** gesperrt bis: nächster Prüfungsversuch erst ab diesem Zeitpunkt */
  quizNextAttemptAt: string | null;
  /** alle erlaubten Versuche verbraucht */
  quizExhausted: boolean;
}

export interface JourneyFinalExam {
  title: string;
  passed: boolean;
  /** Zulassung erreicht (Sehanteil + Zwischenprüfungen) */
  unlocked: boolean;
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

/**
 * Gleichmäßig auf der Strecke verteilte Haltepunkte. Gibt es eine
 * Abschlussprüfung, endet die Reihe der Abschnitte vorher – das letzte
 * Stück der Route gehört der Sonne.
 */
function journeyPoints(count: number, maxT: number): THREE.Vector3[] {
  if (count === 1) return [ROUTE.getPointAt(maxT * 0.5)];
  return Array.from({ length: count }, (_, i) =>
    ROUTE.getPointAt((i / (count - 1)) * maxT)
  );
}

/**
 * Halbe Breite, die die Reise in Weltmaßen belegt: äußerster Routenpunkt
 * (4.35) plus Lichthof des Planeten bzw. die Korona der Sonne.
 */
const SCENE_HALF_WIDTH = 5.4;

/** Kamerafahrt: von weit hinten heran auf den Ruheabstand */
const CAMERA_START_Z = 18;
const CAMERA_END_Z = 14.2;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Kurzer Zusatz zur Zwischenprüfung für die Infozeile: bestanden, gesperrt
 * bis zu einem Zeitpunkt, oder Versuche aufgebraucht.
 */
function describeQuiz(section: JourneySection, locale: string): string {
  if (!section.hasQuiz) return "";
  if (section.quizPassed) return " · ✓ Zwischenprüfung bestanden";
  if (section.quizExhausted) return " · Zwischenprüfung: keine Versuche mehr";
  if (section.quizNextAttemptAt) {
    const when = new Date(section.quizNextAttemptAt);
    const minutes = Math.max(
      1,
      Math.round((when.getTime() - Date.now()) / 60000)
    );
    if (minutes > 90) {
      return ` · nächster Prüfungsversuch ab ${new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(when)}`;
    }
    return ` · nächster Prüfungsversuch in ${minutes} Min.`;
  }
  return " · Zwischenprüfung offen";
}

/**
 * Die Abschlussprüfung als Sonne am Ende der Route – das Ziel der Reise.
 * Bestanden strahlt sie warm und hell, freigeschaltet glimmt sie erwartungs-
 * voll, davor bleibt sie ein matter, kalter Himmelskörper.
 */
function FinalSun({
  exam,
  position,
  glowTexture,
  active,
  reducedMotion,
  onHover,
}: {
  exam: JourneyFinalExam;
  position: THREE.Vector3;
  glowTexture: THREE.Texture;
  active: boolean;
  reducedMotion: boolean;
  onHover: (over: boolean) => void;
}) {
  const halo = useRef<THREE.Sprite>(null);
  const corona = useRef<THREE.Sprite>(null);
  const body = useRef<THREE.Mesh>(null);
  const time = useRef(0);

  /* Gleiche Logik wie bei den Planeten: blau bis bestanden, dann gold.
     Ob die Prüfung schon freigeschaltet ist, steuert nur die Helligkeit –
     die Farbe wechselt erst mit dem Bestehen, sonst verlöre Gold seine
     Bedeutung. */
  const color = exam.passed ? SUN : BLUE;

  useFrame((_, delta) => {
    time.current += delta;
    const beat = reducedMotion ? 1 : 1 + Math.sin(time.current * 1.2) * 0.06;
    const reach = exam.passed ? 2.6 : exam.unlocked ? 1.9 : 1.15;
    const scale = reach * beat * (active ? 1.18 : 1);
    halo.current?.scale.set(scale, scale, 1);

    // zweite, langsamer atmende Hülle erzeugt den Eindruck von Korona
    const coronaScale =
      (exam.passed ? 4.2 : 3) *
      (reducedMotion ? 1 : 1 + Math.sin(time.current * 0.7 + 1) * 0.05);
    corona.current?.scale.set(coronaScale, coronaScale, 1);

    if (body.current && !reducedMotion) {
      body.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group position={position}>
      <sprite ref={corona}>
        <spriteMaterial
          map={glowTexture}
          color={color}
          transparent
          opacity={exam.passed ? 0.3 : exam.unlocked ? 0.2 : 0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite ref={halo}>
        <spriteMaterial
          map={glowTexture}
          color={color}
          transparent
          opacity={exam.passed ? 0.95 : exam.unlocked ? 0.7 : 0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <mesh
        ref={body}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
        }}
        onPointerOut={() => onHover(false)}
      >
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={exam.passed ? 2.2 : exam.unlocked ? 1.2 : 0.35}
          roughness={0.35}
          toneMapped={false}
        />
      </mesh>
      {exam.passed ? (
        <pointLight color={SUN} intensity={2.4} distance={6} />
      ) : null}
    </group>
  );
}

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
          color={SUN}
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
  /* Sterne sitzen auf Kugelschalen rund um die Szene, nicht in einem
     Quader dahinter. Sonst wäre beim Drehen plötzlich der Rand des
     Weltalls zu sehen. */
  const layers = useMemo(() => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return [
      { count: 260, radius: 26, size: 0.075, opacity: 0.45, speed: 0.006 },
      { count: 160, radius: 18, size: 0.07, opacity: 0.62, speed: 0.011 },
      { count: 70, radius: 12, size: 0.06, opacity: 0.8, speed: 0.018 },
    ].map((layer) => {
      const positions = new Float32Array(layer.count * 3);
      for (let i = 0; i < layer.count; i += 1) {
        // gleichmäßig auf der Kugeloberfläche verteilen
        const u = random() * 2 - 1;
        const theta = random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        const jitter = 0.85 + random() * 0.3;
        positions[i * 3] = layer.radius * jitter * r * Math.cos(theta);
        positions[i * 3 + 1] = layer.radius * jitter * u * 0.55;
        positions[i * 3 + 2] = layer.radius * jitter * r * Math.sin(theta);
      }
      return { ...layer, positions };
    });
  }, []);

  const groups = useRef<(THREE.Object3D | null)[]>([]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    groups.current.forEach((points, i) => {
      if (!points) return;
      /* Sanftes Kreisen statt Verschieben: Auf einer Kugelschale gibt es
         keinen Rand, an dem etwas zurückspringen müsste. Die inneren
         Schalen drehen schneller – daraus entsteht die Tiefenwirkung. */
      points.rotation.y += delta * layers[i].speed;
    });
  });

  return (
    <>
      {layers.map((layer, i) => (
        <points
          key={layer.radius}
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

  // Gold heißt fertig, Blau heißt offen – gesperrt ist dasselbe Blau, gedimmt
  const color = section.completed ? GOLD : section.locked ? DIM : BLUE;

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
      // langsame Eigendrehung; nur die Station, an der es weitergeht,
      // lässt ihren Ring zusätzlich atmen
      ring.current.rotation.z += delta * 0.35;
      const s = isNext ? 1 + Math.sin(time.current * 2.2) * 0.07 : 1;
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

      {/* Prüfungsring – und zwar ausschließlich dann, wenn der Abschnitt
          wirklich eine Zwischenprüfung hat. Blass blau, solange sie offen
          ist, golden sobald sie bestanden wurde. Ein Ring bedeutet in dieser
          Szene immer "hier wird geprüft", nichts anderes. */}
      {section.hasQuiz ? (
        <mesh ref={ring} rotation={[Math.PI / 2.35, 0, 0.35]}>
          <torusGeometry args={[0.3, 0.016, 14, 60]} />
          <meshStandardMaterial
            color={section.quizPassed ? GOLD : RING_BLUE}
            emissive={section.quizPassed ? GOLD : RING_BLUE}
            emissiveIntensity={section.quizPassed ? 1.5 : 0.3}
            transparent
            opacity={section.quizPassed ? 1 : 0.42}
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
  finalExam,
  hovered,
  onHover,
  onHoverSun,
  onSelect,
  reducedMotion,
}: {
  sections: JourneySection[];
  finalExam: JourneyFinalExam | null;
  hovered: number | null;
  onHover: (index: number | null) => void;
  onHoverSun: (over: boolean) => void;
  onSelect: (index: number) => void;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const intro = useRef(0);
  const drag = useRef({ active: false, lastX: 0, rotation: 0 });

  // Mit Abschlussprüfung enden die Abschnitte früher – das letzte Stück
  // der Route führt zur Sonne
  const stationsEndAt = finalExam ? 0.78 : 1;
  const points = useMemo(
    () => journeyPoints(sections.length, stationsEndAt),
    [sections, stationsEndAt]
  );
  const sunPosition = useMemo(() => ROUTE.getPointAt(1), []);
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
  const doneColor = useMemo(() => new THREE.Color(GOLD), []);
  const openColor = useMemo(() => new THREE.Color(BLUE), []);
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
      2.6 - 1.05 * t + pointerY * 0.28 + idle * 0.06,
      0.06
    );
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      CAMERA_START_Z - (CAMERA_START_Z - CAMERA_END_Z) * t,
      0.06
    );
    camera.lookAt(0, 0, 0);

    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        drag.current.rotation,
        0.09
      );

      /* Die Szene an das Sichtfeld anpassen. viewport.width ist die in
         Weltmaßen sichtbare Breite auf Höhe z=0 – auf schmalen Displays
         ist sie kleiner als die Route breit ist, und die äußeren Planeten
         lägen außerhalb des Bildes (nicht anklickbar). Statt die Kamera
         zurückzufahren – was die Planeten winzig machte – wird die ganze
         Reise so weit verkleinert, dass sie mit Rand hineinpasst. */
      const fit = THREE.MathUtils.clamp(
        (state.viewport.width * 0.5 * 0.86) / SCENE_HALF_WIDTH,
        0.34,
        1
      );
      group.current.scale.setScalar(
        THREE.MathUtils.lerp(group.current.scale.x || fit, fit, 0.12)
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

      {finalExam ? (
        <FinalSun
          exam={finalExam}
          position={sunPosition}
          glowTexture={glowTexture}
          active={hovered === -2}
          reducedMotion={reducedMotion}
          onHover={onHoverSun}
        />
      ) : null}
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
  finalExam = null,
  onSelectSection,
}: {
  title: string;
  hint: string;
  sections: JourneySection[];
  /** Abschlussprüfung als Sonne am Ende der Route */
  finalExam?: JourneyFinalExam | null;
  onSelectSection: (sectionId: string) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const locale = useLocale();
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
  // -2 steht für die Sonne (Abschlussprüfung), nicht für einen Abschnitt
  const current = hovered !== null && hovered >= 0 ? sections[hovered] : null;

  if (sections.length === 0) return null;

  return (
    <Wrap aria-hidden ref={wrapRef}>
      <Caption>✦ {title}</Caption>
      <Progress>
        {done}/{sections.length}
        <small>Etappen</small>
      </Progress>
      <Canvas
        /* Enger Blickwinkel aus größerem Abstand: Bei weitem Winkel werden
           Kugeln am Bildrand perspektivisch zu Ellipsen gezerrt. */
        camera={{ position: [0, 2.6, CAMERA_START_Z], fov: 27 }}
        frameloop={visible && !reducedMotion ? "always" : "demand"}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 6, 5]} intensity={0.9} />
        <pointLight position={[-5, 2, 2]} intensity={0.8} color={BLUE} />
        <pointLight position={[4, -1, 3]} intensity={0.5} color={BLUE} />
        <Scene
          sections={sections}
          finalExam={finalExam}
          hovered={hovered}
          onHover={setHovered}
          onHoverSun={(over) => setHovered(over ? -2 : null)}
          onSelect={(index) => onSelectSection(sections[index].id)}
          reducedMotion={reducedMotion}
        />
      </Canvas>
      <HoverInfo $visible={hovered !== null}>
        {hovered === -2 && finalExam ? (
          <>
            <strong>🎯 {finalExam.title}</strong> ·{" "}
            {finalExam.passed
              ? "bestanden – Zertifikat verdient"
              : finalExam.unlocked
                ? "freigeschaltet – du kannst antreten"
                : "noch gesperrt: Sehanteil und Zwischenprüfungen fehlen"}
          </>
        ) : current ? (
          <>
            <strong>{current.title}</strong> ·{" "}
            <em>{Math.round(current.percent)} %</em>
            {current.locked ? " · 🔒 Abschnitt noch gesperrt" : ""}
            {describeQuiz(current, locale)}
          </>
        ) : (
          hint
        )}
      </HoverInfo>
    </Wrap>
  );
}
