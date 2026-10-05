// Home page product film: plays silently while on screen, pauses when scrolled away.
// Never autoplays for people who prefer reduced motion; they can press play.
(function () {
  var v = document.getElementById("fv"); if (!v) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, userPaused = false, started = false;
  v.addEventListener("play", function () { if (!started) { started = true; if (window.track) window.track("film_play"); } });
  v.addEventListener("pause", function () { if (!v.dataset.auto) userPaused = true; delete v.dataset.auto; });
  v.addEventListener("ended", function () { if (window.track) window.track("film_complete"); });
  // Browsers only autoplay muted video, so offer sound as a one-tap toggle (synced with the native volume control).
  var snd = document.getElementById("fsnd");
  function syncSound() { var on = !v.muted; snd.setAttribute("aria-pressed", on); snd.lastChild.textContent = on ? "Sound off" : "Sound on"; snd.classList.toggle("is-on", on); }
  if (snd) {
    snd.addEventListener("click", function () {
      v.muted = !v.muted;
      if (!v.muted) { userPaused = false; if (v.paused) v.play().catch(function () {}); if (window.track) window.track("film_sound_on"); }
    });
    v.addEventListener("volumechange", syncSound); syncSound();
  }
  if (reduce || !("IntersectionObserver" in window)) { v.loop = false; return; }
  new IntersectionObserver(function (e) {
    if (e[0].isIntersecting) { if (!userPaused) v.play().catch(function () {}); }
    else if (!v.paused) { v.dataset.auto = "1"; v.pause(); }
  }, { threshold: .5 }).observe(v);
})();
