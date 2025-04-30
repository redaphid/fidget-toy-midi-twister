import { Input, Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, BUTTON_CHANNEL, KNOB_CHANNEL } from "./src/modes/interface.ts"

// Import Modes
import { NormalMode } from "./src/modes/normal.ts"
import { MirrorMode } from "./src/modes/mirror.ts"
import { ChaseMode } from "./src/modes/chase.ts"
import { SimonMode } from "./src/modes/simon.ts"
// ... import other modes here (Rainbow, Pulse, etc.)

// ===== CONSTANTS =====
const COMMAND_TIMEOUT = 1000 // ms for command buffer

// ===== STATE =====
// map "channel:control" → "knob_<n>"
const seen = new Map<string, string>()
let counter = 1

// Store instances of all modes
const modes: { [key in FidgetModeName]?: FidgetModeInterface } = {}

// Currently active mode instance
let activeModeInstance: FidgetModeInterface | null = null

// Command buffer for multi-button combos
let commandBuffer: { control: number; time: number }[] = []

// ===== MIDI SETUP =====
function setupMidi() {
  const input = new Input()
  const output = new Output()

  const inputPortIndex = findPort(input, "Twister")
  const outputPortIndex = findPort(output, "Twister")

  if (inputPortIndex === -1 || outputPortIndex === -1) {
    console.error("Could not find MIDI Twister device")
    process.exit(1)
  }

  input.openPort(inputPortIndex)
  output.openPort(outputPortIndex)

  return { input, output }
}

function findPort(ports: Input | Output, name: string): number {
  const portCount = ports.getPortCount()
  for (let i = 0; i < portCount; i++) {
    if (ports.getPortName(i).includes(name)) return i
  }
  return -1
}

// ===== MODE MANAGEMENT =====
function registerModes() {
  modes.normal = new NormalMode()
  modes.mirror = new MirrorMode()
  modes.chase = new ChaseMode()
  modes.simon = new SimonMode()
  // ... register other modes here
  console.log("Modes registered:", Object.keys(modes))
}

function setActiveMode(output: Output, modeName: FidgetModeName, controls: number[] = []) {
  const newMode = modes[modeName]
  if (!newMode) {
    console.error(`Error: Mode "${modeName}" not found.`)
    return
  }

  if (activeModeInstance && activeModeInstance.getName() !== modeName) {
    console.log(`Deactivating mode: ${activeModeInstance.getName()}`)
    activeModeInstance.deactivate(output)
  }

  console.log(`Activating mode: ${modeName}`)
  activeModeInstance = newMode
  activeModeInstance.activate(output, controls)
  commandBuffer = [] // Clear command buffer after activating a mode
}

// ===== COMMAND PROCESSING =====
function processCommand(output: Output, control: number) {
  commandBuffer.push({ control, time: Date.now() })
  commandBuffer = commandBuffer.filter((cmd) => Date.now() - cmd.time < COMMAND_TIMEOUT)

  const uniqueControls = Array.from(new Set(commandBuffer.map((cmd) => cmd.control)))

  let modeActivated = false
  if (uniqueControls.length === 5) {
    // setActiveMode(output, "rainbow", uniqueControls); // Assuming RainbowMode exists
    modeActivated = true
  }
  if (!modeActivated && uniqueControls.length === 4) {
    setActiveMode(output, "chase", uniqueControls)
    modeActivated = true
  }
  if (!modeActivated && uniqueControls.length === 3) {
    // setActiveMode(output, "pulse", [uniqueControls[1]]); // Assuming PulseMode exists
    modeActivated = true
  }
  if (!modeActivated && uniqueControls.length === 2) {
    setActiveMode(output, "mirror", uniqueControls)
    modeActivated = true
  }

  if (modeActivated) {
    // Clear buffer immediately after successful command
    commandBuffer = []
  }

  return modeActivated
}

