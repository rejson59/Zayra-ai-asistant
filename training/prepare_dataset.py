#!/usr/bin/env python3
"""Przygotowuje dataset Piper z próbek w training/sample/.

Kroki: wczytanie audio -> mono -> resampling 22050 Hz -> normalizacja ->
przycięcie ciszy -> podział na pliki 3-12 s -> zapis WAV 16-bit PCM.
Uruchamiane lokalnie oraz w GitHub Actions. Nie wymaga GPU ani modeli.
"""
import os
import sys
import glob
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "sample")
OUT_DIR = os.path.join(os.path.dirname(__file__), "dataset", "wavs")
TARGET_SR = 22050
MAX_CHUNK = 10.0  # s
MIN_CHUNK = 3.0  # s


def to_mono_22050(path: str) -> np.ndarray:
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    if sr != TARGET_SR:
        g = np.gcd(sr, TARGET_SR)
        mono = resample_poly(mono, TARGET_SR // g, sr // g).astype("float32")
    return mono


def trim_silence(x: np.ndarray, sr: int, thresh: float = 0.01) -> np.ndarray:
    win = int(0.02 * sr)
    if len(x) < win:
        return x
    frames = x[: len(x) // win * win].reshape(-1, win)
    energy = np.sqrt(np.mean(frames**2, axis=1))
    voiced = np.where(energy > thresh)[0]
    if len(voiced) == 0:
        return x
    start = max(0, voiced[0] * win - win)
    end = min(len(x), (voiced[-1] + 2) * win)
    return x[start:end]


def normalize(x: np.ndarray, peak: float = 0.95) -> np.ndarray:
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def chunk(x: np.ndarray, sr: int) -> list:
    total = len(x) / sr
    if total <= MAX_CHUNK:
        return [x] if total >= MIN_CHUNK else []
    n = int(np.ceil(total / MAX_CHUNK))
    size = len(x) // n
    return [x[i * size : (i + 1) * size] for i in range(n) if len(x[i * size : (i + 1) * size]) / sr >= MIN_CHUNK]


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    for f in glob.glob(os.path.join(OUT_DIR, "*.wav")):
        os.remove(f)
    sources = []
    for ext in ("*.wav", "*.mp3", "*.ogg", "*.flac", "*.m4a", "*.opus"):
        sources += glob.glob(os.path.join(SAMPLE_DIR, ext))
    sources = sorted(sources)
    if not sources:
        print("Brak próbek w training/sample/ — wrzuć pliki audio.", file=sys.stderr)
        return 1
    idx = 1
    total_s = 0.0
    for src in sources:
        try:
            x = to_mono_22050(src)
        except Exception as e:  # noqa: BLE001
            print(f"Pominięto {src}: {e}", file=sys.stderr)
            continue
        x = normalize(trim_silence(x, TARGET_SR))
        for piece in chunk(x, TARGET_SR):
            out = os.path.join(OUT_DIR, f"{idx}.wav")
            sf.write(out, piece, TARGET_SR, subtype="PCM_16")
            total_s += len(piece) / TARGET_SR
            idx += 1
    print(f"Gotowe: {idx - 1} plików WAV, ~{total_s:.1f} s materiału w {OUT_DIR}")
    if total_s < 60:
        print("UWAGA: mało danych (<60 s). Głos będzie ograniczony — dodaj więcej nagrań dla lepszej jakości.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
