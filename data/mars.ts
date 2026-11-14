import type { Coordinate, MissionConfig, Strategy } from "@/lib/mars";

export type Landmark = Coordinate & {
  id: string;
  name: string;
  kind: string;
  description: string;
  significance: string;
  historicalMission?: string;
  elevationKm?: number;
  hazardLevel?: "Bajo" | "Moderado" | "Alto" | "Extremo";
  isWaterSource?: boolean;
};

export type MissionTemplate = {
  id: string;
  title: string;
  category: "Ciencia" | "Exploración" | "ISRU Hielo" | "Desafío Extremo";
  subtitle: string;
  description: string;
  base: Coordinate;
  destination: Coordinate;
  strategy: Strategy;
  configPatch: Partial<MissionConfig>;
  learningGoal: string;
  badge: string;
};

export type MarsFact = {
  parameter: string;
  marsValue: string;
  earthComparison: string;
  operationalImpact: string;
};

export type SurvivalTopic = {
  id: string;
  title: string;
  icon: string;
  summary: string;
  scientificExplanation: string;
  safetyRule: string;
};

export const LANDMARKS: Landmark[] = [
  {
    id: "jezero",
    name: "Cráter Jezero",
    lat: 18.38,
    lon: 77.58,
    kind: "Cráter de impacto / Paleolago",
    description: "Antiguo lago de 45 km de diámetro alimentado por un sistema de valles fluviales.",
    significance: "Lugar de aterrizaje de Perseverance e Ingenuity; preserva sedimentos arcillosos con alto potencial para preservar biofirmas fósiles.",
    historicalMission: "Perseverance / Ingenuity (2021)",
    elevationKm: -2.5,
    hazardLevel: "Moderado",
    isWaterSource: false,
  },
  {
    id: "olympus",
    name: "Olympus Mons",
    lat: 18.65,
    lon: -133.8,
    kind: "Volcán en escudo colosal",
    description: "El mayor volcán del Sistema Solar: 21.9 km de altura sobre el datum y 600 km de diámetro.",
    significance: "Registra miles de millones de años de vulcanismo estático sin tectónica de placas activa.",
    historicalMission: "Observación orbital global (Mariner 9, Viking, MRO)",
    elevationKm: 21.9,
    hazardLevel: "Extremo",
    isWaterSource: false,
  },
  {
    id: "valles",
    name: "Valles Marineris (Melas Chasma)",
    lat: -9.8,
    lon: -76.5,
    kind: "Sistema tectónico de cañones",
    description: "El cañón más grande del Sistema Solar, extendiéndose por más de 4,000 km y alcanzando hasta 7 km de profundidad.",
    significance: "Expone la estratigrafía geológica más profunda de la corteza marciana y sulfatos hidratados.",
    historicalMission: "Mapeo MOLA y HRSC Mars Express",
    elevationKm: -3.8,
    hazardLevel: "Alto",
    isWaterSource: false,
  },
  {
    id: "gale",
    name: "Cráter Gale (Monte Sharp)",
    lat: -5.4,
    lon: 137.8,
    kind: "Cráter con pico central estratificado",
    description: "Cráter de 154 km con un montículo central (Aeolis Mons) de 5.5 km de altura con capas sedimentarias.",
    significance: "Explorado por Curiosity desde 2012; confirmó que Marte tuvo ambientes de agua dulce habitables durante millones de años.",
    historicalMission: "Curiosity (MSL, 2012)",
    elevationKm: -4.5,
    hazardLevel: "Moderado",
    isWaterSource: false,
  },
  {
    id: "arcadia",
    name: "Arcadia Planitia",
    lat: 39.2,
    lon: -171.0,
    kind: "Llanura volcánica con hielo subterráneo",
    description: "Planicie suave con enormes capas de hielo de agua puro a escasa profundidad (1 a 2 metros bajo el regolito).",
    significance: "Candidato prioritario para futuras bases humanas y misiones SpaceX Starship por facilidad de extracción ISRU de agua.",
    historicalMission: "Candidato Base Humana (NASA/SpaceX)",
    elevationKm: -3.2,
    hazardLevel: "Bajo",
    isWaterSource: true,
  },
  {
    id: "korolev",
    name: "Cráter Korolev",
    lat: 73.0,
    lon: 165.0,
    kind: "Cráter con domo glacial permanente",
    description: "Cráter de 81 km de diámetro que alberga un domo permanente de hielo de agua de 1.8 km de espesor y 2,200 km³ de volumen.",
    significance: "Una de las mayores reservas de agua pura no polar, preservada por una trampa de aire frío constante.",
    historicalMission: "HRSC Mars Express & CaSSIS TGO",
    elevationKm: -1.2,
    hazardLevel: "Alto",
    isWaterSource: true,
  },
  {
    id: "elysium",
    name: "Elysium Planitia",
    lat: 4.5,
    lon: 135.9,
    kind: "Llanura volcánica lisa",
    description: "Segunda región volcánica más extensa de Marte, con coladas de lava jóvenes y bajo relieve.",
    significance: "Sitio de aterrizaje de la sonda geofísica InSight; detectó cientos de 'martemotos' y midió el grosor de la corteza.",
    historicalMission: "InSight (2018)",
    elevationKm: -2.6,
    hazardLevel: "Bajo",
    isWaterSource: false,
  },
  {
    id: "hellas",
    name: "Hellas Planitia",
    lat: -42.4,
    lon: 70.5,
    kind: "Cuenca de impacto gigante",
    description: "La cuenca de impacto visible más profunda de Marte (hasta 7.1 km bajo el datum y 2,300 km de anchura).",
    significance: "Mayor presión atmosférica de la superficie marciana (~1155 Pa), lo que facilita teóricamente la retención de agua líquida temporal.",
    historicalMission: "MGS MOLA & Mars Reconnaissance Orbiter",
    elevationKm: -7.1,
    hazardLevel: "Alto",
    isWaterSource: false,
  },
  {
    id: "utopia",
    name: "Utopia Planitia",
    lat: 25.1,
    lon: 109.9,
    kind: "Llanura de impacto septentrional",
    description: "Vasta cuenca de tierras bajas con evidencias de hielo subsuperficial y suelos poligonales periglaciares.",
    significance: "Aterrizaje de Viking 2 (1976) en el norte y del rover Zhurong (2021) en el sur, investigando paleoceanos.",
    historicalMission: "Zhurong (2021) & Viking 2 (1976)",
    elevationKm: -4.1,
    hazardLevel: "Moderado",
    isWaterSource: true,
  },
  {
    id: "meridiani",
    name: "Meridiani Planum",
    lat: -1.9,
    lon: -5.5,
    kind: "Llanura de hematita esferular",
    description: "Llanura ecuatorial notable por la presencia de 'blueberries' (esferas de hematita) formadas en aguas subterráneas ácidas.",
    significance: "Lugar de aterrizaje de Opportunity, que recorrió más de 45 km durante 14 años confirmando agua pasada duradera.",
    historicalMission: "Opportunity (MER-B, 2004)",
    elevationKm: -1.4,
    hazardLevel: "Bajo",
    isWaterSource: false,
  },
  {
    id: "gusev",
    name: "Cráter Gusev",
    lat: -14.6,
    lon: 175.5,
    kind: "Cráter con canal de desagüe Ma'adim Vallis",
    description: "Cráter de 166 km que recibió una colosal inundación fluvial antigua a través del cañón Ma'adim Vallis.",
    significance: "Explorado por Spirit; descubrió sílice casi puro originado en fumarolas hidrotermales y manantiales calientes antiguos.",
    historicalMission: "Spirit (MER-A, 2004)",
    elevationKm: -1.9,
    hazardLevel: "Moderado",
    isWaterSource: false,
  },
  {
    id: "chryse",
    name: "Chryse Planitia",
    lat: 22.3,
    lon: -48.0,
    kind: "Llanura de desembocadura de canales cataclísmicos",
    description: "Planicie suave donde convergen los mayores canales de desbordamiento de agua de la historia de Marte.",
    significance: "Primer aterrizaje con éxito y transmisión fotográfica desde la superficie marciana por Viking 1 en 1976.",
    historicalMission: "Viking 1 (1976)",
    elevationKm: -3.7,
    hazardLevel: "Bajo",
    isWaterSource: false,
  },
  {
    id: "aresvallis",
    name: "Ares Vallis",
    lat: 19.3,
    lon: -33.5,
    kind: "Canal de flujo cataclísmico",
    description: "Canal de inundación gigante con depósitos de cantos rodados e islas aerodinámicas esculpidas por megainundaciones.",
    significance: "Aterrizaje de la misión Mars Pathfinder y el primer microrover autónomo Sojourner en 1997.",
    historicalMission: "Pathfinder / Sojourner (1997)",
    elevationKm: -3.6,
    hazardLevel: "Moderado",
    isWaterSource: false,
  },
  {
    id: "deuteronilus",
    name: "Deuteronilus Mensae",
    lat: 43.9,
    lon: 33.7,
    kind: "Mesetas con glaciares de detritos (LDA)",
    description: "Región de contacto entre tierras altas y bajas con delantales de detritos rocosos que cubren glaciares masivos de hielo.",
    significance: "El radar SHARAD confirmó que el hielo compone hasta el 80% de estas formaciones bajo un manto protector de rocas.",
    historicalMission: "MRO SHARAD / Mars Express HRSC",
    elevationKm: -2.1,
    hazardLevel: "Alto",
    isWaterSource: true,
  },
  {
    id: "noctis",
    name: "Noctis Labyrinthus",
    lat: -7.0,
    lon: -101.0,
    kind: "Laberinto de fallas y cañones entrecruzados",
    description: "Sistema laberíntico de fosas tectónicas en la cabecera occidental de Valles Marineris.",
    significance: "Presenta fracturas complejas, colapsos de suelo y posibles depósitos volcánicos ricos en minerales hidratados.",
    historicalMission: "Mars Reconnaissance Orbiter (HiRISE)",
    elevationKm: 3.2,
    hazardLevel: "Extremo",
    isWaterSource: false,
  },
  {
    id: "north",
    name: "Planum Boreum (Polo Norte)",
    lat: 84.0,
    lon: 0.0,
    kind: "Casquete polar estratificado de hielo",
    description: "Casquete permanente de hielo de agua estratificado de 1,000 km de diámetro y hasta 3 km de grosor.",
    significance: "Contiene el registro climático más continuo de los ciclos de obliquidad y cambios atmosféricos de Marte en los últimos millones de años.",
    historicalMission: "MRO, Mars Express, Mars Global Surveyor",
    elevationKm: -2.0,
    hazardLevel: "Extremo",
    isWaterSource: true,
  },
  {
    id: "south",
    name: "Planum Australe (Polo Sur)",
    lat: -85.0,
    lon: 0.0,
    kind: "Casquete polar con capa residual de CO₂",
    description: "Casquete masivo compuesto por hielo de agua cubierto por una capa perenne de hielo seco (CO₂ congelado).",
    significance: "El radar MARSIS ha propuesto la presencia de cuerpos de salmuera subglaciar en la base del casquete.",
    historicalMission: "Mars Express (MARSIS) & MRO",
    elevationKm: 1.5,
    hazardLevel: "Extremo",
    isWaterSource: true,
  },
  {
    id: "ceraunius",
    name: "Ceraunius Tholus",
    lat: 24.2,
    lon: -97.4,
    kind: "Volcán antiguo con canales de erosión",
    description: "Volcán basáltico escarpado de 8.2 km de altura con una caldera elíptica de 25 km y flancos surcados por barrancos.",
    significance: "Los canales en sus laderas sugieren interacción violenta de magma caliente con permafrost o nieve acumulada.",
    historicalMission: "Mars Global Surveyor / Odyssey (THEMIS)",
    elevationKm: 6.5,
    hazardLevel: "Alto",
    isWaterSource: false,
  },
];

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: "tmpl-jezero-delta",
    title: "Misión Jezero: El Delta Fluvial",
    category: "Ciencia",
    subtitle: "2 tripulantes · 18 km · Muestreo astrobiológico",
    description: "Ruta desde la base del cráter hacia el delta sedimentario donde el río Neretva desembocaba en el antiguo lago de Jezero. Búsqueda de biofirmas en capas de arcilla.",
    base: { lat: 18.38, lon: 77.58, name: "Base Octavia E. Butler" },
    destination: { lat: 18.55, lon: 77.93, name: "Frente del Delta de Jezero" },
    strategy: "direct",
    configPatch: { crew: 2, speedKmh: 4.5, oxygenKg: 20, energyKwh: 50, waterLiters: 14, maxHours: 18, scienceHours: 2.5, contingencyPercent: 15, reservePercent: 20 },
    learningGoal: "Aprende cómo el tiempo de estancia científica en el delta impacta el consumo total de oxígeno de la tripulación.",
    badge: "RECOMENDADA PRINCIPIANTES",
  },
  {
    id: "tmpl-valles-canyon",
    title: "Travesía por Valles Marineris",
    category: "Exploración",
    subtitle: "3 tripulantes · 42 km · Estratigrafía profunda",
    description: "Descenso y exploración en el fondo de Melas Chasma. Misión de alta autonomía en el cañón más colosal del sistema solar.",
    base: { lat: -9.8, lon: -76.5, name: "Puesto Melas Norte" },
    destination: { lat: -10.5, lon: -75.8, name: "Falla de Sulfatos Hidratados" },
    strategy: "conservative",
    configPatch: { crew: 3, speedKmh: 4.0, oxygenKg: 45, energyKwh: 110, waterLiters: 28, maxHours: 28, scienceHours: 3.5, contingencyPercent: 20, reservePercent: 25 },
    learningGoal: "Observa cómo la estrategia conservadora añade holgura frente a desniveles y fallas tectónicas.",
    badge: "MEDIA DIFICULTAD",
  },
  {
    id: "tmpl-arcadia-isru",
    title: "Arcadia: Prospección de Hielo Subterráneo",
    category: "ISRU Hielo",
    subtitle: "2 tripulantes · 30 km · Recurso vital para combustible",
    description: "Exploración de llanuras con capas de hielo de agua a 1 metro bajo la superficie. Clave para la futura producción de oxígeno y metano ISRU para el retorno a la Tierra.",
    base: { lat: 39.2, lon: -171.0, name: "Base Humana Arcadia" },
    destination: { lat: 40.1, lon: -169.8, name: "Sondeo Glacial Arcadia-1" },
    strategy: "science",
    configPatch: { crew: 2, speedKmh: 5.5, oxygenKg: 28, energyKwh: 75, waterLiters: 18, maxHours: 22, scienceHours: 4.0, contingencyPercent: 15, reservePercent: 20 },
    learningGoal: "Comprueba cómo el acceso a recursos de hielo puede transformar la viabilidad del asentamiento marciano.",
    badge: "FUTURO ARTEMIS / STARSHIP",
  },
  {
    id: "tmpl-korolev-ice",
    title: "Korolev: El Domo de Hielo Ártico",
    category: "ISRU Hielo",
    subtitle: "3 tripulantes · 52 km · Reserva colosal de agua dulce",
    description: "Travesía sobre el domo permanente de 2,200 km³ de hielo puro en Korolev. Temperaturas extremas que exigen mayor energía de soporte vital térmico.",
    base: { lat: 72.4, lon: 164.2, name: "Campamento Boreal Korolev" },
    destination: { lat: 73.0, lon: 165.0, name: "Vértice del Domo Glacial" },
    strategy: "direct",
    configPatch: { crew: 3, speedKmh: 5.0, oxygenKg: 55, energyKwh: 130, waterLiters: 32, maxHours: 32, scienceHours: 3.0, contingencyPercent: 25, reservePercent: 25 },
    learningGoal: "Experimenta la penalización energética del frío ártico y la importancia de la contingencia en latitudes altas.",
    badge: "CLIMA EXTREMO",
  },
  {
    id: "tmpl-olympus-ascent",
    title: "Ascenso a las Faldas de Olympus Mons",
    category: "Desafío Extremo",
    subtitle: "4 tripulantes · 68 km · Altura extrema y radiación",
    description: "Expedición hacia el acantilado basal del volcán más gigante. El aire es aún más tenue y la radiación cósmica aumenta con la altitud.",
    base: { lat: 17.8, lon: -134.8, name: "Puesto Tharsis Base" },
    destination: { lat: 18.65, lon: -133.8, name: "Escarpado Basal Olympus" },
    strategy: "conservative",
    configPatch: { crew: 4, speedKmh: 3.8, oxygenKg: 95, energyKwh: 190, waterLiters: 55, maxHours: 48, scienceHours: 4.5, contingencyPercent: 25, reservePercent: 30 },
    learningGoal: "Aprende qué ocurre cuando la tripulación aumenta a 4 personas y la duración de la misión se acerca a las 48 horas.",
    badge: "MÁXIMA EXIGENCIA",
  },
];

