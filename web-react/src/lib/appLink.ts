/* Los botones que antes abrían el WhatsApp de Zugar llevan a la app Homiz (puerto 5600 del mismo servidor:
   localhost, IP de la red o puerto reenviado de VS Code). Otra dirección: VITE_APP_URL en .env.
   Con una casa, la app la recibe en ?casa=, pide crear cuenta y abre «Solicitar visita» de esa casa. */
function defaultAppUrl(): string {
  const host = location.hostname;
  if (/^[a-z0-9]+-\d+\./i.test(host) && /\.devtunnels\.ms$/i.test(host)) return `${location.protocol}//${host.replace(/-\d+\./, '-5600.')}/`;
  return `${location.protocol}//${host}:5600/`;
}

export const APP_URL: string = (import.meta.env.VITE_APP_URL as string | undefined) || defaultAppUrl();

export const appLink = (slug?: string | null) => (slug ? APP_URL + '?casa=' + encodeURIComponent(slug) : APP_URL);
