(function () {
// ===== BOOT DEBUG =====
window.ADHELP = window.ADHELP || {};
ADHELP.__boot = (ADHELP.__boot || 0) + 1;
ADHELP.log = (...a)=>console.log('[ADHELP]', ...a);
window.addEventListener('error', e => {
  console.error('[settings.js ERROR]', e.message, 'at', e.filename+':'+e.lineno+':'+e.colno);
});
console.log('[settings] script chargé (top)');
// ======================

// Toujours définir un tableau par défaut pour éviter les accès undefined
window.contactsData = window.contactsData || [];

// --- utilitaires ---
const USE_CANONICAL_DATA = false; // ← legacy JSON tant que *.store.js sont 404
  function fetchJSON(url){ return fetch(url, {cache:'no-store'}).then(r=>r.json()); }
  function clearOptions(sel){ while (sel && sel.options && sel.options.length > 1) sel.remove(1); }
  function opt(value, label){ const o=document.createElement('option'); o.value=String(value??''); o.textContent=label??''; return o; }
  const U = (s)=> (s||'').toUpperCase();
  const fullName = (ct)=> [U(ct.nom||''), ct.prenom||''].filter(Boolean).join(' ');

  const norm = (s) =>
    (s || '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();

  // === Helper global : charge clients & contacts (legacy ou unifié) ===
  function getClientsAndContacts(){
    if (!USE_CANONICAL_DATA) {
      // Flux actuel (legacy)
      return Promise.all([
        fetchJSON('data/clients.json'),
        fetchJSON('data/contacts.json')
      ]).then(([C, K]) => {
        const clients  = Array.isArray(C) ? C : (C.clients || []);
        const contacts = Array.isArray(K) ? K : (K.contacts || []);
        return [clients, contacts];
      });
    } else {
      // Flux base unifiée — mappé au format attendu par l’app
      return Promise.resolve().then(async () => {
        const unifiedClients  = await (window.DataClients?.getAll?.()  || Promise.resolve([]));
        const unifiedContacts = await (window.DataContacts?.getAll?.() || Promise.resolve([]));
        const clients  = mapUnifiedClientsToLegacy(unifiedClients);
        const contacts = mapUnifiedContactsToLegacy(unifiedContacts);
        return [clients, contacts];
      });
    }
  }

  function populateClients(selectEl, clients) {
    
    if (!selectEl) return;
    clearOptions(selectEl);
    const sorted = [...clients].sort((a,b)=> (a.nom||'').localeCompare((b.nom||''), 'fr', {sensitivity:'base'}));
    for (const c of sorted) selectEl.appendChild(opt(c.id, U(c.nom||'')));
  }

  function populateContacts(selectEl, clientId, contacts) {
    if (!selectEl) return;
    clearOptions(selectEl);
    if (!clientId) return;
const list = contacts
  .filter(ct => String(ct.clientId) === String(clientId))
  .sort((a,b) => (a.nom||'').localeCompare((b.nom||''), 'fr', {sensitivity:'base'}));
        for (const ct of list) selectEl.appendChild(opt(ct.id, fullName(ct)));
  }

  // Tous les contacts quand aucun client n'est choisi
  function populateAllContacts(selectEl, contacts) {
    if (!selectEl) return;
    clearOptions(selectEl);
const list = [...contacts].sort((a,b) => (a.nom||'').localeCompare((b.nom||''), 'fr', {sensitivity:'base'}));
        for (const ct of list) selectEl.appendChild(opt(ct.id, fullName(ct)));
  }

  function findContactById(contacts, id){
    return contacts.find(c => String(c.id) === String(id));
  }
  function getPhoneFixe(c){ return c?.phone ?? c?.telephone ?? c?.fixe ?? ''; }
  function getMobile(c){ return c?.mobile ?? c?.portable ?? ''; }
  function getEmail(c){ return c?.email ?? c?.mail ?? ''; }


// --- Helper unique pour le bouton email ---
// Pas de clonage (évite les références mortes).
// Neutralise tout mailto:, attache un SEUL handler en capture,
// et met à jour l'adresse via data-* à chaque appel.
function bindEmailButton(btn, email){
  if (!btn) return;

  const mail = String(email || '').trim().replace(/^mailto:/i, '');
  const hasMail = !!mail;

  // Neutraliser tout mailto: sur le bouton et ses enfants
  if (btn.getAttribute && /^mailto:/i.test(btn.getAttribute('href') || '')) {
    btn.setAttribute('href', '#');
  }

  btn.querySelectorAll?.('a[href^="mailto:"]').forEach(a => a.setAttribute('href', '#'));

// État visuel
btn.style.opacity = hasMail ? '1' : '0.5';
btn.style.pointerEvents = hasMail ? 'auto' : 'none';
console.log("[bindEmailButton]", { hasMail, mail });

  // Stocker l’email courant pour le handler (sera rafraîchi à chaque appel)
  btn.dataset.toEmail = mail;

  // Attacher le handler UNE SEULE fois, en capture, et couper la propagation
  if (btn.dataset.emailBound !== '1') {
    btn.dataset.emailBound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const m = btn.dataset.toEmail || '';
      if (!m) return;

      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);
      if (!ok) { alert("Adresse e-mail invalide : " + m); return; }

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(m)}`;
      window.open(gmailUrl, '_blank');
      return false;
    }, { capture: true, passive: false });
  }
}

// --- Helper unique pour les boutons téléphone (fixe & mobile) ---
function bindTelButton(btn, tel){
  if (!btn) return;
  const raw = String(tel || '');
  const clean = raw.replace(/[^\d+]/g, ''); // 05.61.78 -> 056178...

  // État visuel + blocage si vide
  btn.style.opacity = clean ? '1' : '0.5';
  btn.style.pointerEvents = clean ? 'auto' : 'none';
  console.log("[bindTelButton]", { hasNumber: !!clean, number: clean });

  // Neutraliser un éventuel href="tel:" présent dans le markup
  if (btn.getAttribute && /^tel:/i.test(btn.getAttribute('href') || '')) {
    btn.setAttribute('href', '#');
  }
  btn.querySelectorAll?.('a[href^="tel:"]').forEach(a => a.setAttribute('href', '#'));

  // Stocker le numéro courant pour le handler
  btn.dataset.telBound = clean || '';

  // Attacher le handler UNE seule fois, en capture
  if (btn.dataset.telHandler !== '1') {
    btn.dataset.telHandler = '1';
    btn.addEventListener('click', (e) => {
      if (!btn.dataset.telBound) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      location.href = `tel:${btn.dataset.telBound}`;
      return false;
    }, { capture: true, passive: false });
  }
}

// ===== Fenêtre indicative centrée (modale) =====
let infoOverlay = null;
function ensureInfoOverlay(){
  if (infoOverlay) return infoOverlay;

  // Overlay
  infoOverlay = document.createElement('div');
  infoOverlay.id = 'infoHintOverlay';
  Object.assign(infoOverlay.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,0.5)',
    display:'none', alignItems:'center', justifyContent:'center',
    zIndex:'2000'
  });

  // Boîte
  const box = document.createElement('div');
  Object.assign(box.style, {
    background:'#ffffff', width:'min(680px, 92vw)', maxWidth:'92vw',
    borderRadius:'12px', boxShadow:'0 20px 60px rgba(0,0,0,.35)',
    color:'#0b121e', display:'flex', flexDirection:'column',
  });

  // Header (titre + croix)
  const header = document.createElement('div');
  Object.assign(header.style, {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 16px', borderBottom:'1px solid #e5e7eb'
  });
  const title = document.createElement('h3');
  title.textContent = 'Information';
  Object.assign(title.style, { margin:'0', fontSize:'18px', fontWeight:'700' });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, {
    background:'none', border:'none', fontSize:'24px', cursor:'pointer', color:'#666'
  });
  closeBtn.addEventListener('click', () => { infoOverlay.style.display = 'none'; });

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Corps (message)
  const body = document.createElement('div');
  body.id = 'infoHintBody';
  Object.assign(body.style, {
    padding:'18px 18px 22px 18px', fontSize:'14px', lineHeight:'1.5'
  });

  box.appendChild(header);
  box.appendChild(body);
  infoOverlay.appendChild(box);
  document.body.appendChild(infoOverlay);

  return infoOverlay;
}

function showInfoDialog(message){
  const overlay = ensureInfoOverlay();
  const body = overlay.querySelector('#infoHintBody');
  body.textContent = String(message || '');
  overlay.style.display = 'flex';
}

  // (Ancienne notif email neutralisée)
  function showEmailNotification(_message) { /* noop */ }

  function wirePair(clientSel, contactSel, contacts) {
    if (!clientSel || !contactSel) return;

    // Client -> Contacts
    clientSel.addEventListener('change', () => {
      populateContacts(contactSel, clientSel.value, contacts);
      contactSel.value = '';
      contactSel.dispatchEvent(new Event('change'));
    });
    if (clientSel.value) populateContacts(contactSel, clientSel.value, contacts);

    // Contact cliqué AVANT client -> lister tout
    contactSel.addEventListener('click', () => {
      if (!clientSel.value && contactSel.options.length <= 1) {
        populateAllContacts(contactSel, contacts);
      }
    });

    // Contact choisi -> auto-sélection du client correspondant
    contactSel.addEventListener('change', () => {
      const c = findContactById(contacts, contactSel.value);
      if (c && String(clientSel.value) !== String(c.clientId)) {
        clientSel.value = String(c.clientId || '');
        populateContacts(contactSel, clientSel.value, contacts);
        contactSel.value = String(c.id);
      }
    });
  }

  // ===== Fenêtre Meet (accueil) – liste email-only, tri, rendu 2 colonnes, recherche =====
  // Rend la liste dans #contactsList
  function renderMeetContacts(list, root){
    if (!root) return;
    if (!Array.isArray(list) || !list.length){
      root.innerHTML = `<div style="padding:14px 10px;color:#6b7280;">Aucun contact</div>`;
      return;
    }
    const html = list.map(c => {
      const left = `${(c.lastName||'').toUpperCase()} ${c.firstName||''}`.trim();
      return `
        <div class="contact-row"
             data-id="${c.id||''}"
             style="display:grid;grid-template-columns:auto 1fr;align-items:center;
                    gap:8px 16px;padding:8px 10px;border-bottom:1px solid #e5e7eb;cursor:pointer;">
          <div style="min-width:0;">
            <strong style="font-weight:700;">${left}</strong>
          </div>
          <div style="color:#6b7280;text-align:left;">${c.client||''}</div>
        </div>
      `;
    }).join('');
    root.innerHTML = html;
  }

  // Construit window.contactsData à partir des datasets chargés
  function buildGlobalContactsData(clients, contacts){
    const byId = new Map(clients.map(cl => [String(cl.id), cl]));
    const enriched = contacts
      .filter(c => !!c && !!c.email) // email obligatoire
      .map(c => ({
        id: c.id,
        firstName: c.prenom || c.firstName || '',
        lastName:  c.nom || c.lastName || '',
        email:     c.email || '',
        client:    (byId.get(String(c.clientId))?.nom) || c.entreprise || c.client || '',
      }));

    enriched.sort((a,b)=>{
      const al = norm(a.lastName), bl = norm(b.lastName);
      if (al !== bl) return al < bl ? -1 : 1;
      const af = norm(a.firstName), bf = norm(b.firstName);
      if (af !== bf) return af < bf ? -1 : 1;
      return 0;
    });

  window.contactsData = enriched;
  return enriched;
  }

// === Fonctions modale Contacts (déclarées AVANT DOMContentLoaded) ===
function openContactSelectionModal(actionType) {
  const modal = document.getElementById('contactModal');
  const searchInput = document.getElementById('contactSearch');
  const contactsList = document.getElementById('contactsList');

  if (!modal || !searchInput || !contactsList) return;

  modal.style.display = 'flex';
  modal.dataset.actionType = actionType || 'meet';
  searchInput.placeholder = 'Rechercher par nom, prénom ou client…';
  searchInput.value = '';
  searchInput.style.fontFamily = 'inherit';
  searchInput.style.fontSize   = '14px';
  searchInput.style.fontWeight = '400';

  const ALL = Array.isArray(window.contactsData) ? window.contactsData : [];
  renderMeetContacts(ALL, contactsList);

  searchInput.focus();
}

function wireContactModalClose(){
  const modal = document.getElementById('contactModal');
  const close = document.getElementById('closeContactModal');
  if (close) close.addEventListener('click', ()=> modal.style.display = 'none');
  if (modal) modal.addEventListener('click', (e)=> {
    if (e.target === modal) modal.style.display = 'none';
  });
}

function wireMeetSearch(){
  const input = document.getElementById('contactSearch');
  const listEl = document.getElementById('contactsList');
  if (!input || !listEl) return;
  input.addEventListener('input', () => {
    const q = norm(input.value);
    const ALL = Array.isArray(window.contactsData) ? window.contactsData : [];
    if (!q) { renderMeetContacts(ALL, listEl); return; }
    const res = ALL.filter(c =>
      norm(c.lastName).includes(q) ||
      norm(c.firstName).includes(q) ||
      norm(c.client).includes(q)
    );
    renderMeetContacts(res, listEl);
  });
}

function wireMeetPick(){
  const listEl = document.getElementById('contactsList');
  const modal  = document.getElementById('contactModal');
  if (!listEl || !modal) return;

  listEl.addEventListener('click', (e)=>{
    const row = e.target.closest('.contact-row');
    if (!row) return;
    const id = row.dataset.id;
    const ALL = Array.isArray(window.contactsData) ? window.contactsData : [];
    const c = ALL.find(x => String(x.id) === String(id));
    if (!c) return;

    const actionType = modal.dataset.actionType || 'meet';
    modal.style.display = 'none';

    if (actionType === 'meet'){
      window.open('https://meet.new', '_blank');
      const subject = encodeURIComponent('lien pour votre visio avec AD-POMME');
      const body = encodeURIComponent(`Bonjour,

Comme prévu, voici ci-dessous le lien pour notre réunion instantanée en visio :

[COLLER ICI LE LIEN MEET]

Je suis déjà en ligne et je vous attends.

Merci à vous.`);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}&su=${subject}&body=${body}`;
      setTimeout(()=> window.open(gmailUrl, '_blank'), 900);
    } else if (actionType === 'mail'){
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}`;
      window.open(gmailUrl, '_blank');
    }
  });
}

// === MAPPINGS (UNIFIÉ -> LEGACY) — inactifs tant que USE_CANONICAL_DATA=false ===
function mapUnifiedClientsToLegacy(unifiedClients){
    
  // Sortie alignée sur data/clients.json (legacy) : { id, nom, adresse, codePostal, ville, ... }
  const out = [];
  const arr = Array.isArray(unifiedClients) ? unifiedClients : [];
  for (const c of arr) {
    out.push({
      id: String(c?.id ?? ''),
      nom: String(c?.name ?? ''),                           // UI rendra en MAJUSCULES
      adresse: String(c?.address?.line1 ?? ''),
      codePostal: String(c?.address?.postalCode ?? ''),
      ville: String(c?.address?.city ?? ''),
      // Champs legacy facultatifs (restent vides si non utilisés aujourd'hui)
      telephone: '', email: '', secteur: '', dateCreation: '', responsable: '', notes: String(c?.notes ?? '')
    });
  }
  return out;
}
function mapUnifiedContactsToLegacy(unifiedContacts){
  // Sortie alignée sur data/contacts.json (legacy) : { id, clientId, nom, prenom, email, phone, mobile, poste, notes }
  const out = [];
  const arr = Array.isArray(unifiedContacts) ? unifiedContacts : [];
  for (const ct of arr) {
    out.push({
      id: String(ct?.id ?? ''),
      clientId: String(ct?.clientId ?? ''),
      nom: String(ct?.lastName ?? ''),                      // UI rendra en MAJUSCULES
      prenom: String(ct?.firstName ?? ''),
      email: String(ct?.email ?? ''),
      phone: String(ct?.phoneFixed ?? ''),                  // fixe -> phone (legacy)
      mobile: String(ct?.phoneMobile ?? ''),                // mobile -> mobile (legacy)
      principal: !!ct?.isPrimary,                           // ✅ ajoute cette ligne
      poste: '',                                            // non demandé (placeholder)
      notes: String(ct?.notes ?? '')
    });
  }
  return out;
}

// === Injecte les selects manquants dans les modales (sans modifier le HTML) ===
function ensureSelectElements(){
  // Créateur label+select
  function makeField(id, labelText){
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = '120px 1fr';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';
    wrap.style.margin = '6px 0';

    const lab = document.createElement('label');
    lab.setAttribute('for', id);
    lab.textContent = labelText;
    lab.style.fontWeight = '600';

    const sel = document.createElement('select');
    sel.id = id;
    sel.style.padding = '6px 8px';
    sel.style.border = '1px solid #d1d5db';
    sel.style.borderRadius = '8px';
    sel.appendChild(new Option('— Sélectionner —', ''));

    wrap.appendChild(lab);
    wrap.appendChild(sel);
    return wrap;
  }

// === Modale Ticket ===
const ticketRow = document.querySelector('#ticketModal .row-client-contact')
               || document.getElementById('ticketContactPhone')?.closest('.row-client-contact')
               || document.getElementById('ticketContactMobile')?.closest('.row-client-contact');

if (ticketRow){
  if (!document.getElementById('ticketClient')){
    const field = makeField('ticketClient', 'Client');
    ticketRow.prepend(field);
  }
  if (!document.getElementById('ticketContact')){
    const field = makeField('ticketContact', 'Contact');
    const clientField = document.getElementById('ticketClient')?.closest('div');
    if (clientField && clientField.parentNode === ticketRow){
      clientField.after(field);
    } else {
      ticketRow.prepend(field);
    }
  }
}

// === Modale Prise en charge ===
const supportRow = document.querySelector('#supportModal .row-client-contact');
if (supportRow){
  if (!document.getElementById('supportClient')){
    const field = makeField('supportClient', 'Client');
    supportRow.prepend(field);
  }
  if (!document.getElementById('supportContact')){
    const field = makeField('supportContact', 'Contact');
    const clientField = document.getElementById('supportClient')?.closest('div');
    if (clientField && clientField.parentNode === supportRow){
      clientField.after(field);
    } else {
      supportRow.prepend(field);
    }
  }
}
}

// ====== Liaisons DOM ======
document.addEventListener('DOMContentLoaded', function () {
  // 1) Injecter les selects manquants (si le HTML natif ne les fournit pas)
  ensureSelectElements();

  // 2) Maintenant seulement, les récupérer
  const ticketClient   = document.getElementById('ticketClient');
  const ticketContact  = document.getElementById('ticketContact');
  const supportClient  = document.getElementById('supportClient');
  const supportContact = document.getElementById('supportContact');

// ⚙️ Défaut pour le statut de prise en charge
const supportStatus = document.getElementById('statut_pec');
if (supportStatus && !supportStatus.value) {
  supportStatus.value = 'en cours';
}
// 🟦 Quand on clique sur le + de la section Prise en charge
const addSupportBtn = document.getElementById('quickAddSupport');
if (addSupportBtn) {
  addSupportBtn.addEventListener('click', () => {
    const supportStatus = document.getElementById('statut_pec');
    if (supportStatus) {
      supportStatus.value = 'en cours';
    }
  });
}
  
  // Sécurité : log si un select est introuvable
  if (!ticketClient || !ticketContact || !supportClient || !supportContact) {
    console.warn('[init] Un ou plusieurs selects manquent :', {
      ticketClient, ticketContact, supportClient, supportContact
    });
  }

// (helper global déjà défini plus haut)
getClientsAndContacts().then(([clients, contacts]) => {
  console.log("[settings] chargés -> clients:", clients?.length ?? 0, "contacts:", contacts?.length ?? 0);

  // Remplissage clients
  populateClients(ticketClient, clients);
  populateClients(supportClient, clients);

  console.log("[settings] options clients ->",
    { ticket: ticketClient?.options?.length, support: supportClient?.options?.length });

      // Liaison client/contacts
      wirePair(ticketClient,  ticketContact,  contacts);
      wirePair(supportClient, supportContact, contacts);

      console.log("[settings] wirePair OK",
        { ticketContactOpts: ticketContact?.options?.length, supportContactOpts: supportContact?.options?.length });

      // Exposer la liste globale pour la fenêtre Meet (email-only + enrichie client)
      buildGlobalContactsData(clients, contacts);

      // === Actions Modale Ticket ===
// ======= APRÈS
(function bindTicketActions(){
  const clientSel = document.getElementById('ticketClient');
  const sel       = ticketContact;
  const root      = sel?.closest('.row-client-contact') || document;

  // Boutons (IDs + fallback data-action)
  const btnClear  = root.querySelector('.contact-btn.clear, [data-action="remove"]'); // ← ✖ rouge
  const btnPhone  = root.querySelector('#ticketContactPhone, [data-action="phone"]');
  const btnMobile = root.querySelector('#ticketContactMobile, [data-action="mobile"]');
  const btnEmail  = root.querySelector('#ticketContactEmail, [data-action="email"]');

function update(){
  const c = findContactById(contacts, sel?.value);
  const fixe   = getPhoneFixe(c);
  const mobile = getMobile(c);
  const email  = getEmail(c);

  console.log("[ticket icons] bind", { contactId: sel?.value, fixe, mobile, email });
  bindTelButton(btnPhone,  fixe);
  bindTelButton(btnMobile, mobile);
  bindEmailButton(btnEmail, email);
}

  // ✖ Réinitialise client+contact et désactive les icônes
  btnClear?.addEventListener('click', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (clientSel) {
      clientSel.value = '';
      clientSel.dispatchEvent(new Event('change')); // wirePair() vide le contact + déclenche 'change'
    } else {
      clearOptions(sel);
      sel.value = '';
      sel.dispatchEvent(new Event('change'));
    }

    // Désactiver les boutons
    bindTelButton(btnPhone,  '');
    bindTelButton(btnMobile, '');
    bindEmailButton(btnEmail, '');

    clientSel?.focus(); // pour re-sélectionner un client
  });

  sel?.addEventListener('change', update);
  update();
})();

// === Actions Modale Prise en charge ===
// ======= APRÈS
(function bindSupportActions(){
  const clientSel = document.getElementById('supportClient');
  const sel       = supportContact;

  // ⚠️ Scope sur la ligne pour éviter les doublons d’IDs ailleurs
  const root = sel?.closest('.row-client-contact') || document;

  // Boutons (IDs possibles + fallback data-action)
  const btnClear  = root.querySelector('.contact-btn.clear, [data-action="remove"]'); // ← ✖ rouge
  const btnPhone  = root.querySelector('#supportContactPhone, #ticketContactPhone, [data-action="phone"]');
  const btnMobile = root.querySelector('#supportContactMobile, #ticketContactMobile, [data-action="mobile"]');
  const btnEmail  = root.querySelector('#supportContactEmail, #ticketContactEmail, [data-action="email"]');

 function update(){
  const c = findContactById(contacts, sel?.value);
  const fixe   = getPhoneFixe(c);
  const mobile = getMobile(c);
  const email  = getEmail(c);

  console.log("[support icons] bind", { contactId: sel?.value, fixe, mobile, email });
  bindTelButton(btnPhone,  fixe);
  bindTelButton(btnMobile, mobile);
  bindEmailButton(btnEmail, email);
}

  // ✖ Réinitialise client+contact et désactive les icônes
  btnClear?.addEventListener('click', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Vide les selects
    if (clientSel) {
      clientSel.value = '';
      clientSel.dispatchEvent(new Event('change')); // wirePair() va vider contact + déclencher 'change'
    } else {
      // Sécurité si jamais clientSel est introuvable
      clearOptions(sel);
      sel.value = '';
      sel.dispatchEvent(new Event('change'));
    }

    // Désactive les boutons
    bindTelButton(btnPhone,  '');
    bindTelButton(btnMobile, '');
    bindEmailButton(btnEmail, '');

    // Optionnel : remet le focus pour re-choisir
    clientSel?.focus();
  });

  sel?.addEventListener('change', update);
  update();
})();

      // === Accueil : ouvrir la modale Meet depuis la "chip" Meet ===
      const meetChip = document.querySelector('.chip[data-app="meet"]');
      if (meetChip){
        meetChip.addEventListener('click', (e)=>{
          e.preventDefault(); e.stopPropagation();
          openContactSelectionModal('meet'); // ouvre avec la liste initiale
        });
      }

    }).catch(err => {
      console.error('[dataset] échec chargement clients/contacts:', err);
    });

    // Câblages généraux de la modale contacts (accueil)
    wireContactModalClose();
    wireMeetSearch();
    wireMeetPick();

    // === Cases à cocher (infos) : Urgent / Rappel / Important / Facturable ===
    wireTicketFlags();
  });

  // === Actions toolbar de la modale ticket (Meet/Mail depuis un ticket) ===
function handleTicketMailAction() {
  const ticketContactSelect = document.getElementById('ticketContact');
  if (!ticketContactSelect || !ticketContactSelect.value) {
    alert('Veuillez d\'abord sélectionner un contact');
    return;
  }
  getClientsAndContacts().then(([_, contacts]) => {
    const contact = contacts.find(c => String(c.id) === String(ticketContactSelect.value));
    if (!contact || !contact.email) {
      alert('Le contact sélectionné n\'a pas d\'adresse email');
      return;
    }
    const gmailUrl = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}`;
    window.open(gmailUrl, '_blank');
  }).catch(error => {
    console.error('Erreur lors de la récupération du contact:', error);
    alert('Erreur lors de la récupération des données du contact');
  });
}

