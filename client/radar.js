// Подключение к серверу через Socket.IO
const socket = io('http://localhost:1350');

// Объявляем переменные в начале файла
let xMinInput, xMaxInput, yMinInput, yMaxInput, applyBoundsButton, resetBoundsButton, zoomInButton, zoomOutButton, toggleViewButton, autoBoundsButton;

// Получаем элемент canvas и его контекст
const canvas = document.getElementById('radar');
const ctx = canvas.getContext('2d');

// Текущее состояние игры и карта
let currentGameState = {};
let currentMap = '';
let mapImage = null;

// Конфигурация радара
const radarConfig = {
  size: 300,
  showBig: false,
  scale: 5,
  mapConfig: {
    'de_dust2': { scale: 5.5, offsetX: 2350, offsetY: 1750, zoom: 4.4, 
                  pos_x_min: -2476, pos_y_min: -1150, pos_x_max: 2376, pos_y_max: 3250 },
    'de_mirage': { scale: 5, offsetX: 3230, offsetY: 1713, zoom: 4.5,
                  pos_x_min: -3230, pos_y_min: -1713, pos_x_max: 1713, pos_y_max: 3230 },
    'de_inferno': { scale: 4.9, offsetX: 2087, offsetY: 1150, zoom: 4.9,
                  pos_x_min: -2087, pos_y_min: -1150, pos_x_max: 1150, pos_y_max: 2087 },
    'de_nuke': { scale: 7, offsetX: 3217, offsetY: 2150, zoom: 6.2,
                  pos_x_min: -3453, pos_y_min: -2150, pos_x_max: 3453, pos_y_max: 2150 },
    'de_overpass': { scale: 5.2, offsetX: 4950, offsetY: 1200, zoom: 5.7,
                  pos_x_min: -4831, pos_y_min: -1200, pos_x_max: 4831, pos_y_max: 1200 },
    'de_vertigo': { scale: 4, offsetX: 3108, offsetY: 713, zoom: 5,
                  pos_x_min: -3108, pos_y_min: -713, pos_x_max: 3108, pos_y_max: 713 },
    'de_ancient': { scale: 6, offsetX: 2253, offsetY: 2119, zoom: 5,
                  pos_x_min: -2253, pos_y_min: -2119, pos_x_max: 2253, pos_y_max: 2119 },
    'de_anubis': { scale: 5, offsetX: 2500, offsetY: 2000, zoom: 5,
                  pos_x_min: -2500, pos_y_min: -2000, pos_x_max: 2500, pos_y_max: 2000 }
  }
};

// Предустановленные границы для популярных карт
const defaultMapBounds = {
  'de_dust2': {
    pos_x_min: -2476,
    pos_y_min: -1150,
    pos_x_max: 2376,
    pos_y_max: 3250
  },
  'de_mirage': {
    pos_x_min: -3230,
    pos_y_min: -1713,
    pos_x_max: 1713,
    pos_y_max: 3230
  },
  'de_inferno': {
    pos_x_min: -2087,
    pos_y_min: -1150,
    pos_x_max: 1150,
    pos_y_max: 2087
  },
  'de_nuke': {
    pos_x_min: -3453,
    pos_y_min: -2150,
    pos_x_max: 3453,
    pos_y_max: 2150
  },
  'de_overpass': {
    pos_x_min: -4831,
    pos_y_min: -1200,
    pos_x_max: 4831,
    pos_y_max: 1200
  },
  'de_vertigo': {
    pos_x_min: -3108,
    pos_y_min: -713,
    pos_x_max: 3108,
    pos_y_max: 713
  },
  'de_ancient': {
    pos_x_min: -2253,
    pos_y_min: -2119,
    pos_x_max: 2253,
    pos_y_max: 2119
  },
  'de_anubis': {
    pos_x_min: -2500,
    pos_y_min: -2000,
    pos_x_max: 2500,
    pos_y_max: 2000
  }
};

// Автоматическое определение границ карты на основе позиций игроков
let mapBoundsTracking = {
  enabled: true,
  samples: {},
  minSamples: 100,         // Увеличиваем минимальное количество образцов
  updateInterval: 10000,   // Увеличиваем интервал обновления до 10 секунд
  lastUpdate: {},          // Отслеживаем время последнего обновления для каждой карты
  minUpdateInterval: 30000 // Минимальный интервал между обновлениями границ (30 секунд)
};

// Обработка событий подключения
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

// Обработка данных от сервера
socket.on('gameState', (gameState) => {
  currentGameState = gameState;
  
  if (gameState && gameState.map && gameState.map.name) {
    const newMap = gameState.map.name;
    if (newMap !== currentMap) {
      currentMap = newMap;
      loadMapImage(currentMap);
      
      // Если нет конфигурации для этой карты, создаем базовую
      if (!radarConfig.mapConfig[currentMap]) {
        console.log(`Creating default config for map: ${currentMap}`);
        radarConfig.mapConfig[currentMap] = {
          scale: 5,
          offsetX: 2000,
          offsetY: 2000,
          zoom: 5,
          pos_x_min: -3000,
          pos_y_min: -3000,
          pos_x_max: 3000,
          pos_y_max: 3000
        };
      }
      
      // Пытаемся загрузить сохраненные границы
      loadBoundsFromLocalStorage();
    }
  }
  
  updateMapInfo();
  drawRadar();
  
  // Отслеживаем границы карты
  trackMapBounds();
});

