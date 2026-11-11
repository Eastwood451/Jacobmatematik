/* Registers the offline fallback. Online pages are still loaded from the network. */
(() => {
  "use strict";
  const host = location.hostname;
  if (!["jacobmatematik.dk", "www.jacobmatematik.dk", "localhost", "127.0.0.1"].includes(host)) return;
  if (!("serviceWorker" in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", register);
  else register();
})();
