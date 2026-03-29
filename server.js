import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '20mb' }))

// Serve static Vite build
app.use(express.static(path.join(__dirname, 'dist')))

// AI Food Analysis endpoint using OpenRouter (free vision model)
app.post('/api/analyze-food', async (req, res) => {
  try {
    const { imageBase64, foodName, expiryAt } = req.body
    const apiKey = process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured on server' })
    }
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image provided' })
    }

    // Determine mime type and ensure full data URL
    const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
    const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${imageBase64}`

    const hoursLeft = expiryAt
      ? Math.round((new Date(expiryAt) - new Date()) / 3600000)
      : null

    const prompt = `You are a food safety expert. Analyze this food image and provide a JSON response only (no markdown, no extra text).

Food name: ${foodName || 'Unknown'}
${hoursLeft !== null ? `Expires in: ${hoursLeft} hours` : ''}

Respond with ONLY this JSON structure:
{
  "safeToEat": true or false,
  "freshnessScore": number from 1-10 (10 = perfectly fresh),
  "condition": one of "Excellent", "Good", "Fair", "Poor", "Unsafe",
  "summary": "1-2 sentence assessment of the food",
  "warnings": ["list of any concerns, empty array if none"],
  "recommendation": "Short actionable advice for the donor"
}`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://foodbridge.app',
        'X-Title': 'FoodBridge AI Analysis'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-nano-12b-v2-vl:free',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        max_tokens: 1500
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || `OpenRouter error: ${response.status}`)
    }

    const msg = data.choices?.[0]?.message
    // Nvidia reasoning model: answer may be in content or reasoning field
    const text = (msg?.content || msg?.reasoning || '').trim()
    if (!text) throw new Error('Empty AI response')

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid AI response format')

    const analysis = JSON.parse(jsonMatch[0])
    res.json({ success: true, analysis })

  } catch (err) {
    console.error('Food analysis error:', err.message)
    res.status(500).json({ error: err.message || 'Analysis failed' })
  }
})

// All other routes → serve React app (Express 5 wildcard syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`FoodBridge server running on port ${PORT}`)
})
