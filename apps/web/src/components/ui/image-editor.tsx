"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Adjustments = { brightness: number; contrast: number; saturation: number };

const NEUTRAL: Adjustments = { brightness: 1, contrast: 1, saturation: 1 };
const MAX_EDGE = 1600;
const ASPECTS = [
  { label: "Original", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
] as const;

const chip =
  "h-9 rounded-xl px-3 font-display text-sm font-bold outline-none transition-[background-color,color,transform] duration-160 ease-out-strong focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:active:scale-100 pointer-coarse:h-11";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't open that image"));
    img.src = src;
  });

// CSS brightness/contrast/saturate maths, so the export matches the live preview (ctx.filter isn't in every Safari).
function applyAdjustments(ctx: CanvasRenderingContext2D, width: number, height: number, a: Adjustments) {
  if (a.brightness === 1 && a.contrast === 1 && a.saturation === 1) return;
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    let r = (px[i] ?? 0) * a.brightness;
    let g = (px[i + 1] ?? 0) * a.brightness;
    let b = (px[i + 2] ?? 0) * a.brightness;
    r = (r - 128) * a.contrast + 128;
    g = (g - 128) * a.contrast + 128;
    b = (b - 128) * a.contrast + 128;
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    px[i] = gray + (r - gray) * a.saturation;
    px[i + 1] = gray + (g - gray) * a.saturation;
    px[i + 2] = gray + (b - gray) * a.saturation;
  }
  ctx.putImageData(image, 0, 0);
}

async function renderEdit({
  src,
  area,
  rotation,
  flipX,
  flipY,
  adjustments,
}: {
  src: string;
  area: Area;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  adjustments: Adjustments;
}): Promise<File> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const boxWidth = Math.abs(Math.cos(rad)) * img.naturalWidth + Math.abs(Math.sin(rad)) * img.naturalHeight;
  const boxHeight = Math.abs(Math.sin(rad)) * img.naturalWidth + Math.abs(Math.cos(rad)) * img.naturalHeight;

  const stage = document.createElement("canvas");
  stage.width = Math.round(boxWidth);
  stage.height = Math.round(boxHeight);
  const stageCtx = stage.getContext("2d");
  if (!stageCtx) throw new Error("This browser can't edit images");
  stageCtx.translate(boxWidth / 2, boxHeight / 2);
  stageCtx.rotate(rad);
  stageCtx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  stageCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  const scale = Math.min(1, MAX_EDGE / Math.max(area.width, area.height));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(area.width * scale));
  out.height = Math.max(1, Math.round(area.height * scale));
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("This browser can't edit images");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(stage, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);
  applyAdjustments(ctx, out.width, out.height, adjustments);

  // WebP keeps transparency (product cut-outs) at a fraction of PNG's size; older Safari only encodes PNG.
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("Couldn't save the edited image");
  const type = blob.type === "image/webp" ? "image/webp" : "image/png";
  return new File([blob], `edited.${type === "image/webp" ? "webp" : "png"}`, { type });
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-sm font-bold">
        {label}
        <span className="font-semibold text-navy-soft tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-navy"
      />
    </label>
  );
}

/**
 * Crop, rotate, straighten, flip and colour-adjust an image before it's uploaded. `src` is an
 * object URL or a same-origin /api/media URL; `onDone` gets the edited file (WebP or PNG).
 */
