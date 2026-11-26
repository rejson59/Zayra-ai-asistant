#!/usr/bin/env python3
"""Diagnostyka: listuje prawdziwe checkpointy pl_PL w repo HF piper-checkpoints."""
lines = []
try:
    from huggingface_hub import list_repo_files

    files = list_repo_files("rhasspy/piper-checkpoints", repo_type="dataset")
    pl = [f for f in files if "pl_PL" in f]
    lines.append(f"=== total files: {len(files)}; pl_PL: {len(pl)} ===")
    lines.append("\n".join(pl))
except Exception as e:  # noqa: BLE001
    lines.append(f"=== list ERR ===\n{e!r}")

text = "\n".join(lines)
open("training/diag.txt", "w").write(text)
print(text)
