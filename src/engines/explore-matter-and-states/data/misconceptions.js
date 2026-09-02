// Visual misconception checks (section 22). `visual` tells MisconceptionCard
// which built-in illustration mode to render before the reveal.
export const MISCONCEPTIONS = [
  {
    id: "solid-stationary",
    visual: "solid-frozen",
    prompt: "These solid particles are shown completely stationary. Correct?",
    verdict: "no",
    reveal: "NO \u2014 particles vibrate about fixed positions; they are never motionless.",
  },
  {
    id: "gas-shrinks",
    visual: "gas-shrunk-particles",
    prompt: "This compressed gas is shown with smaller particles. Correct?",
    verdict: "no",
    reveal: "NO \u2014 the spacing between particles decreases. Particle size does not change.",
  },
  {
    id: "liquid-far-apart",
    visual: "liquid-spread",
    prompt: "These liquid particles are shown very far apart, like a gas. Correct?",
    verdict: "no",
    reveal: "NO \u2014 liquid particles remain relatively close together.",
  },
  {
    id: "gas-identical-speed",
    visual: "gas-uniform-speed",
    prompt: "Every gas particle here moves at an identical speed. Correct?",
    verdict: "oversimplified",
    reveal: "OVERSIMPLIFIED \u2014 real gas particles have a distribution of speeds.",
  },
  {
    id: "bonds-as-sticks",
    visual: "solid-bonds",
    prompt: "Intermolecular attractions are shown here as permanent rigid sticks. Correct?",
    verdict: "no",
    reveal: "NO \u2014 intermolecular attractions should not be represented as chemical bonds.",
  },
];
