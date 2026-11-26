# 🎙️ Własny głos Zayry — darmowy pipeline (Colab → Piper → przeglądarka)

Cel: uzyskać **ulubiony / własny głos** dla Zayry **za darmo**, **bez płatnych API**, działający **na słabym sprzęcie** (w przeglądarce, na CPU, offline).

Droga: nagranie → fine‑tune **Piper** na darmowym **Google Colab (T4)** → eksport **ONNX** → wgranie do Zayry. Po treningu wszystko działa lokalnie.

## Czego potrzebujesz
- Konto Google (darmowy Colab z GPU T4).
- **10–30 minut** nagrania docelowego głosu.
- Przeglądarka (Chrome/Edge najlepiej — WASM + OPFS).

## Krok 1 — nagraj głos
- Ciche pomieszczenie, bez muzyki / pogłosu, jeden mówca.
- Format: **WAV, mono, 22050 Hz, 16‑bit**.
- Podziel na pliki **3–12 s**, nazwij `1.wav`, `2.wav`, `3.wav`…
- Spakuj wszystkie do **`wavs.zip`**.
- Im więcej czystych danych (20–30 min), tym lepszy głos.

## Krok 2 — wrzuć na Drive
Wgraj `wavs.zip` na swój Google Drive (domyślnie notebook szuka `/content/drive/MyDrive/wavs.zip`). Można też wgrać zip bezpośrednio w notebooku.

## Krok 3 — uruchom notebook
Otwórz **`Zayra_Voice_Colab.ipynb`** w Google Colab:
1. **Runtime → Change runtime type → T4 GPU**.
2. Uruchamiaj komórki po kolei:
   - instalacja Piper + zależności,
   - pobranie polskiego modelu bazowego (`gosia` / `darkman` / `mc_speech`),
   - dataset + transkrypcja **Whisper** (po polsku),
   - preprocess + **trening (fine‑tune)**,
   - **eksport ONNX** + config.
3. W TensorBoard słuchaj próbek; zatrzymaj trening, gdy głos brzmi naturalnie (zwykle kilkaset–1000 epok).

## Krok 4 — pobierz pliki
Notebook pobierze **`zayra.onnx`** i **`zayra.onnx.json`** (i zapisze kopię na Drive).

## Krok 5 — wgraj do Zayry
1. W nagłówku Zayry kliknij ikonę **ustawień głosu** (suwaki).
2. Sekcja **Własny głos**: wgraj `zayra.onnx` + `zayra.onnx.json` → **Zainstaluj**.
3. **Posłuchaj** — test. Od teraz Zayra mówi tym głosem.

Model trafia do pamięci przeglądarki (OPFS) i działa **offline**; fala reaguje na **prawdziwe audio** tego głosu.

## Jakość — wskazówki
- Wybierz model bazowy zbliżony barwą (`gosia` żeński / `darkman` męski).
- Popraw transkrypcję w `metadata.csv`, jeśli Whisper się pomylił — czysty tekst = lepszy głos.
- Mało danych? Wydłuż trening i słuchaj próbek; nie przesadzaj z epokami, by nie „przetrenować".

## Prywatność i zgoda
- Klonuj **wyłącznie głosy za zgodą** — swój własny albo osoby, która się zgodziła.
- Cały trening i synteza są darmowe; Colab to jednorazowa moc obliczeniowa, **nie płatne API**. Po eksporcie nic nie wychodzi na zewnątrz.

## Alternatywy (gdy nie chcesz trenować)
- **Gotowe polskie głosy Piper** (`gosia`, `darkman`, `mc_speech`) — wybierzesz je w ustawieniach głosu, bez treningu.
- Klonowanie „od razu" z krótkiego klipu: **Pocket TTS** (CPU/przeglądarka) — ale **bez polskiego**; **XTTS‑v2** klonuje po polsku, lecz wymaga GPU. Dlatego dla polskiego + słabego CPU najlepszy jest fine‑tune Piper.