export const MARS_PLANETARY_FACTS: MarsFact[] = [
  {
    parameter: "Tamaño del planeta",
    marsValue: "Radio medio: 3,390 km",
    earthComparison: "Aproximadamente la mitad del radio terrestre",
    operationalImpact: "Ayuda a poner en escala el mapa: las distancias marcianas parecen enormes, aunque el planeta es más pequeño que la Tierra.",
  },
  {
    parameter: "Distancia al Sol",
    marsValue: "228 millones de km en promedio (1.52 UA)",
    earthComparison: "La Tierra está a 150 millones de km (1 UA)",
    operationalImpact: "La luz tarda cerca de 13 minutos en llegar desde el Sol. La energía solar es menos intensa y las comunicaciones tienen retraso; un rover no se conduce en tiempo real desde la Tierra.",
  },
  {
    parameter: "Gravedad superficial",
    marsValue: "3.721 m/s² (0.379 g)",
    earthComparison: "38% de la terrestre (un astronauta de 80 kg pesa 30.3 kg)",
    operationalImpact: "Permite transportar equipos más pesados, pero causa pérdida de masa muscular y ósea en expediciones largas.",
  },
  {
    parameter: "Presión atmosférica",
    marsValue: "610 Pa media (6.1 mbar)",
    earthComparison: "0.6% de la presión a nivel del mar (101.3 kPa)",
    operationalImpact: "Por debajo del límite de Armstrong (6.3 kPa): el agua líquida hierve a temperatura corporal. Trajes espaciales presurizados obligatorios 100% del tiempo.",
  },
  {
    parameter: "Composición atmosférica",
    marsValue: "95.3% CO₂, 2.6% N₂, 1.9% Ar, 0.16% O₂",
    earthComparison: "Tierra: 78% N₂, 21% O₂, 0.9% Ar, 0.04% CO₂",
    operationalImpact: "Letal para respiración directa; el CO₂ debe procesarse químicamente mediante electrólisis (MOXIE) para producir O₂.",
  },
  {
    parameter: "Duración del día (Sol)",
    marsValue: "24 horas, 39 minutos, 35.244 segundos",
    earthComparison: "+39 minutos y 35 segundos respecto al día terrestre",
    operationalImpact: "Muy similar al ritmo circadiano humano natural, facilitando la adaptación fisiológica de las tripulaciones.",
  },
  {
    parameter: "Duración del año",
    marsValue: "668.6 Soles (687 días terrestres)",
    earthComparison: "Aproximadamente 1.88 años terrestres",
    operationalImpact: "Estaciones dos veces más largas; las tormentas globales de polvo suelen detonar durante el perihelio en el verano austral.",
  },
  {
    parameter: "Rango térmico",
    marsValue: "De −140°C en los polos a +20°C en ecuador al mediodía",
    earthComparison: "Promedio global marciano: −63°C (frente a +15°C en Tierra)",
    operationalImpact: "El rover debe dedicar hasta un 40% de su energía eléctrica exclusivamente a calefacción interna durante la noche marciana.",
  },
  {
    parameter: "Radiación en superficie",
    marsValue: "~0.67 mSv / día (240 mSv / año en calma solar)",
    earthComparison: "~2.4 mSv / año de radiación natural de fondo en la Tierra (100× menor)",
    operationalImpact: "Marte carece de magnetosfera dipolar global y capa de ozono. El tiempo al aire libre (EVA) debe monitorearse estrictamente bajo el principio ALARA.",
  },
  {
    parameter: "Insolación solar",
    marsValue: "590 W/m² media (43% de la Tierra)",
    earthComparison: "1,361 W/m² en la órbita terrestre",
    operationalImpact: "Los paneles solares requieren más del doble de área para la misma potencia y son vulnerables a la acumulación de polvo.",
  },
];

