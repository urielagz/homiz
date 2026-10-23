import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCatalog } from '../components/CatalogProvider';
import { Icon } from '../components/Icon';
import { PropertyCard } from '../components/PropertyCard';
import { VisitRequest } from '../components/VisitRequest';
import { usePageTitle } from '../lib/usePageTitle';

/* Las 6 casas destacadas de la portada (3 en renta y 3 en venta), con su texto alternativo original */
const FEATURED: [string, string][] = [
  ['casa-ceiba', 'Fachada de Casa Ceiba con jardín tropical al frente'],
  ['casa-del-patio', 'Terraza con pérgola de madera y jardín de Casa del Patio'],
  ['casa-olivo', 'Casa Olivo, de estilo colonial caribeño con balcón y plantas'],
  ['casa-de-la-luz', 'Casa de la Luz, residencia de dos niveles con grandes ventanales'],
  ['casa-nativa', 'Casa Nativa con alberca y fachada de madera y piedra'],
  ['casa-almendra', 'Casa Almendra con cochera y jardín frontal'],
];

const ZONES = [
  ['', 'Todo Cancún'], ['arbolada', 'Arbolada'], ['cumbres', 'Residencial Cumbres'], ['huayacan', 'Huayacán'],
  ['lagos-del-sol', 'Lagos del Sol'], ['santa-fe', 'Santa Fe'], ['aqua', 'Aqua Residencial'],
];
const BUDGETS = [
  ['30000', 'Hasta $30,000 / mes'], ['40000', 'Hasta $40,000 / mes'],
  ['3500000', 'Hasta $3.5 millones'], ['5000000', 'Hasta $5 millones'], ['mas', 'Más de $5 millones'],
];

type Tab = 'todas' | 'renta' | 'venta';

