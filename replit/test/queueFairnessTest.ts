import OpenAI from "openai"

// Requires server started with:
//   OLLAMA_CONCURRENCY=1 MAX_QUEUE_SIZE=15

const alice = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-alice-secret-key-123",
})

const bob = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-bob-secret-key-456",
})

interface CompletionResult {
  user: string
  id: number
  completedAt: number
}

async function testFairness() {
  console.log("--- Test: Fair Queueing ---")
  console.log("Server config: OLLAMA_CONCURRENCY=1 MAX_QUEUE_SIZE=15")
  console.log("Alice sends 10 requests, then Bob sends 1.")
  console.log("Bob should complete before Alice's later requests.\n")

  const completionOrder: CompletionResult[] = []

  // Alice fires 10 requests (don't await yet)
  const alicePromises = Array.from({ length: 10 }, (_, i) =>
    alice.chat.completions
      .create({
        model: "llama3.2:1b",
        messages: [{ role: "user", content: `Alice request ${i}: Say hi` }],
        max_tokens: 10,
      })
      .then(() => {
        const result = { user: "Alice", id: i, completedAt: Date.now() }
        completionOrder.push(result)
        return result
      })
      .catch((err: any) => {
        const result = { user: "Alice", id: i, completedAt: Date.now() }
        completionOrder.push(result)
        console.log(`  Alice request ${i} failed: ${err.status}`)
        return result
      }),
  )

  // Small delay to let Alice's requests hit the queue
  await new Promise((r) => setTimeout(r, 200))

  // Bob fires 1 request
  const bobPromise = bob.chat.completions
    .create({
      model: "llama3.2:1b",
      messages: [{ role: "user", content: "Bob request: Say hi" }],
      max_tokens: 10,
    })
    .then(() => {
      const result = { user: "Bob", id: 0, completedAt: Date.now() }
      completionOrder.push(result)
      return result
    })

  // Wait for everything
  await Promise.all([...alicePromises, bobPromise])

  // Sort by completion time
  completionOrder.sort((a, b) => a.completedAt - b.completedAt)

  console.log("Completion order:")
  completionOrder.forEach((r, idx) => {
    console.log(`  ${idx + 1}. ${r.user} #${r.id}`)
  })

  const bobPosition = completionOrder.findIndex((r) => r.user === "Bob") + 1
  console.log(`\nBob completed at position ${bobPosition} out of ${completionOrder.length}`)

  // Bob should complete somewhere in the first few, not last
  // Alice's first request (priority 0) is already running when Bob arrives,
  // so Bob (priority 0) queues behind it. But Bob should beat Alice's
  // requests that have priority -1, -2, ... -9
  if (bobPosition <= 3) {
    console.log("PASS - Bob was prioritized ahead of Alice's backlog")
  } else {
    console.log("FAIL - Bob was not prioritized (expected position <= 3)")
  }
}

async function main() {
  try {
    await testFairness()
  } catch (err) {
    console.error("Test failed:", err)
    process.exit(1)
  }
}

main()
