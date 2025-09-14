/* ADHELP – Liste des tickets
   - Filtres figés exactement comme demandé :
     URGENT: Oui
     STATUT: Non affecté / En cours / Résolu / Retour client
     ASSIGNÉ À: Guillaume / Samuel / Jean / Non assigné
     IMPORTANT: Oui
   - Logique de filtrage mise en phase (gestion spéciale "Non assigné")
   - Recherche AND, colonne "Créé le" sur 2 lignes, colonnes Urgent/Important
*/

/* ================================
   LISTE & FILTRES TICKETS
================================ */
(() => {
  // -----------------------------
  // Sources de données
  // -----------------------------
  const DATA_SOURCES = [
    'data/demo-data.json'
  ];

  const state = {
    all: [],
    filtered: [],
    queryTokens: [],
    selectedStatus: new Set(),
    selectedAssignees: new Set(),
    importantOnly: false,
    urgentOnly: false,
  };

  // -----------------------------
  // Utils
  // -----------------------------
  const $  = s => document.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

  function norm(str){
    return (str ?? '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu,'')
      .toLowerCase();
  }
  function uniq(arr){ return Array.from(new Set(arr)); }

  // Date -> parts
  function formatDateParts(ts){
    try{
      const d = new Date(ts);
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yy = String(d.getFullYear()%100).padStart(2,'0');
      const hh = String(d.getHours()).padStart(2,'0');
      const mi = String(d.getMinutes()).padStart(2,'0');
      return {date:`${dd}/${mm}/${yy}`, time:`${hh}:${mi}`};
    }catch{ return {date:'', time:''}; }
  }

  async function fetchJson(url){
    const r = await fetch(url, {cache:'no-store'});
    if(!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
    return r.json();
  }

  async function loadTickets(){
    const errors = [];
    for(const src of DATA_SOURCES){
      try{
        const json = await fetchJson(src);
        const arr = Array.isArray(json) ? json : json.tickets;
        if(Array.isArray(arr)) return arr;
        errors.push(`${src}: format inattendu`);
      }catch(e){
        errors.push(`${src}: ${e.message}`);
      }
    }
    throw new Error('Aucune source de tickets lisible\n' + errors.join('\n'));
  }

  // -----------------------------
  // Rendu
  // -----------------------------
  const tbody = $('#ticketsTbody');

  const STATUS_COLORS = {
    'En cours': 'b-yellow',
    'Résolu': 'b-green',
    'Non affecté': '',
    'Retour client': ''
  };

  function escapeHtml(s){
    return (s ?? '').toString()
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt')
      .replace(/>/g,'&gt')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function renderImportantIcon(isImportant){
    return isImportant ? '<span class="flag-imp" title="Important" aria-label="Important"></span>' : '';
  }
  function renderAttachmentsIcon(attachments){
    const count = Array.isArray(attachments) ? attachments.length : 0;
    return count > 0 ? `<span class="attachments-icon" title="${count} pièce(s) jointe(s)" aria-label="${count} pièces jointes">📎</span>` : '';
  }
  function renderUrgentIcon(isUrgent){
    return isUrgent ? '<span class="urgent-icon" title="Urgent" aria-label="Urgent">‼️</span>' : '';
  }

  function renderRows(rows){
    if(!rows.length){
      tbody.innerHTML = `<tr><td class="empty" colspan="7">Aucun ticket ne correspond aux filtres / recherche.</td></tr>`;
    }else{
      const html = rows.map(t => {
        const assignee = t.assignee || '—';
        const badgeCls = STATUS_COLORS[t.status] || '';
        const badge = t.status ? `<span class="badge ${badgeCls}">${t.status}</span>` : '—';
        const {date,time} = formatDateParts(t.createdAt || t.created_at || t.created || t.created_at_ms);

        return `
          <tr data-id="${t.id || ''}">
            <td class="col-ticket"><div>${t.id || ''}</div></td>
            <td class="col-subject subject-cell">
              <div><a href="#" data-ticket-id="${t.id || ''}">${escapeHtml(t.subject || '')}</a></div>
              <div class="client">${escapeHtml((t.client || '').toUpperCase())}</div>
            </td>
            <td class="col-assignee">${escapeHtml(assignee)}</td>
            <td class="col-status">${badge}</td>
            <td class="col-urgent">${renderUrgentIcon(!!t.urgent)}</td>
            <td class="col-important">${renderImportantIcon(!!t.important)}</td>
            <td class="col-date">
              <div class="date-cell"><span>${date}</span><span>${time}</span></div>
            </td>
          </tr>
        `;
      }).join('');
      tbody.innerHTML = html;
    }
  }

  // -----------------------------
  // Filtres (contenu FIXE demandé)
  // -----------------------------
  const filtersBtn   = $('#filtersBtn');
  const filtersMenu  = $('#filtersMenu');
  const btnClear     = $('#filtersClear');

  const secUrgent    = $('#secUrgent');
  const secStatus    = $('#secStatus');
  const secAssignee  = $('#secAssignee');
  const secImportant = $('#secImportant');

  const FIX_STATUSES   = ['Non affecté','En cours','Résolu','Retour client'];
  const FIX_ASSIGNEES  = ['Guillaume','Samuel','Jean','Non assigné'];

  function makeItem(type, value){
    const div = document.createElement('div');
    div.className = 'item';
    div.dataset.type = type;
    div.dataset.value = value;
    div.innerHTML = `
      <span class="tick" aria-hidden="true"></span>
      <span class="label">${escapeHtml(value)}</span>
    `;
    div.addEventListener('click', () => {
      if(type === 'urgent'){
        const next = !div.classList.contains('selected');
        state.urgentOnly = next;
        $$('.item[data-type="urgent"]', filtersMenu).forEach(el => el.classList.remove('selected'));
        if(next) div.classList.add('selected');
      }else if(type === 'important'){
        const next = !div.classList.contains('selected');
        state.importantOnly = next;
        $$('.item[data-type="important"]', filtersMenu).forEach(el => el.classList.remove('selected'));
        if(next) div.classList.add('selected');
      }else if(type === 'status'){
        toggleSet(state.selectedStatus, value, div);
      }else if(type === 'assignee'){
        toggleSet(state.selectedAssignees, value, div);
      }
      applyFilters();
    });
    return div;
  }

  function toggleSet(set, value, el){
    if(set.has(value)){
      set.delete(value);
      el.classList.remove('selected');
    }else{
      set.add(value);
      el.classList.add('selected');
    }
  }

  function buildFilterItemsFixed(){
    // URGENT
    secUrgent.innerHTML = '';
    secUrgent.append(makeItem('urgent', 'Oui'));

    // STATUT
    secStatus.innerHTML = '';
    FIX_STATUSES.forEach(v => secStatus.append(makeItem('status', v)));

    // ASSIGNÉ À
    secAssignee.innerHTML = '';
    FIX_ASSIGNEES.forEach(v => secAssignee.append(makeItem('assignee', v)));

    // IMPORTANT
    secImportant.innerHTML = '';
    secImportant.append(makeItem('important', 'Oui'));
  }

  // Ouverture/fermeture menu + reset
  filtersBtn.addEventListener('click', () => {
    filtersMenu.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if(!filtersMenu.contains(e.target) && e.target !== filtersBtn){
      filtersMenu.classList.remove('open');
    }
  });
  btnClear.addEventListener('click', () => {
    state.selectedStatus.clear();
    state.selectedAssignees.clear();
    state.importantOnly = false;
    state.urgentOnly = false;
    $$('.item', filtersMenu).forEach(el => el.classList.remove('selected'));
    applyFilters();
  });

  // -----------------------------
  // Recherche (ET)
  // -----------------------------
  const searchInput = $('#searchInput');
  searchInput.addEventListener('input', () => {
    const tokens = norm(searchInput.value).trim().split(/\s+/).filter(Boolean);
    state.queryTokens = tokens;
    applyFilters();
  });

  function matchQuery(t){
    if(state.queryTokens.length === 0) return true;
    const hay = norm([
      t.id, t.subject, t.description, t.client, t.assignee,
      ...(t.attachments || []).map(a => `${a.name ?? ''} ${a.href ?? a.url ?? ''}`)
    ].join(' '));
    return state.queryTokens.every(tok => hay.includes(tok));
  }

  // -----------------------------
  // Application des filtres
  // -----------------------------
  function applyFilters(){
    const rows = state.all.filter(t => {
      if(state.urgentOnly && !t.urgent) return false;
      if(state.importantOnly && !t.important) return false;

      if(state.selectedStatus.size && !state.selectedStatus.has(t.status)) return false;

      const aKey = (t.assignee && t.assignee.trim()) ? t.assignee : 'Non assigné';
      if(state.selectedAssignees.size && !state.selectedAssignees.has(aKey)) return false;

      if(!matchQuery(t)) return false;

      return true;
    });

    state.filtered = rows;
    renderRows(rows);
  }

  // -----------------------------
  // Init
  // -----------------------------
  async function init(){
    // Boutons création rapides
    const quickAddBtn = document.getElementById('quickAddTicket');
    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.openTicketModal) {
          window.openTicketModal({
            id: 'Nouveau',
            subject: '',
            client: '',
            assignee: '',
            status: 'Non affecté',
            urgent: false,
            important: false,
            description: '',
            rappel: false,
            billable: false
          });
        }
      });
    }

    const createBtn = document.getElementById('createBtn');
    if (createBtn) {
      createBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.openTicketModal) {
          window.openTicketModal({
            id: 'Nouveau',
            subject: '',
            client: '',
            assignee: '',
            status: 'Non affecté',
            urgent: false,
            important: false,
            description: '',
            rappel: false,
            billable: false
          });
        }
      });
    }

    const quickAddSupport = document.getElementById('quickAddSupport');
    if (quickAddSupport) {
      quickAddSupport.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Remplir le créateur si possible, sinon valeur de secours
        const creator = document.getElementById('supportCreator');
        if (creator) creator.value = (window.currentUser?.firstName) || (window.user?.firstName) || creator.value || 'prénomtech';

        // Forcer l'intitulé PEC si besoin
        const titleEl = document.getElementById('supportTitle');
        if (titleEl && !/^PEC/.test(titleEl.textContent)) titleEl.textContent = 'PECxxx';

        document.getElementById('supportModal').style.display = 'flex';
      });
    }

    const closeSupportModal = document.getElementById('closeSupportModal');
    const supportModal = document.getElementById('supportModal');

    if (closeSupportModal) {
      closeSupportModal.addEventListener('click', () => {
        supportModal.style.display = 'none';
      });
    }

    if (supportModal) {
      supportModal.addEventListener('click', (e) => {
        if (e.target === supportModal) {
          supportModal.style.display = 'none';
        }
      });
    }

    const quickAddArticle = document.getElementById('quickAddArticle');
    if (quickAddArticle) {
      quickAddArticle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.openArticleModal) {
          window.openArticleModal();
        } else {
          const articleModal = document.getElementById('articleModal');
          if (articleModal) articleModal.style.display = 'flex';
        }
      });
    }

    try{
      const data = await loadTickets();
      state.all = data.map(t => ({
        id: t.id ?? t.code ?? '',
        subject: t.subject ?? t.title ?? '',
        client: t.client ?? t.customer ?? '',
        assignee: t.assignee ?? t.assigned_to ?? (t.assigned || ''),
        status: t.status ?? '',
        urgent: !!(t.urgent || t.is_urgent),
        important: !!(t.important || t.flag || t.is_important),
        createdAt: t.createdAt ?? t.created_at ?? t.created ?? t.created_at_ms ?? Date.now(),
        description: t.description ?? '',
        attachments: Array.isArray(t.attachments) ? t.attachments : [],
        history: Array.isArray(t.history) ? t.history : []
      }));

      buildFilterItemsFixed();
      applyFilters();
    }catch(e){
      console.error('[tickets] échec chargement:', e);
      $('#ticketsTbody').innerHTML =
        `<tr><td class="empty" colspan="7">Impossible de charger les tickets.</td></tr>`;
    }
  }

  // Exposer le state pour la modal
  window.ticketsState = state;

  // Exposer une fonction pour récupérer un ticket par ID
  window.getTicketById = function(id) {
    return state.all.find(ticket => ticket.id === id);
  };

  // Système de pile pour les modals ticket
  window.ticketModalStack = [];

  init();
})();

