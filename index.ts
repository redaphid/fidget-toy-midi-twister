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

// Track knob states and special modes
const knobValues = new Map<number, number>() // control → value
const knobModes = new Map<number, string>() // control → mode
const specialKnobs = new Set<number>() // knobs with special behaviors

// Animation timers
let animationTimers: NodeJS.Timeout[] = []

// Fidget toy modes
const MODES = {
  NORMAL: "normal",
  CHASE: "chase",
  MIRROR: "mirror",
  RAINBOW: "rainbow",
  PULSE: "pulse",
  RIPPLE: "ripple",
  RANDOM: "random",
  WAVE: "wave",
  BINARY: "binary",
  FIBONACCI: "fibonacci",
  SIMON: "simon",
}

// Chase sequence state
let chaseSequence: number[] = []
let chasePosition = 0
let chaseTimer: NodeJS.Timeout | null = null

// Simon game state
let simonSequence: number[] = []
let simonUserPosition = 0
let simonActive = false

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

// HELPER FUNCTIONS

// Set LED color for a knob
function setLed(control: number, value: number) {
  const msg = [CC | LED_CH, control, value]
  output.sendMessage(msg)
  knobValues.set(control, value)
}

// Stop all animations
function stopAnimations() {
  animationTimers.forEach((timer) => clearTimeout(timer))
  animationTimers = []

  if (chaseTimer) {
    clearInterval(chaseTimer)
    chaseTimer = null
  }
}

// Generate random value
function randomValue() {
  return Math.floor(Math.random() * 128)
}

// FEATURE 1: MIRROR MODE - mirrors the value of one knob to another in reverse
function activateMirrorMode(controlA: number, controlB: number) {
  console.log(`🪞 Mirror mode: ${controlA} ↔ ${controlB}`)

  // Remove any previous links
  linkedKnobs.forEach((dests, source) => {
    linkedKnobs.set(
      source,
      dests.filter((d) => d !== controlB)
    )
  })

  // Set up mirror relationship
  specialKnobs.add(controlA)
  specialKnobs.add(controlB)
  knobModes.set(controlA, MODES.MIRROR)
  knobModes.set(controlB, MODES.MIRROR)

  // Initial synchronization
  const valueA = knobValues.get(controlA) || 0
  setLed(controlB, 127 - valueA)
}

// FEATURE 2: CHASE MODE - creates a moving light sequence
function activateChaseMode(controls: number[]) {
  console.log(`🏃 Chase mode activated`)

  // Set up the chase
  chaseSequence = [...controls]
  chasePosition = 0
  controls.forEach((control) => {
    specialKnobs.add(control)
    knobModes.set(control, MODES.CHASE)
    setLed(control, 0)
  })

  // Start the chase
  if (chaseTimer) clearInterval(chaseTimer)

  chaseTimer = setInterval(() => {
    // Clear previous position
    const prevPos = (chasePosition - 1 + chaseSequence.length) % chaseSequence.length
    setLed(chaseSequence[prevPos], 0)

    // Light up current position
    setLed(chaseSequence[chasePosition], 127)

    // Move to next position
    chasePosition = (chasePosition + 1) % chaseSequence.length
  }, 150)
}

// FEATURE 3: RAINBOW MODE - creates a rainbow effect across multiple knobs
function activateRainbowMode(controls: number[]) {
  console.log(`🌈 Rainbow mode activated`)

  controls.forEach((control, index) => {
    specialKnobs.add(control)
    knobModes.set(control, MODES.RAINBOW)

    // Set initial rainbow value
    const rainbowValue = Math.floor((index / controls.length) * 127)
    setLed(control, rainbowValue)
  })
}

// FEATURE 4: PULSE MODE - single knob pulses up and down
function activatePulseMode(control: number) {
  console.log(`💓 Pulse mode: ${control}`)

  specialKnobs.add(control)
  knobModes.set(control, MODES.PULSE)

  let value = 0
  let direction = 1

  const pulseTimer = setInterval(() => {
    value += direction * 5

    if (value >= 127) {
      value = 127
      direction = -1
    } else if (value <= 0) {
      value = 0
      direction = 1
    }

    setLed(control, value)
  }, 50)

  animationTimers.push(pulseTimer)
}

// FEATURE 5: RIPPLE EFFECT - ripple outward from center knob
function activateRippleEffect(centerControl: number, surroundingControls: number[]) {
  console.log(`🌊 Ripple effect from: ${centerControl}`)

  specialKnobs.add(centerControl)
  knobModes.set(centerControl, MODES.RIPPLE)
  surroundingControls.forEach((control) => {
    specialKnobs.add(control)
    knobModes.set(control, MODES.RIPPLE)
  })

  // Clear all LEDs
  setLed(centerControl, 0)
  surroundingControls.forEach((control) => setLed(control, 0))

  // Create ripple
  setLed(centerControl, 127)

  surroundingControls.forEach((control, index) => {
    setTimeout(() => {
      setLed(control, 127)

      // Fade out after delay
      setTimeout(() => {
        setLed(control, 0)
      }, 150)
    }, 100 * (index + 1))
  })

  // Fade center after ripple
  setTimeout(() => {
    setLed(centerControl, 0)
  }, 100 * (surroundingControls.length + 1))
}

