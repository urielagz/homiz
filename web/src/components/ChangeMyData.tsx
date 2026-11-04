import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { correctLead, type ApiError } from '../lib/api';
import { clean, emailRepeat, emailStrict, phone as phoneRule, required, type Errors } from '../lib/validation';
import { Dialog } from './Dialog';
import { EmailFields } from './EmailFields';
import { Field, invalid, Opt } from './Field';
import { Icon } from './Icon';

/* ==========================================================================
   «¿Te equivocaste en algún dato? Cambiar mis datos»: después de enviar un formulario (2 horas).
   Si cambia el correo, la cuenta de la app pasa al correo correcto con una contraseña temporal nueva
   (la del correo equivocado deja de servir).
   ========================================================================== */
export interface Contact { folio: string; token: string; name: string; email: string; phone: string }

export function ChangeMyData({ contact, onChanged }: { contact: Contact; onChanged: (c: Contact, message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: contact.name, email: contact.email, email2: '', phone: contact.phone });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const emailChanged = f.email.trim().toLowerCase() !== contact.email.trim().toLowerCase();

  const validate = (x: typeof f) => clean({
    name: required(x.name), email: emailStrict(x.email),
    email2: x.email.trim().toLowerCase() !== contact.email.trim().toLowerCase() ? emailRepeat(x.email, x.email2) : '',
    phone: phoneRule(x.phone),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // el diálogo vive en <body>, pero en React sigue dentro del formulario de la página
    const errs = validate(f);
    setErrors(errs);
    if (Object.keys(errs).length) { document.getElementById(`cd-${Object.keys(errs)[0] === 'email2' ? 'correo2' : Object.keys(errs)[0] === 'email' ? 'correo' : Object.keys(errs)[0]}`)?.focus(); return; }
    setSending(true); setError('');
    try {
      const r = await correctLead(contact.folio, contact.token, { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() });
      onChanged({ folio: r.folio, token: r.editToken, name: r.name, email: r.email, phone: r.phone ?? '' }, r.message);
      setOpen(false);
    } catch (err) {
      const a = err as ApiError;
      setError(a?.sinConexion ? 'No hay conexión. Inténtalo de nuevo.' : a?.mensaje || 'No pudimos guardar el cambio.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <p className="change-data">
        ¿Te equivocaste en algún dato? <button type="button" className="link-btn" onClick={() => { setF({ name: contact.name, email: contact.email, email2: '', phone: contact.phone }); setErrors({}); setError(''); setOpen(true); }}>Cambiar mis datos</button>
      </p>
      {createPortal(
        <Dialog open={open} onClose={() => setOpen(false)} labelledBy="cd-title">
          <form noValidate onSubmit={submit}>
            <h2 id="cd-title">Cambiar mis datos</h2>
            <p className="dlg-lead">Folio {contact.folio}. Si corriges tu correo, tu cuenta de la app pasa al correo nuevo y te enviamos ahí otra contraseña temporal.</p>
            {error && <div className="alert alert-error is-visible" role="alert"><Icon id="alert" /><div>{error}</div></div>}
            <div className="form-grid">
              <Field id="cd-name" label="Nombre completo *" error={errors.name}>
                <input className="input" id="cd-name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} {...invalid('cd-name', errors.name)} />
              </Field>
              <EmailFields prefix="cd" value={f.email} repeat={f.email2} error={errors.email} repeatError={emailChanged ? errors.email2 : undefined}
                onChange={(email, email2) => setF({ ...f, email, email2 })} />
              <Field id="cd-phone" label={<>Teléfono <Opt>(opcional)</Opt></>} error={errors.phone}>
                <input className="input" id="cd-phone" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} {...invalid('cd-phone', errors.phone)} />
              </Field>
            </div>
            <div className="dlg-actions">
              <button className="btn btn--secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn" type="submit" disabled={sending} aria-busy={sending || undefined}>{sending ? 'Guardando…' : 'Guardar mis datos'}</button>
            </div>
          </form>
        </Dialog>,
        document.body,
      )}
    </>
  );
}
