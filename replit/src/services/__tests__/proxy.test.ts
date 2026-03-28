import { createParser } from "eventsource-parser"
import { ChatCompletionChunkSchema, TokenUsage } from "../../types"

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

// Helper that mirrors the parser callback in handleStreamingCompletion
function extractUsageViaParser(...chunks: string[]): TokenUsage | null {
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
        // malformed JSON
      }
    },
  })
  for (const chunk of chunks) {
    parser.feed(chunk)
  }
  return usage
}

console.log("\n--- SSE usage extraction (eventsource-parser) ---")

assert(
  extractUsageViaParser(
    'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000,"model":"llama3.2:1b","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
  )?.total_tokens === 15,
  "extracts usage from chunk with usage field",
)

assert(
  extractUsageViaParser(
    'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000,"model":"llama3.2:1b","choices":[{"index":0,"delta":{"role":"assistant","content":"Hi"},"finish_reason":null}]}\n\n',
  ) === null,
  "returns null for chunk without usage",
)

assert(extractUsageViaParser("data: [DONE]\n\n") === null, "returns null for [DONE] sentinel")

assert(extractUsageViaParser("") === null, "returns null for empty string")

// Multi-event stream
const multiResult = extractUsageViaParser(
  'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000,"model":"llama3.2:1b","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
  'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000,"model":"llama3.2:1b","choices":[],"usage":{"prompt_tokens":27,"completion_tokens":26,"total_tokens":53}}\n\n',
  "data: [DONE]\n\n",
)
assert(
  multiResult?.prompt_tokens === 27 &&
    multiResult?.completion_tokens === 26 &&
    multiResult?.total_tokens === 53,
  "extracts usage from multi-event stream",
)

// Chunk boundary split — JSON split across two read() calls
const splitResult = extractUsageViaParser(
  'data: {"id":"chatcmpl-1","object":"chat.completion.ch',
  'unk","created":1000,"model":"llama3.2:1b","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
)
assert(splitResult?.total_tokens === 15, "handles chunk boundary split across reads")

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
