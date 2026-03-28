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

async function testTokenLimit() {
  console.log("--- Test: Token Limit Enforcement ---")

  // Get Alice's user ID
  const { users } = await getUsers()
  const alice = users.find((u: any) => u.name === "Alice")
  if (!alice) throw new Error("Alice not found")

  // Set a very low total token limit
  await adminSetLimits(alice.id, { totalTokenLimit: 50 })
  console.log("Set Alice's total token limit to 50")

  // First request should work
  try {
    const res = await client.chat.completions.create({
      model: "llama3.2:1b",
      messages: [{ role: "user", content: "Say hi" }],
      max_tokens: 10,
    })
    console.log("First request succeeded, usage:", res.usage)
  } catch (err: any) {
    console.log("First request failed unexpectedly:", err.message)
  }

  // Subsequent requests should hit the limit
  try {
    await client.chat.completions.create({
      model: "llama3.2:1b",
      messages: [{ role: "user", content: "Say hi again" }],
      max_tokens: 100,
    })
    console.log("FAIL - should have been rate limited")
  } catch (err: any) {
    if (err.status === 429) {
      console.log("Got 429 as expected:", err.message)
      console.log("PASS")
    } else {
      console.log("FAIL - unexpected error:", err.status, err.message)
    }
  }

  // Clean up
  await adminDeleteLimits(alice.id)
  console.log("Cleaned up Alice's limits\n")
}

async function main() {
  try {
    await testTokenLimit()
    console.log("Rate limit tests passed!")
  } catch (err) {
    console.error("Test failed:", err)
    process.exit(1)
  }
}

main()
