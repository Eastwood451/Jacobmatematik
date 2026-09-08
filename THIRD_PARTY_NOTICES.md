# Tredjepartslicenser

Dette er en oversigt over de direkte browserbiblioteker identificeret i
`index.html` og `fps.html` ved gennemgangen 8. september 2026.
De fulde licenstekster nedenfor gælder de respektive komponenter.
Projektets egen rettighedsmeddelelse ændrer ikke disse tilladelser.

Oversigten er ikke en erklæring om, at alle indirekte afhængigheder,
lydrettigheder eller øvrige materialer er afklaret.

## Three.js 0.180.0 (r180)

Bruges af Erling FPS; indlæses fra jsDelivr.
Kilde: https://github.com/mrdoob/three.js/blob/r180/LICENSE

```text
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Supabase JavaScript-klient

Indlæses fra jsDelivr med versionsintervallet `@2` på begge HTML-sider.
Den præcise leverede version er ikke fastlåst i disse filer. Licensteksten
er hentet fra projektets officielle repository 8. september 2026.
Kilde: https://github.com/supabase/supabase-js/blob/master/LICENSE

```text
MIT License

Copyright (c) 2020 Supabase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Værktøjer til lydgenerering

De læste generatorscripts bruger edge-tts og ffmpeg; FPS-generatoren
bruger desuden imageio-ffmpeg. De er værktøjer til generering og er ikke
de ovenstående browserbiblioteker. Denne fil tildeler ingen rettigheder
til tjenesterne eller de genererede lydfiler. Tjenestens outputvilkår
skal dokumenteres særskilt, ligesom værktøjernes licenser skal kontrolleres
ved en eventuel distribution af selve værktøjerne.
