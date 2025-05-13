import { Output } from "@julusian/midi"
import { readdirSync, readFileSync } from "fs"
import * as path from "path"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"
import { strict as assert } from "assert"
import { Colors } from "./interface.ts"
import { setProfilePhoto } from "../slack.ts"
export class SlackMode implements FidgetModeInterface {
  output: Output
  getName(): FidgetModeName {
    return "slack"
  }

  activate(output: Output): void {
    console.log(`🎮 Activating Slack game on all 16 knobs`)
    this.output = output
    this.deactivate(output) // Clear previous state
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    return true
  }

  handleButtonPress(output: Output, control: number): boolean {
    setProfilePhoto({ output, knob: control, token: process.env.SLACK_TOKEN })
    return true
  }

  deactivate(output: Output): void {
    console.log("🎮 Deactivated Slack game")
  }
}
