import OpenAI from "openai"

// Requires server started with:
//   OLLAMA_CONCURRENCY=1 MAX_QUEUE_SIZE=3

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-alice-secret-key-123",
})

const ADMIN_URL = "http://localhost:8000"
const ADMIN_KEY = "admin-secret-key"

async function getQueueStats() {
  const res = await fetch(`${ADMIN_URL}/admin/queue`, {
    headers: { "x-admin-key": ADMIN_KEY },
  })
  return res.json()
}

async function testQueueBackpressure() {
  console.log("--- Test: Queue Backpressure (503 when full) ---")
  console.log("Server config: OLLAMA_CONCURRENCY=1 MAX_QUEUE_SIZE=3")
  console.log("With concurrency=1, only 1 runs + 2 wait = 3 total. 4th gets 503.\n")

  const TOTAL_REQUESTS = 6

  console.log(`Sending ${TOTAL_REQUESTS} concurrent requests`)
  console.log("Expected: 3 succeed, 3 rejected with 503\n")

  const results = await Promise.all(
    Array.from({ length: TOTAL_REQUESTS }, (_, i) =>
      client.chat.completions
        .create({
          model: "llama3.2:1b",
          messages: [{ role: "user", content: `Queue test ${i}: Say hello` }],
          max_tokens: 50,
        })
        .then(() => ({ id: i, status: "success" as const }))
        .catch((err: any) => ({
          id: i,
          status: "rejected" as const,
          code: err.status,
        })),
    ),
  )

  const successes = results.filter((r) => r.status === "success")
  const rejections = results.filter((r) => r.status === "rejected" && r.code === 503)
  const other = results.filter((r) => r.status === "rejected" && r.code !== 503)

  console.log(`Successes: ${successes.length}`)
  console.log(`503 Rejections: ${rejections.length}`)
  if (other.length > 0) {
    console.log(`Other errors: ${other.length}`)
    for (const r of other) {
      console.log(`  Request ${r.id}: status ${r.code}`)
    }
  }

  // Check queue stats after all requests complete
  const stats = await getQueueStats()
  console.log("\nQueue stats:", JSON.stringify(stats, null, 2))

  if (rejections.length > 0 && successes.length > 0) {
    console.log("\nPASS - Queue backpressure working")
  } else if (rejections.length === 0) {
    console.log(
      "\nFAIL - No 503s. Is the server running with OLLAMA_CONCURRENCY=1 MAX_QUEUE_SIZE=3?",
    )
  } else {
    console.log("\nFAIL - Unexpected results")
  }
}

async function main() {
  try {
    await testQueueBackpressure()
  } catch (err) {
    console.error("Test failed:", err)
    process.exit(1)
  }
}

main()
