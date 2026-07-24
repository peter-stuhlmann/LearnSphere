"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { installThreeClockWarningFilter } from "@/lib/three-warnings";

// fiber instanziiert intern die (seit three r183 deprecatete) Clock
installThreeClockWarningFilter();

const COUNT = 140;
const RADIUS = 3.2;
const LINK_DISTANCE = 1.1;

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function Points() {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });

  const { positions, linePositions } = useMemo(() => {
    const rand = seededRandom(42);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < COUNT; i++) {
      // Punkte auf einer leicht abgeflachten Kugelschale
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = RADIUS * (0.75 + rand() * 0.35);
      pts.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi) * 0.72,
          r * Math.sin(phi) * Math.sin(theta)
        )
      );
    }

    const positionArray = new Float32Array(COUNT * 3);
    pts.forEach((p, i) => {
      positionArray[i * 3] = p.x;
      positionArray[i * 3 + 1] = p.y;
      positionArray[i * 3 + 2] = p.z;
    });

    const lines: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        if (pts[i].distanceTo(pts[j]) < LINK_DISTANCE) {
          lines.push(
            pts[i].x, pts[i].y, pts[i].z,
            pts[j].x, pts[j].y, pts[j].z
          );
        }
      }
    }

    return {
      positions: positionArray,
      linePositions: new Float32Array(lines),
    };
  }, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    pointer.current.x = THREE.MathUtils.lerp(
      pointer.current.x,
      state.pointer.x * 0.25,
      0.04
    );
    pointer.current.y = THREE.MathUtils.lerp(
      pointer.current.y,
      state.pointer.y * 0.15,
      0.04
    );
    group.current.rotation.y += delta * 0.05;
    group.current.rotation.x = pointer.current.y;
    group.current.rotation.z = pointer.current.x * 0.3;
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#C8FF4D"
          size={0.045}
          sizeAttenuation
          transparent
          opacity={0.9}
        />
      </points>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#8B7CFF" transparent opacity={0.22} />
      </lineSegments>
    </group>
  );
}

export default function Constellation() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.5], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <Points />
    </Canvas>
  );
}
