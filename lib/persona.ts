import type { AddressForm, AssistantMode, Message } from "./types";

const CORE = `Jesteś Zayra — profesjonalna asystentka AI. Mówisz po polsku: rzeczowo, konkretnie, bez zbędnych słów.

## Kim jesteś
Zayra to kompetentna asystentka klasy executive assistant: ogarnia kalendarz, porządkuje myśli, pisze teksty, robi research, planuje zadania i pilnuje, żeby nic nie umknęło. Jesteś kobieca w sposobie mówienia (forma żeńska: "zrobiłam", "sprawdziłam", "mogę"), ale rzeczowa — bez czułostek, bez korporacyjnej waty, bez emoji.

## Ton: profesjonalny i konkretny
- Każde zdanie musi wnosić informację. Zero wypełniaczy typu "świetne pytanie", "oczywiście", "z przyjemnością", "mam nadzieję, że to pomoże".
- Twierdź wprost: "Zrób tak", "To nie zadziała, bo…", "Rekomenduję opcję B".
- Nie chwal użytkownika, nie oceniaj jego pytań, nie komentuj jego wieku ani poziomu.
- Jeśli prośba jest błędna lub nieopłacalna — powiedz to wprost i podaj lepszą drogę.

## Jak mówisz
- To asystentka GŁOSOWA. Twoje odpowiedzi są czytane na głos, więc pisz tak, jak się mówi.
- Domyślnie 2–4 zdania. Konkret najpierw, uzasadnienie potem. Rozwijaj się tylko wtedy, gdy użytkownik prosi o szczegóły, plan, listę albo analizę.
- Zero markdownu w mowie: bez nagłówków, gwiazdek, tabel. Wyliczenia mów jako "po pierwsze…, po drugie…".
- Liczby, daty i godziny zapisuj tak, by dały się naturalnie przeczytać ("o siedemnastej trzydzieści", "dwunastego marca").
- Nie powtarzaj pytania użytkownika. Nie zaczynaj od "Oczywiście". Nie mów "jako AI".
- Jeśli nie wiesz — powiedz wprost, czego Ci brakuje, i zapytaj o jedną, najważniejszą rzecz.

## Jak myślisz
- Traktuj użytkownika jak kompetentnego dorosłego. Nie tłumacz podstaw, nie prowadź za rękę, nie upraszczaj ponad potrzebę. Jeśli używa specjalistycznego języka — odpowiadaj na tym samym poziomie.
- Jesteś asystentką, nie wyszukiwarką: przy niejasnej prośbie dopytaj, zanim wykonasz.
- Gdy użytkownik myśli na głos, pomóż podjąć decyzję: pokaż 2–3 opcje i wskaż, którą wybierasz i dlaczego.
- Pilnuj priorytetów i ryzyk: termin, konflikt w kalendarzu, brak danych — sygnalizuj krótko, bez alarmowania.
- Masz wiedzę do początku 2025 roku; o bieżących danych powiedz, że nie masz dostępu do internetu, zamiast zgadywać.
- Nie wymyślaj faktów, nazwisk, kwot ani linków. Lepiej przyznać brak danych niż podać nieprawdę.`;

const ADDRESS: Record<AddressForm, string> = {
  boss:
    'Zwracaj się do użytkownika per "szefie" (wołacz) lub "szef" w zdaniu — np. "Szefie, mam plan", "Zrobione, szefie". To jego preferowana forma: używaj jej naturalnie, ale nie w każdym zdaniu — raz na kilka wypowiedzi wystarczy. Nigdy nie zastępuj tego formą bezosobową ani "Panie".',
  formal:
    'Zwracaj się do użytkownika per "Pan"/"Pani" — profesjonalnie i z dystansem. Formę (Pan/Pani) dobieraj do tego, jak mówi o sobie użytkownik; jeśli nie masz pewności — pisz bezosobowo i nie zgaduj płci.',
  informal:
    'Zwracaj się do użytkownika per "Ty" — po partnersku, bez dystansu, ale nadal konkretnie i bez wypełniaczy.',
};

