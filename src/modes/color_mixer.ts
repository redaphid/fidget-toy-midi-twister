import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"
import { animationFunctions, type AnimationFunction } from "../animations.ts"

// --- Configuration ---
const SELECTOR_KNOBS = [0, 1, 2] as const
const COLOR_SELECTOR_KNOB_R = 0
const COLOR_SELECTOR_KNOB_G = 1
const COLOR_SELECTOR_KNOB_B = 2

const ANIM_SELECTOR_KNOB_EASE = 0 // Knob 0 selects Easing
const ANIM_SELECTOR_KNOB_STRATEGY = 1 // Knob 1 selects Color Transition Strategy
const ANIM_SELECTOR_KNOB_SPEED = 2 // Knob 2 selects Speed/Duration

const TOGGLE_KNOB = 3
const CONTROL_KNOBS = [COLOR_SELECTOR_KNOB_R, COLOR_SELECTOR_KNOB_G, COLOR_SELECTOR_KNOB_B, TOGGLE_KNOB] as const

const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)
const MAX_LED_VALUE = 127
const ANIMATION_INTERVAL = 50 // ms
const DEFAULT_ANIMATION_DURATION = 2000 // ms
const MIN_ANIMATION_DURATION = 500 // ms
const MAX_ANIMATION_DURATION = 10000 // ms
// REMOVED: const ANIMATION_PATTERNS

// Color Transition Strategies
const COLOR_TRANSITION_STRATEGIES = ["originalToMax", "cycleHue"] as const
type ColorTransitionStrategy = (typeof COLOR_TRANSITION_STRATEGIES)[number]

// --- State ---
let redValue = 0
let greenValue = 0
let blueValue = 0
let mixedColorValue = 0 // Always represents the R,G,B state
let isAnimationConfigModeActive = false

// Stores the specific animation config per color value
interface ColorAnimConfig {
  easingIndex: number
  // REMOVED: patternIndex: number;
  strategyIndex: number // NEW
  duration: number
}
const colorAnimationConfig = new Map<number, ColorAnimConfig>()

const knobColors = new Map<number, number>() // Map<knobIndex, appliedColorValue>
// Map<appliedColorValue, animState>
const activeAnimations = new Map<number, { animIndex: number; strategyIndex: number; startTime: number; duration: number /* removed knobOffsets */ }>()
let animationIntervalId: NodeJS.Timeout | number | null = null

// --- Animation Functions ---
// REMOVED - Now in animations.ts

