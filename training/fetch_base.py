#!/usr/bin/env python3
"""Pobiera polski model bazowy Piper (checkpoint) do fine-tune'u."""
import os
import urllib.request

BASE = {
    "darkman-medium": "https://huggingface.co/datasets/rhasspy/piper-checkpoints/resolve/main/pl/pl_PL/darkman/medium/epoch%3D4909-step%3D1454360.ckpt",
    "gosia-medium": "https://huggingface.co/datasets/rhasspy/piper-checkpoints/resolve/main/pl/pl_PL/gosia/medium/epoch%3D5001-step%3D1457672.ckpt",
    "mc_speech-medium": "https://huggingface.co/datasets/rhasspy/piper-checkpoints/resolve/main/pl/pl_PL/mc_speech/medium/epoch%3D2531-step%3D1906774.ckpt",
}


def main() -> None:
    choice = os.environ.get("BASE_VOICE", "darkman-medium")
    url = BASE[choice]
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pretrained.ckpt")
    print(f"Pobieram model bazowy: {choice}")
    urllib.request.urlretrieve(url, out)
    print(f"Zapisano {out} ({os.path.getsize(out)} bajtów)")


if __name__ == "__main__":
    main()
