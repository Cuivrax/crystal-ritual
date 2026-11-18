# Mise En Ligne De Crystal & Ritual

Ce dossier contient tout ce qu'il faut pour publier le site sur o2switch, **sans que rien ne soit activé pour l'instant**. Le déploiement reste à approuver. Tant que les étapes ci-dessous ne sont pas faites, rien ne part en ligne.

## Le Principe

1. Le code et les pages vivent sur GitHub, branche `main`.
2. GitHub Actions (`.github/workflows/build.yml`) construit le site à chaque modification de `main` et **toutes les heures à la minute 5**. La construction applique la porte de publication (statut `verified`, date et heure de New York passées, aucun `[TO CHECK`). Une page programmée pour 7 h 14 part donc à la construction de 8 h 05 au plus tard.
3. Le résultat (`dist/`) est poussé de force sur la branche `deploy`, seulement s'il a changé. Le jeton GitHub par défaut suffit, aucune clé SSH, aucun secret à créer.
4. Sur o2switch, une tâche Cron lance `deploy/pull.sh` toutes les 15 minutes. Le script récupère la branche `deploy` en HTTPS, la copie dans le dossier web avec `rsync --delete` (sans toucher à `.well-known/` ni aux fichiers listés dans `keep.txt`), puis prévient IndexNow des URL nouvelles ou modifiées.

Le serveur ne construit rien, il ne fait que copier. GitHub ne se connecte jamais au serveur.

## Étapes Pour Activer (Une Seule Fois)

### 1. Le dépôt GitHub

- Créer le dépôt (privé ou public) et pousser la branche `main`.
- Dans le dépôt, *Settings, Actions, General, Workflow permissions*, choisir **Read and write permissions** (la construction doit pouvoir écrire la branche `deploy`).
- Lancer une première construction depuis l'onglet *Actions* (bouton *Run workflow*) pour créer la branche `deploy`.
- À savoir, GitHub met en pause les tâches programmées d'un dépôt sans activité pendant 60 jours. Un simple commit les relance.

### 2. Le serveur o2switch

- Dans cPanel, *Gestionnaire de fichiers*, créer `~/deploy/` (à côté de `public_html`, pas dedans) et y copier `pull.sh` et `keep.txt`.
- Ouvrir `pull.sh` et remplacer `https://github.com/OWNER/REPO.git` par l'adresse HTTPS du dépôt.
- **Dépôt privé seulement.** Créer sur GitHub un jeton *fine-grained* en lecture seule sur ce dépôt (*Contents, Read-only*), puis le coller seul dans le fichier `~/deploy/token` (droits 600). Le script le lit sans jamais l'afficher.
- *Terminal* cPanel, `chmod 700 ~/deploy/pull.sh`, puis un premier essai à la main.

```bash
cd ~/deploy
/bin/bash ~/deploy/pull.sh ~/public_html
```

- *Tâches Cron* (cPanel, section *Avancé*), ajouter toutes les 15 minutes la commande suivante.

```bash
/bin/bash $HOME/deploy/pull.sh $HOME/public_html >> $HOME/deploy/pull.log 2>&1
```

Si le domaine n'est pas le domaine principal du compte, remplacer `$HOME/public_html` par son dossier (par exemple `$HOME/crystalandritual.com`).

### 3. Le formulaire de contact (à faire une fois)

Le formulaire de `/contact/` envoie les messages par `contact/send.php`, un petit script PHP hébergé sur o2switch, sans service tiers ni cookie. **L'adresse qui reçoit les messages n'est écrite nulle part dans le dépôt ni dans le site.** Elle se trouve dans un fichier de configuration placé **un niveau au-dessus du dossier web**, à créer une seule fois.

1. cPanel, *Gestionnaire de fichiers*, aller dans le dossier personnel (celui qui contient `public_html`).
2. Créer le fichier `crystal-contact-config.php` avec ce contenu, en mettant votre propre adresse de réception et une adresse d'expédition du domaine (créée dans *Comptes de messagerie*, par exemple `contact@crystalandritual.com`).

```php
<?php
return [
    'to' => 'votre-adresse-de-reception@exemple.fr',
    'from' => 'contact@crystalandritual.com',
];
```

3. Droits du fichier 600.

Tant que ce fichier n'existe pas, le formulaire affiche une page « The Contact Form Is Resting » (code 503) et n'envoie rien. Le script garde aussi, à côté de ce fichier, un dossier `crystal-contact-ratelimit/` (5 messages par adresse IP et par heure, adresses IP enregistrées sous forme hachée). Les deux sont hors du dossier web et exclus de la copie par `pull.sh` et `keep.txt`.

Protection anti-spam sans casse-tête visible, un champ caché piège (honeypot), un envoi refusé moins de 3 secondes après le chargement de la page, et la limite par heure. Le formulaire a besoin de JavaScript pour l'horodatage, un navigateur sans JavaScript verra le message d'erreur.

### 4. IndexNow (facultatif, recommandé)

- Générer une clé (une suite de 32 caractères hexadécimaux, par exemple sur https://www.bing.com/indexnow/getstarted).
- Remplacer le contenu de `public/indexnow-key.txt` dans le dépôt par cette clé seule, puis pousser sur `main`.
- Au passage suivant, `pull.sh` compare l'ancien et le nouveau `sitemap.xml` et envoie la liste des URL nouvelles ou dont la date a changé.

## Fichiers De Ce Dossier

| Fichier | Rôle |
|---|---|
| `pull.sh` | Récupère la branche `deploy`, copie le site, pingue IndexNow |
| `keep.txt` | Ce que la copie ne doit jamais effacer dans le dossier web |
| `README.md` | Ce document |

## En Cas De Souci

- `~/deploy/pull.log` garde la trace de chaque passage.
- Une construction incomplète (sans `404.html` ou `sitemap.xml`) n'est jamais copiée, l'ancien site reste en place.
- Revenir en arrière, sur GitHub relancer la construction d'un ancien commit de `main` (ou annuler le commit fautif), la branche `deploy` suivra.
- Forcer une nouvelle copie, supprimer `~/deploy/.last-deployed-commit` puis relancer le script.
