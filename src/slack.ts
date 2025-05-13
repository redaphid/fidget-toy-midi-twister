import { strict as assert } from "node:assert"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url" // Keep for ES Module __dirname equivalent
import { setLed, Colors } from "./modes/interface.ts"
import { Output } from "@julusian/midi"

export const setProfilePhoto = async ({ output, knob, token }: { output: Output; knob: number; token: string }) => {
  assert(token, "SLACK_TOKEN is not set")

  // Get current directory in ES Modules
  const __filename = fileURLToPath(import.meta.url)
  const currentDir = path.dirname(__filename)
  const imagePath = path.resolve(currentDir, "..", "images", "profile", `${knob}.png`)
  console.log(`imagePath: ${imagePath}`)
  if (!existsSync(imagePath)) {
    setLed(output, knob, Colors.YELLOW)
    console.error(`Images directory does not exist: ${imagePath}`)
    return
  }
  try {
    const imageBuffer = readFileSync(imagePath)
    const imageBlob = new Blob([imageBuffer])
    const formData = new FormData()
    // Use the actual image name when appending
    formData.append("image", imageBlob, imagePath)
    const res = await fetch("https://slack.com/api/users.setPhoto", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) {
      setLed(output, knob, Colors.PINK)
      console.error(`Failed to set profile photo: ${res.statusText}`)
      return
    }
  } catch (error: any) {
    setLed(output, knob, Colors.RED)
    console.error(`Error reading image file ${imagePath}:`, error.message)
    return
  }

  setLed(output, knob, Colors.GREEN)
  console.log(`Successfully set profile photo using image index ${knob}.`)
}
