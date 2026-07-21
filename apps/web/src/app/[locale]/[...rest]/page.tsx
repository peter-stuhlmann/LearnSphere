import { notFound } from "next/navigation";

/** Catch-All: unbekannte Pfade unterhalb der Locale → gestaltete 404-Seite. */
export default function CatchAllPage() {
  notFound();
}