// Загрузка изображения карты
// Обновляем функцию загрузки изображения карты
function loadMapImage(mapName) {
    if (!mapName) return;
    
    const img = new Image();
    img.onload = function() {
      mapImage = img;
      drawRadar();
    };
    
    // Обработка ошибки загрузки
    img.onerror = function() {
      console.log(`Failed to load map image for ${mapName} from assets folder`);
      
      // Пробуем загрузить с CDN
      img.src = `https://raw.githubusercontent.com/lexogrine/csgo-react-hud/master/public/maps/${mapName}.png`;
      
      // Если и это не сработает, создаем простое изображение
      img.onerror = function() {
        console.log(`Creating simple map image for ${mapName}`);
        img.src = createSimpleMapImage(mapName);
      };
    };
    
    // Загружаем изображение из папки assets
    img.src = `assets/maps/${mapName}/radar.png`;
  }
  
  // Функция для создания простого изображения карты
  function createSimpleMapImage(mapName) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    // Заливаем фон
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, 600, 600);
    
    // Рисуем сетку
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 600; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(600, i);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 600);
      ctx.stroke();
    }
    
    // Добавляем название карты
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(mapName, 300, 300);
    
    return canvas.toDataURL('image/png');
  }

// Изменение размера радара
function resizeRadar() {
  const radarSize = radarConfig.showBig ? 600 : radarConfig.size;
  canvas.width = radarSize;
  canvas.height = radarSize;
}

// Обновление информации о карте
function updateMapInfo() {
  const mapNameElement = document.getElementById('map-name');
  const roundInfoElement = document.getElementById('round-info');
  
  if (mapNameElement && currentMap) {
    mapNameElement.textContent = currentMap;
  }
  
  if (roundInfoElement && currentGameState.map) {
    const team_ct = currentGameState.map.team_ct || {};
    const team_t = currentGameState.map.team_t || {};
    roundInfoElement.textContent = `CT: ${team_ct.score || 0} - T: ${team_t.score || 0}`;
  }
}

// Преобразование координат игры в координаты на радаре
function transformPositionToRadar(position, mapConfig, radarSize) {
  if (!position || !mapConfig) {
    console.log("Invalid position or map config:", { position, mapConfig });
    return { x: 0, y: 0 };
  }
  
  // Используем min/max координаты для более точного масштабирования
  const { pos_x_min, pos_y_min, pos_x_max, pos_y_max } = mapConfig;
  
  // Нормализуем координаты от 0 до 1
  const normalizedX = (position.x - pos_x_min) / (pos_x_max - pos_x_min);
  const normalizedY = (position.y - pos_y_min) / (pos_y_max - pos_y_min);
  
  // Инвертируем Y-координату (в игре Y растет вверх, на радаре - вниз)
  const invertedY = 1 - normalizedY;
  
  // Преобразуем в координаты радара
  const x = normalizedX * radarSize;
  const y = invertedY * radarSize;
  
  return { x, y };
}

