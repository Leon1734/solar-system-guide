/* ============================================================
 * i18n.js —— v4.0 中英双语
 *  - 中文为源语言（data.js 原文），英文以覆盖层提供
 *  - 静态文本按元素 id 替换；动态文本经 t()/bodyField() 取值
 *  - setLang 广播 'solar-lang' 事件，各模块刷新已渲染内容
 * ============================================================ */
'use strict';

window.I18N = (function () {
  let lang = 'zh';
  try {
    const saved = localStorage.getItem('solar_lang');
    lang = saved === 'en' || saved === 'zh' ? saved :
      (navigator.language && navigator.language.indexOf('en') === 0 ? 'en' : 'zh');
  } catch (e) { }

  /* ---------- 英文覆盖层 ---------- */
  const EN = {
    ui: {
      errRuntime: 'Error: ', errThree: 'three.js failed to load', errWebgl: 'WebGL is not supported in this browser.',
      brand: '🌞 Solar System Guide', brandSub: 'Interactive 3D astronomy demo based on NASA/JPL orbital data',
      tours: '🎓 Tours', badges: '🏆 Badges', starlife: '🌟 Star Life', compare: '⚖️ Compare',
      eclipse: '🌑 Eclipses', size: '📐 Sizes', science: '📖 Science', help: '❓', transit: '🔭 Transit', meteors: '☄️ Meteors',
      today: 'Today', speed: 'Speed', orbits: 'Orbits', labels: 'Labels', belts: 'Belts', bloom: 'Glow', realtex: 'Real tex',
      phase: '🌓 Phases', project: '🎬 Cinema', share: '🔗 Share', hz: ' habitable zone',
      sky: '👁️ Tonight’s Sky', cal: '📅 Calendar', quiz: '🎲 Quiz', constLbl: '⭐ Sky map', timeline: '⏳',
      constOn: '⭐ Constellation lines & ecliptic on', constOff: 'Constellations hidden',
      areaLaw: '📐 Kepler II: the shaded wedge is the area swept in the last 30 days — fat near perihelion, slim at aphelion, always equal',
      ringView: '🛰️ Flying over the rings — spot the Cassini & Encke gaps',
      csvOk: '📄 Sky report exported as CSV', years: 'yr',
      noMeteor: 'No major meteor shower nearby',
      loading: '🌞 Building the Solar System…', loadingSub: 'Generating planet textures procedurally (offline)',
      hint: 'Simulated time (UTC) · jump to any date below',
      follow: '🎯 Follow', unfollow: '✕ Unfollow',
      modeC: 'Distance: compact', modeR: 'Distance: true (1AU=42)',
      solarSys: 'Solar System', sysSwitch: 'Switched to: ',
      year: '', month: '/', day: '', dayN: 'Day ', days: 'days',
      noDateExo: 'Exo systems use relative time — calendar dates unsupported',
      noModeExo: 'Exo systems use schematic scale — distance modes unsupported',
      probeOn: '🛰️ Probe trails on — try setting the date to 1989', probeOff: 'Probe trails hidden',
      hzOn: '🟢 Habitable zone on — Earth sits right in the green', hzOff: 'Habitable zone hidden',
      copied: '🔗 Link copied: ', offline: 'Offline — keeping procedural textures',
      realTexOk: '✅ NASA textures loaded (Earth/Moon/Mars)', realTexPart: 'Some textures failed — keeping procedural ones',
      procTex: 'Procedural textures restored', noBloom: 'Post-processing unavailable here',
      noTts: 'Speech synthesis not supported in this browser',
      autoDegrade1: '⚡ Low FPS — bloom disabled automatically', autoDegrade2: '⚡ Render resolution lowered to keep it smooth',
      helpNote: '💡 Try "true distance" mode to feel how empty space is; set the date to your birthday to see the real planet arrangement. Share links: ?date=2026-01-01&follow=saturn&mode=real&tour=kepler',
      sizeSunNote: 'Sun (only its edge fits on screen)', sizeNote: '⟵ all bodies drawn to true linear scale ⟶',
      quizNext: 'Next ▶', quizFinish: 'Finish ✦', quizScore: 'View result 🏆',
      tourPrev: '⏮ Prev', tourNext: 'Next ▶', tourExit: '⏹', tourWait: '⏳ Waiting for simulated time…'
    },
    info: {
      type: 'Type', diameter: 'Diameter', mass: 'Mass', distEarth: 'Dist. to Earth',
      moonDist: '~384,400 km', moonNoteK: 'Dist. to Earth (enlarged for view)',
      parent: 'Orbits', avgDist: 'Mean dist. to Sun', liveNow: 'Current dist. to Sun', liveStar: 'Current dist. to star',
      millionKm: ' M km', galOrbit: 'Galactic orbit', galDesc: '~220 km/s around the Galactic centre',
      period: 'Orbital period', rotation: 'Rotation period', tilt: 'Axial tilt', moons: 'Known moons',
      temp: 'Temperature', gravity: 'Surface gravity', atmo: 'Atmosphere',
      hours: 'h', days: 'days', years: 'yr', retro: ' (retrograde)',
      basis: ' (reference)', timesEarth: ' (', timesSuffix: '× Earth)',
      around: ' (around ', facts: '🔍 Did you know',
      launch: 'Launch', cruise: 'Cruise speed', events: 'Milestones', status: 'Status',
      progress: 'Orbital progress', sinceDisc: 'since discovery:', since2000: 'since 2000:', laps: 'orbits · this one '
    },
    body: { sun: 'Sun', moon: 'Moon', halley: "Halley's Comet", pluto: 'Pluto', apophis: 'Apophis', earth: 'Earth',
      encke: 'Comet Encke', c67p: 'Comet 67P', halebopp: 'Comet Hale-Bopp', vesta: 'Vesta', pallas: 'Pallas' },
    sky: {
      lost: 'Lost in the Sun’s glare', low: 'Very low, hard to spot',
      evening: 'After dusk · western sky', morning: 'Before dawn · eastern sky',
      morningSide: 'rises before dawn', westSide: 'visible after dusk',
      sunBelow: 'Sun (below horizon)', tomorrow: 'tomorrow dawn',
      note: 'Elongation = Sun–Earth–planet angle, computed from real orbital positions at the simulated time · Uranus & Neptune are naked-eye invisible and omitted',
      title: '👁️ Tonight’s Sky', sub: 'Which planets can you see tonight? Elongation from the real positions tells you where to look',
      visNow: 'Visible planets right now:'
    },
    exo: {
      hzPlanet: 'Exoplanet · in habitable zone', planet: 'Exoplanet',
      hzTemp: 'In habitable zone — liquid water possible', outTemp: 'Outside habitable zone',
      atmo: 'To be revealed by JWST'
    },
    badges: { guide: 'Navigator', kepler: "Kepler's Apprentice", mercury: 'Mercury Explorer', seasons: 'Season Keeper', jupiter: 'Jupiter Watcher', halley: 'Comet Hunter', pluto: 'Frontier Pioneer' },
    /* 天体卡（英文覆盖：name/type/desc/factN） */
    cards: {
      sun: { name: 'Sun', type: 'G-type main-sequence star', desc: 'The absolute ruler of the Solar System — a star that has burned for 4.6 billion years and holds 99.86% of its mass.', fact0: 'Every second the Sun fuses ~600 million tons of hydrogen into helium.', fact1: 'Sunlight takes 8 min 20 s to reach Earth — but a photon born in the core may take tens of thousands of years to escape.', fact2: '1.3 million Earths would fit inside the Sun.', fact3: 'The Sun is slowly brightening; in ~1 billion years Earth may become too hot for life.' },
      mercury: { name: 'Mercury', type: 'Terrestrial planet', desc: 'The smallest planet closest to the Sun — a cratered world swinging between furnace and freezer.', fact0: 'A solar day on Mercury lasts 176 Earth days — twice its own year.', fact1: 'With no atmosphere, day–night temperature swings approach 600 ℃.', fact2: 'Its eccentric orbit (e=0.206) makes it the best example of Kepler’s first law.', fact3: 'Not the hottest planet — that “honour” belongs to Venus.' },
      venus: { name: 'Venus', type: 'Terrestrial planet', desc: "Earth's evil twin — similar in size, turned into an inferno by a runaway greenhouse effect.", fact0: 'Venus rotates backwards: the Sun rises in the west there.', fact1: 'Its day (243 Earth days) is longer than its year (225).', fact2: 'A CO2 atmosphere 92× Earth’s pressure makes it the hottest planet — hot enough to melt lead.', fact3: 'The brightest natural object in our night sky after the Moon; ancient Chinese called it the “Morning Star”.' },
      earth: { name: 'Earth', type: 'Terrestrial planet', desc: 'The only known world with life — 71% of its surface covered by liquid-water oceans.', fact0: 'Earth’s 23.44° axial tilt creates the seasons.', fact1: '“Sunrise” is really Earth rotating — the equator spins at ~1,670 km/h.', fact2: 'Tidal friction slows Earth down: in ~62,000 years a day will last 25 hours.', fact3: 'Earth is closest to the Sun in early January — seasons are about tilt, not distance.' },
      mars: { name: 'Mars', type: 'Terrestrial planet', desc: 'The red planet — rusted iron dust, and the most-visited world beyond Earth.', fact0: 'Olympus Mons rises 21.9 km — 2.5 × Everest.', fact1: 'Valles Marineris stretches 4,000 km long and 7 km deep.', fact2: 'Its two tiny moons, Phobos and Deimos, may be captured asteroids.', fact3: 'Mars’ day (24.6 h) and tilt (25°) mirror Earth’s; rivers once flowed here.' },
      jupiter: { name: 'Jupiter', type: 'Gas giant', desc: 'The giant of the Solar System — 2.5× the mass of all other planets combined, a gravitational bodyguard.', fact0: 'The Great Red Spot is a storm raging for at least 350 years.', fact1: 'Fastest spinner: one day lasts under 10 hours, flattening the planet.', fact2: '95+ moons; Ganymede is bigger than Mercury.', fact3: 'Its gravity slings away comets and asteroids, shielding the inner Solar System.' },
      saturn: { name: 'Saturn', type: 'Gas giant', desc: 'The ringed jewel — countless ice grains and rubble in a disc 280,000 km wide.', fact0: 'Saturn’s density (0.687 g/cm³) is lower than water — it would float.', fact1: 'The rings span 280,000 km yet are often just 10–100 m thick.', fact2: '146 known moons — the record; Titan has lakes of liquid methane.', fact3: 'A mysterious hexagon storm, 30,000 km wide, swirls at its north pole.' },
      uranus: { name: 'Uranus', type: 'Ice giant', desc: 'The tipped-over ice giant — its axis lies almost in its orbital plane.', fact0: 'Axial tilt 97.8°: each pole gets 42 years of daylight, then 42 of night.', fact1: 'First telescope-discovered planet (Herschel, 1781).', fact2: 'The coldest planetary atmosphere recorded: −224 ℃.', fact3: 'Its rings and moons orbit almost vertically.' },
      neptune: { name: 'Neptune', type: 'Ice giant', desc: 'The farthest planet — a deep-blue world found with mathematics before telescopes.', fact0: 'Predicted from Uranus’ orbital wobbles and found in 1846 — a triumph of celestial mechanics.', fact1: 'Fastest winds in the Solar System: up to 2,100 km/h.', fact2: 'It completed its first observed orbit (165 yr) only in 2011.', fact3: 'Triton orbits backwards — a captured Kuiper Belt object with ice volcanoes.' },
      pluto: { name: 'Pluto', type: 'Dwarf planet (Kuiper Belt)', desc: 'The former ninth planet, reclassified in 2006 — one of the largest members of the Kuiper Belt.', fact0: 'The 2006 IAU definition requires “clearing the neighbourhood” — Pluto shares its zone, so it stepped down.', fact1: 'Its eccentric orbit brought it inside Neptune’s from 1979–1999.', fact2: 'Charon is half Pluto’s size — the pair is mutually tidally locked, dancing like a dumbbell.', fact3: 'New Horizons (2015) photographed the famous heart-shaped nitrogen-ice plain.' },
      ceres: { name: 'Ceres', type: 'Dwarf planet (Main Belt)', desc: 'The first asteroid ever found (1801) and the largest body of the Main Belt.', fact0: 'Planet → asteroid → dwarf planet: a “triple jump” in classification.', fact1: 'Dawn (2015) imaged bright salt deposits in Occator crater — traces of brine from below.', fact2: 'Ceres may hold abundant water ice — a future “fuel stop” for deep space.' },
      eris: { name: 'Eris', type: 'Dwarf planet (Scattered Disc)', desc: 'The 2005 discovery that triggered the planet-definition debate.', fact0: 'Heavier than Pluto, it was called “the tenth planet” — a year later Pluto was reclassified, Eris too.', fact1: 'Named after the Greek goddess of discord — fittingly.', fact2: 'Highly tilted, eccentric orbit: aphelion 97.5 AU; one orbit takes 558 years.' },
      apophis: { name: 'Apophis', type: 'Near-Earth asteroid', desc: 'The most famous near-Earth asteroid: on 13 Apr 2029 it will pass ~31,000 km above Earth — below satellite orbits, visible to the naked eye.', fact0: 'In 2004 it briefly held the highest Torino impact probability (~2.7%); later observations ruled out 2029, 2036 and 2068.', fact1: 'During the 2029 flyby it will brighten from magnitude ~15 to 3 in one night.', fact2: "Earth's tides will visibly spin the asteroid up — a prediction to verify in 2029.", fact3: 'Named after Apep, the Egyptian serpent of chaos that nightly attacks the Sun.' },
      moon: { name: 'Moon', type: "Earth's natural satellite", desc: 'Tidally locked — the same face always points at Earth.', fact0: 'Rotation = orbit (27.3 days): the far side is never seen from Earth.', fact1: 'It recedes 3.8 cm per year — dinosaurs saw a bigger Moon.', fact2: 'The only world humans have walked on: 12 moonwalkers so far.' },
      io: { name: 'Io', type: 'Galilean moon', desc: 'The most volcanic body in the Solar System, kneaded by Jupiter’s tides.', fact0: '400+ active volcanoes; sulfur paints its pizza-like surface.', fact1: 'Tidal heating keeps its interior molten — tides at their most powerful.' },
      europa: { name: 'Europa', type: 'Galilean moon', desc: 'An ice shell hiding an ocean that may hold more water than all of Earth’s.', fact0: 'Brown cracks mark breaks in the ice where salty water rose.', fact1: 'A prime target in the search for life — Europa Clipper is on its way.' },
      ganymede: { name: 'Ganymede', type: 'Galilean moon', desc: 'The largest moon in the Solar System — bigger than Mercury, with its own magnetic field.', fact0: 'Galileo spotted it in 1610 — our first sight of worlds beyond Earth.', fact1: 'Its subsurface ocean may hold more water than Earth’s.' },
      callisto: { name: 'Callisto', type: 'Galilean moon', desc: 'The most heavily cratered body known — a 4-billion-year-old face.', fact0: 'Almost unchanged for 4 Gyr — an archive of the early bombardment.', fact1: 'Outside Jupiter’s radiation belts — a candidate base site.' },
      titan: { name: 'Titan', type: "Saturn's largest moon", desc: 'The only moon with a thick atmosphere, where methane rains into rivers and seas.', fact0: 'Huygens landed here in 2005 — the most distant soft landing ever.', fact1: 'In the deep cold, methane plays water’s role: clouds, rain, rivers, seas.' },
      halley: { name: "Halley's Comet", type: 'Short-period comet', desc: 'The first comet whose return was predicted — visiting every ~76 years, next in 2061.', fact0: 'In 1705 Halley matched the comets of 1531/1607/1682 and predicted a 1758 return — it came, 16 years after his death.', fact1: 'The tail always points away from the Sun — pushed by solar wind and light pressure.', fact2: 'In 1986 Giotto photographed its peanut-shaped, pitch-black nucleus: 15 × 8 km.', fact3: 'The Eta Aquariids (May) and Orionids (October) meteor showers are Halley dust.' },
      voyager1: { name: 'Voyager 1', desc: 'The farthest human-made object, launched 1977 — flung to interstellar space by Jupiter and Saturn.', fact0: 'It carries the Golden Record: 55 languages and 90 minutes of music, a message to the stars.', fact1: 'Silent for months in 2023, it was fixed remotely using 47-year-old manuals.', fact2: 'In ~40,000 years it will drift past a star in Camelopardalis.' },
      voyager2: { name: 'Voyager 2', desc: 'The only spacecraft to visit all four giant planets.', fact0: 'It revealed 10 new moons of Uranus (1986) and Neptune’s Great Dark Spot (1989).', fact1: 'Its tilted path carried it below the ecliptic — leaving the system “sideways”.', fact2: 'Both Voyagers’ plutonium batteries fade ~4 W per year; silence expected in the 2030s.' },
      pioneer10: { name: 'Pioneer 10', desc: 'First through the asteroid belt, first to Jupiter — a true pioneer.', fact0: 'Its gold-anodized plaque — nude figures, the Solar System, the hydrogen line — was the original message in a bottle.', fact1: 'It survived the asteroid belt that some feared would destroy it.', fact2: 'The tiny “Pioneer anomaly” in its drift was later explained by uneven heat radiation.' },
      newhorizons: { name: 'New Horizons', desc: 'Built for Pluto — the fastest spacecraft at launch.', fact0: 'A Jupiter gravity assist cut the trip to 9.5 years.', fact1: 'The heart photo took 4.5 hours to reach Earth across 4.9 billion km.', fact2: 'Arrokoth (2019) is the most primitive body ever visited — two soft-merged planetesimals.' },
      encke: { name: 'Comet Encke', desc: 'The shortest-period comet known — back every 3.3 years, 70+ returns since 1786.', fact0: 'Its orbit never reaches beyond Jupiter’s — it boils furiously, the fastest-evolving comet known.', fact1: 'The Taurid meteor shower (Oct–Nov) is its dust — famous for brilliant fireballs.', fact2: 'In 1819 Encke computed its orbit — the second comet ever predicted to return, after Halley’s.' },
      c67p: { name: 'Comet 67P', desc: 'The only comet ever orbited AND landed on — Rosetta kept it company for two years (2014).', fact0: 'It looks like a rubber duck: two bodies gently stuck together in a slow collision.', fact1: 'The Philae lander bounced three times and wedged in a cliff — 57 working hours, still historic.', fact2: 'Rosetta found its water’s deuterium differs from Earth’s — weakening the “comets filled our oceans” idea.' },
      halebopp: { name: 'Comet Hale-Bopp', desc: 'The Great Comet of 1997 — naked-eye for a record 18 months, orbit nearly perpendicular to the ecliptic.', fact0: 'A ~60 km nucleus, 4× Halley’s — twin tails spanning half the sky in 1997.', fact1: 'Inclination 89.4°: it dove in almost from “above” the Solar System.', fact2: 'Last visit ~4,200 years ago; Jupiter’s nudge sets the next return near AD 4530.' },
      vesta: { name: 'Vesta', desc: 'The Main Belt’s second-heaviest body — the only asteroid visible to the naked eye (at its best).', fact0: 'A protoplanet: it differentiated crust, mantle and iron core — a planet embryo that stalled 4.5 Gyr ago.', fact1: 'A 500 km crater at its south pole blasted HED meteorites to Earth — you can touch Vesta in museums.', fact2: 'Dawn orbited it for a year (2011); it spins in just 5.3 hours.' },
      pallas: { name: 'Pallas', desc: 'The Main Belt’s third-heaviest — infamous for its wildly tilted orbit.', fact0: 'Inclination 34.8°: it caroms through the belt on a steeply slanted path.', fact1: 'Its surface is charcoal-dark (carbonaceous) — the opposite of bright Vesta.', fact2: 'Discovered 1802, the second asteroid ever; its axis is tipped ~84° — it rolls like Uranus.' }
    },
    funFacts: [
      '💡 Sunlight takes 8 min 20 s to reach Earth — you always see the Sun as it was 8 minutes ago.',
      '🪐 Saturn is less dense than water — it would float in a big enough ocean.',
      '🌡️ The hottest planet is Venus, not Mercury — greenhouse effect at work.',
      '🌀 Jupiter’s Great Red Spot is a storm raging for 350+ years.',
      '🧊 Uranus rolls on its side (98°) — 42-year polar days and nights.',
      '📐 Kepler III: T² ∝ a³ — outer planets orbit ever slower.',
      '🌍 Earth is closest to the Sun in January — seasons come from tilt.',
      '☄️ The asteroid belt between Mars and Jupiter holds only ~4% of the Moon’s mass.',
      '🌙 The Moon recedes 3.8 cm per year; tides slowly weaken.',
      '⏱️ Neptune takes 165 years per orbit — one lap since discovery (1846) completed in 2011.',
      '🔥 The Sun burns 600 million tons of hydrogen per second — middle-aged at 4.6 Gyr.',
      '🌊 71% of Earth is ocean — the only known stable surface ocean.',
      '🚀 Voyager 1 is the farthest human object — already in interstellar space.',
      '🌕 The Moon is tidally locked — one face forever toward Earth.',
      '☀️ The Sun holds 99.86% of the Solar System’s mass.',
      '☄️ Halley returns in 2061 — children today will see it.',
      '🏛️ Two Trojan swarms share Jupiter’s orbit, 60° ahead and behind.',
      '❄️ The Kuiper Belt (30–50 AU) holds tens of thousands of icy worlds.',
      '🌋 Io is the most volcanic body — squeezed by Jupiter’s tides.',
      '💧 Europa’s hidden ocean may out-water all of Earth’s.'
    ],
    help: [
      ['🖱️ Left-drag', 'Orbit the view'],
      ['🖲️ Wheel', 'Zoom'],
      ['✋ Right-drag', 'Pan'],
      ['👆 Click a body', 'Open its fact card'],
      ['🎯 Double-click / "Follow"', 'Lock the camera onto it'],
      ['⌨️ Space', 'Pause / resume time'],
      ['⌨️ Esc', 'Deselect; again to reset view'],
      ['⌨️ ← / →', 'Time −1 / +1 day (Shift: 30)'],
      ['🌌 Background', 'Cycle cosmic background colors'],
      ['🛰️ Probes', 'Show Voyager 1/2, Pioneer 10, New Horizons trails — scrub the date to replay history'],
      ['🌟 Star Life', 'Watch the Sun’s full life story'],
      ['🔭 Transit', 'Learn how exoplanets are detected'],
      ['👁️ Tonight’s Sky', 'Real-elongation forecast: which planets are visible and where'],
      ['☄️ Comet family', 'Encke, 67P and Hale-Bopp included — set the date to each perihelion to grow the tails'],
      ['🎮 Gamepad', 'Left stick orbit · right stick zoom · A follow · B deselect · Start pause'],
      ['⏱ Auto-play', 'In a tour, ⏱ advances automatically when the narration ends (or every 8 s)']
    ],
    science: {
      kepler: [
        { icon: '🛰️', title: 'I · The Law of Orbits', text: 'Planets move on ellipses with the Sun at one focus — not the centre. Watch Mercury: with e = 0.206, the off-centre Sun is easiest to see.' },
        { icon: '🌪️', title: 'II · The Law of Areas', text: 'The Sun–planet line sweeps equal areas in equal times, so planets sprint at perihelion and coast at aphelion. Follow Mercury (46 vs 70 million km) to see the sprint.' },
        { icon: '⚖️', title: 'III · The Harmonic Law', text: 'T² ∝ a³: the farther out, the slower the year — Mercury 88 days, Earth 1 year, Neptune 165 years. That is exactly the speed pattern in this demo.' }
      ],
      tips: [
        ['What is an AU?', '1 AU = the mean Earth–Sun distance ≈ 149.6 million km — the “metre stick” of the Solar System; light crosses it in 8 min 20 s.'],
        ['Why do planets shine?', 'Planets make no light of their own — we see reflected sunlight, which is why they show phases.'],
        ['Why do orbits lie in one plane?', 'The Sun formed inside a spinning, collapsing cloud. Rotation flattened it into a protoplanetary disc, so planets share a plane and direction.'],
        ['Why didn’t the asteroid belt form a planet?', 'Jupiter’s gravity keeps stirring those rocks, preventing them from assembling into a planet.'],
        ['How are sizes handled here?', 'At true scale against these distances, Earth would be a grain of sand. Planet sizes are exaggerated so you can see them — check the Sizes panel for true ratios.']
      ]
    },
    tours: {
      overview: {
        title: 'Solar System Grand Tour', desc: 'A 5-minute flight across the Solar System',
        badge: '🧭 Navigator',
        steps: [
          { t: 'Welcome aboard', text: 'This is a Solar System simulator driven by real NASA orbital data — planet positions are truly computed. Let me fly you across.' },
          { t: 'The centre of it all: the Sun', text: 'The Sun alone holds 99.86% of the system’s mass, fusing 600 million tons of hydrogen per second for 4.6 billion years.', },
          { t: 'The rocky inner ring', text: 'Mercury, Venus, Earth, Mars — four rocky worlds huddled close to the Sun. Notice how fast they run!' },
          { t: 'Realm of the giants', text: 'Past the asteroid belt lie the gas and ice giants. Jupiter alone outweighs the other seven planets 2.5 times.' },
          { t: 'The frozen frontier', text: 'Beyond Neptune: the Kuiper Belt and dwarf planet Pluto. The Solar System is far more than eight planets — on to the next lesson!' }
        ],
        quiz: [
          { q: 'Roughly how much of the Solar System’s mass is the Sun?', options: ['99.86%', '75%', '50%'], answer: 0, explain: 'Everything else combined is just 0.14%.' },
          { q: 'The asteroid belt lies between…', options: ['Earth and Mars', 'Mars and Jupiter', 'Jupiter and Saturn'], answer: 1, explain: 'Jupiter’s stirring keeps those rocks from forming a planet.' }
        ]
      },
      kepler: {
        title: "Kepler's Three Laws", desc: 'Understand planetary motion with Mercury',
        badge: "📐 Kepler's Apprentice",
        steps: [
          { t: 'I · Elliptical orbits', text: 'Look at Mercury’s path (white line) — an ellipse with the Sun at a focus, not the centre. e = 0.206, the most eccentric of the eight.' },
          { t: 'II · The law of areas', text: 'Over the next 44 days watch Mercury sprint near perihelion and coast at aphelion — equal areas in equal times.' },
          { t: 'III · The harmonic law', text: 'Now zoom out: the farther, the slower (T² ∝ a³). Mercury laps in 88 days; Neptune needs 165 years.' },
          { t: 'Insight from raw data', text: 'Kepler had no photographs — only Tycho’s naked-eye numbers. Take the quiz!' }
        ],
        quiz: [
          { q: 'A planet moves fastest…', options: ['at perihelion', 'at aphelion', 'at constant speed'], answer: 0, explain: 'Law of areas: closer means faster.' },
          { q: "By Kepler III, Neptune's year is about…", options: ['1 year', '12 years', '165 years'], answer: 2, explain: '30× the distance → 30^1.5 ≈ 165 years.' }
        ]
      },
      mercury: {
        title: 'Mercury: Fire and Ice', desc: 'The most extreme temperature swing',
        badge: '☿ Mercury Explorer',
        steps: [
          { t: 'Closest and most extreme', text: 'Nearest to the Sun yet no blanket of air: 427 ℃ by day, −173 ℃ by night — a 600 ℃ swing, the record.', },
          { t: 'A day longer than a year', text: 'It spins 3 times for every 2 orbits. One sunrise-to-sunrise day lasts 176 Earth days.' },
          { t: 'A battered face', text: 'No air means craters stay for 4 billion years — a black-box recorder of the early Solar System.' }
        ],
        quiz: [
          { q: 'Why does Mercury swing so wildly in temperature?', options: ['Too close to the Sun', 'Almost no atmosphere', 'It spins too fast'], answer: 1, explain: 'Atmosphere is a blanket — without one, heat escapes instantly.' },
          { q: 'One solar day on Mercury lasts…', options: ['88 days', '176 Earth days', '24 hours'], answer: 1, explain: 'A 3:2 spin–orbit resonance makes the solar day twice the year.' }
        ]
      },
      seasons: {
        title: 'The Truth about Seasons', desc: 'Seasons are not about distance',
        badge: '🌍 Season Keeper',
        steps: [
          { t: 'A tilted Earth', text: 'Earth’s axis tips 23.44° — that tilt, not distance, makes the seasons.', },
          { t: 'June solstice', text: 'Around 21 June the north pole leans sunward: longest days, most direct light — northern summer.' },
          { t: 'December solstice', text: 'On 21 December the north pole turns away — winter up north, summer down south.' },
          { t: 'The counter-intuitive bit', text: 'Earth is closest to the Sun in early January! Seasons follow tilt, not distance.' }
        ],
        quiz: [
          { q: 'Seasons are mainly caused by…', options: ['Changing Earth–Sun distance', 'The 23.44° axial tilt', 'The Sun’s brightness'], answer: 1, explain: 'Tilt sets how direct the sunlight is and how long the day lasts.' },
          { q: 'Earth is closest to the Sun in…', options: ['early January', 'early July', 'no pattern'], answer: 0, explain: 'Northern winter happens at closest approach.' }
        ]
      },
      jupiter: {
        title: 'Jupiter: Gravitational Bodyguard', desc: 'Giants, the Red Spot and Trojans',
        badge: '🪐 Jupiter Watcher',
        steps: [
          { t: 'King of planets', text: '318 Earth-masses — 1.5× all other planets combined. It spins in 10 hours, the fastest.' },
          { t: 'The Great Red Spot', text: 'That southern oval: a storm at least 350 years old, once wide enough to swallow Earth.' },
          { t: 'The Trojan escorts', text: 'Zoom out: two swarms share Jupiter’s orbit 60° ahead and behind — the stable Lagrange points L4/L5.' },
          { t: 'A mini solar system', text: 'Close in: four Galilean moons orbit as Kepler III dictates. Io laps in just 1.77 days!' }
        ],
        quiz: [
          { q: 'The Great Red Spot is…', options: ['a giant storm', 'a volcano', 'a red desert'], answer: 0, explain: 'An anticyclone that has raged for centuries.' },
          { q: 'Trojan asteroids sit at…', options: ['60° ahead and behind (L4/L5)', 'directly ahead', 'directly behind'], answer: 0, explain: 'L4/L5 are gravitational stable points.' }
        ]
      },
      halley: {
        title: 'Chasing Halley', desc: 'Revisit 1986, book 2061',
        badge: '☄️ Comet Hunter',
        steps: [
          { t: 'Depart for 1985', text: 'Back to late 1985: Halley is diving sunward. Let’s catch up.' },
          { t: 'The tail grows', text: 'Over 60 days it nears the Sun; ice sublimates and the solar wind blows the tail — always pointing away from the Sun!' },
          { t: 'Perihelion!', text: '9 Feb 1986: just 0.586 AU from the Sun, tail at full glory. In May Earth even sailed through the tail.' },
          { t: 'Farewell performance', text: 'Leaving the inner system, the tail fades and the comet sleeps its way back to the deep.' },
          { t: 'See you in 2061', text: 'It returns in mid-2061 — go look at that tail for me. Badge earned!' }
        ],
        quiz: [
          { q: 'A comet’s tail always points…', options: ['away from the Sun', 'toward the Sun', 'back along its orbit'], answer: 0, explain: 'Solar wind and light pressure push the material outward.' },
          { q: "Halley's next return is…", options: ['2061', '2035', '2130'], answer: 0, explain: 'Period ~76 years; last seen 1986.' }
        ]
      },
      pluto: {
        title: 'Pluto & the Kuiper Belt', desc: 'From planet nine to dwarf planet',
        badge: '🏔️ Frontier Pioneer',
        steps: [
          { t: 'Switch to true scale', text: 'First, true distances — feel how vast it is. We are heading 40 AU out.' },
          { t: 'The former ninth planet', text: 'Found in 1930, a “planet” for 76 years — but small, with a tilted eccentric orbit and crowded neighbourhood.' },
          { t: '2006: why demoted', text: 'The IAU requires a planet to clear its orbital neighbourhood. Pluto, deep in the Kuiper Belt, did not — hence dwarf planet.' },
          { t: 'The icy belt', text: 'Tens of thousands of frozen worlds, 30–50 AU out; many short-period comets hail from here. Ceres, Eris and Pluto are all dwarfs.' }
        ],
        quiz: [
          { q: 'Pluto was demoted mainly because…', options: ['it is too small', 'it has not cleared its orbital zone', 'it is too far'], answer: 1, explain: 'One of the three planet criteria is clearing the neighbourhood.' },
          { q: 'The Kuiper Belt lies at about…', options: ['2–4 AU', '8–12 AU', '30–50 AU'], answer: 2, explain: 'The icy realm beyond Neptune.' }
        ]
      }
    },
    starlife: {
      nebula: { name: '🌫️ Molecular Cloud', age: 'age 0', desc: 'It begins with a cold cloud of hydrogen and helium drifting between the stars. A nearby supernova gives it a gentle push, a knot collapses — the seed of the Solar System.', detail: 'Instability makes the core shrink faster and faster, spinning up as it falls.' },
      protostar: { name: '🌀 Protostar', age: '~100,000 yr', desc: 'The collapsing core lights up as a protostar — glowing by contraction, not yet a true star. In the disc around it, dust grains are quietly sticking together into planet embryos.', detail: 'Nearby ice and inner rock are deciding the fates of the future eight planets.' },
      main: { name: '☀️ Main Sequence (today’s Sun)', age: '4.6 Gyr · mid-life', desc: 'The core hits 15 million ℃ and hydrogen fusion ignites! Radiation pressure and gravity strike a balance that lasts 10 billion years — we live in that golden middle.', detail: 'Every second 600 million tons of hydrogen become helium, 4 million tons shining on Earth.' },
      giant: { name: '🔴 Red Giant', age: '~10.8 Gyr', desc: 'Core hydrogen runs out; the Sun swells 200× into a red giant. Mercury and Venus are engulfed; Earth’s surface turns to lava as the core starts burning helium.', detail: 'By then Earth must retreat past Mars’ orbit to survive the heat.' },
      nebula2: { name: '💠 Planetary Nebula', age: '~12 Gyr', desc: 'Pulsations and winds blow the outer layers away as a glowing shell. The name is a historical mistake — 18th-century telescopes made them look like planets.', detail: 'The ejected gas joins the interstellar medium — raw material for the next generation of stars.' },
      dwarf: { name: '⚪ White Dwarf', age: 'the long sleep', desc: 'All that remains: an Earth-sized ember with nuclear-bomb density, cooling for billions of years toward a black dwarf. No supernova — the Sun exits gently.', detail: 'At 8+ solar masses a star explodes; the Sun is far too light. This is the likeliest ending.' },
      auto: '⏸ Pause', autoOff: '▶ Auto play', prev: '⏮ Prev', next: 'Next ⏭',
      giantNote: 'Mercury and Venus engulfed · Earth’s surface molten', mainNote: 'Hydrogen fusion · 10 billion stable years',
      dwarfNote: 'An Earth-sized ember · cooling for eons', shellNote: 'The expanding shell — seed of future stars'
    },
    tools: {
      compareTitle: '⚖️ Planet Compare', transitTitle: '🔭 Transit Method Lab', meteorsTitle: '☄️ Meteor Shower Sandbox',
      eclipseTitle: '🌑 Eclipse Sandbox',
      phaseCaption: '🌓 {name} from Earth · illuminated {pct}%',
      phaseGalileo: ' · Galileo used exactly this to prove Venus orbits the Sun!',
      phasePick: 'Phase view · select a body (not Earth) first',
      eclNew: '🌑 New Moon · aligned — solar eclipse! (Moon’s shadow on Earth)',
      eclFull: '🌕 Full Moon · Earth between — lunar eclipse possible',
      eclWax: '🌒 Crescent — Moon near the Sun’s side', eclGib: '🌗 Gibbous — Moon on the far side',
      eclHint: '👆 Drag the Moon to change phase · or ▶ auto-run (one synodic month = 29.53 d)',
      eclSimp: 'Simplified model: real eclipses also need the Moon near a node of its tilted orbit',
      eclUpcoming: '📅 Upcoming solar eclipses', eclPlay: '▶ Auto run', eclPause: '⏸ Pause',
      cmpDia: 'Diameter (km)', cmpMass: 'Mass (Earth=1)', cmpDist: 'Mean dist. (AU)',
      cmpPeriod: 'Orbital period', cmpSpin: 'Rotation (hours)', cmpNA: 'n/a',
      cmpLog: 'bars are logarithmic — each step ×10 (order of magnitude only)'
    },
    sys: { trappist1: 'TRAPPIST-1 System', proxima: 'Proxima Centauri System', kepler452: 'Kepler-452 System' },
    cal: {
      title: '📅 Astro Calendar', sub: '30+ key events 2020–2061 — click to jump the simulation there',
      none: 'No events recorded for this year — try another', search: 'Filter by year…'
    },
    moon: {
      title: '🌙 Moon Telescope', sub: 'The real phase at the simulated moment — drag the date to full moon',
      geo: 'Why: the Sun always lights the half facing it', earth: 'Earth',
      age: 'Moon age ', days: ' d', elong: 'Elongation ',
      law: 'Phases come from the Moon orbiting Earth — we see varying amounts of its lit half',
      sync: '📅 Drag the date to watch a full 29.5-day phase cycle',
      lock: 'The Moon always shows us the same face — the inset is a north-ecliptic-pole view',
      note: 'Moon phase here follows the simulator’s 27.3-day orbit; it may not match the real-world lunar calendar date'
    },
    qd: { title: '🎲 Daily Question', sub: 'One random question from the whole pool — ⭐ points stack up', next: 'Next ▶' },
    tl: { hint: 'Drag to travel ±100 years · dots are calendar events' }
  };

  /* ---------- 静态文本（按元素 id；缓存中文原文以支持往返切换） ---------- */
  const ZH_STATIC = {};
  const STATIC = {
    'brand-h': EN.ui.brand, 'brand-p': EN.ui.brandSub,
    'btn-tours': EN.ui.tours, 'btn-badges': EN.ui.badges, 'btn-starlife': EN.ui.starlife,
    'btn-compare': EN.ui.compare, 'btn-eclipse': EN.ui.eclipse, 'btn-size': EN.ui.size,
    'btn-science': EN.ui.science, 'btn-help': EN.ui.help, 'btn-transit': EN.ui.transit, 'btn-meteors': EN.ui.meteors,
    'btn-sky': EN.ui.sky, 'btn-cal': EN.ui.cal, 'btn-quiz': EN.ui.quiz, 'btn-const': EN.ui.constLbl,
    'btn-today': EN.ui.today, 'lbl-speed': EN.ui.speed,
    'tg-orbits-lbl': EN.ui.orbits, 'tg-labels-lbl': EN.ui.labels, 'tg-belt-lbl': EN.ui.belts,
    'tg-bloom-lbl': EN.ui.bloom, 'tg-realtex-lbl': EN.ui.realtex,
    'btn-phase': EN.ui.phase, 'btn-project': EN.ui.project, 'btn-share': EN.ui.share,
    'date-hint': EN.ui.hint, 'loading-text': EN.ui.loading, 'loading-sub': EN.ui.sub2 || EN.ui.loadingSub,
    /* 模态标题与副标题 */
    'size-h': '📐 True Size Compare', 'size-sub': 'All bodies drawn at one linear scale (the Sun barely fits)',
    'science-h': '📖 Science Corner',
    'help-h': '❓ Help',
    'tours-h': '🎓 Guided Tours', 'tours-sub': 'Fly with a guide: auto camera · live demos · quizzes · collect badges',
    'badges-h': '🏆 My Badges', 'badges-sub': 'Score ≥70% on a lesson quiz to light up its badge',
    'compare-h': '⚖️ Planet Compare',
    'eclipse-h': '🌑 Eclipse Sandbox',
    'starlife-h': '🌟 Life of the Sun', 'starlife-sub': 'From a molecular cloud to an eternal white dwarf — a 12-billion-year story',
    'transit-h': '🔭 Transit Method Lab', 'transit-sub': 'How exoplanets are found: a planet crossing its star dims the light — Kepler caught ~0.1% dips and found 2600+ worlds',
    'meteors-h': '☄️ Meteor Shower Sandbox', 'meteors-sub': 'Meteor showers happen when Earth crosses a comet’s dust trail — that’s why they return on the same dates every year',
    'sky-h': EN.sky.title, 'sky-sub': EN.sky.sub,
    'btn-eclipse-play': EN.tools ? '▶ Auto run' : '▶ 自动运行',
    'cal-h': EN.cal.title, 'cal-sub': EN.cal.sub, 'cal-search': EN.cal.search,
    'moon-h': EN.moon.title, 'moon-sub': EN.moon.sub,
    'quiz-h': EN.qd.title, 'quiz-sub': EN.qd.sub,
    'tl-hint': EN.tl.hint
  };

  /* ---------- API ---------- */
  /* ---------- 第三语言注册骨架（D3） ----------
   * 用法：I18N.register('ja', { 'ui.today': '今日', 'sky.title': '今夜の空', ... })
   * 注册后 setLang('ja') 即可生效；未命中的键回退中文。 */
  const EXTRA_LANGS = {};
  function register(code, flatDict) { EXTRA_LANGS[code] = flatDict || {}; }

  function t(path) {
    if (lang === 'zh') return null;
    const ext = EXTRA_LANGS[lang];
    if (ext && ext[path] != null) return ext[path];
    if (lang === 'en') {
      const parts = path.split('.');
      let v = EN;
      for (let i = 0; i < parts.length; i++) {
        if (v == null) return null;
        v = v[parts[i]];
      }
      return typeof v === 'string' ? v : null;
    }
    return null;
  }
  function bodyField(key, field, fallback) {
    if (lang !== 'en') return fallback;
    const c = EN.cards[key];
    if (!c) return fallback;
    if (field === 'fact' + 0 || /^fact\d+$/.test(field)) return c[field] != null ? c[field] : fallback;
    return c[field] != null ? c[field] : fallback;
  }
  function funFacts() { return lang === 'en' ? EN.funFacts : FUN_FACTS; }
  function helpItems() { return lang === 'en' ? EN.help : HELP_ITEMS; }
  function scienceKepler(i) {
    const k = SCIENCE.kepler[i];
    return lang === 'en' ? EN.science.kepler[i] : k;
  }
  function scienceTip(i) { return lang === 'en' ? EN.science.tips[i] : SCIENCE.tips[i]; }
  function tourOverlay(id) { return lang === 'en' ? EN.tours[id] : null; }
  function badgeName(id, fb) {
    if (lang !== 'en') return fb;
    return EN.badges[id] || fb;
  }
  function starlifeStage(key) { return lang === 'en' ? EN.starlife[key] : null; }
  function applyStatic() {
    Object.keys(STATIC).forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (lang === 'en') {
        const v = STATIC[id];
        if (!v) return; // 无英文条目：保留现状
        if (el.tagName === 'INPUT') el.placeholder = v;
        else el.textContent = v;
      } else if (ZH_STATIC[id] !== undefined) {
        // 切回中文：恢复缓存的原文
        if (el.tagName === 'INPUT') el.placeholder = ZH_STATIC[id];
        else el.textContent = ZH_STATIC[id];
      }
    });
  }
  /* 采集静态元素初始中文（必须在任何 applyStatic 之前、DOM 就绪时执行） */
  (function cacheZh() {
    Object.keys(STATIC).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) ZH_STATIC[id] = el.tagName === 'INPUT' ? el.placeholder : el.textContent;
    });
  })();
  function setLang(l, silent) {
    lang = l === 'en' || EXTRA_LANGS[l] ? l : 'zh';
    try { localStorage.setItem('solar_lang', lang); } catch (e) { }
    applyStatic();
    const btn = document.getElementById('btn-lang');
    if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中/' + lang.toUpperCase();
    if (!silent) window.dispatchEvent(new Event('solar-lang'));
  }

  return {
    get lang() { return lang; },
    t: t,
    register: register,
    bodyField: bodyField,
    funFacts: funFacts,
    helpItems: helpItems,
    scienceKepler: scienceKepler,
    scienceTip: scienceTip,
    tourOverlay: tourOverlay,
    badgeName: badgeName,
    starlifeStage: starlifeStage,
    toolText: function (path, fb) { return t(path) || fb; },
    setLang: setLang
  };
})();

/* 语言按钮绑定 */
(function () {
  const btn = document.getElementById('btn-lang');
  if (!btn) return;
  btn.textContent = I18N.lang === 'en' ? '中' : 'EN';
  btn.addEventListener('click', function () {
    I18N.setLang(I18N.lang === 'en' ? 'zh' : 'en');
  });
  if (I18N.lang === 'en') I18N.setLang('en', true);
})();
