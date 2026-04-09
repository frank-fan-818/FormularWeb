import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zmihswdvixurhjjsazrl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaWhzd2R2aXh1cmhqanNhenJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODcyMDYsImV4cCI6MjA5MDI2MzIwNn0.ZR2otN53WukkSdZr78vIlz7XHwgtb-OYACa9lLRhYRQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
