import { Output } from "@julusian/midi"

// Define the types for MIDI channels and modes
export const CC = 0xb0 // Control Change base
export const LED_CH = 1 // Indicator LED channel
export const BUTTON_CHANNEL = 1
export const KNOB_CHANNEL = 0

export const Colors = {
  OFF: 0,
  RED: 127,
  GREEN: 64,
  BLUE: 32,
  YELLOW: 96,
  PURPLE: 112,
  CYAN: 48,
  WHITE: 127,
  ORANGE: 108,
  PINK: 120,
  MAGENTA: 116,
  LIME: 80,
  TEAL: 56,
  INDIGO: 104,
  MAROON: 124,
  OLIVE: 88,
  NAVY: 40,
  CORAL: 100,
  TURQUOISE: 52,
  VIOLET: 108,
} as const

export type FidgetModeName =
  | "game_select"
  | "normal_linking" // Keeping the original linking as an option
  | "mirror"
  | "chase"
  | "rainbow"
  | "pulse"
  | "ripple"
  | "random"
  | "wave"
  | "binary"
  | "fibonacci"
  | "simon"
  | "color_mixer"
  | "slack"
// Shared utility to set LED (could be moved to a utils file later)
export function setLed(output: Output, control: number, value: number) {
  // Basic validation to prevent crashing MIDI libraries with bad values
  value = Math.max(0, Math.min(127, Math.floor(value)))
  control = Math.max(0, Math.min(127, Math.floor(control)))
  const msg = [CC | LED_CH, control, value]
  output.sendMessage(msg)
}

// Shared utility to clear LEDs
export function clearLeds(output: Output, controls: number[]) {
  for (const control of controls) {
    setLed(output, control, 0)
  }
}

// Interface for all fidget modes
export interface FidgetModeInterface {
  // Called when the mode becomes active
  // Should set up initial state, timers, LEDs
  activate(output: Output): void

  // Called when a knob is turned in this mode
  // Return true if the event was fully handled, false otherwise
  handleKnobTurn(output: Output, control: number, value: number): boolean

  // Called when a button is pressed (value 127) in this mode
  handleButtonPress(output: Output, control: number): boolean

  // Called when a button is released (value 0) in this mode
  handleButtonRelease?(output: Output, control: number): boolean // Optional

  // Called when the mode is deactivated
  // Should clean up timers, reset LEDs, clear state
  deactivate(output: Output): void
}