function handleTicketMeetAction() {
  const ticketContactSelect = document.getElementById('ticketContact');
  if (!ticketContactSelect || !ticketContactSelect.value) {
    alert('Veuillez d\'abord sélectionner un contact');
    return;
  }
  getClientsAndContacts().then(([_, contacts]) => {
    const contact = contacts.find(c => String(c.id) === String(ticketContactSelect.value));
    if (!contact || !contact.email) {
      alert('Le contact sélectionné n\'a pas d\'adresse email');
      return;
    }
    window.open('https://meet.new', '_blank');
    const subject = encodeURIComponent('lien pour votre visio avec AD-POMME');
    const body = encodeURIComponent(`Bonjour,

Comme prévu, voici ci-dessous le lien pour notre réunion instantanée en visio :

[COLLER ICI LE LIEN MEET]

Je suis déjà en ligne et je vous attends.

Merci à vous.`);
    const gmailUrl = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}&su=${subject}&body=${body}`;
    setTimeout(() => window.open(gmailUrl, '_blank'), 900);
  }).catch(error => {
    console.error('Erreur lors de la récupération des données du contact:', error);
    alert('Erreur lors de la récupération des données du contact');
  });
}

document.addEventListener('click', function(e) {
  const btn = e.target.closest('.toolbar-btn');
  if (!btn) return;

  // Ne jamais capter les boutons gérés localement (email, phone, mobile)
  if (btn.dataset.action === 'email' || btn.dataset.action === 'phone' || btn.dataset.action === 'mobile') return;

  const action = btn.dataset.action;
  switch (action) {
    case '1password':
      try { window.location.href = 'onepassword://'; }
      catch { console.log('1Password non disponible'); }
      break;

    case 'splashtop':
      try { window.location.href = 'st-business://'; }
      catch { console.log('Splashtop non disponible'); }
      break;

    case 'pcloud':
      window.open('https://my.pcloud.com/', '_blank');
      break;

    case 'acronis':
      window.open('https://eu-cloud.acronis.com/mc', '_blank');
      break;

    case 'meet':
      handleTicketMeetAction();
      break;

    case 'mail':
      handleTicketMailAction();
      break;
  }
});

  // === Infos sur les cases de la modale Ticket ===
  function wireTicketFlags(){
    const byId = id => document.getElementById(id);
    const urgent   = byId('ticketUrgent');
    const rappel   = byId('ticketRappel');
    const important= byId('ticketImportant');
    const billable = byId('ticketBillable');

  urgent?.addEventListener('change', () => {
  if (urgent.checked) showInfoDialog('Urgent : “Marque le ticket comme prioritaire. Plus tard : notifications instantanées à l’équipe + mise en avant dans la liste.”');
});
rappel?.addEventListener('change', () => {
  if (rappel.checked) showInfoDialog('Rappel : “Planifie un suivi. Plus tard : création d’une alerte à une date/heure, relance automatique.”');
});
important?.addEventListener('change', () => {
  if (important.checked) showInfoDialog('Important : “Met en évidence (indépendant d’Urgent). Plus tard : recherche et tri par filtres.”');
});
billable?.addEventListener('change', () => {
  if (billable.checked) showInfoDialog('Facturable : “Indique que le temps passé sera facturé. Plus tard : envoie email à Jean .”');
});
  }

  // Champs recherche / fermeture pour la modale contacts (accueil)
  // (les handlers sont câblés dans wireMeetSearch / wireContactModalClose)

// ===== EXPORTS GLOBAUX (pour la console) =====
try {
  window.ADHELP = Object.assign(window.ADHELP || {}, {
    ping: () => 'pong',
    getClientsAndContacts,   // charge clients + contacts
    populateClients,         // remplit <select> clients
    populateContacts,        // remplit <select> contacts (par client)
    populateAllContacts,     // remplit <select> avec tous les contacts
    buildGlobalContactsData, // enrichit la liste email-only pour Meet
    findContactById,         // utilitaire recherche contact par id
    wirePair,                // lie client <-> contacts
    bindEmailButton,         // active le bouton 📧 Gmail
    bindTelButton,           // active les boutons 📞 / 📱
    norm                     // utilitaire normalisation
  });
  console.log('[settings] exports prêts (ADHELP)');
} catch (e) {
  console.error('[settings] échec export globals:', e);
}
// ==============================================

})();