// FEATURE 6: RANDOM LIGHT SHOW - random values for all knobs
function activateRandomMode(controls: number[]) {
  console.log(`🎲 Random mode activated`)

  controls.forEach((control) => {
    specialKnobs.add(control)
    knobModes.set(control, MODES.RANDOM)
  })

  const randomTimer = setInterval(() => {
    controls.forEach((control) => {
      setLed(control, randomValue())
    })
  }, 200)

  animationTimers.push(randomTimer)
}

// FEATURE 7: WAVE PATTERN - sine wave across knobs
function activateWaveMode(controls: number[]) {
  console.log(`〰️ Wave mode activated`)

  controls.forEach((control) => {
    specialKnobs.add(control)
    knobModes.set(control, MODES.WAVE)
  })

  let phase = 0

  const waveTimer = setInterval(() => {
    controls.forEach((control, index) => {
      // Create a sine wave pattern
      const value = Math.floor(63.5 + 63.5 * Math.sin(phase + index * 0.5))
      setLed(control, value)
    })

    phase += 0.1
    if (phase > Math.PI * 2) phase -= Math.PI * 2
  }, 50)

  animationTimers.push(waveTimer)
}

// FEATURE 8: BINARY COUNTER - display binary counting pattern
function activateBinaryCounter(controls: number[]) {
  console.log(`🔢 Binary counter activated`)

  controls.forEach((control) => {
    specialKnobs.add(control)
    knobModes.set(control, MODES.BINARY)
    setLed(control, 0)
  })

  let counter = 0

  const binaryTimer = setInterval(() => {
    // Convert to binary and update LEDs
    const binary = counter.toString(2).padStart(controls.length, "0")

    controls.forEach((control, index) => {
      setLed(control, binary[index] === "1" ? 127 : 0)
    })

    counter = (counter + 1) % 2 ** controls.length
  }, 300)

  animationTimers.push(binaryTimer)
}

// FEATURE 9: FIBONACCI SEQUENCE - visualize the Fibonacci sequence
function activateFibonacciMode(controls: number[]) {
  console.log(`🌀 Fibonacci mode activated`)

  controls.forEach((control) => {
    specialKnobs.add(control)
    knobModes.set(control, MODES.FIBONACCI)
  })

  // Generate Fibonacci sequence normalized to 0-127
  const fibonacci = [0, 1]
  for (let i = 2; i < 20; i++) {
    fibonacci[i] = fibonacci[i - 1] + fibonacci[i - 2]
  }

  // Normalize to 0-127 range
  const max = Math.max(...fibonacci)
  const normalized = fibonacci.map((n) => Math.floor((n / max) * 127))

  let position = 0

  const fibTimer = setInterval(() => {
    controls.forEach((control, index) => {
      const fibIndex = (position + index) % normalized.length
      setLed(control, normalized[fibIndex])
    })

    position = (position + 1) % normalized.length
  }, 300)

  animationTimers.push(fibTimer)
}

// FEATURE 10: SIMON GAME - memory game with sequence
function startSimonGame(controls: number[]) {
  console.log(`🎮 Simon game started`)

  controls.forEach((control) => {
    specialKnobs.add(control)
    knobModes.set(control, MODES.SIMON)
    setLed(control, 0)
  })

  simonSequence = []
  simonUserPosition = 0
  simonActive = true

  // Add a random step to the sequence
  addStepToSimon(controls)
}

function addStepToSimon(controls: number[]) {
  // Add random step
  const randomIndex = Math.floor(Math.random() * controls.length)
  simonSequence.push(controls[randomIndex])

  // Reset user position
  simonUserPosition = 0

  // Display the sequence
  let stepIndex = 0

  const showStep = () => {
    // Turn off all LEDs
    controls.forEach((control) => setLed(control, 0))

    // Show current step
    if (stepIndex < simonSequence.length) {
      const control = simonSequence[stepIndex]
      setLed(control, 127)

      stepIndex++
      setTimeout(() => {
        setLed(control, 0)
        setTimeout(showStep, 200)
      }, 500)
    }
  }

  showStep()
}

