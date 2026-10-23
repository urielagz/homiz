import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { sendLead, type ApiError, type LeadReason } from '../lib/api';
import { appLink } from '../lib/appLink';
import { photoOf, priceUnit, type House } from '../lib/catalog';
import { fakeFolio, longDate, money, todayISO } from '../lib/format';
import { clean, email, futureDate, phone, required, type Errors } from '../lib/validation';
import { useCatalog } from './CatalogProvider';
import { Dialog } from './Dialog';
import { Field, invalid, Opt } from './Field';
import { Icon } from './Icon';
import { useToast } from './Toasts';

/* ==========================================================================
   Solicitud de visita (sección «Contáctanos» del inicio).
   A la izquierda, el resumen que se actualiza con lo que elige la persona;
   a la derecha, el formulario. Antes de enviar se muestra un resumen para revisar.
   Envía a POST /public/leads; sin servidor, simula el envío como el sitio original.
   ========================================================================== */
const HOURS = ['10:00', '11:30', '13:00', '16:00', '17:30'];

const EMPTY = {
  nombre: '', correo: '', telefono: '', nacionalidad: '', ocupacion: '',
  operacion: 'renta' as 'renta' | 'compra', casa: '', presupuesto: '',
  recamaras: '3', banos: '2', personas: '2', mascotas: '' as '' | 'si' | 'no', mascotas_detalle: '',
  fecha: '', horario: '', comentarios: '',
};
type Form = typeof EMPTY;

const LABELS: [keyof Form, string][] = [
  ['nombre', 'Nombre completo'], ['correo', 'Correo electrónico'], ['telefono', 'Teléfono'], ['nacionalidad', 'Nacionalidad'],
  ['ocupacion', '¿En qué trabajas?'], ['operacion', 'Operación'], ['casa', 'Casa de interés'], ['presupuesto', 'Presupuesto aproximado'],
  ['recamaras', 'Número de recámaras'], ['banos', 'Número de baños'], ['personas', 'Personas que vivirán en la casa'],
  ['mascotas', '¿Tienes mascotas?'], ['mascotas_detalle', '¿Cuáles y cuántas mascotas?'], ['fecha', 'Fecha preferida'],
  ['horario', 'Horario'], ['comentarios', 'Comentarios'],
];

