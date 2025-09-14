/* === Historique Ticket : ouverture/fermeture + rendu (autonome) === */

(function () {
  function getTicketById(id) {
    if (window.getTicketById) return window.getTicketById(id);
    // fallback si non exposé
    const all = (window.ticketsState && window.ticketsState.all) || [];
    return all.find(t => String(t.id) === String(id));
  }

  function openHistoryModalFor(ticketId) {
    const ticket = getTicketById(ticketId);
    const modal = document.getElementById('ticketHistoryModal');
    const list  = document.getElementById('ticketHistoryList');
    const sum   = document.getElementById('ticketResolutionSummary');

    if (!modal) { console.warn('[History] #ticketHistoryModal manquant'); return; }

    // Nettoyage
    if (list) list.innerHTML = '';
    if (sum)  sum.textContent = '';

    // Hydratation
    const events = Array.isArray(ticket?.history) ? ticket.history : [];
    if (list) {
      if (events.length === 0) {
        list.innerHTML = '<div class="history-row" style="color:#6b7280">Aucun historique pour ce ticket.</div>';
      } else {
        list.innerHTML = events.map(ev =>
          `<div class="history-row">${ev.date} à ${ev.time} — ${ev.text}</div>`
        ).join('');
      }
    }
    // Résumé si résolu
    if (sum && ticket?.resolution?.totalText) {
      sum.textContent = `Temps total de résolution : ${ticket.resolution.totalText}`;
    }

    // Afficher
    modal.style.display = 'flex';
    window.modalZIndexCounter = (window.modalZIndexCounter || 1000) + 1;
    modal.style.zIndex = window.modalZIndexCounter;
  }

  // Click global
  document.addEventListener('click', function (e) {
    // Ouvrir via bouton dans la modale Ticket
    if (e.target && e.target.id === 'btnOpenTicketHistory') {
      e.preventDefault();
      const ticketId = document.getElementById('ticketId')?.textContent?.trim() || '';
      if (!ticketId) return;
      openHistoryModalFor(ticketId);
      return;
    }

    // Fermer
    if (e.target && e.target.id === 'closeTicketHistoryModal') {
      e.preventDefault();
      const modal = document.getElementById('ticketHistoryModal');
      if (modal) modal.style.display = 'none';
      return;
    }
  });
})();