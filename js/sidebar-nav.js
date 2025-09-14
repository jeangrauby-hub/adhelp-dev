// js/sidebar-nav.js — Navigation de la sidebar (SPA)
(() => {
  const NAV_TO_VIEW = {
    tickets: 'ticketsView',
    kb: 'kbView',
    clients: 'clientsView',
    notifications: 'notificationsView',
    reports: 'reportsView',
    settings: 'settingsView',
    support: 'supportView'
  };

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  function closeFiltersIfOpen(){
    const fm = $('#filtersMenu');
    if (fm && fm.classList.contains('open')) fm.classList.remove('open');
  }

  function showView(key){
    const viewId = NAV_TO_VIEW[key];
    if (!viewId) return;

    // toggle vues
    $$('.view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById(viewId);
    if (v) v.classList.add('active');

    // toggle lien actif
    $$('.nav a[data-nav]').forEach(a => a.classList.remove('active'));
    const link = $(`.nav a[data-nav="${key}"]`);
    if (link) link.classList.add('active');

    closeFiltersIfOpen();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // clics sur la sidebar
    $$('.nav a[data-nav]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const key = a.getAttribute('data-nav');
        if (!key) return;
        location.hash = key;   // deep-link
        showView(key);
      });
    });

    // routing par hash (au chargement + changement)
    function handleHash(){
      const key = (location.hash || '#tickets').replace(/^#/, '');
      showView(key);
    }
    window.addEventListener('hashchange', handleHash);
    handleHash();
  });
})();