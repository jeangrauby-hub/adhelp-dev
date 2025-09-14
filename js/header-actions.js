// js/header-actions.js
(function () {
  // Ouvre la modale "Prise en charge" en cliquant une ligne du tableau.
  // (La gestion de la modale Meet + recherche contacts est centralisée dans settings.js)
  document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('supportTbody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
      // Laisse les liens PJ se comporter normalement
      if (e.target.closest('a[href]')) return;

      const row = e.target.closest('tr');
      if (!row) return;

      // Déclenche l'ouverture de la modale Prise en charge
      document.getElementById('quickAddSupport')?.click();
    });
  });
})();