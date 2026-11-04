export const supabaseOrigin = 'https://lzzmtqtccponmupulndv.supabase.co';
export const supabaseSdk = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.1/dist/umd/supabase.js';

export const contentSecurityPolicy = [
  "default-src 'none'",
  `script-src 'self' ${supabaseSdk}`,
  "script-src-attr 'none'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self'",
  `connect-src 'self' ${supabaseOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ') + ';';

export const securityMeta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">`;
