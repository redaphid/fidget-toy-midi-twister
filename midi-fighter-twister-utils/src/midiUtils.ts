import { type Output } from "@julusian/midi"
import { DEFAULT_MIDI_CHANNEL, LED_OFF_VALUE, NUM_KNOBS } from "./constants"

/**
 * Sends a MIDI Control Change (CC) message to set the color/brightness of a specific LED.
 *
 * @param output The initialized MIDI output port from `@julusian/midi`.
 * @param knobIndex The index of the knob/LED (0-15).
 * @param value The value to set (0-127).
 * @param channel The MIDI channel to use (defaults to DEFAULT_MIDI_CHANNEL).
 */
export function setLed(output: Output, knobIndex: number, value: number, channel: number = DEFAULT_MIDI_CHANNEL): void {
  if (knobIndex < 0 || knobIndex >= NUM_KNOBS) {
    console.warn(`setLed: knobIndex ${knobIndex} out of range (0-${NUM_KNOBS - 1})`)
    return
  }
  if (value < 0 || value > 127) {
    console.warn(`setLed: value ${value} out of range (0-127)`)
    // Optionally clamp or return, here we clamp
    value = Math.max(0, Math.min(127, value))
  }
  try {
    output.send("cc", {
      controller: knobIndex,
      value: Math.round(value), // Ensure integer value
      channel: channel,
    })
  } catch (error) {
    console.error(`Error sending MIDI message to knob ${knobIndex}: ${error}`)
  }
}

/**
 * Sends MIDI CC messages to turn off specific LEDs.
 *
 * @param output The initialized MIDI output port.
 * @param knobIndices An array of knob/LED indices (0-15) to turn off.
 * @param channel The MIDI channel to use (defaults to DEFAULT_MIDI_CHANNEL).
 */
export function clearLeds(output: Output, knobIndices: number[], channel: number = DEFAULT_MIDI_CHANNEL): void {
  for (const knobIndex of knobIndices) {
    // Use setLed for consistency and validation
    setLed(output, knobIndex, LED_OFF_VALUE, channel)
  }
}

/**
 * Sends MIDI CC messages to turn off all LEDs (0-15).
 *
 * @param output The initialized MIDI output port.
 * @param channel The MIDI channel to use (defaults to DEFAULT_MIDI_CHANNEL).
 */
export function clearAllLeds(output: Output, channel: number = DEFAULT_MIDI_CHANNEL): void {
  const allKnobs = Array.from({ length: NUM_KNOBS }, (_, i) => i)
  clearLeds(output, allKnobs, channel)
}
