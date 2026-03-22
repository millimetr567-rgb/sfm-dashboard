const fetch = require('node-fetch')

const API_URL = 'http://localhost:3000/api'

async function test() {
  try {
    // 1. Login as admin (Created by seed)
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    })
    const { token } = await loginRes.json()
    console.log('Logged in!')

    // 2. Get clients
    const clientsRes = await fetch(`${API_URL}/clients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const clients = await clientsRes.json()
    const testClient = clients.find(c => c.name === 'Test Client 1')
    
    if (!testClient) {
      console.log('Test client not found')
      return
    }

    // 3. Create Order
    console.log(`Creating order for ${testClient.name} (ID: ${testClient.id})`)
    const orderRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        clientId: testClient.id,
        amount: 250000,
        coordinates: '41.123,69.123',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days later
      })
    })

    const order = await orderRes.json()
    console.log('Order created:', order.id)
    console.log('Client current debt:', order.client.currentDebt.toLocaleString())

  } catch (err) {
    console.error('Test failed:', err)
  }
}

test()
