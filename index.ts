#!/usr/bin/env node
import { Input, Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, BUTTON_CHANNEL, KNOB_CHANNEL } from "./src/modes/interface.ts"

// Import ALL Modes
import { GameSelectionMode, type ChangeModeCallback } from "./src/modes/game_select.ts"
import { NormalLinkingMode } from "./src/modes/normal_linking.ts"
import { MirrorMode } from "./src/modes/mirror.ts"
import { ChaseMode } from "./src/modes/chase.ts"
import { SimonMode } from "./src/modes/simon.ts"
import { RainbowMode } from "./src/modes/rainbow.ts"
import { PulseMode } from "./src/modes/pulse.ts"
import { RippleMode } from "./src/modes/ripple.ts"
import { RandomMode } from "./src/modes/random.ts"
import { WaveMode } from "./src/modes/wave.ts"
import { BinaryMode } from "./src/modes/binary.ts"
import { FibonacciMode } from "./src/modes/fibonacci.ts"
import { ColorMixerMode } from "./src/modes/color_mixer.ts"

// Import Slack function and fs
import { setProfilePhoto } from "./src/slack.ts"
import { strict as assert } from "node:assert"
import { parseArgs } from "node:util" // Import parseArgs

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
let midiOutput: Output | null = null // Store MIDI output globally
let longPressTimer: NodeJS.Timeout | null = null

// ===== MIDI SETUP =====
function setupMidi() {
  const input = new Input()
  const output = new Output()
  midiOutput = output // Store for global access

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
// Callback function passed to GameSelectionMode
const changeMode: ChangeModeCallback = (modeName: FidgetModeName) => {
  if (midiOutput) {
    setActiveMode(midiOutput, modeName)
  } else {
    console.error("MIDI output not initialized when changing mode.")
  }
}

function registerModes() {
  modes.game_select = new GameSelectionMode(changeMode) // Pass the callback
  modes.normal_linking = new NormalLinkingMode()
  modes.mirror = new MirrorMode()
  modes.chase = new ChaseMode()
  modes.simon = new SimonMode()
  modes.rainbow = new RainbowMode()
  modes.pulse = new PulseMode()
  modes.ripple = new RippleMode()
  modes.random = new RandomMode()
  modes.wave = new WaveMode()
  modes.binary = new BinaryMode()
  modes.fibonacci = new FibonacciMode()
  modes.color_mixer = new ColorMixerMode()
  console.log("Modes registered:", Object.keys(modes))
}

function setActiveMode(output: Output, modeName: FidgetModeName, triggeringControl?: number) {
  const newMode = modes[modeName]
  if (!newMode) {
    console.error(`Error: Mode "${modeName}" not found.`)
    return
  }

  if (activeModeInstance) {
    console.log(`Deactivating mode: ${activeModeInstance.constructor.name}`)
    activeModeInstance.deactivate(output)
  }

  console.log(`Activating mode: ${modeName}` + (triggeringControl !== undefined ? ` (triggered by control ${triggeringControl})` : " "))
  activeModeInstance = newMode

  if (newMode.activate.length > 1) {
    ;(newMode.activate as (output: Output, triggeringControl: number) => void)(output, triggeringControl !== undefined ? triggeringControl : 0)
  } else {
    newMode.activate(output)
  }
}

// ===== MESSAGE HANDLERS =====
function handleMidiMessage(output: Output, message: number[]) {
  const [status, control, value] = message
  if ((status & 0xf0) !== 0xb0) return // Only CC messages

  const chan = status & 0x0f
  trackKnobName(chan, control, value)

  let handled = false
  if (activeModeInstance) {
    if (chan === KNOB_CHANNEL) {
      handled = activeModeInstance.handleKnobTurn(output, control, value)
    } else if (chan === BUTTON_CHANNEL) {
      if (value === 127) {
        // Button Press
        startLongPressCheck(output, control)
        handled = activeModeInstance.handleButtonPress(output, control)
      } else if (value === 0 && activeModeInstance.handleButtonRelease) {
        // Button Release
        cancelLongPressCheck()
        handled = activeModeInstance.handleButtonRelease(output, control)
      } else if (value === 0) {
        // Button Release (no specific handler)
        cancelLongPressCheck() // Still cancel timer
      }
    }
  }

  // if (!handled) {
  //   console.debug(`Message ${message} not handled by active mode.`)
  // }
}

function trackKnobName(chan: number, control: number, value: number) {
  const key = `${chan}:${control}`
  if (!seen.has(key)) {
    seen.set(key, `knob_${counter++}`)
    console.log(`🆕 ${key} → ${seen.get(key)}`)
  }
  // Optional: Reduce logging verbosity
  // console.log(`🔄 ${seen.get(key)} = ${value}`);
}

// --- Global Long Press Handling ---
function startLongPressCheck(output: Output, control: number) {
  cancelLongPressCheck() // Cancel any existing timer
  longPressTimer = setTimeout(() => {
    console.log("⏳ Long press detected! Resetting to Game Select mode.")
    setActiveMode(output, "game_select") // Reset to game select
    longPressTimer = null
  }, 1500) // 1.5 seconds for long press
}

function cancelLongPressCheck() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

// ===== MAIN APPLICATION =====
async function main() {
  // --- Argument Parsing for Slack Photo using util.parseArgs ---
  const args = process.argv.slice(2)
  const parsedArgs = parseArgs({
    args,
    options: {
      "set-photo-index": {
        type: "string",
        short: "p",
      },
      // Add other potential arguments here
    },
    allowPositionals: true, // Allow other args if needed
  })

  const photoIndexStr = parsedArgs.values["set-photo-index"]

  if (photoIndexStr) {
    const imageIndex = parseInt(photoIndexStr, 10)

    console.log(`Attempting to set Slack profile photo using image index: ${imageIndex}`)

    const { output } = setupMidi() // Need MIDI output for LED feedback
    const token = process.env.SLACK_TOKEN
    assert(token, "SLACK_TOKEN environment variable is not set.")

    await setProfilePhoto({ output, knob: imageIndex, token })

    output.closePort()
    process.exit(0)
  }

  // --- Normal Fidget Toy Operation ---
  console.log("Starting Fidget Toy Knobs application...")
  const { input, output } = setupMidi()
  registerModes()

  // Set initial mode to Game Selection
  setActiveMode(output, "game_select")

  input.on("message", (deltaTime, message) => {
    handleMidiMessage(output, message)
  })

  input.addListener("error", (err) => {
    console.error("MIDI input error:", err)
  })

  printHelp() // Initial help

  process.once("SIGINT", () => {
    console.log("\nCtrl+C detected. Cleaning up...")
    if (activeModeInstance) {
      console.log(`Deactivating final mode: ${activeModeInstance.constructor.name}`)
      activeModeInstance.deactivate(output)
    }
    cancelLongPressCheck() // Ensure timer is cleared on exit
    input.closePort()
    output.closePort()
    console.log("MIDI ports closed. Exiting.")
    process.exit(0)
  })
}

function printHelp() {
  // Help text is now printed by GameSelectionMode upon activation
  console.log("\n🎛️ Fidget Toy Knobs Initialized 🎛️")
  console.log("🔄 Reset to Game Select: Hold any button (1.5s)")
  console.log("---------------------------------------")
}

main().catch((err) => {
  console.error("Unhandled error in main:", err)
  process.exit(1)
})
