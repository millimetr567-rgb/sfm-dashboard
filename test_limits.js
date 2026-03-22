const API_URL = 'http://localhost:3000/api'

async function testLimits() {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  })
  const { token } = await loginRes.json()

  const clientsRes = await fetch(`${API_URL}/clients`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const testClient = (await clientsRes.json())[0]

  console.log(`Pushing debt closer to limit (Limit is ${testClient.creditLimit.toLocaleString()})`)
  
  const currentDebt = testClient.currentDebt
  const limit80 = testClient.creditLimit * 0.8
  
  if (currentDebt < limit80) {
     const orderRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        clientId: testClient.id,
        amount: limit80 - currentDebt + 1000 // Push slightly over 80%
      })
    })
    console.log(await orderRes.json())
  }

  // Check Cron Trigger
  const cronLimitsRes = await fetch(`${API_URL}/cron/trigger-limits`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  console.log('Cron limits result:', await cronLimitsRes.json())
}
testLimits()
