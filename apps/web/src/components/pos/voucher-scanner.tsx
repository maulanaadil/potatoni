"use client";

import type { BarcodeDetector as PonyfillDetector } from "barcode-detector/ponyfill";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type Detector = Pick<PonyfillDetector, "detect">;

/** A voucher QR holds the bare code; the voucher page URL (/v/voucher/PTN-…) works too. */
export function extractVoucherCode(raw: string) {
  return raw.toUpperCase().match(/PTN-[A-HJ-NP-Z2-9]{6}/)?.[0] ?? null;
}

/**
 * Native BarcodeDetector where the browser has it (Chrome/Android); otherwise the ZXing
 * WebAssembly ponyfill (iPhone Safari), loaded on demand and served from our own domain.
 */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: typeof PonyfillDetector }).BarcodeDetector;
  if (Native && (await Native.getSupportedFormats()).includes("qr_code")) {
    return new Native({ formats: ["qr_code"] });
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/wasm/${path}` : prefix + path),
    },
  });
  return new BarcodeDetector({ formats: ["qr_code"] });
}

/** Turns the camera (and its indicator light) off. */
function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

type CameraState = "starting" | "scanning" | "denied" | "no-camera" | "unsupported" | "error";

const MESSAGES: Record<Exclude<CameraState, "scanning">, string> = {
  starting: "Opening the camera…",
  denied:
    "Camera access is blocked. Allow the camera for this site in your browser settings, or type the code instead.",
  "no-camera": "No camera was found on this device. Type the code instead.",
  unsupported: "This browser can't open the camera. Type the code instead.",
  error: "The camera couldn't start. Close other apps using it and try again, or type the code instead.",
};

/** Live camera view; mounted only while the dialog is open so the camera always turns off. */
function CameraView({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [state, setState] = useState<CameraState>("starting");

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return setState("unsupported");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        const name = (err as DOMException).name;
        return setState(name === "NotAllowedError" ? "denied" : name === "NotFoundError" ? "no-camera" : "error");
      }
      if (stopped || !video.current) return stopTracks(stream);
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});

      let detector: Detector;
      try {
        detector = await createDetector();
      } catch {
        return setState("unsupported");
      }
      if (stopped) return;
      setState("scanning");

      const scan = async () => {
        const el = video.current;
        if (stopped || !el) return;
        if (el.readyState >= 2) {
          const found = await detector.detect(el).catch(() => []);
          for (const result of found) {
            const code = extractVoucherCode(result.rawValue);
            if (code) {
              stopped = true;
              navigator.vibrate?.(40);
              onCodeRef.current(code);
              return;
            }
          }
        }
        timer = setTimeout(scan, 150);
      };
      void scan();
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      if (stream) stopTracks(stream);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border-2 border-navy bg-navy">
        <video ref={video} playsInline muted className="size-full object-cover" />
        {/* Static viewfinder: the camera feed is the motion, the frame stays still. */}
        <div aria-hidden className="pointer-events-none absolute inset-[18%]">
          <span className="absolute top-0 left-0 size-8 rounded-tl-2xl border-t-4 border-l-4 border-sun" />
          <span className="absolute top-0 right-0 size-8 rounded-tr-2xl border-t-4 border-r-4 border-sun" />
          <span className="absolute bottom-0 left-0 size-8 rounded-bl-2xl border-b-4 border-l-4 border-sun" />
          <span className="absolute right-0 bottom-0 size-8 rounded-br-2xl border-r-4 border-b-4 border-sun" />
        </div>
        {state !== "scanning" && (
          <div className="absolute inset-0 grid place-items-center bg-navy/85 p-6 text-center text-sm font-bold text-cream">
            {MESSAGES[state]}
          </div>
        )}
      </div>
      <p className="text-center text-sm font-semibold text-navy-soft">
        Point the camera at the QR on the customer&apos;s voucher (screen or email). A USB or Bluetooth scanner can also
        type straight into the code box.
      </p>
    </div>
  );
}

export function VoucherScanner({
  open,
  onOpenChange,
  onCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCode: (code: string) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Scan voucher"
      description="The code is filled in as soon as the QR is read."
      footer={
        <Button intent="outline" className="w-full" onClick={() => onOpenChange(false)}>
          Type the code instead
        </Button>
      }
    >
      {open && <CameraView onCode={onCode} />}
    </Dialog>
  );
}
