"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useModalA11y } from "@/lib/useModalA11y";

type Props = {
  onDetected: (barcode: string) => void;
  onClose: () => void;
};

const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
];

export default function Scanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  useModalA11y(containerRef, onClose);

  useEffect(() => {
    let cancelled = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 200 });

    async function start() {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current!,
          (result) => {
            if (result && !handledRef.current) {
              handledRef.current = true;
              // Brief haptic feedback on supported devices.
              navigator.vibrate?.(60);
              onDetected(result.getText());
            }
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e) {
        if (cancelled) return;
        const err = e as Error;
        if (err.name === "NotAllowedError") {
          setError("Camera permission denied. Enable it in your browser, or type the barcode below.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found. Type the barcode below instead.");
        } else {
          setError(`Could not start camera: ${err.message}. Type the barcode below instead.`);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manual.trim();
    if (code) onDetected(code);
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="flex items-center justify-between p-4 text-white">
        <h2 id="scanner-title" className="text-lg font-semibold">Scan a barcode</h2>
        <button
          onClick={onClose}
          className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium active:bg-white/25"
        >
          Cancel
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {/* Reticle */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-72 max-w-[80%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <div role="alert" className="absolute inset-x-0 top-0 m-4 rounded-lg bg-red-600 p-3 text-sm text-white">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={submitManual} className="flex gap-2 bg-black p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          inputMode="numeric"
          aria-label="Barcode or UPC"
          placeholder="…or type a barcode / UPC"
          className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-3 text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white active:bg-green-700"
        >
          Use
        </button>
      </form>
    </div>
  );
}