// ===== MESSAGE HANDLERS =====
function handleMidiMessage(output: Output, message: number[]) {
  const [status, control, value] = message
  // Basic validation
  if ((status & 0xf0) !== 0xb0) return // Only CC messages

  const chan = status & 0x0f
  trackKnobName(chan, control, value)

  // 1. Give the active mode a chance to handle the message
  if (activeModeInstance && activeModeInstance.handleMessage(output, chan, control, value)) {
    return // Message was fully handled by the active mode
  }

  // 2. Handle global button presses (mode switching, long press reset)
  if (chan === BUTTON_CHANNEL && value === 127) {
    handleGlobalButtonPress(output, control)
    return
  }

  // 3. If not handled by active mode or global button, let Normal mode handle knob turns (for linking updates)
  if (chan === KNOB_CHANNEL && modes.normal) {
    modes.normal.handleMessage(output, chan, control, value)
  }
}

function trackKnobName(chan: number, control: number, value: number) {
  const key = `${chan}:${control}`
  if (!seen.has(key)) {
    seen.set(key, `knob_${counter++}`)
    console.log(`🆕 ${key} → ${seen.get(key)}`)
  }
  // Fix: Log the value, not the control number again
  console.log(`🔄 ${seen.get(key)} = ${value}`)
}

let longPressTimer: NodeJS.Timeout | null = null

function handleGlobalButtonPress(output: Output, control: number) {
  // Clear previous timer if button pressed again quickly
  if (longPressTimer) clearTimeout(longPressTimer)

  // Set a timer for long press detection
  longPressTimer = setTimeout(() => {
    console.log("⏳ Long press detected! Resetting to Normal mode.")
    setActiveMode(output, "normal")
    longPressTimer = null // Clear the timer variable
  }, 1500) // 1.5 seconds for long press

  // Process command sequences for mode switching
  const commandProcessed = processCommand(output, control)

  // If it wasn't a command sequence or long press, let the normal mode handle linking
  if (!commandProcessed && activeModeInstance?.getName() === "normal" && modes.normal) {
    modes.normal.handleMessage(output, BUTTON_CHANNEL, control, 127)
  }

  // If a command was processed, cancel the long press timer
  if (commandProcessed && longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

// Function to be called when the button is released (value 0)
function handleGlobalButtonRelease(output: Output, control: number) {
  // If the button is released before the long press timer fires, cancel it
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

// ===== MAIN APPLICATION =====
function main() {
  const { input, output } = setupMidi()
  registerModes()

  // Set initial mode to Simon on specific knobs
  setActiveMode(output, "simon", [0, 1, 2, 3])
  // Or start in normal mode:
  // setActiveMode(output, "normal");

  input.on("message", (deltaTime, message) => {
    handleMidiMessage(output, message)

    // Check for button release to cancel long press
    const [status, control, value] = message
    if ((status & 0xf0) === 0xb0 && (status & 0x0f) === BUTTON_CHANNEL && value === 0) {
      handleGlobalButtonRelease(output, control)
    }
  })

  input.addListener("error", (err) => {
    console.error("MIDI input error:", err)
  })

  printHelp()

  process.once("SIGINT", () => {
    if (activeModeInstance) {
      activeModeInstance.deactivate(output)
    }
    input.closePort()
    output.closePort()
    console.log("\nMIDI ports closed. Exiting.")
    process.exit(0)
  })
}

function printHelp() {
  console.log("\n🎛️  Fidget Toy Knobs running")
  console.log("🎮 Initial Mode: Simon (Knobs 0-3)")
  console.log("--- Controls ---")
  console.log("🔗 Link Knobs (Normal Mode): Press two knobs sequentially.")
  console.log("🪄 Activate Special Modes:")
  console.log("  • Press 2 knobs quickly = Mirror mode")
  console.log("  • Press 3 knobs quickly = Pulse middle knob (Not Implemented)")
  console.log("  • Press 4 knobs quickly = Chase mode")
  console.log("  • Press 5 knobs quickly = Rainbow mode (Not Implemented)")
  console.log("🔄 Reset: Hold any button (1.5s) = Back to Normal mode")
  console.log("---------------------------------------")
}

main()
