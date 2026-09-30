import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { openApiDocument } from '../src/openapi.js';

/**
 * Génère `docs/openapi.yaml` à partir de `src/openapi.ts`.
 *
 * Le document est rédigé une seule fois, en TypeScript, et sert à la fois de
 * source pour Swagger UI et de source pour le fichier livré : il ne peut pas y
 * avoir deux descriptions de l'API qui divergent.
 */

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(currentDir, '../../docs/openapi.yaml');

const HEADER = `# Documentation de l'API — HelpDeskPro
#
# Fichier généré par \`npm run openapi\`. Ne pas éditer à la main :
# toute modification serait écrasée au prochain appel.
#
# La spécification en ligne reste disponible sur /api/docs (Swagger UI)
# et au format JSON sur /api/docs.json.
`;

async function main(): Promise<void> {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  const yaml = stringify(openApiDocument, { lineWidth: 100 });
  await writeFile(OUTPUT_PATH, `${HEADER}${yaml}`, 'utf8');

  const paths = Object.keys(openApiDocument.paths ?? {});
  console.info(`[openapi] ${OUTPUT_PATH} — ${paths.length} chemin(s) documenté(s).`);
}

main().catch((error: unknown) => {
  console.error('[openapi] Échec :', error);
  process.exit(1);
});