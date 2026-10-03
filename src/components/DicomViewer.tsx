import { useEffect, useRef, useState } from "react";
import dicomParser from "dicom-parser";
import { Contrast, RotateCw, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Slider } from "@/components/ui/slider";

type Parsed = {
  rows: number;
  cols: number;
  pixels: Float32Array;
  min: number;
  max: number;
  wc: number;
  ww: number;
  monochrome1: boolean;
  meta: { label: string; value: string }[];
};

// Non-PII tags only (G3): no patient name / ID / birth date are ever read.
const META_TAGS: [string, string][] = [
  ["x00080060", "Modalność"],
  ["x00080020", "Data badania"],
  ["x00180015", "Okolica"],
  ["x00080070", "Producent aparatu"],
  ["x00280030", "Rozdzielczość (mm/px)"],
];

function parse(buf: ArrayBuffer): Parsed {
  const ds = dicomParser.parseDicom(new Uint8Array(buf));
  const transfer = ds.string("x00020010") ?? "";
  const compressed = !["1.2.840.10008.1.2", "1.2.840.10008.1.2.1", "1.2.840.10008.1.2.2", ""].includes(transfer);
  if (compressed) throw new Error("Ten plik DICOM jest skompresowany (JPEG/JPEG2000). Pobierz go i otwórz w programie diagnostycznym.");
  const rows = ds.uint16("x00280010") ?? 0;
  const cols = ds.uint16("x00280011") ?? 0;
  const bits = ds.uint16("x00280100") ?? 16;
  const signed = ds.uint16("x00280103") === 1;
  const spp = ds.uint16("x00280002") ?? 1;
  const el = ds.elements["x7fe00010"];
  if (!rows || !cols || !el) throw new Error("Brak danych obrazu w pliku DICOM.");
  if (spp !== 1) throw new Error("Kolorowe pliki DICOM nie są jeszcze obsługiwane w podglądzie.");
  const slope = parseFloat(ds.string("x00281053") ?? "1") || 1;
  const intercept = parseFloat(ds.string("x00281052") ?? "0") || 0;
  const n = rows * cols;
  const src =
    bits <= 8
      ? new Uint8Array(ds.byteArray.buffer, ds.byteArray.byteOffset + el.dataOffset, n)
      : signed
        ? new Int16Array(ds.byteArray.buffer.slice(ds.byteArray.byteOffset + el.dataOffset, ds.byteArray.byteOffset + el.dataOffset + n * 2))
        : new Uint16Array(ds.byteArray.buffer.slice(ds.byteArray.byteOffset + el.dataOffset, ds.byteArray.byteOffset + el.dataOffset + n * 2));
  const pixels = new Float32Array(n);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = (src[i] ?? 0) * slope + intercept;
    pixels[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const wcTag = parseFloat((ds.string("x00281050") ?? "").split("\\")[0] ?? "");
  const wwTag = parseFloat((ds.string("x00281051") ?? "").split("\\")[0] ?? "");
  const meta = META_TAGS.map(([t, label]) => {
    let v = ds.string(t) ?? "";
    if (t === "x00080020" && v.length === 8) v = `${v.slice(6, 8)}.${v.slice(4, 6)}.${v.slice(0, 4)}`;
    if (t === "x00280030") v = v.replace("\\", " × ");
    return { label, value: v };
  }).filter((m) => m.value);
  meta.push({ label: "Wymiary", value: `${cols} × ${rows} px, ${bits} bit` });
  return {
    rows,
    cols,
    pixels,
    min,
    max,
    wc: Number.isFinite(wcTag) ? wcTag : (min + max) / 2,
    ww: Number.isFinite(wwTag) && wwTag > 0 ? wwTag : Math.max(1, max - min),
    monochrome1: ds.string("x00280004") === "MONOCHROME1",
    meta,
  };
}

/** M4b: native DICOM viewer — VOI windowing (W/L), presets, zoom/rotate, non-PII study info. */
export function DicomViewer({ src }: { src: string }) {
  const [data, setData] = useState<Parsed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wc, setWc] = useState(0);
  const [ww, setWw] = useState(1);
  const [invert, setInvert] = useState(false);
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    // Signed URL refreshes every 100 s — only parse once per file path.
    const key = src.split("?")[0] ?? src;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setErr(null);
    fetch(src, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Nie udało się pobrać pliku.");
        return r.arrayBuffer();
      })
      .then((b) => {
        const p = parse(b);
        setData(p);
        setWc(p.wc);
        setWw(p.ww);
      })
      .catch((e: Error) => setErr(e.message || "Nie udało się odczytać pliku DICOM."));
  }, [src]);

  useEffect(() => {
    if (!data || !canvas.current) return;
    const c = canvas.current;
    c.width = data.cols;
    c.height = data.rows;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(data.cols, data.rows);
    const lo = wc - ww / 2;
    const flip = data.monochrome1 !== invert;
    for (let i = 0; i < data.pixels.length; i++) {
      let g = ((data.pixels[i]! - lo) / ww) * 255;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      if (flip) g = 255 - g;
      const o = i * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [data, wc, ww, invert]);

  if (err) return <p className="p-6 text-sm text-muted-foreground">{err}</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Wczytywanie pliku DICOM…</p>;

  const range = Math.max(1, data.max - data.min);
  const presets = [
    { label: "Z pliku", wc: data.wc, ww: data.ww },
    { label: "Kość", wc: 500, ww: 2000 },
    { label: "Tkanki miękkie", wc: 40, ww: 400 },
    { label: "Pełny zakres", wc: (data.min + data.max) / 2, ww: range },
  ];
  const btn = "flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted";

  return (
    <div className="flex h-full min-h-[60vh] flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-foreground">
        <canvas
          ref={canvas}
          className="max-h-full max-w-full"
          style={{ transform: `scale(${scale}) rotate(${rot}deg)`, transition: "transform 120ms ease-out" }}
        />
        <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-0.5 text-xs tabular-nums">
          W {Math.round(ww)} / L {Math.round(wc)}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 border-t bg-card p-1">
        <button aria-label="Pomniejsz" className={btn} onClick={() => setScale((s) => Math.max(0.5, s / 1.25))}><ZoomOut className="h-4 w-4" /></button>
        <button aria-label="Powiększ" className={btn} onClick={() => setScale((s) => Math.min(8, s * 1.25))}><ZoomIn className="h-4 w-4" /></button>
        <button aria-label="Obróć" className={btn} onClick={() => setRot((r) => r + 90)}><RotateCw className="h-4 w-4" /></button>
        <button aria-label="Negatyw" aria-pressed={invert} className={`${btn} ${invert ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setInvert((v) => !v)}><Contrast className="h-4 w-4" /></button>
        <button aria-label="Resetuj" className={btn} onClick={() => { setScale(1); setRot(0); setWc(data.wc); setWw(data.ww); setInvert(false); }}><Maximize className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 border-t bg-card p-3 text-xs">
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <button key={p.label} className="rounded-full border px-3 py-1 hover:bg-muted" onClick={() => { setWc(p.wc); setWw(p.ww); }}>{p.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-3">Okno (W)
          <Slider className="flex-1" min={1} max={range * 2} step={Math.max(1, range / 500)} value={[ww]} onValueChange={(v) => setWw(v[0] ?? ww)} />
        </label>
        <label className="flex items-center gap-3">Poziom (L)
          <Slider className="flex-1" min={data.min - range / 2} max={data.max + range / 2} step={Math.max(1, range / 500)} value={[wc]} onValueChange={(v) => setWc(v[0] ?? wc)} />
        </label>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
          {data.meta.map((m) => (
            <div key={m.label} className="contents"><dt>{m.label}</dt><dd className="text-foreground">{m.value}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}
