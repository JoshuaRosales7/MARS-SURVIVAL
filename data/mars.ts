import type { Coordinate } from "@/lib/mars";

export type Landmark = Coordinate & { id: string; kind: string; description: string; significance: string };
export const LANDMARKS: Landmark[] = [
  { id: "olympus", name: "Olympus Mons", lat: 18.65, lon: -133.8, kind: "Volcán", description: "El mayor volcán conocido del Sistema Solar.", significance: "Sitio clave para estudiar el vulcanismo prolongado de Marte." },
  { id: "valles", name: "Valles Marineris", lat: -13.9, lon: -59.2, kind: "Sistema de cañones", description: "Una extensa red de cañones ecuatoriales.", significance: "Expone la estratigrafía y la historia tectónica marciana." },
  { id: "jezero", name: "Cráter Jezero", lat: 18.38, lon: 77.58, kind: "Cráter de impacto", description: "Zona de exploración de Perseverance con un delta preservado.", significance: "Registra un antiguo lago y ambientes potencialmente habitables." },
  { id: "gale", name: "Cráter Gale", lat: -5.4, lon: 137.8, kind: "Cráter de impacto", description: "Zona de Curiosity que contiene el monte Sharp.", significance: "Sus rocas estratificadas preservan un largo registro ambiental." },
  { id: "elysium", name: "Elysium Planitia", lat: 4.5, lon: 135.9, kind: "Planicie", description: "Amplia planicie volcánica y región de aterrizaje de InSight.", significance: "Importante para geofísica y formas volcánicas jóvenes." },
  { id: "hellas", name: "Hellas Planitia", lat: -42.4, lon: 70.5, kind: "Cuenca de impacto", description: "Una de las cuencas de impacto más grandes y profundas de Marte.", significance: "Permite estudiar corteza antigua y registros climáticos." },
  { id: "utopia", name: "Utopia Planitia", lat: 46.7, lon: 117.5, kind: "Cuenca de impacto", description: "Planicie septentrional y región de aterrizaje de Viking 2.", significance: "Contiene formas compatibles con hielo en el subsuelo." },
  { id: "north", name: "Región Polar Norte", lat: 84.0, lon: 0, kind: "Casquete polar", description: "Casquete de hielo de agua estratificado y escarcha estacional de CO₂.", significance: "Archivo de ciclos climáticos marcianos recientes." }
];

export const SOURCES = [
  { name: "NASA Mars Trek WMTS", url: "https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars", status: "live", role: "Mosaicos globales de relieve sombreado MOLA" },
  { name: "NASA PDS MOLA MEGDR", url: "https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MGS-M-MOLA-5-MEGDR-L3-V1.0", status: "catalog", role: "Archivo autorizado de topografía en cuadrícula" },
  { name: "USGS Planetary Names", url: "https://planetarynames.wr.usgs.gov/TargetCoordinates", status: "catalog", role: "Convenciones de coordenadas y nombres oficiales" },
];
