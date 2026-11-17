// Method descriptions and the set-up (assembly) steps for each apparatus. Pure data.
//
// A set-up step has a prompt, 2-3 options and the id of the correct one. Choosing the right option places that part of the
// apparatus in the scene (scenes draw part k once k+1 steps are done); a wrong option explains the mistake and places nothing.

const s = (id, prompt, options, correct, why) => ({ id, prompt, options: options.map(([oid, label, wrong]) => ({ id: oid, label, wrong: wrong ?? "" })), correct, why });

export const METHODS = [
  {
    id: "dissolve", label: "Dissolve in water", short: "Dissolve", icon: "droplets", group: "prep",
    principle: "Soluble solids dissolve; insoluble ones do not.", controls: ["stir"], particle: "dissolve", needsHeat: false,
    setup: [
      s("beaker", "Choose the vessel.", [["a", "A glass beaker"], ["b", "A closed bottle", "A closed bottle cannot be stirred, and you need to watch what dissolves."]], "a", "A beaker is open, so you can stir and see."),
      s("water", "Add the solvent.", [["a", "About 100 mL of water"], ["b", "A few drops of water", "Too little water: it would be saturated at once and most of the solid could not dissolve."]], "a", "Enough solvent must be added for the soluble solid to dissolve."),
      s("rod", "Help it dissolve.", [["a", "Stir with a glass rod"], ["b", "Leave it alone", "Dissolving still happens but slowly; stirring brings fresh solvent to the solid."]], "a", "Stirring speeds up dissolving."),
    ],
  },
  {
    id: "decanting", label: "Decanting", short: "Decant", icon: "arrow-down-to-line", group: "solid-liquid",
    principle: "A dense solid settles, or a liquid forms a layer, and the top is poured off.", controls: ["pour", "tilt"], particle: "sieve", needsHeat: false,
    setup: [
      s("settle", "Let the mixture stand.", [["a", "Stand the beaker still so the sand settles"], ["b", "Keep stirring it", "Stirring keeps the grains suspended, so they would pour out with the water."]], "a", "A dense insoluble solid sinks when the liquid is still."),
      s("receiver", "Get a second beaker ready.", [["a", "A clean beaker for the poured liquid"], ["b", "Pour it down the sink", "You would lose the liquid you want to keep."]], "a", "You need somewhere to collect the liquid."),
      s("rod", "Control the pour.", [["a", "Hold a glass rod against the lip to guide the stream"], ["b", "Pour quickly from the lip", "Fast pouring stirs the sediment up and splashes liquid down the outside of the beaker."]], "a", "A rod keeps the stream tidy and slow."),
    ],
  },
  {
    id: "filtration", label: "Filtration", short: "Filter", icon: "filter", group: "solid-liquid",
    principle: "Particles bigger than the pores stay on the paper; smaller ones pass through.", controls: ["pour"], particle: "sieve", needsHeat: false,
    setup: [
      s("beaker", "Put something under the funnel to catch the filtrate.", [["a", "A clean beaker"], ["b", "Nothing, let it drip on the bench", "The filtrate is a product: it has to be collected."], ["c", "A sealed bottle", "A sealed bottle cannot take liquid: the air inside has nowhere to go."]], "a", "The beaker collects the filtrate."),
      s("funnel", "Mount the filter funnel.", [["a", "Funnel held in a ring on a stand, stem touching the beaker wall"], ["b", "Funnel standing on the bench", "The liquid must drip into the beaker, not onto the bench."]], "a", "The stem touches the wall so the filtrate runs down the glass without splashing."),
      s("fold", "Prepare the filter paper.", [["a", "Fold it into a cone and open it into the funnel"], ["b", "Lay it flat across the funnel", "A flat sheet would sag and tear, and the liquid would run round the edge."], ["c", "Crumple it into the stem", "That would block the stem and filter very slowly."]], "a", "A folded cone gives a large filtering area that fits the funnel."),
      s("wet", "Seat the paper.", [["a", "Wet it with a little solvent so it clings to the funnel"], ["b", "Leave it dry", "Dry paper slips and leaves a gap where unfiltered mixture could run down."]], "a", "Wetting makes the paper cling to the glass, so nothing bypasses it."),
    ],
  },
  {
    id: "evaporation", label: "Evaporation", short: "Evaporate", icon: "flame", group: "heating",
    principle: "A volatile liquid boils away; a non-volatile solid is left.", controls: ["heat", "stop"], particle: "vapour", needsHeat: true,
    setup: [
      s("burner", "Set up the heat.", [["a", "Bunsen burner on a heat-proof mat"], ["b", "Bunsen burner on the wooden bench", "A hot or accidental flame could scorch the bench: always use a heat-proof mat."]], "a", "The mat protects the bench."),
      s("tripod", "Support the dish above the flame.", [["a", "Tripod with a gauze"], ["b", "Plastic stand", "A plastic stand would melt."]], "a", "The gauze spreads the heat evenly."),
      s("basin", "Choose the container.", [["a", "Evaporating basin (wide and open)"], ["b", "Conical flask closed with a bung", "A sealed flask heated strongly can burst: and the vapour could not escape."], ["c", "Plastic beaker", "Plastic would melt."]], "a", "A wide open basin gives a large surface so the vapour escapes quickly."),
      s("goggles", "Look after yourself.", [["a", "Put on safety goggles"], ["b", "Lean over to watch closely", "Hot liquid can spit: never lean over a heated basin."]], "a", "Goggles protect your eyes from spitting."),
    ],
  },
  {
    id: "crystallisation", label: "Crystallisation", short: "Crystallise", icon: "gem", group: "heating",
    principle: "A hot concentrated solution cools; the solid that no longer fits in the solution forms crystals.", controls: ["heat", "stop", "rod"], particle: "crystal", needsHeat: true,
    setup: [
      s("burner", "Set up the heat.", [["a", "Bunsen burner on a heat-proof mat"], ["b", "Bunsen burner on the wooden bench", "Always protect the bench with a heat-proof mat."]], "a", "The mat protects the bench."),
      s("tripod", "Support the basin.", [["a", "Tripod with a gauze"], ["b", "Hold it in your hand with tongs", "The basin gets far too hot to hold steadily."]], "a", "The gauze spreads the heat."),
      s("basin", "Choose the container.", [["a", "Evaporating basin with the solution"], ["b", "Conical flask closed with a bung", "A sealed flask can burst when heated."]], "a", "A wide open basin lets the water evaporate."),
      s("rod", "How will you know when to stop heating?", [["a", "Keep a glass rod: dip it in, and small crystals form on it when it cools at the crystallisation point"], ["b", "Heat until the basin is completely dry", "Heating to dryness leaves a powder, may spit, and loses the water in hydrated crystals."]], "a", "The rod test shows the solution is saturated: stop there and cool slowly."),
      s("goggles", "Look after yourself.", [["a", "Put on safety goggles"], ["b", "No need for goggles", "Hot solutions spit."]], "a", "Always wear goggles."),
    ],
  },
  {
    id: "simple-distillation", label: "Simple distillation", short: "Simple distil.", icon: "flask-conical", group: "heating",
    principle: "The liquid with the lower boiling point evaporates first and is condensed and collected.", controls: ["heat", "stop", "receiver"], particle: "vapour", needsHeat: true, plates: 1,
    setup: [
      s("burner", "Set up the heat.", [["a", "Bunsen burner on a heat-proof mat, with tripod and gauze"], ["b", "A candle under a clamp", "Far too weak and unstable."]], "a", "A burner on a mat with a gauze heats the flask evenly."),
      s("flask", "Fill the flask.", [["a", "Round-bottomed flask with the mixture and a few anti-bumping granules"], ["b", "Flask filled to the neck, no granules", "It would boil over, and without granules the liquid bumps (boils in sudden bursts)."]], "a", "Granules give small bubbles, so the liquid boils smoothly."),
      s("clamp", "Hold it steady.", [["a", "Clamp the flask by its neck to the retort stand"], ["b", "Balance it on the gauze", "A hot flask could tip over."]], "a", "A clamp keeps the glassware safe."),
      s("head", "Fit the still head and thermometer.", [["a", "Thermometer bulb level with the side-arm opening"], ["b", "Thermometer bulb dipping in the liquid", "It would read the liquid's temperature, not the temperature of the vapour that is condensing."], ["c", "Thermometer held at the top of the condenser", "Too far down the apparatus: the vapour is already cooling."]], "a", "At the side-arm it reads the temperature of the vapour that is about to condense: the boiling point of what is distilling."),
      s("condenser", "Fit the condenser.", [["a", "Liebig condenser: cold water in at the BOTTOM, out at the top"], ["b", "Cold water in at the TOP, out at the bottom", "The jacket would not fill: water would run through the bottom half only and the vapour would not all condense."], ["c", "No water: air-cooled only", "Not enough cooling: much of the vapour would escape."]], "a", "Water enters low and leaves high so the jacket stays full and the coldest water meets the coolest vapour."),
      s("receiver", "Collect the distillate.", [["a", "A flask under the outlet, open to the air"], ["b", "Seal the receiving flask with a bung", "A closed apparatus heated strongly can explode: the system must stay open to the air."]], "a", "The apparatus must never be sealed."),
    ],
  },
  {
    id: "fractional-distillation", label: "Fractional distillation", short: "Fractional distil.", icon: "container", group: "heating",
    principle: "A column repeats evaporation and condensation so that miscible liquids with different boiling points separate into fractions.", controls: ["heat", "stop", "receiver"], particle: "vapour", needsHeat: true, plates: 6,
    setup: [
      s("burner", "Set up the heat.", [["a", "Bunsen burner on a heat-proof mat, with tripod and gauze"], ["b", "A candle under a clamp", "Far too weak and unstable."]], "a", "A burner on a mat with a gauze heats the flask evenly."),
      s("flask", "Fill the flask.", [["a", "Round-bottomed flask with the mixture and anti-bumping granules"], ["b", "Flask filled to the neck, no granules", "It would boil over and bump."]], "a", "Granules give smooth boiling."),
      s("clamp", "Hold it steady.", [["a", "Clamp the flask by its neck to the retort stand"], ["b", "Balance it on the gauze", "A hot flask could tip over."]], "a", "A clamp keeps the glassware safe."),
      s("column", "Fit the fractionating column.", [["a", "A column packed with glass beads, on top of the flask"], ["b", "An empty wide tube", "Without packing the vapour has almost nothing to condense on, so there is almost no extra separation."], ["c", "No column: a condenser is enough", "That is simple distillation: liquids with close boiling points will not separate well."]], "a", "The beads give a large surface where vapour condenses and re-evaporates, many times."),
      s("head", "Fit the still head and thermometer.", [["a", "Thermometer bulb level with the side-arm at the top of the column"], ["b", "Thermometer bulb in the boiling liquid", "It would not tell you what is coming off at the top."]], "a", "At the top of the column it reads the boiling point of the fraction that is distilling."),
      s("condenser", "Fit the condenser.", [["a", "Liebig condenser: water in at the BOTTOM, out at the top"], ["b", "Water in at the TOP, out at the bottom", "The jacket would not fill and the vapour would not condense properly."]], "a", "Water enters low and leaves high."),
      s("receiver", "Collect the fractions.", [["a", "A flask under the outlet, open to the air (you will swap flasks)"], ["b", "Seal the receiving flask with a bung", "A closed system can explode."]], "a", "The apparatus must stay open."),
    ],
  },
  {
    id: "chromatography", label: "Paper chromatography", short: "Chromatography", icon: "rows-3", group: "analysis",
    principle: "Dissolved substances travel up the paper at different speeds, depending on how strongly they stick to the paper and how well they dissolve in the solvent.", controls: ["solvent"], particle: "chroma", needsHeat: false,
    setup: [
      s("baseline", "Draw the starting line.", [["a", "A pencil line 1.5 cm from the bottom"], ["b", "A line in ink pen", "Pen ink is itself a mixture: it would run up the paper with your sample."], ["c", "A pencil line at the very edge", "The spot would be dipped into the solvent and wash away."]], "a", "Pencil is insoluble and does not move."),
      s("spot", "Apply the sample.", [["a", "A small spot on the line, dried, then added to again"], ["b", "A big blob that soaks into the paper", "Big spots smear into each other and the separated spots overlap."]], "a", "Small, concentrated spots give sharp separations."),
      s("solvent", "Pour in the solvent.", [["a", "About 0.8 cm deep: BELOW the baseline"], ["b", "Deep enough to cover the baseline", "The spots would dissolve into the solvent in the beaker and nothing would travel up the paper."]], "a", "The solvent level must be below the baseline."),
      s("hang", "Place the paper.", [["a", "Hang it from a rod so only its bottom edge dips in"], ["b", "Let it lean on the glass", "Touching the glass makes the solvent creep unevenly up the wall."], ["c", "Lay it flat in the solvent", "The solvent would flood everything."]], "a", "A hanging strip lets the solvent rise evenly."),
      s("lid", "Cover the beaker.", [["a", "Put on a lid so the air fills with solvent vapour"], ["b", "Leave it open", "The solvent evaporates from the paper as it rises, which slows the front and makes it uneven."]], "a", "A lid keeps the air saturated with vapour."),
    ],
  },
  {
    id: "magnetic", label: "Magnetic separation", short: "Magnet", icon: "magnet", group: "solid-solid",
    principle: "A magnet pulls out the magnetic component (iron, cobalt, nickel) and leaves the rest.", controls: ["sweep", "finish"], particle: "magnet", needsHeat: false,
    setup: [
      s("tray", "Spread the mixture.", [["a", "Thinly on a clean tray"], ["b", "In a heap", "Iron buried inside the heap would not reach the magnet."]], "a", "A thin layer lets every iron grain meet the magnet."),
      s("bag", "Prepare the magnet.", [["a", "Wrap the magnet in a plastic bag"], ["b", "Use the bare magnet", "Iron filings stick to a bare magnet in a bristly mess that is hard to clean off."]], "a", "You can pull the bag off to drop the iron in a dish."),
      s("dish", "Plan where the iron goes.", [["a", "Put a clean dish ready"], ["b", "Drop the iron back on the tray", "That would re-mix what you just separated."]], "a", "Keep the separated iron apart."),
    ],
  },
  {
    id: "separating-funnel", label: "Separating funnel", short: "Sep. funnel", icon: "funnel", group: "liquid-liquid",
    principle: "Immiscible liquids form layers by density; the lower layer is run off through the tap.", controls: ["tap", "finish"], particle: "layers", needsHeat: false,
    setup: [
      s("clamp", "Mount the funnel with the tap CLOSED.", [["a", "Funnel in a ring on a stand, tap closed"], ["b", "Tap open", "The liquid would run straight out when you pour it in."]], "a", "Always close the tap before pouring."),
      s("beaker", "Put a beaker underneath.", [["a", "A clean beaker under the tap"], ["b", "Nothing", "You would lose the lower layer."]], "a", "The beaker catches the lower layer."),
      s("pour", "Add the mixture and let the layers settle.", [["a", "Fill no more than three-quarters, then let it stand"], ["b", "Fill to the brim, shake hard", "No room to settle and hard shaking makes a stubborn emulsion."]], "a", "Settling gives two clean layers."),
      s("stopper", "Start draining.", [["a", "Remove the stopper, then open the tap slowly"], ["b", "Open the tap with the stopper in", "No air can enter, so the liquid will not flow properly."]], "a", "Air has to enter at the top as liquid leaves at the bottom."),
    ],
  },
  {
    id: "sublimation", label: "Sublimation", short: "Sublimation", icon: "cloud", group: "solid-solid",
    principle: "One solid turns directly into a gas when warmed and turns back to a solid on a cold surface; the other does not.", controls: ["heat", "stop"], particle: "vapour", needsHeat: true,
    setup: [
      s("burner", "Set up gentle heat.", [["a", "Bunsen on a heat-proof mat, tripod and gauze"], ["b", "Heat directly with a roaring flame", "Strong heat melts the iodine and the vapour escapes."]], "a", "Gentle heat only."),
      s("dish", "Put the mixture in a dish.", [["a", "An evaporating dish on the gauze"], ["b", "A sealed flask", "A sealed flask could burst, and you could not collect the sublimate."]], "a", "A dish lets the vapour rise."),
      s("funnel", "Cover the dish.", [["a", "An upside-down filter funnel, stem plugged with cotton wool"], ["b", "A solid lid", "The vapour would condense on the lid and drip back; and a sealed lid is unsafe."]], "a", "The funnel directs the vapour to a cold surface; the plug stops toxic fumes escaping."),
      s("cool", "Keep the funnel cold.", [["a", "Lay a damp cloth (or ice) on the funnel"], ["b", "Leave the funnel as it is", "A warm funnel will not condense the vapour: it escapes."]], "a", "The vapour changes back to solid on a cold surface."),
    ],
  },
];

export const METHOD_BY_ID = Object.fromEntries(METHODS.map((m) => [m.id, m]));
export const getMethod = (id) => METHOD_BY_ID[id] ?? METHODS[0];
export const GROUP_LABEL = { prep: "Preparation", "solid-liquid": "Solid and liquid", heating: "Heating", analysis: "Dissolved dyes", "solid-solid": "Solid and solid", "liquid-liquid": "Liquid and liquid" };

/** Is `optionId` the right answer for step `index` of `methodId`? Returns { ok, why }. */
export function checkSetupChoice(methodId, index, optionId) {
  const step = getMethod(methodId).setup[index];
  if (!step) return { ok: false, why: "That step does not exist." };
  if (optionId === step.correct) return { ok: true, why: step.why };
  const opt = step.options.find((o) => o.id === optionId);
  return { ok: false, why: opt?.wrong || "That is not right for this step." };
}
