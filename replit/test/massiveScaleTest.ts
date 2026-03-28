import OpenAI from "openai"

const alice = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-alice-secret-key-123",
})

const bob = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-bob-secret-key-456",
})

const CONCURRENCY = 500
const TOTAL_REQUESTS = 2000

async function sendRequest(
  client: OpenAI,
  user: string,
  id: number,
): Promise<{ user: string; id: number; latencyMs: number; success: boolean; status?: number }> {
  const start = Date.now()
  try {
    await client.chat.completions.create({
      model: "llama3.2:1b",
      messages: [{ role: "user", content: `${user} ${id}: Say hi` }],
      max_tokens: 10,
    })
    return { user, id, latencyMs: Date.now() - start, success: true }
  } catch (err: any) {
    return { user, id, latencyMs: Date.now() - start, success: false, status: err.status }
  }
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.floor(sorted.length * p)]
}

async function main() {
  console.log(`Massive scale test: ${TOTAL_REQUESTS} requests, ${CONCURRENCY} concurrent`)
  console.log("Split evenly between Alice and Bob\n")

  const results: Awaited<ReturnType<typeof sendRequest>>[] = []
  let nextId = 0

  const start = Date.now()

  while (nextId < TOTAL_REQUESTS) {
    const batch = []
    for (let i = 0; i < CONCURRENCY && nextId < TOTAL_REQUESTS; i++, nextId++) {
      const client = nextId % 2 === 0 ? alice : bob
      const user = nextId % 2 === 0 ? "Alice" : "Bob"
      batch.push(sendRequest(client, user, nextId))
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

  // Per-status breakdown of failures
  const failuresByStatus = new Map<number | undefined, number>()
  for (const f of failures) {
    failuresByStatus.set(f.status, (failuresByStatus.get(f.status) ?? 0) + 1)
  }

  // Per-user breakdown
  const aliceResults = successes.filter((r) => r.user === "Alice")
  const bobResults = successes.filter((r) => r.user === "Bob")
  const aliceLatencies = aliceResults.map((r) => r.latencyMs).sort((a, b) => a - b)
  const bobLatencies = bobResults.map((r) => r.latencyMs).sort((a, b) => a - b)

  console.log("\n\n--- Massive Scale Test Results ---")
  console.log(`Total time: ${totalTime.toFixed(2)}s`)
  console.log(`Throughput: ${(TOTAL_REQUESTS / totalTime).toFixed(1)} req/s`)
  console.log(`Success: ${successes.length}, Failures: ${failures.length}`)

  if (failuresByStatus.size > 0) {
    console.log("Failure breakdown:")
    for (const [status, count] of failuresByStatus) {
      console.log(`  ${status ?? "unknown"}: ${count}`)
    }
  }

  if (latencies.length > 0) {
    console.log(`\nOverall latency:`)
    console.log(`  p50: ${percentile(latencies, 0.5)}ms`)
    console.log(`  p95: ${percentile(latencies, 0.95)}ms`)
    console.log(`  p99: ${percentile(latencies, 0.99)}ms`)
    console.log(`  max: ${latencies[latencies.length - 1]}ms`)
  }

  if (aliceLatencies.length > 0 && bobLatencies.length > 0) {
    console.log(`\nPer-user latency:`)
    console.log(
      `  Alice — p50: ${percentile(aliceLatencies, 0.5)}ms, p95: ${percentile(aliceLatencies, 0.95)}ms (${aliceResults.length} ok)`,
    )
    console.log(
      `  Bob   — p50: ${percentile(bobLatencies, 0.5)}ms, p95: ${percentile(bobLatencies, 0.95)}ms (${bobResults.length} ok)`,
    )
  }
}

main()
