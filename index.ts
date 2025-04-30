// midi_indicator_only.ts

import { Input, Output } from "@julusian/midi"

// map "channel:control" → "knob_<n>"
const seen = new Map<string, string>()
let counter = 1

// MIDI status bytes
const CC = 0xb0 // Control Change base
const LED_CH = 1 // zero-based: 0=Ch1 (ring), 1=Ch2 (indicator)

// Track first knob for linking
let firstKnob: { control: number; value: number } | null = null
const BUTTON_CHANNEL = 1 // Channel 2 (zero-based: 1)
const KNOB_CHANNEL = 0 // Channel 1 (zero-based: 0)

// Track linked knobs: source control → [destination controls]
const linkedKnobs = new Map<number, number[]>()

// — connect to your Twister ports —
function findPort(ports: Input | Output, name: string) {
  const portCount = ports.getPortCount()
  for (let i = 0; i < portCount; i++) {
    if (ports.getPortName(i).includes(name)) return i
  }
  return -1
}

const input = new Input()
const output = new Output()

// Find and open ports
const inputPortIndex = findPort(input, "Twister")
const outputPortIndex = findPort(output, "Twister")

if (inputPortIndex === -1 || outputPortIndex === -1) {
  console.error("Could not find MIDI Twister device")
  process.exit(1)
}

input.openPort(inputPortIndex)
output.openPort(outputPortIndex)

input.on("message", (deltaTime, message) => {
  const [status, control, value] = message
  if ((status & 0xf0) !== CC) return // only CC messages
  const chan = status & 0x0f
  const key = `${chan}:${control}`

  if (!seen.has(key)) {
    seen.set(key, `knob_${counter++}`)
    console.log(`🆕 ${key} → ${seen.get(key)}`)
  }
  console.log(`🔄 ${seen.get(key)} = ${value}`)

  if (chan === BUTTON_CHANNEL && value === 127) {
    // Button press
    if (firstKnob === null) {
      // Store the current knob's value
      const currentKnobKey = `${KNOB_CHANNEL}:${control}`
      if (seen.has(currentKnobKey)) {
        firstKnob = { control, value: 0 } // We'll update the value when the knob moves
        console.log(`📌 First knob stored: control ${control}`)
      }
    } else {
      // Second button press - link the knobs
      console.log(`🔗 Linking knobs: ${firstKnob.control} → ${control}`)

      // Add to linked knobs map
      if (!linkedKnobs.has(firstKnob.control)) {
        linkedKnobs.set(firstKnob.control, [])
      }
      linkedKnobs.get(firstKnob.control)?.push(control)

      // Send initial value to the new linked knob
      const msg = [CC | LED_CH, control, firstKnob.value]
      output.sendMessage(msg)

      // Reset for next pair
      firstKnob = null
    }
  } else if (chan === KNOB_CHANNEL) {
    // Update stored value if this is the source knob
    if (firstKnob?.control === control) {
      firstKnob.value = value
    }

    // If this knob has linked destinations, update their LEDs
    const destinations = linkedKnobs.get(control)
    if (destinations) {
      for (const destControl of destinations) {
        const msg = [CC | LED_CH, destControl, value]
        output.sendMessage(msg)
      }
    }
  }
})

// — cleanup —
process.once("SIGINT", () => {
  input.closePort()
  output.closePort()
  process.exit(0)
})
