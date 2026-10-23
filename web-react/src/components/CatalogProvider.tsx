import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCatalog, type ApiError } from '../lib/api';
import { FALLBACK_CATALOG, type House } from '../lib/catalog';

/* Catálogo de casas: el de la API si responde; si no, el de respaldo (el sitio sigue funcionando). */
interface CatalogState {
  houses: House[];
  bySlug: Record<string, House>;
  /** true mientras se espera la primera respuesta de la API */
  loading: boolean;
  /** true si los datos vienen del servidor */
  fromApi: boolean;
}

const CatalogContext = createContext<CatalogState | null>(null);

const index = (houses: House[]) => Object.fromEntries(houses.map((h) => [h.slug, h]));

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [houses, setHouses] = useState<House[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchCatalog().then(
      (list) => alive && setHouses(list),
      (e: ApiError) => {
        if (!e?.sinConexion) console.warn('Zugar: no se usó la API', e);
        if (alive) setHouses([]);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<CatalogState>(() => {
    const fromApi = !!houses && houses.length > 0;
    const list = fromApi ? houses! : FALLBACK_CATALOG;
    // Las casas de respaldo siguen disponibles por slug (enlaces viejos o ficha de ejemplo)
    return { houses: list, bySlug: { ...index(FALLBACK_CATALOG), ...index(list) }, loading: houses === null, fromApi };
  }, [houses]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog fuera de CatalogProvider');
  return ctx;
}
