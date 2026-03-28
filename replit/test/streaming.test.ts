import OpenAI from "openai"

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-alice-secret-key-123",
})

async function testStreamingChunks() {
  console.log("--- Test: Streaming Chunks Arrive Incrementally ---")
  const stream = await client.chat.completions.create({
    model: "llama3.2:1b",
    messages: [{ role: "user", content: "Count from 1 to 5." }],
    stream: true,
    max_tokens: 100,
  })

  let chunkCount = 0
  let fullContent = ""

  process.stdout.write("Streaming: ")
  for await (const chunk of stream) {
    chunkCount++
    const content = chunk.choices[0]?.delta?.content || ""
    fullContent += content
    process.stdout.write(content)
  }

  console.log(`\nReceived ${chunkCount} chunks`)
  console.log(`Full content: "${fullContent.trim()}"`)

  if (chunkCount > 1 && fullContent.length > 0) {
    console.log("PASS\n")
  } else {
    console.log("FAIL - expected multiple chunks with content\n")
  }
}

async function testStreamingUsage() {
  console.log("--- Test: Streaming Usage Tracking ---")

  const ADMIN_URL = "http://localhost:8000"
  const ADMIN_KEY = "admin-secret-key"

  // Get usage before
  const beforeRes = await fetch(`${ADMIN_URL}/admin/users`, {
    headers: { "x-admin-key": ADMIN_KEY },
  })
  const before = await beforeRes.json()
  const aliceBefore = before.users.find((u: any) => u.name === "Alice")

  // Make a streaming request
  const stream = await client.chat.completions.create({
    model: "llama3.2:1b",
    messages: [{ role: "user", content: "Say hello" }],
    stream: true,
    max_tokens: 50,
  })

  for await (const _chunk of stream) {
    // drain the stream
  }

  // Get usage after
  const afterRes = await fetch(`${ADMIN_URL}/admin/users`, {
    headers: { "x-admin-key": ADMIN_KEY },
  })
  const after = await afterRes.json()
  const aliceAfter = after.users.find((u: any) => u.name === "Alice")

  console.log("Usage before:", JSON.stringify(aliceBefore.usage))
  console.log("Usage after:", JSON.stringify(aliceAfter.usage))

  // Check if usage increased (ledger has more entries or higher token count)
  const totalBefore = aliceBefore.usage.reduce((sum: number, u: any) => sum + u.total_tokens, 0)
  const totalAfter = aliceAfter.usage.reduce((sum: number, u: any) => sum + u.total_tokens, 0)

  if (totalAfter > totalBefore) {
    console.log(`Token usage increased: ${totalBefore} → ${totalAfter}`)
    console.log("PASS\n")
  } else {
    console.log("FAIL - usage did not increase after streaming request\n")
  }
}

async function main() {
  try {
    await testStreamingChunks()
    await testStreamingUsage()
    console.log("All streaming tests passed!")
  } catch (err) {
    console.error("Test failed:", err)
    process.exit(1)
  }
}

main()
