N3O SYSTEM — ikona aplikacji
================================

Kolor: gradient #4CF7EA -> #12C6BE, znak #07100F.
Obudowa: superelipsa (n=5) — ten sam kształt, jaki iOS nakłada maską.

ios/            Kwadratowe, pełny spad, bez przezroczystości i bez zaokrągleń.
                AppIcon-1024.png wrzucasz do Xcode / App Store Connect.
macos/          Kafel wpuszczony w płótno (10% marginesu), przezroczyste tło.
android/        Ikona adaptacyjna: background + foreground 432 px.
                play-store-512.png to grafika do listingu w Google Play.
web/            favicon 16/32/48, apple-touch-icon 180, manifest 192/512,
                maskable-512 (znak w strefie bezpiecznej, purpose: maskable).
rounded/        Zaokrąglone PNG do slajdów, dokumentów i README.
                Warianty: gradient, dark, light, mono.
svg/            Zrodla wektorowe. glyph-only.svg to sam znak, bez tla.

Grubosc kreski rosnie przy malych rozmiarach (21 -> 29 j.), bo inaczej
przeswit miedzy ramionami szewronu zamula sie przy renderowaniu.
