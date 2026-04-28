# Google Ads — Baza Wiedzy

## Struktura kampanii (najlepsze praktyki)
- 1 kampania = 1 cel biznesowy
- 1 grupa reklam = 1 temat słów kluczowych (SKAG lub STAG)
- Minimum 3 reklamy na grupę reklam do testów A/B
- RSA (Responsive Search Ads) jako standard — minimum 8-10 nagłówków, 4 opisy

## Typy dopasowania słów kluczowych
- Exact match [słowo] — najwyższa kontrola, niższy zasięg
- Phrase match "słowo" — balans kontroli i zasięgu
- Broad match słowo — największy zasięg, wymaga silnych sygnałów konwersji i Smart Bidding

## Strategie ustalania stawek
- Maximize Conversions — gdy masz minimum 30 konwersji/miesiąc
- Target CPA — gdy masz stabilne dane konwersji (min. 50/miesiąc)
- Target ROAS — dla e-commerce z danymi o wartości konwersji
- Manual CPC — dla nowych kampanii bez danych historycznych
- Maximize Clicks — dla kampanii brandingowych lub budowania ruchu

## Kluczowe metryki
- CTR benchmark Search: 3-5% (dobry), powyżej 8% (bardzo dobry)
- Quality Score: cel minimum 7/10
- Impression Share: cel powyżej 60% dla kampanii głównych
- ROAS benchmark e-commerce: minimum 400%
- CPA — indywidualny dla każdego klienta na podstawie marży

## Słowa kluczowe wykluczające (must-have)
Zawsze dodawaj do nowych kampanii:
- darmowy, free, gratis, praca, job, opinie negatywne branżowe

## Performance Max
- Używaj gdy masz dane konwersji z minimum 6 tygodni
- Zawsze dodaj brand exclusions dla kampanii non-brand
- Asset groups: minimum 4 nagłówki, 4 opisy, 3 obrazy landscape, 3 square, 1 logo
- Monitoruj search terms report tygodniowo

## Audyt kampanii — checklist
- [ ] Quality Score wszystkich słów kluczowych
- [ ] Impression Share i powody utraty
- [ ] CTR vs benchmark branżowy
- [ ] Konwersje i ścieżki atrybucji
- [ ] Budżety vs wydatki (underspend/overspend)
- [ ] Słowa kluczowe bez konwersji powyżej 2x CPA
- [ ] Reklamy z niskim Ad Strength

## Data Check-Up — konfiguracja konta (e-commerce / Shopify)

### 1. Essentials — integracje
- Podłącz **GA4** do Google Ads (Data Manager → Google Analytics)
- Podłącz **Merchant Center** do Google Ads
- Podłącz **Search Console** do Google Ads
- Zaimportuj listę klientów z Shopify jako Customer Match audience
- Sprawdź **Audience Manager** — czy segmenty są aktywne i zbierają dane

### 2. Konwersje — konfiguracja krytyczna
- Skonfiguruj konwersje w Goals → Conversions → Summary
- **Primary vs Secondary**: tylko Primary konwersje wpływają na Smart Bidding — nie ustawiaj "Add to Cart" jako Primary jeśli masz Purchase
- **Attribution**: zmień z Last Click na **Data-Driven** — lepiej odzwierciedla rzeczywisty wpływ kanałów
- **Count**: dla zakupów ustaw "One" (nie "Every") — unikasz liczenia kilkukrotnego odświeżenia strony potwierdzenia
- **Value**: zawsze przypisuj wartość konwersji — bez tego Target ROAS nie działa
- **Window**: domyślne okno konwersji to 30 dni dla kliknięć, 1 dzień dla view-through — dostosuj do cyklu zakupowego klienta
- Sprawdź zakładkę **Webpages** przy każdej konwersji — jeśli widzisz wiele URLi z "Recording conversions: 2+" masz podwójne zliczanie
- Włącz **Consent Mode** (Goals → Settings → Measurement → Consent)
- Skonfiguruj **Enhanced Conversions** — Google mocno to rekomenduje; brak Enhanced Conversions = niedokładne śledzenie, szczególnie po iOS 14+; sprawdź zakładkę "Diagnostics" czy nie ma "Needs attention"

### 3. Dynamic Remarketing
- Dynamic Remarketing pozwala wyświetlać użytkownikom dokładnie te produkty, które oglądali
- Sprawdź Audience Manager → Google Ads tag → czy są aktywne "hits" w ciągu 24h
- Tag musi przesyłać parametry: `ads_data_redaction` i identyfikator produktu
- Dynamic Remarketing generalnie lepiej konwertuje niż standardowy remarketing
- Jeśli "No dynamic remarketing data flow" — sprawdź czy tag jest wdrożony na stronach produktowych

### 4. Ukryte optymalizacje (szybkie zyski)

#### Lokalizacja — najczęstszy błąd
- Domyślne ustawienie kampanii: **"Presence or interest"** — wyświetla reklamy osobom *zainteresowanym* Twoją lokalizacją, nie tylko w niej będącym
- To oznacza budżet trafia do innych krajów/regionów bez Twojej wiedzy
- **Zmień na: "Presence: People in or regularly in your targeted locations"**
- Gdzie: Campaign Settings → Locations → Location options
- Sprawdź raport lokalizacji: Campaigns → Show more → Locations → Matched locations — możesz filtrować do poziomu województwa, miasta, kodu pocztowego
- Zablokuj lokalizacje z dużym spend i zerowymi konwersjami jako **Excluded Locations**

#### Search Terms Report — słowa kluczowe wykluczające
- **Search Keywords** = słowa które targetujesz; **Negative Keywords** = słowa które blokujesz
- **Search Terms** = co użytkownicy *naprawdę* wpisali zanim kliknęli Twoją reklamę
- Sprawdzaj Search Terms Report tygodniowo: Keywords → Search terms
- Szukaj: wysokie kliknięcia/spend + zero konwersji = kandydat na negative
- Przykład błędu: kampania na "iPhone app" przyciągała ruch na "apple earnings report", "iphone sales" — kompletnie niepowiązane intencje zakupowe
- Sprawdź każde słowo kluczowe osobno przez zakładkę "Search terms" przy konkretnym keyword
- Dodawaj irrelewantne frazy jako Negative Keywords na poziomie kampanii lub grupy reklam

#### Conversion Tracking — fundament Smart Bidding
- Bez danych konwersji Google AI działa w ciemności — optymalizuje pod kliknięcia zamiast sprzedaży
- Google zbiera sygnały: zapytania, urządzenie, lokalizacja, pora dnia, historia przeglądania
- Im więcej danych konwersji → tym lepiej algorytm wie komu pokazywać reklamy
- Przypisz **wartości pieniężne** do konwersji — bez tego Target ROAS jest niemożliwy
- Nowsze typy kampanii (Demand Gen, PMax) są całkowicie zależne od jakości danych konwersji

## Źródła
- google1.pdf (Google Ads Data Check-Up for Shopify Merchants) — przetworzony 2026-04-11
- googlemeta1.pdf (3X your Google Ads performance in 10 minutes, Dan Wood / Medium) — przetworzony 2026-04-11
