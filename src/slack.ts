import { strict as assert } from "node:assert"
import { readdirSync, readFileSync } from "node:fs"
import * as path from "node:path"
import { setLed, Colors } from "./modes/interface.ts"
import { Output } from "@julusian/midi"

export const setProfilePhoto = async ({ output, knob, token }: { output: Output; knob: number; token: string }) => {
  assert(token, "SLACK_TOKEN is not set")
  // iterate over the images directory. This is node.
  const images = readdirSync(path.join(__dirname, "images"))
  const image = images[knob]
  if (!image) {
    setLed(output, knob, Colors.YELLOW)
    return
  }
  // load the image as a blob. From the file
  const imageBuffer = readFileSync(path.join(__dirname, "images", image))
  const imageBlob = new Blob([imageBuffer])
  const formData = new FormData()
  formData.append("image", imageBlob, "favicon.ico")
  const res = await fetch("https://slack.com/api/users.setPhoto", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    setLed(output, knob, Colors.RED)
    console.error(`Failed to set profile photo: ${res.statusText}`)
    return
  }
  setLed(output, knob, Colors.GREEN)
}
