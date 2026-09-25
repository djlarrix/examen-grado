/**
 * Dónde viven los datos del estudiante: progreso, manuales indexados y caché.
 *
 * Fuera de la carpeta del plugin a propósito: una actualización del plugin
 * reemplaza su carpeta, y el progreso de meses de estudio no puede perderse con
 * ella. Se puede mover con EXAMEN_GRADO_DIR (útil en pruebas y en servidores).
 */
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const directorioDatos = () => process.env.EXAMEN_GRADO_DIR || join(homedir(), '.examen-grado');

/** Raíz del proyecto (donde está `datos/`). */
export const raizProyecto = () => join(dirname(fileURLToPath(import.meta.url)), '..', '..');
