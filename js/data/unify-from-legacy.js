/* unify-from-legacy.js
   Lit data/clients.json + data/contacts.json (legacy),
   normalise + déduplique, puis propose le téléchargement
   de clients.unified.json + contacts.unified.json.
   Non intrusif : n’affecte pas l’app.
*/
(function () {
  // --- Utils ---
  const UPPER = s => (s || "").toString().toUpperCase();
  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();

  function fetchJSON(url) {
    return fetch(url, { cache: "no-store" }).then(r => r.json());
  }

  function downloadJSON(name, dataObj) {
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  function makeClientKey(c) {
    return [norm(c.name), norm(c.address?.postalCode), norm(c.address?.city)].join("|");
  }

  function toUnifiedClients(legacyClients) {
    const out = [];
    const byKey = new Map();
    const arr = Array.isArray(legacyClients) ? legacyClients : (legacyClients.clients || []);

    for (const lc of arr) {
      const c = {
        id: String(lc.id ?? lc.ID ?? lc.clientId ?? crypto.randomUUID()),
        name: String(lc.nom ?? lc.name ?? ""),
        address: {
          line1: String(lc.adresse ?? lc.address ?? ""),
          postalCode: String(lc.codePostal ?? lc.postalCode ?? ""),
          city: String(lc.ville ?? lc.city ?? "")
        },
        primaryContactId: null,
        externalId: null,
        notes: String(lc.notes ?? "")
      };
      const key = makeClientKey(c);
      if (!byKey.has(key)) {
        byKey.set(key, c);
        out.push(c);
      } else {
        // Fusion minimale : on complète les champs vides
        const target = byKey.get(key);
        if (!target.address.line1 && c.address.line1) target.address.line1 = c.address.line1;
        if (!target.notes && c.notes) target.notes = c.notes;
      }
    }
    return out;
  }

  function toUnifiedContacts(legacyContacts, unifiedClients) {
    const out = [];
    const arr = Array.isArray(legacyContacts) ? legacyContacts : (legacyContacts.contacts || []);
    const clientIds = new Set(unifiedClients.map(c => String(c.id)));

    // Index legacy clientId -> unified clientId (ici on suppose les ids identiques ;
    // si besoin, on pourrait mapper par clé name+postalCode+city)
    // Pour rester simple (et sans casser), on conserve clientId tel quel si présent dans unifiedClients.
    for (const lc of arr) {
      const ct = {
        id: String(lc.id ?? lc.contactId ?? crypto.randomUUID()),
        clientId: String(lc.clientId ?? ""),
        firstName: String(lc.prenom ?? lc.firstName ?? ""),
        lastName: String(lc.nom ?? lc.lastName ?? ""),
        email: String(lc.email ?? ""),
        phoneFixed: String(lc.phone ?? lc.fixe ?? ""),
        phoneMobile: String(lc.mobile ?? lc.phoneMobile ?? ""),
        isPrimary: !!(lc.isPrimary ?? lc.principal ?? false),
        externalId: null,
        order: typeof lc.order === "number" ? lc.order : null,
        notes: String(lc.notes ?? "")
      };

      // On ne garde que les contacts rattachés à un client connu (sinon orphelin optionnel)
      if (!clientIds.has(ct.clientId)) {
        // Option : ignorer les orphelins (sécurisé)
        // continue;

        // Alternative : rattacher à un client "A_CLASSER"
        // (désactivé par défaut pour ne pas polluer la base)
        // ct.clientId = "A_CLASSER";
      }

      out.push(ct);
    }

    // Dédoublonnage par client : email prioritaire, sinon (nom+prenom+mobile|fixe)
    const keyFor = (ct) => {
      if (ct.email) return `E:${ct.clientId}:${ct.email.toLowerCase()}`;
      const phone = ct.phoneMobile || ct.phoneFixed || "";
      return `N:${ct.clientId}:${norm(ct.lastName)}:${norm(ct.firstName)}:${phone}`;
    };

    const byKey = new Map();
    const dedup = [];
    for (const ct of out) {
      const k = keyFor(ct);
      if (!byKey.has(k)) {
        byKey.set(k, ct);
        dedup.push(ct);
      } else {
        // Fusion minimale : respecte la première occurrence, complète si vide
        const t = byKey.get(k);
        if (!t.phoneFixed && ct.phoneFixed) t.phoneFixed = ct.phoneFixed;
        if (!t.phoneMobile && ct.phoneMobile) t.phoneMobile = ct.phoneMobile;
        if (!t.email && ct.email) t.email = ct.email;
        if (!t.notes && ct.notes) t.notes = ct.notes;
        // isPrimary : si l’un est true, on garde true
        t.isPrimary = t.isPrimary || ct.isPrimary;
      }
    }

    // Cohérence : un seul isPrimary=true par client (on garde le premier trouvé)
    const primarySeen = new Map(); // clientId -> seen
    for (const ct of dedup) {
      if (ct.isPrimary) {
        if (primarySeen.get(ct.clientId)) {
          // deuxième "true" trouvé => on remet à false
          ct.isPrimary = false;
        } else {
          primarySeen.set(ct.clientId, true);
        }
      }
    }
    return dedup;
  }

  async function buildUnified() {
    const [C, K] = await Promise.all([
      fetchJSON("data/clients.json"),
      fetchJSON("data/contacts.json"),
    ]);

    // Clients unifiés
    const unifiedClients = toUnifiedClients(C);

    // Contacts unifiés (après clients)
    const unifiedContacts = toUnifiedContacts(K, unifiedClients);

    // (Option) positionner primaryContactId sur chaque client
    const byClient = new Map(unifiedClients.map(c => [String(c.id), c]));
    for (const ct of unifiedContacts) {
      if (ct.isPrimary) {
        const cli = byClient.get(String(ct.clientId));
        if (cli && !cli.primaryContactId) cli.primaryContactId = ct.id;
      }
    }

    return {
      clients: unifiedClients,
      contacts: unifiedContacts
    };
  }

  // Expose dans la page de migration
  window.UnifyFromLegacy = {
    run: async function () {
      const { clients, contacts } = await buildUnified();
      downloadJSON("clients.unified.json", { clients });
      downloadJSON("contacts.unified.json", { contacts });
    }
  };
})();