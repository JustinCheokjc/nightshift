// Nightshift help bot: scripted answers drawn only from the site's own FAQ, privacy notice and pilot details.
// No AI and no server. Typed questions never leave the browser; analytics records only which answer was shown.
(function () {
  var EMAIL = "justincheok@hotmail.com";
  var mail = '<a href="mailto:' + EMAIL + '">' + EMAIL + "</a>";

  // q: the question as shown on a chip. keys: phrases that trigger it (every word in a phrase must appear).
  // a: answer HTML (written by us, never user input). link: [label, href]. next: follow-up topic ids.
  var KB = [
    // Narrow topics first: on a tied score the earlier entry wins.
    { id: "age", q: "Is there an age limit?", keys: ["age", "how old", "18", "17", "16", "15", "minor", "under 18", "teen", "too young"],
      a: "You need to be 18 or over, on a personal laptop you own, with admin rights.",
      next: ["eligible", "join"] },
    { id: "what", q: "What is Nightshift?", keys: ["what is nightshift", "what is this", "what do you do", "how does it work", "how does this work", "explain", "about nightshift"],
      a: "Nightshift is a student-led pilot measuring how much idle compute everyday laptops can offer. Your laptop sits idle for hours; we measure it, then (in a later phase) match it to teams that need compute.",
      link: ["How it works", "/"], next: ["join", "see", "money"] },
    { id: "join", q: "How do I join?", keys: ["join", "sign up", "signup", "register", "apply", "get started", "take part", "participate", "enrol", "enroll"],
      a: "Fill in the short form with your email and operating system. We check your laptop against the eligibility list, email you the consent form, and then you install the app and start the 30-day pilot.",
      link: ["Join the pilot", "/join/"], next: ["eligible", "money", "stop"] },
    { id: "eligible", q: "Which laptops can join?", keys: ["which laptop", "eligible", "eligibility", "requirement", "qualify", "memory", "ram", "admin", "work laptop", "school laptop", "company laptop", "managed", "chromebook", "tablet", "linux", "desktop"],
      a: "Personal Windows or Mac laptops with admin rights and at least 8 GB memory, running Windows 10/11 or macOS 12+. Managed (school or employer), shared, virtual and tablet devices are not eligible.",
      link: ["Check your laptop", "/contributors/#elg"], next: ["join", "age", "slow"] },
    { id: "os", q: "Does it work on Mac?", keys: ["mac", "macos", "macbook", "apple", "windows", "operating system", "os", "work on mac", "work on windows", "run on mac", "run on windows"],
      a: "Yes. The pilot supports Windows 10 or 11 and macOS 12 or newer, on a personal laptop with admin rights and at least 8 GB memory.",
      link: ["Check your laptop", "/contributors/#elg"], next: ["eligible", "join"] },
    { id: "money", q: "Can I earn money?", keys: ["earn", "money", "paid", "pay", "payment", "income", "how much", "reward", "cash", "worth", "s 20", "20"],
      a: "The pilot pays a flat S$20 for 30 days. Earnings from real compute jobs come in a later phase, and any figures before then are estimates. No earnings are guaranteed.",
      link: ["For contributors", "/contributors/"], next: ["payout", "length", "join"] },
    { id: "payout", q: "How do payouts work?", keys: ["payout", "paynow", "bank", "transfer", "withdraw", "withdrawal", "minimum", "wallet", "when do i get paid", "get paid"],
      a: "The pilot payment is sent after 30 days by PayNow or bank transfer. Later, job earnings would sit in a wallet and be paid out through a licensed payment provider, with a minimum withdrawal.",
      next: ["money", "length"] },
    { id: "length", q: "How long is the pilot?", keys: ["how long", "length", "duration", "30 day", "days", "month", "commitment"],
      a: "The pilot runs for 30 days. You can pause or leave at any time, and the S$20 pilot payment is sent at the end.",
      next: ["stop", "money"] },
    { id: "slow", q: "Will it slow my laptop?", keys: ["slow", "performance", "lag", "speed", "cpu", "resource", "affect my laptop", "heavy"],
      a: "The app is designed to use under 1% of your CPU, and it runs no compute jobs during the pilot.",
      next: ["battery", "power", "see"] },
    { id: "power", q: "Will it use more electricity?", keys: ["electricity", "power bill", "energy", "electric", "bill", "cost me"],
      a: "A little, while the laptop stays awake. The dashboard estimates the cost.",
      next: ["battery", "slow"] },
    { id: "battery", q: "What about battery wear and heat?", keys: ["battery", "batteries", "drain", "heat", "hot", "overheat", "temperature", "wear", "damage", "fan"],
      a: "The app is being designed to work only while plugged in, and to pause when the laptop is busy or hot. The pilot runs no compute jobs, so it adds almost no load.",
      next: ["slow", "power"] },
    { id: "see", q: "What does the app see?", keys: ["what does the app see", "what do you collect", "collect", "track", "monitor", "spy", "see", "read", "access", "file", "browsing", "keystroke", "keylog", "location", "screen", "privacy", "private", "personal"],
      a: "Only device state: whether your laptop is on, plugged in and idle; CPU, GPU and memory load; hardware specs; network type; and simple security checks such as whether the firewall is on. It never sees your files, browsing, keystrokes, screen contents or location.",
      link: ["Trust and safety", "/trust/"], next: ["who", "keep", "safe"] },
    { id: "who", q: "Who can see my data?", keys: ["who can see", "who see my data", "share my data", "sell", "third party", "data"],
      a: "Only the project team, under a consent form you can review. You can export or delete your data at any time.",
      link: ["Privacy notice", "/about/#privacy"], next: ["keep", "stop", "see"] },
    { id: "keep", q: "How long do you keep my data?", keys: ["keep", "retention", "retain", "store", "stored", "where", "server", "supabase", "singapore", "how long data"],
      a: "Data is kept for the pilot and 12 months after, then deleted or anonymised. It is stored in Singapore by Supabase.",
      link: ["Privacy notice", "/about/#privacy"], next: ["who", "stop"] },
    { id: "stop", q: "How do I stop or delete my data?", keys: ["delete my data", "delete data", "remove my data", "stop", "quit", "leave", "uninstall", "remove", "pause", "delete", "erase", "withdraw consent", "cancel", "opt out"],
      a: "Pause or uninstall the app any time, and ask us to delete your data. Nothing is left running. You can also withdraw consent, request access to your data or ask for corrections by contacting us.",
      next: ["contact", "who"] },
    { id: "safe", q: "Is it safe?", keys: ["safe", "safety", "secure", "security", "virus", "malware", "hack", "risk", "sandbox", "trust"],
      a: "During the pilot the app only reads device state and has no file access, and you can pause, delete and withdraw consent at any time. Sandboxed job execution, duplicate-run result checks, and risk flags with an audit log are planned for the later phase when compute jobs run.",
      link: ["Safeguards roadmap", "/trust/"], next: ["see", "who"] },
    { id: "buyers", q: "Who are the buyers?", keys: ["who are the buyer", "buyers", "customer", "who use", "who pays"],
      a: "Teams with batch work that has no sensitive data, such as rendering, data processing, model evals and research simulations. We are still finding our first design partners.",
      link: ["For buyers", "/buyers/"], next: ["buy", "prices"] },
    { id: "buy", q: "I need compute. How do I start?", keys: ["need compute", "buy compute", "rent", "i have a workload", "workload", "batch job", "render", "rendering", "gpu time", "quote", "design partner", "run my job", "buyer"],
      a: "Nightshift suits batch jobs that split into small, independent pieces and hold no sensitive data. Tell us about your workload and you get a quote before anything runs. It is not a fit yet for sensitive data, live services or tightly coupled jobs.",
      link: ["Request access", "/join/?as=buyer"], next: ["prices", "buyers"] },
    { id: "prices", q: "How much does compute cost?", keys: ["price", "pricing", "cost", "how much compute", "rate", "per hour", "gpu price", "h100", "a100", "4090", "5090", "cheap"],
      a: "We quote each workload before anything runs. For reference, public trackers in late September 2026 listed typical GPU rental prices from about US$0.44/hour (RTX 4090) to US$3.25/hour (H100). Those are market benchmarks, not our prices, and most laptop GPUs are less powerful.",
      link: ["Market prices", "/buyers/#prices"], next: ["buy"] },
    { id: "founder", q: "Who is behind Nightshift?", keys: ["who is behind", "who made", "who built", "founder", "justin", "team", "who are you", "company", "smu"],
      a: "Nightshift was founded by Justin, a student at SMU in Singapore. The focus of this first phase is transparency: collecting only device state, publishing what is and isn't collected, and learning from a small group of volunteers.",
      link: ["About", "/about/"], next: ["contact", "what"] },
    { id: "cookies", q: "Does this website use cookies?", keys: ["cookie", "analytics", "posthog", "tracking website"],
      a: "The website counts page visits and button clicks with PostHog. It sets no cookies, keeps its identifier only until you close the tab, and does not record what you type into forms or into this chat.",
      link: ["Privacy notice", "/about/#privacy"], next: ["see", "who"] },
    { id: "contact", q: "How do I contact a person?", keys: ["contact", "email", "human", "person", "talk to", "speak", "reach", "help me", "support"],
      a: "Email " + mail + " and a real person will get back to you.",
      next: ["join", "what"] }
  ];
  var START = ["what", "join", "money", "see", "buy"];
  var BY = {}; KB.forEach(function (k) { BY[k.id] = k; });

  var STOP = "a an the i im i'm me my we you your it its is are am be do does did can could will would should to of in on for and or with this that there what how".split(" ");
  function stem(w) { return w.length > 4 ? w.replace(/(ing|([^s])s)$/, "$2") : w; }
  function words(s) { return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).map(stem); }
  // Each key scores by its meaningful words; a word-for-word phrase match scores by its full length instead.
  // Phrases that are mostly filler ("how does it work") only count when they appear word for word.
  KB.forEach(function (k) { k.kw = k.keys.map(function (p) { var all = words(p), w = all.filter(function (x) { return STOP.indexOf(x) < 0; }); return { w: w, phrase: " " + all.join(" ") + " ", n: all.length, strict: all.length > 1 && w.length <= 1 }; }); });

  function match(text) {
    var tw = words(text), set = {}, flat = " " + tw.join(" ") + " "; tw.forEach(function (w) { set[w] = 1; });
    var best = null, top = 0;
    KB.forEach(function (k) {
      var s = 0;
      k.kw.forEach(function (key) {
        if (key.n > 1 && flat.indexOf(key.phrase) > -1) s += key.n * 2 + 1;
        else if (!key.strict && key.w.length && key.w.every(function (w) { return set[w]; })) s += key.w.length * 2 + 1;
      });
      if (s > top) { top = s; best = k; }
    });
    return best;
  }

  function trackIt(n, d) { try { if (window.track) window.track(n, d); } catch (e) {} }

  // ---------- UI ----------
  var root = document.createElement("div");
  root.className = "nb";
  root.innerHTML =
    '<button class="nb-fab" type="button" aria-expanded="false" aria-controls="nb-panel" aria-label="Open help chat">' +
      '<svg class="nb-i nb-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/></svg>' +
      '<svg class="nb-i nb-close" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '<section class="nb-panel" id="nb-panel" role="dialog" aria-label="Nightshift help" hidden>' +
      '<header class="nb-hd"><svg width="30" height="30" viewBox="0 0 48 48" aria-hidden="true"><use href="#logo-mark"/></svg>' +
        '<div><b>Nightshift help</b><span>Answers from our FAQ and privacy notice</span></div>' +
        '<button class="nb-x" type="button" aria-label="Close help chat"><svg class="nb-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>' +
      '<div class="nb-log" role="log" aria-live="polite"></div>' +
      '<form class="nb-form"><label class="sr" for="nb-in">Ask a question</label>' +
        '<input id="nb-in" type="text" autocomplete="off" maxlength="200" placeholder="Ask about the pilot, privacy, payment...">' +
        '<button type="submit" aria-label="Send"><svg class="nb-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z"/></svg></button></form>' +
      '<p class="nb-fine">Scripted answers, not AI. Nothing you type is stored or sent.</p>' +
    "</section>";
  document.body.appendChild(root);

  var fab = root.querySelector(".nb-fab"), panel = root.querySelector(".nb-panel"), log = root.querySelector(".nb-log"),
      form = root.querySelector(".nb-form"), input = root.querySelector("#nb-in"), started = false;

  function scroll() { log.scrollTop = log.scrollHeight; }
  function bubble(cls, node) { var d = document.createElement("div"); d.className = "nb-m " + cls; d.appendChild(node); log.appendChild(d); scroll(); return d; }
  function userSays(text) { var p = document.createElement("p"); p.textContent = text; bubble("nb-u", p); }
  function botSays(html, link, chips) {
    var wrap = document.createElement("div"), p = document.createElement("p");
    p.innerHTML = html; wrap.appendChild(p);
    if (link) { var a = document.createElement("a"); a.className = "nb-link"; a.href = link[1]; a.textContent = link[0] + " →"; wrap.appendChild(a); }
    bubble("nb-b", wrap);
    if (chips && chips.length) {
      var c = document.createElement("div"); c.className = "nb-chips";
      chips.forEach(function (id) { var k = BY[id]; if (!k) return; var b = document.createElement("button"); b.type = "button"; b.textContent = k.q; b.dataset.id = id; c.appendChild(b); });
      log.appendChild(c); scroll();
    }
  }
  function answer(k, viaChip) {
    trackIt("chat_question", { id: k ? k.id : "none", chip: !!viaChip });
    if (!k) { botSays("Sorry, I don't have an answer for that yet. Email " + mail + " and a person will reply, or try one of these:", null, START); return; }
    botSays(k.a, k.link, k.next);
  }
  function respond(fn) { setTimeout(fn, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280); }

  function open() {
    panel.hidden = false; fab.setAttribute("aria-expanded", "true"); fab.setAttribute("aria-label", "Close help chat"); root.classList.add("on");
    if (!started) { started = true; botSays("Hi! I can answer common questions about the Nightshift pilot. Pick one below or type your own.", null, START); }
    trackIt("chat_open"); setTimeout(function () { input.focus(); }, 50);
  }
  function close() { panel.hidden = true; fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-label", "Open help chat"); root.classList.remove("on"); fab.focus(); }

  fab.addEventListener("click", function () { panel.hidden ? open() : close(); });
  root.querySelector(".nb-x").addEventListener("click", close);
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  log.addEventListener("click", function (e) {
    var b = e.target.closest(".nb-chips button"); if (!b) return;
    var k = BY[b.dataset.id]; b.parentNode.remove(); userSays(k.q); respond(function () { answer(k, true); });
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault(); var t = input.value.trim(); if (!t) return; input.value = "";
    var old = log.querySelectorAll(".nb-chips"); old.forEach(function (c) { c.remove(); });
    userSays(t);
    var k = /^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i.test(t) && t.split(/\s+/).length <= 3 ? "hi"
          : /^(thanks|thank you|thx|ok|okay|cool|great)\b/i.test(t) && t.split(/\s+/).length <= 3 ? "thanks" : match(t);
    respond(function () {
      if (k === "hi") botSays("Hello! What would you like to know?", null, START);
      else if (k === "thanks") botSays("You're welcome. Anything else?", null, ["join", "contact"]);
      else answer(k, false);
    });
  });
})();
