/**
 * Tryb demo — działa bez żadnego klucza API.
 * Zamiast udawać model, Zayra uczciwie mówi, że jest w trybie demo,
 * pokazuje przykładową odpowiedź i prowadzi do konfiguracji.
 */
import type { AddressForm, AssistantMode } from "./types";

const INTROS = [
  "Działam teraz w trybie demo, bez podłączonego modelu, więc nie mogę jeszcze myśleć samodzielnie.",
  "Jestem w trybie demo — nie mam jeszcze dostępu do modelu językowego.",
];

function lower(text: string) {
  return text.toLowerCase();
}

const SKILLS: { match: RegExp; sample: string }[] = [
  {
    match: /mail|e-mail|wiadomo|napisz do|korespond/i,
    sample:
      "W pełnej wersji napisałabym to tak: „Dzień dobry, chciałabym uprzejmie prosić o przesunięcie naszego spotkania na czwartek po południu. Propozycja wynika z kolizji w kalendarzu — pozostaję do dyspozycji w godzinach przez Panią wskazanych.”",
  },
  {
    match: /plan|dzie|tydzie|kalendar|prior|organi/i,
    sample:
      "W pełnej wersji ułożyłabym plan w trzech blokach: najpierw zadanie z twardym terminem, potem praca wymagająca skupienia, na końcu sprawy krótkie i administracyjne.",
  },
  {
    match: /stre|notat|spotkani/i,
    sample:
      "W pełnej wersji streściłabym notatki w pięciu punktach: decyzje, ustalenia, odpowiedzialni, terminy i sprawy otwarte.",
  },
  {
    match: /pomys|weekend|podróż|wakac|restaurac|ugotow|przepis/i,
    sample:
      "W pełnej wersji zaproponowałabym trzy opcje — spokojną, aktywną i lokalną — i dopasowała je do pogody oraz budżetu.",
  },
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function demoReply(userText: string, mode: AssistantMode, address: AddressForm = "boss"): string {
  const text = userText.trim();
  const vocative = address === "boss" ? "Szefie, " : "";
  const lowerFirst = (t: string) => (vocative ? t.charAt(0).toLowerCase() + t.slice(1) : t);
  const seed = text.length + text.charCodeAt(0 || 0);

  if (!text) {
    return `${vocative}jestem w trybie demo. Powiedz lub napisz, czego potrzebujesz, a podpowiem, jak to obsłużę po podłączeniu modelu.`;
  }

  const skill = SKILLS.find((s) => s.match.test(lower(text)));
  const intro = lowerFirst(pick(INTROS, seed));
  const modeLine =
    mode === "praca"
      ? "Tryb pracy jest już ustawiony."
      : mode === "osobiste"
        ? "Tryb osobisty jest już ustawiony."
        : "Tryb automatyczny jest już ustawiony.";

  const next =
    "Aby zacząć prawdziwą rozmowę, wejdź w Ustawienia i wklej darmowy klucz Groq albo Google Gemini. Zajmie to około minuty.";

  if (skill) {
    return `${vocative}${intro} ${skill.sample} ${next}`;
  }

  return `${vocative}usłyszałam: „${text.slice(0, 140)}${text.length > 140 ? "…" : ""}”. ${intro} ${modeLine} ${next}`;
}