/* ================================
   MODAL SUGGESTIONS (IA)
================================ */
(function () {
  const btn     = document.getElementById('btnSuggestions');
  const modal   = document.getElementById('suggestionsModal');
  const listEl  = document.getElementById('suggestionsList');
  const btnClose= document.getElementById('closeSuggestionsModal');

  if (!modal || !listEl) return;

  function openSuggestions() {
    const id = document.getElementById('ticketId')?.textContent?.trim();
    const t  = (window.getTicketById ? window.getTicketById(id) : null) || {};

    const suggestions = [];
    if (t.urgent) suggestions.push("🚨 Contacter immédiatement le client et planifier un créneau d'intervention.");
    if ((t.attachments || []).length > 0) suggestions.push("📎 Parcourir les pièces jointes pour repérer des logs/erreurs utiles.");
    if (!t.assignee) suggestions.push("👤 Assigner le ticket à un technicien disponible.");
    suggestions.push("📝 Documenter les actions réalisées dans la description du ticket.");

    listEl.innerHTML = suggestions.map(s =>
      `<div style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${s}</div>`
    ).join('');

    window.modalZIndexCounter = window.modalZIndexCounter || 1000;
    window.modalZIndexCounter++;
    modal.style.zIndex = window.modalZIndexCounter;
    modal.style.display = 'flex';
  }

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSuggestions();
    });
  }

  btnClose?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
})();

