import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"
import { animationFunctions, type AnimationFunction } from "../animations.ts"

// --- Configuration ---
const RED_KNOB = 0
const GREEN_KNOB = 1
const BLUE_KNOB = 2
const DISPLAY_KNOB = 3
const AFFECTED_KNOBS = [RED_KNOB, GREEN_KNOB, BLUE_KNOB, DISPLAY_KNOB]
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

// --- State ---
let redValue = 0
let greenValue = 0
let blueValue = 0
let mixedColorValue = 0
let isSampling = false
let sampledColor = 0
// Track which knobs have which colors
const knobColors = new Map<number, number>()
// Track flashing timers
let displayKnobFlashTimers: (NodeJS.Timeout | number)[] = []
// Track active animations: Map<colorValue, { animIndex: number, startTime: number, duration: number, originalColor: number }>
const activeAnimations = new Map<number, { animIndex: number; startTime: number; duration: number; originalColor: number }>()
let animationIntervalId: NodeJS.Timeout | number | null = null
const ANIMATION_INTERVAL = 50 // ms
const ANIMATION_DURATION = 2000 // ms
const MAX_LED_VALUE = 127

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

// --- Mode Definition ---
export class ColorMixerMode implements FidgetModeInterface {
  activate(output: Output): void {
    console.log("🎨 Activating Color Mixer Mode")
    this.deactivate(output) // Clear previous state first

    // Initialize state
    redValue = 0
    greenValue = 0
    blueValue = 0
    isSampling = false
    sampledColor = 0
    knobColors.clear()
    activeAnimations.clear()
    // Clear any pending flash timers
    displayKnobFlashTimers.forEach(clearTimeout)
    displayKnobFlashTimers = []

    clearLeds(output, ALL_KNOBS)

    // Set initial LED colors for control knobs
    setLed(output, RED_KNOB, 4) // Redish
    setLed(output, GREEN_KNOB, 36) // Greenish
    setLed(output, BLUE_KNOB, 70) // Bluish
    this.updateDisplayKnob(output) // Set display knob initial color
    console.log("  Knobs 0,1,2 = R,G,B | Knob 3 = Mixed | Press 3 to Sample | Press sampled knob to cycle animation")
  }

