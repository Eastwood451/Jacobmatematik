(() => {
  'use strict';
  let installPrompt = null;
  const standalone = window.matchMedia('(display-mode: standalone)');
  function updateInstalled(installed = standalone.matches || navigator.standalone === true) {
    document.documentElement.classList.toggle('app-installed', installed);
  }
  updateInstalled();
  standalone.addEventListener('change', () => updateInstalled());
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    updateInstalled(true);
    document.getElementById('install-app-dialog')?.close();
  });
  function showInstructions() {
    let dialog = document.getElementById('install-app-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'install-app-dialog';
      dialog.setAttribute('aria-labelledby', 'install-app-title');
      const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const samsung = /SamsungBrowser/.test(navigator.userAgent);
      dialog.innerHTML = `<h2 id="install-app-title">Installer Jacobmatematik</h2><p>Få Jacobmatematik som en app på din hjemmeskærm.</p>${apple
        ? '<ol><li>Tryk på browserens <strong>Del</strong>-knap (firkanten med en pil op).</li><li>Vælg <strong>Føj til hjemmeskærm</strong>. Tryk eventuelt på <strong>Mere</strong> først.</li><li>Slå <strong>Åbn som webapp</strong> til, hvis valget vises, og tryk <strong>Tilføj</strong>.</li></ol><p>Kan du ikke finde valget? Åbn jacobmatematik.dk i Safari og følg trinnene.</p>'
        : samsung
          ? '<ol><li>Åbn browserens menu <strong>☰</strong>.</li><li>Vælg <strong>Føj side til → Startskærm</strong> eller <strong>Installer app</strong>.</li><li>Bekræft installationen.</li></ol>'
          : '<ol><li>Åbn browserens menu <strong>⋮</strong>.</li><li>Vælg <strong>Installer app</strong> eller <strong>Føj til startskærm</strong>.</li><li>Tryk <strong>Installer</strong> eller <strong>Tilføj</strong>.</li></ol><p>Hvis valget mangler, så åbn jacobmatematik.dk i Chrome eller Safari. På computer kan installation også findes i adresselinjen.</p>'}<form method="dialog"><button class="btn" autofocus>Luk</button></form>`;
      document.body.append(dialog);
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      });
    }
    if (!dialog.open) dialog.showModal();
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-install-app]');
    if (!button) return;
    if (!installPrompt) { showInstructions(); return; }
    const prompt = installPrompt;
    installPrompt = null;
    button.disabled = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      showInstructions();
    } finally {
      button.disabled = false;
    }
  });
})();
