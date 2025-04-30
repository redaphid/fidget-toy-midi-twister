import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

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

// --- Helper Functions ---
// VERY basic placeholder RGB to a single MIDI value mapping
// A real implementation would involve HSL/HSV conversion and mapping to the Twister's LED ranges
function rgbToMidiColor(r: number, g: number, b: number): number {
  // Average the components and scale?
  // Or prioritize dominant color?
  // Simple average:
  let avg = (r + g + b) / 3
  // Maybe shift hue based on dominant color?
  if (r > g && r > b) avg = (avg + 0) % 128 // Bias towards red range
  else if (g > r && g > b) avg = (avg + 42) % 128 // Bias towards green range
  else if (b > r && b > g) avg = (avg + 85) % 128 // Bias towards blue range

  return Math.floor(avg)
}

// --- Mode Definition ---
export class ColorMixerMode implements FidgetModeInterface {
  activate(output: Output): void {
    console.log("🎨 Activating Color Mixer Mode")
    this.deactivate(output) // Clear previous state

    // Initialize state
    redValue = 0
    greenValue = 0
    blueValue = 0
    isSampling = false
    sampledColor = 0

    clearLeds(output, ALL_KNOBS)

    // Set initial LED colors for control knobs
    setLed(output, RED_KNOB, 4) // Redish
    setLed(output, GREEN_KNOB, 36) // Greenish
    setLed(output, BLUE_KNOB, 70) // Bluish
    this.updateDisplayKnob(output) // Set display knob initial color
    console.log("  Knobs 0,1,2 = R,G,B | Knob 3 = Mixed | Press 3 to Sample")
  }

  private updateDisplayKnob(output: Output) {
    mixedColorValue = rgbToMidiColor(redValue, greenValue, blueValue)
    setLed(output, DISPLAY_KNOB, mixedColorValue)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    let updated = false
    if (control === RED_KNOB) {
      redValue = value
      setLed(output, RED_KNOB, 4 + Math.floor(value / 16)) // Modulate base red slightly
      updated = true
    } else if (control === GREEN_KNOB) {
      greenValue = value
      setLed(output, GREEN_KNOB, 36 + Math.floor(value / 16)) // Modulate base green slightly
      updated = true
    } else if (control === BLUE_KNOB) {
      blueValue = value
      setLed(output, BLUE_KNOB, 70 + Math.floor(value / 16)) // Modulate base blue slightly
      updated = true
    }

    if (updated) {
      this.updateDisplayKnob(output)
      return true // Handled
    }
    return false // Knob turn wasn't for RGB controls
  }

  handleButtonPress(output: Output, control: number): boolean {
    if (isSampling) {
      // We are in sampling mode, apply the color to the pressed knob
      console.log(`🎨 Applying color ${sampledColor} to Knob ${control}`)
      setLed(output, control, sampledColor)
      isSampling = false // Exit sampling mode
      // Restore display knob appearance (optional, maybe flash it?)
      setLed(output, DISPLAY_KNOB, mixedColorValue)
      return true
    }

    if (control === DISPLAY_KNOB) {
      // Enter sampling mode
      isSampling = true
      sampledColor = mixedColorValue
      console.log(`🎨 Sampling color ${sampledColor}. Press another knob to apply.`)
      // Flash the display knob to indicate sampling mode
      setLed(output, DISPLAY_KNOB, 127)
      setTimeout(() => setLed(output, DISPLAY_KNOB, 0), 150)
      setTimeout(() => setLed(output, DISPLAY_KNOB, 127), 300)
      setTimeout(() => setLed(output, DISPLAY_KNOB, 0), 450)
      return true
    }

    return false // Button press wasn't relevant to this mode
  }

  deactivate(output: Output): void {
    console.log("🎨 Deactivated Color Mixer mode")
    clearLeds(output, ALL_KNOBS) // Clear all knobs on exit
    redValue = 0
    greenValue = 0
    blueValue = 0
    isSampling = false
  }
}
