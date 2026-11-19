#!/usr/bin/env bash
# =============================================================================
# Crystal & Ritual, mise en ligne depuis la branche "deploy" (o2switch)
# =============================================================================
#
# Ce script récupère le site déjà construit par GitHub Actions (branche "deploy"),
# le copie dans le dossier web, puis prévient IndexNow (Bing, Yandex, etc.) des pages
# nouvelles ou modifiées. Il ne construit rien sur le serveur.
#
# INSTALLATION (une seule fois, dans cPanel o2switch)
#   1. Gestionnaire de fichiers. Créer le dossier ~/deploy (hors de public_html)
#      et y déposer ce fichier pull.sh et keep.txt.
#   2. Terminal cPanel (ou Gestionnaire de fichiers, Permissions), rendre le script exécutable
#        chmod 700 ~/deploy/pull.sh
#   3. Modifier REPO_URL ci-dessous avec l'adresse HTTPS du dépôt GitHub.
#      Dépôt privé, voir deploy/README.md (jeton en lecture seule dans ~/deploy/token).
#   4. Tâches Cron (cPanel, section Avancé). Ajouter une tâche toutes les 15 minutes
#        Minute */15, Heure *, Jour *, Mois *, Jour de la semaine *
#        Commande
#        /bin/bash $HOME/deploy/pull.sh $HOME/public_html >> $HOME/deploy/pull.log 2>&1
#      ($HOME/public_html est la racine web du domaine principal. Pour un domaine
#      additionnel, mettre son propre dossier, par exemple $HOME/crystalandritual.com.)
#   5. Lancer une première fois à la main dans le Terminal pour vérifier
#        /bin/bash ~/deploy/pull.sh ~/public_html
#
# CE QUI N'EST JAMAIS TOUCHÉ DANS LE DOSSIER WEB
#   .well-known/ (certificats SSL, vérifications), et tout ce qui est listé dans keep.txt.
#   Le fichier de configuration du formulaire de contact et son dossier anti-abus sont
#   en dehors du dossier web, donc hors d'atteinte de toute façon (voir README.md).
#
# INDEXNOW
#   Le ping part seulement si le fichier indexnow-key.txt du site contient une vraie clé
#   (pas REPLACE_WITH_INDEXNOW_KEY). Voir README.md pour générer la clé.
# =============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Cuivrax/crystal-ritual.git}"   # dépôt public, lu en HTTPS sans clé ni jeton
BRANCH="deploy"
SITE_URL="https://www.crystalandritual.com"
HERE="$(cd "$(dirname "$0")" && pwd)"
KEEP_FILE="$HERE/keep.txt"
STATE_FILE="$HERE/.last-deployed-commit"
TOKEN_FILE="$HERE/token"

WEBROOT="${1:-}"
if [ -z "$WEBROOT" ] || [ ! -d "$WEBROOT" ]; then
  echo "Usage, $0 /chemin/vers/le/dossier/web (le dossier doit exister)" >&2
  exit 2
