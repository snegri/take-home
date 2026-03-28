import { ChatCompletionRequest, ContentPart } from "../types"
import { logger } from "../logger"

async function resolveContentPart(part: ContentPart): Promise<ContentPart> {
  if (part.type !== "image_url") return part

  const url = part.image_url.url
  if (url.startsWith("data:")) return part

  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get("content-type") || "image/jpeg"
  const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`

  logger.info("Resolved image URL to base64", { url, contentType, bytes: buffer.length })

  return { ...part, image_url: { ...part.image_url, url: dataUri } }
}

export async function resolveImageUrls(body: ChatCompletionRequest): Promise<ChatCompletionRequest> {
  const messages = await Promise.all(
    body.messages.map(async (msg) => {
      if (typeof msg.content === "string") return msg

      const content = await Promise.all(msg.content.map(resolveContentPart))
      return { ...msg, content }
    }),
  )
  return { ...body, messages }
}
