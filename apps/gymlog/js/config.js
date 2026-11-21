/**
 * config.js — impostazioni di GymLog.
 * APP_VERSION va tenuta uguale al campo version di "gymlog" in assets/js/apps.js.
 * SCHEMA_VERSION deve corrispondere a gym_schema_version() in supabase/gymlog.sql.
 */
export const APP_VERSION = '1.7';
export const SCHEMA_VERSION = 4;

/** Voci iniziali, inserite al primo avvio (poi si modificano da Altro → Liste). */
export const DEFAULT_MUSCLES = [
  'Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti', 'Quadricipiti', 'Femorali',
  'Glutei', 'Adduttori', 'Abduttori', 'Polpacci', 'Addome', 'Lombari',
];
export const DEFAULT_EQUIPMENT = [
  'Manubri', 'Kettlebell', 'Bilanciere dritto', 'Bilanciere EZ', 'Panca multifunzione',
  'Lat machine', 'Leg extension', 'Panca inclinabile', 'Sbarra per trazioni', 'Corpo libero',
];

/**
 * Misure corporee. Il peso si registra spesso, le circonferenze (sempre lato destro) più di rado.
 * key = nome della colonna in gym_measurements; tip = istruzioni mostrate nella «i» della sagoma.
 */
export const MEASURES = [
  { key: 'weight', label: 'Peso', unit: 'kg', kind: 'weight', min: 20, max: 400 },
  { key: 'waist', label: 'Vita', unit: 'cm', kind: 'circ', min: 10, max: 300,
    tip: "In piedi, addome rilassato. Metro orizzontale all'altezza dell'ombelico, a fine espirazione normale, aderente ma senza stringere." },
  { key: 'shoulders', label: 'Spalle', unit: 'cm', kind: 'circ', min: 10, max: 300,
    tip: 'In piedi, braccia rilassate lungo i fianchi. Metro orizzontale attorno al corpo, sul punto più largo dei deltoidi (sopra le braccia), a fine espirazione. Meglio farsi aiutare.' },
  { key: 'chest', label: 'Petto', unit: 'cm', kind: 'circ', min: 10, max: 300,
    tip: 'Braccia rilassate lungo i fianchi. Metro orizzontale sotto le ascelle e all’altezza dei capezzoli, a fine espirazione normale, senza gonfiare il torace.' },
  { key: 'biceps', label: 'Bicipite', unit: 'cm', kind: 'circ', min: 10, max: 300,
    tip: 'Braccio destro disteso e rilassato. Punto a metà tra la punta della spalla e il gomito (trovalo con il braccio piegato, segnalo con una matita). Metro orizzontale, senza contrarre.' },
  { key: 'thigh', label: 'Coscia', unit: 'cm', kind: 'circ', min: 10, max: 300,
    tip: 'In piedi, peso su entrambe le gambe, muscolo rilassato. Punto a metà tra la piega dell’inguine e il bordo superiore della rotula. Metro orizzontale.' },
  { key: 'calf', label: 'Polpaccio', unit: 'cm', kind: 'circ', min: 10, max: 300,
    tip: 'In piedi, peso su entrambe le gambe. Metro orizzontale nel punto più largo del polpaccio destro.' },
];
export const CIRC_KEYS = MEASURES.filter(m => m.kind === 'circ').map(m => m.key);
export const MEASURE_KEYS = MEASURES.map(m => m.key);

/** Dopo quanti giorni senza misure compare l'avviso. */
export const MEASURE_REMIND = { weight: 15, circ: 30 };

export const EFFICACY = [
  { value: 'bassa', label: 'Bassa' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
];

/** Nomi delle chiavi in localStorage (solo dati di questo telefono). */
export const KEYS = {
  prefix: 'gymlog.',
};
