#!/usr/bin/env python3
"""Diagnostyka pobierania checkpointu Piper z HF — zapisuje training/diag.txt."""
import subprocess

FN = "pl/pl_PL/darkman/medium/epoch=4909-step=1454360.ckpt"
URL = f"https://huggingface.co/datasets/rhasspy/piper-checkpoints/resolve/main/{FN}"
lines = []

r = subprocess.run(["curl", "-sIL", "-A", "Mozilla/5.0", URL], capture_output=True, text=True)
lines.append("=== curl -I (headers) ===\n" + r.stdout + "\n" + r.stderr)

r2 = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-L", "-A", "Mozilla/5.0", URL],
                    capture_output=True, text=True)
lines.append("=== final http_code ===\n" + r2.stdout)

try:
    from huggingface_hub import hf_hub_download

    p = hf_hub_download("rhasspy/piper-checkpoints", FN, repo_type="dataset")
    lines.append(f"=== hf_hub_download OK ===\n{p}")
except Exception as e:  # noqa: BLE001
    lines.append(f"=== hf_hub_download ERR ===\n{e!r}")

text = "\n".join(lines)
open("training/diag.txt", "w").write(text)
print(text)