export function ImageEditor({
  src,
  onCancel,
  onDone,
}: {
  src: string | null;
  onCancel: () => void;
  onDone: (file: File) => Promise<void> | void;
}) {
  return (
    <Dialog.Root open={src !== null} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-navy/40 transition-opacity duration-180 ease-out-strong data-ending-style:opacity-0 data-ending-style:duration-140 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-0 z-[60] flex flex-col bg-paper text-navy outline-none transition-[opacity,scale] duration-180 ease-out-strong data-ending-style:opacity-0 data-ending-style:duration-140 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-[0.96] motion-safe:data-starting-style:scale-[0.96] md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[92dvh] md:w-[min(94vw,52rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-3xl md:border-2 md:border-navy">
          {src && <Editor key={src} src={src} onCancel={onCancel} onDone={onDone} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Editor({
  src,
  onCancel,
  onDone,
}: {
  src: string;
  onCancel: () => void;
  onDone: (file: File) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<"crop" | "adjust">("crop");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [turns, setTurns] = useState(0);
  const [straighten, setStraighten] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null);
  const [adjustments, setAdjustments] = useState(NEUTRAL);
  const [media, setMedia] = useState<MediaSize | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const rotation = turns * 90 + straighten;
  const sideways = turns % 2 !== 0;
  const originalAspect = media
    ? sideways
      ? media.naturalHeight / media.naturalWidth
      : media.naturalWidth / media.naturalHeight
    : 1;
  const filter = `brightness(${adjustments.brightness}) contrast(${adjustments.contrast}) saturate(${adjustments.saturation})`;
  const percent = (value: number) => `${Math.round((value - 1) * 100) > 0 ? "+" : ""}${Math.round((value - 1) * 100)}%`;

  function reset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setTurns(0);
    setStraighten(0);
    setFlipX(false);
    setFlipY(false);
    setAspect(null);
    setAdjustments(NEUTRAL);
  }

  async function apply() {
    if (!area) return;
    setSaving(true);
    try {
      await onDone(await renderEdit({ src, area, rotation, flipX, flipY, adjustments }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-navy/10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <Dialog.Title className="font-display text-xl leading-tight font-extrabold">Edit image</Dialog.Title>
        <Button intent="ghost" size="sm" onClick={reset} disabled={saving}>
          Reset
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 bg-[length:20px_20px] bg-[conic-gradient(#efe3cf_25%,#fffaf2_0_50%,#efe3cf_0_75%,#fffaf2_0)] md:h-[min(52dvh,26rem)] md:flex-none">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect ?? originalAspect}
          minZoom={1}
          maxZoom={4}
          showGrid
          transform={`translate(${crop.x}px, ${crop.y}px) rotate(${rotation}deg) scale(${zoom * (flipX ? -1 : 1)}, ${zoom * (flipY ? -1 : 1)})`}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
          onMediaLoaded={setMedia}
          style={{
            mediaStyle: { filter },
            cropAreaStyle: { border: "2px solid #ffc62b", color: "rgb(42 38 112 / 0.45)" },
          }}
          mediaProps={{ crossOrigin: "anonymous" }}
        />
      </div>

      <div className="flex shrink-0 flex-col gap-3 overflow-y-auto border-t-2 border-navy/10 px-4 py-3">
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-navy bg-paper p-1">
          {(["crop", "adjust"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(chip, tab === t ? "bg-navy text-cream" : "hover:bg-navy/5")}
            >
              {t === "crop" ? "Crop & rotate" : "Adjust"}
            </button>
          ))}
        </div>

        {tab === "crop" ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {ASPECTS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  aria-pressed={aspect === a.value}
                  onClick={() => setAspect(a.value)}
                  className={cn(
                    chip,
                    "border-2",
                    aspect === a.value ? "border-navy bg-navy text-cream" : "border-navy/20 hover:border-navy",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Slider
                label="Zoom"
                value={zoom}
                min={1}
                max={4}
                step={0.01}
                format={(v) => `${v.toFixed(1)}×`}
                onChange={setZoom}
              />
              <Slider
                label="Straighten"
                value={straighten}
                min={-45}
                max={45}
                step={0.5}
                format={(v) => `${v > 0 ? "+" : ""}${v}°`}
                onChange={setStraighten}
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <Button intent="outline" size="sm" aria-label="Rotate left" onClick={() => setTurns((t) => (t + 3) % 4)}>
                ↺
              </Button>
              <Button intent="outline" size="sm" aria-label="Rotate right" onClick={() => setTurns((t) => (t + 1) % 4)}>
                ↻
              </Button>
              <Button
                intent="outline"
                size="sm"
                aria-label="Flip horizontally"
                aria-pressed={flipX}
                onClick={() => setFlipX((f) => !f)}
                className={cn(flipX && "bg-navy text-cream hover:bg-navy-soft")}
              >
                ⇆
              </Button>
              <Button
                intent="outline"
                size="sm"
                aria-label="Flip vertically"
                aria-pressed={flipY}
                onClick={() => setFlipY((f) => !f)}
                className={cn(flipY && "bg-navy text-cream hover:bg-navy-soft")}
              >
                ⇅
              </Button>
            </div>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {(["brightness", "contrast", "saturation"] as const).map((key) => (
              <Slider
                key={key}
                label={key[0]?.toUpperCase() + key.slice(1)}
                value={adjustments[key]}
                min={key === "saturation" ? 0 : 0.5}
                max={key === "saturation" ? 2 : 1.5}
                step={0.01}
                format={percent}
                onChange={(value) => setAdjustments((a) => ({ ...a, [key]: value }))}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t-2 border-navy/10 bg-cream/60 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button intent="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button intent="sun" onClick={apply} disabled={saving || !area}>
          {saving ? "Saving…" : "Use image"}
        </Button>
      </div>
    </>
  );
}
