# Analityka — Baza Wiedzy

## Google Analytics 4 — Podstawy

### GA4 vs Universal Analytics (UA)
- GA4 jest oparte na **zdarzeniach** (event-based), UA było oparte na sesjach (session-based)
- UA dane NIE są przechowywane przez Google na zawsze — dane z GA4 trzeba zarchiwizować (BigQuery, Data Warehouse)
- Liczby w GA4 i UA **nigdy nie będą identyczne** — różna metodologia pomiaru
- GA4 lepiej radzi sobie z prywatnością użytkowników i śledzeniem cross-device

### Migracja UA → GA4
1. Skonfiguruj property GA4 w Google Analytics
2. Skonfiguruj tagi przez Google Tag Manager
3. Zweryfikuj pomiar danych (test zdarzeń)
4. Dodatkowa konfiguracja: cele, konwersje, grupy docelowe
5. Eksportuj historyczne dane UA przed migracją

### Kluczowe raporty GA4
- **Home** — przegląd, kluczowe metryki
- **Realtime** — aktywni użytkownicy w czasie rzeczywistym
- **Life Cycle** — akwizycja → zaangażowanie → monetyzacja → retencja
- **User Reports** — demografia, technologia, zachowania
- **Explore** — niestandardowe raporty i segmenty

### Narzędzie Exploration (niestandardowe raporty GA4)
- **Segmenty** — filtruj dane wg kryteriów użytkownika/sesji/zdarzeń
- **Wymiary** (Dimensions) — atrybuty danych (kraj, źródło, strona)
- **Metryki** (Metrics) — wartości liczbowe (sesje, konwersje, przychód)

---

## GA i CRO (Conversion Rate Optimization)

### GA jako narzędzie CRO
- GA identyfikuje **co, gdzie i kiedy** — nie tłumaczy **dlaczego**
- Dlaczego = dane jakościowe (voice of customer, testy użyteczności)
- Najlepsze wyniki = połączenie danych ilościowych (GA) + jakościowych (VOC)

### Trzy zastosowania GA w CRO
1. **Pre-testing:** Identyfikuj okazje — gdzie użytkownicy odpadają
2. **Pre-testing:** Kwantyfikuj okazje znalezione inną metodą — ile to warte?
3. **Post-testing:** Oceń pełny wpływ testu A/B na zachowania użytkowników

### Najważniejsze raporty GA dla CRO
- Lejek zakupowy — gdzie odpada ruch
- Zachowania na stronach (heatmaps + GA = pełny obraz)
- Segmentacja wg źródła ruchu — które kanały konwertują najlepiej
- Revenue Per User (RPU) — lepsza metryka niż CR dla e-commerce

### Metryki użytkownikocentryczne (user-based)
- Przestaw raporty z sesji na **użytkowników** — lepiej odzwierciedla rzeczywistość
- Użytkownik może mieć wiele sesji — nie licz konwersji jako % sesji

---

## Atrybucja i Multi-Channel Funnels

### Multi-Channel Funnels (MCF)
- Pokazuje **wszystkie kanały** uczestniczące w ścieżce do konwersji, nie tylko ostatni
- **Assisted Conversions** — kanal pomagał w konwersji, ale nie był ostatni
- **Top Conversion Paths** — najczęstsze ścieżki: np. Organic → Direct → Purchase
- **Time Lag** — ile dni zajmuje podjęcie decyzji zakupowej
- **Path Length** — ile interakcji potrzeba do konwersji

### Modele Atrybucji
- **Last Click** — 100% zasługi ostatniemu kliknięciu (domyślny, często błędny)
- **First Click** — 100% zasługi pierwszemu kliknięciu
- **Linear** — równy podział między wszystkimi punktami styku
- **Time Decay** — im bliżej konwersji, tym większa zasługa
- **Data-Driven** (GA4) — algorytm ML rozdziela zasługę na podstawie danych
- Zmiana modelu może radykalnie zmienić ocenę kanałów — testuj różne modele

---

## Konfiguracja GA — najlepsze praktyki

### Podstawowe ustawienia (często zaniedbywane)
- Ustaw właściwy **timezone** i walutę
- Skonfiguruj **konwersje** (nie tylko pageviews)
- Wyklucz ruch wewnętrzny (IP biura, agencji)
- Podłącz Google Ads i Search Console
- Włącz **Enhanced Measurement** w GA4

### Jakość danych (sprawdzaj zawsze przed analizą)
- Brakujące dane = brakujące tagi na stronach
- Podwójne zliczanie = tag uruchomiony dwa razy
- Spam referral = filtruj przez weryfikację hostname
- Samplowanie danych = problem przy dużym ruchu (GA4 radzi sobie lepiej niż UA)

---

## Analityka reklamowa — zaawansowane metryki

### Big Data i Marketing Analytics (źródło: badania akademickie)
- Firmy używające marketing analytics osiągają lepsze: planowanie, wdrożenie, zarządzanie marką, CRM i rozwój produktu
- Big data → marketing analytics → wyższe możliwości marketingowe (zależność potwierdzona empirycznie)
- Samo posiadanie danych nie wystarczy — kluczowa jest **zdolność do ich analizy i działania**

### Google Analytics i Google Ads — integracja
- Połącz konta GA4 i Google Ads dla pełnego obrazu ścieżek konwersji
- Import konwersji z GA4 do Google Ads poprawia algorytmy Smart Bidding
- Używaj GA4 Audiences w Google Ads do remarketingu

---

## Źródła
- Advanced-Guide-to-GA-for-CRO-PDF.pdf (AWA Digital) — przetworzony 2026-04-10
- Advanced_Google_Analytics-_How_to_Get_the_Most_from_Google_Analytics.pdf (Intechnic) — przetworzony 2026-04-10
- Introduction_To_Analytics.pdf (GeorgiaGov Interactive) — przetworzony 2026-04-10
- UniversalAnalyticsToGoogleAnalytics4.pdf (eWay-Book) — przetworzony 2026-04-10
- f7203fb5-5c12-4a13-82f2-6723fcfc9360.pdf (Users Guide to Mastering GA) — przetworzony 2026-04-10
- markiert_brian_clifton_advanced_web_metrics_with_google_analytics__2010.pdf (Brian Clifton) — przetworzony 2026-04-10
- JCISGuangmingCaoMingNaTianandCharlesBlankson2021BigDataMarketingAnalyticsandFirmMarketingCapabilities.pdf — przetworzony 2026-04-10
