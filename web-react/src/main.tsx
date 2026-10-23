import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router';
import { CatalogProvider } from './components/CatalogProvider';
import { SiteLayout } from './components/SiteLayout';
import { ToastProvider } from './components/Toasts';
import { Home } from './pages/Home';
import { Pending } from './pages/Pending';
import './styles.css';

/* Direcciones del sitio HTML anterior (enlaces guardados, la app y correos): llevan a la página nueva. */
function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={to + search + hash} replace />;
}
function LegacyHouse() {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const slug = params.get('slug');
  return <Navigate to={(slug ? '/propiedad/' + encodeURIComponent(slug) : '/propiedad/casa-huayacan') + hash} replace />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <CatalogProvider>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route index element={<Home />} />
              <Route path="propiedades" element={<Pending name="Propiedades" />} />
              <Route path="propiedad/:slug" element={<Pending name="Ficha de la casa" />} />
              <Route path="contacto" element={<Pending name="Contáctanos" />} />
              <Route path="como-trabajamos" element={<Pending name="Cómo trabajamos" />} />
              <Route path="gracias" element={<Pending name="Gracias" />} />
              <Route path="*" element={<Pending name="Página no encontrada" />} />
            </Route>
            <Route path="index.html" element={<LegacyRedirect to="/" />} />
            <Route path="paginas/propiedades.html" element={<LegacyRedirect to="/propiedades" />} />
            <Route path="paginas/propiedad.html" element={<LegacyHouse />} />
            <Route path="paginas/contacto.html" element={<LegacyRedirect to="/contacto" />} />
            <Route path="paginas/como-trabajamos.html" element={<LegacyRedirect to="/como-trabajamos" />} />
            <Route path="paginas/gracias.html" element={<LegacyRedirect to="/gracias" />} />
          </Routes>
        </CatalogProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
