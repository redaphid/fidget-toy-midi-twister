/**
 * Animation Functions
 *
 * Each function takes:
 *  - t: Progress through the animation period (0.0 to 1.0)
 *  - o: Time offset within the period (ms) - Currently unused, placeholder
 *  - l: Total length of the animation period (ms)
 * Returns: A modulation factor (0.0 to 1.0)
 */

export type AnimationFunction = (t: number, o: number, l: number) => number

// Simple linear ramp up
const linear: AnimationFunction = (t, _o, _l) => {
  return t
}

// Quadratic easing in and out
const easeInOutQuad: AnimationFunction = (t, _o, _l) => {
  t *= 2
  if (t < 1) return 0.5 * t * t
  t--
  return -0.5 * (t * (t - 2) - 1)
}

// Bounce effect
const bounce: AnimationFunction = (t, _o, _l) => {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t
  } else if (t < 2 / 2.75) {
    t -= 1.5 / 2.75
    return 7.5625 * t * t + 0.75
  } else if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75
    return 7.5625 * t * t + 0.9375
  } else {
    t -= 2.625 / 2.75
    return 7.5625 * t * t + 0.984375
  }
}

// Simple pulse (on/off)
const pulse: AnimationFunction = (t, _o, l) => {
  // Pulse twice during the duration
  const segmentDuration = l / 4
  const currentSegment = Math.floor((t * l) / segmentDuration)
  return currentSegment % 2 === 0 ? 1.0 : 0.0
}

// Sine wave pulse
const sinePulse: AnimationFunction = (t, _o, _l) => {
  // Complete one full sine wave (0 -> 1 -> 0)
  return 0.5 * (1 - Math.cos(t * 2 * Math.PI))
}

// Sawtooth wave (ramp up, instant drop)
const sawtooth: AnimationFunction = (t, _o, _l) => {
  return t
}

// Triangle wave (ramp up, ramp down)
const triangle: AnimationFunction = (t, _o, _l) => {
  return 1 - Math.abs(2 * t - 1)
}

// Array of available animation functions
export const animationFunctions: AnimationFunction[] = [
  linear,
  easeInOutQuad,
  bounce,
  pulse, // Index 3
  sinePulse, // Index 4
  sawtooth, // Index 5
  triangle, // Index 6
  // Add more functions here
]
