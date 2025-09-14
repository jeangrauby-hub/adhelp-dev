// Prototype Suggestions : rendu + clics (pile), sans logique de similarité
(function () {
  const $  = s => document.querySelector(s);
  // ------- utilitaires communs + similarité -------
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms)=> new Promise(res=>setTimeout(res, ms));

  function norm(s){
    return (s||'')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu,'')
      .toLowerCase()
      .trim();
  }

  function tokenize(s){
    return norm(s)
      .replace(/[^a-z0-9\s]/g,' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);
  }

  async function fetchJSON(url){
    const r = await fetch(url, { cache:'no-store' });
    if(!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  }

  // Texte indexé pour un ticket
  function textFromTicket(t){
    const subject = t.subject || t.title || '';
    const desc    = t.description || '';
    const client  = t.client || '';
    return `${subject}\n${desc}\n${client}`;
  }

  // Texte indexé pour un article (ajoute extractedText des PJ si présent)
  function textFromArticle(a){
    const base = `${a.title||''}\n${a.content||''}\n${a.category||''}\n${a.author||''}`;
    const attx = (Array.isArray(a.attachments)? a.attachments : [])
      .map(x => x.extractedText || '')
      .filter(Boolean)
      .join('\n');
    return `${base}\n${attx}`;
  }

  // Score de similarité ultra-simple : recouvrement de tokens (pondéré légèrement)
  function scoreFromTokens(queryTokens, docText){
    const docTokens = tokenize(docText);
    if (!docTokens.length || !queryTokens.length) return 0;
    const qset = new Set(queryTokens);
    let hit = 0;
    for(const tk of docTokens){
      if (qset.has(tk)) hit++;
    }
    // normalisation très simple
    return hit / Math.max(8, docTokens.length);
  }

  // Cache local pour éviter de recharger
  let _ticketsCache = null;
  let _articlesCache = null;

  async function getTicketsDataset(){
    if (_ticketsCache) return _ticketsCache;
    const raw = await fetchJSON('data/demo-data.json');
    const arr = Array.isArray(raw) ? raw : (raw.tickets || []);
    _ticketsCache = arr.map(t => ({
      id:        t.id ?? t.code ?? '',
      subject:   t.subject ?? t.title ?? '',
      description: t.description ?? '',
      client:    t.client ?? t.customer ?? '',
      status:    t.status ?? '',
      assignee:  t.assignee ?? '',
      urgent:    !!(t.urgent || t.is_urgent),
      important: !!(t.important || t.is_important),
      _fulltext: textFromTicket(t)
    }));
    return _ticketsCache;
  }

  async function getArticlesDataset(){
    if (_articlesCache) return _articlesCache;
    const raw = await fetchJSON('data/knowledge-base.json');
    const arr = Array.isArray(raw) ? raw : (raw.articles || []);
    _articlesCache = arr.map(a => ({
      id:       a.id || '',
      title:    a.title || '',
      category: a.category || '',
      author:   a.author || '',
      content:  a.content || '',
      attachments: a.attachments || [],
      _fulltext: textFromArticle(a)
    }));
    return _articlesCache;
  }

  // Bâtit les suggestions à partir d’un "texte requête"
  async function buildSuggestions(queryText, excludeTicketId=null){
    const qTokens = tokenize(queryText);

    const [tickets, articles] = await Promise.all([
      getTicketsDataset(),
      getArticlesDataset()
    ]);

    // Score tickets
    const scoredT = tickets
      .filter(t => !excludeTicketId || String(t.id) !== String(excludeTicketId))
      .map(t => ({ ...t, _score: scoreFromTokens(qTokens, t._fulltext) }))
      .sort((a,b) => b._score - a._score)
      .slice(0, 10);

    // Score articles
    const scoredA = articles
      .map(a => ({ ...a, _score: scoreFromTokens(qTokens, a._fulltext) }))
      .sort((a,b) => b._score - a._score)
      .slice(0, 10);

    return {
      tickets: scoredT,
      articles: scoredA
    };
  }

  // Lit le ticket courant affiché dans la modale (sujet + description)
  function readCurrentTicketAsQuery(){
    const id  = (document.getElementById('ticketId')?.textContent || '').trim();
    const subj = document.getElementById('ticketSubject')?.value || '';
    const desc = document.getElementById('ticketDescription')?.innerText || '';
    const query = `${subj}\n${desc}`.trim();
    return { id, query };
  }

  // Ouvre la modale Suggestions pour le ticket actuellement ouvert
  async function openSuggestionsForCurrentTicket(){
    const { id, query } = readCurrentTicketAsQuery();
    if (!query){
      // fallback : si pas de texte, on prend le sujet seul
      const subj = document.getElementById('ticketSubject')?.value || '';
      if (!subj) {
        window.openSuggestionsModal({ tickets:[], articles:[] });
        return;
      }
    }
    const res = await buildSuggestions(query, id || null);
    window.openSuggestionsModal(res);
  }

  // Expose pour debug éventuel
  window._buildSuggestions = buildSuggestions;
  window.openSuggestionsForCurrentTicket = openSuggestionsForCurrentTicket;

  function escapeHtml(s){
    return (s ?? '').toString()
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function openModal(){
    const modal = $('#suggestionsModal');
    if (!modal) return;
    window.modalZIndexCounter = window.modalZIndexCounter || 1000;
    window.modalZIndexCounter++;
    modal.style.zIndex = window.modalZIndexCounter;
    modal.style.display = 'flex';
  }

  function closeModal(){
    const modal = $('#suggestionsModal');
    if (modal) modal.style.display = 'none';
  }

  function renderList(items, root, type){
    if (!root) return;
    const max = 10;
    const arr = Array.isArray(items) ? items.slice(0, max) : [];
    if (!arr.length){
      root.innerHTML = `<div style="padding:10px; color:#6b7280;">Aucun résultat</div>`;
      return;
    }
    root.innerHTML = arr.map(x => {
      const title = escapeHtml(x.title || x.subject || '');
      const subtitle = type === 'ticket'
        ? escapeHtml((x.client || '').toUpperCase())
        : escapeHtml(x.category || '');
      const id = escapeHtml(x.id || '');
      return `
        <div class="sugg-row" role="listitem"
             data-type="${type}" data-id="${id}"
             style="display:grid; grid-template-columns: auto 1fr; gap:6px 12px;
                    padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px;
                    background:#fff; margin-bottom:8px; cursor:pointer;">
          <div style="font-weight:700; color:#0b121e; white-space:nowrap; min-width:80px;">${id}</div>
          <div style="min-width:0;">
            <div style="font-weight:600; color:#0b121e; margin-bottom:2px;">${title}</div>
            <div style="font-size:12.5px; color:#6b7280;">${subtitle}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // API publique : à appeler avec { tickets:[...], articles:[...] }
  window.openSuggestionsModal = function(results){
    const tRoot = document.getElementById('suggestionsTickets');
    const aRoot = document.getElementById('suggestionsArticles');
    renderList(results?.tickets || [], tRoot, 'ticket');
    renderList(results?.articles || [], aRoot, 'article');
    openModal();
  };

  // Clic sur une suggestion -> ouvrir ticket/article (pile)
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.sugg-row');
    if (!row) return;
    const type = row.dataset.type;
    const id   = row.dataset.id;

    if (type === 'ticket' && window.openTicketModal && window.getTicketById) {
      const t = window.getTicketById(id);
      if (t) window.openTicketModal(t); // la pile/z-index est déjà gérée
    }

    if (type === 'article' && window.openArticleModal) {
      // → récupère l’objet article complet depuis le cache local
      const art = (Array.isArray(_articlesCache) ? _articlesCache : [])
        .find(a => String(a.id) === String(id));

      if (art) {
        // Passe l’objet complet (id, title, category, author, content, attachments, …)
        window.openArticleModal(art);
      } else {
        // Fallback au cas où : on tente encore avec l’ID
        window.openArticleModal(id);
      }
    }
  });

  // Fermer (croix + clic fond)
  document.addEventListener('click', (e) => {
    if (e.target?.id === 'closeSuggestionsModal') closeModal();
    const modal = document.getElementById('suggestionsModal');
    if (modal && e.target === modal) closeModal();
  });

  // Bouton “Suggestions” dans la modale ticket → calcule et ouvre
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#btnSuggestions');
    if (!btn) return;
    e.preventDefault();
    try{
      await window.openSuggestionsForCurrentTicket();
    }catch(err){
      console.error('[Suggestions] erreur:', err);
      window.openSuggestionsModal({ tickets:[], articles:[] });
    }
  });
})();