export function VisitRequest() {
  const { houses, bySlug, loading } = useCatalog();
  const [params] = useSearchParams();
  const toast = useToast();
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [showErrors, setShowErrors] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ folio: string; text: string } | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // ?casa=casa-ceiba en el enlace: la casa llega elegida
  useEffect(() => {
    const c = bySlug[params.get('casa') || ''];
    if (c) setF((x) => ({ ...x, casa: c.slug, operacion: c.op === 'venta' ? 'compra' : 'renta' }));
  }, [params, bySlug]);

  const house: House | undefined = bySlug[f.casa];
  const options = useMemo(() => houses.filter((h) => (f.operacion === 'compra' ? h.op === 'venta' : h.op === 'renta')), [houses, f.operacion]);

  const validate = (x: Form): Errors =>
    clean({
      nombre: required(x.nombre),
      correo: email(x.correo),
      telefono: phone(x.telefono),
      nacionalidad: required(x.nacionalidad),
      ocupacion: required(x.ocupacion),
      casa: required(x.casa, true),
      presupuesto: required(x.presupuesto),
      mascotas: x.mascotas ? '' : 'Elige una opción.',
      mascotas_detalle: x.mascotas === 'si' ? required(x.mascotas_detalle) : '',
      fecha: futureDate(x.fecha),
      horario: required(x.horario, true),
    });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => {
      const next = { ...x, [k]: v };
      if (k === 'operacion') {
        // La lista de casas solo muestra las de la operación elegida
        const c = bySlug[next.casa];
        if (c && (c.op === 'venta') !== (v === 'compra')) next.casa = '';
      }
      if (k === 'casa') {
        const c = bySlug[v as string];
        if (c) next.operacion = c.op === 'venta' ? 'compra' : 'renta';
      }
      if (showErrors) setErrors(validate(next));
      return next;
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (loading) return; // aún se carga el catálogo
    const errs = validate(f);
    setErrors(errs);
    setShowErrors(true);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(first === 'mascotas' ? 'mascotas-si' : `b-${first}`)?.focus();
      return;
    }
    setReviewing(true);
  };

  const send = async () => {
    setReviewing(false);
    setSending(true);
    const reason: LeadReason = house ? 'visita' : f.operacion === 'compra' ? 'comprar' : 'rentar';
    try {
      const { nombre, correo, telefono, comentarios, casa, fecha, horario, ...rest } = f;
      const r = await sendLead({
        reason, name: nombre.trim(), email: correo.trim(), phone: telefono, message: comentarios,
        propertySlug: casa !== 'sin-definir' ? casa : undefined, preferredDate: fecha, preferredTime: horario,
        payload: rest as Record<string, string>,
      }).catch((err: ApiError) => {
        if (err?.sinConexion) return new Promise<{ folio: string }>((ok) => setTimeout(() => ok({ folio: fakeFolio() }), 700));
        throw err;
      });
      const first = nombre.trim().split(' ')[0];
      setDone({
        folio: r.folio,
        text: house
          ? `¡Listo, ${first}! Recibimos tu solicitud de visita.|${house.asesor || 'Tu asesora'} te escribirá en menos de 24 horas para confirmar ${longDate(fecha).toLowerCase()} · ${horario} h.`
          : `¡Gracias, ${first}! Recibimos tu solicitud.|En un día hábil te enviaremos a ${correo.trim()} casas ${f.operacion === 'compra' ? 'en venta' : 'en renta'} que encajan contigo.`,
      });
      setTimeout(() => successRef.current?.focus(), 0);
    } catch (err) {
      const e = err as ApiError;
      if (!e?.mensaje) console.error(err);
      toast(e?.mensaje || 'No pudimos enviar tu solicitud. Inténtalo de nuevo o usa la app Homiz.');
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setF(EMPTY); setErrors({}); setShowErrors(false); setDone(null);
    setTimeout(() => document.getElementById('b-nombre')?.focus(), 0);
  };

  const reviewRows = LABELS.map(([k, label]): [string, string] => {
    const v = f[k];
    if (!v || (k === 'mascotas_detalle' && f.mascotas !== 'si')) return [label, ''];
    if (k === 'operacion') return [label, v === 'compra' ? 'Compra' : 'Renta'];
    if (k === 'casa') return [label, v === 'sin-definir' ? 'Aún no lo sé, quiero recomendaciones' : bySlug[v] ? `${bySlug[v].name} · ${bySlug[v].zona}` : v];
    if (k === 'mascotas') return [label, v === 'si' ? 'Sí' : 'No'];
    if (k === 'fecha') return [label, longDate(v)];
    if (k === 'horario') return [label, v + ' h'];
    if (k === 'recamaras' && v === '4') return [label, '4 o más'];
    if (k === 'banos' && v === '3') return [label, '3 o más'];
    if (k === 'personas' && v === '5') return [label, '5 o más'];
    return [label, v.trim()];
  }).filter(([, v]) => v);

  const err = (k: keyof Form) => (showErrors ? errors[k] : undefined);
  const hasErrors = showErrors && Object.keys(errors).length > 0;

  return (
    <div className="booking__layout">
      <aside className="booking__aside" aria-label="Resumen de tu solicitud">
        <section className="summary" id="resumen" aria-labelledby="resumen-titulo" aria-live="polite">
          <span className="eyebrow">Tu solicitud</span>
          {house && (
            <div className="photo">
              <img src={photoOf(house)} alt={`${house.name} en ${house.zona}, Cancún`} loading="lazy" />
            </div>
          )}
          <h3 id="resumen-titulo">{house ? house.name : f.casa === 'sin-definir' ? 'Te recomendamos opciones' : 'Elige una casa'}</h3>
          <p className="summary__loc">
            {house ? `${house.zona}, Cancún` : f.casa === 'sin-definir' ? 'Te propondremos casas según lo que buscas.' : 'Aquí verás los datos de la casa que elijas.'}
          </p>
          {house && (
            <p className="summary__price">
              <strong>{money(house.price)}</strong> {priceUnit(house)}
            </p>
          )}
          <p className="summary__specs">
            {house && `${house.rec} recámaras · ${house.banos} baños · ${house.m2} m² · ${house.pets ? 'Acepta mascotas' : 'No acepta mascotas'}`}
          </p>
          <dl>
            <div><dt>Operación</dt><dd>{f.operacion === 'compra' ? 'Compra' : 'Renta'}</dd></div>
            <div><dt>Tu visita</dt><dd>{f.fecha ? longDate(f.fecha) + (f.horario ? ` · ${f.horario} h` : '') : 'Elige fecha y horario'}</dd></div>
            <div><dt>Duración de la visita</dt><dd>45 minutos aproximadamente</dd></div>
            <div><dt>Te acompaña</dt><dd>{house?.asesor || 'Tu asesora o asesor de Zugar'}</dd></div>
            <div><dt>Punto de encuentro</dt><dd>{house ? 'En la casa · ' + house.zona.replace(/^Residencial /, '') : 'En la casa que elijas'}</dd></div>
            <div><dt>Confirmación</dt><dd>Por WhatsApp en menos de 24 horas</dd></div>
          </dl>
          <p className="summary__foot">Tu visita queda confirmada cuando te escribamos con el día y la hora acordados.</p>
        </section>
        <section className="side-card" aria-labelledby="hablar-titulo">
          <h3 id="hablar-titulo">¿Prefieres hablar?</h3>
          <ul className="side-card__list">
            <li><a href={appLink(house?.slug)} target="_blank" rel="noopener"><Icon id="phone" />App Homiz</a></li>
            <li><a href="tel:+529985550142"><Icon id="phone" />+52 998 555 0142</a></li>
            <li><a href="mailto:hola@zugar.mx"><Icon id="mail" />hola@zugar.mx</a></li>
            <li><span><Icon id="clock" />Lun–vie 9:00–18:00 · Sáb 10:00–14:00</span></li>
          </ul>
          <p className="side-card__note">No tenemos oficina física: te atendemos por teléfono, WhatsApp y directamente en cada casa.</p>
        </section>
      </aside>

      <form className="booking-form" noValidate onSubmit={onSubmit}>
        {done ? (
          <>
            <div className="alert alert-success" role="status" tabIndex={-1} ref={successRef}>
              <Icon id="check-c" />
              <div>
                <strong>{done.text.split('|')[0]}</strong>
                {done.text.split('|')[1]} Tu folio es <b>{done.folio}</b>.
              </div>
            </div>
            <button className="btn btn--secondary" type="button" onClick={reset}>Enviar otra solicitud</button>
          </>
        ) : (
          <>
            {hasErrors && (
              <div className="alert alert-error is-visible" role="alert">
                <Icon id="alert" />
                <div><strong>Revisa los campos señalados</strong>Tu solicitud aún no se ha enviado. Lo que escribiste se conserva.</div>
              </div>
            )}

            <fieldset>
              <legend>1. Tus datos</legend>
              <div className="form-grid">
                <Field id="b-nombre" label="Nombre completo *" error={err('nombre')}>
                  <input className="input" id="b-nombre" type="text" autoComplete="name" placeholder="Nombre y apellidos" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} {...invalid('b-nombre', err('nombre'))} />
                </Field>
                <Field id="b-correo" label="Correo electrónico *" error={err('correo')}>
                  <input className="input" id="b-correo" type="email" autoComplete="email" placeholder="tu@correo.com" value={f.correo} onChange={(e) => set('correo', e.target.value)} {...invalid('b-correo', err('correo'))} />
                </Field>
                <Field id="b-telefono" label={<>Teléfono <Opt>(opcional)</Opt></>} error={err('telefono')} help={err('telefono') ? undefined : 'Para confirmar tu visita por WhatsApp.'}>
                  <input className="input" id="b-telefono" type="tel" autoComplete="tel" placeholder="998 000 0000" value={f.telefono} onChange={(e) => set('telefono', e.target.value)} {...invalid('b-telefono', err('telefono'))} />
                </Field>
                <Field id="b-nacionalidad" label="Nacionalidad *" error={err('nacionalidad')}>
                  <input className="input" id="b-nacionalidad" type="text" autoComplete="country-name" placeholder="Mexicana" value={f.nacionalidad} onChange={(e) => set('nacionalidad', e.target.value)} {...invalid('b-nacionalidad', err('nacionalidad'))} />
                </Field>
                <Field id="b-ocupacion" label="¿En qué trabajas? *" error={err('ocupacion')} className="span-2">
                  <input className="input" id="b-ocupacion" type="text" autoComplete="organization-title" placeholder="Por ejemplo: diseño de interiores" value={f.ocupacion} onChange={(e) => set('ocupacion', e.target.value)} {...invalid('b-ocupacion', err('ocupacion'))} />
                </Field>
              </div>
            </fieldset>

            <fieldset>
              <legend>2. La casa que buscas</legend>
              <div className="form-grid">
                <Field id="b-operacion" label="Operación *">
                  <select className="select" id="b-operacion" value={f.operacion} onChange={(e) => set('operacion', e.target.value as Form['operacion'])}>
                    <option value="renta">Renta</option>
                    <option value="compra">Compra</option>
                  </select>
                </Field>
                <Field id="b-casa" label="Casa de interés *" error={err('casa')}>
                  <select className="select" id="b-casa" value={f.casa} onChange={(e) => set('casa', e.target.value)} {...invalid('b-casa', err('casa'))}>
                    <option value="">Elige una casa</option>
                    <optgroup label={f.operacion === 'compra' ? 'En venta' : 'En renta'}>
                      {options.map((h) => (
                        <option key={h.slug} value={h.slug}>{h.name} · {h.zona}</option>
                      ))}
                    </optgroup>
                    <option value="sin-definir">Aún no lo sé, quiero recomendaciones</option>
                  </select>
                </Field>
                <Field id="b-presupuesto" label="Presupuesto aproximado *" error={err('presupuesto')}>
                  <input className="input" id="b-presupuesto" type="text" inputMode="numeric" placeholder={f.operacion === 'compra' ? '$4,000,000 MXN' : '$30,000 MXN / mes'} value={f.presupuesto} onChange={(e) => set('presupuesto', e.target.value)} {...invalid('b-presupuesto', err('presupuesto'))} />
                </Field>
                <Field id="b-recamaras" label="Número de recámaras *">
                  <select className="select" id="b-recamaras" value={f.recamaras} onChange={(e) => set('recamaras', e.target.value)}>
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4 o más</option>
                  </select>
                </Field>
                <Field id="b-banos" label="Número de baños *">
                  <select className="select" id="b-banos" value={f.banos} onChange={(e) => set('banos', e.target.value)}>
                    <option value="1">1</option><option value="2">2</option><option value="3">3 o más</option>
                  </select>
                </Field>
                <Field id="b-personas" label="Personas que vivirán en la casa *">
                  <select className="select" id="b-personas" value={f.personas} onChange={(e) => set('personas', e.target.value)}>
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 o más</option>
                  </select>
                </Field>
                <Field id="b-mascotas" label="¿Tienes mascotas? *" error={err('mascotas')} className="span-2" group>
                  <div className="choice-group">
                    {(['si', 'no'] as const).map((v) => (
                      <label key={v} className="choice">
                        <input type="radio" id={`mascotas-${v}`} name="mascotas" value={v} checked={f.mascotas === v} onChange={() => set('mascotas', v)} {...invalid('b-mascotas', err('mascotas'))} />
                        <span>{v === 'si' ? 'Sí' : 'No'}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                {f.mascotas === 'si' && (
                  <Field id="b-mascotas_detalle" label="¿Cuáles y cuántas mascotas? *" error={err('mascotas_detalle')} className="span-2" help={err('mascotas_detalle') ? undefined : 'Así te mostramos solo casas donde sean bienvenidas.'}>
                    <input className="input" id="b-mascotas_detalle" type="text" placeholder="Por ejemplo: 1 perro pequeño" value={f.mascotas_detalle} onChange={(e) => set('mascotas_detalle', e.target.value)} {...invalid('b-mascotas_detalle', err('mascotas_detalle'))} />
                  </Field>
                )}
              </div>
            </fieldset>

            <fieldset>
              <legend>3. Elige un momento</legend>
              <div className="form-grid">
                <Field id="b-fecha" label="Fecha preferida *" error={err('fecha')}>
                  <input className="input" id="b-fecha" type="date" min={todayISO()} value={f.fecha} onChange={(e) => set('fecha', e.target.value)} {...invalid('b-fecha', err('fecha'))} />
                </Field>
                <Field id="b-horario" label="Horario *" error={err('horario')}>
                  <select className="select" id="b-horario" value={f.horario} onChange={(e) => set('horario', e.target.value)} {...invalid('b-horario', err('horario'))}>
                    <option value="">Elige un horario</option>
                    {HOURS.map((h) => <option key={h} value={h}>{h} h</option>)}
                  </select>
                </Field>
                <Field id="b-comentarios" label={<>Comentarios <Opt>(opcional)</Opt></>} className="span-2">
                  <textarea className="textarea" id="b-comentarios" placeholder="Por ejemplo: nos gustaría conocer el patio y la iluminación de la casa por la mañana." value={f.comentarios} onChange={(e) => set('comentarios', e.target.value)} />
                </Field>
              </div>
            </fieldset>

            <div className="form-actions">
              <button className="btn btn--lg" type="submit" disabled={sending || loading} aria-busy={sending || undefined}>
                {sending ? 'Enviando…' : <>Revisar solicitud<Icon id="arrow-ur" /></>}
              </button>
              <p className="form-note">
                Te mostraremos un resumen antes de enviar. Al continuar aceptas nuestro <Link to="/contacto#aviso-privacidad">Aviso de privacidad</Link>.
              </p>
            </div>
          </>
        )}
      </form>

      <Dialog open={reviewing} onClose={() => setReviewing(false)} labelledBy="dlg-title">
        <h2 id="dlg-title">Revisa tu solicitud</h2>
        <p className="dlg-lead">Confirma que tus datos estén bien antes de enviarlos.</p>
        <dl className="review">
          {reviewRows.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <div className="dlg-actions">
          <button className="btn btn--secondary" type="button" onClick={() => setReviewing(false)}>Corregir datos</button>
          <button className="btn" type="button" onClick={send} autoFocus>Enviar solicitud</button>
        </div>
      </Dialog>
    </div>
  );
}
