# Zayra

Moja osobista asystentka głosowa. Minimalistyczny interfejs: jedna fala, jeden akcent, zero szablonowego „AI slop”.

## Stack

Vite + React + TypeScript · Tailwind v4 · Motion · Lucide · Canvas 2D · Web Audio API · Piper (WASM/ONNX)

## Start

```bash
npm install
npm run dev
```

## Design

- **Motywy**: ciepły grafit / papierowa biel, płynne przenikanie (CSS + canvas).
- **Akcent**: jeden chłodny błękit, żadnych gradientów.
- **Zaokrąglenia**: pigułki i miękkie 24 px.
- **Ikony zamiast etykiet** — nazwy dopiero w tooltipach.
- **Serce interfejsu**: 9 słupków-pigułek, przez które płynie organiczna fala od lewej do prawej (tempo napędzane głośnością).
- **Stany**: gotowa → słucham → myślę → mówię.

## Audio (bez płatnych API)

- **Mikrofon**: Web Audio API (`AnalyserNode`) — fala reaguje na prawdziwy głos w czasie rzeczywistym. Cisza ~2,4 s po wykryciu mowy kończy słuchanie.
- **Głos Zayry — Piper**: lokalny syntezator neuronowy w przeglądarce (`@diffusionstudio/vits-web`, ONNX Runtime Web). Działa na CPU, offline po pobraniu modelu (cache OPFS). Fala reaguje na **prawdziwe audio** głosu Zayry.
  - Gotowe polskie głosy: `gosia`, `darkman`, `mc_speech`.
  - **Własny głos**: wgraj `model.onnx` + `model.onnx.json` w ustawieniach głosu.
  - Fallback: `speechSynthesis` przeglądarki, gdy Piper niedostępny.
- **„Mózg” (LLM)**: wciąż demo (przykładowe zdanie) — API podłączymy później.

## Własny głos (darmowy trening)

Patrz **[`training/README.md`](training/README.md)** oraz notebook **`training/Zayra_Voice_Colab.ipynb`**:
nagranie → fine‑tune Piper na darmowym Colab (T4) → eksport ONNX → wgranie do Zayry. Po treningu głos działa lokalnie na słabym CPU, offline, bez API.

> Klonuj wyłącznie głosy za zgodą. Jeśli mikrofon jest zablokowany w osadzonym podglądzie, otwórz podgląd w nowej karcie.

## Skróty

`Spacja` rozmowa · `M` głos · `T` motyw · `C` napisy · `Esc` stop
