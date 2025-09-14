// Alimente les paires Client/Contact (Ticket et Prise en charge) depuis DataStore
(function () {
  const $ = (s, r=document) => r.querySelector(s);
  function clearOptions(sel){ while(sel && sel.options && sel.options.length) sel.remove(0); }
  function opt(v,l){ const o=document.createElement('option'); o.value=v??''; o.textContent=l??''; return o; }
  function fullName(ct){ const ln=(ct?.lastName||'').toUpperCase(); const fn=ct?.firstName||''; return [ln,fn].filter(Boolean).join(' '); }

  function populateClients(selectEl, placeholder='— Sélectionner un client —') {
    if (!selectEl) return;
    clearOptions(selectEl);
    selectEl.appendChild(opt('', placeholder));
    const clients = (DataStore.getClients?.() || []).sort((a,b)=>(a.name||'').localeCompare((b.name||''),'fr',{sensitivity:'base'}));
    clients.forEach(c => selectEl.appendChild(opt(c.id, (c.name||'').toUpperCase())));
  }

  function populateContacts(selectEl, clientId, placeholder='— Sélectionner un contact —') {
    if (!selectEl) return;
    clearOptions(selectEl);
    selectEl.appendChild(opt('', placeholder));
    if (!clientId) return;
    const contacts = DataStore.getContactsForClient?.(clientId, { primaryFirst:true }) || [];
    contacts.forEach(ct => selectEl.appendChild(opt(ct.id, `${fullName(ct)}${ct.isPrimary?' (PRINCIPAL)':''}`)));
  }

  function wirePair(clientSel, contactSel) {
    if (!clientSel || !contactSel) return;
    populateClients(clientSel);
    populateContacts(contactSel, clientSel.value);
    clientSel.addEventListener('change', () => {
      populateContacts(contactSel, clientSel.value);
      contactSel.value = '';
      contactSel.dispatchEvent(new Event('change'));
    });
  }

  DataStore.ready().then(()=>{
    // Paires possibles (branchées si présentes dans le DOM)
    const ticketClient  = document.querySelector('#ticketClientSelect');
    const ticketContact = document.querySelector('#ticketContactSelect');
    const supportClient  = document.querySelector('#supportClientSelect');
    const supportContact = document.querySelector('#supportContactSelect');

    wirePair(ticketClient,  ticketContact);
    wirePair(supportClient, supportContact);
  });
})();