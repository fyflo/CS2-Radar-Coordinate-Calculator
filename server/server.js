const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static('../client'));

// Хранение последнего состояния игры
let gameState = {};

// Обработка GSI данных - обратите внимание на изменение пути с /api/gsi на /gsi
app.post('/gsi', (req, res) => {
  console.log('Received GSI data');
  
  // Проверка наличия данных об игроках
  if (req.body && req.body.allplayers) {
    console.log(`Received data for ${Object.keys(req.body.allplayers).length} players`);
    console.log('Sample player data:', JSON.stringify(Object.values(req.body.allplayers)[0]).substring(0, 200));
  } else {
    console.log('No player data in GSI payload');
  }
  
  gameState = req.body;
  io.emit('gameState', gameState);
  res.sendStatus(200);
});

// Отправка последнего состояния при подключении клиента
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.emit('gameState', gameState);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Запуск сервера на порту 1350
const PORT = process.env.PORT || 1350;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});