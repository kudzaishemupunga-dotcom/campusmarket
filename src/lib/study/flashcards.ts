import type { CuratedFlashcard, CustomFlashcardRecord, StudyFlashcardItem } from './types';

function card(
  id: string,
  subjectId: CuratedFlashcard['subjectId'],
  topic: string,
  tier: CuratedFlashcard['tier'],
  front: string,
  back: string,
  hint: string,
  examNote: string
): CuratedFlashcard {
  return {
    id,
    cardKey: `curated:${id}`,
    subjectId,
    topic,
    tier,
    front,
    back,
    hint,
    examNote,
    source: 'curated',
  };
}

export const CURATED_FLASHCARDS: readonly CuratedFlashcard[] = [
  // ===================== MATHEMATICS (0580) =====================
  card(
    'fc-math-1',
    'mathematics',
    'Algebra & Quadratics',
    'extended',
    'State the Quadratic Formula for solving ax² + bx + c = 0.',
    'x = (−b ± √(b² − 4ac)) / 2a',
    'The expression inside the square root is the discriminant (b² − 4ac).',
    'Always show substitution into the formula before rounding to 2 decimal places in Paper 4.'
  ),
  card(
    'fc-math-2',
    'mathematics',
    'Trigonometry',
    'extended',
    'When should you apply the Sine Rule vs the Cosine Rule in a non-right-angled triangle?',
    'Use the Sine Rule (a/sin A = b/sin B) when you know a side–angle opposite pair. Use the Cosine Rule (a² = b² + c² − 2bc cos A) when you know SAS (two sides + included angle) or SSS (all three sides).',
    'Think: opposite pair → Sine; included angle or three sides → Cosine.',
    'Watch for the ambiguous obtuse-angle case with the Sine Rule when finding an angle.'
  ),
  card(
    'fc-math-3',
    'mathematics',
    'Mensuration & Graphs',
    'core',
    'How are the gradients of two perpendicular straight lines related?',
    'The product of their gradients is −1 (m₁ × m₂ = −1), meaning one gradient is the negative reciprocal of the other.',
    'Flip the fraction and change its sign.',
    'Parallel lines share the exact same gradient (m₁ = m₂).'
  ),
  card(
    'fc-math-4',
    'mathematics',
    'Geometry & Angles',
    'extended',
    'State the Alternate Segment Theorem in circle geometry.',
    'The angle between a tangent and a chord at the point of contact equals the angle subtended by that chord in the alternate segment.',
    'Compare the tangent-chord angle with the triangle angle facing that chord.',
    'Always quote the exact geometric reason in words when a question says "giving a reason".'
  ),
  card(
    'fc-math-5',
    'mathematics',
    'Number & Percentages',
    'core',
    'How do you calculate original value in a reverse percentage problem (e.g. price after a 20% discount is $64)?',
    'Divide the new amount by the percentage multiplier remaining: Original = New ÷ (1 − 0.20) = $64 ÷ 0.80 = $80.',
    'Never just add 20% of $64—that takes 20% of the wrong base!',
    'Reverse percentages appear frequently in both Core and Extended Paper 2/4.'
  ),
  card(
    'fc-math-6',
    'mathematics',
    'Mensuration & Graphs',
    'core',
    'State the formulas for the circumference and area of a circle, plus arc length and sector area.',
    'Circumference = 2πr; Area = πr². For sector angle θ: Arc length = (θ/360) × 2πr; Sector area = (θ/360) × πr².',
    'A sector is simply the fraction θ/360 of the full circle.',
    'Leave intermediate answers in terms of π and round only at the final line.'
  ),
  card(
    'fc-math-7',
    'mathematics',
    'Statistics & Probability',
    'extended',
    'In a histogram with unequal class widths, what quantity is plotted on the vertical axis?',
    'Frequency Density, where Frequency Density = Frequency ÷ Class Width. The area of each bar represents the frequency.',
    'Area = height × width = frequency.',
    'Always read the class width carefully before calculating frequency from a bar.'
  ),
  card(
    'fc-math-8',
    'mathematics',
    'Algebra & Quadratics',
    'extended',
    'What are the three core laws of indices for multiplication, division, and negative exponents?',
    'aᵐ × aⁿ = aᵐ⁺ⁿ; aᵐ ÷ aⁿ = aᵐ⁻ⁿ; a⁻ⁿ = 1 / aⁿ (and a⁰ = 1 for a ≠ 0; a^(1/n) = ⁿ√a).',
    'Add powers when multiplying same bases; subtract when dividing.',
    'Rewrite fractional/negative powers step-by-step for method marks.'
  ),

  // ===================== BIOLOGY (0610) =====================
  card(
    'fc-bio-1',
    'biology',
    'Cell Structure & Transport',
    'extended',
    'Define osmosis using exact Cambridge IGCSE 0610 Extended terminology.',
    'The net movement of water molecules from a region of higher water potential (dilute solution) to a region of lower water potential (concentrated solution), through a partially permeable membrane.',
    'Include: net movement, water molecules, water potential, partially permeable membrane.',
    'Omitting "net" or "partially permeable membrane" commonly loses 1 mark.'
  ),
  card(
    'fc-bio-2',
    'biology',
    'Cell Structure & Transport',
    'core',
    'Define active transport and give one plant example.',
    'Movement of particles through a cell membrane from a region of lower concentration to a region of higher concentration (against a concentration gradient) using energy released from respiration. Example: uptake of nitrate/magnesium ions by root hair cells.',
    'Requires ATP energy and carrier proteins.',
    'Contrast with diffusion (passive, down gradient).'
  ),
  card(
    'fc-bio-3',
    'biology',
    'Enzymes & Nutrition',
    'extended',
    'Explain how pH outside an enzyme’s optimum reduces reaction rate.',
    'Extreme pH disrupts ionic/hydrogen bonds holding the enzyme’s 3D structure, changing the shape of the active site (denaturation) so the substrate is no longer complementary and fewer enzyme-substrate complexes form.',
    'Mention active site shape and complementary substrate fit.',
    'Remember pepsin works at ~pH 2 (stomach) while amylase/lipase prefer ~pH 7–8.'
  ),
  card(
    'fc-bio-4',
    'biology',
    'Plant & Human Transport',
    'core',
    'State three structural adaptations of xylem vessels for water transport.',
    '1) Dead hollow cells with no end walls forming a continuous tube; 2) Walls thickened with waterproof lignin for strength and support; 3) Narrow lumen assisting capillary action and continuous water column.',
    'Think: hollow tube, no cytoplasm, lignin rings.',
    'Xylem moves water/minerals UP only via the transpiration pull.'
  ),
  card(
    'fc-bio-5',
    'biology',
    'Respiration & Gas Exchange',
    'core',
    'List four features that make human alveoli efficient gas exchange surfaces.',
    'Large total surface area; walls one cell thick (short diffusion distance); dense capillary network maintaining a steep concentration gradient; thin film of moisture dissolving gases.',
    'Think SA, thinness, blood supply, moisture.',
    'Link each structural feature directly to "faster rate of diffusion" in 4-mark answers.'
  ),
  card(
    'fc-bio-6',
    'biology',
    'Genetics & Inheritance',
    'extended',
    'Compare mitosis and meiosis in terms of daughter cells, chromosome number, and genetic variation.',
    'Mitosis produces 2 genetically identical diploid cells (growth, repair, asexual reproduction). Meiosis produces 4 genetically different haploid gametes (reduction division for sexual reproduction).',
    'Mitosis = 2 identical diploid; Meiosis = 4 varied haploid.',
    'State "reduction division in which chromosome number is halved from diploid to haploid".'
  ),
  card(
    'fc-bio-7',
    'biology',
    'Enzymes & Nutrition',
    'core',
    'Write the balanced chemical equation for photosynthesis and identify the limiting factors.',
    '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (light & chlorophyll). Main limiting factors: light intensity, carbon dioxide concentration, and temperature.',
    'Six of everything except glucose (C₆H₁₂O₆).',
    'When a graph plateaus as light rises, another factor (CO₂ or temperature) has become limiting.'
  ),
  card(
    'fc-bio-8',
    'biology',
    'Ecology & Ecosystems',
    'extended',
    'Explain the role of nitrifying and denitrifying bacteria in the nitrogen cycle.',
    'Nitrifying bacteria oxidise ammonium ions (NH₄⁺) into nitrites and then nitrates (NO₃⁻) that plants absorb. Denitrifying bacteria in waterlogged anaerobic soils convert nitrates back into atmospheric nitrogen gas (N₂).',
    'Nitrifying adds usable nitrates; denitrifying removes them back to air.',
    'Also distinguish nitrogen-fixing bacteria (N₂ → ammonium in root nodules/soil).'
  ),

  // ===================== CHEMISTRY (0620) =====================
  card(
    'fc-chem-1',
    'chemistry',
    'Atomic Structure & Bonding',
    'core',
    'Compare ionic, simple covalent, and metallic bonding in one clear summary.',
    'Ionic: electrostatic attraction between oppositely charged ions (metal + non-metal). Covalent: shared pairs of electrons between non-metal atoms. Metallic: electrostatic attraction between positive metal ions and a sea of delocalised electrons.',
    'Transfer vs sharing vs delocalised sea.',
    'Always specify "weak intermolecular forces" (NOT covalent bonds) break when simple molecular substances melt.'
  ),
  card(
    'fc-chem-2',
    'chemistry',
    'Stoichiometry & Moles',
    'extended',
    'State the three core mole equations used across IGCSE 0620 calculations.',
    '1) n = mass (g) / Mr; 2) n = concentration (mol/dm³) × volume (dm³); 3) n = gas volume (dm³) / 24 at r.t.p.',
    'Convert cm³ to dm³ by dividing by 1000.',
    'Always check the mole ratio from the balanced chemical equation as step 2.'
  ),
  card(
    'fc-chem-3',
    'chemistry',
    'Electrochemistry',
    'extended',
    'State the anode and cathode half-equations in the electrolysis of molten lead(II) bromide (PbBr₂).',
    'Cathode (−, reduction): Pb²⁺ + 2e⁻ → Pb. Anode (+, oxidation): 2Br⁻ → Br₂ + 2e⁻.',
    'PANIC: Positive Anode, Negative Is Cathode; OIL RIG.',
    'Ensure both atoms and total electrical charges balance on both sides of each half-equation.'
  ),
  card(
    'fc-chem-4',
    'chemistry',
    'Rates & Equilibrium',
    'extended',
    'State Le Chatelier’s Principle for reversible reactions at dynamic equilibrium.',
    'If a system at equilibrium is subjected to a change in temperature, pressure, or concentration, the equilibrium position shifts in the direction that opposes/minimises that change.',
    'Increasing temperature favours the endothermic direction; increasing pressure favours fewer gas moles.',
    'Remember: a catalyst speeds up forward and reverse rates equally—it does NOT shift equilibrium position.'
  ),
  card(
    'fc-chem-5',
    'chemistry',
    'Acids, Bases & Salts',
    'core',
    'How do you prepare a pure, dry sample of a soluble salt like copper(II) sulfate from an insoluble base?',
    'Warm dilute sulfuric acid and add excess copper(II) oxide until no more dissolves; filter to remove excess solid; evaporate filtrate to crystallisation point; cool, filter crystals, and pat dry between filter papers.',
    'React with EXCESS insoluble base → filter → evaporate partially → crystallise.',
    'Adding excess base ensures all the acid is completely neutralised.'
  ),
  card(
    'fc-chem-6',
    'chemistry',
    'Organic Chemistry',
    'core',
    'Compare cracking of long-chain alkanes with fractional distillation of crude oil.',
    'Fractional distillation physically separates hydrocarbons by boiling point without breaking molecules. Cracking thermally/catalytically breaks long alkanes into shorter, more useful alkanes plus alkenes (for polymers).',
    'Separation vs breaking chemical bonds.',
    'Check carbon and hydrogen counts balance on both sides of any cracking equation.'
  ),
  card(
    'fc-chem-7',
    'chemistry',
    'Acids, Bases & Salts',
    'extended',
    'Distinguish between a strong acid and a weak acid in terms of proton (H⁺) dissociation.',
    'A strong acid (e.g. HCl, H₂SO₄) completely dissociates into ions in aqueous solution. A weak acid (e.g. ethanoic acid, CH₃COOH) only partially dissociates in aqueous solution (reversible equilibrium).',
    'Strong ≠ concentrated! Strength is degree of dissociation.',
    'At equal concentration, a strong acid has a lower pH and faster reaction rate than a weak acid.'
  ),
  card(
    'fc-chem-8',
    'chemistry',
    'Atomic Structure & Bonding',
    'core',
    'Explain why graphite conducts electricity and feels slippery, while diamond is very hard and an insulator.',
    'In graphite, each carbon forms 3 covalent bonds leaving 1 delocalised electron to conduct charge, and weak forces between hexagonal layers let layers slide. In diamond, each carbon forms 4 strong covalent bonds in a rigid tetrahedral lattice with no free electrons.',
    '3 bonds + layers + delocalised e⁻ vs 4 bonds rigid lattice.',
    'Both have very high melting points because both are giant covalent structures.'
  ),

  // ===================== PHYSICS (0625) =====================
  card(
    'fc-phys-1',
    'physics',
    'Motion & Forces',
    'extended',
    'State the Principle of Conservation of Momentum and the impulse equation.',
    'Total momentum before a collision equals total momentum after, provided no external resultant force acts (m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂). Impulse = FΔt = Δp = m(v − u).',
    'Momentum is a vector—opposite directions have opposite signs!',
    'Crumple zones increase collision time Δt, reducing average impact force F = Δp / Δt.'
  ),
  card(
    'fc-phys-2',
    'physics',
    'Motion & Forces',
    'core',
    'State the Principle of Moments for a body in equilibrium.',
    'For an object in equilibrium, the sum of clockwise moments about any pivot equals the sum of anticlockwise moments about the same pivot (Moment = Force × perpendicular distance).',
    'Also: resultant force in every direction must be zero.',
    'Always use the PERPENDICULAR distance from the pivot to the line of action of the force.'
  ),
  card(
    'fc-phys-3',
    'physics',
    'Work, Energy & Power',
    'core',
    'State the formula for efficiency and explain why real machines never exceed 100% efficiency.',
    'Efficiency = (Useful energy or power output / Total energy or power input) × 100%. Real machines always dissipate some energy as thermal energy to the surroundings due to friction or electrical resistance.',
    'Output divided by input; never greater than 100%.',
    'State clearly where wasted energy goes ("dissipated as thermal energy to surroundings").'
  ),
  card(
    'fc-phys-4',
    'physics',
    'Thermal Physics',
    'extended',
    'State the specific heat capacity equation and explain what c = 4200 J/(kg °C) means for water.',
    'ΔE = mcΔθ. A specific heat capacity of 4200 J/(kg °C) means 4200 J of thermal energy is needed to raise the temperature of 1 kg of water by 1 °C.',
    'Mass in kg, Δθ in °C or K.',
    'Note: during melting or boiling, temperature stays constant because thermal energy breaks intermolecular bonds instead of raising kinetic energy.'
  ),
  card(
    'fc-phys-5',
    'physics',
    'Waves & Optics',
    'extended',
    'State the two conditions required for Total Internal Reflection (TIR) in an optical fibre.',
    '1) Light must travel from an optically denser medium toward a less dense medium (e.g. glass to air); 2) The angle of incidence must be strictly greater than the critical angle (i > c, where sin c = 1/n).',
    'Denser → less dense AND i > c.',
    'Remember angles are ALWAYS measured between the ray and the NORMAL, not the surface.'
  ),
  card(
    'fc-phys-6',
    'physics',
    'Electricity & Circuits',
    'core',
    'How do current and potential difference behave in a series circuit vs a parallel circuit?',
    'Series: current is the same everywhere; potential difference splits across components (V = V₁ + V₂). Parallel: potential difference is the same across every branch; total current splits across branches (I = I₁ + I₂).',
    'Series shares V; parallel shares I.',
    'Ammeters go in series; voltmeters go in parallel across the component.'
  ),
  card(
    'fc-phys-7',
    'physics',
    'Magnetism & Nuclear Physics',
    'extended',
    'State the transformer turns-ratio equation and why step-up transformers are used in national power grids.',
    'Vp / Vs = Np / Ns (and for 100% efficient transformer, VpIp = VsIs). Stepping up voltage reduces current (I = P/V), drastically reducing resistive heating power losses (P = I²R) in transmission cables.',
    'High voltage → low current → far less I²R heat loss.',
    'Transformers ONLY work with alternating current (a.c.) because a changing magnetic field is needed to induce e.m.f.'
  ),
  card(
    'fc-phys-8',
    'physics',
    'Magnetism & Nuclear Physics',
    'core',
    'Compare alpha (α), beta (β), and gamma (γ) radiation by penetrating power and ionising power.',
    'Alpha (⁴₂He): highest ionising, lowest penetration (stopped by paper/skin). Beta (⁰₋₁e): moderate ionising & penetration (stopped by few mm aluminium). Gamma (EM wave): lowest ionising, highest penetration (reduced by thick lead/concrete).',
    'Ionising power and penetrating power run in opposite directions.',
    'In electric/magnetic fields, gamma is undeflected because it carries zero charge.'
  ),

  // ===================== COMPUTER SCIENCE (0478) =====================
  card(
    'fc-cs-1',
    'computer-science',
    'Hardware & Architecture',
    'extended',
    'Outline the Fetch–Decode–Execute (FDE) cycle in order, naming key CPU registers.',
    '1) PC address copied to MAR and PC incremented; 2) Address travels on address bus, instruction returns on data bus into MDR; 3) MDR copied to CIR; 4) Control Unit decodes CIR; 5) ALU/CU execute instruction using ACC and registers.',
    'PC → MAR → Memory → MDR → CIR → Decode → Execute.',
    'Mention address bus (unidirectional) and data bus (bidirectional) for full Paper 1 detail.'
  ),
  card(
    'fc-cs-2',
    'computer-science',
    'Data Representation',
    'extended',
    'How do you represent −19 in 8-bit two’s complement binary?',
    'Write +19 in 8-bit binary (00010011), invert all bits (11101100), and add 1 → 11101101. Check: −128 + 64 + 32 + 8 + 4 + 1 = −19.',
    'Flip all bits, then add 1; MSB has value −128.',
    'Always verify by summing place values with −128 on the leftmost bit.'
  ),
  card(
    'fc-cs-3',
    'computer-science',
    'Data Representation',
    'core',
    'Compare lossy and lossless compression with one valid use case for each.',
    'Lossy permanently removes less noticeable data for smaller file sizes (e.g. JPEG photos, MP3 audio). Lossless preserves every original bit so the exact file is restored on decompression (e.g. program code, text documents, PNG).',
    'Never use lossy compression on executable code or database records!',
    'Explain RLE (Run-Length Encoding) as an example of lossless compression.'
  ),
  card(
    'fc-cs-4',
    'computer-science',
    'Data Transmission & Networks',
    'core',
    'Distinguish between serial and parallel data transmission, and why USB uses serial.',
    'Serial sends 1 bit at a time along a single wire (reliable over long distances, no skew, cheaper cable). Parallel sends multiple bits simultaneously across multiple wires (fast over short distances inside a CPU/bus, but suffers bit skew over distance).',
    'Skew = bits arriving out of sync on parallel wires.',
    'Also know simplex, half-duplex, and full-duplex transmission directions.'
  ),
  card(
    'fc-cs-5',
    'computer-science',
    'Cyber Security',
    'extended',
    'How does HTTPS (TLS/SSL) use asymmetric and symmetric encryption together?',
    'The server sends a digital certificate with its public key; asymmetric encryption securely exchanges a temporary session key; symmetric encryption then encrypts the bulk web traffic rapidly using that shared session key.',
    'Asymmetric = secure key handshake; Symmetric = fast bulk data.',
    'Mention Certificate Authority (CA) verifying server authenticity.'
  ),
  card(
    'fc-cs-6',
    'computer-science',
    'Algorithms & Pseudocode',
    'core',
    'Differentiate between FOR, WHILE, and REPEAT…UNTIL loops in Cambridge 0478 pseudocode.',
    'FOR: count-controlled when iterations are known beforehand. WHILE: pre-condition loop (checked at start; may run 0 times). REPEAT…UNTIL: post-condition loop (checked at end; always runs at least once).',
    'Known count → FOR; 0+ times → WHILE; 1+ times → REPEAT.',
    'Watch Cambridge syntax: WHILE stops when FALSE, whereas REPEAT…UNTIL stops when TRUE.'
  ),
  card(
    'fc-cs-7',
    'computer-science',
    'Algorithms & Pseudocode',
    'extended',
    'Compare linear search and bubble sort in terms of purpose and behaviour.',
    'Linear search inspects elements sequentially from index 0 until the target value is found or the list ends (works on unsorted lists). Bubble sort repeatedly compares adjacent elements and swaps them if out of order over multiple passes until sorted.',
    'Searching finds an item; sorting orders a list.',
    'Optimised bubble sort uses a boolean Swapped flag to stop early once no swaps occur in a pass.'
  ),
  card(
    'fc-cs-8',
    'computer-science',
    'Boolean Logic & Databases',
    'core',
    'What is the difference between a compiler and an interpreter?',
    'A compiler translates the entire high-level program into standalone machine code before running (fast execution, produces an error report at once). An interpreter translates and executes line by line (easier debugging, stops at the first error, needs interpreter present to run).',
    'All at once (executable file) vs line-by-line execution.',
    'Interpreters are great during development; compilers are preferred for final distribution.'
  ),

  // ===================== ENGLISH LANGUAGE (0500) =====================
  card(
    'fc-eng-1',
    'english',
    'Writer’s Effect',
    'extended',
    'State the 4-step analytical pattern for high-scoring Writer’s Effect paragraphs (Paper 1 Q2d).',
    '1) Overview of the paragraph’s overall atmosphere; 2) Embed a brief, potent quotation; 3) Clarify exact literal meaning in context; 4) Explore connotations/imagery and the emotional effect created on the reader.',
    'Overview → Short Quote → Meaning → Connotation & Effect.',
    'Select 3 strong phrases from EACH of the two specified paragraphs (6 total).'
  ),
  card(
    'fc-eng-2',
    'english',
    'Summary Writing',
    'core',
    'State the golden rules of IGCSE 0500 Paper 1 Question 1(f) Summary Writing.',
    'Stay strictly focused on the exact prompt; aim for ~120 words in continuous prose; use your own words; include 10+ distinct points; exclude examples, statistics, quotations, and personal opinions.',
    'Continuous prose, own words, ~120 words, zero opinions.',
    'Use discourse markers (Furthermore, Consequently, However) to earn top writing-band marks.'
  ),
  card(
    'fc-eng-3',
    'english',
    'Directed Writing',
    'core',
    'What does VARP stand for when planning Directed Writing (letter, speech, article, report, journal)?',
    'Voice (persona/role), Audience (who is reading/listening), Register (level of formality and tone), Purpose (inform, persuade, advise, argue, reflect).',
    'Always match greeting, layout, and tone to the required text type.',
    'Cover ALL THREE bullet points in the prompt evenly—missing bullet 3 caps your reading band!'
  ),
  card(
    'fc-eng-4',
    'english',
    'Descriptive & Narrative Craft',
    'extended',
    'How does a Descriptive Composition differ structurally from a Narrative Composition in Paper 2?',
    'Descriptive zooms smoothly across a scene or moment using rich sensory imagery, atmosphere, and perspective shifts with minimal plot. Narrative builds a focused story arc (exposition, rising tension, climax, resolution) with believable characters.',
    'Descriptive = painting a vivid moment; Narrative = focused short story.',
    'Keep narratives tightly scoped to 1–2 characters and a short timeframe rather than rushing a movie-length plot.'
  ),
  card(
    'fc-eng-5',
    'english',
    'Grammar & Precision',
    'core',
    'Explain how to fix a comma splice.',
    'Replace the comma joining two independent clauses with either: 1) a full stop, 2) a semicolon, or 3) a comma plus a coordinating conjunction (for, and, nor, but, or, yet, so).',
    'Wrong: "The bell rang, students ran out." Right: "The bell rang; students ran out."',
    'Eliminating comma splices immediately boosts Writing Accuracy (W5) grades.'
  ),
  card(
    'fc-eng-6',
    'english',
    'Comprehension & Inference',
    'core',
    'What does "Using your own words, explain..." require in IGCSE 0500 reading questions?',
    'Paraphrase the key meaning-carrying words from the passage accurately without lifting the original phrasing, while keeping all factual details faithful to the text.',
    'Spot the 2–3 key content words in the text and replace them with precise synonyms.',
    'Lifting exact phrases from the text receives 0 marks on explicit own-words questions.'
  ),
  card(
    'fc-eng-7',
    'english',
    'Writer’s Effect',
    'core',
    'Distinguish between pathetic fallacy, personification, and sibilance.',
    'Pathetic fallacy attributes human emotion to weather/nature to mirror mood. Personification gives human qualities to any non-human object. Sibilance repeats soft "s/sh" sounds to create a whispering, tense, or sinister effect.',
    'Weather emotion vs general human traits vs repeated "s" sound.',
    'Always link the sound or image back to the context of the specific passage.'
  ),
  card(
    'fc-eng-8',
    'english',
    'Directed Writing',
    'extended',
    'How should you structure a balanced argumentative or discursive essay/article?',
    'Hook + clear thesis → Developed arguments supported by evidence → Fair engagement with counter-argument and rebuttal → Memorable conclusion synthesising why your stance is strongest.',
    'Thesis → Evidence → Counter-argument + Rebuttal → Conclusion.',
    'Rhetorical questions, rule of three, and measured concessions elevate persuasive voice.'
  ),

  // ===================== GEOGRAPHY (0460) =====================
  card(
    'fc-geo-1',
    'geography',
    'Rivers & Coasts',
    'core',
    'Name the four river transportation processes.',
    'Traction (large boulders rolled along bed), Saltation (pebbles bounced along bed), Suspension (fine silt/clay carried in the water), Solution (dissolved minerals carried invisibly).',
    'Roll → Bounce → Float → Dissolve (TS-SS).',
    'Higher discharge and velocity increase a river’s competence (largest load size) and capacity (total load).'
  ),
  card(
    'fc-geo-2',
    'geography',
    'Rivers & Coasts',
    'extended',
    'Explain how an oxbow lake forms from a river meander.',
    'Continued lateral erosion on outside bends narrows the meander neck; during a flood, the river cuts straight across the neck taking the shortest steeper path; deposition seals off the old loop, leaving a curved oxbow lake.',
    'Lateral erosion → narrow neck → flood cut-through → deposition seals off loop.',
    'Include the terms "thalweg" (line of fastest flow) and "deposition" to reach top level.'
  ),
  card(
    'fc-geo-3',
    'geography',
    'Tectonics & Hazards',
    'core',
    'Why do people continue to live in hazardous volcanic or earthquake zones?',
    'Fertile volcanic soils for agriculture, geothermal energy, mineral mining, tourism jobs, strong family/community ties, high cost of relocating, and trust in earthquake-resistant engineering or early warning systems.',
    'Think economic benefits + social ties + engineering confidence.',
    'Give specific, developed reasons rather than one-word answers like "money".'
  ),
  card(
    'fc-geo-4',
    'geography',
    'Population & Migration',
    'extended',
    'What challenges does an ageing population (Stage 4/5 DTM) create for a country?',
    'Higher healthcare and pension expenditure; shrinking working-age tax base (higher old-age dependency ratio); labour shortages in key industries; potential need to raise retirement age or encourage skilled immigration.',
    'Fewer workers supporting more retired citizens.',
    'Contrast clearly with a youthful population (high spending on schools/maternity care, future job demand).'
  ),
  card(
    'fc-geo-5',
    'geography',
    'Weather, Climate & Ecosystems',
    'core',
    'Explain why equatorial regions experience convectional rainfall almost every afternoon.',
    'Intense overhead solar radiation heats the ground strongly → warm moist air rises rapidly (convection) → air cools as it rises → water vapour condenses around dust particles forming tall cumulonimbus clouds → heavy afternoon rain and thunder.',
    'Heat → Rise → Cool → Condense → Heavy rain.',
    'This same causal chain explains why rainforest climates have small annual temperature ranges (~26–28 °C).'
  ),
  card(
    'fc-geo-6',
    'geography',
    'Settlement & Urbanisation',
    'core',
    'Compare the Central Business District (CBD) with the Rural–Urban Fringe.',
    'CBD: city centre, highest land values, high-rise offices/flagship retail, highest accessibility, few permanent residents. Rural–Urban Fringe: outer edge, cheaper open land, retail parks/airports/new housing estates, conflicts between urban sprawl and farmland conservation.',
    'Bid-rent theory: land price drops with distance from the CBD.',
    'Use accurate urban land-use terms like "high-order goods" and "greenbelt".'
  ),
  card(
    'fc-geo-7',
    'geography',
    'Development & Industry',
    'core',
    'Define the four employment sectors (Primary, Secondary, Tertiary, Quaternary).',
    'Primary: extracting raw materials (farming, mining). Secondary: manufacturing/processing goods. Tertiary: providing services (teaching, banking, retail). Quaternary: high-tech research, IT, and knowledge industries.',
    'Extract → Make → Serve → Innovate.',
    'As countries develop, employment typically shifts from Primary → Secondary → Tertiary/Quaternary.'
  ),
  card(
    'fc-geo-8',
    'geography',
    'Rivers & Coasts',
    'extended',
    'Explain how Longshore Drift moves sediment along a coastline.',
    'Prevailing winds drive waves onto the beach at an oblique angle (swash carries sand diagonally up the beach); gravity pulls backwash straight back down at 90° to the shoreline, moving sediment in a zigzag path along the coast.',
    'Angled swash + perpendicular backwash = zigzag drift.',
    'Longshore drift builds spits where the coastline changes direction and waves lose energy.'
  ),

  // ===================== BUSINESS STUDIES (0450) =====================
  card(
    'fc-bus-1',
    'business-studies',
    'Enterprise & Ownership',
    'core',
    'Define “added value” and state two practical ways a student enterprise can increase it.',
    'Added value is the difference between the selling price of a product and the cost of bought-in materials/components. Increase it by improving branding/packaging, enhancing quality/design features, or reducing material input costs without lowering quality.',
    'Added value = Selling price − Cost of bought-in materials (NOT the same as profit!).',
    'Remember profit deducts ALL other expenses (wages, rent, electricity) from added value.'
  ),
  card(
    'fc-bus-2',
    'business-studies',
    'Finance & Cash Flow',
    'extended',
    'Compare internal and external sources of business finance with examples.',
    'Internal (from inside the firm): retained profit, sale of surplus assets, reducing inventory—no interest charged, keeps control. External (from outside): bank loan, overdraft, issuing shares, trade credit, grants—raises larger sums but may incur interest or dilute ownership.',
    'Match time horizon: overdraft for short-term cash gaps; loan/shares for long-term expansion.',
    'Always justify your chosen finance source using the business’s legal structure and gearing.'
  ),
  card(
    'fc-bus-3',
    'business-studies',
    'Marketing Mix (4Ps)',
    'core',
    'List the 4Ps of the Marketing Mix and explain why they must be consistent.',
    'Product, Price, Place (distribution channels), and Promotion. They must align with the target market—e.g. a luxury handmade brand needs premium quality, skimming/high price, selective outlets, and polished branding.',
    'Product, Price, Place, Promotion.',
    'In Paper 2, check whether a proposed price or channel clashes with the product’s brand image.'
  ),
  card(
    'fc-bus-4',
    'business-studies',
    'People & Motivation',
    'core',
    'Compare autocratic, democratic, and laissez-faire leadership styles.',
    'Autocratic: manager makes all decisions alone (fast in crises, can demotivate skilled staff). Democratic: involves employees in consultation (higher motivation and better ideas, slower decisions). Laissez-faire: sets broad objectives and lets skilled specialists decide how to work.',
    'Command vs Consult vs Delegate.',
    'The "best" style always depends on worker skill level, urgency, and task creativity.'
  ),
  card(
    'fc-bus-5',
    'business-studies',
    'Operations & Quality',
    'core',
    'Distinguish between Quality Control (QC) and Quality Assurance (QA).',
    'Quality Control inspects finished products at the end of production to spot defects (reactive, creates scrap waste). Quality Assurance builds quality standards into every stage of design and production (proactive, empowers workers, lowers waste).',
    'QC inspects at the end; QA prevents defects throughout.',
    'QA requires staff training upfront but strengthens brand reputation and reduces rework costs.'
  ),
  card(
    'fc-bus-6',
    'business-studies',
    'Finance & Cash Flow',
    'extended',
    'State the Current Ratio and Acid Test Ratio formulas and ideal benchmarks.',
    'Current Ratio = Current Assets ÷ Current Liabilities (healthy benchmark ~1.5 to 2.0 : 1). Acid Test Ratio = (Current Assets − Inventory) ÷ Current Liabilities (healthy benchmark ~1.0 : 1).',
    'Acid test excludes inventory because stock can be slow to turn into cash.',
    'A ratio below 1.0 signals potential liquidity crisis—difficulty paying short-term debts.'
  ),
  card(
    'fc-bus-7',
    'business-studies',
    'Operations & Quality',
    'extended',
    'Explain Economies of Scale and give two specific types.',
    'Reductions in average cost per unit as a business expands output. Examples: Purchasing economies (bulk-buying discounts), Technical economies (specialised high-speed machinery), Financial economies (lower loan interest rates), Marketing economies.',
    'Output ↑ → Average unit cost ↓.',
    'Also know Diseconomies of Scale: poor communication, weak coordination, and low morale when firms grow too large.'
  ),
  card(
    'fc-bus-8',
    'business-studies',
    'External Influences',
    'core',
    'How can adopting environmentally sustainable practices benefit a business?',
    'Attracts eco-conscious customers (unique selling point / higher sales), lowers energy and material waste costs over time, avoids environmental fines/regulations, and improves reputation with investors and employees.',
    'Weigh short-term setup cost against long-term brand loyalty and cost savings.',
    'Always connect environmental choices to specific stakeholder impacts (customers, government, community, owners).'
  ),
];

export function combineFlashcards(customCards: readonly CustomFlashcardRecord[]): StudyFlashcardItem[] {
  const customItems: StudyFlashcardItem[] = customCards.map((item) => ({
    cardKey: `custom:${item.id}`,
    id: item.id,
    subjectId: item.subject_id,
    topic: item.topic,
    front: item.front,
    back: item.back,
    hint: item.hint,
    source: 'custom',
  }));
  return [...customItems, ...CURATED_FLASHCARDS];
}
