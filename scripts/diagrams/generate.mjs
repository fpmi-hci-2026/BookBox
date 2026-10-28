#!/usr/bin/env node
/**
 * Совместимая точка входа: раньше здесь жили данные и рендер,
 * теперь схемы описаны в scripts/diagrams/spec/*.json.
 *
 * Запуск:  node scripts/diagrams/generate.mjs
 * Рендер:  scripts/diagrams/render.sh
 */

import { renderAll } from "./render.mjs";

const ok = renderAll();
process.exit(ok ? 0 : 1);