/* ================================
   MODALE TICKET (ouvrir / dirty / save / offline / temps manuel)
================================ */
(function () {
  var modalEl     = document.getElementById('ticketModal');
  if (!modalEl) return;

  var idEl        = document.getElementById('ticketId');
  var clientEl    = document.getElementById('ticketClient');
  var contactEl   = document.getElementById('ticketContact');
  var subjectEl   = document.getElementById('ticketSubject');
  var urgentEl    = document.getElementById('ticketUrgent');
  var assigneeEl  = document.getElementById('ticketAssignee');
  var statusEl    = document.getElementById('ticketStatus');
  var descEl      = document.getElementById('ticketDescription'); // contenteditable
  var btnSave     = modalEl.querySelector('.row-actions .btn-save');
  var btnTime     = document.getElementById('btnTimeManual');

  // --- Suivi de modifications + cache local (offline) ---
  var ticketDirty = false;
  var suspendDirty = false; // empêche de marquer "dirty" pendant l'hydratation
  var manualResolutionTime = null; // "HH:MM" si saisi via ⏱

  var LS_KEY = 'ADHELP_pendingTickets';

  function getPendingTickets(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch { return []; }
  }
  function setPendingTickets(list){
    localStorage.setItem(LS_KEY, JSON.stringify(list || []));
  }
  function addPendingTicket(entry){
    var list = getPendingTickets();
    list.push(entry);
    setPendingTickets(list);
  }
  function makeTempId(){ return 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2,8); }

  function showToastInTicket(message){
    if(!modalEl) return;
    var toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position:'absolute', right:'16px', bottom:'16px',
      background:'#0b121e', color:'#fff', padding:'10px 12px',
      borderRadius:'8px', fontSize:'13px', boxShadow:'0 6px 18px rgba(0,0,0,.25)',
      zIndex:'1001', opacity:'0', transform:'translateY(8px)', transition:'all .2s ease'
    });
    modalEl.appendChild(toast);
    requestAnimationFrame(function(){
      toast.style.opacity='1'; toast.style.transform='translateY(0)';
    });
    setTimeout(function(){
      toast.style.opacity='0'; toast.style.transform='translateY(8px)';
      setTimeout(function(){ toast.remove(); }, 200);
    }, 2500);
  }

