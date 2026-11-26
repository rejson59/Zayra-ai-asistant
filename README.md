# Zayra

Moja osobista asystentka głosowa. Minimalistyczny interfejs: jedna fala, jeden akcent, zero szablonowego „AI slop”.

## Stack

Vite + React + TypeScript · Tailwind v4 · Motion · Lucide · Canvas 2D

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
- **Serce interfejsu**: 9 słupków-pigułek, przez które płynie fala od lewej do prawej.
- **Stany**: gotowa → słucham → myślę → mówię.

## Audio (bez klucza API)

- **Mikrofon**: Web Audio API (`AnalyserNode`) — fala reaguje na prawdziwy głos w czasie rzeczywistym (RMS + pasma logarytmiczne). cisza ~2,4 s po wykryciu mowy kończy słuchanie.
- **Głos Zayry**: `speechSynthesis` przeglądarki (pl-PL), napisy synchronizowane ze słowami (`onboundary`); obwiednia fali podszywana pod słowa.
- **Fallback**: gdy brak mikrofonu / TTS — płynna symulacja sylabiczna.
- „Mózg” (LLM) wciąż demo — zdanie jest przykładowe; API podłączymy później.

> Jeśli mikrofon jest zablokowany w osadzonym podglądzie, otwórz podgląd w nowej karcie i zezwól na mikrofon.

## Skróty

`Spacja` rozmowa · `M` głos · `T` motyw · `C` napisy · `Esc` stop