function checkSimonPress(control: number, controls: number[]) {
  if (!simonActive) return

  // Check if the pressed button matches the current step
  if (control === simonSequence[simonUserPosition]) {
    // Flash to confirm correct press
    setLed(control, 127)
    setTimeout(() => setLed(control, 0), 200)

    simonUserPosition++

    // If completed the sequence
    if (simonUserPosition >= simonSequence.length) {
      // Success! Add a new step after delay
      setTimeout(() => {
        addStepToSimon(controls)
      }, 1000)
    }
  } else {
    // Wrong button - game over
    console.log(`❌ Simon game over! Score: ${simonSequence.length - 1}`)

    // Flash all buttons to indicate failure
    const flashAll = (times: number) => {
      if (times <= 0) {
        controls.forEach((c) => setLed(c, 0))
        simonActive = false
        return
      }

      controls.forEach((c) => setLed(c, 127))
      setTimeout(() => {
        controls.forEach((c) => setLed(c, 0))
        setTimeout(() => flashAll(times - 1), 200)
      }, 200)
    }

    flashAll(3)
  }
}

// Command interpreter - for button combinations
let commandBuffer: { control: number; time: number }[] = []
const COMMAND_TIMEOUT = 1000 // ms

function processCommand(control: number) {
  // Add to command buffer
  commandBuffer.push({ control, time: Date.now() })

  // Remove old commands
  commandBuffer = commandBuffer.filter((cmd) => Date.now() - cmd.time < COMMAND_TIMEOUT)

  // Get unique controls in the buffer
  const uniqueControls = Array.from(new Set(commandBuffer.map((cmd) => cmd.control)))

  // Check for special commands
  if (uniqueControls.length === 2) {
    const [controlA, controlB] = uniqueControls
    activateMirrorMode(controlA, controlB)
    return true
  }

  if (uniqueControls.length === 4) {
    // Four quick presses = chase effect
    activateChaseMode(uniqueControls)
    return true
  }

  if (uniqueControls.length === 3) {
    // Three quick presses = pulse middle knob
    const middleControl = uniqueControls[1]
    activatePulseMode(middleControl)
    return true
  }

  if (uniqueControls.length === 5) {
    // Five quick presses = rainbow
    activateRainbowMode(uniqueControls)
    return true
  }

  return false
}

// Reset all knobs to normal mode
function resetAllKnobs() {
  console.log("🔄 Resetting all knobs to normal mode")
  stopAnimations()
  simonActive = false

  // Reset all knobs
  Array.from(specialKnobs).forEach((control) => {
    knobModes.delete(control)
    setLed(control, 0)
  })

  specialKnobs.clear()
}

// Main event handler
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

  // Store knob value
  if (chan === KNOB_CHANNEL) {
    knobValues.set(control, value)
  }

  // Handle special modes
  if (specialKnobs.has(control)) {
    const mode = knobModes.get(control)

    if (mode === MODES.MIRROR && chan === KNOB_CHANNEL) {
      // Find the mirrored knob
      Array.from(specialKnobs).forEach((otherControl) => {
        if (otherControl !== control && knobModes.get(otherControl) === MODES.MIRROR) {
          setLed(otherControl, 127 - value)
        }
      })
      return
    }

    if (mode === MODES.SIMON && chan === BUTTON_CHANNEL && value === 127) {
      // Simon game button press
      const simonControls = Array.from(specialKnobs).filter((c) => knobModes.get(c) === MODES.SIMON)
      checkSimonPress(control, simonControls)
      return
    }
  }

  // Button press commands
  if (chan === BUTTON_CHANNEL && value === 127) {
    // Check for long press (hold) - reset all modes
    const longPressTimer = setTimeout(() => {
      resetAllKnobs()
    }, 2000)

    // Process command sequences
    if (processCommand(control)) {
      clearTimeout(longPressTimer)
      return
    }

    // KNOB LINKING FUNCTIONALITY
    if (firstKnob === null) {
      // Store the current knob's value
      const currentKnobKey = `${KNOB_CHANNEL}:${control}`
      if (seen.has(currentKnobKey)) {
        firstKnob = { control, value: knobValues.get(control) || 0 }
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

// Handle MIDI errors
input.on("error", (err) => {
  console.error("MIDI input error:", err)
})

// Start Simon game on knobs 0-3 when program starts
setTimeout(() => {
  startSimonGame([0, 1, 2, 3])
}, 1000)

console.log("🎛️  Fidget Toy Knobs running")
console.log("🔗 Link knobs: Press two knobs sequentially")
console.log("🎮 Simon game is active on knobs 0-3")
console.log("🪄 Special modes:")
console.log("  • Press 2 knobs quickly = Mirror mode")
console.log("  • Press 3 knobs quickly = Pulse middle knob")
console.log("  • Press 4 knobs quickly = Chase mode")
console.log("  • Press 5 knobs quickly = Rainbow mode")
console.log("  • Hold any button 2sec = Reset all modes")

// — cleanup —
process.once("SIGINT", () => {
  stopAnimations()
  input.closePort()
  output.closePort()
  process.exit(0)
})
