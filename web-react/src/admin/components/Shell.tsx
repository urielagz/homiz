import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { apiActive, load, request } from '../api';
import { currentSession, loggedOut, logout } from '../auth';
import { pushSupported, registerBrowser } from '../push';
import { rerender } from '../store';
import { useOverlay } from './Overlay';
import { Icon } from './ui';

const NAV: [string, string, string][] = [
  ['resumen', 'grid', 'Resumen'],
  ['propiedades', 'home', 'Propiedades'],
  ['personas', 'users', 'Clientes e inquilinos'],
  ['brokers', 'user-key', 'Brokers'],
  ['citas', 'cal', 'Citas'],
];

/** Marco del panel: encabezado, menú lateral y la sección activa. Sin sesión, manda al acceso. */
export function Shell() {
  const session = currentSession();
  const { pathname, search } = useLocation();
  const { toast, open, confirm } = useOverlay();
  const connected = apiActive();
  const [ready, setReady] = useState(!connected);
  const [userOpen, setUserOpen] = useState(false);
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));
  const userBtn = useRef<HTMLButtonElement>(null);
  const section = pathname.split('/')[1] || 'resumen';

  // Con la API, primero se cargan los datos del servidor; sin ella, los de ejemplo
  useEffect(() => {
    if (!connected) return;
    load().then(
      () => { setReady(true); rerender(); },
      (e) => { toast('No se pudieron cargar los datos del servidor' + (e?.mensaje ? ': ' + e.mensaje : '.')); setReady(true); },
    );
    // Avisos en el navegador: con permiso ya concedido se vuelve a registrar en silencio (Firebase puede renovar el token)
    if (pushSupported() && Notification.permission === 'granted') registerPush().catch((e) => console.warn('Avisos: no se registró este navegador', e));
  }, []);

  // Al cambiar de sección: arriba y foco en el título
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('#view h1')?.focus({ preventScroll: true });
  }, [pathname]);
  useEffect(() => {
    const h1 = document.querySelector('#view h1');
    document.title = (h1 ? h1.textContent + ' · ' : '') + 'Panel administrativo | Zugar';
  });

  // Menú de usuario: se cierra con Escape o al hacer clic fuera
  useEffect(() => {
    const onClick = (e: MouseEvent) => !(e.target as HTMLElement).closest('.user') && setUserOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && userOpen) { setUserOpen(false); userBtn.current?.focus(); } };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, [userOpen]);

  if (!session) {
    if (loggedOut.value) return <Navigate to="/login?salida=1" replace />; // el acceso la apaga al abrir
    return <Navigate to={'/login' + (pathname !== '/' ? '?volver=' + encodeURIComponent(pathname + search) : '')} replace />;
  }

  function registerPush() {
    return registerBrowser(
      (token) => request('POST', '/devices', { fcmToken: token, platform: 'web' }),
      (title, body) => { toast((title ? title + ': ' : '') + body); load().then(rerender, () => {}); },
    );
  }
  const activatePush = async () => {
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p !== 'granted') { toast('No se activaron los avisos. Puedes permitirlos en la configuración del navegador.'); return; }
    try {
      await registerPush();
      toast('Listo: recibirás los avisos del panel en este navegador.');
    } catch (e) {
      console.warn('Avisos: no se activaron', e);
      toast('No se pudieron activar los avisos. Intenta de nuevo.');
    }
  };

  const exp = new Date(session.exp);
  const askLogout = () =>
    confirm({
      icon: 'arrow-ur', safe: true,
      title: '¿Cerrar sesión?',
      lead: connected ? 'Tus cambios ya están guardados en el servidor de Zugar.' : 'Los cambios que hiciste en este entorno de diseño se perderán al salir.',
      cancel: 'Seguir en el panel', confirm: 'Cerrar sesión',
      onConfirm: logout,
    });
  const help = () =>
    open((close) => (
      <>
        <span className="dialog__icon dialog__icon--info"><Icon id="info" className="icon--lg" /></span>
        <h2 id="dialog-title">¿Cómo usar el panel?</h2>
        <p className="lead">Todo lo que cambies aquí se refleja al momento en las demás secciones.</p>
        <ul className="activity">
          <li><strong>Propiedades.</strong> Da de alta casas, edita sus datos, fotos y amenidades, o pausa su publicación.</li>
          <li><strong>Clientes e inquilinos.</strong> Consulta el expediente de cada persona y su próxima visita.</li>
          <li><strong>Brokers.</strong> Asigna un responsable a cada casa; sus próximas citas se reasignan solas.</li>
          <li><strong>Citas.</strong> Confirma, reprograma o cancela visitas desde la agenda semanal.</li>
        </ul>
        <p className="small muted" style={{ marginTop: '1rem' }}>{connected ? 'Conectado al servidor: cada cambio se guarda al momento.' : 'Entorno de diseño: los datos son ilustrativos y se restablecen al recargar la página.'} Soporte: soporte@zugar.example</p>
        <div className="dialog__actions"><button className="btn" type="button" onClick={close}>Entendido</button></div>
      </>
    ));

  return (
    <>
      <a className="skip-link" href="#view">Saltar al contenido</a>
      <header className="topbar">
        <Link className="brand" to="/resumen" aria-label="Zugar administración, ir al resumen">
          <span className="brand__name">Zugar<span>.</span></span>
          <span className="brand__tag">Administración · Cancún</span>
        </Link>
        <nav className="topnav" aria-label="Accesos generales">
          <Link to="/resumen" aria-current="page">Panel administrativo</Link>
          <a href="/" target="_blank" rel="noopener">Ver sitio público <Icon id="arrow-ur" className="icon--sm" /></a>
          <a href="#" onClick={(e) => { e.preventDefault(); help(); }}>Ayuda</a>
          <div className="user">
            <button ref={userBtn} className="user__btn" type="button" aria-expanded={userOpen} aria-controls="user-menu" id="user-btn" onClick={(e) => { e.stopPropagation(); setUserOpen(!userOpen); }}>
              {session.name} · {session.role}
            </button>
            <div className="user__menu" id="user-menu" hidden={!userOpen}>
              <strong id="user-name">{session.name}</strong>
              <p id="user-meta">{session.role} · {session.email}</p>
              <hr />
              <p id="user-exp">Tu sesión vence a las {String(exp.getHours()).padStart(2, '0')}:{String(exp.getMinutes()).padStart(2, '0')} h.</p>
              {connected && pushSupported() && permission !== 'granted' && (
                <button className="btn btn--sm" id="push-btn" type="button" style={{ marginBottom: '.5rem' }} disabled={permission === 'denied'} onClick={activatePush}
                  title={permission === 'denied' ? 'Permite las notificaciones de este sitio en la configuración del navegador.' : 'Recibe nuevas solicitudes, citas y reportes aunque el panel esté cerrado.'}>
                  {permission === 'denied' ? 'Avisos bloqueados en este navegador' : 'Activar avisos en este navegador'}
                </button>
              )}
              <button className="btn btn--secondary btn--sm" type="button" onClick={askLogout}>Cerrar sesión</button>
            </div>
          </div>
        </nav>
      </header>
      <div className="shell">
        <aside className="sidebar">
          <p className="sidebar__label" id="menu-label">Gestión inmobiliaria</p>
          <nav aria-labelledby="menu-label">
            <ul>
              {NAV.map(([id, icon, label]) => (
                <li key={id}><Link to={'/' + id} aria-current={section === id ? 'page' : undefined}><Icon id={icon} />{label}</Link></li>
              ))}
            </ul>
          </nav>
          <div className="sidebar__foot">
            <p>Casas para vivir Cancún.</p>
            <p>Equipo local · Octubre 2026</p>
            <p><span className="badge badge--gris">{connected ? 'Conectado al servidor' : 'Entorno de diseño'}</span></p>
          </div>
        </aside>
        <div className="main">
          <main className="view" id="view" tabIndex={-1}>
            {ready ? <Outlet /> : <p className="muted" role="status">Cargando datos de Zugar…</p>}
          </main>
          <footer className="footer">
            <span>© 2026 Zugar · Administración</span>
            <span>{connected ? 'Datos en vivo' : 'Diseño estático · Datos ilustrativos'}</span>
          </footer>
        </div>
      </div>
    </>
  );
}
