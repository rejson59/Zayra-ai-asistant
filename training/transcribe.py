#!/usr/bin/env python3
"""Transkrypcja datasetu Whisperem (polski) -> metadata.csv. Działa na CPU."""
import os
import re
import glob
import torch
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
DS = os.path.join(HERE, "dataset")


def main() -> None:
    wavs = sorted(
        glob.glob(os.path.join(DS, "wavs", "*.wav")),
        key=lambda p: int(re.findall(r"\d+", os.path.basename(p))[0]),
    )
    assert wavs, "Brak plików WAV — uruchom najpierw prepare_dataset.py"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    size = os.environ.get("WHISPER_MODEL", "medium")
    print(f"Whisper {size} na {device}")
    model = WhisperModel(size, device=device, compute_type="float16" if device == "cuda" else "int8")
    with open(os.path.join(DS, "metadata.csv"), "w", encoding="utf-8") as meta:
        for w in wavs:
            segments, _ = model.transcribe(w, language="pl")
            text = " ".join(s.text for s in segments).strip().replace("\n", " ")
            meta.write(f"{os.path.basename(w)}|{text}\n")
            print(f"  {os.path.basename(w)} -> {text}")
    print("metadata.csv gotowy.")


if __name__ == "__main__":
    main()