function confirmBeforeClose(onSave, onDiscard){
  const overlay = document.getElementById("unsavedConfirm");
  const btnNo   = document.getElementById("unsavedNo");
  const btnYes  = document.getElementById("unsavedYes");

  overlay.style.display = "flex";
  // Assure que la modale de confirmation passe au-dessus de la modale Ticket
  const z = parseInt((modalEl && modalEl.style.zIndex) || 1000, 10);
  overlay.style.zIndex = String(z + 1);

  function cleanup() {
    overlay.style.display = "none";
    btnNo.removeEventListener("click", onNo);
    btnYes.removeEventListener("click", onYes);
  }
  function onNo()  { cleanup(); if (onDiscard) onDiscard(); }
  function onYes() { cleanup(); if (onSave)   onSave(); }

  btnNo.addEventListener("click", onNo,  { once:true });
  btnYes.addEventListener("click", onYes, { once:true });
}

  function collectTicketPayload(){
    var atts = (window.attachmentsManagerTicket && window.attachmentsManagerTicket.getAttachments
               ? window.attachmentsManagerTicket.getAttachments() : []);
    return {
      id: (idEl && idEl.textContent || '').trim(),
      client: clientEl ? clientEl.value : '',
      contact: contactEl ? contactEl.value : '',
      subject: subjectEl ? subjectEl.value : '',
      urgent: !!(urgentEl && urgentEl.checked),
      assignee: assigneeEl ? assigneeEl.value : '',
      status: statusEl ? statusEl.value : '',
      description: descEl ? descEl.innerHTML : '',
      attachments: atts,
      resolutionManualTime: manualResolutionTime // peut être null
    };
  }

  function markDirty(){ if(!suspendDirty) ticketDirty = true; }

  function attachDirtyListenersOnce(){
    clientEl  && clientEl.addEventListener('change', markDirty);
    contactEl && contactEl.addEventListener('change', markDirty);
    subjectEl && subjectEl.addEventListener('input',  markDirty);
    urgentEl  && urgentEl.addEventListener('change', markDirty);
    assigneeEl&& assigneeEl.addEventListener('change', markDirty);
    statusEl  && statusEl.addEventListener('change', markDirty);
    descEl    && descEl.addEventListener('input',  markDirty);
  }

  function handleSaveAndClose(){
    var payload = collectTicketPayload();

    if(navigator.onLine){
      // Simulation succès immédiat (backend à brancher plus tard)
      ticketDirty = false;
      manualResolutionTime = null;
      modalEl.style.display = 'none';
      showToastInTicket('Modifications enregistrées');
      return;
    }

    // Hors-ligne → stockage local
    addPendingTicket({
      tempId: makeTempId(),
      ticketId: payload.id || 'Nouveau',
      payload: payload,
      createdAt: new Date().toISOString(),
      lastTriedAt: null,
      status: 'pending'
    });
    ticketDirty = false;
    manualResolutionTime = null;
    modalEl.style.display = 'none';
    showToastInTicket('Hors connexion — sauvegardé localement, synchro auto à la reconnexion');
  }

  function tryResyncPendingTickets(){
    if(!navigator.onLine) return;
    var list = getPendingTickets();
    if(!list.length) return;
    // Simulation d’une synchro réussie
    setTimeout(function(){
      setPendingTickets([]);
    }, 300);
  }
  window.addEventListener('online', tryResyncPendingTickets);

  function setSelect(sel, value) {
    if (!sel) return;
    var v = (value ?? '').toString();
    for (var i = 0; i < sel.options.length; i++) {
      if ((sel.options[i].value ?? '') === v) { sel.selectedIndex = i; return; }
    }
    var norm = function (s) { try { return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); } catch(e){ return (s||'').toLowerCase().trim(); } };
    var nv = norm(v);
    for (var j = 0; j < sel.options.length; j++) {
      if (norm(sel.options[j].textContent) === nv) { sel.selectedIndex = j; return; }
    }
  }

  // === Ouverture / remplissage ===
  function openTicketModal(ticket) {
    if (!ticket) return;

    // Pile de navigation
    if (window.ticketModalStack && window.ticketModalStack.length === 0) {
      window.ticketModalStack.push(ticket);
    }

    suspendDirty = true;
    ticketDirty = false;
    manualResolutionTime = null;

    if (idEl)       idEl.textContent = ticket.id || '';
    if (clientEl)   setSelect(clientEl,  ticket.client || ticket.customer || '');
    if (contactEl)  setSelect(contactEl, ticket.contact || '');
    if (subjectEl)  subjectEl.value = ticket.subject || ticket.sujet || '';
    if (urgentEl)   urgentEl.checked = !!ticket.urgent;
    if (assigneeEl) setSelect(assigneeEl, ticket.assignee || ticket.assign || '');
    if (statusEl)   setSelect(statusEl,   ticket.status || '');
    if (descEl)     descEl.innerHTML = ticket.description || '';

    if (window.attachmentsManagerTicket) {
      const atts = Array.isArray(ticket.attachments) ? ticket.attachments : [];
      window.attachmentsManagerTicket.hydrate(atts, { clear: true });
      window.attachmentsManagerTicket.setTicketId(ticket.id || '');
    }

    suspendDirty = false;
    attachDirtyListenersOnce();

    window.modalZIndexCounter = window.modalZIndexCounter || 1000;
    window.modalZIndexCounter++;
    modalEl.style.zIndex = window.modalZIndexCounter;
    modalEl.style.display = 'flex';
  }

  function openEmptyTicketModal() {
    suspendDirty = true;
    ticketDirty = false;
    manualResolutionTime = null;

    if (idEl)       idEl.textContent = 'Nouveau';
    if (clientEl)   clientEl.selectedIndex = 0;
    if (contactEl)  contactEl.selectedIndex = 0;
    if (subjectEl)  subjectEl.value = '';
    if (urgentEl)   urgentEl.checked = false;
    if (assigneeEl) assigneeEl.selectedIndex = 0;
    if (statusEl)   setSelect(statusEl, 'nouveau');
    if (descEl)     descEl.innerHTML = '';

    if (window.attachmentsManagerTicket) {
      window.attachmentsManagerTicket.reset();
      window.attachmentsManagerTicket.setTicketId('Nouveau');
    }

    suspendDirty = false;
    attachDirtyListenersOnce();

    window.modalZIndexCounter = window.modalZIndexCounter || 1000;
    window.modalZIndexCounter++;
    modalEl.style.zIndex = window.modalZIndexCounter;
    modalEl.style.display = 'flex';
  }

  // Exposer pour l’extérieur
  window.openTicketModal = openTicketModal;
  window.openNewTicketModal = openEmptyTicketModal;

  // Clic sur ligne du tableau → ouvre
  var tbody = document.getElementById('ticketsTbody');
  if (tbody) {
    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]');
      var a  = e.target.closest('a[data-ticket-id]');
      var id = tr ? tr.getAttribute('data-id') : (a ? a.getAttribute('data-ticket-id') : null);
      if (!id) return;
      e.preventDefault();
      var t = (window.getTicketById && window.getTicketById(id)) || null;
      if (t) openTicketModal(t);
    }, true);
  }

  // Boutons “Créer un ticket”
  var createBtn = document.getElementById('createBtn');
  if (createBtn) {
    createBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openEmptyTicketModal();
    });
  }
  var quickAdd = document.getElementById('quickAddTicket');
  if (quickAdd) {
    quickAdd.addEventListener('click', function (e) {
      e.preventDefault();
      openEmptyTicketModal();
    });
  }

