const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Base de dados simulada
let apps = [
  { id: 1, name: "Matrix Hacker Tool", version: "1.0", icon: "", description: "Ferramenta de testes de rede.", link: "#" }
];

let users = [
  { username: "hacker", password: "Heitor24", role: "admin" }
];

// Endpoint de Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, role: user.role });
  } else {
    res.status(401).json({ success: false, message: "Credenciais inválidas" });
  }
});

// Listar Apps
app.get('/api/apps', (req, res) => {
  res.json(apps);
});

// Adicionar App (Admin)
app.post('/api/apps', (req, res) => {
  const newApp = { id: Date.now(), ...req.body };
  apps.push(newApp);
  res.json({ success: true, app: newApp });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
