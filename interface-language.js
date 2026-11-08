/* In-place interface language. Never changes exercise state or input values. */
(() => {
  'use strict';
  const dictionary = {
  "Godt at se dig": "Good to see you",
  "Log ind som elev eller lærer for at fortsætte.": "Log in as a student or teacher to continue.",
  "Brugernavn": "Username",
  "Adgangskode": "Password",
  "Din adgangskode": "Your password",
  "fx alma7": "e.g. alma7",
  "Log ind": "Log in",
  "Log ud": "Log out",
  "Gæst": "Guest",
  "eller": "or",
  "Ingen resultater gemmes.": "No results are saved.",
  "Installer som app": "Install app",
  "Cookies og privatliv": "Cookies and privacy",
  "Rettigheder og brug": "Rights and usage",
  "Tilbage": "Back",
  "Annuller": "Cancel",
  "Gem": "Save",
  "Fortsæt": "Continue",
  "Næste": "Next",
  "Næste opgave": "Next question",
  "Tjek svar": "Check answer",
  "Svar": "Answer",
  "Dit svar": "Your answer",
  "Prøv igen": "Try again",
  "Korrekt!": "Correct!",
  "Forkert": "Incorrect",
  "Rigtigt!": "Correct!",
  "Din træning": "Your practice",
  "Hvad vil du øve i dag?": "What would you like to practise today?",
  "I alt løst": "Total solved",
  "Vælg et område": "Choose a topic",
  "Dine seneste tal": "Your latest results",
  "Ny": "New",
  "Klar til første opgave": "Ready for your first question",
  "Matematiktårnet": "Maths Tower",
  "Slet data": "Delete data",
  "Lær klokken": "Learn to tell the time",
  "Bogstavlæring": "Learn letters",
  "Tallene": "Numbers",
  "Plus-drill": "Addition drill",
  "Plusstykker": "Column addition",
  "Godbidder til Marley": "Treats for Marley",
  "Plus-penalhus": "Pencil case addition",
  "Luigis 10’er-venner": "Luigi’s friends of ten",
  "Minusstykker": "Column subtraction",
  "Minus-drill": "Subtraction drill",
  "Når 0 og 1 forvirrer": "When 0 and 1 get confusing",
  "Lille tabel": "Times tables",
  "Gangestykker": "Column multiplication",
  "Gange-drill": "Multiplication drill",
  "Division-drill": "Division drill",
  "Divisions-slikkepinde": "Long division",
  "Regnehierarki": "Order of operations",
  "Negative tal": "Negative numbers",
  "Distributiv lov": "Distributive property",
  "Aflæs uret, og øv minutter i, over, halv og kvart": "Read the clock and practise minutes to, past, half past and quarter hours",
  "Find billedet med den rigtige startlyd": "Find the picture with the correct initial sound",
  "Tæl figurer og fingre fra 0 til 10": "Count characters and fingers from 0 to 10",
  "Plus med etcifrede tal": "Add single-digit numbers",
  "Læg tal sammen lodret trin for trin": "Add numbers in columns step by step",
  "Træk, tæl og læg godbidder sammen med Marley": "Drag, count and add treats with Marley",
  "Øbbe og Luigi kaster ting — tæl dem og plus": "Øbbe and Luigi throw objects — count and add them",
  "Find pizzamakkerne, der tilsammen har 10 slices": "Find the pizza partners with 10 slices altogether",
  "Lån en tier og træk fra trin for trin": "Borrow a ten and subtract step by step",
  "Minusstykker uden negative svar": "Subtraction without negative answers",
  "Regneregler med 0 og 1": "Calculation rules for 0 and 1",
  "Gangestykker fra 0×0 til 10×10": "Multiplication from 0×0 to 10×10",
  "Gang tocifrede tal med delprodukter og mente": "Multiply two-digit numbers using partial products and carrying",
  "Udfyld hele 1–9-tabellen på tid": "Complete the 1–9 times table against the clock",
  "Find den manglende faktor i hele 1–9-tabellen": "Find the missing factor in the 1–9 times table",
  "Træk cifret ned og løs divisionen trin for trin": "Bring down the digit and divide step by step",
  "Gange før plus og minus": "Multiply before adding and subtracting",
  "Plus, minus og gange": "Addition, subtraction and multiplication",
  "Gang ind i parentesen": "Multiply into the brackets",
  "Skift adgangskode": "Change password",
  "Min profil": "My profile",
  "Nuværende adgangskode": "Current password",
  "Ny adgangskode": "New password",
  "Gentag ny adgangskode": "Repeat new password",
  "Gem adgangskode": "Save password",
  "Vælg en ny adgangskode til din bruger.": "Choose a new password for your account.",
  "Indlæser...": "Loading...",
  "Siden indlæses...": "Loading the page...",
  "Opret bruger": "Create account",
  "Tilbage til login": "Back to login",
  "Mindst 6 tegn": "At least 6 characters",
  "Vis svar": "Show answer",
  "Start": "Start",
  "Stop": "Stop",
  "Tid": "Time",
  "Point": "Points",
  "Resultater": "Results",
  "Klasser": "Classes",
  "Elever": "Students",
  "Oversigt": "Overview",
  "Brøker": "Fractions",
  "Lær brøkregning": "Learn fractions",
  "Skak": "Chess",
  "Lyd til": "Sound on",
  "Lyd fra": "Sound off"
};
  let language;
  try { language = localStorage.getItem('jm-lang') === 'en' ? 'en' : 'da'; } catch (_) { language = 'da'; }
  const originals = new WeakMap();
  const attributes = new WeakMap();
  function translate(value) {
    const trimmed = value.trim();
    const translated = dictionary[trimmed];
    if (translated) return value.replace(trimmed, translated);
    if (/^Hej .+!$/.test(trimmed)) return value.replace('Hej ', 'Hello ');
    return value.replace(/^(\s*)(\d+) opgaver(\s*)$/, '$1$2 questions$3')
      .replace(/^(\s*)([\d.,]+) sek\. i snit(\s*)$/, '$1$2 sec. average$3');
  }
  function skip(element) {
    return !element || element.closest('script,style,textarea,[contenteditable],#jm-language-picker,.user-pill,select,option');
  }
  function visit(root) {
    if (root.nodeType === 3) {
      if (skip(root.parentElement)) return;
      const previous = originals.get(root);
      const original = previous && root.data === previous.rendered ? previous.original : root.data;
      const rendered = language === 'en' ? translate(original) : original;
      originals.set(root, {original, rendered});
      if (root.data !== rendered) root.data = rendered;
      return;
    }
    if (root.nodeType !== 1 || skip(root)) return;
    for (const name of ['placeholder', 'aria-label', 'title']) {
      if (!root.hasAttribute(name)) continue;
      const saved = attributes.get(root) || {};
      const value = root.getAttribute(name);
      const prior = saved[name];
      const original = prior && prior.rendered === value ? prior.original : value;
      const rendered = language === 'en' ? translate(original) : original;
      saved[name] = {original, rendered}; attributes.set(root, saved);
      if (value !== rendered) root.setAttribute(name, rendered);
    }
    for (const child of root.childNodes) visit(child);
  }
  function start() {
    const picker = document.createElement('nav');
    picker.id = 'jm-language-picker'; picker.setAttribute('aria-label', 'Dansk / English');
    picker.innerHTML = '<button type="button" data-interface-lang="da" lang="da">Dansk</button><button type="button" data-interface-lang="en" lang="en">English</button>';
    document.body.prepend(picker);
    const style = document.createElement('style');
    style.textContent = '#jm-language-picker{display:flex;justify-content:flex-end;gap:4px;padding:8px 16px;background:#211137;position:relative;z-index:100;font:700 14px system-ui}#jm-language-picker button{font:inherit;border:1px solid #b5a5cb;border-radius:8px;color:#fff;background:transparent;padding:8px 14px;cursor:pointer;min-height:40px}#jm-language-picker button[aria-pressed="true"]{background:#ffba65;color:#211137;border-color:#ffba65}#jm-language-picker button:focus-visible{outline:3px solid white;outline-offset:2px}';
    document.head.append(style);
    function apply() {
      observer.disconnect();
      document.documentElement.lang = language;
      picker.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.interfaceLang === language)));
      visit(document.body);
      observer.observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
    }
    const observer = new MutationObserver(records => {
      observer.disconnect();
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(visit);
        else visit(record.target);
      }
      observer.observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
    });
    picker.addEventListener('click', event => {
      const button = event.target.closest('[data-interface-lang]');
      if (!button) return;
      language = button.dataset.interfaceLang;
      try { localStorage.setItem('jm-lang', language); } catch (_) {}
      apply();
      window.dispatchEvent(new CustomEvent('jm-language-change', {detail:{language}}));
    });
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
