import { apiLogin, apiLogout, type ApiFailure } from './api';

/* ==========================================================================
   Sesión del panel. Con la API, inicia sesión con POST /auth/login y guarda los tokens.
   Sin servidor, usa el acceso de demostración (solo para el entorno de diseño).
   ========================================================================== */
const KEY = 'zugar-admin-sesion';
const LOCK_KEY = 'zugar-admin-intentos';
const HOURS = 8;
const MAX_TRIES = 5;
const LOCK_SECONDS = 30;

export interface Session {
  email: string;
  name: string;
  role: string;
  exp: number;
  api?: boolean;
  token?: string;
  refresh?: string;
  roles?: string[];
  permissions?: string[];
}

export type LoginResult = { ok: true; user: Session } | { ok: false; error: 'locked'; lockedFor: number } | { ok: false; error: 'invalid'; left: number } | { ok: false; error: 'noaccess' };

/* Acceso de demostración */
const USERS = [{ email: 'lucia@zugar.example', password: 'Zugar2026!', name: 'Lucía Méndez', role: 'Administradora' }];

const read = (s: Storage): Session | null => {
  try {
    return JSON.parse(s.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};

export function currentSession(): Session | null {
  let s: Session | null = null;
  try {
    s = read(sessionStorage) || read(localStorage);
  } catch {
    return null;
  }
  if (!s || !s.exp || Date.now() > s.exp) {
    clearSession();
    return null;
  }
  return s;
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento bloqueado */
  }
}

/** La API renueva el token cada 15 minutos: se guarda donde ya estaba la sesión */
export function saveTokens(token: string, refresh: string) {
  for (const s of [sessionStorage, localStorage]) {
    const cur = read(s);
    if (!cur) continue;
    cur.token = token;
    cur.refresh = refresh;
    try {
      s.setItem(KEY, JSON.stringify(cur));
    } catch {
      /* sin almacenamiento */
    }
  }
}

export function lockState() {
  let l: { tries?: number; until?: number } | null = null;
  try {
    l = JSON.parse(sessionStorage.getItem(LOCK_KEY) || 'null');
  } catch {
    /* nada */
  }
  const left = Math.ceil(((l?.until ?? 0) - Date.now()) / 1000);
  return { tries: l?.tries ?? 0, lockedFor: left > 0 ? left : 0 };
}

function start(session: Omit<Session, 'exp'>, remember: boolean): LoginResult {
  const s: Session = { ...session, exp: Date.now() + HOURS * 3600 * 1000 };
  try {
    sessionStorage.removeItem(LOCK_KEY);
    clearSession();
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: la sesión dura lo que dure la página */
  }
  return { ok: true, user: s };
}

function failed(): LoginResult {
  const tries = lockState().tries + 1;
  const until = tries >= MAX_TRIES ? Date.now() + LOCK_SECONDS * 1000 : 0;
  try {
    sessionStorage.setItem(LOCK_KEY, JSON.stringify({ tries: until ? 0 : tries, until }));
  } catch {
    /* sin almacenamiento */
  }
  return until ? { ok: false, error: 'locked', lockedFor: LOCK_SECONDS } : { ok: false, error: 'invalid', left: MAX_TRIES - tries };
}

function loginDemo(email: string, password: string, remember: boolean): LoginResult {
  const u = USERS.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
  return u ? start({ email: u.email, name: u.name, role: u.role }, remember) : failed();
}

export async function login(email: string, password: string, remember: boolean): Promise<LoginResult> {
  const lock = lockState();
  if (lock.lockedFor) return { ok: false, error: 'locked', lockedFor: lock.lockedFor };
  try {
    const r = await apiLogin(email, password);
    const u = r.user;
    if (u.type !== 'staff') return { ok: false, error: 'noaccess' }; // las cuentas de cliente usan la app
    return start(
      { email: u.email, name: u.name, role: u.roles.includes('admin') ? 'Administración' : 'Broker', api: true, token: r.accessToken, refresh: r.refreshToken, roles: u.roles, permissions: u.permissions },
      remember,
    );
  } catch (err) {
    const e = err as ApiFailure;
    if (e?.sinConexion) return loginDemo(email, password, remember); // sin servidor: modo de diseño
    if (e?.status === 423) {
      const min = (e.detalles as { retryAfterMinutes?: number } | undefined)?.retryAfterMinutes || 15;
      try {
        sessionStorage.setItem(LOCK_KEY, JSON.stringify({ tries: 0, until: Date.now() + min * 60000 }));
      } catch {
        /* sin almacenamiento */
      }
      return { ok: false, error: 'locked', lockedFor: min * 60 };
    }
    return failed();
  }
}

/** true justo después de cerrar sesión: el panel manda al acceso con «Cerraste sesión correctamente» */
export const loggedOut = { value: false };

export function logout() {
  apiLogout();
  loggedOut.value = true;
  clearSession();
  location.replace('#/login?salida=1');
}
