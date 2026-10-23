import { Link } from 'react-router';

/** Páginas que todavía no se migran a React (fases B y C). */
export function Pending({ name }: { name: string }) {
  return (
    <section className="section">
      <div className="wrap">
        <span className="eyebrow">En migración a React</span>
        <h1 className="text-(length:--fs-2xl)">{name}</h1>
        <p className="lead mt-3">Esta página se migra en la siguiente fase. Mientras tanto sigue disponible en el sitio HTML.</p>
        <p className="mt-6"><Link className="btn" to="/">Volver al inicio</Link></p>
      </div>
    </section>
  );
}