// Gestion fermeture (croix & clic fond) avec confirmation si dirty
var closeBtn = modalEl.querySelector('.close-btn');
function requestClose(){
  if (!ticketDirty){
    modalEl.style.display = 'none';
    return;
  }
  confirmBeforeClose(
    () => handleSaveAndClose(),                                  // Enregistrer
    () => { ticketDirty=false; modalEl.style.display='none'; }   // Ne pas enregistrer
  );
}
closeBtn && closeBtn.addEventListener('click', (e) => { e.preventDefault(); requestClose(); });
modalEl.addEventListener('click', function (e) {
  if (e.target === modalEl) requestClose();
});

  // Bouton Enregistrer
  btnSave && btnSave.addEventListener('click', function(e){
    e.preventDefault();
    handleSaveAndClose();
  });

  // Bouton Temps manuel (⏱)
  if (btnTime) {
    btnTime.addEventListener('click', function () {
      const saisie = prompt('Saisir le temps passé (format HH:MM) :', '01:30');
      if (!saisie) return;
      manualResolutionTime = saisie.trim();
      ticketDirty = true; // une saisie manuelle est une modif
      console.log('⏱ Temps manuel saisi :', manualResolutionTime);
      showToastInTicket('Temps de résolution manuel pris en compte');
    });
  }

  // Re-synchro si on revient online
  tryResyncPendingTickets();
})();

