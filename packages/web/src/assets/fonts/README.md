# Fonts

GDD §16's two typefaces, self-hosted. Both are under the SIL Open Font License 1.1, whose
terms are met by shipping the licence alongside the font — `LICENSE-Bungee.txt` and
`LICENSE-SpaceMono.txt` are the upstream texts, unaltered.

| file | family | weight | bytes |
|---|---|---|---|
| `bungee-latin-400-normal.woff2` | Bungee — display | 400 | 14,344 |
| `space-mono-latin-400-normal.woff2` | Space Mono — numbers and body | 400 | 16,520 |
| `space-mono-latin-700-normal.woff2` | Space Mono | 700 | 16,724 |

Latin subset only, woff2 only. The game is in English and every browser that can run it has
supported woff2 for years, so a woff fallback and the latin-ext, Vietnamese and italic subsets
would be bytes nobody downloads. 47 kB for the three.

Taken from the `@fontsource/bungee` and `@fontsource/space-mono` packages (5.3.0), which
repackage the Google Fonts originals. They are *not* dependencies: the files are vendored here on
purpose, so the game has no third-party font request at runtime and no install step to get its
own typefaces. `npm pack @fontsource/<name>` is where to get newer ones.

The `@font-face` rules that use them are in `theme/tokens.css`, next to the stacks they belong to.
