/* Brøk-løb – spørgsmålsbank og progression (ren logik, testbar i Node). */
(() => {
  "use strict";

  // Regler vist ved forkert svar og på slutskærmen ("Det har du øvet").
  const RULES = {
    tn: { title: "Tæller og nævner", rule: "Tælleren står over brøkstregen og tæller, hvor mange dele du har. Nævneren står under og fortæller, hvor mange lige store dele det hele er delt i.", ex: "3/4: tæller = 3, nævner = 4" },
    forlaeng: { title: "Forlænge", rule: "Forlæng: gang med samme tal i tæller og i nævner. Brøken er lige stor bagefter.", ex: "2/3 = (2·4)/(3·4) = 8/12" },
    forkort: { title: "Forkorte", rule: "Forkort: dividér med samme tal i tæller og i nævner. Brøken er lige stor bagefter.", ex: "6/9 = (6:3)/(9:3) = 2/3" },
    samme: { title: "Plus og minus med samme nævner", rule: "Samme nævner: læg tællerne sammen (eller træk dem fra hinanden). Nævneren bliver, som den er.", ex: "1/5 + 2/5 = 3/5" },
    ens: { title: "Plus og minus med forskellige nævnere", rule: "Forskellige nævnere: gør brøkerne ensbenævnte først (forlæng dem til samme nævner). Regn så med tællerne.", ex: "1/2 + 1/3 = 3/6 + 2/6 = 5/6" },
  };

  const LEVELS = [
    { n: 1, name: "Tæller, nævner, forlænge og forkorte" },
    { n: 2, name: "Plus og minus med samme nævner" },
    { n: 3, name: "Forskellige nævnere" },
    { n: 4, name: "Regn selv" },
  ];

  // [id, niveau, regel, spørgsmål, rigtigt svar, ...snydesvar]
  const RAW = [
    ["tn1", 1, "tn", "Hvad er tælleren i 3/4?", "3", "4", "7", "3/4"],
    ["tn2", 1, "tn", "Hvad er nævneren i 5/8?", "8", "5", "13", "3"],
    ["tn3", 1, "tn", "Hvad fortæller nævneren?", "Hvor mange lige store dele det hele er delt i", "Hvor mange dele du har", "Hvor stor brøken er i alt", "Hvor mange gange du skal gange"],
    ["tn4", 1, "tn", "Hvad fortæller tælleren?", "Hvor mange af delene du har", "Hvor mange dele det hele er delt i", "Hvilket tal du skal dividere med", "Hvor mange brøker der er"],
    ["tn5", 1, "tn", "Hvor står tælleren i en brøk?", "Over brøkstregen", "Under brøkstregen", "Ved siden af brøken", "Efter lighedstegnet"],
    ["tn6", 1, "tn", "I brøken 7/10 – hvor mange lige store dele er det hele delt i?", "10", "7", "3", "17"],
    ["fl1", 1, "forlaeng", "Hvad betyder det at forlænge en brøk?", "Gange med samme tal i tæller og i nævner", "Lægge samme tal til i tæller og i nævner", "Gange kun tælleren", "Dividere med samme tal i tæller og i nævner"],
    ["fl2", 1, "forlaeng", "Når du forlænger en brøk, bliver den …", "lige så stor som før", "større", "mindre", "dobbelt så stor"],
    ["fl3", 1, "forlaeng", "Hvilken regel gør 1/2 til 2/4?", "Forlænge med 2", "Forkorte med 2", "Lægge 1 til i tæller og nævner", "Gange kun nævneren med 2"],
    ["fl4", 1, "forlaeng", "Er 2/3 og 4/6 lige store?", "Ja – 4/6 er 2/3 forlænget med 2", "Nej, 4/6 er større", "Nej, 4/6 er mindre", "Kun hvis man lægger 2 til"],
    ["fl5", 1, "forlaeng", "Hvilket tal må du IKKE forlænge med?", "0", "2", "7", "10"],
    ["fk1", 1, "forkort", "Hvad betyder det at forkorte en brøk?", "Dividere med samme tal i tæller og i nævner", "Trække samme tal fra i tæller og i nævner", "Dividere kun nævneren", "Gange med samme tal i tæller og i nævner"],
    ["fk2", 1, "forkort", "Når du forkorter en brøk, bliver den …", "lige så stor som før", "mindre", "større", "halvt så stor"],
    ["fk3", 1, "forkort", "Hvilken regel gør 4/8 til 1/2?", "Forkorte med 4", "Forlænge med 4", "Trække 3 fra tælleren og 6 fra nævneren", "Dividere kun tælleren med 4"],
    ["fk4", 1, "forkort", "Hvornår kan en brøk ikke forkortes mere?", "Når kun 1 går op i både tæller og nævner", "Når nævneren er et lige tal", "Når tælleren er mindre end nævneren", "Når nævneren er over 10"],

    ["sn1", 2, "samme", "Hvordan lægger du brøker med samme nævner sammen?", "Læg tællerne sammen – nævneren bliver", "Læg både tællere og nævnere sammen", "Læg nævnerne sammen – tælleren bliver", "Gang tællerne med hinanden"],
    ["sn2", 2, "samme", "Hvordan trækker du brøker med samme nævner fra hinanden?", "Træk tællerne fra hinanden – nævneren bliver", "Træk både tællere og nævnere fra hinanden", "Træk nævnerne fra hinanden – tælleren bliver", "Dividér tællerne med hinanden"],
    ["sn3", 2, "samme", "1/5 + 2/5 = ?", "3/5", "3/10", "2/25", "3/25"],
    ["sn4", 2, "samme", "5/7 − 2/7 = ?", "3/7", "3/14", "7/7", "3/0"],
    ["sn5", 2, "samme", "3/8 + 3/8 = ?", "6/8", "6/16", "9/8", "3/16"],
    ["sn6", 2, "samme", "Hvad bliver nævneren, når du regner 2/9 + 4/9?", "9", "18", "81", "6"],
    ["sn7", 2, "samme", "1/4 + 1/4 = ?", "2/4", "2/8", "1/8", "1/16"],
    ["sn8", 2, "samme", "9/10 − 4/10 = ?", "5/10", "5/20", "13/10", "5/0"],
    ["sn9", 2, "samme", "Hvorfor lægger man ikke nævnerne sammen?", "Nævneren fortæller delenes størrelse – den ændrer sig ikke", "Fordi nævneren altid er 1", "Fordi man skal gange nævnerne", "Det gør man faktisk altid"],
    ["sn10", 2, "samme", "2/3 + 2/3 = ?", "4/3", "4/6", "4/9", "2/3"],

    ["en1", 3, "ens", "Hvad skal du gøre først for at regne 1/2 + 1/3?", "Gøre brøkerne ensbenævnte", "Lægge tællere og nævnere sammen", "Forkorte begge brøker", "Gange tællerne med hinanden"],
    ["en2", 3, "ens", "Hvad betyder det, at to brøker er ensbenævnte?", "De har samme nævner", "De har samme tæller", "De er lige store", "Nævneren er 1"],
    ["en3", 3, "ens", "Hvordan gør du to brøker ensbenævnte?", "Forlænger dem, så de får samme nævner", "Lægger samme tal til begge nævnere", "Bytter om på tæller og nævner", "Sletter den største nævner"],
    ["en4", 3, "ens", "Hvilken fælles nævner kan du bruge til 1/2 + 1/3?", "6", "5", "3", "1"],
    ["en5", 3, "ens", "Hvad er den mindste fælles nævner for 1/4 og 1/6?", "12", "10", "24", "6"],
    ["en6", 3, "ens", "1/2 er det samme som …", "3/6", "1/6", "2/6", "4/6"],
    ["en7", 3, "ens", "1/3 er det samme som …", "2/6", "1/6", "3/6", "1/9"],
    ["en8", 3, "ens", "1/2 + 1/4 = ?", "3/4", "2/6", "2/4", "1/6"],
    ["en9", 3, "ens", "1/2 + 1/3 = ?", "5/6", "2/5", "2/6", "1/5"],
    ["en10", 3, "ens", "3/4 − 1/2 = ?", "1/4", "2/2", "2/4", "3/8"],
    ["en11", 3, "ens", "Hvorfor skal brøkerne være ensbenævnte, før du lægger dem sammen?", "Så delene er lige store og kan tælles sammen", "Så tællerne bliver ens", "Så man kan gange nævnerne", "Det skal de slet ikke"],
    ["en12", 3, "ens", "1/5 + 1/10 = ?", "3/10", "2/15", "2/10", "1/15"],

    ["rg1", 4, "forlaeng", "Forlæng 2/3 med 4.", "8/12", "6/7", "8/3", "2/12"],
    ["rg2", 4, "forkort", "Forkort 6/9 mest muligt.", "2/3", "3/4", "1/3", "6/3"],
    ["rg3", 4, "forlaeng", "Forlæng 3/5 med 2.", "6/10", "5/7", "6/5", "3/10"],
    ["rg4", 4, "forkort", "Forkort 10/15 med 5.", "2/3", "5/10", "2/5", "5/3"],
    ["rg5", 4, "forkort", "Forkort 8/12 mest muligt.", "2/3", "4/6", "4/8", "1/2"],
    ["rg6", 4, "forlaeng", "Forlæng 1/4, så nævneren bliver 12.", "3/12", "1/12", "4/12", "9/12"],
    ["rg7", 4, "ens", "2/5 + 1/10 = ?", "5/10", "3/15", "3/10", "2/50"],
    ["rg8", 4, "ens", "5/6 − 1/3 = ?", "3/6", "4/3", "4/6", "1/6"],
    ["rg9", 4, "ens", "Hvilken brøk er størst: 2/3 eller 3/5?", "2/3", "3/5", "De er lige store", "Det kan man ikke se"],
    ["rg10", 4, "ens", "3/4 + 1/8 = ?", "7/8", "4/12", "4/8", "3/32"],
    ["rg11", 4, "samme", "7/12 − 5/12 = ?", "2/12", "2/0", "12/12", "2/24"],
    ["rg12", 4, "forkort", "Forkort 12/16 med 4.", "3/4", "8/12", "4/3", "3/16"],
  ];

  const BANK = RAW.map(([id, level, rule, q, a, ...d]) => ({ id, level, rule, q, a, d }));

  function shuffle(list, rand = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Niveau ud fra antal rigtige svar: 4 rigtige pr. niveau. */
  function levelFor(correctCount) {
    return Math.min(4, 1 + Math.floor(Math.max(0, correctCount) / 4));
  }

  /** Lav en "deck" der vælger spørgsmål uden gentagelser; mest fra nuværende niveau, lidt repetition. */
  function createDeck(rand = Math.random) {
    const used = new Set();
    return {
      next(level) {
        const pick = (pool) => {
          const fresh = pool.filter((item) => !used.has(item.id));
          return fresh.length ? fresh : null;
        };
        const current = BANK.filter((item) => item.level === level);
        const earlier = BANK.filter((item) => item.level < level);
        let pool = (earlier.length && rand() < 0.3 && pick(earlier)) || pick(current) || pick(earlier) || null;
        if (!pool) { used.clear(); pool = current; }
        const item = pool[Math.floor(rand() * pool.length)];
        used.add(item.id);
        const options = shuffle([item.a, ...shuffle(item.d, rand).slice(0, 3)], rand);
        return { ...item, options, correctIndex: options.indexOf(item.a) };
      },
      reset() { used.clear(); },
    };
  }

  /** Brøker som "3/4" eller "(2·4)/(3·4)" → HTML med stablet brøk. Input escapes først. */
  function fracHtml(text) {
    const esc = String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    return esc
      .replace(/\(([^()]+)\)\/\(([^()]+)\)/g, '<span class="bl-frac"><span>$1</span><span>$2</span></span>')
      .replace(/(\d+)\/(\d+)/g, '<span class="bl-frac"><span>$1</span><span>$2</span></span>');
  }

  window.JacobBrokLoebCore = Object.freeze({ BANK, RULES, LEVELS, levelFor, createDeck, shuffle, fracHtml });
})();
