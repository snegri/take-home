import { Request, Response } from "express"
import { createParser } from "eventsource-parser"
import { config } from "../config"
import {
  ChatCompletionChunkSchema,
  ChatCompletionRequest,
  ChatCompletionResponseSchema,
  TokenUsage,
} from "../types"
import { resolveImageUrls } from "./resolveImageUrls"

const OLLAMA_COMPLETIONS_URL = `${config.ollamaUrl}/v1/chat/completions`

/**
 * Handle a non-streaming chat completion request.
 * - Forward the request body to Ollama's /v1/chat/completions
 * - Return the full response to the client
 * - Return the token usage so the caller can track it
 */
export async function handleCompletion(
  req: Request,
  res: Response,
  body: ChatCompletionRequest,
  signal: AbortSignal,
): Promise<TokenUsage | null> {
  const resolvedBody = await resolveImageUrls(body)
  const response = await fetch(OLLAMA_COMPLETIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resolvedBody),
    signal,
  })

  if (!response.ok) {
    const error = await response.json()
    res.status(response.status).json(error)
    req.log?.error("Ollama error", { status: response.status, error })
    return null
  }

  const data = await response.json()

  res.json(data)

  const parsed = ChatCompletionResponseSchema.safeParse(data)
  if (!parsed.success) {
    return null
  }
  req.log?.info("Usage:", parsed.data.usage)
  return parsed.data.usage
}

/**
 * Handle a streaming chat completion request.
 * - Forward the request to Ollama with stream: true
 * - Pipe SSE chunks back to the client
 * - Extract token usage from the final chunk
 * - Return the token usage so the caller can track it
 */
export async function handleStreamingCompletion(
  req: Request,
  res: Response,
  body: ChatCompletionRequest,
  signal: AbortSignal,
): Promise<TokenUsage | null> {
  const resolvedBody = await resolveImageUrls(body)
  const streamBody = { ...resolvedBody, stream_options: { include_usage: true } }
  const response = await fetch(OLLAMA_COMPLETIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(streamBody),
    signal,
  })

  if (!response.ok) {
    const error = await response.json()
    res.status(response.status).json(error)
    req.log?.error("Ollama error", { status: response.status, error })
    return null
  }

  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")

  const reader = response.body?.getReader()
  if (!reader) {
    res.status(500).json({ error: "Failed to get reader" })
    return null
  }

  const decoder = new TextDecoder()
  let usage: TokenUsage | null = null

  const parser = createParser({
    onEvent(event) {
      if (event.data === "[DONE]") return
      try {
        const parsed = ChatCompletionChunkSchema.safeParse(JSON.parse(event.data))
        if (parsed.success && parsed.data.usage) {
          usage = parsed.data.usage
        }
      } catch {
        // malformed JSON — skip
      }
    },
  })

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    res.write(text)
    parser.feed(text)
  }

  res.end()
  return usage
}