export function Home() {
  usePageTitle('Casas en renta y venta en Cancún | Zugar Inmobiliaria');
  const { bySlug } = useCatalog();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('todas');
  const [search, setSearch] = useState({ zona: '', operacion: 'renta', presupuesto: '' });

  const featured = FEATURED.map(([slug, alt]) => ({ house: bySlug[slug], alt })).filter((x) => x.house);
  const visible = featured.filter((x) => tab === 'todas' || x.house.op === tab);
  const rentCount = featured.filter((x) => x.house.op === 'renta').length;

  // Presupuestos de renta (menos de un millón) o de venta, según la operación
  const budgets = BUDGETS.filter(([v]) => (search.operacion === 'renta') === (Number(v) > 0 && Number(v) < 1e6));

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams(Object.entries(search).filter(([, v]) => v));
    navigate('/propiedades?' + q.toString());
  };

  return (
    <>
      {/* Hero */}
      <section className="hero" aria-labelledby="hero-titulo">
        <div className="wrap hero__grid">
          <div>
            <div className="hero__card">
              <span className="eyebrow">Casas en Cancún · Renta y venta</span>
              <h1 id="hero-titulo">Tu próxima casa. Tu ritmo de vida.</h1>
              <p>Somos una inmobiliaria pequeña de Cancún. Te atendemos de forma directa, sin intermediarios ni prisas, para encontrar una casa que se sienta tuya, en renta o en venta.</p>
              <form className="hero-search" role="search" aria-label="Buscar casas" onSubmit={onSearch}>
                <div className="field">
                  <label className="field__label" htmlFor="h-zona">Ubicación</label>
                  <select className="select" id="h-zona" value={search.zona} onChange={(e) => setSearch({ ...search, zona: e.target.value })}>
                    {ZONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="h-operacion">Operación</label>
                  <select className="select" id="h-operacion" value={search.operacion} onChange={(e) => setSearch({ ...search, operacion: e.target.value, presupuesto: '' })}>
                    <option value="renta">Renta</option>
                    <option value="venta">Venta</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="h-presupuesto">Presupuesto</label>
                  <select className="select" id="h-presupuesto" value={search.presupuesto} onChange={(e) => setSearch({ ...search, presupuesto: e.target.value })}>
                    <option value="">Cualquiera</option>
                    {budgets.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
                <div className="hero-search__actions">
                  <button className="btn btn--gold btn--lg" type="submit"><Icon id="search" />Buscar propiedades</button>
                  <Link className="btn btn--white btn--lg" to="/contacto?motivo=publicar">Publicar inmueble</Link>
                </div>
              </form>
            </div>
            <p className="hero__note"><Icon id="pin" />Con calma, con claridad y con alguien de aquí.</p>
          </div>
          <figure className="hero__figure">
            <div className="photo">
              <img src="/assets/img/hero-casa-cancun.jpg" alt="Casa moderna de muros claros con palmeras y celosía de madera en Cancún" fetchPriority="high" />
            </div>
            <figcaption><span>Luz, sombra y espacio para vivir.</span><span>Cancún, Q. Roo</span></figcaption>
          </figure>
        </div>
      </section>

      {/* Franja de confianza */}
      <div className="trust">
        <div className="wrap trust__inner">
          <p className="trust__main"><Icon id="home" />Solo casas. Solo Cancún. Atención de persona a persona.</p>
          <p className="muted">Te respondemos en menos de un día hábil</p>
        </div>
      </div>

      {/* Propiedades */}
      <section className="section" id="propiedades" aria-labelledby="prop-titulo">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">01 / Propiedades</span>
              <h2 id="prop-titulo">Un lugar para lo que viene.</h2>
              <p>Casas para distintas formas de vivir en Cancún. Explora con calma; nosotros te acompañamos en el siguiente paso.</p>
            </div>
            <div>
              <nav className="tabs" aria-label="Filtrar por operación">
                {([['todas', 'Todas'], ['renta', 'En renta'], ['venta', 'En venta']] as [Tab, string][]).map(([t, label]) => (
                  <a key={t} className="tab" href={t === 'todas' ? '#propiedades' : `/propiedades?operacion=${t}`} aria-current={tab === t ? 'page' : undefined}
                    onClick={(e) => { e.preventDefault(); setTab(t); }}>
                    {label}
                  </a>
                ))}
              </nav>
              <p className="tabs-meta">
                {tab === 'todas'
                  ? `${featured.length} casas destacadas · ${rentCount} en renta y ${featured.length - rentCount} en venta`
                  : `${visible.length} casas destacadas ${tab === 'renta' ? 'en renta' : 'en venta'}`}
              </p>
            </div>
          </div>

          <div className="cards">
            {visible.map(({ house, alt }) => <PropertyCard key={house.slug} house={house} alt={alt} />)}
          </div>

          <div className="section-foot">
            <Link className="btn btn--secondary btn--lg" to={tab === 'todas' ? '/propiedades' : `/propiedades?operacion=${tab}`}>
              {tab === 'todas' ? 'Ver todas las casas' : `Ver todas las casas ${tab === 'renta' ? 'en renta' : 'en venta'}`}
              <Icon id="arrow" />
            </Link>
          </div>
        </div>
      </section>

      {/* Cómo trabajamos */}
      <section className="section section--surface" aria-labelledby="pasos-titulo">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">02 / Cómo trabajamos</span>
              <h2 id="pasos-titulo">Menos vueltas. Más cercanía.</h2>
              <p>Un proceso sencillo, de la primera plática a tu próxima casa.</p>
            </div>
            <Link className="link-arrow" to="/como-trabajamos">Conoce el proceso completo<Icon id="arrow" size="sm" /></Link>
          </div>
          <ol className="steps">
            <li className="step">
              <span className="step__num" aria-hidden="true">01</span>
              <h3>Platicamos de ti</h3>
              <p>Nos cuentas qué buscas, tu presupuesto y cómo te gustaría vivir. Escuchamos antes de proponerte una casa.</p>
            </li>
            <li className="step">
              <span className="step__num" aria-hidden="true">02</span>
              <h3>La conocemos juntos</h3>
              <p>Acordamos una visita y recorremos la casa contigo. Hablamos de la zona, los espacios y tus dudas, sin prisas.</p>
            </li>
            <li className="step">
              <span className="step__num" aria-hidden="true">03</span>
              <h3>Decides con claridad</h3>
              <p>Si la casa es para ti, revisamos requisitos y siguientes pasos de renta o compra. Tú decides; nosotros te orientamos.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* Contacto: solicitud de visita */}
      <section className="section" id="contacto" aria-labelledby="contacto-titulo">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">03 / Contáctanos</span>
              <h2 id="contacto-titulo">Una buena casa empieza con una buena plática.</h2>
              <p>Cuéntanos un poco de ti y de lo que necesitas. Con estos datos preparamos tu visita a la casa, sin prisas y con todo claro.</p>
            </div>
          </div>
          <VisitRequest />
        </div>
      </section>
    </>
  );
}
