import type { Coordinate } from "@/lib/mars";

export type Landmark = Coordinate & { id: string; kind: string; description: string; significance: string };
export const LANDMARKS: Landmark[] = [
  { id: "olympus", name: "Olympus Mons", lat: 18.65, lon: -133.8, kind: "Volcano", description: "The largest known volcano in the Solar System.", significance: "A key site for studying long-lived Martian volcanism." },
  { id: "valles", name: "Valles Marineris", lat: -13.9, lon: -59.2, kind: "Canyon system", description: "A vast equatorial canyon network.", significance: "Exposes stratigraphy and the tectonic history of Mars." },
  { id: "jezero", name: "Jezero Crater", lat: 18.38, lon: 77.58, kind: "Impact crater", description: "Perseverance rover exploration site with a preserved delta.", significance: "Records an ancient lake and potentially habitable environments." },
  { id: "gale", name: "Gale Crater", lat: -5.4, lon: 137.8, kind: "Impact crater", description: "Curiosity rover field site containing Mount Sharp.", significance: "Layered rocks preserve a long environmental record." },
  { id: "elysium", name: "Elysium Planitia", lat: 4.5, lon: 135.9, kind: "Plain", description: "Broad volcanic plain and InSight landing region.", significance: "Important for geophysics and young volcanic landforms." },
  { id: "hellas", name: "Hellas Planitia", lat: -42.4, lon: 70.5, kind: "Impact basin", description: "One of the deepest and largest impact basins on Mars.", significance: "Offers access to ancient crustal and climatic records." },
  { id: "utopia", name: "Utopia Planitia", lat: 46.7, lon: 117.5, kind: "Impact basin", description: "Northern lowland plain and Viking 2 landing region.", significance: "Hosts landforms consistent with subsurface ice." },
  { id: "north", name: "North Polar Region", lat: 84.0, lon: 0, kind: "Polar cap", description: "Layered water-ice cap and seasonal carbon dioxide frost.", significance: "Archive of recent Martian climate cycles." }
];

export const SOURCES = [
  { name: "NASA Mars Trek WMTS", url: "https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars", status: "live", role: "Global MOLA color hillshade tiles" },
  { name: "NASA PDS MOLA MEGDR", url: "https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MGS-M-MOLA-5-MEGDR-L3-V1.0", status: "catalog", role: "Authoritative gridded topography archive" },
  { name: "USGS Planetary Names", url: "https://planetarynames.wr.usgs.gov/TargetCoordinates", status: "catalog", role: "Coordinate conventions and named features" },
];
