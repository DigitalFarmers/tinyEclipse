"use client";

import { useCallback, useState, useRef } from "react";
import {
  Image as ImageIcon, Upload, Download, Trash2, CheckCircle,
  AlertTriangle, Zap, FileImage, ArrowRight,
} from "lucide-react";

interface CompressedFile {
  id: string;
  original: File;
  compressed: Blob | null;
  originalSize: number;
  compressedSize: number;
  savings: number;
  savingsPct: number;
  preview: string;
  status: "pending" | "compressing" | "done" | "error";
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      // Scale down if wider than maxWidth
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      ctx.drawImage(img, 0, 0, w, h);

      // Output as WebP if supported, fallback to JPEG
      const outputType = file.type === "image/png" ? "image/png" : "image/webp";
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        },
        outputType,
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export default function CompressorPage() {
  const [files, setFiles] = useState<CompressedFile[]>([]);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [quality, setQuality] = useState(0.82);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const imageFiles = Array.from(fileList).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const newFiles: CompressedFile[] = imageFiles.map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      original: f,
      compressed: null,
      originalSize: f.size,
      compressedSize: 0,
      savings: 0,
      savingsPct: 0,
      preview: URL.createObjectURL(f),
      status: "pending" as const,
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Auto-compress
    setProcessing(true);
    for (const cf of newFiles) {
      try {
        setFiles(prev => prev.map(f => f.id === cf.id ? { ...f, status: "compressing" } : f));
        const blob = await compressImage(cf.original, maxWidth, quality);
        const savings = cf.originalSize - blob.size;
        const pct = cf.originalSize > 0 ? Math.round((savings / cf.originalSize) * 100) : 0;
        setFiles(prev => prev.map(f => f.id === cf.id ? {
          ...f,
          compressed: blob,
          compressedSize: blob.size,
          savings: Math.max(0, savings),
          savingsPct: Math.max(0, pct),
          status: "done",
        } : f));
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.id === cf.id ? { ...f, status: "error", error: err.message } : f));
      }
    }
    setProcessing(false);
  }, [maxWidth, quality]);

  function downloadFile(cf: CompressedFile) {
    if (!cf.compressed) return;
    const ext = cf.original.type === "image/png" ? "png" : "webp";
    const name = cf.original.name.replace(/\.[^.]+$/, "") + `-compressed.${ext}`;
    const url = URL.createObjectURL(cf.compressed);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    files.filter(f => f.status === "done" && f.compressed).forEach(downloadFile);
  }

  function removeFile(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  function clearAll() {
    files.forEach(f => URL.revokeObjectURL(f.preview));
    setFiles([]);
  }

  const totalOriginal = files.reduce((s, f) => s + f.originalSize, 0);
  const totalCompressed = files.filter(f => f.status === "done").reduce((s, f) => s + f.compressedSize, 0);
  const totalSavings = totalOriginal - totalCompressed;
  const doneCount = files.filter(f => f.status === "done").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Zap className="h-6 w-6 text-brand-400" /> Image Compressor
          </h1>
          <p className="mt-0.5 text-sm text-white/40">
            Comprimeer afbeeldingen voor upload — bespaar server storage
          </p>
        </div>
        <div className="flex items-center gap-2">
          {files.length > 0 && (
            <>
              <button
                onClick={downloadAll}
                disabled={doneCount === 0}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" /> Download Alles ({doneCount})
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 transition hover:bg-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Wis
              </button>
            </>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/30">Max Breedte</label>
          <select
            value={maxWidth}
            onChange={(e) => setMaxWidth(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/70 outline-none"
          >
            <option value={3840} className="bg-brand-950">4K (3840px)</option>
            <option value={1920} className="bg-brand-950">Full HD (1920px)</option>
            <option value={1280} className="bg-brand-950">HD (1280px)</option>
            <option value={800} className="bg-brand-950">Web (800px)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-white/30">Kwaliteit</label>
          <input
            type="range"
            min={0.4}
            max={0.95}
            step={0.01}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-24 accent-brand-500"
          />
          <span className="text-xs text-white/50">{Math.round(quality * 100)}%</span>
        </div>
        <div className="text-[10px] text-white/20">
          Output: WebP (of PNG voor transparante afbeeldingen) · Geen externe API · Alles in de browser
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className="mt-6 cursor-pointer rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.01] p-12 text-center transition hover:border-brand-500/30 hover:bg-brand-500/[0.02]"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="mx-auto h-10 w-10 text-white/15" />
        <p className="mt-4 text-sm text-white/40">
          Sleep afbeeldingen hierheen of <span className="text-brand-400">klik om te selecteren</span>
        </p>
        <p className="mt-1 text-[10px] text-white/20">JPG, PNG, WebP · Onbeperkt aantal · Alles lokaal verwerkt</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Stats */}
      {files.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Bestanden</div>
            <p className="mt-1 text-2xl font-bold">{files.length}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Origineel</div>
            <p className="mt-1 text-2xl font-bold">{formatBytes(totalOriginal)}</p>
          </div>
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
            <div className="text-[10px] text-brand-400/60 uppercase tracking-wider">Gecomprimeerd</div>
            <p className="mt-1 text-2xl font-bold text-brand-400">{formatBytes(totalCompressed)}</p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="text-[10px] text-green-400/60 uppercase tracking-wider">Bespaard</div>
            <p className="mt-1 text-2xl font-bold text-green-400">
              {formatBytes(totalSavings)}
              {totalOriginal > 0 && (
                <span className="ml-1 text-sm font-normal">({Math.round((totalSavings / totalOriginal) * 100)}%)</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          {files.map((cf) => (
            <div
              key={cf.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                cf.status === "error"
                  ? "border-red-500/20 bg-red-500/[0.02]"
                  : cf.status === "done"
                  ? "border-green-500/10 bg-white/[0.02]"
                  : "border-white/5 bg-white/[0.02]"
              }`}
            >
              {/* Thumbnail */}
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
                <img src={cf.preview} alt="" className="h-full w-full object-cover" />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{cf.original.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/30">
                  <span>{formatBytes(cf.originalSize)}</span>
                  {cf.status === "done" && (
                    <>
                      <ArrowRight className="h-2.5 w-2.5" />
                      <span className="text-brand-400">{formatBytes(cf.compressedSize)}</span>
                      <span className="text-green-400">-{cf.savingsPct}%</span>
                    </>
                  )}
                  {cf.status === "compressing" && <span className="text-brand-400">Comprimeren...</span>}
                  {cf.status === "error" && <span className="text-red-400">{cf.error}</span>}
                </div>
              </div>

              {/* Status */}
              {cf.status === "compressing" && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
              )}
              {cf.status === "done" && (
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-400" />
              )}
              {cf.status === "error" && (
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                {cf.status === "done" && cf.compressed && (
                  <button
                    onClick={() => downloadFile(cf)}
                    className="rounded-lg bg-brand-500/10 p-1.5 text-brand-400 transition hover:bg-brand-500/20"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => removeFile(cf.id)}
                  className="rounded-lg bg-white/5 p-1.5 text-white/20 transition hover:bg-red-500/10 hover:text-red-400"
                  title="Verwijder"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && (
        <p className="mt-8 text-center text-[10px] text-white/15">
          100% browser-based · Geen data verlaat je computer · Geen externe API kosten
        </p>
      )}
    </div>
  );
}
