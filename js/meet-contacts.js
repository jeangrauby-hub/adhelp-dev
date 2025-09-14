// js/meet-contacts.js
// Fenêtre Meet : contacts avec e-mail uniquement, tri Nom puis Prénom,
// rendu 2 colonnes, recherche par nom/prénom/client, et au clic => même workflow que la modale Ticket.

(function () {
  const $ = (s, r = document) => r.querySelector(s);

  function norm(s) {
    return (s || "")
      .toString()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  }

  function pickNamePart(obj, keys) {
    for (const k of keys) if (obj && obj[k]) return obj[k];
    return "";
  }

  // Récupère la liste complète depuis window.contactsData (définie dans settings.js)
  // Chaque contact attendu au format : { id, firstName/firstname/prenom, lastName/lastname/nom, email, client/company, ... }
  function getAllContacts() {
    const raw = Array.isArray(window.contactsData) ? window.contactsData : [];

    // Filtrer uniquement ceux qui ont un email
    const withEmail = raw.filter(c => !!c && !!c.email);

    // Normaliser + mapper
    const mapped = withEmail.map(c => {
      const id       = c.id ?? c.ID ?? c.uid ?? "";
      const first    = pickNamePart(c, ["firstName", "firstname", "prenom", "first"]);
      const last     = pickNamePart(c, ["lastName", "lastname", "nom", "last"]);
      const client   = pickNamePart(c, ["client", "company", "organisation", "org", "societe", "entreprise"]);
      const email    = c.email || "";
      return {
        id,
        firstName: first,
        lastName:  last,
        client:    client,
        email:     email,
        nFirst:    norm(first),
        nLast:     norm(last),
        nClient:   norm(client),
      };
    });

    // Tri : NOM puis Prénom
    mapped.sort((a, b) => {
      if (a.nLast !== b.nLast)   return a.nLast < b.nLast ? -1 : 1;
      if (a.nFirst !== b.nFirst) return a.nFirst < b.nFirst ? -1 : 1;
      return 0;
    });

    return mapped;
  }

  // Rendu liste dans #contactsList (garde un index pour retrouver l’élément cliqué)
  function renderList(list, root) {
    if (!root) return;
    if (!list.length) {
      root.innerHTML = `<div style="padding:14px 10px;color:#6b7280;">Aucun contact</div>`;
      return;
    }
    const html = list.map((c, idx) => {
      const full = `${(c.lastName || "").toUpperCase()} ${c.firstName || ""}`.trim();
      return `
        <div class="contact-row"
             data-idx="${idx}"
             style="display:flex;justify-content:space-between;align-items:center;
                    gap:16px;padding:8px 10px;border-bottom:1px solid #e5e7eb;cursor:pointer;">
          <div style="min-width:0;">
            <strong style="font-weight:700;">${full}</strong>
          </div>
          <div style="color:#6b7280;white-space:nowrap;margin-left:16px;">${c.client || ""}</div>
        </div>
      `;
    }).join("");
    root.innerHTML = html;
  }

  // Workflow commun (Meet + Gmail) — identique à la modale Ticket
  function runMeetEmailWorkflow(contact) {
    if (!contact || !contact.email) return;

    // 1) Ouvrir une réunion instantanée
    window.open('https://meet.new', '_blank');

    // 2) Ouvrir Gmail avec le même sujet/corps utilisés côté ticket
    const subject = encodeURIComponent('lien pour votre visio avec AD-POMME');
    const body = encodeURIComponent(`Bonjour,

Comme prévu, voici ci-dessous le lien pour notre réunion instantanée en visio :

[COLLER ICI LE LIEN MEET]

Je suis déjà en ligne et je vous attends.

Merci à vous.`);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}&su=${subject}&body=${body}`;

    setTimeout(() => {
      window.open(gmailUrl, '_blank');
    }, 1200);
  }

  function openMeetContacts() {
    const modal  = $("#contactModal");
    const input  = $("#contactSearch");
    const listEl = $("#contactsList");

    if (!modal || !input || !listEl) return;

    input.placeholder = "Rechercher par nom, prénom ou client…";

    // Charger liste + rendre
    const ALL = getAllContacts();
    let current = ALL.slice(0, 100);
    renderList(current, listEl);

    // Afficher la modale
    modal.style.display = "flex";
    input.value = "";
    setTimeout(() => input.focus(), 0);

    // Recherche par nom, prénom ou client
    input.oninput = () => {
      const q = norm(input.value);
      if (!q) {
        current = ALL.slice(0, 100);
        renderList(current, listEl);
        return;
      }
      const res = ALL.filter(c =>
        c.nLast.includes(q) || c.nFirst.includes(q) || c.nClient.includes(q)
      );
      current = res.slice(0, 200);
      renderList(current, listEl);
    };

    // Clic sur un contact => même workflow que dans un ticket
    listEl.onclick = (e) => {
      const row = e.target.closest('.contact-row');
      if (!row) return;
      const idx = Number(row.dataset.idx);
      const contact = current[idx];
      // Fermer la modale
      modal.style.display = "none";

      // Si settings.js expose une fonction commune, on l’utilise, sinon fallback local
      if (typeof window.handleMeetAction === 'function') {
        window.handleMeetAction({ email: contact.email });
      } else {
        runMeetEmailWorkflow(contact);
      }
    };

    // Fermer
    const closeBtn = $("#closeContactModal");
    closeBtn && (closeBtn.onclick = () => { modal.style.display = "none"; });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    }, { once: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Ouvrir depuis la puce Meet (page d’accueil)
    const meetChip = document.querySelector('.chip[data-app="meet"]');
    if (meetChip) {
      meetChip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openMeetContacts();
      });
    }

    // Exposer si besoin
    window.openMeetContacts = openMeetContacts;
  });
})();