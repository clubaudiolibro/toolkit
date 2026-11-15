/**
 * config.js — impostazioni di GymLog.
 * APP_VERSION va tenuta uguale al campo version di "gymlog" in assets/js/apps.js.
 * SCHEMA_VERSION deve corrispondere a gym_schema_version() in supabase/gymlog.sql.
 */
export const APP_VERSION = '1.1';
export const SCHEMA_VERSION = 1;

/** Voci iniziali, inserite al primo avvio (poi si modificano da Altro → Liste). */
export const DEFAULT_MUSCLES = [
  'Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti', 'Quadricipiti', 'Femorali',
  'Glutei', 'Adduttori', 'Abduttori', 'Polpacci', 'Addome', 'Lombari',
];
export const DEFAULT_EQUIPMENT = [
  'Manubri', 'Kettlebell', 'Bilanciere dritto', 'Bilanciere EZ', 'Panca multifunzione',
  'Lat machine', 'Leg extension', 'Panca inclinabile', 'Sbarra per trazioni', 'Corpo libero',
];

export const EFFICACY = [
  { value: 'bassa', label: 'Bassa' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
];

/** Nomi delle chiavi in localStorage (solo dati di questo telefono). */
export const KEYS = {
  prefix: 'gymlog.',
};
