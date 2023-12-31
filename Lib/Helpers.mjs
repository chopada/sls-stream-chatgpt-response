const env = process.env
const { OPENAI_API_KEY } = env

async function fetchData(config) {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable')
  }
  config.stream = true // Enforce streaming (currently non-streaming not supported)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(config)
  })

  return response.body
}

function isJson(str) {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

// A function to convert a chunk of streaming data (bytes) into objects.
function processChunk(chunk) {
  // chunk contains bytes that we need to decode to a string
  const decoder = new TextDecoder()
  const decodedChunk = decoder.decode(chunk)
  // Each chunk has one or more lines of the following format:
  // data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1999999999,"model":"gpt-3.5-turbo-0613","choices":[{"index":0,"delta":{"content":" test"},"finish_reason":null}]}

  const lines = decodedChunk
    .split('\n') // Each line is seperated by a newline character
    .map((line) => line.replace('data: ', '')) // For each individual line, remove the "data: " prefix
    .filter((line) => line.length > 0 && isJson(line) && line !== '[DONE]') // Remove empty lines and the "[DONE]" line
    .map((line) => {
      try {
        return JSON.parse(line) // Parse each line as JSON
      } catch (error) {
        console.error('Error parsing line:', line)
        throw error
      }
    })

  return lines
}

// A function to stream the response from OpenAI to the client
export const streamOpenAIResponse = function (responseStream, config) {
  return new Promise(async (resolve) => {
    // Declare a variable to hold the full response text as we receive it in chunks from the API.
    let responseFull = ''

    try {
      const bodyStream = await fetchData(config)
      for await (const chunk of bodyStream) {
        const lines = processChunk(chunk)
        for (const line of lines) {
          const content = line.choices[0].delta.content
          if (content) {
            responseStream.write(content)
            responseFull += content
          }
        }
      }
    } catch (error) {
      console.error('Error in streamOpenAIResponse:', error)
      throw error
    }
    resolve(responseFull)
  })
}
