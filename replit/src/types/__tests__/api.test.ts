import { ChatCompletionRequestSchema, ChatCompletionChunkSchema, TokenUsageSchema } from "../api"

let passed = 0
let failed = 0

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  PASS - ${name}`)
    passed++
  } else {
    console.log(`  FAIL - ${name}`)
    failed++
  }
}

console.log("\n--- TokenUsageSchema ---")

assert(
  TokenUsageSchema.safeParse({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }).success,
  "accepts valid input",
)

assert(!TokenUsageSchema.safeParse({ prompt_tokens: "ten" }).success, "rejects non-numeric tokens")

console.log("\n--- ChatCompletionRequestSchema ---")

assert(
  ChatCompletionRequestSchema.safeParse({
    model: "llama3.2:1b",
    messages: [{ role: "user", content: "Hello" }],
  }).success,
  "accepts minimal valid input",
)

assert(
  !ChatCompletionRequestSchema.safeParse({
    messages: [{ role: "user", content: "Hello" }],
  }).success,
  "rejects missing model",
)

assert(
  ChatCompletionRequestSchema.safeParse({
    model: "moondream",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          { type: "image_url", image_url: { url: "https://example.com/img.png" } },
        ],
      },
    ],
  }).success,
  "accepts vision content parts",
)

console.log("\n--- ChatCompletionChunkSchema ---")

assert(
  ChatCompletionChunkSchema.safeParse({
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 1000,
    model: "llama3.2:1b",
    choices: [{ index: 0, delta: { content: "Hi" }, finish_reason: null }],
  }).success,
  "accepts chunk without usage",
)

assert(
  ChatCompletionChunkSchema.safeParse({
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 1000,
    model: "llama3.2:1b",
    choices: [],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }).success,
  "accepts chunk with usage",
)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
