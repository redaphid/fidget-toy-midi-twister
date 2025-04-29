// midi_indicator_only.ts

import { Input, Output } from "@julusian/midi"

// map "channel:control" → "knob_<n>"
const seen = new Map<string, string>()
let counter = 1

// MIDI status bytes
const CC = 0xb0 // Control Change base
const LED_CH = 1 // zero-based: 0=Ch1 (ring), 1=Ch2 (indicator)

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

  // send override CC on Channel 2 to control the indicator LED
  const msg = [CC | LED_CH, control, value]
  output.sendMessage(msg)
})

// — cleanup —
process.once("SIGINT", () => {
  input.closePort()
  output.closePort()
  process.exit(0)
})