  private updateDisplayKnob(output: Output) {
    mixedColorValue = rgbToMidiColor(redValue, greenValue, blueValue)
    // Avoid overwriting if display knob is part of an animation
    if (this.isKnobAnimated(DISPLAY_KNOB)) return

    setLed(output, DISPLAY_KNOB, mixedColorValue)
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
        setLed(output, knobIndex, anim.originalColor)
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

  private animationLoop(output: Output): void {
    const now = Date.now()
    let hasActiveAnimations = false

    activeAnimations.forEach((anim, colorKey) => {
      hasActiveAnimations = true
      const elapsedTime = now - anim.startTime

      // Calculate animation progress (looping)
      const animFunc = animationFunctions[anim.animIndex]
      if (!animFunc) {
        console.warn(`Invalid animation index ${anim.animIndex} for color ${colorKey}`)
        activeAnimations.delete(colorKey) // Remove invalid animation
        return // Continue to next animation
      }

      // Use modulo to make time wrap around the duration for looping
      const timeWithinLoop = elapsedTime % anim.duration
      const tProgress = timeWithinLoop / anim.duration // Progress within the current loop (0.0 to 1.0)

      const progressFactor = animFunc(tProgress, 0, anim.duration) // Offset is 0 for now

      // Animate between originalColor and MAX_LED_VALUE
      const currentValue = Math.round(anim.originalColor + (MAX_LED_VALUE - anim.originalColor) * progressFactor)
      const finalValue = Math.max(0, Math.min(MAX_LED_VALUE, currentValue)) // Clamp value

      // Update LEDs for all knobs currently mapped to this originalColor group
      knobColors.forEach((knobColor, knobIndex) => {
        if (knobColor === colorKey) {
          setLed(output, knobIndex, finalValue)
        }
      })
    })

    // Stop the interval if no more animations are active
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
    let needsDisplayUpdate = false

    // --- Check for exiting sampling mode ---
    if (isSampling && (control === RED_KNOB || control === GREEN_KNOB || control === BLUE_KNOB)) {
      isSampling = false
      displayKnobFlashTimers.forEach(clearTimeout)
      displayKnobFlashTimers = []
      // No need to restore display knob LED here, as updateDisplayKnob will be called anyway
      console.log("🎨 Exited painting mode due to RGB knob turn.")
    }
    // --- End check ---

    switch (control) {
      case RED_KNOB:
        redValue = value
        setLed(output, RED_KNOB, 4 + Math.floor(value / (MAX_LED_VALUE / 10)))
        needsDisplayUpdate = true
        break
      case GREEN_KNOB:
        greenValue = value
        setLed(output, GREEN_KNOB, 36 + Math.floor(value / (MAX_LED_VALUE / 10)))
        needsDisplayUpdate = true
        break
      case BLUE_KNOB:
        blueValue = value
        setLed(output, BLUE_KNOB, 70 + Math.floor(value / (MAX_LED_VALUE / 10)))
        needsDisplayUpdate = true
        break
      default:
        // Check if it's a knob with a sampled color
        const colorKey = knobColors.get(control)
        if (colorKey !== undefined) {
          // Stop animation first (if any)
          this.stopAnimationForColor(output, colorKey)

          const newColor = value // Use raw value for new color
          // Update all knobs that shared the original color
          knobColors.forEach((knobColor, knobIndex) => {
            if (knobColor === colorKey) {
              setLed(output, knobIndex, newColor)
              knobColors.set(knobIndex, newColor) // Update map to new color group
            }
          })
          // Since the color group changed, the old animation cycle index is irrelevant.
          return true // Handled
        }
        // Not an RGB knob or a sampled knob
        return false // Did not handle
    }

    // If R, G, or B changed, update the display
    if (needsDisplayUpdate) {
      this.updateDisplayKnob(output)
      return true // Handled
    }

    return false // Should not be reached
  }

  handleButtonPress(output: Output, control: number): boolean {
    // --- 1. Handle Painting / Sampling Exit ---
    if (isSampling) {
      if (control === DISPLAY_KNOB) {
        // Pressing display knob again exits sampling mode
        isSampling = false
        displayKnobFlashTimers.forEach(clearTimeout)
        displayKnobFlashTimers = []
        setLed(output, DISPLAY_KNOB, mixedColorValue) // Restore display knob
        console.log("🎨 Exited painting mode.")
        return true // Handled
      } else {
        // Apply color to the pressed knob AND stay in sampling mode
        console.log(`🎨 Painting color ${sampledColor} onto Knob ${control}`)
        this.stopAnimationForKnob(output, control) // Stop existing animation if any
        setLed(output, control, sampledColor)
        knobColors.set(control, sampledColor) // Assign knob to this color group
        return true // Handled press event (painted knob)
      }
    }

    // --- 2. Handle Entering Sampling Mode ---
    if (control === DISPLAY_KNOB) {
      isSampling = true
      sampledColor = mixedColorValue
      console.log(`🎨 Entered painting mode (Color: ${sampledColor}). Click knobs to paint, Display knob to exit.`)
      // Flash the display knob
      displayKnobFlashTimers.forEach(clearTimeout) // Clear previous just in case
      displayKnobFlashTimers = []
      setLed(output, DISPLAY_KNOB, MAX_LED_VALUE) // Flash High
      displayKnobFlashTimers.push(setTimeout(() => setLed(output, DISPLAY_KNOB, 0), 150))
      displayKnobFlashTimers.push(setTimeout(() => setLed(output, DISPLAY_KNOB, MAX_LED_VALUE), 300))
      displayKnobFlashTimers.push(
        setTimeout(() => {
          // Restore flashing knob to indicate ongoing painting mode
          if (isSampling) setLed(output, DISPLAY_KNOB, MAX_LED_VALUE) // Keep it lit/flashing? Or use sampledColor? Let's use MAX for now.
        }, 450)
      )
      return true // Handled press event (enter sampling)
    }

    // --- 3. Handle Animation Cycling / Stopping (Only if NOT sampling) ---
    // This part is only reached if isSampling is false
    const colorKey = knobColors.get(control)
    if (colorKey !== undefined) {
      const currentAnimation = activeAnimations.get(colorKey)

      if (currentAnimation) {
        // Animation is currently running for this group, cycle or stop
        const currentAnimIndex = currentAnimation.animIndex
        const nextAnimIndex = currentAnimIndex + 1

        if (nextAnimIndex < animationFunctions.length) {
          // Cycle to the next animation
          const newAnimFunc = animationFunctions[nextAnimIndex]
          const newAnimName = newAnimFunc?.name || `Index ${nextAnimIndex}`
          console.log(`🎨 Cycling animation to '${newAnimName}' (Index ${nextAnimIndex}) for color group ${colorKey}`)

          activeAnimations.set(colorKey, {
            ...currentAnimation, // Keep originalColor, duration
            animIndex: nextAnimIndex,
            startTime: Date.now(), // Restart timer for the new animation
          })
          // Ensure loop is running (it should be, but doesn't hurt)
          this.startAnimationLoop(output)
        } else {
          // Cycled through all animations, now stop
          console.log(`🎨 Cycled through all animations. Stopping for color group ${colorKey}.`)
          this.stopAnimationForColor(output, colorKey)
          // The animation loop will stop itself if no others are active
        }
      } else {
        // Animation is NOT running, start the first one (index 0)
        const firstAnimFunc = animationFunctions[0]
        if (!firstAnimFunc) {
          console.warn("No animations defined!")
          return true // Handled press, nothing to do
        }
        const firstAnimName = firstAnimFunc.name || `Index 0`
        console.log(`🎨 Starting animation '${firstAnimName}' (Index 0) for color group ${colorKey}`)

        activeAnimations.set(colorKey, {
          animIndex: 0,
          startTime: Date.now(),
          duration: ANIMATION_DURATION,
          originalColor: colorKey,
        })
        this.startAnimationLoop(output)
      }

      return true // Handled press event (cycle/start/stop animation)
    }

    // --- 4. Button press not handled ---
    return false
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

  deactivate(output: Output): void {
    console.log("🎨 Deactivated Color Mixer mode")
    clearLeds(output, ALL_KNOBS) // Clear all knobs on exit
    redValue = 0
    greenValue = 0
    blueValue = 0
    isSampling = false
    knobColors.clear() // Clear the color mapping
    activeAnimations.clear() // Clear active animations
    if (animationIntervalId) {
      clearInterval(animationIntervalId as number)
      animationIntervalId = null
    }
    // Clear any pending flash timers
    displayKnobFlashTimers.forEach(clearTimeout)
    displayKnobFlashTimers = []
  }
}
