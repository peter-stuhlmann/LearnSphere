/**
 * three r183+ deprecated THREE.Clock zugunsten von THREE.Timer – und
 * @react-three/fiber (Stand 9.6.1) instanziiert intern weiterhin pro
 * <Canvas> eine Clock. Unser eigener Code nutzt Clock nicht; die Warnung
 * ist für uns reines Rauschen, das echte Probleme in der Konsole
 * verdeckt.
 *
 * Deshalb: console.warn einmalig wrappen und AUSSCHLIESSLICH diese eine
 * Deprecation verwerfen. Sobald fiber auf THREE.Timer umgestellt hat,
 * fliegt dieses Modul ersatzlos raus.
 */

const CLOCK_DEPRECATION = "Clock: This module has been deprecated";

interface WarnTarget {
  warn: (...args: unknown[]) => void;
}

const wrappedTargets = new WeakSet<WarnTarget>();

export function installThreeClockWarningFilter(
  target: WarnTarget = console
): void {
  if (wrappedTargets.has(target)) return;
  wrappedTargets.add(target);

  const original = target.warn.bind(target);
  target.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes(CLOCK_DEPRECATION)) {
      return;
    }
    original(...args);
  };
}
