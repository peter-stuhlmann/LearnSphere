/**
 * Zuschnitt fürs Kursbild: Der Ausschnitt ist frei verschieb- und
 * skalierbar, behält aber immer das Ziel-Seitenverhältnis – exportiert
 * wird exakt COVER_WIDTH × COVER_HEIGHT.
 */

export const COVER_WIDTH = 992;
export const COVER_HEIGHT = 558;
export const COVER_ASPECT = COVER_WIDTH / COVER_HEIGHT;

/** Mindestbreite des Ausschnitts in Bildpixeln (verhindert Mini-Crops). */
export const MIN_CROP_WIDTH = 100;

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Größtmöglicher zentrierter Ausschnitt im Zielverhältnis. */
export function initialCrop(
  imageWidth: number,
  imageHeight: number,
  aspect: number = COVER_ASPECT
): CropRect {
  let width = imageWidth;
  let height = width / aspect;
  if (height > imageHeight) {
    height = imageHeight;
    width = height * aspect;
  }
  return {
    x: (imageWidth - width) / 2,
    y: (imageHeight - height) / 2,
    width,
    height,
  };
}

/** Ausschnitt verschieben, ohne das Bild zu verlassen. */
export function moveCrop(
  crop: CropRect,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number
): CropRect {
  return {
    ...crop,
    x: clamp(crop.x + dx, 0, imageWidth - crop.width),
    y: clamp(crop.y + dy, 0, imageHeight - crop.height),
  };
}

/**
 * Ausschnitt skalieren (Anker oben links, Verhältnis bleibt fix).
 * Begrenzt durch Mindestgröße und die Bildränder.
 */
export function resizeCrop(
  crop: CropRect,
  dWidth: number,
  imageWidth: number,
  imageHeight: number,
  aspect: number = COVER_ASPECT
): CropRect {
  const maxWidth = Math.min(
    imageWidth - crop.x,
    (imageHeight - crop.y) * aspect
  );
  const width = clamp(
    crop.width + dWidth,
    Math.min(MIN_CROP_WIDTH, maxWidth),
    maxWidth
  );
  return { ...crop, width, height: width / aspect };
}