// Отрисовка радара
function drawRadar() {
    if (!currentGameState || !mapImage) return;
    
    const radarSize = radarConfig.showBig ? 600 : radarConfig.size;
    ctx.clearRect(0, 0, radarSize, radarSize);
    
    // Отрисовка фона карты
    ctx.drawImage(mapImage, 0, 0, radarSize, radarSize);
    
    // Получение конфигурации для текущей карты
    const mapConfig = radarConfig.mapConfig[currentMap];
    if (!mapConfig) {
      console.log('No map config for:', currentMap);
      return;
    }
    
    // Отрисовка игроков
    if (currentGameState.allplayers) {
      Object.values(currentGameState.allplayers).forEach(player => {
        // Проверяем, жив ли игрок
        if (!player.position || player.state && player.state.health <= 0) {
          return; // Пропускаем мертвых игроков
        }
        
        // Извлечение координат в зависимости от формата
        let x, y;
        
        if (typeof player.position === 'string') {
          // Формат "x, y, z"
          const coords = player.position.split(', ').map(Number);
          x = coords[0];
          y = coords[1];
        } else if (typeof player.position === 'object') {
          // Формат {x: number, y: number, z: number}
          x = player.position.x;
          y = player.position.y;
        } else {
          console.log('Unknown position format:', player.position);
          return;
        }
        
        const radarPos = transformPositionToRadar(
          { x, y },
          mapConfig,
          radarSize
        );
        
        // Проверка, находится ли игрок в пределах радара
        if (radarPos.x < 0 || radarPos.x > radarSize || radarPos.y < 0 || radarPos.y > radarSize) {
          console.log(`Player ${player.name} is outside radar bounds:`, radarPos);
          return;
        }
        
        // Определение цвета в зависимости от команды
        let color;
      if (isDead) {
        color = player.team === 'CT' ? '#2d3b56' : '#6e4d1a'; // Темные цвета для мертвых
      } else {
        color = player.team === 'CT' ? '#5d79ae' : '#de9b35'; // Обычные цвета для живых
      }
        
        // Отрисовка точки игрока
        ctx.beginPath();
        ctx.arc(radarPos.x, radarPos.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Отрисовка направления взгляда игрока
        if (!isDead && player.forward) {
          let forwardX, forwardY;
          
          if (typeof player.forward === 'string') {
            const forwardCoords = player.forward.split(', ').map(Number);
            forwardX = forwardCoords[0];
            forwardY = forwardCoords[1];
          } else if (typeof player.forward === 'object') {
            forwardX = player.forward.x;
            forwardY = player.forward.y;
          } else {
            return;
          }
          
          // Вычисление угла направления взгляда
          const angle = Math.atan2(forwardY, forwardX);
          
          ctx.beginPath();
          ctx.moveTo(radarPos.x, radarPos.y);
          ctx.lineTo(
            radarPos.x + Math.cos(angle) * 10,
            radarPos.y + Math.sin(angle) * 10
          );
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        
         // Отображение имени игрока
      ctx.fillStyle = isDead ? '#888888' : 'white'; // Серый цвет для мертвых
      ctx.font = '10px Arial';
      ctx.fillText(player.name, radarPos.x + 7, radarPos.y + 3);
      
      // Отображение здоровья только для живых игроков
      if (!isDead && player.state && player.state.health) {
          const health = player.state.health;
          // Определяем цвет полоски здоровья
          let healthColor;
          if (health > 70) {
            healthColor = '#00ff00'; // Зеленый для высокого здоровья
          } else if (health > 30) {
            healthColor = '#ffff00'; // Желтый для среднего здоровья
          } else {
            healthColor = '#ff0000'; // Красный для низкого здоровья
          }
          
          // Рисуем полоску здоровья
          const healthBarWidth = 20 * (health / 100);
          ctx.fillStyle = healthColor;
          ctx.fillRect(radarPos.x - 10, radarPos.y - 10, healthBarWidth, 3);
        }
      });
    }
    
    // Отрисовка бомбы, если она есть
    if (currentGameState.bomb && currentGameState.bomb.position) {
      let x, y;
      
      if (typeof currentGameState.bomb.position === 'string') {
        const coords = currentGameState.bomb.position.split(', ').map(Number);
        x = coords[0];
        y = coords[1];
      } else if (typeof currentGameState.bomb.position === 'object') {
        x = currentGameState.bomb.position.x;
        y = currentGameState.bomb.position.y;
      } else {
        console.log('Unknown bomb position format:', currentGameState.bomb.position);
        return;
      }
      
      const radarPos = transformPositionToRadar(
        { x, y },
        mapConfig,
        radarSize
      );
      
      // Проверка, находится ли бомба в пределах радара
      if (radarPos.x >= 0 && radarPos.x <= radarSize && radarPos.y >= 0 && radarPos.y <= radarSize) {
        ctx.beginPath();
        ctx.arc(radarPos.x, radarPos.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
      }
    }
  }

// Автоматическое определение границ карты
function trackMapBounds() {
  if (!currentGameState || !currentGameState.allplayers || !mapBoundsTracking.enabled) return;
  
  if (!mapBoundsTracking.samples[currentMap]) {
    mapBoundsTracking.samples[currentMap] = {
      x_values: [],
      y_values: [],
      count: 0
    };
    mapBoundsTracking.lastUpdate[currentMap] = 0;
  }
  
  const mapSamples = mapBoundsTracking.samples[currentMap];
  const now = Date.now();
  
  // Собираем координаты всех игроков
  Object.values(currentGameState.allplayers).forEach(player => {
    if (!player.position) return;
    
    let x, y;
    if (typeof player.position === 'string') {
      const coords = player.position.split(', ').map(Number);
      x = coords[0];
      y = coords[1];
    } else if (typeof player.position === 'object') {
      x = player.position.x;
      y = player.position.y;
    } else {
      return;
    }
    
    mapSamples.x_values.push(x);
    mapSamples.y_values.push(y);
    mapSamples.count++;
  });
  
  // Если собрано достаточно образцов и прошло достаточно времени с последнего обновления
  if (mapSamples.count >= mapBoundsTracking.minSamples && 
      now - mapBoundsTracking.lastUpdate[currentMap] >= mapBoundsTracking.minUpdateInterval) {
    
    // Находим 5% и 95% перцентили для отсечения выбросов
    mapSamples.x_values.sort((a, b) => a - b);
    mapSamples.y_values.sort((a, b) => a - b);
    
    const lowerIndex = Math.floor(mapSamples.count * 0.05);
    const upperIndex = Math.floor(mapSamples.count * 0.95);
    
    const x_min = mapSamples.x_values[lowerIndex];
    const x_max = mapSamples.x_values[upperIndex];
    const y_min = mapSamples.y_values[lowerIndex];
    const y_max = mapSamples.y_values[upperIndex];
    
    // Добавляем запас по краям
    const padding = 300;
    
    // Проверяем, существенно ли изменились границы
    let shouldUpdate = false;
    
    if (radarConfig.mapConfig[currentMap]) {
      const currentBounds = radarConfig.mapConfig[currentMap];
      const xMinDiff = Math.abs(currentBounds.pos_x_min - (x_min - padding));
      const xMaxDiff = Math.abs(currentBounds.pos_x_max - (x_max + padding));
      const yMinDiff = Math.abs(currentBounds.pos_y_min - (y_min - padding));
      const yMaxDiff = Math.abs(currentBounds.pos_y_max - (y_max + padding));
      
      // Обновляем только если изменения существенны (более 10%)
      const threshold = 0.1;
      const xRange = Math.abs(currentBounds.pos_x_max - currentBounds.pos_x_min);
      const yRange = Math.abs(currentBounds.pos_y_max - currentBounds.pos_y_min);
      
      shouldUpdate = 
        xMinDiff > xRange * threshold || 
        xMaxDiff > xRange * threshold || 
        yMinDiff > yRange * threshold || 
        yMaxDiff > yRange * threshold;
    } else {
      shouldUpdate = true;
    }
    
    if (shouldUpdate) {
      // Обновляем конфигурацию карты
      if (!radarConfig.mapConfig[currentMap]) {
        radarConfig.mapConfig[currentMap] = {
          scale: 5,
          offsetX: 2000,
          offsetY: 2000,
          zoom: 5
        };
      }
      
      radarConfig.mapConfig[currentMap].pos_x_min = x_min - padding;
      radarConfig.mapConfig[currentMap].pos_x_max = x_max + padding;
      radarConfig.mapConfig[currentMap].pos_y_min = y_min - padding;
      radarConfig.mapConfig[currentMap].pos_y_max = y_max + padding;
      
      console.log(`Updated map bounds for ${currentMap}:`, {
        x_min: x_min - padding,
        x_max: x_max + padding,
        y_min: y_min - padding,
        y_max: y_max + padding
      });
      
      // Обновляем поля ввода
      updateBoundsInputs();
      
      // Запоминаем время обновления
      mapBoundsTracking.lastUpdate[currentMap] = now;
      
      // Сохраняем настройки в localStorage
      saveBoundsToLocalStorage();
    }
    
    // Сбрасываем сбор образцов
    mapBoundsTracking.samples[currentMap] = {
      x_values: [],
      y_values: [],
      count: 0
    };
  }
}

// Сохранение настроек границ в localStorage
function saveBoundsToLocalStorage() {
  if (!currentMap || !radarConfig.mapConfig[currentMap]) return;
  
  const bounds = {
    pos_x_min: radarConfig.mapConfig[currentMap].pos_x_min,
    pos_x_max: radarConfig.mapConfig[currentMap].pos_x_max,
    pos_y_min: radarConfig.mapConfig[currentMap].pos_y_min,
    pos_y_max: radarConfig.mapConfig[currentMap].pos_y_max
  };
  
  try {
    localStorage.setItem(`radar_bounds_${currentMap}`, JSON.stringify(bounds));
    console.log(`Saved bounds for ${currentMap} to localStorage`);
  } catch (e) {
    console.error('Failed to save bounds to localStorage:', e);
  }
}

// Загрузка настроек границ из localStorage
function loadBoundsFromLocalStorage() {
  if (!currentMap) return false;
  
  try {
    const boundsJson = localStorage.getItem(`radar_bounds_${currentMap}`);
    if (!boundsJson) return false;
    
    const bounds = JSON.parse(boundsJson);
    
    if (!radarConfig.mapConfig[currentMap]) {
      radarConfig.mapConfig[currentMap] = {
        scale: 5,
        offsetX: 2000,
        offsetY: 2000,
        zoom: 5
      };
    }
    
    radarConfig.mapConfig[currentMap].pos_x_min = bounds.pos_x_min;
    radarConfig.mapConfig[currentMap].pos_x_max = bounds.pos_x_max;
    radarConfig.mapConfig[currentMap].pos_y_min = bounds.pos_y_min;
    radarConfig.mapConfig[currentMap].pos_y_max = bounds.pos_y_max;
    
    console.log(`Loaded bounds for ${currentMap} from localStorage:`, bounds);
    updateBoundsInputs();
    return true;
  } catch (e) {
    console.error('Failed to load bounds from localStorage:', e);
    return false;
  }
}

// Инициализация элементов управления
function initControlElements() {
  xMinInput = document.getElementById('x-min');
  xMaxInput = document.getElementById('x-max');
  yMinInput = document.getElementById('y-min');
  yMaxInput = document.getElementById('y-max');
  applyBoundsButton = document.getElementById('apply-bounds');
  resetBoundsButton = document.getElementById('reset-bounds');
  zoomInButton = document.getElementById('zoom-in');
  zoomOutButton = document.getElementById('zoom-out');
  toggleViewButton = document.getElementById('toggle-view');
  autoBoundsButton = document.getElementById('auto-bounds');
  
  // Добавляем обработчики событий только если элементы существуют
  if (applyBoundsButton) {
    applyBoundsButton.addEventListener('click', () => {
      if (!currentMap || !radarConfig.mapConfig[currentMap]) return;
      
      radarConfig.mapConfig[currentMap].pos_x_min = Number(xMinInput.value);
      radarConfig.mapConfig[currentMap].pos_x_max = Number(xMaxInput.value);
      radarConfig.mapConfig[currentMap].pos_y_min = Number(yMinInput.value);
      radarConfig.mapConfig[currentMap].pos_y_max = Number(yMaxInput.value);
      
      saveBoundsToLocalStorage();
      drawRadar();
    });
  }
  
  if (resetBoundsButton) {
    resetBoundsButton.addEventListener('click', () => {
      if (!currentMap) return;
      
      // Используем предустановленные границы, если они есть
      if (defaultMapBounds[currentMap]) {
        radarConfig.mapConfig[currentMap] = {
          ...radarConfig.mapConfig[currentMap],
          ...defaultMapBounds[currentMap]
        };
      } else {
        // Для других карт используем базовые значения
        radarConfig.mapConfig[currentMap] = {
          scale: 5,
          offsetX: 2000,
          offsetY: 2000,
          zoom: 5,
          pos_x_min: -3000,
          pos_y_min: -3000,
          pos_x_max: 3000,
          pos_y_max: 3000
        };
      }
      
      updateBoundsInputs();
      saveBoundsToLocalStorage();
      drawRadar();
    });
  }
  
  if (zoomInButton) {
    zoomInButton.addEventListener('click', () => {
      radarConfig.scale *= 1.1;
      drawRadar();
    });
  }
  
  if (zoomOutButton) {
    zoomOutButton.addEventListener('click', () => {
      radarConfig.scale *= 0.9;
      drawRadar();
    });
  }
  
  if (toggleViewButton) {
    toggleViewButton.addEventListener('click', () => {
      radarConfig.showBig = !radarConfig.showBig;
      resizeRadar();
      drawRadar();
    });
  }
  
  if (autoBoundsButton) {
    autoBoundsButton.addEventListener('click', () => {
      mapBoundsTracking.enabled = !mapBoundsTracking.enabled;
      autoBoundsButton.textContent = mapBoundsTracking.enabled ? 'Auto Bounds: ON' : 'Auto Bounds: OFF';
    });
  }
}

// Обновление полей ввода при смене карты
function updateBoundsInputs() {
  if (!currentMap || !radarConfig.mapConfig[currentMap]) return;
  
  // Проверяем, инициализированы ли элементы управления
  if (!xMinInput || !xMaxInput || !yMinInput || !yMaxInput) {
    console.log('Control elements not initialized yet');
    return;
  }
  
  const config = radarConfig.mapConfig[currentMap];
  xMinInput.value = config.pos_x_min;
  xMaxInput.value = config.pos_x_max;
  yMinInput.value = config.pos_y_min;
  yMaxInput.value = config.pos_y_max;
}

// Функция для создания элементов управления, если их нет в HTML
function createControlElements() {
  const radarControls = document.getElementById('radar-controls');
  if (!radarControls) {
    console.log('No radar-controls element found, creating one');
    const radarContainer = document.getElementById('radar-container') || document.body;
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'radar-controls';
    radarContainer.appendChild(controlsDiv);
  }
  
  const radarControlsElement = document.getElementById('radar-controls');
  
  // Создаем элементы управления, если их нет
  if (!document.getElementById('zoom-in')) {
    const zoomInBtn = document.createElement('button');
    zoomInBtn.id = 'zoom-in';
    zoomInBtn.textContent = '+';
    radarControlsElement.appendChild(zoomInBtn);
  }
  
  if (!document.getElementById('zoom-out')) {
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.id = 'zoom-out';
    zoomOutBtn.textContent = '-';
    radarControlsElement.appendChild(zoomOutBtn);
  }
  
  if (!document.getElementById('toggle-view')) {
    const toggleViewBtn = document.createElement('button');
    toggleViewBtn.id = 'toggle-view';
    toggleViewBtn.textContent = 'Toggle View';
    radarControlsElement.appendChild(toggleViewBtn);
  }
  
  // Создаем контейнер для настроек границ
  const boundsContainer = document.createElement('div');
  boundsContainer.style.marginTop = '10px';
  
  if (!document.getElementById('x-min')) {
    const xMinLabel = document.createElement('label');
    xMinLabel.textContent = 'X Min: ';
    xMinLabel.htmlFor = 'x-min';
    boundsContainer.appendChild(xMinLabel);
    
    const xMinInput = document.createElement('input');
    xMinInput.type = 'number';
    xMinInput.id = 'x-min';
    xMinInput.step = '100';
    boundsContainer.appendChild(xMinInput);
  }
  
  if (!document.getElementById('x-max')) {
    const xMaxLabel = document.createElement('label');
    xMaxLabel.textContent = ' X Max: ';
    xMaxLabel.htmlFor = 'x-max';
    boundsContainer.appendChild(xMaxLabel);
    
    const xMaxInput = document.createElement('input');
    xMaxInput.type = 'number';
    xMaxInput.id = 'x-max';
    xMaxInput.step = '100';
    boundsContainer.appendChild(xMaxInput);
  }
  
  boundsContainer.appendChild(document.createElement('br'));
  
  if (!document.getElementById('y-min')) {
    const yMinLabel = document.createElement('label');
    yMinLabel.textContent = 'Y Min: ';
    yMinLabel.htmlFor = 'y-min';
    boundsContainer.appendChild(yMinLabel);
    
    const yMinInput = document.createElement('input');
    yMinInput.type = 'number';
    yMinInput.id = 'y-min';
    yMinInput.step = '100';
    boundsContainer.appendChild(yMinInput);
  }
  
  if (!document.getElementById('y-max')) {
    const yMaxLabel = document.createElement('label');
    yMaxLabel.textContent = ' Y Max: ';
    yMaxLabel.htmlFor = 'y-max';
    boundsContainer.appendChild(yMaxLabel);
    
    const yMaxInput = document.createElement('input');
    yMaxInput.type = 'number';
    yMaxInput.id = 'y-max';
    yMaxInput.step = '100';
    boundsContainer.appendChild(yMaxInput);
  }
  
  radarControlsElement.appendChild(boundsContainer);
  
  // Создаем кнопки
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.marginTop = '10px';
  
  if (!document.getElementById('apply-bounds')) {
    const applyBoundsBtn = document.createElement('button');
    applyBoundsBtn.id = 'apply-bounds';
    applyBoundsBtn.textContent = 'Apply';
    buttonsContainer.appendChild(applyBoundsBtn);
  }
  
  if (!document.getElementById('reset-bounds')) {
    const resetBoundsBtn = document.createElement('button');
    resetBoundsBtn.id = 'reset-bounds';
    resetBoundsBtn.textContent = 'Reset Bounds';
    buttonsContainer.appendChild(resetBoundsBtn);
  }
  
  if (!document.getElementById('auto-bounds')) {
    const autoBoundsBtn = document.createElement('button');
    autoBoundsBtn.id = 'auto-bounds';
    autoBoundsBtn.textContent = mapBoundsTracking.enabled ? 'Auto Bounds: ON' : 'Auto Bounds: OFF';
    buttonsContainer.appendChild(autoBoundsBtn);
  }
  
  radarControlsElement.appendChild(buttonsContainer);
  
  // Инициализируем элементы управления
  initControlElements();
}



// Изменение размера радара
function resizeRadar() {
  const radarSize = radarConfig.showBig ? 600 : radarConfig.size;
  canvas.width = radarSize;
  canvas.height = radarSize;
}

// Обновление информации о карте
function updateMapInfo() {
  const mapNameElement = document.getElementById('map-name');
  const roundInfoElement = document.getElementById('round-info');
  
  if (mapNameElement && currentMap) {
    mapNameElement.textContent = `Map: ${currentMap}`;
  }
  
  if (roundInfoElement && currentGameState.map) {
    const team_ct = currentGameState.map.team_ct || {};
    const team_t = currentGameState.map.team_t || {};
    roundInfoElement.textContent = `Score: CT ${team_ct.score || 0} - ${team_t.score || 0} T`;
  }
}

// Преобразование координат игры в координаты на радаре
function transformPositionToRadar(position, mapConfig, radarSize) {
  if (!position || !mapConfig) {
    console.log("Invalid position or map config:", { position, mapConfig });
    return { x: 0, y: 0 };
  }
  
  // Используем min/max координаты для более точного масштабирования
  const { pos_x_min, pos_y_min, pos_x_max, pos_y_max } = mapConfig;
  
  // Нормализуем координаты от 0 до 1
  const normalizedX = (position.x - pos_x_min) / (pos_x_max - pos_x_min);
  const normalizedY = (position.y - pos_y_min) / (pos_y_max - pos_y_min);
  
  // Инвертируем Y-координату (в игре Y растет вверх, на радаре - вниз)
  const invertedY = 1 - normalizedY;
  
  // Преобразуем в координаты радара
  const x = normalizedX * radarSize;
  const y = invertedY * radarSize;
  
  return { x, y };
}

// Отрисовка радара
function drawRadar() {
  if (!currentGameState || !mapImage) return;
  
  const radarSize = radarConfig.showBig ? 600 : radarConfig.size;
  ctx.clearRect(0, 0, radarSize, radarSize);
  
  // Отрисовка фона карты
  ctx.drawImage(mapImage, 0, 0, radarSize, radarSize);
  
  // Получение конфигурации для текущей карты
  const mapConfig = radarConfig.mapConfig[currentMap];
  if (!mapConfig) {
    console.log('No map config for:', currentMap);
    return;
  }
  
  // Отрисовка игроков
  if (currentGameState.allplayers) {
    Object.values(currentGameState.allplayers).forEach(player => {
      if (!player.position) {
        console.log('No position for player:', player.name);
        return;
      }
      
      // Извлечение координат в зависимости от формата
      let x, y;
      
      if (typeof player.position === 'string') {
        // Формат "x, y, z"
        const coords = player.position.split(', ').map(Number);
        x = coords[0];
        y = coords[1];
      } else if (typeof player.position === 'object') {
        // Формат {x: number, y: number}
        x = player.position.x;
        y = player.position.y;
      } else {
        console.log('Unknown position format for player:', player.name, player.position);
        return;
      }
      
      const radarPos = transformPositionToRadar(
        { x, y },
        mapConfig,
        radarSize
      );
      
      // Проверка, находится ли игрок в пределах радара
      if (radarPos.x < 0 || radarPos.x > radarSize || radarPos.y < 0 || radarPos.y > radarSize) {
        console.log(`Player ${player.name} is outside radar bounds:`, radarPos);
        return;
      }
      
      // Определение цвета в зависимости от команды
      const color = player.team === 'CT' ? '#0000FF' : '#FF0000';
      
      // Отрисовка игрока
      ctx.beginPath();
      ctx.arc(radarPos.x, radarPos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Отрисовка направления взгляда
      if (player.forward) {
        let forwardX, forwardY;
        
        if (typeof player.forward === 'string') {
          const forwardCoords = player.forward.split(', ').map(Number);
          forwardX = forwardCoords[0];
          forwardY = forwardCoords[1];
        } else if (typeof player.forward === 'object') {
          forwardX = player.forward.x;
          forwardY = player.forward.y;
        } else {
          return;
        }
        
        // Нормализация вектора направления
        const length = Math.sqrt(forwardX * forwardX + forwardY * forwardY);
        if (length > 0) {
          forwardX /= length;
          forwardY /= length;
        }
        
        // Инвертируем Y для отрисовки
        forwardY = -forwardY;
        
        // Отрисовка линии направления
        ctx.beginPath();
        ctx.moveTo(radarPos.x, radarPos.y);
        ctx.lineTo(radarPos.x + forwardX * 10, radarPos.y + forwardY * 10);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Отрисовка имени игрока
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px Arial';
      ctx.fillText(player.name, radarPos.x + 7, radarPos.y - 7);
      
      // Отрисовка здоровья
      if (player.state && player.state.health) {
        const health = player.state.health;
        const healthColor = health > 50 ? '#00FF00' : health > 20 ? '#FFFF00' : '#FF0000';
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(radarPos.x - 10, radarPos.y + 7, 20, 3);
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(radarPos.x - 10, radarPos.y + 7, health / 5, 3);
      }
    });
  }
  
  // Отрисовка бомбы, если она есть
  if (currentGameState.bomb && currentGameState.bomb.position) {
    let x, y;
    
    if (typeof currentGameState.bomb.position === 'string') {
      const coords = currentGameState.bomb.position.split(', ').map(Number);
      x = coords[0];
      y = coords[1];
    } else if (typeof currentGameState.bomb.position === 'object') {
      x = currentGameState.bomb.position.x;
      y = currentGameState.bomb.position.y;
    } else {
      console.log('Unknown bomb position format:', currentGameState.bomb.position);
      return;
    }
    
    const radarPos = transformPositionToRadar(
      { x, y },
      mapConfig,
      radarSize
    );
    
    // Проверка, находится ли бомба в пределах радара
    if (radarPos.x >= 0 && radarPos.x <= radarSize && radarPos.y >= 0 && radarPos.y <= radarSize) {
      ctx.beginPath();
      ctx.arc(radarPos.x, radarPos.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FF0000';
      ctx.fill();
      
      // Отрисовка текста "BOMB"
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px Arial';
      ctx.fillText('BOMB', radarPos.x + 7, radarPos.y - 7);
    }
  }
}

// Автоматическое определение границ карты
function trackMapBounds() {
  if (!currentGameState || !currentGameState.allplayers || !mapBoundsTracking.enabled) return;
  
  if (!mapBoundsTracking.samples[currentMap]) {
    mapBoundsTracking.samples[currentMap] = {
      x_values: [],
      y_values: [],
      count: 0
    };
    mapBoundsTracking.lastUpdate[currentMap] = 0;
  }
  
  const mapSamples = mapBoundsTracking.samples[currentMap];
  const now = Date.now();
  
  // Собираем координаты всех игроков
  Object.values(currentGameState.allplayers).forEach(player => {
    if (!player.position) return;
    
    let x, y;
    if (typeof player.position === 'string') {
      const coords = player.position.split(', ').map(Number);
      x = coords[0];
      y = coords[1];
    } else if (typeof player.position === 'object') {
      x = player.position.x;
      y = player.position.y;
    } else {
      return;
    }
    
    mapSamples.x_values.push(x);
    mapSamples.y_values.push(y);
    mapSamples.count++;
  });
  
  // Если собрано достаточно образцов и прошло достаточно времени с последнего обновления
  if (mapSamples.count >= mapBoundsTracking.minSamples && 
      now - mapBoundsTracking.lastUpdate[currentMap] >= mapBoundsTracking.minUpdateInterval) {
    
    // Находим 5% и 95% перцентили для отсечения выбросов
    mapSamples.x_values.sort((a, b) => a - b);
    mapSamples.y_values.sort((a, b) => a - b);
    
    const lowerIndex = Math.floor(mapSamples.count * 0.05);
    const upperIndex = Math.floor(mapSamples.count * 0.95);
    
    const x_min = mapSamples.x_values[lowerIndex];
    const x_max = mapSamples.x_values[upperIndex];
    const y_min = mapSamples.y_values[lowerIndex];
    const y_max = mapSamples.y_values[upperIndex];
    
    // Добавляем запас по краям
    const padding = 300;
    
    // Проверяем, существенно ли изменились границы
    let shouldUpdate = false;
    
    if (radarConfig.mapConfig[currentMap]) {
      const currentBounds = radarConfig.mapConfig[currentMap];
      const xMinDiff = Math.abs(currentBounds.pos_x_min - (x_min - padding));
      const xMaxDiff = Math.abs(currentBounds.pos_x_max - (x_max + padding));
      const yMinDiff = Math.abs(currentBounds.pos_y_min - (y_min - padding));
      const yMaxDiff = Math.abs(currentBounds.pos_y_max - (y_max + padding));
      
      // Обновляем только если изменения существенны (более 10%)
      const threshold = 0.1;
      const xRange = Math.abs(currentBounds.pos_x_max - currentBounds.pos_x_min);
      const yRange = Math.abs(currentBounds.pos_y_max - currentBounds.pos_y_min);
      
      shouldUpdate = 
        xMinDiff > xRange * threshold || 
        xMaxDiff > xRange * threshold || 
        yMinDiff > yRange * threshold || 
        yMaxDiff > yRange * threshold;
    } else {
      shouldUpdate = true;
    }
    
    if (shouldUpdate) {
      // Обновляем конфигурацию карты
      if (!radarConfig.mapConfig[currentMap]) {
        radarConfig.mapConfig[currentMap] = {
          scale: 5,
          offsetX: 2000,
          offsetY: 2000,
          zoom: 5
        };
      }
      
      radarConfig.mapConfig[currentMap].pos_x_min = x_min - padding;
      radarConfig.mapConfig[currentMap].pos_x_max = x_max + padding;
      radarConfig.mapConfig[currentMap].pos_y_min = y_min - padding;
      radarConfig.mapConfig[currentMap].pos_y_max = y_max + padding;
      
      console.log(`Updated map bounds for ${currentMap}:`, {
        x_min: x_min - padding,
        x_max: x_max + padding,
        y_min: y_min - padding,
        y_max: y_max + padding
      });
      
      // Обновляем поля ввода
      updateBoundsInputs();
      
      // Запоминаем время обновления
      mapBoundsTracking.lastUpdate[currentMap] = now;
      
      // Сохраняем настройки в localStorage
      saveBoundsToLocalStorage();
    }
    
    // Сбрасываем сбор образцов
    mapBoundsTracking.samples[currentMap] = {
      x_values: [],
      y_values: [],
      count: 0
    };
  }
}

// Сохранение настроек границ в localStorage
function saveBoundsToLocalStorage() {
  if (!currentMap || !radarConfig.mapConfig[currentMap]) return;
  
  const bounds = {
    pos_x_min: radarConfig.mapConfig[currentMap].pos_x_min,
    pos_x_max: radarConfig.mapConfig[currentMap].pos_x_max,
    pos_y_min: radarConfig.mapConfig[currentMap].pos_y_min,
    pos_y_max: radarConfig.mapConfig[currentMap].pos_y_max
  };
  
  try {
    localStorage.setItem(`radar_bounds_${currentMap}`, JSON.stringify(bounds));
    console.log(`Saved bounds for ${currentMap} to localStorage`);
  } catch (e) {
    console.error('Failed to save bounds to localStorage:', e);
  }
}

// Загрузка настроек границ из localStorage
function loadBoundsFromLocalStorage() {
  if (!currentMap) return false;
  
  try {
    const boundsJson = localStorage.getItem(`radar_bounds_${currentMap}`);
    if (!boundsJson) return false;
    
    const bounds = JSON.parse(boundsJson);
    
    if (!radarConfig.mapConfig[currentMap]) {
      radarConfig.mapConfig[currentMap] = {
        scale: 5,
        offsetX: 2000,
        offsetY: 2000,
        zoom: 5
      };
    }
    
    radarConfig.mapConfig[currentMap].pos_x_min = bounds.pos_x_min;
    radarConfig.mapConfig[currentMap].pos_x_max = bounds.pos_x_max;
    radarConfig.mapConfig[currentMap].pos_y_min = bounds.pos_y_min;
    radarConfig.mapConfig[currentMap].pos_y_max = bounds.pos_y_max;
    
    console.log(`Loaded bounds for ${currentMap} from localStorage:`, bounds);
    updateBoundsInputs();
    return true;
  } catch (e) {
    console.error('Failed to load bounds from localStorage:', e);
    return false;
  }
}

// Обработка данных от сервера
socket.on('gameState', (gameState) => {
  currentGameState = gameState;
  
  if (gameState && gameState.map && gameState.map.name) {
    const newMap = gameState.map.name;
    if (newMap !== currentMap) {
      currentMap = newMap;
      loadMapImage(currentMap);
      
      // Если нет конфигурации для этой карты, создаем базовую
      if (!radarConfig.mapConfig[currentMap]) {
        console.log(`Creating default config for map: ${currentMap}`);
        radarConfig.mapConfig[currentMap] = {
          scale: 5,
          offsetX: 2000,
          offsetY: 2000,
          zoom: 5,
          pos_x_min: -3000,
          pos_y_min: -3000,
          pos_x_max: 3000,
          pos_y_max: 3000
        };
      }
      
      // Пытаемся загрузить сохраненные границы
      loadBoundsFromLocalStorage();
    }
  }
  
  updateMapInfo();
  drawRadar();
  
  // Отслеживаем границы карты
  trackMapBounds();
});

// Запуск отслеживания границ карты
setInterval(trackMapBounds, mapBoundsTracking.updateInterval);

// Инициализация радара
function initRadar() {
  resizeRadar();
  createControlElements();
  
  // Если нет данных от GSI, загрузим карту по умолчанию для демонстрации
  if (!currentMap) {
    currentMap = 'de_dust2';
    loadMapImage(currentMap);
  }
}

// Запуск
initRadar();