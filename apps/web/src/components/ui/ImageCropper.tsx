"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { AnimatePresence, motion } from "motion/react";
import {
  COVER_HEIGHT,
  COVER_WIDTH,
  initialCrop,
  moveCrop,
  resizeCrop,
  type CropRect,
} from "@/lib/crop";
import { GhostButton, Muted, PrimaryButton } from "@/components/ui/primitives";

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(7, 8, 15, 0.8);
  backdrop-filter: blur(6px);
`;

const Dialog = styled(motion.div)`
  width: 100%;
  max-width: 720px;
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.radii.lg};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};

  h2 {
    font-size: 1.2rem;
  }
`;

const Stage = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  user-select: none;
  touch-action: none;
`;

const ImageWrap = styled.div`
  position: relative;
  line-height: 0;
  border-radius: ${({ theme }) => theme.radii.sm};
  /* Abdunkel-Schatten der Auswahl bleibt aufs Bild begrenzt –
     Titel, Hinweis und Buttons bleiben voll lesbar */
  overflow: hidden;

  img {
    max-width: 100%;
    /* Hochformat: Höhe deckeln, sonst sprengt das Bild den Dialog */
    max-height: min(55vh, 480px);
    width: auto;
    height: auto;
    display: block;
  }
`;

const CropBox = styled.div`
  position: absolute;
  border: 2px solid ${({ theme }) => theme.colors.accent};
  border-radius: 4px;
  cursor: move;
  /* dunkelt den Bereich außerhalb des Ausschnitts ab */
  box-shadow: 0 0 0 9999px rgba(7, 8, 15, 0.65);

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 3px;
  }
`;

const ResizeHandle = styled.div`
  position: absolute;
  right: -10px;
  bottom: -10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accent};
  border: 3px solid ${({ theme }) => theme.colors.bgDeep};
  cursor: nwse-resize;
`;

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.25rem;
`;

const SizeStatus = styled.p<{ $error: boolean }>`
  margin-top: 0.75rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.85rem;
  line-height: 1.5;
  color: ${({ theme, $error }) =>
    $error ? theme.colors.danger : theme.colors.textMuted};