/* ================================
   MODALE PRISE EN CHARGE (supportModal)
================================ */
document.addEventListener('DOMContentLoaded', function(){
  const supportModal     = document.getElementById('supportModal');
  const closeSupportModal= document.getElementById('closeSupportModal');
  const openSupportBtn   = document.getElementById('openSupportModal'); // optionnel
  const toggleLock       = document.getElementById('toggleSupportLock');

  function resetSupportForm() {
    const clientSel  = document.getElementById('supportClient');
    const contactSel = document.getElementById('supportContact');
    if (clientSel)  clientSel.selectedIndex  = 0;
    if (contactSel) contactSel.selectedIndex = 0;

    [
      'supportMaterial',
      'supportSerial',
      'supportPassword',
      'supportAccessories',
      'supportClientRequest',
      'supportAction'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = '';
      if (id === 'supportPassword') {
        el.readOnly = false;
        el.type = 'text';
      }
    });

    const lock = document.getElementById('toggleSupportLock');
    if (lock) {
      lock.setAttribute('aria-pressed', 'false');
      lock.textContent = '🔓';
      lock.title = 'Verrouiller le mot de passe';
    }
  }

  if (toggleLock) {
    toggleLock.addEventListener('click', () => {
      const pwdInput = document.getElementById('supportPassword');
      if (!pwdInput) return;

      const isLocked = toggleLock.getAttribute('aria-pressed') === 'true';

      if (isLocked) {
        toggleLock.setAttribute('aria-pressed', 'false');
        toggleLock.textContent = '🔓';
        toggleLock.title = 'Verrouiller le mot de passe';
        pwdInput.readOnly = false;
        pwdInput.type = 'text';
      } else {
        toggleLock.setAttribute('aria-pressed', 'true');
        toggleLock.textContent = '🔒';
        toggleLock.title = 'Déverrouiller le mot de passe';
        pwdInput.readOnly = true;
        pwdInput.type = 'password';
      }
    });
  }
  // --- Bouton email (📧) dans la modale Prise en charge ---
  const btnSupportEmail = document.getElementById('supportContactEmail');
  if (btnSupportEmail) {
    btnSupportEmail.addEventListener('click', (e) => {
      e.preventDefault();
      const sel = document.getElementById('supportContact');
      const opt = sel && sel.options[sel.selectedIndex];
      const email = opt ? (opt.dataset.email || '').trim() : '';

      if (!email) {
        alert("Aucun email trouvé pour le contact sélectionné.");
        return;
      }

      const subject = encodeURIComponent(
        (document.getElementById('supportTitle')?.textContent || 'PEC').trim()
      );
      const body = ''; // laisse vide ou préremplis si tu veux
      // Ouvre le client mail
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${encodeURIComponent(body)}`;
    });
  }
  
  if (openSupportBtn && supportModal) {
    openSupportBtn.addEventListener('click', () => {
      const creator = document.getElementById('supportCreator');
      if (creator) creator.value = (window.currentUser?.firstName) || (window.user?.firstName) || creator.value || 'prénomtech';

      const titleEl = document.getElementById('supportTitle');
      if (titleEl && !/^PEC/.test(titleEl.textContent)) titleEl.textContent = 'PECxxx';

      supportModal.style.display = 'flex';
    });
  }

  if (closeSupportModal && supportModal) {
    closeSupportModal.addEventListener('click', () => {
      supportModal.style.display = 'none';
      resetSupportForm();
    });
  }

  if (supportModal) {
    supportModal.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'supportModal') {
        supportModal.style.display = 'none';
        resetSupportForm();
      }
    });
  }
});

/* ================================
   MODALE HISTORIQUE TICKET (unique)
================================ */
(function(){
  const historyModal   = document.getElementById('ticketHistoryModal');
  const btnClose       = document.getElementById('closeTicketHistoryModal');
  const historyList    = document.getElementById('ticketHistoryList');
  const historySummary = document.getElementById('ticketResolutionSummary');
  const btnOpenHistory = document.getElementById('btnOpenTicketHistory');

  if (!historyModal || !historyList || !historySummary) return;

  function pad2(n){ return String(n).padStart(2,'0'); }
  function fmtDateTime(ts){
    try{
      const d = (ts instanceof Date) ? ts : new Date(ts);
      return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)} à ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }catch{ return ''; }
  }

  // Stub calcul du temps total (sera branché plus tard)
  function computeResolutionDuration(history){
    return null;
  }

  function renderHistory(ticket){
    historyList.innerHTML = '';
    historySummary.textContent = '';

    const history = Array.isArray(ticket?.history) ? ticket.history : [];
    if (history.length === 0){
      historyList.innerHTML = `<div style="color:#6b7280; padding:6px 8px;">Aucune activité enregistrée</div>`;
      return;
    }

    const rows = history.map((ev) => {
      const when = fmtDateTime(ev.at);
      const by   = ev.by ? ` par ${ev.by}` : '';
      let line   = '';

      switch (ev.type){
        case 'created':
          line = `${when} — Ticket créé${by}`;
          break;
        case 'assigned':
          line = `${when} — Assigné à "${ev?.payload?.assignee || '—'}"${by}`;
          break;
        case 'status':
          if (ev?.payload?.to === 'Résolu'){
            line = `${when} — Ticket résolu${by}`;
          } else {
            line = `${when} — Statut modifié sur "${ev?.payload?.to ?? '—'}"${by}`;
          }
          break;
        case 'comment':
          line = `${when} — Commentaire ajouté${by}`;
          break;
        default:
          line = `${when} — ${ev.type || 'Événement'}${by}`;
      }

      return `<div class="history-row" style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">${line}</div>`;
    });

    historyList.innerHTML = rows.join('');

    const duration = computeResolutionDuration(history);
    if (duration?.text){
      historySummary.textContent = `Temps total de résolution : ${duration.text}`;
    }
  }

  function getCurrentOpenTicket(){
    const id = document.getElementById('ticketId')?.textContent?.trim();
    if (!id) return null;
    return (window.getTicketById ? window.getTicketById(id) : null);
  }

  function openHistory(){
    const ticket = getCurrentOpenTicket();
    if (!ticket){
      alert('Aucun ticket ouvert.');
      return;
    }
    renderHistory(ticket);

    window.modalZIndexCounter = window.modalZIndexCounter || 1000;
    window.modalZIndexCounter++;
    historyModal.style.zIndex = window.modalZIndexCounter;
    historyModal.style.display = 'flex';
  }

  function closeHistory(){
    historyModal.style.display = 'none';
  }

  btnOpenHistory?.addEventListener('click', (e) => {
    e.preventDefault();
    openHistory();
  });

  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    closeHistory();
  });

  historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) closeHistory();
  });

  document.addEventListener('keydown', (e) => {
    if (historyModal.style.display === 'flex' && e.key === 'Escape') {
      closeHistory();
    }
  });
})();