import type { StudySubject, StudySubjectId } from './types';

export const IGCSE_COMMAND_WORDS: readonly { word: string; meaning: string }[] = [
  { word: 'State', meaning: 'Express in clear, concise terms without needing an explanation.' },
  { word: 'Define', meaning: 'Give the precise Cambridge syllabus meaning of a term or quantity.' },
  { word: 'Describe', meaning: 'State the points of a topic or give characteristics and main features (say WHAT happens).' },
  { word: 'Explain', meaning: 'Set out purposes or reasons, linking cause and effect using scientific or subject logic (say WHY/HOW).' },
  { word: 'Compare', meaning: 'Identify similarities and/or differences directly using comparative language (e.g. whereas, higher than).' },
  { word: 'Calculate', meaning: 'Work out from given facts, figures, or information; always show working and correct units.' },
  { word: 'Evaluate', meaning: 'Judge or calculate the quality, importance, amount, or value of something using balanced evidence.' },
  { word: 'Suggest', meaning: 'Apply knowledge and understanding to unfamiliar situations where more than one valid answer may exist.' },
];

export const STUDY_SUBJECTS: readonly StudySubject[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    shortName: 'Maths',
    syllabusCode: 'IGCSE 0580',
    faculty: 'Mathematics & ICT',
    description: 'Number, algebra, geometry, trigonometry, mensuration, vectors, probability, and calculus.',
    topics: ['Number & Percentages', 'Algebra & Quadratics', 'Geometry & Angles', 'Trigonometry', 'Statistics & Probability', 'Mensuration & Graphs'],
    commandWords: ['Calculate', 'Show that', 'Simplify', 'Factorise', 'Solve'],
    keyFormulasOrFacts: [
      { label: 'Quadratic Formula', detail: 'x = (-b ± √(b² - 4ac)) / 2a for ax² + bx + c = 0' },
      { label: 'Pythagoras & Trigonometry', detail: 'a² + b² = c²; SOH-CAH-TOA; Sine Rule a/sin A = b/sin B; Cosine Rule a² = b² + c² - 2bc cos A' },
      { label: 'Gradient & Straight Line', detail: 'y = mx + c where gradient m = (y₂ - y₁) / (x₂ - x₁)' },
      { label: 'Compound Interest', detail: 'A = P(1 + r/100)ⁿ for principal P, annual rate r%, and n years' },
    ],
    quickPrompts: [
      { label: 'Quadratic equations', prompt: 'Explain how to solve quadratic equations by factorising and using the quadratic formula with a worked IGCSE example.' },
      { label: 'Sine vs Cosine rule', prompt: 'How do I decide whether to use the Sine Rule or Cosine Rule in an IGCSE 0580 Extended trigonometry question?' },
      { label: 'Compound interest', prompt: 'Walk me through a 3-mark IGCSE compound percentage change calculation and common rounding mistakes.' },
    ],
  },
  {
    id: 'biology',
    name: 'Biology',
    shortName: 'Biology',
    syllabusCode: 'IGCSE 0610',
    faculty: 'Sciences',
    description: 'Cells, enzymes, plant & human nutrition, transport, respiration, coordination, genetics, and ecology.',
    topics: ['Cell Structure & Transport', 'Enzymes & Nutrition', 'Plant & Human Transport', 'Respiration & Gas Exchange', 'Genetics & Inheritance', 'Ecology & Ecosystems'],
    commandWords: ['State', 'Describe', 'Explain', 'Compare', 'Suggest'],
    keyFormulasOrFacts: [
      { label: 'Magnification', detail: 'Magnification = Image size / Actual size (convert mm to µm by multiplying by 1000)' },
      { label: 'Photosynthesis', detail: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (in presence of light energy and chlorophyll)' },
      { label: 'Aerobic Respiration', detail: 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + energy released' },
      { label: 'Osmosis Definition', detail: 'Net movement of water molecules from higher water potential to lower water potential through a partially permeable membrane.' },
    ],
    quickPrompts: [
      { label: 'Enzyme denaturation', prompt: 'Explain how high temperature denatures an enzyme for 4 IGCSE 0610 marks using active site terminology.' },
      { label: 'Osmosis vs active transport', prompt: 'Compare diffusion, osmosis, and active transport in a clear IGCSE mark-scheme table.' },
      { label: 'Mitosis vs meiosis', prompt: 'Give the key differences between mitosis and meiosis for IGCSE Biology Extended Paper 4.' },
    ],
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    shortName: 'Chemistry',
    syllabusCode: 'IGCSE 0620',
    faculty: 'Sciences',
    description: 'Atomic structure, bonding, stoichiometry, electrolysis, energetics, rates, acids/salts, and organic chemistry.',
    topics: ['Atomic Structure & Bonding', 'Stoichiometry & Moles', 'Electrochemistry', 'Rates & Equilibrium', 'Acids, Bases & Salts', 'Organic Chemistry'],
    commandWords: ['Define', 'Deduce', 'Describe', 'Explain', 'Predict'],
    keyFormulasOrFacts: [
      { label: 'Moles from Mass', detail: 'n = mass (g) / Mr (g/mol); Concentration c = n / V (dm³)' },
      { label: 'Molar Gas Volume', detail: '1 mole of any gas occupies 24 dm³ at room temperature and pressure (r.t.p.)' },
      { label: 'OIL RIG (Redox)', detail: 'Oxidation Is Loss of electrons (increase in oxidation number); Reduction Is Gain of electrons.' },
      { label: 'Alkanes vs Alkenes', detail: 'Alkanes: CₙH₂ₙ₊₂ (saturated); Alkenes: CₙH₂ₙ (unsaturated, decolourise aqueous bromine from orange to colourless).' },
    ],
    quickPrompts: [
      { label: 'Moles & reacting masses', prompt: 'Show step-by-step how to solve an IGCSE 0620 stoichiometry reacting mass calculation.' },
      { label: 'Ionic vs covalent bonding', prompt: 'Explain why ionic compounds have high melting points and conduct electricity only when molten or aqueous.' },
      { label: 'Electrolysis rules', prompt: 'How do I predict the products at the cathode and anode during electrolysis of aqueous solutions?' },
    ],
  },
  {
    id: 'physics',
    name: 'Physics',
    shortName: 'Physics',
    syllabusCode: 'IGCSE 0625',
    faculty: 'Sciences',
    description: 'Motion, forces, energy, thermal physics, waves, electricity, magnetism, nuclear physics, and space physics.',
    topics: ['Motion & Forces', 'Work, Energy & Power', 'Thermal Physics', 'Waves & Optics', 'Electricity & Circuits', 'Magnetism & Nuclear Physics'],
    commandWords: ['Define', 'Calculate', 'State', 'Explain', 'Deduce'],
    keyFormulasOrFacts: [
      { label: 'Newton’s Second Law', detail: 'F = ma (force in N, mass in kg, acceleration in m/s²); Weight W = mg' },
      { label: 'Energy Equations', detail: 'Kinetic energy Ek = ½mv²; Gravitational potential energy ΔEp = mgΔh; Power P = E/t' },
      { label: 'Wave Equation', detail: 'v = fλ (wave speed = frequency × wavelength)' },
      { label: 'Electrical Power & Ohm’s Law', detail: 'V = IR; P = IV = I²R; Q = It' },
    ],
    quickPrompts: [
      { label: 'Velocity-time graphs', prompt: 'Explain how to find acceleration and distance travelled from a velocity-time graph in IGCSE 0625.' },
      { label: 'Series vs parallel circuits', prompt: 'Compare current, potential difference, and combined resistance in series vs parallel circuits.' },
      { label: 'Radioactive half-life', prompt: 'Walk through an IGCSE half-life calculation accounting for background radiation.' },
    ],
  },
  {
    id: 'computer-science',
    name: 'Computer Science',
    shortName: 'Comp Sci',
    syllabusCode: 'IGCSE 0478',
    faculty: 'Mathematics & ICT',
    description: 'Data representation, data transmission, hardware, software, cyber security, algorithms, logic gates, and SQL.',
    topics: ['Data Representation', 'Data Transmission & Networks', 'Hardware & Architecture', 'Cyber Security', 'Algorithms & Pseudocode', 'Boolean Logic & Databases'],
    commandWords: ['State', 'Describe', 'Explain', 'Trace', 'Write'],
    keyFormulasOrFacts: [
      { label: 'Binary & Hexadecimal', detail: 'Each hexadecimal digit represents 4 bits (a nibble). 1 KiB = 1024 bytes; 1 MiB = 1024 KiB.' },
      { label: 'Fetch-Decode-Execute Cycle', detail: 'PC → MAR → Memory → MDR → CIR → Decode by CU → Execute by ALU/registers.' },
      { label: 'Error Detection', detail: 'Parity bits, checksums, echo checks, and Automatic Repeat Requests (ARQ) with timeouts & acknowledgements.' },
      { label: 'Validation vs Verification', detail: 'Validation checks data is reasonable (range, length, format, check digit); Verification checks accurate copying (double entry, visual check).' },
    ],
    quickPrompts: [
      { label: 'Von Neumann cycle', prompt: 'Explain the Fetch-Decode-Execute cycle naming MAR, MDR, PC, CIR, and ACC for IGCSE 0478.' },
      { label: 'Binary & two’s complement', prompt: 'Explain how to convert negative denary integers into 8-bit two’s complement binary.' },
      { label: 'Trace tables & loops', prompt: 'Teach me how to complete a Cambridge 0478 algorithm trace table accurately without missing iterations.' },
    ],
  },
  {
    id: 'english',
    name: 'English Language',
    shortName: 'English',
    syllabusCode: 'IGCSE 0500',
    faculty: 'Languages',
    description: 'Reading comprehension, summary writing, writer’s effect analysis, directed writing, and descriptive/narrative composition.',
    topics: ['Comprehension & Inference', 'Summary Writing', 'Writer’s Effect', 'Directed Writing', 'Descriptive & Narrative Craft', 'Grammar & Precision'],
    commandWords: ['Explain', 'Analyse', 'Summarise', 'Evaluate', 'Write'],
    keyFormulasOrFacts: [
      { label: 'Writer’s Effect Formula', detail: 'Quote a short powerful phrase → explain literal meaning → analyse connotations/imagery → link to atmosphere or reader effect.' },
      { label: 'Summary Discipline', detail: 'Use your own words, stay within 120 words, include 10+ distinct text points, avoid examples, opinions, and repetition.' },
      { label: 'VARP for Directed Writing', detail: 'Voice (persona), Audience, Register (formal/semi-formal), Purpose (persuade, inform, argue, advise).' },
      { label: 'Reading vs Writing Marks', detail: 'In Paper 1 Question 3 (Extended Response), base every detail on inferences from the passage—do not invent unrelated plots.' },
    ],
    quickPrompts: [
      { label: 'Writer’s effect structure', prompt: 'Show me a top-band IGCSE 0500 paragraph structure for analysing Writer’s Effect in Paper 1 Question 2(d).' },
      { label: '120-word summary tips', prompt: 'How do I score full marks on the IGCSE 0500 summary question using concise own words?' },
      { label: 'Directed writing register', prompt: 'Explain how to adapt tone and register for a formal letter vs a school speech in IGCSE English.' },
    ],
  },
  {
    id: 'geography',
    name: 'Geography',
    shortName: 'Geography',
    syllabusCode: 'IGCSE 0460',
    faculty: 'Commercials & Humanities',
    description: 'Population dynamics, settlement, earthquakes & volcanoes, rivers, coasts, weather, climate, and sustainable development.',
    topics: ['Population & Migration', 'Settlement & Urbanisation', 'Tectonics & Hazards', 'Rivers & Coasts', 'Weather, Climate & Ecosystems', 'Development & Industry'],
    commandWords: ['Define', 'Describe', 'Explain', 'Compare', 'Evaluate'],
    keyFormulasOrFacts: [
      { label: 'Demographic Transition Model', detail: 'Tracks changes in birth rate, death rate, and total population across 5 stages of economic development.' },
      { label: 'River Erosion Processes', detail: 'Hydraulic action, Abrasion (corrasion), Attrition, and Solution (corrosion).' },
      { label: 'Plate Boundaries', detail: 'Constructive (divergent), Destructive (convergent subduction), Collision (fold mountains), Conservative (transform).' },
      { label: '7-Mark Case Study Rule', detail: 'Name a real place, include specific place-based facts/statistics, and develop cause-effect chains rather than generic statements.' },
    ],
    quickPrompts: [
      { label: '7-mark case study', prompt: 'How do I structure a full-mark 7-mark case study answer in IGCSE Geography 0460?' },
      { label: 'Oxbow lake formation', prompt: 'Explain the step-by-step formation of a meander and oxbow lake using correct fluvial terminology.' },
      { label: 'Tropical rainforest adaptations', prompt: 'Explain how vegetation adapts to the climate of tropical rainforests for IGCSE 0460.' },
    ],
  },
  {
    id: 'business-studies',
    name: 'Business Studies',
    shortName: 'Business',
    syllabusCode: 'IGCSE 0450',
    faculty: 'Commercials & Humanities',
    description: 'Enterprise, business organisations, people & motivation, marketing mix, operations management, and financial analysis.',
    topics: ['Enterprise & Ownership', 'People & Motivation', 'Marketing Mix (4Ps)', 'Operations & Quality', 'Finance & Cash Flow', 'External Influences'],
    commandWords: ['Identify', 'Explain', 'Analyse', 'Justify', 'Recommend'],
    keyFormulasOrFacts: [
      { label: 'Break-Even Output', detail: 'Break-even output = Fixed Costs / (Selling Price per unit - Variable Cost per unit)' },
      { label: 'Profitability Ratios', detail: 'Gross Profit Margin = (Gross Profit / Revenue) × 100; Net Profit Margin = (Net Profit / Revenue) × 100' },
      { label: 'Liquidity Ratios', detail: 'Current Ratio = Current Assets / Current Liabilities; Acid Test = (Current Assets - Inventory) / Current Liabilities' },
      { label: 'Application & Evaluation', detail: 'Always anchor recommendations to the specific business context in the case study and weigh both sides before justifying.' },
    ],
    quickPrompts: [
      { label: 'Break-even & cash flow', prompt: 'Explain the difference between profit and cash flow, and how to calculate break-even output in IGCSE 0450.' },
      { label: '12-mark justify question', prompt: 'Give me a clear exam structure for scoring top marks on a Paper 2 12-mark recommendation question.' },
      { label: 'Limited vs sole trader', prompt: 'Compare a sole trader with a private limited company (Ltd) focusing on liability, finance, and control.' },
    ],
  },
];

export const SUBJECT_BY_ID: Record<StudySubjectId, StudySubject> = Object.fromEntries(
  STUDY_SUBJECTS.map((subject) => [subject.id, subject])
) as Record<StudySubjectId, StudySubject>;

export function isStudySubjectId(value: unknown): value is StudySubjectId {
  return typeof value === 'string' && value in SUBJECT_BY_ID;
}
