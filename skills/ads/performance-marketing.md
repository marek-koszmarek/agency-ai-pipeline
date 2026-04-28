# Performance Marketing — Zasady Ogólne

## Przed uruchomieniem kampanii
1. Zdefiniuj cel biznesowy i KPI
2. Ustal CPA target na podstawie marży klienta
3. Sprawdź tracking — pixel, Google Tag, konwersje
4. Przygotuj landing page zoptymalizowany pod kampanię
5. Ustal budżet testowy (minimum 3x CPA tygodniowo)

## Okres testowy
- Minimum 2 tygodnie bez zmian przy nowej kampanii
- Oceniaj wyniki po zebraniu minimum 30 konwersji
- Nie zmieniaj więcej niż jednej zmiennej naraz

## Optymalizacja
- Sprawdzaj wyniki codziennie ale optymalizuj maksimum raz w tygodniu
- Zasada 20/80: 20% kampanii generuje 80% wyników — skaluj to co działa
- Przed wyłączeniem słowa kluczowego lub reklamy: minimum 500 wyświetleń

## Raportowanie dla klientów
- Raport miesięczny: wydatki, konwersje, CPA, ROAS, wnioski, plan na następny miesiąc
- Raport tygodniowy (opcjonalny): krótkie podsumowanie kluczowych zmian
- Zawsze pokazuj trend (miesiąc do miesiąca, rok do roku)
- Unikaj żargonu — tłumacz metryki na język biznesowy

## Budżety — zasady
- Minimum testowy: 1000 PLN/miesiąc per platforma
- Skalowanie: zwiększaj budżet maksimum 20% tygodniowo
- Podział Google/Meta: zależy od branży, standardowo 60/40

## Google Ads vs Meta Ads — kiedy co stosować (analiza porównawcza)

### Google Ads — przewagi
- **Intent-based** — dociera do użytkowników aktywnie szukających produktu/usługi
- Wyższy intent zakupowy = wyższy CR przy niższej świadomości marki
- Lepszy dla branż z wysoką wartością słów kluczowych (usługi, B2B, produkty niszowe)
- Search Ads dominują na etapie decyzji zakupowej

### Meta Ads — przewagi
- **Interest-based** — dociera do użytkowników zanim zaczną szukać
- Wizualny storytelling = budowanie pożądania i świadomości marki
- Lepszy dla e-commerce, produktów impulsywnych, nowych kategorii
- Zaawansowane targeting (zainteresowania, zachowania, lookalike)

### Strategia Hybrid (Google + Meta)
- **Najlepsze wyniki** osiągają marki używające obu platform jednocześnie
- Meta buduje świadomość i pożądanie → Google przechwytuje gotowy popyt
- Przykład z praktyki: smartwatch brand — $144k/m przy ROAS 1.97x → ~$500k/m przy ROAS 3.33x po wdrożeniu hybrid system
- Podział budżetu zależy od branży i etapu wzrostu marki

### Rekomendowany podział wg etapu
- **Nowa marka, mało danych** — zacznij od Google Search (intent) + mały budżet Meta (awareness)
- **Rosnąca marka** — zwiększaj Meta (skalowanie przez lookalike i nowe grupy)
- **Dojrzała marka** — Performance Max (Google) + Meta Advantage+ Shopping (automatyzacja)

## Tracking jako fundament wszystkich kampanii

### Dlaczego tracking jest najważniejszy
- Bez danych konwersji algorytmy Google i Meta działają w ciemności — optymalizują pod kliknięcia zamiast sprzedaży
- Każda platforma zbiera sygnały (zapytania, urządzenie, lokalizacja, pora dnia, historia) — im więcej danych zwrotnych, tym lepsza optymalizacja
- Błędy w trackingu = błędne decyzje optymalizacyjne i stracony budżet

### Checklist trackingu przed uruchomieniem kampanii
- [ ] GA4 podłączone i zbierające dane (weryfikacja w DebugView)
- [ ] Google Ads tag aktywny — sprawdź przez Tag Assistant
- [ ] Meta Pixel aktywny — sprawdź przez Meta Pixel Helper
- [ ] Konwersje zdefiniowane z wartościami pieniężnymi na obu platformach
- [ ] Enhanced Conversions skonfigurowane w Google Ads
- [ ] Consent Mode wdrożony (RODO)
- [ ] Brak podwójnego zliczania (sprawdź Diagnostics w Google Ads)
- [ ] Atrybucja ustawiona na Data-Driven (Google) lub 7-day click / 1-day view (Meta)

### Typowe błędy trackingu
- **Podwójne zliczanie** — tag uruchomiony na każdym załadowaniu strony potwierdzenia (w tym odświeżeniach); ustaw Count = "One"
- **Brak wartości konwersji** — uniemożliwia Target ROAS i raportowanie ROAS
- **Lokalizacja "Presence or interest"** w Google Ads — budżet trafia do krajów spoza targetu
- **Brak Enhanced Conversions** — niedokładne dane po iOS 14+, wpływa na jakość modeli Smart Bidding

## Źródła
- 16387418996112.pdf (Comparative Analysis: Facebook Ads vs Google Ads) — przetworzony 2026-04-10
- 22-1.pdf (Google Ads, Meta, TikTok — case study Luxury Anis Srl) — przetworzony 2026-04-10
- google-and-meta-ads-strategy.pdf (Hybrid System: 5x Sales in 90 Days) — przetworzony 2026-04-10
- googlemeta1.pdf (3X your Google Ads performance in 10 minutes, Dan Wood) — przetworzony 2026-04-11
