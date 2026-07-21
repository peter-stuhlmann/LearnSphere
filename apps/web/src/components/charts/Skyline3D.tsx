"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import styled from "styled-components";

const VIOLET = "#8B7CFF";
const LIME = "#C8FF4D";

const Wrap = styled.div`
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  background:
    radial-gradient(ellipse 80% 120% at 50% 120%, rgba(139, 124, 255, 0.14), transparent),
    ${({ theme }) => theme.colors.bgDeep};
  overflow: hidden;
  height: 320px;

  canvas {
    touch-action: pan-y;
  }
`;

const Caption = styled.p`
  position: absolute;
  top: 1rem;
  left: 1.25rem;
  font-size: 0.92rem;
  font-weight: 600;
  z-index: 1;
`;

const HoverInfo = styled.div`
  position: absolute;
  bottom: 1rem;
  left: 1.25rem;
  right: 1.25rem;
  z-index: 1;
  font-size: 0.85rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: ${({ theme }) => theme.colors.textMuted};

  strong {
    color: ${({ theme }) => theme.colors.accent};
    font-family: ${({ theme }) => theme.fonts.mono};
  }
`;

export interface SkylineItem {
  label: string;
  value: number;
  display: string;
}

function Bars({
  items,
  hovered,
  onHover,
}: {
  items: SkylineItem[];
  hovered: number | null;
  onHover: (index: number | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const targetRotation = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);

  const max = Math.max(1, ...items.map((i) => i.value));
  const spacing = 1.5;
  const offset = ((items.length - 1) * spacing) / 2;

  useFrame((state, delta) => {
    if (!group.current) return;
    if (!dragging.current && hovered === null) {
      targetRotation.current += delta * 0.25;
    }
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      targetRotation.current,
      0.08
    );
  });

  const heights = useMemo(
    () => items.map((item) => 0.4 + (item.value / max) * 3.2),
    [items, max]
  );

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
          targetRotation.current += (e.clientX - lastX.current) * 0.01;
          lastX.current = e.clientX;
        }
      }}
    >
      {/* Bodenplatte */}
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[items.length * spacing + 3, 6]} />
        <meshStandardMaterial
          color="#12141F"
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {items.map((item, i) => {
        const height = heights[i];
        const active = hovered === i;
        return (
          <mesh
            key={item.label}
            position={[i * spacing - offset, height / 2, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHover(i);
            }}
            onPointerOut={() => onHover(null)}
          >
            <boxGeometry args={[0.9, height, 0.9]} />
            <meshStandardMaterial
              color={active ? LIME : VIOLET}
              emissive={active ? LIME : VIOLET}
              emissiveIntensity={active ? 0.55 : 0.18}
              metalness={0.35}
              roughness={0.35}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Interaktive 3D-"Skyline": ein Turm pro Kurs, Höhe = Wert. Ziehen rotiert,
 * Hover hebt hervor. Rein dekorativ-ergänzend – dieselben Daten stehen
 * daneben als barrierefreie Balkenliste (aria-hidden hier).
 */
export function Skyline3D({
  title,
  items,
  hint,
}: {
  title: string;
  items: SkylineItem[];
  hint: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const current = hovered !== null ? items[hovered] : null;

  if (items.length === 0) {
    return null;
  }

  return (
    <Wrap aria-hidden>
      <Caption>{title}</Caption>
      <Canvas
        camera={{ position: [0, 3.2, 7.5], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 8, 6]} intensity={1.4} />
        <pointLight position={[-6, 4, -4]} intensity={0.6} color={VIOLET} />
        <Bars items={items} hovered={hovered} onHover={setHovered} />
      </Canvas>
      <HoverInfo>
        {current ? (
          <span>
            {current.label} · <strong>{current.display}</strong>
          </span>
        ) : (
          <span>{hint}</span>
        )}
      </HoverInfo>
    </Wrap>
  );
}
