import { createClient } from '@supabase/supabase-js';

// Pegá acá directamente tus valores reales de Supabase
const supabaseUrl = 'https://jcnsepbalxyscxrsyade.supabase.co/rest/v1/'; // tu URL exacta
const supabaseAnonKey = 'sb_publishable_kVLvltX-K4yGF2VRPaGDaA_KBkmT78W'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);