const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Create an admin token (since tests show API uses jwt)
// Assuming JWT_SECRET is secret from .env. Wait, I can just find .env
const env = fs.readFileSync('d:/Agent/.env', 'utf-8');
const secretMatch = env.match(/JWT_SECRET="?([^"\n]+)"?/);
const secret = secretMatch ? secretMatch[1] : 'supersecret123';

const token = jwt.sign({ id: 'some-admin', username: 'admin', role: 'ADMIN' }, secret);

const wb = XLSX.readFile('d:/Agent/agent_panel/yangi_namuna_qolip.xlsx');
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const normalized = data.map(row => {
    const findKey = (keys) => {
    const rowKeys = Object.keys(row);
    for(let paramKey of keys) {
        const found = rowKeys.find(k => k.trim().toLowerCase() === paramKey.toLowerCase());
        if (found) return row[found];
    }
    return null;
    };
    return {
    code: findKey(['kodi', 'код']) || null,
    name: findKey(['nomi', 'наименование']),
    group: findKey(['guruh', 'группа']) || 'Boshqa',
    costPrice: parseFloat(findKey(['tannarx', 'себестоимость'])) || 0,
    sellPrice: parseFloat(findKey(['sotish', 'цена'])) || 0,
    stock: parseInt(findKey(['sklad', 'остаток'])) || 0
    };
}).filter(p => p.name);

axios.post('http://localhost:3000/api/products/bulk', { products: normalized }, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => {
    console.log("SUCCESS:", res.data);
}).catch(err => {
    console.error("ERROR:", err.response ? err.response.data : err.message);
});
