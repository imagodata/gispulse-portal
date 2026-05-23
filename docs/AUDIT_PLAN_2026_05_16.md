# Plan de remédiation — gispulse-portal

> Issu de l'analyse profonde du 2026-05-16, vérifiée sur `main` (HEAD `4daf90e`).
> Composite ~6/10. Voir aussi l'audit initial branche `cocarte/issue-56`.

## Résumé

| Outil | Résultat |
|-------|----------|
| `tsc -p tsconfig.app.json` | ❌ 7 erreurs |
| `eslint .` | ❌ 166 erreurs / 18 warnings |
| CI GitHub | ✅ verte — **ne lance ni `tsc` ni `eslint` en gate** |
| Versions | `package.json` 1.2.0 ≠ `pyproject.toml` 1.5.2 |

Cause racine : la CI ne bloque pas sur `tsc`/`eslint`, donc les régressions de typage et de contrat API passent silencieusement.

---

## Vague 1 — P0 bloquants — ✅ FAIT (2026-05-16)

Vérifié et implémenté. `tsc -p tsconfig.app.json` est désormais **vert** ;
`eslint` passe de 166 → 126 erreurs. Le build `vite` n'a pas pu être
vérifié localement (Node 20.17 < 20.19 requis + binding natif `rolldown`
manquant — problème d'environnement, pas de régression).

Détail ci-dessous (mis à jour avec les chiffres réellement constatés).

### P0-1 — Contrat API rompu — ✅ FAIT
Backend vérifié : seul `portal_router` porte le préfixe `/api/portal`.
`marketplace`/`pipelines`/`schedules`/`relations` sont montés à la racine.

| Client | Backend attend | État avant | Correction |
|--------|----------------|------------|------------|
| `pipelines.ts` | `/pipelines/*` | ❌ 404 | `getOriginBase()` |
| `marketplace.ts` | `/marketplace/*` | ❌ 404 | `getOriginBase()` |
| `schedules.ts` | `/schedules/*` | ❌ 404 (confirmé) | `getOriginBase()` |
| `relations.ts` | `/relations/*` | ⚠️ `base=""` (Mode 2 cassé) | `getOriginBase()` |

**Fait** : nouveau helper `getOriginBase()` dans `request.ts` (renvoie
l'origine sans le suffixe `/api/portal`, lu au call-time donc compatible
Mode 2). Les 4 clients l'utilisent — le `base=""` littéral de
`relations.ts` (qui ignorait silencieusement un backend custom) est corrigé.

### P0-2 — Bug `rules-of-hooks` — ✅ FAIT
- `InspectorPanel.tsx` — `useActiveLayerStyle` remonté au-dessus du `return`.
- `TriggerBuilderInline.tsx` — `useCallback` (`handleSave`) remonté ;
  garde `if (!trigger) return` ajoutée dans le corps du callback.

### P0-3 — Collision localStorage — ✅ FAIT
`sceneStore` (mort, seul son test le consommait) supprimé avec
`src/__tests__/sceneStore.test.ts`. La clé `gispulse:scenes` n'a plus
qu'un seul propriétaire : `mapViewStore`.

### P0-4 — Dérive de version — ✅ FAIT
`package.json` passé à `1.5.2`. ⚠️ Reste à faire (Vague 2) : check de
cohérence `package.json` ↔ `pyproject.toml` dans la CI release.

### P0-5 — Erreurs `tsc` — ✅ FAIT
**L'audit comptait 7 ; il y en avait 223** : 50 dans le code applicatif
+ 173 dans les `__tests__` co-localisés sous `src/components/`.
Cause : `tsconfig.app.json` n'excluait que `src/__tests__`.

**Fait** :
- `exclude` étendu (`src/**/__tests__/**`, `src/**/*.test.ts(x)`, …) →
  les tests ne polluent plus le build applicatif.
- Les 50 erreurs applicatives corrigées (35 `no-unused-vars` + 15 vraies
  erreurs de typage : casts localStorage, `StyleMeta` null vs undefined,
  `require` CJS → import statique, signatures handler ReactFlow, etc.).
- `tsc -p tsconfig.app.json` est **vert**.

⚠️ Reste (non inclus — choix « sans le chantier des 173 ») : les 173
erreurs `tsc` dans les fichiers de test, et le **gate CI `tsc`/`eslint`**.

---

## Vague 2 — P1 (~1 semaine)

- **CI gate** : ajouter `tsc` + `eslint` en jobs bloquants (sinon tout le reste resilencera).
- **`@tanstack/react-query`** : installé, 0 % utilisé. Décider — l'adopter (migrer les 7 stores de cache serveur) ou le désinstaller.
- **Stores morts** : supprimer `sceneStore` et `transformStore` (0 consommateur chacun).
- **`request.ts`** : ajouter timeout + retry + erreur typée ; remplacer le `Proxy` `BASE` fragile par `getBase()` partout.
- **eslint** : résorber 166 erreurs (60 `no-unused-vars`, 46 `no-explicit-any`, 22 `set-state-in-effect`, 18 `exhaustive-deps`).
- **a11y** : focus trap sur les 5 modales `aria-modal` ; corriger le texte 8px (`--gp-text-label-xs`, échec WCAG).
- **Mode 2** : `catalog`/`filter`/`auth`/SSE violent le périmètre Mode 2.

---

## Vague 3 — P2 polish

- **Design system** : remplacer les 298 `<button>` natifs par `ui/button` ; remplacer ~143 couleurs Tailwind brutes par les tokens ; utiliser `--gp-brand`.
- Virtualisation des listes longues (0 actuellement).
- Nettoyage WIP Cocarte (`cocarteMaps.ts` cible un `maps_router` backend inexistant).

---

## Ordre recommandé

1. P0-1 + P0-4 (quick win, ~2 h, débloque le marketplace).
2. P0-5 + gate CI `tsc` (empêche la prochaine régression silencieuse).
3. P0-2, P0-3.
4. Vague 2, puis Vague 3.