export const SURVIVAL_GUIDE_ITEMS: SurvivalTopic[] = [
  {
    id: "return-philosophy",
    title: "¿Por qué el regreso duplica la distancia y los recursos?",
    icon: "RotateCcw",
    summary: "Una misión espacial tripulada solo tiene éxito si la tripulación regresa con vida a la base.",
    scientificExplanation: "En expediciones terrestres suele haber equipos de rescate o atmósfera respirable circundante. En Marte, el rover es una burbuja presurizada en un vacío tóxico y gélido. Si un rover recorre 15 km de ida, debe tener reservas de O₂, agua y kWh garantizadas para los 15 km de vuelta, más el tiempo en el objetivo científico, más un margen de contingencia del 15-25% ante fallos mecánicos o terreno difícil.",
    safetyRule: "Regla de oro: Distancia de planificación = Distancia de ida × 2. Consumibles calculados con regreso obligatorio activado.",
  },
  {
    id: "oxygen-budget",
    title: "¿Cuánto oxígeno respira un astronauta en Marte?",
    icon: "Activity",
    summary: "Entre 0.84 y 1.0 kg de O₂ puro al día por persona en actividad moderada.",
    scientificExplanation: "El cuerpo humano consume aproximadamente 0.035 a 0.084 kg de O₂ por hora, dependiendo del esfuerzo físico (caminar con traje espacial pesado o conducir el rover). A esto se suman las pérdidas por despresurización de esclusas y purgas de dióxido de carbono. Si la presión parcial de O₂ desciende por debajo de 16 kPa, la tripulación sufre hipoxia grave e incapacitación.",
    safetyRule: "Mantén siempre una reserva mínima de oxígeno del 20% en el tanque del rover al aparcar de nuevo en la base.",
  },
  {
    id: "energy-thermal",
    title: "La batería del rover: movimiento y calefacción contra el frío letal",
    icon: "Zap",
    summary: "En Marte, quedarse sin energía eléctrica no solo detiene las ruedas: congela el soporte vital.",
    scientificExplanation: "Con noches que bajan de −80°C a −120°C, el aislamiento térmico no basta. Se requieren calentadores activos (resistencias o bombas de calor) de 500 a 1,200 W continuos para que los fluidos del rover, las computadoras y la cabina de los astronautas no se congelen. La tracción eléctrica en regolito suelto demanda entre 1.5 y 3.5 kWh por cada hora de marcha a 4-5 km/h.",
    safetyRule: "Calcula el consumo horario total sumando potencia motriz + soporte vital ECLSS + calefacción nocturna.",
  },
  {
    id: "radiation-dose",
    title: "Radiación cósmica y tormentas solares en la superficie",
    icon: "Radiation",
    summary: "Sin campo magnético ni capa densa de ozono, la superficie recibe radiación continua.",
    scientificExplanation: "Los astronautas reciben Rayos Cósmicos Galácticos (GCR) de alta energía (~0.025 - 0.035 mSv/h) y riesgo esporádico de Eventos de Partículas Solares (SPE). La dosis límite anual establecida por la NASA para astronautas profesionales se sitúa en torno a 250-500 mSv a lo largo de su carrera. En una travesía de 20 horas en rover se acumulan ~0.5 a 0.7 mSv, que debe sumarse al historial acumulativo del explorador.",
    safetyRule: "Planifica travesías minimizando las horas de exposición total diurna y supervisa alertas de tormentas solares.",
  },
  {
    id: "terrain-uncertainty",
    title: "¿Por qué el terreno 3D actual es un modelo proxy y no un DEM medido?",
    icon: "Mountain",
    summary: "Honestidad científica de RedReturn: diferenciar datos reales de visualizaciones conceptuales.",
    scientificExplanation: "Las rutas globales de RedReturn calculan arcos geodésicos sobre una esfera de referencia de 3,389.5 km (geometría global). Aunque la visualización 3D utiliza la textura MOLA de 463 m/px de la NASA, los cálculos numéricos de pendiente y rugosidad local requieren montar modelos digitales de elevación (DEM MEGDR o HRSC). Hasta que se cargue el DEM puntual, RedReturn clasifica el terreno como 'datos insuficientes' para no engañar sobre la seguridad de una ruta que podría cruzar un risco infranqueable.",
    safetyRule: "Una ruta viable en recursos geométricos aún debe validarse topográficamente con imágenes de alta resolución antes de salir.",
  },
];

export const SOURCES = [
  { name: "NASA Mars Facts", url: "https://science.nasa.gov/mars/facts/", status: "catalog", role: "Tamaño, distancia al Sol, duración del día y del año marcianos" },
  { name: "NASA Mars Trek WMTS", url: "https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars", status: "live", role: "Mosaicos globales de relieve sombreado MGS MOLA (463 m/px)" },
  { name: "NASA PDS MOLA MEGDR", url: "https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MGS-M-MOLA-5-MEGDR-L3-V1.0", status: "catalog", role: "Archivo autorizado de topografía altimétrica en cuadrícula" },
  { name: "USGS Planetary Names", url: "https://planetarynames.wr.usgs.gov/TargetCoordinates", status: "catalog", role: "Nomenclatura oficial IAU y convenciones de coordenadas planetocéntricas" },
  { name: "NASA Perseverance Science Operations", url: "https://mars.nasa.gov/mars2020/", status: "live", role: "Telemetría geológica y trazas de exploración en el Cráter Jezero" },
  { name: "ESA Mars Express HRSC", url: "https://www.esa.int/Science_Exploration/Space_Science/Mars_Express", status: "catalog", role: "Cámaras estéreo de alta resolución y modelos de hielo en Korolev" },
];
