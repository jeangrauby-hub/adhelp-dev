# Schéma unifié Clients & Contacts (référence)

## Client
- `id` (string) — identifiant interne
- `name` (string) — affiché en **MAJUSCULES** côté UI
- `address.line1` (string)
- `address.postalCode` (string)
- `address.city` (string)
- `primaryContactId` (string|null) — contact principal
- `externalId` (string|null) — identifiant Ksuite (si synchro)
- `notes` (string|null)

## Contact
- `id` (string)
- `clientId` (string) — référence vers `clients.id`
- `firstName` (string)
- `lastName` (string) — affiché en **MAJUSCULES** côté UI
- `email` (string)
- `phoneFixed` (string)
- `phoneMobile` (string)
- `isPrimary` (bool) — un seul `true` par client
- `externalId` (string|null) — identifiant Ksuite (si synchro)
- `order` (number|null) — tri manuel optionnel
- `notes` (string|null)

## Règles d'affichage (UI)
1. Contact principal **en premier**, puis A→Z par `lastName`.
2. Rendu **MAJUSCULES** pour `name` (client) et `lastName` (contact).
3. `mailto:` et `tel:` issus du **contact sélectionné**, sinon du principal.

## Dédoublonnage (import/synchro)
- Clients : clé `normalize(name) + postalCode + city`.
- Contacts (par client) : clé `email`, sinon `normalize(lastName)+normalize(firstName)+phoneMobile|phoneFixed`.

## Note
Ces fichiers (`clients.unified.json`, `contacts.unified.json`) sont **référentiels**.  
L’app continue d’utiliser pour l’instant `data/clients.json` et `data/contacts.json`.