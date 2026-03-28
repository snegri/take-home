import OpenAI from "openai"

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-alice-secret-key-123",
})

const ADMIN_URL = "http://localhost:8000"
const ADMIN_KEY = "admin-secret-key"

async function adminSetLimits(userId: string, limits: Record<string, number>) {
  const res = await fetch(`${ADMIN_URL}/admin/users/${userId}/limits`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify(limits),
  })
  return res.json()
}

async function adminDeleteLimits(userId: string) {
  const res = await fetch(`${ADMIN_URL}/admin/users/${userId}/limits`, {
    method: "DELETE",
    headers: { "x-admin-key": ADMIN_KEY },
  })
  return res.json()
}

async function getUsers() {
  const res = await fetch(`${ADMIN_URL}/admin/users`, {
    headers: { "x-admin-key": ADMIN_KEY },
  })
  return res.json()
}

async function testConcurrentTokenLimit() {
  console.log("--- Test: Concurrent Token Limit Enforcement ---\n")

  const { users } = await getUsers()
  const alice = users.find((u: any) => u.name === "Alice")
  if (!alice) throw new Error("Alice not found")

  // Set total token limit to 100
  await adminSetLimits(alice.id, { totalTokenLimit: 100 })
  console.log("Set Alice's total token limit to 100")
  console.log("Sending 5 concurrent requests with max_tokens: 25 each")
  console.log("Expected: 4 succeed (25+25+25+25=100), 1 rejected (125>100)\n")

  // Fire 5 concurrent requests, each reserving 25 tokens
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      client.chat.completions
        .create({
          model: "llama3.2:1b",
          messages: [{ role: "user", content: `Request ${i}: Say hi` }],
          max_tokens: 25,
        })
        .then(() => ({ id: i, status: "success" as const }))
        .catch((err: any) => ({ id: i, status: "rejected" as const, code: err.status })),
    ),
  )

  const successes = results.filter((r) => r.status === "success")
  const rejections = results.filter((r) => r.status === "rejected")

  console.log(`Successes: ${successes.length} (expected 4)`)
  console.log(`Rejections: ${rejections.length} (expected 1)`)
  for (const r of rejections) {
    console.log(`  Request ${r.id} rejected with status ${r.code}`)
  }

  if (successes.length === 4 && rejections.length === 1 && rejections[0].code === 429) {
    console.log("\nPASS - Lua script atomicity confirmed under concurrency")
  } else {
    console.log("\nFAIL - unexpected results")
    console.log("Results:", JSON.stringify(results, null, 2))
  }

  // Clean up
  await adminDeleteLimits(alice.id)
  console.log("Cleaned up Alice's limits\n")
}

async function main() {
  try {
    await testConcurrentTokenLimit()
  } catch (err) {
    console.error("Test failed:", err)
    process.exit(1)
  }
}

main()
