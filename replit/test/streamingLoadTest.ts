import OpenAI from "openai"

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-alice-secret-key-123",
})

const CONCURRENCY = 50
const TOTAL_REQUESTS = 500

async function sendRequest(
  id: number,
): Promise<{ id: number; latencyMs: number; success: boolean; chunks: number }> {
  const start = Date.now()
  try {
    const stream = await client.chat.completions.create({
      model: "llama3.2:1b",
      messages: [{ role: "user", content: `Request ${id}: What is 1+1?` }],
      max_tokens: 10,
      stream: true,
    })

    let chunks = 0
    for await (const _chunk of stream) {
      chunks++
    }

    return { id, latencyMs: Date.now() - start, success: true, chunks }
  } catch {
    return { id, latencyMs: Date.now() - start, success: false, chunks: 0 }
  }
}

async function main() {
  console.log(`Streaming load test: ${TOTAL_REQUESTS} requests, ${CONCURRENCY} concurrent\n`)

  const results: { id: number; latencyMs: number; success: boolean; chunks: number }[] = []
  let nextId = 0

  const start = Date.now()

  while (nextId < TOTAL_REQUESTS) {
    const batch = []
    for (let i = 0; i < CONCURRENCY && nextId < TOTAL_REQUESTS; i++, nextId++) {
      batch.push(sendRequest(nextId))
    }
    const batchResults = await Promise.all(batch)
    results.push(...batchResults)

    const completed = results.length
    const elapsed = (Date.now() - start) / 1000
    process.stdout.write(
      `\r${completed}/${TOTAL_REQUESTS} (${(completed / elapsed).toFixed(1)} req/s)`,
    )
  }

  const totalTime = (Date.now() - start) / 1000
  const successes = results.filter((r) => r.success)
  const failures = results.filter((r) => !r.success)
  const latencies = successes.map((r) => r.latencyMs).sort((a, b) => a - b)
  const totalChunks = successes.reduce((sum, r) => sum + r.chunks, 0)

  console.log("\n\n--- Streaming Load Test Results ---")
  console.log(`Total time: ${totalTime.toFixed(2)}s`)
  console.log(`Throughput: ${(TOTAL_REQUESTS / totalTime).toFixed(1)} req/s`)
  console.log(`Success: ${successes.length}, Failures: ${failures.length}`)
  console.log(
    `Total chunks received: ${totalChunks} (avg ${(totalChunks / successes.length).toFixed(1)} per request)`,
  )
  if (latencies.length > 0) {
    console.log(`Latency p50: ${latencies[Math.floor(latencies.length * 0.5)]}ms`)
    console.log(`Latency p95: ${latencies[Math.floor(latencies.length * 0.95)]}ms`)
    console.log(`Latency p99: ${latencies[Math.floor(latencies.length * 0.99)]}ms`)
  }
}

main()