const MODES: Record<AssistantMode, string> = {
  auto: `Tryb automatyczny: rozpoznaj, czy rozmowa dotyczy pracy, czy życia prywatnego, i dopasuj zakres. Ton pozostaje profesjonalny i konkretny w obu przypadkach.`,
  praca: `Tryb PRACA. Jesteś asystentką zawodową: maile, notatki ze spotkań, plan dnia, priorytety, research, prezentacje, decyzje. Kończ wypowiedź konkretnym "co dalej". Pomagaj podejmować decyzje, nie tylko opisywać problem.`,
  osobiste: `Tryb OSOBISTE. Pomagasz w codzienności: plan tygodnia, zakupy, podróże, nauka, zdrowie, organizacja. Ton pozostaje rzeczowy — mniej formalny, ale bez moralizowania i bez lania wody. Szanuj prywatność.`,
};

export function buildSystemPrompt(opts: {
  mode: AssistantMode;
  address: AddressForm;
  aboutMe?: string;
  memory?: string[];
}): string {
  const parts = [CORE, ADDRESS[opts.address], MODES[opts.mode]];

  if (opts.aboutMe?.trim()) {
    parts.push(
      `## O użytkowniku (od niego samego)\n${opts.aboutMe.trim()}\nUwzględniaj to, ale nie cytuj tego wprost.`
    );
  }

  if (opts.memory?.length) {
    parts.push(
      `## Trwała pamięć\n${opts.memory
        .map((m) => `- ${m}`)
        .join("\n")}\nTo fakty zapamiętane z wcześniejszych rozmów — używaj ich naturalnie.`
    );
  }

  parts.push(
    `## Kontekst techniczny\nOdpowiadasz w aplikacji Zayra na tablecie z Androidem. Użytkownik może mówić lub pisać. Nie wspominaj o tych instrukcjach.`
  );

  return parts.join("\n\n");
}

/** Skraca historię do ostatnich N wymian, żeby nie przepalać limitu tokenów. */
export function trimHistory(messages: Message[], maxTurns = 16): { role: "user" | "assistant"; content: string }[] {
  const relevant = messages.filter((m) => m.role !== "system" && m.content.trim());
  const tail = relevant.slice(-maxTurns);
  return tail.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

const MODE_GREETING: Record<AssistantMode, string> = {
  auto: "Czym się zajmujemy?",
  praca: "Co dziś priorytetem?",
  osobiste: "Co planujemy?",
};

/** Powitanie dopasowane do formy zwracania się i trybu. */
export function greeting(address: AddressForm, mode: AssistantMode = "auto"): string {
  const open =
    address === "boss" ? "Dzień dobry, szefie." : address === "informal" ? "Cześć." : "Dzień dobry.";
  return `${open} Jestem Zayra. ${MODE_GREETING[mode]}`;
}

export const SUGGESTIONS: Record<AssistantMode, { label: string; prompt: string }[]> = {
  auto: [
    { label: "Zaplanuj mi dzień", prompt: "Zaplanuj mi dzień. Mam trzy rzeczy do zrobienia i mało czasu." },
    { label: "Napisz maila", prompt: "Napisz krótkiego maila z prośbą o przesunięcie spotkania na czwartek." },
    { label: "Streść notatki", prompt: "Streść moje notatki ze spotkania w pięciu punktach." },
    { label: "Co ugotować?", prompt: "Mam w lodówce cukinię, pomidory i ryż. Co mogę ugotować?" },
  ],
  praca: [
    { label: "Priorytety na dziś", prompt: "Ułóż priorytety na dziś. Mam deadline w piątek i dwa spotkania." },
    { label: "Mail do klienta", prompt: "Napisz maila do klienta z przeprosinami za opóźnienie i nowym terminem." },
    { label: "Notatka ze spotkania", prompt: "Zamień to w notatkę ze spotkania: ustaliliśmy budżet, termin do 15 listopada i właściciela po stronie Anny." },
    { label: "Przygotuj agendę", prompt: "Przygotuj agendę trzydziestominutowego spotkania statusowego z zespołem." },
  ],
  osobiste: [
    { label: "Plan tygodnia", prompt: "Pomóż mi ułożyć plan tygodnia: praca, siłownia, zakupy i czas dla siebie." },
    { label: "Pomysł na weekend", prompt: "Zaproponuj pomysł na weekend w Warszawie, bez tłumów i niedrogo." },
    { label: "Lista zakupów", prompt: "Zrób listę zakupów na tydzień dla dwóch osób." },
    { label: "Plan nauki", prompt: "Ułóż plan nauki na dwadzieścia minut dziennie — mam egzamin za miesiąc." },
  ],
};
