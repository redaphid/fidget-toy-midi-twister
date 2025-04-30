import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// --- Configuration ---
// Assign knobs (control numbers) to modes
const GAME_MAP: { [control: number]: FidgetModeName } = {
  0: "simon",
  1: "chase",
  2: "mirror",
  3: "rainbow",
  4: "pulse",
  5: "ripple",
  6: "wave",
  7: "binary",
  8: "fibonacci",
  9: "random",
  10: "color_mixer", // Add Color Mixer
  15: "normal_linking", // Put linking on the last knob
  // Knobs 11-14 are unassigned
}

// Assign unique colors (MIDI 0-127) to game knobs
const GAME_COLORS: { [mode in FidgetModeName]?: number } = {
  simon: 4, // Red
  chase: 20, // Yellow
  mirror: 36, // Green
  rainbow: 60, // Cyan
  pulse: 70, // Blue
  ripple: 85, // Magenta
  wave: 10, // Orange
  binary: 90, // Pink
  fibonacci: 30, // Lime
  random: 0, // White (or close to it)
  color_mixer: 48, // Assign a color (e.g., Teal)
  normal_linking: 127, // Bright White / Default
}

// --- Helper Functions ---
function midiValueToColorName(value: number): string {
  // Simple range-based mapping (adjust ranges as needed)
  if (value < 2) return "White"
  if (value < 8) return "Red"
  if (value < 16) return "Orange"
  if (value < 24) return "Amber"
  if (value < 32) return "Yellow"
  if (value < 40) return "Lime"
  if (value < 48) return "Green"
  if (value < 64) return "Cyan"
  if (value < 80) return "Blue"
  if (value < 96) return "Purple"
  if (value < 112) return "Magenta"
  if (value < 120) return "Pink"
  return "Bright White"
}

// Type for the callback function to change the mode
export type ChangeModeCallback = (modeName: FidgetModeName, triggeringControl: number) => void

// --- Game Selection Mode ---
export class GameSelectionMode implements FidgetModeInterface {
  private changeModeCallback: ChangeModeCallback
  private assignedKnobs: number[]

  constructor(changeMode: ChangeModeCallback) {
    this.changeModeCallback = changeMode
    this.assignedKnobs = Object.keys(GAME_MAP).map(Number)
  }

  activate(output: Output): void {
    console.log("\n--- Game Selection Mode Activated ---")
    console.log("Press a colored knob to select a game:")

    // Clear all LEDs first
    clearLeds(
      output,
      Array.from({ length: 16 }, (_, i) => i)
    )

    // Set colors for assigned game knobs and print mapping
    this.assignedKnobs.forEach((control) => {
      const modeName = GAME_MAP[control]
      const colorValue = GAME_COLORS[modeName] ?? 0 // Default to white if no color
      const colorName = midiValueToColorName(colorValue)
      setLed(output, control, colorValue)
      // Pad control number for alignment
      const controlStr = String(control).padStart(2, " ")
      console.log(`  Knob ${controlStr}: ${modeName.padEnd(15)} (Color: ${colorName})`)
    })
    console.log("-------------------------------------")
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Could potentially use an unassigned knob for brightness control here
    return false // Ignore knob turns for now
  }

  handleButtonPress(output: Output, control: number): boolean {
    if (GAME_MAP[control]) {
      const selectedMode = GAME_MAP[control]
      console.log(`Selected game: ${selectedMode}`)
      // Pass the control that was pressed
      this.changeModeCallback(selectedMode, control)
      return true // Handled the press
    }
    return false // Button press wasn't for a game knob
  }

  // handleButtonRelease is optional, not needed here

  deactivate(output: Output): void {
    console.log("Deactivating Game Selection Mode...")
    // Turn off LEDs for the selection knobs
    clearLeds(output, this.assignedKnobs)
  }
}
