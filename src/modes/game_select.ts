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
  15: "normal_linking", // Put linking on the last knob
  // Knobs 10-14 are unassigned
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
  normal_linking: 127, // Bright White / Default
}

// Type for the callback function to change the mode
export type ChangeModeCallback = (modeName: FidgetModeName) => void

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
      const color = GAME_COLORS[modeName] ?? 0 // Default to white if no color
      setLed(output, control, color)
      console.log(`  Knob ${control}: ${modeName} (Color: ${color})`)
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
      this.changeModeCallback(selectedMode)
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