// --- Helper Functions ---
// VERY basic placeholder RGB to a single MIDI value mapping
// A real implementation would involve HSL/HSV conversion and mapping to the Twister's LED ranges
function rgbToMidiColor(r: number, g: number, b: number): number {
  // Average the components and scale?
  // Or prioritize dominant color?
  // Simple average:
  let avg = (r + g + b) / 3
  // Maybe shift hue based on dominant color?
  if (r > g && r > b) avg = (avg + 0) % MAX_LED_VALUE // Bias towards red range
  else if (g > r && g > b) avg = (avg + 42) % MAX_LED_VALUE // Bias towards green range
  else if (b > r && b > g) avg = (avg + 85) % MAX_LED_VALUE // Bias towards blue range

  return Math.floor(avg)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Add HSL helpers (basic placeholders - replace with a proper library if needed)
function midiValueToHSL(value: number): { h: number; s: number; l: number } {
  // VERY basic mapping - assumes MIDI value represents hue directly scaled
  const h = (value / MAX_LED_VALUE) * 360
  const s = 1.0 // Full saturation
  const l = 0.5 // Medium lightness
  return { h, s, l }
}

function hslToMidiValue(h: number, s: number, l: number): number {
  // VERY basic mapping - inverse of above, ignoring s, l for now
  let value = Math.round((h / 360) * MAX_LED_VALUE) % (MAX_LED_VALUE + 1)
  return clamp(value, 0, MAX_LED_VALUE)
}

// --- Mode Definition ---
export class ColorMixerMode implements FidgetModeInterface {
  activate(output: Output): void {
    console.log("🎨 Activating Color Mixer Mode (Sync Anim + Strategies)")
    this.deactivate(output)

    redValue = 0
    greenValue = 0
    blueValue = 0
    mixedColorValue = rgbToMidiColor(0, 0, 0)
    isAnimationConfigModeActive = false
    colorAnimationConfig.clear()
    knobColors.clear()
    activeAnimations.clear()

    clearLeds(output, ALL_KNOBS)
    this.updateSelectorKnobLEDs(output)
    this.updateToggleKnobLED(output)

    console.log("  Knobs 0-2: Color/Anim(Ease,Strategy,Speed) | Knob 3: Toggle | Click 4-15 to apply/animate | Press K0/K2 to Stop Anim")
  }

  deactivate(output: Output): void {
    console.log("🎨 Deactivated Color Mixer mode")
    clearLeds(output, ALL_KNOBS)
    // Reset state explicitly
    redValue = 0
    greenValue = 0
    blueValue = 0
    mixedColorValue = 0
    isAnimationConfigModeActive = false
    colorAnimationConfig.clear()
    knobColors.clear()
    activeAnimations.clear()
    if (animationIntervalId) {
      clearInterval(animationIntervalId as number)
      animationIntervalId = null
    }
  }

  // Helper to get or create default animation config for a color
  private getOrCreateColorAnimConfig(colorKey: number): ColorAnimConfig {
    if (!colorAnimationConfig.has(colorKey)) {
      colorAnimationConfig.set(colorKey, {
        easingIndex: 0,
        strategyIndex: 0, // Default strategy
        duration: DEFAULT_ANIMATION_DURATION,
      })
    }
    return colorAnimationConfig.get(colorKey)!
  }

  // Helper to update LEDs for Selector Knobs (0, 1, 2)
  private updateSelectorKnobLEDs(output: Output): void {
    if (isAnimationConfigModeActive) {
      const config = this.getOrCreateColorAnimConfig(mixedColorValue)
      setLed(output, ANIM_SELECTOR_KNOB_EASE, clamp(Math.floor(MAX_LED_VALUE * (config.easingIndex / animationFunctions.length)), 0, MAX_LED_VALUE))
      setLed(output, ANIM_SELECTOR_KNOB_STRATEGY, clamp(Math.floor(MAX_LED_VALUE * (config.strategyIndex / COLOR_TRANSITION_STRATEGIES.length)), 0, MAX_LED_VALUE))
      const durationProgress = clamp((config.duration - MIN_ANIMATION_DURATION) / (MAX_ANIMATION_DURATION - MIN_ANIMATION_DURATION), 0, 1)
      setLed(output, ANIM_SELECTOR_KNOB_SPEED, clamp(Math.floor(MAX_LED_VALUE * (1 - durationProgress)), 0, MAX_LED_VALUE))
    } else {
      // Show color selectors
      setLed(output, COLOR_SELECTOR_KNOB_R, 4 + Math.floor(redValue / (MAX_LED_VALUE / 10)))
      setLed(output, COLOR_SELECTOR_KNOB_G, 36 + Math.floor(greenValue / (MAX_LED_VALUE / 10)))
      setLed(output, COLOR_SELECTOR_KNOB_B, 70 + Math.floor(blueValue / (MAX_LED_VALUE / 10)))
    }
  }

  // Helper to update the Toggle Knob (3) LED based on mode
  private updateToggleKnobLED(output: Output): void {
    if (isAnimationConfigModeActive) {
      setLed(output, TOGGLE_KNOB, 120) // Config mode indicator (White)
    } else {
      // Don't update if the knob itself is animating (unlikely but possible)
      if (this.isKnobAnimated(TOGGLE_KNOB)) return
      setLed(output, TOGGLE_KNOB, mixedColorValue)
    }
  }

  // Helper to check if a specific knob is currently part of an active animation
  private isKnobAnimated(knob: number): boolean {
    const colorKey = knobColors.get(knob)
    return colorKey !== undefined && activeAnimations.has(colorKey)
  }

  // Stop animation for a specific color group
  private stopAnimationForColor(output: Output, colorKey: number) {
    const anim = activeAnimations.get(colorKey)
    if (!anim) return

    activeAnimations.delete(colorKey)
    // Restore original color LED value to all knobs in the group
    knobColors.forEach((knobColor, knobIndex) => {
      if (knobColor === colorKey) {
        setLed(output, knobIndex, colorKey) // Restore the original sampled color
      }
    })
    console.log(`🎨 Animation stopped for color group ${colorKey}`)
  }

  // Stop animation for a specific knob (and its group)
  private stopAnimationForKnob(output: Output, knob: number) {
    const colorKey = knobColors.get(knob)
    if (colorKey === undefined) return

    this.stopAnimationForColor(output, colorKey)
  }

  // --- Animation Loop Logic ---
  private animationLoop(output: Output): void {
    const now = Date.now()
    let hasActiveAnimations = false

    activeAnimations.forEach((anim, colorKey) => {
      hasActiveAnimations = true
      const strategyName = COLOR_TRANSITION_STRATEGIES[anim.strategyIndex]
      const easeFunc = animationFunctions[anim.animIndex]

      if (!easeFunc) {
        console.warn(`Invalid anim index ${anim.animIndex} for color ${colorKey}`)
        activeAnimations.delete(colorKey)
        return
      }

      // Base time progress (0-1), looping
      const elapsedTime = now - anim.startTime
      const timeWithinLoop = elapsedTime % anim.duration
      const tProgressBase = timeWithinLoop / anim.duration

      // Apply easing function to the time progress
      const easedProgress = easeFunc(tProgressBase, 0, anim.duration)

      // Calculate target color based on strategy
      let targetColorValue = colorKey // Default to original color

      switch (strategyName) {
        case "originalToMax":
          // Interpolate from original color (colorKey) to MAX_LED_VALUE
          targetColorValue = lerp(colorKey, MAX_LED_VALUE, easedProgress)
          break
        case "cycleHue":
          // Get original HSL, cycle Hue based on progress, convert back
          const originalHSL = midiValueToHSL(colorKey)
          // Cycle hue by 360 degrees over the animation duration
          const currentHue = (originalHSL.h + easedProgress * 360) % 360
          targetColorValue = hslToMidiValue(currentHue, originalHSL.s, originalHSL.l)
          break
        // Add more strategies here
      }

      const finalValue = clamp(Math.round(targetColorValue), 0, MAX_LED_VALUE)

      // Update ALL knobs in this color group to the SAME calculated color
      knobColors.forEach((knobColor, knobIndex) => {
        if (knobColor === colorKey) {
          setLed(output, knobIndex, finalValue)
        }
      })
    })

    // Stop interval if no animations are active
    if (!hasActiveAnimations && animationIntervalId) {
      clearInterval(animationIntervalId as number)
      animationIntervalId = null
      console.log("🎨 Animation loop stopped.")
    }
  }

  private startAnimationLoop(output: Output) {
    if (animationIntervalId) return // Already running
    console.log("🎨 Animation loop started.")
    animationIntervalId = setInterval(() => this.animationLoop(output), ANIMATION_INTERVAL)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // --- Config Mode Knob Turns ---
    if (isAnimationConfigModeActive) {
      const config = this.getOrCreateColorAnimConfig(mixedColorValue)

      switch (control) {
        case ANIM_SELECTOR_KNOB_EASE: // Knob 0
          config.easingIndex = value % animationFunctions.length
          const easeName = animationFunctions[config.easingIndex]?.name || `Index ${config.easingIndex}`
          console.log(`🔧 Config (${mixedColorValue}): Set Easing: ${easeName}`)
          // Update active animation immediately if running
          if (activeAnimations.has(mixedColorValue)) {
            activeAnimations.get(mixedColorValue)!.animIndex = config.easingIndex
            // Maybe restart time? activeAnimations.get(mixedColorValue)!.startTime = Date.now();
          }
          break

        case ANIM_SELECTOR_KNOB_STRATEGY: // Knob 1
          config.strategyIndex = value % COLOR_TRANSITION_STRATEGIES.length
          const strategyName = COLOR_TRANSITION_STRATEGIES[config.strategyIndex]
          console.log(`🔧 Config (${mixedColorValue}): Set Strategy: ${strategyName}`)
          // Update active animation immediately
          if (activeAnimations.has(mixedColorValue)) {
            activeAnimations.get(mixedColorValue)!.strategyIndex = config.strategyIndex
            activeAnimations.get(mixedColorValue)!.startTime = Date.now() // Restart time for new strategy
          }
          break

        case ANIM_SELECTOR_KNOB_SPEED: // Knob 2
          const progress = value / MAX_LED_VALUE
          config.duration = clamp(Math.round(lerp(MIN_ANIMATION_DURATION, MAX_ANIMATION_DURATION, progress)), MIN_ANIMATION_DURATION, MAX_ANIMATION_DURATION)
          console.log(`🔧 Config (${mixedColorValue}): Set Duration: ${config.duration}ms`)
          // Update active animation immediately
          if (activeAnimations.has(mixedColorValue)) {
            activeAnimations.get(mixedColorValue)!.duration = config.duration
            // Don't restart time for duration change
          }
          break
        default:
          return true // Ignore other knobs in config mode
      }
      this.updateSelectorKnobLEDs(output) // Update LEDs to reflect change
      return true // Handled config change
    }
    // --- End Config Mode Knob Turns ---

    // --- Normal Mode Knob Turns ---
    let needsDisplayUpdate = false
    switch (control) {
      case COLOR_SELECTOR_KNOB_R:
      case COLOR_SELECTOR_KNOB_G:
      case COLOR_SELECTOR_KNOB_B:
        // Update RGB values
        if (control === COLOR_SELECTOR_KNOB_R) redValue = value
        else if (control === COLOR_SELECTOR_KNOB_G) greenValue = value
        else blueValue = value
        // Update the actual mixed color value used for applying
        mixedColorValue = rgbToMidiColor(redValue, greenValue, blueValue)
        needsDisplayUpdate = true // Need to update LEDs
        break

      default:
        // Handle turning knobs 4-15 with assigned colors (changes group color)
        if (CONTROL_KNOBS.includes(control as any)) return false // Ignore turns on control knobs in normal mode

        const colorKey = knobColors.get(control)
        if (colorKey !== undefined) {
          this.stopAnimationForColor(output, colorKey) // Stop animation first
          const newColor = value // Use raw value for new group color
          console.log(`🎨 Knob ${control} turned. Updating color group ${colorKey} to new color ${newColor}`)
          knobColors.forEach((knobColor, knobIndex) => {
            if (knobColor === colorKey) {
              setLed(output, knobIndex, newColor)
              knobColors.set(knobIndex, newColor) // Update map to new color group
            }
          })
          // A new color group was created, remove any old animation state
          activeAnimations.delete(colorKey)
          return true // Handled
        }
        return false // Did not handle turn for unassigned non-control knob
    }

    // Update LEDs if RGB changed
    if (needsDisplayUpdate) {
      this.updateSelectorKnobLEDs(output)
      this.updateToggleKnobLED(output)
      return true // Handled RGB update
    }

    return false
  }

  handleButtonPress(output: Output, control: number): boolean {
    // --- 1. Toggle Animation Config Mode ---
    if (control === TOGGLE_KNOB) {
      isAnimationConfigModeActive = !isAnimationConfigModeActive
      if (isAnimationConfigModeActive) {
        console.log("🔧 Entered Animation Config Mode.")
      } else {
        console.log("🎨 Exited Animation Config Mode. Returned to Color Mixing.")
      }
      this.updateSelectorKnobLEDs(output)
      this.updateToggleKnobLED(output)
      return true // Handled config toggle
    }

    // --- 2. Handle Selector Knob presses in Normal Mode ---
    if (!isAnimationConfigModeActive && SELECTOR_KNOBS.includes(control as any)) {
      if (control === COLOR_SELECTOR_KNOB_R || control === COLOR_SELECTOR_KNOB_B) {
        // Pressing Knob 0 or Knob 2 stops animation for the current mixed color
        console.log(`🎨 Button ${control} pressed. Stopping animation for preview color ${mixedColorValue}.`)
        this.stopAnimationForColor(output, mixedColorValue)
        return true // Handled stop
      }
      // Ignore press on Knob 1 (strategy selector in config mode)
      return true
    }

    // --- 3. Apply Color & Start/Restart Animation (Knobs 4-15) ---
    // Ignore if in config mode (should have returned true already)
    if (isAnimationConfigModeActive) return false

    // Proceed only for knobs 4-15
    if (CONTROL_KNOBS.includes(control as any)) return false

    const colorToApply = mixedColorValue
    console.log(`🎨 Applying color ${colorToApply} onto Knob ${control}`)
    this.stopAnimationForKnob(output, control) // Stop previous anim on this knob
    setLed(output, control, colorToApply)
    knobColors.set(control, colorToApply)

    // Start/Restart animation for the applied color group using its current config
    const config = this.getOrCreateColorAnimConfig(colorToApply)
    const animFunc = animationFunctions[config.easingIndex]
    const strategyName = COLOR_TRANSITION_STRATEGIES[config.strategyIndex]
    if (!animFunc) {
      console.warn("No animations defined!")
      return true
    }
    const animName = animFunc.name || `Index ${config.easingIndex}`

    console.log(` - Starting/Restarting animation '${animName}' (Strategy: ${strategyName}) for color group ${colorToApply}`)

    // No offsets needed for synchronized animation
    activeAnimations.set(colorToApply, {
      animIndex: config.easingIndex,
      strategyIndex: config.strategyIndex,
      startTime: Date.now(),
      duration: config.duration,
      // No knobOffsets property anymore
    })
    this.startAnimationLoop(output)

    return true // Handled color apply & animation start/restart
  }

  /**
   * Handles button release events.
   * Currently does nothing specific for this mode, but is needed for the interface
   * if the main loop tracks button state.
   */
  handleButtonRelease(_output: Output, _control: number): boolean {
    // No action needed specifically on release for color mixer logic itself
    return false // Did not handle this event in a specific way
  }
}
