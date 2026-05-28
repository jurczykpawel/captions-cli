# Caption style packs

Trzy tiery dla `engine-ass` (lead magnet companion). HF runtime to osobny
płatny moduł — ten dokument dotyczy wyłącznie ASS.

Zasady projektowe (z researchu Submagic / CapCut / Opus / TikTok 2026):
- Bold sans-serif (Inter Bold) + heavy black outline = baseline czytelności
- Word-by-word > full sentence dla engagement (free pakiet to wyjątek —
  ma być prostszy i czytelny "podpis", nie hook)
- Akcent koloru tylko na **active** word (yellow / cyan / green / red)
- Zero blur (nieczytelne), zero gradientów (ASS nie umie ładnie)
- BorderStyle 1 dla outline, BorderStyle 4 dla solid box / pill bg

## FREE (zawarte w obrazie)

Jeden styl. Multi-word, neutralny, czytelny na każdym tle. Bez animacji,
bez highlight per-word — żeby user dostał coś co po prostu działa.

| Slug | Co | Use case |
|------|----|----|
| `clean-white` | Białe Bold + 8 px black outline. 3–4 słowa per cue. Bez highlight. | Vlogi, lifestyle, edukacja, pełne zdania |

## BASIC — 47 zł

Free + 4 dodatkowe. Każdy z innej kategorii — outline accent, classic
business, bg pill, subtle motion. Dla użytkowników którzy chcą wybór ale
bez przesadyzmu.

| Slug | Kategoria | Co |
|------|-----------|-----|
| `outline-pop` | outline+accent | UPPERCASE + 10 px outline + active word w żółtym. Submagic-style. |
| `hormozi` | classic business | Białe Bold + active word żółty + scale 1.15. Benchmark dla biz. |
| `pill` | bg | Solid kolorowa pill bg za active word, fontColor jako tekst. |
| `pop-word` | motion | Białe Bold + active word lekki bounce, bez color change. |

## PREMIUM — 97 zł

Basic + 23 dodatkowe (28 total). Pełen catalog. Każda kategoria pokryta
2–4 wariantami (color, size, animation).

### Outline + accent (5 wariantów)
| Slug | Co |
|------|----|
| `outline-pop` | (z basic) żółty accent |
| `hormozi-red` | Hormozi z czerwonym akcentem |
| `hormozi-green` | Hormozi z zielonym akcentem |
| `hormozi-cyan` | Hormozi z cyan akcentem |
| `mrbeast` | Extra heavy outline 14 px, większy fontSize |

### Background pill / box (4 warianty)
| Slug | Co |
|------|----|
| `pill` | (z basic) yellow pill |
| `pill-shadow` | Pill + drop shadow 4 px |
| `box-highlight` | Translucent black box za active word |
| `news-ticker` | Pełna szerokość czarny bar bottom, white text |

### Single word focus (3 warianty)
| Slug | Co |
|------|----|
| `single-word` | Jedno słowo center, jumbo scale |
| `single-word-fade` | Single word + fade in/out 100 ms |
| `single-word-pop` | Single word + scale-in pop |

### Highlights / decorations (3 warianty)
| Slug | Co |
|------|----|
| `underline-sweep` | Active podkreślony |
| `karaoke-fill` | Active fill color, others outline-only (white) |
| `karaoke-shadow` | Past dark gray, active white, upcoming gray |

### Motion (3 warianty)
| Slug | Co |
|------|----|
| `pop-word` | (z basic) bounce |
| `bouncing` | Cały cue lekko bounces na active boundary |
| `slide-up` | Active wjedzie z dołu (\\move) |

### Color accents (3 warianty)
| Slug | Co |
|------|----|
| `neon-yellow` | Białe + active jaskrawy żółty 4cf |
| `neon-cyan` | Białe + active cyan |
| `neon-pink` | Białe + active pink |

### Cinematic / classic (3 warianty)
| Slug | Co |
|------|----|
| `subtitle-classic` | Małe, bottom, Netflix-style. Multi-word. |
| `whisper-mini` | Bardzo małe, dyskretne pod video |
| `mono-block` | All uppercase, jeden kolor, no highlight, klasa |

## Co wycinamy

- `glow` — blur był nieczytelny (potwierdzony screenem 2026-05-02). Usuwamy z catalogu.
- `text` — był baseline'em developerskim. Renamed do `clean-white` z poprawkami (multi-word, outline).

## Implementacja

- Presety w `packages/engine-ass/src/presets/` z metadata: `tier: 'free' | 'basic' | 'premium'`
- `index.ts` eksportuje rejestry per tier i `tierForPreset(slug)`
- CLI `--list-presets` grupuje po tierach
- CLI `--tier` filtruje co user może użyć (placeholder gate, full DRM w follow-up)
- Domyślny preset: `clean-white` (free)
