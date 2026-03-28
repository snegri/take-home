import OpenAI from "openai"

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-alice-secret-key-123",
})

async function testBasicCompletion() {
  console.log("--- Test: Basic Chat Completion ---")
  const response = await client.chat.completions.create({
    model: "llama3.2:1b",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is 2+2? Reply with just the number." },
    ],
    temperature: 0.7,
    max_tokens: 100,
  })

  console.log("Response:", response)
  console.log("Usage:", response.usage)
  console.log("Model:", response.model)
  console.log("PASS\n")
}

async function testStreaming() {
  console.log("--- Test: Streaming Chat Completion ---")
  const stream = await client.chat.completions.create({
    model: "llama3.2:1b",
    messages: [{ role: "user", content: "Count from 1 to 5." }],
    stream: true,
    max_tokens: 100,
  })

  process.stdout.write("Streaming: ")
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || ""
    process.stdout.write(content)
  }
  console.log("\nPASS\n")
}

async function testAuthFailure() {
  console.log("--- Test: Auth Failure ---")
  const badClient = new OpenAI({
    baseURL: "http://localhost:8000/v1",
    apiKey: "sk-invalid-key",
  })

  try {
    await badClient.chat.completions.create({
      model: "llama3.2:1b",
      messages: [{ role: "user", content: "Hello" }],
    })
    console.log("FAIL - should have thrown\n")
  } catch (err: any) {
    if (err.status === 401) {
      console.log("Got 401 as expected")
      console.log("PASS\n")
    } else {
      console.log("FAIL - unexpected error:", err.message, "\n")
    }
  }
}

async function main() {
  try {
    await testBasicCompletion()
    await testStreaming()
    await testAuthFailure()
    console.log("All basic tests passed!")
  } catch (err) {
    console.error("Test failed:", err)
    process.exit(1)
  }
}

main()
