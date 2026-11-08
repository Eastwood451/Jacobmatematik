/* One authored translation object for the shared exercise app (index.html).
   Each key holds both languages: strings.<key>.da and strings.<key>.en.
   This is not a complete catalogue. Strings that are not keys here are still
   legacy Danish-source lookups in i18n-en.js. Do not describe those as semantic keys.

   Not in this object, and not claimed as translated:
   - plus-penalhus.js and clock.js / clock-core.js / clock-course.js
   - marley.js and marley-pet.js
   - spoken letter words, Obbe MP3s, Erling's deliberate slapper line, Luigi's Italian voice
   - text baked into images, apart from the one canvas school label keyed below
   - the static /en/ SEO pages, which stay separate HTML entry links */
(function (root) {
  root.JacobI18nStrings = {
    home_prompt: { da: "Hvad vil du øve i dag?", en: "What do you want to practise today?" },
    exercise_back: { da: "← Vælg emne", en: "← Choose a topic" },
    exercise_hint_type_below: { da: "Skriv dit svar nedenfor.", en: "Type your answer below." },
    exercise_question_n: { da: "Opgave {n}", en: "Question {n}" },
    exercise_feedback_correct_is: { da: "Det korrekte svar er", en: "The correct answer is" },
    exercise_feedback_tap_next: { da: "Tryk på svaret for næste opgave", en: "Tap the answer for the next question" },
    exercise_answer_label: { da: "Dit svar", en: "Your answer" },
    exercise_answer_placeholder: { da: "Dit svar", en: "Your answer" },
    exercise_keypad: { da: "Taltastatur", en: "Number keypad" },
    exercise_round_label: { da: "Svar i denne runde", en: "Answers this round" },
    angles_battleship_tap: { da: "Tryk på", en: "Tap" },
    angles_battleship_frozen: { da: "Forkert! Du er frosset et øjeblik.", en: "Wrong! You are frozen for a moment." },
    angles_battleship_hit: { da: "Ram! Du sænkede et skib 🚢💥", en: "Hit! You sank a ship 🚢💥" },
    angles_dennis_marker: { da: "Dennis", en: "Dennis" },
    runner_canvas_school: { da: "SKOLE", en: "SCHOOL" },
  };
})(typeof window !== "undefined" ? window : globalThis);