fi
WEBROOT="$(cd "$WEBROOT" && pwd)"
case "$WEBROOT" in
  /|"$HOME"|/home|/home/*/) echo "Refus, $WEBROOT ne peut pas être le dossier web" >&2; exit 2 ;;
esac

# Un seul passage à la fois.
LOCK="$HERE/.pull.lock"
exec 9>"$LOCK"
if command -v flock >/dev/null 2>&1; then
  flock -n 9 || { echo "$(date '+%F %T') un autre passage est en cours"; exit 0; }
fi

log() { echo "$(date '+%F %T') $*"; }


# Dépôt privé, le jeton (lecture seule) est lu dans ~/deploy/token, jamais écrit dans ce script.
AUTH_URL="$REPO_URL"
if [ -s "$TOKEN_FILE" ]; then
  TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
  AUTH_URL="${REPO_URL/https:\/\//https://x-access-token:${TOKEN}@}"
fi

# ------------------------------------------------- Publication programmée
# Le site construit contient next-publish.txt, l'heure (Unix) de la prochaine page programmée.
# Quand elle est passée, on demande une construction à GitHub (le planning horaire de GitHub saute
# la plupart de ses passages). Le jeton est lu dans ~/deploy-crystal/gh_dispatch_token, jamais écrit
# dans ce script. Jeton GitHub "fine-grained" limité au dépôt crystal-ritual, permission Actions en
# lecture et écriture, rien d'autre. Sans ce fichier, rien ne se passe.
DISPATCH_TOKEN_FILE="$HERE/gh_dispatch_token"
NEXT_FILE="$HERE/.next-publish"
DISPATCH_STAMP="$HERE/.last-dispatch"
if [ -s "$DISPATCH_TOKEN_FILE" ] && [ -s "$NEXT_FILE" ]; then
  NOW_S="$(date +%s)"
  NEXT_S="$(tr -dc '0-9' < "$NEXT_FILE")"
  LAST_S="$(tr -dc '0-9' < "$DISPATCH_STAMP" 2>/dev/null || true)"
  LAST_S="${LAST_S:-0}"
  if [ -n "$NEXT_S" ] && [ "$NOW_S" -ge "$NEXT_S" ] && [ $((NOW_S - LAST_S)) -ge 1800 ]; then
    echo "$NOW_S" > "$DISPATCH_STAMP"
    CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
      -H 'Accept: application/vnd.github+json' \
      -H "Authorization: Bearer $(tr -d '[:space:]' < "$DISPATCH_TOKEN_FILE")" \
      -H 'X-GitHub-Api-Version: 2022-11-28' \
      'https://api.github.com/repos/Cuivrax/crystal-ritual/actions/workflows/build.yml/dispatches' \
      --data '{"ref":"main"}' || echo 000)"
    log "page programmée arrivée à échéance, construction demandée à GitHub, réponse $CODE (204 attendu)"
  fi
fi

# Rien à faire si la branche n'a pas bougé.
REMOTE_HEAD="$(git ls-remote "$AUTH_URL" "refs/heads/$BRANCH" 2>/dev/null | cut -f1 || true)"
if [ -z "$REMOTE_HEAD" ]; then
  log "branche $BRANCH introuvable, vérifier REPO_URL ou le jeton"
  exit 1
fi
if [ -f "$STATE_FILE" ] && [ "$(cat "$STATE_FILE")" = "$REMOTE_HEAD" ]; then
  exit 0
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/crystal-deploy.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

log "récupération de $BRANCH ($REMOTE_HEAD)"
git clone -q --depth 1 --single-branch --branch "$BRANCH" "$AUTH_URL" "$TMP/site"
rm -rf "$TMP/site/.git"

# Garde-fou, une construction vide ne doit jamais effacer le site.
if [ ! -f "$TMP/site/404.html" ] || [ ! -f "$TMP/site/sitemap.xml" ]; then
  log "construction incomplète (404.html ou sitemap.xml absent), rien n'est copié"
  exit 1
fi

# Sitemap avant et après, pour IndexNow.
touch "$TMP/sitemap-before.xml"
[ -f "$WEBROOT/sitemap.xml" ] && cp "$WEBROOT/sitemap.xml" "$TMP/sitemap-before.xml"

EXCLUDES=(--exclude '.well-known/' --exclude 'crystal-contact-config.php' --exclude 'crystal-contact-ratelimit/')
if [ -f "$KEEP_FILE" ]; then
  EXCLUDES+=(--exclude-from "$KEEP_FILE")
fi
# next-publish.txt sert au serveur seulement, il reste hors du dossier web.
if [ -f "$TMP/site/next-publish.txt" ]; then
  cp "$TMP/site/next-publish.txt" "$NEXT_FILE"
  rm -f "$TMP/site/next-publish.txt"
fi
rsync -a --delete --delay-updates "${EXCLUDES[@]}" "$TMP/site/" "$WEBROOT/"
echo "$REMOTE_HEAD" > "$STATE_FILE"
log "site copié dans $WEBROOT"

# ---------------------------------------------------------------- IndexNow
KEY="$(tr -d '[:space:]' < "$WEBROOT/indexnow-key.txt" 2>/dev/null || true)"
if [ -z "$KEY" ] || [ "$KEY" = "REPLACE_WITH_INDEXNOW_KEY" ]; then
  log "IndexNow, pas de clé, pas de ping"
  exit 0
fi

# Une ligne par <url> dans le sitemap, "loc lastmod".
pairs() { grep -o '<loc>[^<]*</loc><lastmod>[^<]*</lastmod>' "$1" | sed -e 's#<loc>##' -e 's#</loc><lastmod># #' -e 's#</lastmod>##' | sort; }
pairs "$TMP/sitemap-before.xml" > "$TMP/before.txt" || true
pairs "$WEBROOT/sitemap.xml" > "$TMP/after.txt" || true
comm -13 "$TMP/before.txt" "$TMP/after.txt" | cut -d' ' -f1 | sort -u > "$TMP/changed.txt"

COUNT="$(wc -l < "$TMP/changed.txt" | tr -d ' ')"
if [ "$COUNT" = "0" ]; then
  log "IndexNow, aucune URL nouvelle ou modifiée"
  exit 0
fi
URLS="$(head -n 10000 "$TMP/changed.txt" | sed 's/.*/"&"/' | paste -sd, -)"
HOST="${SITE_URL#https://}"
BODY="{\"host\":\"$HOST\",\"key\":\"$KEY\",\"keyLocation\":\"$SITE_URL/indexnow-key.txt\",\"urlList\":[$URLS]}"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST 'https://api.indexnow.org/indexnow' \
  -H 'Content-Type: application/json; charset=utf-8' --data "$BODY" || echo 000)"
log "IndexNow, $COUNT URL envoyées, réponse $CODE"
