/* Danish clock language. Pure functions shared by the exercise and checks. */
(function (root) {
  "use strict";
  const TYPES = ["over", "to", "half", "quarter-over", "quarter-to", "whole"];
  const nextHour = hour => hour === 12 ? 1 : hour + 1;
  function describe(hour, minute, type) {
    if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new RangeError("Invalid clock time");
    const upcoming = nextHour(hour);
    type = type || (minute === 0 ? "whole" : minute === 15 ? "quarter-over" : minute === 30 ? "half" : minute === 45 ? "quarter-to" : minute < 30 ? "over" : "to");
    if (!TYPES.includes(type) || (type === "over" && (minute === 0 || minute >= 30)) || (type === "to" && minute <= 30) || (type === "whole" && minute !== 0) || (type === "half" && minute !== 30) || (type === "quarter-over" && minute !== 15) || (type === "quarter-to" && minute !== 45)) throw new RangeError("Time does not match phrase");
    const namedHour = ["to", "half", "quarter-to"].includes(type) ? upcoming : hour;
    const count = type === "to" || type === "quarter-to" ? 60 - minute : minute;
    const prefix = type === "whole" ? "" : type === "half" ? "halv" : type === "quarter-over" ? "kvart over" : type === "quarter-to" ? "kvart i" : `${count} ${count === 1 ? "minut" : "minutter"} ${type === "over" ? "over" : "i"}`;
    return { hour, minute, type, namedHour, count, prefix, phrase: `${prefix ? prefix + ' ' : ''}${namedHour}`, hourAngle: (hour % 12) * 30 + minute / 2, minuteAngle: minute * 6 };
  }
  function makeDeck(type = "mixed", step = 5, random = Math.random) {
    if (type !== "mixed" && !TYPES.includes(type)) throw new RangeError("Invalid phrase type");
    if (![1, 5].includes(step)) throw new RangeError("Invalid minute step");
    const minutes = type === "whole" ? [0] : ["half", "quarter-over", "quarter-to"].includes(type) ? [type === "half" ? 30 : type === "quarter-over" ? 15 : 45] : Array.from({length:60}, (_, i) => i).filter(m => m % step === 0 && (type === "mixed" || (type === "over" ? m > 0 && m < 30 : m > 30)));
    const deck = [];
    for (let h = 1; h <= 12; h++) for (const m of minutes) deck.push(describe(h, m, type === "mixed" ? undefined : type));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return deck;
  }
  function fields(task, mode) {
    if (!["minutes", "hour", "both"].includes(mode)) throw new RangeError("Invalid answer mode");
    if (["whole", "half", "quarter-over", "quarter-to"].includes(task.type)) return ["hour"];
    return mode === "both" ? ["minutes", "hour"] : [mode];
  }
  function validate(task, mode, answers) {
    const expected = {minutes:task.count, hour:task.namedHour};
    const needed = fields(task, mode);
    const missing = needed.filter(key => !/^\d{1,2}$/.test(String(answers[key] ?? "").trim()));
    const wrong = needed.filter(key => missing.includes(key) || Number(answers[key]) !== expected[key]);
    return {correct:!wrong.length, missing, wrong, expected};
  }
  function hourGuide(task) {
    if (task.minute === 0) return {side:"whole",direction:"exact",namedHour:task.hour,startAngle:task.hourAngle,endAngle:task.hourAngle,label:"HEL TIME",rule:"Stor viser peger lige op. Sig det tal, den lille viser peger på."};
    const before = task.minute < 30;
    return {
      side: task.minute === 30 ? "half" : before ? "right" : "left",
      direction: before ? "before" : "after",
      namedHour: task.namedHour,
      startAngle: task.hourAngle,
      endAngle: task.hourAngle + (before ? -task.minute / 2 : (60 - task.minute) / 2),
      label: task.minute === 30 ? "HALV · timen EFTER" : before ? "OVER · timen FØR" : "I · timen EFTER",
      rule: task.minute === 30 ? "Stor viser på 6: halv betyder den kommende time. Vælg timen EFTER den lille viser." : before ? "Stor viser i højre halvdel: vælg timen FØR den lille viser." : "Stor viser i venstre halvdel: vælg timen EFTER den lille viser.",
    };
  }
  function explain(task) {
    if (task.minute === 0) return `Den lange viser peger på 12. Den korte viser peger på ${task.hour}. Klokken er ${task.hour}.`;
    const hourText = ["to", "half", "quarter-to"].includes(task.type) ? `Den korte viser er på vej mod ${task.namedHour}.` : `Den korte viser har passeret ${task.hour}.`;
    const minuteText = task.type === "half" ? "Den lange viser står på 6: der er gået 30 minutter. Halv betyder halvvejs til den næste time." : task.type.startsWith("quarter") ? `En kvart time er 15 minutter. ${task.type === "quarter-to" ? "Der er 15 minutter til den næste time." : "Der er gået 15 minutter siden timen."}` : task.type === "to" ? `Der er ${task.count} ${task.count === 1 ? "minut" : "minutter"} tilbage til den næste time. Derfor siger vi “i”.` : `Der er gået ${task.count} ${task.count === 1 ? "minut" : "minutter"} siden timen. Derfor siger vi “over”.`;
    return `${minuteText} ${hourText}`;
  }
  const LESSONS = Object.freeze([
    {id:"hours",chapter:1,title:"Lær timeviseren",hands:"hour",type:"whole",intro:["Et ur har to visere. Vi begynder med den lille viser. Den viser timerne.","Her peger pilen lige på et timetal. Skriv det tal, pilen peger på. Læs 10 timer, før vi går videre."],prompt:"Hvilken time peger pilen på?"},
    {id:"minutes-over",chapter:2,title:"Minutter OVER",hands:"minute",type:"over",intro:["Voksne SIGER klokken på to måder: minutter OVER og minutter I. Nu ser vi kun på den store viser. Den viser minutterne.","I den røde højre halvcirkel tæller vi fra toppen og rundt med uret: 5, 10, 15, 20, 25 minutter OVER. Vi øver kun OVER først.","Først får du 5 spørgsmål med hele femmere. Derefter skal du tælle de små streger mellem tallene. Hver lille streg er 1 minut."],prompt:"Hvor mange minutter OVER?"},
    {id:"minutes-to",chapter:2,title:"Minutter I",hands:"minute",type:"to",intro:["På den blå side tæller vi den MODSATTE vej af “minutter OVER”. Start ved toppen, og tæl ned langs den blå side: 5, 10, 15, 20, 25.","Stop, når du møder den store viser. Tallet fortæller, hvor mange minutter der er tilbage, før klokken bliver hel. Det kalder vi “minutter I”!","Først får du 5 spørgsmål med hele femmere. Derefter skal du tælle de små streger mellem tallene. Hver lille streg er 1 minut."],prompt:"Hvor mange minutter I?"},
    {id:"both-over",chapter:3,title:"Begge visere · OVER",hands:"both",type:"over",intro:["Nu sætter vi viserne sammen. Den store viser fortæller minutterne. Den lille viser fortæller timen.","Når den store viser er i OVER-halvcirklen, siger vi timen FØR den lille viser. Den lille viser har allerede passeret det timetal. Følg pilen baglæns til tallet."],prompt:"Hvad er klokken?"},
    {id:"both-to",chapter:3,title:"Begge visere · I",hands:"both",type:"to",intro:["Når den store viser er i I-halvcirklen, siger vi timen EFTER den lille viser.","Den lille viser er på vej mod det timetal. Følg pilen frem til tallet. Nu siger vi først minutter I og derefter den kommende time."],prompt:"Hvad er klokken?"},
    {id:"whole",chapter:4,title:"Hele klokkeslæt",hands:"both",type:"whole",intro:["Når den store viser peger lige op på 12, er klokken hel.","Så siger vi bare det tal, den lille viser peger på. Peger den lille viser på 6, siger vi: Klokken er 6."],prompt:"Hvad er klokken?"},
  ]);
  function lessonDeck(id, random=Math.random, solved=0) {
    const lesson=LESSONS.find(item=>item.id===id);
    if(!lesson)throw new RangeError("Invalid clock lesson");
    const betweenFives=lesson.hands === "minute" && solved>=5;
    const deck=makeDeck(lesson.type,betweenFives?1:5,random);
    return lesson.hands === "minute" ? deck.filter(task=>task.hour===12 && (!betweenFives || task.minute%5!==0)) : deck;
  }
  function lessonMode(id, solved) {
    const lesson=LESSONS.find(item=>item.id===id);
    if(!lesson)throw new RangeError("Invalid clock lesson");
    return lesson.hands === "minute" ? "minutes" : lesson.hands === "hour" || lesson.type === "whole" ? "hour" : solved < 3 ? "minutes" : solved < 6 ? "hour" : "both";
  }
  const api = Object.freeze({TYPES, nextHour, describe, makeDeck, fields, validate, hourGuide, explain, LESSONS, lessonDeck, lessonMode});
  root.JacobClockCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
