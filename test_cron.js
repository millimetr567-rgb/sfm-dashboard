

const API_URL = 'http://localhost:3000/api'

async function testCron() {
  try {
    // 1. Login as admin
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    })
    const { token } = await loginRes.json()
    console.log('Logged in!')

    // 2. Get first active client
    const clientsRes = await fetch(`${API_URL}/clients`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const clients = await clientsRes.json()
    const testClient = clients.find(c => c.status === 'ACTIVE')
    if (!testClient) return console.log('No active client found');

    // 3. Create an OVERDUE order
    console.log(`Creating OVERDUE order for ${testClient.name}`)
    const orderRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        clientId: testClient.id,
        amount: 50000,
        coordinates: '12,34',
        due_date: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      })
    })
    const order = await orderRes.json()
    if (order.error) {
      console.log('Order creation failed:', order.error)
      // Might be exceeding limit
    } else {
      console.log(`Overdue order created with ID: ${order.id}`)
    }

    // 4. Trigger Overdue checks
    console.log('Triggering Overdue cron...')
    const cronOverdueRes = await fetch(`${API_URL}/cron/trigger-overdue`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    console.log('Cron overdue result:', await cronOverdueRes.json())

    // 5. Trigger Limits check
    console.log('Triggering Limits cron...')
    const cronLimitsRes = await fetch(`${API_URL}/cron/trigger-limits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    console.log('Cron limits result:', await cronLimitsRes.json())

  } catch (err) {
    console.error('Test failed:', err)
  }
}

testCron()
