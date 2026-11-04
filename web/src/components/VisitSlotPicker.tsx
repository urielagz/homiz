import { useEffect, useMemo, useState } from 'react';
import { request } from '../lib/api';
import { longDate, t12 } from '../lib/format';
import { Icon } from './Icon';

/* ==========================================================================
   «¿Te gustaría agendar una cita?»: calendario y reloj siempre visibles.
   - Calendario del mes: cualquier día, desde hoy y hasta 60 días.
   - Hora de 1 a 12 con a.m./p.m. (cualquier hora del día) y minutos en bloques de 15 (:00, :15, :30, :45);
     la visita dura 15 min. Hoy, solo desde una hora después de ahora. El valor sigue siendo «HH:MM» de 24 h.
   - Con `slug`, se piden al servidor las horas que el broker ya tiene ocupadas ese día.
   - El reloj muestra la hora elegida.
   ========================================================================== */
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MAX_DAYS = 60;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const atNoon = (s: string) => new Date(s + 'T12:00:00');

/** Hora de Cancún ahora (para no ofrecer horas que ya pasaron) */
function cancunNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cancun', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: (+p.hour % 24) * 60 + +p.minute };
}

/** Bloques de 15 minutos de todo el día (00:00 a 23:45) */
export function slotsFor(date: string): string[] {
  const now = cancunNow();
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += 15) {
    if (date === now.date && m < now.minutes + 60) continue;
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

function Clock({ time }: { time: string }) {
  const [h, m] = time ? time.split(':').map(Number) : [10, 10];
  const hourAngle = ((h % 12) + m / 60) * 30;
  const minuteAngle = m * 6;
  return (
    <svg className={'slot-clock' + (time ? '' : ' is-empty')} viewBox="0 0 100 100" role="img" aria-label={time ? `Reloj marcando las ${t12(time)}` : 'Reloj: aún no eliges hora'}>
      <circle cx="50" cy="50" r="46" className="slot-clock__face" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="50" y1="8" x2="50" y2={i % 3 === 0 ? 15 : 12} className="slot-clock__tick" transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <line x1="50" y1="50" x2="50" y2="28" className="slot-clock__hour" transform={`rotate(${hourAngle} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="16" className="slot-clock__minute" transform={`rotate(${minuteAngle} 50 50)`} />
      <circle cx="50" cy="50" r="3" className="slot-clock__pin" />
    </svg>
  );
}

interface Props {
  /** Prefijo de los id (para enlazar errores y etiquetas) */
  id: string;
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
  /** Propiedad: se consultan las horas ocupadas de su broker */
  slug?: string;
  dateError?: string;
  timeError?: string;
}

export function VisitSlotPicker({ id, date, time, onChange, slug, dateError, timeError }: Props) {
  const today = cancunNow().date;
  const last = iso(new Date(atNoon(today).getTime() + MAX_DAYS * 864e5));
  const [month, setMonth] = useState(() => (date || today).slice(0, 7));
  const [busy, setBusy] = useState<string[]>([]);

  useEffect(() => {
    setBusy([]);
    if (!slug || !date) return;
    let alive = true;
    request<{ busy: string[] }>(`/public/properties/${encodeURIComponent(slug)}/busy?fecha=${date}`)
      .then((r) => alive && setBusy(r.busy || []), () => {});
    return () => { alive = false; };
  }, [slug, date]);

  const cells = useMemo(() => {
    const first = atNoon(month + '-01');
    const offset = (first.getDay() + 6) % 7; // lunes primero
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  }, [month]);

  const shift = (n: number) => {
    const d = atNoon(month + '-01');
    d.setMonth(d.getMonth() + n);
    setMonth(iso(d).slice(0, 7));
  };
  const monthLabel = atNoon(month + '-01').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const slots = date ? slotsFor(date) : [];
  const free = slots.filter((s) => !busy.includes(s));
  const pick = (d: string) => onChange(d, slotsFor(d).includes(time) ? time : '');
  // a.m./p.m., luego la hora (1 a 12) y luego los minutos; una hora se apaga si ya pasó o está ocupada completa.
  // `hour` guarda la hora de 24 h ('00'–'23'); en pantalla se ve de 1 a 12.
  const [hour, setHour] = useState(time ? time.slice(0, 2) : '');
  const [ap, setAp] = useState<'am' | 'pm'>(time && +time.slice(0, 2) >= 12 ? 'pm' : 'am');
  useEffect(() => { if (time) { setHour(time.slice(0, 2)); setAp(+time.slice(0, 2) >= 12 ? 'pm' : 'am'); } }, [time]);
  // Si ya no quedan horas en la mañana (hoy), se abre en p.m.
  useEffect(() => { if (!time && date && !free.some((s) => +s.slice(0, 2) < 12)) setAp('pm'); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  // 12 primero (12 a.m. = 00 h, 12 p.m. = 12 h), luego 1 a 11
  const hours = Array.from({ length: 12 }, (_, i) => String(i + (ap === 'pm' ? 12 : 0)).padStart(2, '0'));
  const label12 = (h: string) => String(+h % 12 || 12);
  const chooseHour = (h: string) => {
    setHour(h);
    const first = free.find((s) => s.startsWith(h + ':'));
    if (first) onChange(date, time.startsWith(h + ':') && free.includes(time) ? time : first);
  };
  const chooseAp = (v: 'am' | 'pm') => { setAp(v); setHour(''); };

  return (
    <div className="slot-picker">
      <div className={'slot-cal' + (dateError ? ' is-error' : '')} id={`${id}-fecha`} tabIndex={-1} role="group" aria-labelledby={`${id}-fecha-label`}>
        <p className="slot-picker__label" id={`${id}-fecha-label`}><Icon id="cal" size="sm" />Fecha *</p>
        <div className="slot-cal__head">
          <button type="button" className="slot-cal__nav" onClick={() => shift(-1)} disabled={month <= today.slice(0, 7)} aria-label="Mes anterior"><Icon id="left" size="sm" /></button>
          <strong aria-live="polite">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</strong>
          <button type="button" className="slot-cal__nav" onClick={() => shift(1)} disabled={month >= last.slice(0, 7)} aria-label="Mes siguiente"><Icon id="right" size="sm" /></button>
        </div>
        <div className="slot-cal__grid">
          {DAYS.map((d, i) => <span key={i} className="slot-cal__dow" aria-hidden="true">{d}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={'x' + i} />;
            const off = d < today || d > last || !slotsFor(d).length;
            return (
              <button key={d} type="button" className={'slot-cal__day' + (d === today ? ' is-today' : '')} aria-pressed={date === d} disabled={off}
                aria-label={longDate(d)} onClick={() => pick(d)}>
                {+d.slice(8)}
              </button>
            );
          })}
        </div>
        {dateError && <p className="field__error flex"><Icon id="alert" size="sm" />{dateError}</p>}
      </div>

      <div className={'slot-time' + (timeError ? ' is-error' : '')} id={`${id}-horario`} tabIndex={-1} role="group" aria-labelledby={`${id}-horario-label`}>
        <div className="slot-time__head">
          <Clock time={time} />
          <div>
            <p className="slot-picker__label" id={`${id}-horario-label`}><Icon id="clock" size="sm" />Hora *</p>
            <p className="slot-time__chosen" aria-live="polite">
              {date ? (time ? `${longDate(date)} · ${t12(time)}` : longDate(date)) : 'Primero elige el día en el calendario'}
            </p>
            <p className="small muted">Elige a.m. o p.m., la hora y los minutos · la visita dura 15 minutos.</p>
          </div>
        </div>
        {date && (free.length ? (
          <>
            <div className="slot-ap" role="group" aria-label="a.m. o p.m.">
              {(['am', 'pm'] as const).map((v) => {
                const open = free.some((s) => (+s.slice(0, 2) < 12) === (v === 'am'));
                return (
                  <button key={v} type="button" className="slot" aria-pressed={ap === v} disabled={!open} onClick={() => chooseAp(v)}>
                    {v === 'am' ? 'a.m. · mañana' : 'p.m. · tarde y noche'}
                  </button>
                );
              })}
            </div>
            <p className="slot-time__group" id={`${id}-hora-label`}>Hora (1 a 12)</p>
            <div className="slot-time__grid slot-time__grid--hours" role="group" aria-labelledby={`${id}-hora-label`}>
              {hours.map((h) => {
                const open = free.some((s) => s.startsWith(h + ':'));
                const name = `${label12(h)} ${ap === 'am' ? 'a.m.' : 'p.m.'}`;
                return (
                  <button key={h} type="button" className="slot" aria-pressed={hour === h} disabled={!open} onClick={() => chooseHour(h)}
                    aria-label={open ? name : `${name}, no disponible`}>{label12(h)}</button>
                );
              })}
            </div>
            {hour && (
              <>
                <p className="slot-time__group" id={`${id}-min-label`}>Minutos</p>
                <div className="slot-time__grid" role="group" aria-labelledby={`${id}-min-label`}>
                  {['00', '15', '30', '45'].map((m) => {
                    const s = `${hour}:${m}`;
                    const taken = busy.includes(s), past = !slots.includes(s);
                    return (
                      <button key={m} type="button" className="slot" aria-pressed={time === s} disabled={taken || past} onClick={() => onChange(date, s)}
                        aria-label={taken ? `${t12(s)}, ocupado` : past ? `${t12(s)}, ya pasó` : t12(s)}>{label12(hour)}:{m}</button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <p className="small muted">Ya no quedan horarios este día. Elige otro.</p>
        ))}
        {timeError && <p className="field__error flex"><Icon id="alert" size="sm" />{timeError}</p>}
      </div>
    </div>
  );
}
