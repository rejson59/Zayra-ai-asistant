#!/usr/bin/env python3
"""Pobiera polski model bazowy Piper (checkpoint) do fine-tune'u.

Używa huggingface_hub (odporne na przekierowania/CDN/User-Agent), z fallbackiem
na curl. Dzięki temu nie pada na gołym urllib, który HF potrafi odrzucić.
"""
import os
import shutil
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "pretrained.ckpt")

BASE = {
    "darkman-medium": "pl/pl_PL/darkman/medium/epoch=4909-step=1454360.ckpt",
    "gosia-medium": "pl/pl_PL/gosia/medium/epoch=5001-step=1457672.ckpt",
    "mc_speech-medium": "pl/pl_PL/mc_speech/medium/epoch=2531-step=1906774.ckpt",
}
REPO = "rhasspy/piper-checkpoints"


def main() -> None:
    choice = os.environ.get("BASE_VOICE", "darkman-medium")
    filename = BASE[choice]
    print(f"Pobieram model bazowy: {choice} ({filename})")
    try:
        from huggingface_hub import hf_hub_download

        path = hf_hub_download(repo_id=REPO, filename=filename, repo_type="dataset")
        shutil.copy(path, OUT)
    except Exception as e:  # noqa: BLE001
        print(f"hf_hub_download nie udał się ({e!r}) — próbuję curl…")
        url = f"https://huggingface.co/datasets/{REPO}/resolve/main/{filename}"
        subprocess.run(
            ["curl", "-fL", "--retry", "3", "-A", "Mozilla/5.0", "-o", OUT, url],
            check=True,
        )
    size = os.path.getsize(OUT)
    assert size > 1_000_000, f"Plik podejrzanie mały ({size} B) — pobieranie nieudane."
    print(f"Zapisano {OUT} ({size} bajtów)")


if __name__ == "__main__":
    main()
