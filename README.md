# Zayra — profesjonalna asystentka głosowa AI

Zayra to asystentka, z którą **rozmawiasz głosem po polsku**. Mówisz — ona słucha, myśli i odpowiada na głos.
Zaprojektowana na **tablet z Androidem**: duże cele dotykowe, tryb głośnomówiący, praca jako aplikacja
instalowana z ekranu głównego (PWA) lub jako APK.

Działa w dwóch trybach:

| Tryb | Kiedy | Co robi |
|---|---|---|
| **Demo** | brak klucza API | odpowiada przykładowo i prowadzi do konfiguracji — nic nie udaje |
| **Model** | klucz Groq / Gemini / OpenRouter / Ollama | prawdziwa rozmowa, strumieniowanie odpowiedzi, mowa |

---

## 1. Szybki start (5 minut)

### a) Uruchom lokalnie

```bash
npm install
npm run dev          # http://localhost:3000
```

### b) Podłącz darmowy model

Aplikacja startuje w trybie demo. Żeby Zayra zaczęła naprawdę myśleć, masz dwie drogi:

**Droga 1 — klucz w aplikacji (najprostsza, bez wdrożenia)**

1. Wejdź na [console.groq.com/keys](https://console.groq.com/keys) i utwórz darmowy klucz (bez karty).
2. W Zayrze: ⚙️ **Ustawienia → Model → Groq** → wklej klucz → **Zapisz model**.
3. Klucz zostaje na tablecie (localStorage) i jest wysyłany wyłącznie do Groq.

**Droga 2 — klucz na serwerze (dla całej rodziny / kilku urządzeń)**

```bash
cp .env.example .env.local
# wpisz GROQ_API_KEY=... w .env.local
npm run dev
```

### c) Wdróż na Vercel i zainstaluj na tablecie

```bash
npx vercel --prod
```

Potem na tablecie otwórz adres w **Chrome** → menu ⋮ → **Dodaj do ekranu głównego**.
Zayra uruchomi się pełnoekranowo z własną ikoną — jak zwykła aplikacja.

> **Ważne:** mikrofon działa tylko przez HTTPS (albo localhost). Adres z Vercela ma HTTPS, więc
> rozpoznawanie mowy zadziała. W podglądzie w sandboxie mikrofon może być zablokowany —
> to ograniczenie przeglądarki, nie aplikacji.

---

## 2. Co Zayra potrafi

- **Rozmowa głosowa** — rozpoznawanie mowy `pl-PL`, polski głos z syntezatora systemowego, regulacja tempa.
- **Tryb głośnomówiący** — po odpowiedzi sama włącza mikrofon; rozmawiasz bez dotykania tabletu.
- **Przerywanie** — jedno tapnięcie kuli przerywa mówienie Zayry.
- **Trzy tryby pracy** — `Auto`, `Praca`, `Osobiste`. Każdy ma własny zakres, przykładowe polecenia i priorytety.
- **Ton profesjonalny i konkretny** — bez wypełniaczy, bez chwalenia pytań, bez tłumaczenia podstaw.
  Zayra traktuje Cię jak kompetentnego dorosłego: jeśli używasz specjalistycznego języka, odpowiada na tym samym poziomie.
- **Forma zwracania się** — **„Szefie"** (domyślna), „Pani / Pan" albo „na Ty".
- **Pamięć trwała** — powiedz *„zapamiętaj, że mam spotkania w poniedziałki"*, a Zayra zapisze to na stałe.
  Pamięcią zarządzasz w **Ustawienia → Profil i pamięć**.
- **Profil użytkownika** — krótki opis („prowadzę firmę, wolę konkrety") trafia do kontekstu każdej rozmowy.
- **Historia rozmów** — zapisywana na urządzeniu, eksport do pliku Markdown.
- **Offline shell** — interfejs ładuje się bez internetu (service worker); model wymaga sieci.
- **Prywatność** — brak kont, brak analityki, brak własnego backendu z danymi. Rozmowy zostają na tablecie.

---

## 3. Głos — jak to działa

| Warstwa | Technologia | Uwagi |
|---|---|---|
| Rozpoznawanie mowy | Web Speech API (`SpeechRecognition`, `pl-PL`) | Chrome / Edge / Samsung Internet na Androidzie |
| Synteza mowy | Web Speech API (`speechSynthesis`) | używa głosu systemowego, także offline |

**Żeby Zayra mówiła po polsku**, w Androidzie zainstaluj polski głos:
`Ustawienia → Dostępność → Zamiana tekstu na mowę → preferowany silnik → język polski`.
W aplikacji wybierz go w **Ustawienia → Głos**.

Aplikacja nie wysyła dźwięku do żadnego serwera — rozpoznawanie odbywa się w przeglądarce.

---

## 4. Obsługiwane modele (wszystkie darmowe)

| Dostawca | Domyślny model | Klucz | Charakter |
|---|---|---|---|
| **Groq** | `llama-3.3-70b-versatile` | [console.groq.com/keys](https://console.groq.com/keys) | najszybszy, świetny do głosu |
| **Google Gemini** | `gemini-2.5-flash` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | hojne limity, dobra polszczyzna |
| **OpenRouter** | `meta-llama/llama-3.3-70b-instruct:free` | [openrouter.ai/keys](https://openrouter.ai/keys) | wybór modeli (`:free`) |
| **Własny serwer** | `llama3.1` | — | Ollama / LM Studio, 100% lokalnie |

Model i dostawcę zmieniasz bez przebudowy aplikacji — w Ustawieniach lub zmienną `AI_MODEL`.
Klucz na serwerze ma pierwszeństwo dopiero wtedy, gdy na tablecie nie ma zapisanego klucza.

---

## 5. Aplikacja APK (opcjonalnie)

Repozytorium ma gotowy workflow `.github/workflows/android.yml`, który buduje plik APK w chmurze
(nie musisz instalować Android Studio).

1. Wdróż aplikację na Vercel i skopiuj adres.
2. W GitHubie: **Settings → Secrets → Actions** → dodaj `ZAYRA_URL` = Twój adres.
3. **Actions → „Zbuduj APK Zayry" → Run workflow**.
4. Pobierz `zayra-apk` z artefaktów i zainstaluj na tablecie (trzeba zezwolić na instalację z nieznanych źródeł).

To „shell" Capacitora ładujący Twoją aplikację webową — dzięki temu zawsze masz najnowszą wersję
bez reinstalacji. Lokalnie: `npx cap add android && npx cap sync android && npx cap open android`.

---

## 6. Struktura projektu

```
app/
  page.tsx              główny ekran (orkiestracja stanu, głos, skróty)
  layout.tsx            metadane PWA, rejestracja service workera
  globals.css           design system Zayry
  api/chat/route.ts     proxy do modelu (klucz może zostać na serwerze)
  api/config/route.ts   informuje aplikację, czy serwer ma klucz
components/
  Orb.tsx               kula głosowa (idle / słucham / myślę / mówię)
  Thread.tsx            wątek rozmowy, podpowiedzi startowe
  Composer.tsx          pasek pisania
  SettingsPanel.tsx     model, głos, profil, pamięć
  Icons.tsx             ikony SVG (bez zależności)
hooks/
  useSpeech.ts          rozpoznawanie + synteza mowy, tryb głośnomówiący
  useZayra.ts           stan rozmowy, strumieniowanie, pamięć, tryb demo
lib/
  persona.ts            CHARAKTER ZAYRY — tu zmieniasz jej osobowość i zasady
  providers.ts          Groq / Gemini / OpenRouter / własny serwer (SSE)
  chat.ts               wybór ścieżki: tablet → serwer
  storage.ts            localStorage: ustawienia, historia, pamięć
  demo.ts               uczciwe odpowiedzi bez modelu
  types.ts              typy współdzielone
```

### Chcesz zmienić charakter Zayry?

Cały jej „charakter" jest w **`lib/persona.ts`**:
`CORE` (kim jest i jak mówi), `ADDRESS` (forma zwracania się), `MODES` (praca / osobiste), `greeting()`, `SUGGESTIONS`.
Zmień tekst, odśwież stronę — reszta aplikacji nie wymaga modyfikacji.

Aktualne ustawienie domyślne: **„Szefie" + ton profesjonalny i konkretny**.
„Panie"/„na Ty" wybierzesz w **Ustawienia → Profil i pamięć → Forma zwracania się**.

---

## 7. Skróty i gesty

| Akcja | Efekt |
|---|---|
| Kula głosowa / przycisk mikrofonu | start i stop mówienia |
| `Spacja` (poza polem tekstowym) | to samo co kula |
| `Enter` w polu tekstowym | wyślij |
| `Shift+Enter` | nowa linia |
| `Esc` | zamknij ustawienia / przerwij mówienie |
| Tapnięcie kuli podczas mówienia Zayry | przerwanie odpowiedzi |

---

## 8. Wymagania i ograniczenia

- **Przeglądarka:** Chrome / Edge / Samsung Internet (Android), Chrome (desktop). Safari na iOS ma
  ograniczone wsparcie rozpoznawania mowy.
- Zayra nie ma dostępu do internetu „na żywo" (nie czyta wiadomości ani kursów walut) — model odpowiada
  z wiedzy własnej i uczciwie mówi, gdy czegoś nie wie.
- Nie ma jeszcze integracji z kalendarzem i pocztą — to naturalny następny krok (Google Calendar / Gmail API).
- Historia i pamięć są per urządzenie (localStorage). Synchronizacja między tabletem a telefonem wymaga
  podłączenia bazy (Supabase jest gotowy do dodania).

---

## 9. Skrypty

```bash
npm run dev      # tryb developerski (0.0.0.0:3000)
npm run build    # build produkcyjny
npm start        # serwer produkcyjny
npm run lint     # kontrola typów (tsc --noEmit)
npm run icons    # regeneracja ikon z public/icons/logo.svg
```

---

Zayra mówi po polsku, ale kod, nazwy zmiennych i commity są po angielsku — standard branżowy.
