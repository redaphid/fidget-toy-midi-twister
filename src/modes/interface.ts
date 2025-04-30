import { Output } from "@julusian/midi"

// Define the types for MIDI channels and modes
export const CC = 0xb0 // Control Change base
export const LED_CH = 1 // Indicator LED channel
export const BUTTON_CHANNEL = 1
export const KNOB_CHANNEL = 0

export type FidgetModeName = "normal" | "mirror" | "chase" | "rainbow" | "pulse" | "ripple" | "random" | "wave" | "binary" | "fibonacci" | "simon"

// Shared utility to set LED (could be moved to a utils file later)
export function setLed(output: Output, control: number, value: number) {
  const msg = [CC | LED_CH, control, value]
  output.sendMessage(msg)
}

// Interface for all fidget modes
export interface FidgetModeInterface {
  getName(): FidgetModeName

  // Activate the mode on the given controls
  activate(output: Output, controls: number[]): void

  // Handle an incoming MIDI message. Return true if handled, false otherwise.
  handleMessage(output: Output, chan: number, control: number, value: number): boolean

  // Deactivate the mode and clean up resources (timers, LEDs)
  deactivate(output: Output): void
}