`;

type DragMode =
  | { kind: "move"; startX: number; startY: number; crop: CropRect }
  | { kind: "resize"; startX: number; crop: CropRect }
  | null;

export interface ImageCropperProps {
  /**
   * Objekt-URL des Bildes. Wird vom Aufrufer im Event-Handler erzeugt und
   * nach dem Schließen widerrufen – so überlebt sie auch Reacts
   * StrictMode-Doppelmount in der Entwicklung.
   */
  imageUrl: string;
  onCancel: () => void;
  /** liefert den fertigen 992×558-Zuschnitt als JPEG-Blob */
  onCropped: (blob: Blob) => void;
}

/**
 * Zuschneide-Dialog mit fixem 992×558-Zielformat: Ausschnitt per Maus/Touch
 * verschieben, Ecke zieht die Größe; Pfeiltasten verschieben, Shift+Pfeile
 * skalieren (barrierefrei ohne Maus bedienbar).
 */
export function ImageCropper({
  imageUrl,
  onCancel,
  onCropped,
}: ImageCropperProps) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [exporting, setExporting] = useState(false);
  /** Umrechnung Bild-Pixel → Anzeige-Pixel (im State, nie Ref im Render) */
  const [displayScale, setDisplayScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragMode>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);

  // Anzeige-Skalierung robust nachführen: der ResizeObserver feuert nach dem
  // Layout (auch wenn clientWidth beim onLoad noch 0 ist) und bei jeder
  // Größenänderung von Fenster/Dialog.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new ResizeObserver(() => {
      if (img.naturalWidth > 0 && img.clientWidth > 0) {
        setDisplayScale(img.clientWidth / img.naturalWidth);
      }
    });
    observer.observe(img);
    return () => observer.disconnect();
  }, [imageUrl]);

  function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    const size = { w: img.naturalWidth, h: img.naturalHeight };
    setNatural(size);
    setCrop(initialCrop(size.w, size.h));
    if (img.clientWidth > 0) {
      setDisplayScale(img.clientWidth / size.w);
    }
    requestAnimationFrame(() => cropBoxRef.current?.focus());
  }

  /** aktuelle Skalierung für Event-Handler (Ref-Zugriff außerhalb des Renders) */
  function scale(): number {
    const img = imgRef.current;
    if (!img || !natural) return 1;
    return img.clientWidth / natural.w;
  }

  function onPointerDown(
    event: ReactPointerEvent,
    kind: "move" | "resize"
  ) {
    if (!crop) return;
    event.preventDefault();
    event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragRef.current =
      kind === "move"
        ? { kind, startX: event.clientX, startY: event.clientY, crop }
        : { kind, startX: event.clientX, crop };
  }

  function onPointerMove(event: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag || !natural) return;
    const s = scale();
    if (drag.kind === "move") {
      setCrop(
        moveCrop(
          drag.crop,
          (event.clientX - drag.startX) / s,
          (event.clientY - drag.startY) / s,
          natural.w,
          natural.h
        )
      );
    } else {
      setCrop(
        resizeCrop(
          drag.crop,
          (event.clientX - drag.startX) / s,
          natural.w,
          natural.h
        )
      );
    }
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!crop || !natural) return;
    const step = Math.max(4, Math.round(natural.w / 100));
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    if (!delta) {
      if (event.key === "Escape") onCancel();
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      // Shift+Rechts/Runter vergrößert, Shift+Links/Hoch verkleinert
      setCrop(resizeCrop(crop, delta[0] + delta[1], natural.w, natural.h));
    } else {
      setCrop(moveCrop(crop, delta[0], delta[1], natural.w, natural.h));
    }
  }

  async function onConfirm() {
    if (!crop || !imgRef.current) return;
    setExporting(true);
    const canvas = document.createElement("canvas");
    canvas.width = COVER_WIDTH;
    canvas.height = COVER_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setExporting(false);
      return;
    }
    ctx.drawImage(
      imgRef.current,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      COVER_WIDTH,
      COVER_HEIGHT
    );
    canvas.toBlob(
      (blob) => {
        setExporting(false);
        if (blob) onCropped(blob);
      },
      "image/jpeg",
      0.9
    );
  }

  const s = displayScale;

  // Live-Prüfung: unter 992×558 wird der Export unscharf → Fehler + blockieren
  const cropWidth = crop ? Math.round(crop.width) : 0;
  const cropHeight = crop ? Math.round(crop.height) : 0;
  const cropTooSmall =
    crop !== null && (cropWidth < COVER_WIDTH || cropHeight < COVER_HEIGHT);
  const sourceTooSmall =
    natural !== null &&
    (natural.w < COVER_WIDTH || natural.h < COVER_HEIGHT);

  return (
    <AnimatePresence>
      <Overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <Dialog
          role="dialog"
          aria-modal="true"
          aria-label={t("cropTitle")}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18 }}
        >
          <h2>{t("cropTitle")}</h2>
          <Muted style={{ marginTop: "0.4rem", fontSize: "0.9rem", lineHeight: 1.55 }}>
            {t("cropHint", { width: COVER_WIDTH, height: COVER_HEIGHT })}
          </Muted>

          <Stage
            ref={stageRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <ImageWrap>
              {/* eslint-disable-next-line @next/next/no-img-element -- lokale Objekt-URL */}
              <img ref={imgRef} src={imageUrl} alt="" onLoad={onImageLoad} />
              {crop ? (
                <CropBox
                  ref={cropBoxRef}
                  tabIndex={0}
                  role="application"
                  aria-label={t("cropBoxLabel")}
                  style={{
                    left: crop.x * s,
                    top: crop.y * s,
                    width: crop.width * s,
                    height: crop.height * s,
                  }}
                  onPointerDown={(e) => onPointerDown(e, "move")}
                  onKeyDown={onKeyDown}
                >
                  <ResizeHandle
                    aria-hidden="true"
                    onPointerDown={(e) => onPointerDown(e, "resize")}
                  />
                </CropBox>
              ) : null}
            </ImageWrap>
          </Stage>

          {crop ? (
            <SizeStatus
              role="status"
              aria-live="polite"
              $error={cropTooSmall}
            >
              {t("cropSize", { width: cropWidth, height: cropHeight })}
              {sourceTooSmall
                ? ` – ${t("cropSourceTooSmall", {
                    width: COVER_WIDTH,
                    height: COVER_HEIGHT,
                  })}`
                : cropTooSmall
                  ? ` – ${t("cropTooSmall", {
                      width: COVER_WIDTH,
                      height: COVER_HEIGHT,
                    })}`
                  : ""}
            </SizeStatus>
          ) : null}

          <Buttons>
            <GhostButton type="button" onClick={onCancel}>
              {tc("cancel")}
            </GhostButton>
            <PrimaryButton
              type="button"
              disabled={!crop || exporting || cropTooSmall}
              onClick={onConfirm}
            >
              {exporting ? tc("loading") : t("cropConfirm")}
            </PrimaryButton>
          </Buttons>
        </Dialog>
      </Overlay>
    </AnimatePresence>
  );
}
