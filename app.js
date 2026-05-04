(function() {
  'use strict';

  var desktop = document.getElementById('desktop');
  var taskbarItems = document.getElementById('taskbar-items');
  var taskbarClock = document.getElementById('taskbar-clock');
  var contextMenu = document.getElementById('context-menu');
  var notificationPanel = document.getElementById('notification-panel');
  var globalSearchEl = document.getElementById('global-search');
  var searchInput = document.getElementById('search-input');
  var lockScreen = document.getElementById('lock-screen');
  var lockTimeEl = document.getElementById('lock-time');
  var lockDateEl = document.getElementById('lock-date');

  var windowZIndex = 100;
  var windowId = 0;
  var activeWindows = {};
  var uploadedFiles = [];

  var fileDB = (function() {
    var db = null;
    var ready = false;
    var waiting = [];
    var req = indexedDB.open('ShadowOSFiles', 1);
    req.onupgradeneeded = function(e) {
      var d = e.target.result;
      if (!d.objectStoreNames.contains('files')) {
        d.createObjectStore('files', { keyPath: 'id' });
      }
    };
    req.onsuccess = function(e) {
      db = e.target.result;
      ready = true;
      while (waiting.length) waiting.shift()(db);
    };
    req.onerror = function() { ready = false; };

    function whenReady(cb) { if (ready) cb(db); else waiting.push(cb); }

    return {
      save: function(file, cb) {
        whenReady(function(d) {
          var tx = d.transaction('files', 'readwrite');
          tx.objectStore('files').put({ id: file.name, data: file, time: Date.now() });
          tx.oncomplete = function() { if (cb) cb(); };
          tx.onerror = function() { if (cb) cb(); };
        });
      },
      loadAll: function(cb) {
        whenReady(function(d) {
          var tx = d.transaction('files', 'readonly');
          var req2 = tx.objectStore('files').getAll();
          req2.onsuccess = function() {
            var files = req2.result.map(function(r) { return r.data; });
            if (cb) cb(files);
          };
          req2.onerror = function() { if (cb) cb([]); };
        });
      },
      remove: function(name) {
        whenReady(function(d) {
          var tx = d.transaction('files', 'readwrite');
          tx.objectStore('files').delete(name);
        });
      }
    };
  })();

  var wallpapers = {
    cyberpunk: 'linear-gradient(135deg, #0a0a0a 0%, #1a0033 25%, #000033 50%, #003333 75%, #0a0a0a 100%)',
    ocean: 'linear-gradient(135deg, #001a33 0%, #003366 25%, #004d80 50%, #006699 75%, #001a33 100%)',
    sunset: 'linear-gradient(135deg, #1a0033 0%, #330066 25%, #660066 50%, #663300 75%, #1a0033 100%)',
    matrix: 'linear-gradient(135deg, #001a00 0%, #003300 25%, #004d00 50%, #003300 75%, #001a00 100%)',
    minimal: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%, #0a0a0a 100%)',
    aurora: 'linear-gradient(135deg, #0a0a2e 0%, #1a0033 25%, #003366 50%, #006666 75%, #0a0a2e 100%)'
  };

  var fileSystem = {
    '/home': null,
    '/docs': '文档目录\n\n存放各类文档和说明文件\n\n文件列表:\n- readme.md\n- guide.txt\n- notes.txt',
    '/readme.txt': 'ShadowOS 暗影系统\n版本: 2.0.0\n描述: 基于浏览器的模拟操作系统\n功能: 窗口管理、终端、文件管理器、浏览器\n\n增强功能:\n- AI命令支持\n- 毛玻璃效果\n- 窗口拖动边界限制\n- 图标拖拽\n- 关闭动画\n- 右键菜单\n- 锁屏界面\n- 系统设置\n- 通知中心\n- 快捷键支持\n- 全局搜索'
  };

  fileSystem['/home'] = '用户主目录 · ' + navigator.userAgent.split(') ')[0].replace('Mozilla/', '') + '\n\n' +
    '===== 系统信息 =====\n' +
    '浏览器: ' + navigator.appName + ' ' + navigator.appVersion.split(';')[1].trim() + '\n' +
    '语言: ' + navigator.language + '\n' +
    '屏幕: ' + screen.width + ' x ' + screen.height + '\n' +
    '平台: ' + navigator.platform + '\n' +
    '核心数: ' + (navigator.hardwareConcurrency || '未知') + '\n\n' +
    '===== 内存信息 =====\n' +
    'JS堆内存: ' + (performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + 'MB / ' + (performance.memory.jsHeapSizeLimit / 1048576).toFixed(1) + 'MB' : '当前浏览器不支持') + '\n' +
    '设备内存: ' + (navigator.deviceMemory ? navigator.deviceMemory + 'GB' : '未知') + '\n\n' +
    '===== 存储信息 =====\n' +
    'Cookie: ' + navigator.cookieEnabled + '\n' +
    'IndexedDB: 支持\n' +
    'LocalStorage: ' + (typeof localStorage !== 'undefined' ? '支持 (约5MB)' : '不支持') + '\n' +
    'SessionStorage: ' + (typeof sessionStorage !== 'undefined' ? '支持' : '不支持');

  function simulateAIResponse(input) {
    return new Promise(function(resolve) {
      setTimeout(function() {
        var responses = [
          '这是一个模拟AI回复。您输入了: ' + input,
          'AI助手已收到您的请求: "' + input + '"\n当前为演示模式，实际使用时可接入真实AI API。',
          '感谢使用ShadowOS AI功能！\n您输入的内容: ' + input + '\n\n本功能演示了AI集成能力。',
          '智能回复模式已激活\n处理内容: ' + input + '\n\n这是一个占位响应，可替换为真实AI服务。'
        ];
        resolve(responses[Math.floor(Math.random() * responses.length)]);
      }, 800);
    });
  }

  var terminalCommands = {
    help: function() {
      return '可用命令:\n' +
        '  help        - 显示帮助信息\n' +
        '  time        - 显示当前时间\n' +
        '  date        - 显示完整日期\n' +
        '  clear       - 清空终端\n' +
        '  about       - 显示系统信息\n' +
        '  ai [内容]   - 调用AI助手\n' +
        '  ls          - 列出文件\n' +
        '  cat [路径]  - 查看文件内容\n' +
        '  echo [内容] - 输出内容\n' +
        '  mkdir [路径] - 创建目录\n' +
        '  touch [路径] - 创建空文件\n' +
        '  rm [路径]   - 删除文件\n' +
        '  cd [路径]   - 切换目录(演示)\n' +
        '  pwd         - 显示当前路径\n' +
        '  whoami      - 显示用户名\n' +
        '  uname       - 显示系统信息\n' +
        '  neofetch    - 系统信息可视化\n' +
        '  calc [算式] - 计算器';
    },
    time: function() {
      return '当前时间: ' + new Date().toLocaleString('zh-CN');
    },
    date: function() {
      return '日期: ' + new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    },
    clear: function() {
      return '__CLEAR__';
    },
    about: function() {
      return 'ShadowOS v2.0.0\n' +
        '基于浏览器的模拟操作系统\n' +
        '使用原生 HTML + CSS + JavaScript 构建\n' +
        '提供窗口管理、终端、文件管理器和浏览器功能\n\n' +
        '新增特性:\n' +
        '• AI命令集成\n' +
        '• 毛玻璃UI效果\n' +
        '• 窗口拖动边界限制\n' +
        '• 桌面图标拖拽\n' +
        '• 窗口关闭动画\n' +
        '• 右键菜单\n' +
        '• 锁屏界面\n' +
        '• 系统设置\n' +
        '• 通知中心\n' +
        '• 快捷键支持\n' +
        '• 全局搜索\n' +
        '• 便签、日历、时钟、画图、音乐播放器、图片查看器';
    },
    ls: function() {
      return Object.keys(fileSystem).join('\n');
    },
    cat: function(args) {
      if (!args) return '用法: cat [文件路径]';
      if (fileSystem[args] !== undefined) return fileSystem[args];
      return 'cat: ' + args + ': 没有那个文件或目录';
    },
    echo: function(args) {
      return args || '';
    },
    mkdir: function(args) {
      if (!args) return '用法: mkdir [目录路径]';
      if (fileSystem[args]) return 'mkdir: ' + args + ': 目录已存在';
      fileSystem[args] = '目录: ' + args + '\n创建时间: ' + new Date().toLocaleString('zh-CN');
      return '目录已创建: ' + args;
    },
    touch: function(args) {
      if (!args) return '用法: touch [文件路径]';
      if (fileSystem[args]) return 'touch: ' + args + ': 文件已存在';
      fileSystem[args] = '';
      return '文件已创建: ' + args;
    },
    rm: function(args) {
      if (!args) return '用法: rm [文件路径]';
      if (!fileSystem[args]) return 'rm: ' + args + ': 没有那个文件或目录';
      delete fileSystem[args];
      return '已删除: ' + args;
    },
    cd: function(args) {
      if (!args || args === '~') return '当前路径: /home';
      if (fileSystem[args]) return '已切换目录: ' + args;
      return 'cd: ' + args + ': 没有那个文件或目录';
    },
    pwd: function() {
      return '/home';
    },
    whoami: function() {
      return 'shadowuser';
    },
    uname: function() {
      return 'ShadowOS 2.0.0 x86_64 HTML/JS/CSS Browser';
    },
    neofetch: function() {
      return '        ╔══════════╗          shadowuser@shadowos\n' +
        '        ║  ░░░░░░░░  ║          OS: ShadowOS v2.0.0\n' +
        '        ║  ░░░░░░░░  ║          Host: Web Browser\n' +
        '        ║  ░░░░░░░░  ║          Kernel: JavaScript\n' +
        '        ║  ░░░░░░░░  ║          Shell: ShadowOS Terminal\n' +
        '        ║  ░░░░░░░░  ║          WM: ShadowOS Window Manager\n' +
        '        ╚══════════╝          Terminal: ShadowOS Term\n' +
        '         ShadowOS             CPU: Browser JS Engine\n' +
        '                               Memory: ' + (performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + 'MB' : 'N/A');
    },
    calc: function(args) {
      if (!args) return '用法: calc [数学算式], 例如: calc 2 + 2';
      try {
        var result = Function('"use strict";return (' + args + ')')();
        return '= ' + result;
      } catch (e) {
        return 'calc: 无效的算式: ' + args;
      }
    }
  };

  function updateClock() {
    var now = new Date();
    taskbarClock.textContent = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    lockTimeEl.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    lockDateEl.textContent = now.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function showNotification(title, body, duration) {
    var notif = document.createElement('div');
    notif.className = 'notification';
    notif.innerHTML =
      '<div class="notification-title">' + title + '</div>' +
      '<div class="notification-body">' + body + '</div>' +
      '<div class="notification-time">' + new Date().toLocaleTimeString('zh-CN') + '</div>';
    notificationPanel.appendChild(notif);
    notif.addEventListener('click', function() {
      notif.classList.add('hiding');
      setTimeout(function() { notif.remove(); }, 300);
    });
    if (duration !== false) {
      setTimeout(function() {
        if (notif.parentNode) {
          notif.classList.add('hiding');
          setTimeout(function() { notif.remove(); }, 300);
        }
      }, duration || 4000);
    }
  }

  function showContextMenu(x, y, items) {
    contextMenu.innerHTML = '';
    items.forEach(function(item) {
      if (item === '---') {
        var div = document.createElement('div');
        div.className = 'context-divider';
        contextMenu.appendChild(div);
      } else {
        var div = document.createElement('div');
        div.className = 'context-item';
        div.textContent = item.label;
        div.addEventListener('click', function(e) {
          e.stopPropagation();
          item.action();
          contextMenu.style.display = 'none';
        });
        contextMenu.appendChild(div);
      }
    });
    contextMenu.style.display = 'block';
    var mw = contextMenu.offsetWidth;
    var mh = contextMenu.offsetHeight;
    if (x + mw > window.innerWidth) x = window.innerWidth - mw - 10;
    if (y + mh > window.innerHeight) y = window.innerHeight - mh - 10;
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
  }

  function hideContextMenu() {
    contextMenu.style.display = 'none';
  }

  desktop.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { label: ' 新建终端', action: openTerminal },
      { label: ' 打开文件管理器', action: openFiles },
      { label: ' 打开浏览器', action: openBrowser },
      '---',
      { label: ' 刷新', action: function() { location.reload(); } },
      { label: ' 系统设置', action: openSettings },
      '---',
      { label: ' 锁屏', action: lockScreen }
    ]);
  });

  document.addEventListener('click', function(e) {
    if (!contextMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  document.addEventListener('contextmenu', function(e) {
    if (!desktop.contains(e.target)) {
      hideContextMenu();
    }
  });

  lockScreen.addEventListener('click', function() {
    lockScreen.classList.add('hidden');
    setTimeout(function() { lockScreen.style.display = 'none'; }, 500);
  });

  document.getElementById('lock-btn').addEventListener('click', function() {
    lockScreen.style.display = 'flex';
    lockScreen.classList.remove('hidden');
  });

  var searchOpen = false;
  function openGlobalSearch() {
    if (searchOpen) {
      closeGlobalSearch();
      return;
    }
    globalSearchEl.style.display = 'block';
    globalSearchEl.querySelector('.global-search-input').value = '';
    globalSearchEl.querySelector('.global-search-input').focus();
    globalSearchEl.querySelector('.search-results').innerHTML = '';
    searchOpen = true;
  }

  function closeGlobalSearch() {
    globalSearchEl.style.display = 'none';
    searchOpen = false;
  }

  var pluginRegistry = [
    {
      id: 'snake',
      name: '贪吃蛇',
      icon: '🐍',
      description: '经典贪吃蛇游戏，支持方向键控制',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '48KB',
      category: 'game',
      installed: false,
      getContent: function() {
        return '<div class="plugin-snake-game">' +
          '<canvas id="snake-canvas" width="300" height="300"></canvas>' +
          '<div class="snake-controls">' +
            '<div class="snake-score">得分: <span id="snake-score">0</span></div>' +
            '<button class="snake-btn" id="snake-start-btn">开始游戏</button>' +
            '<div class="snake-hint">使用方向键 ←↑↓→ 控制蛇的移动</div>' +
          '</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var canvas = windowEl.querySelector('#snake-canvas');
        var ctx = canvas.getContext('2d');
        var startBtn = windowEl.querySelector('#snake-start-btn');
        var scoreEl = windowEl.querySelector('#snake-score');
        var snake = [{x: 150, y: 150}];
        var food = {x: 0, y: 0};
        var direction = {x: 0, y: 0};
        var gameLoop = null;
        var score = 0;
        var gridSize = 15;
        var gameRunning = false;

        function drawRect(x, y, color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * gridSize, y * gridSize, gridSize - 2, gridSize - 2);
        }

        function placeFood() {
          food.x = Math.floor(Math.random() * (canvas.width / gridSize));
          food.y = Math.floor(Math.random() * (canvas.height / gridSize));
        }

        function resetGame() {
          snake = [{x: 10, y: 10}];
          direction = {x: 0, y: 0};
          score = 0;
          scoreEl.textContent = '0';
          placeFood();
          draw();
        }

        function draw() {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          drawRect(food.x, food.y, '#ff6b6b');
          snake.forEach(function(seg, i) {
            drawRect(seg.x, seg.y, i === 0 ? '#00ffff' : '#00cc99');
          });
        }

        function update() {
          if (direction.x === 0 && direction.y === 0) return;
          var head = {x: snake[0].x + direction.x, y: snake[0].y + direction.y};
          if (head.x < 0 || head.x >= canvas.width / gridSize || head.y < 0 || head.y >= canvas.height / gridSize) {
            gameRunning = false;
            clearInterval(gameLoop);
            showNotification('贪吃蛇', '游戏结束！得分: ' + score);
            startBtn.textContent = '重新开始';
            return;
          }
          for (var i = 0; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
              gameRunning = false;
              clearInterval(gameLoop);
              showNotification('贪吃蛇', '游戏结束！得分: ' + score);
              startBtn.textContent = '重新开始';
              return;
            }
          }
          snake.unshift(head);
          if (head.x === food.x && head.y === food.y) {
            score += 10;
            scoreEl.textContent = score;
            placeFood();
          } else {
            snake.pop();
          }
          draw();
        }

        startBtn.addEventListener('click', function() {
          resetGame();
          gameRunning = true;
          gameLoop = setInterval(update, 150);
          startBtn.textContent = '游戏中...';
        });

        document.addEventListener('keydown', function(e) {
          if (!gameRunning) return;
          if (e.key === 'ArrowUp' && direction.y !== 1) direction = {x: 0, y: -1};
          else if (e.key === 'ArrowDown' && direction.y !== -1) direction = {x: 0, y: 1};
          else if (e.key === 'ArrowLeft' && direction.x !== 1) direction = {x: -1, y: 0};
          else if (e.key === 'ArrowRight' && direction.x !== -1) direction = {x: 1, y: 0};
        });

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    },
    {
      id: 'minesweeper',
      name: '扫雷',
      icon: '💣',
      description: '经典扫雷游戏，点击方块揭开，数字表示周围雷数',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '52KB',
      category: 'game',
      installed: false,
      getContent: function() {
        return '<div class="plugin-minesweeper">' +
          '<div class="mine-info"><span>剩余雷数: <span id="mine-count">10</span></span><span>用时: <span id="mine-time">0</span>秒</span></div>' +
          '<div class="mine-grid" id="mine-grid"></div>' +
          '<div class="mine-controls"><button class="mine-btn" id="mine-reset-btn">重新开始</button></div>' +
        '</div>';
      },
      init: function(windowEl) {
        var gridEl = windowEl.querySelector('#mine-grid');
        var countEl = windowEl.querySelector('#mine-count');
        var timeEl = windowEl.querySelector('#mine-time');
        var resetBtn = windowEl.querySelector('#mine-reset-btn');
        var rows = 9, cols = 9, mines = 10;
        var board = [], revealed = [], flagged = [];
        var timer = null, seconds = 0, gameOver = false;

        function init() {
          board = []; revealed = []; flagged = [];
          seconds = 0; gameOver = false;
          if (timer) clearInterval(timer);
          timeEl.textContent = '0';
          gridEl.innerHTML = '';
          for (var r = 0; r < rows; r++) {
            board[r] = []; revealed[r] = []; flagged[r] = [];
            for (var c = 0; c < cols; c++) {
              board[r][c] = 0;
              revealed[r][c] = false;
              flagged[r][c] = false;
            }
          }
          var placed = 0;
          while (placed < mines) {
            var r = Math.floor(Math.random() * rows);
            var c = Math.floor(Math.random() * cols);
            if (board[r][c] !== -1) {
              board[r][c] = -1;
              placed++;
            }
          }
          for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
              if (board[r][c] === -1) continue;
              var count = 0;
              for (var dr = -1; dr <= 1; dr++) {
                for (var dc = -1; dc <= 1; dc++) {
                  var nr = r + dr, nc = c + dc;
                  if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === -1) count++;
                }
              }
              board[r][c] = count;
            }
          }
          render();
          countEl.textContent = mines;
          timer = setInterval(function() { seconds++; timeEl.textContent = seconds; }, 1000);
        }

        function render() {
          gridEl.style.gridTemplateColumns = 'repeat(' + cols + ', 28px)';
          gridEl.innerHTML = '';
          for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
              var cell = document.createElement('div');
              cell.className = 'mine-cell';
              cell.dataset.r = r;
              cell.dataset.c = c;
              if (revealed[r][c]) {
                cell.classList.add('revealed');
                if (board[r][c] === -1) {
                  cell.classList.add('mine');
                  cell.textContent = '💣';
                } else if (board[r][c] > 0) {
                  cell.textContent = board[r][c];
                  var colors = ['', '#00ffff', '#00ff00', '#ffff00', '#ff9900', '#ff00ff', '#00ffff', '#ffffff', '#888'];
                  cell.style.color = colors[board[r][c]];
                }
              } else if (flagged[r][c]) {
                cell.classList.add('flagged');
                cell.textContent = '🚩';
              }
              cell.addEventListener('click', function() { clickCell(parseInt(this.dataset.r), parseInt(this.dataset.c)); });
              cell.addEventListener('contextmenu', function(e) { e.preventDefault(); toggleFlag(parseInt(this.dataset.r), parseInt(this.dataset.c)); });
              gridEl.appendChild(cell);
            }
          }
        }

        function clickCell(r, c) {
          if (gameOver || revealed[r][c] || flagged[r][c]) return;
          revealed[r][c] = true;
          if (board[r][c] === -1) {
            gameOver = true;
            clearInterval(timer);
            showNotification('扫雷', '游戏结束！你输了！');
            revealAll();
            return;
          }
          if (board[r][c] === 0) {
            for (var dr = -1; dr <= 1; dr++) {
              for (var dc = -1; dc <= 1; dc++) {
                var nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) clickCell(nr, nc);
              }
            }
          }
          render();
          checkWin();
        }

        function toggleFlag(r, c) {
          if (gameOver || revealed[r][c]) return;
          flagged[r][c] = !flagged[r][c];
          var flagCount = 0;
          for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
              if (flagged[r][c]) flagCount++;
            }
          }
          countEl.textContent = mines - flagCount;
          render();
        }

        function revealAll() {
          for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
              revealed[r][c] = true;
            }
          }
          render();
        }

        function checkWin() {
          var revealedCount = 0;
          for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
              if (revealed[r][c]) revealedCount++;
            }
          }
          if (revealedCount === rows * cols - mines) {
            gameOver = true;
            clearInterval(timer);
            showNotification('扫雷', '恭喜你获胜！用时: ' + seconds + '秒');
          }
        }

        resetBtn.addEventListener('click', init);
        init();
      }
    },
    {
      id: 'todolist',
      name: '待办事项',
      icon: '✅',
      description: '简洁的待办事项管理器，支持添加、完成、删除任务',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '32KB',
      category: 'productivity',
      installed: false,
      getContent: function() {
        return '<div class="plugin-todolist">' +
          '<div class="todo-input-row">' +
            '<input type="text" class="todo-input" id="todo-input" placeholder="输入新任务...">' +
            '<button class="todo-add-btn" id="todo-add-btn">添加</button>' +
          '</div>' +
          '<div class="todo-filters">' +
            '<button class="todo-filter active" data-filter="all">全部</button>' +
            '<button class="todo-filter" data-filter="active">待完成</button>' +
            '<button class="todo-filter" data-filter="completed">已完成</button>' +
          '</div>' +
          '<div class="todo-list" id="todo-list"></div>' +
          '<div class="todo-stats">共 <span id="todo-total">0</span> 项，已完成 <span id="todo-done">0</span> 项</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var input = windowEl.querySelector('#todo-input');
        var addBtn = windowEl.querySelector('#todo-add-btn');
        var list = windowEl.querySelector('#todo-list');
        var totalEl = windowEl.querySelector('#todo-total');
        var doneEl = windowEl.querySelector('#todo-done');
        var filters = windowEl.querySelectorAll('.todo-filter');
        var filter = 'all';
        var todos = [];

        function save() {
          localStorage.setItem('shadowos-todos', JSON.stringify(todos));
        }

        function load() {
          var saved = localStorage.getItem('shadowos-todos');
          if (saved) todos = JSON.parse(saved);
        }

        function render() {
          list.innerHTML = '';
          var filtered = todos.filter(function(t) {
            if (filter === 'active') return !t.done;
            if (filter === 'completed') return t.done;
            return true;
          });
          filtered.forEach(function(todo, idx) {
            var item = document.createElement('div');
            item.className = 'todo-item' + (todo.done ? ' done' : '');
            item.innerHTML = '<input type="checkbox" class="todo-check"' + (todo.done ? ' checked' : '') + '>' +
              '<span class="todo-text">' + todo.text + '</span>' +
              '<button class="todo-del">×</button>';
            item.querySelector('.todo-check').addEventListener('change', function() {
              todo.done = this.checked;
              save();
              render();
            });
            item.querySelector('.todo-del').addEventListener('click', function() {
              var realIdx = todos.indexOf(todo);
              if (realIdx !== -1) todos.splice(realIdx, 1);
              save();
              render();
            });
            list.appendChild(item);
          });
          totalEl.textContent = todos.length;
          doneEl.textContent = todos.filter(function(t) { return t.done; }).length;
        }

        function addTodo() {
          var text = input.value.trim();
          if (!text) return;
          todos.push({ text: text, done: false });
          save();
          input.value = '';
          render();
        }

        addBtn.addEventListener('click', addTodo);
        input.addEventListener('keydown', function(e) { if (e.key === 'Enter') addTodo(); });
        filters.forEach(function(f) {
          f.addEventListener('click', function() {
            filters.forEach(function(ff) { ff.classList.remove('active'); });
            f.classList.add('active');
            filter = f.dataset.filter;
            render();
          });
        });
        load();
        render();
      }
    },
    {
      id: 'weather',
      name: '天气查询',
      icon: '🌤️',
      description: '查询全球主要城市天气情况，支持多城市切换',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '38KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-weather">' +
          '<div class="pweather-city-select" id="pweather-city-select">' +
            '<span class="pweather-city-name">选择城市</span><span class="pweather-arrow">▼</span>' +
          '</div>' +
          '<div class="pweather-city-dropdown" id="pweather-city-dropdown"></div>' +
          '<div class="pweather-main">' +
            '<div class="pweather-icon" id="pweather-icon">☀️</div>' +
            '<div class="pweather-temp" id="pweather-temp">--°</div>' +
          '</div>' +
          '<div class="pweather-desc" id="pweather-desc">--</div>' +
          '<div class="pweather-details"><span>💧 <span id="pweather-humidity">--%</span></span><span>🌬️ <span id="pweather-wind">--级</span></span></div>' +
          '<div class="pweather-forecast" id="pweather-forecast"></div>' +
        '</div>';
      },
      init: function(windowEl) {
        var cities = [
          { name: '北京', query: 'Beijing,China' },
          { name: '上海', query: 'Shanghai,China' },
          { name: '广州', query: 'Guangzhou,China' },
          { name: '深圳', query: 'Shenzhen,China' },
          { name: '杭州', query: 'Hangzhou,China' },
          { name: '成都', query: 'Chengdu,China' },
          { name: '东京', query: 'Tokyo,Japan' },
          { name: '纽约', query: 'New York,USA' },
          { name: '伦敦', query: 'London,UK' },
          { name: '巴黎', query: 'Paris,France' },
          { name: '首尔', query: 'Seoul,South Korea' },
          { name: '悉尼', query: 'Sydney,Australia' },
          { name: '新加坡', query: 'Singapore' },
          { name: '曼谷', query: 'Bangkok,Thailand' },
          { name: '莫斯科', query: 'Moscow,Russia' }
        ];
        var weatherCodeMap = {
          '0': { icon: '☀️', desc: '晴朗' },
          '1': { icon: '🌤️', desc: '大部晴天' },
          '2': { icon: '⛅', desc: '多云' },
          '3': { icon: '☁️', desc: '阴天' },
          '45': { icon: '🌫️', desc: '雾' },
          '48': { icon: '🌫️', desc: '雾凇' },
          '51': { icon: '🌦️', desc: '小毛毛雨' },
          '53': { icon: '🌦️', desc: '中毛毛雨' },
          '55': { icon: '🌦️', desc: '大毛毛雨' },
          '61': { icon: '🌧️', desc: '小雨' },
          '63': { icon: '🌧️', desc: '中雨' },
          '65': { icon: '🌧️', desc: '大雨' },
          '71': { icon: '🌨️', desc: '小雪' },
          '73': { icon: '🌨️', desc: '中雪' },
          '75': { icon: '❄️', desc: '大雪' },
          '77': { icon: '🌨️', desc: '雪粒' },
          '80': { icon: '🌦️', desc: '小阵雨' },
          '81': { icon: '🌧️', desc: '中阵雨' },
          '82': { icon: '⛈️', desc: '大阵雨' },
          '95': { icon: '⛈️', desc: '雷暴' },
          '96': { icon: '⛈️', desc: '雷暴冰雹' },
          '99': { icon: '⛈️', desc: '强雷暴冰雹' }
        };
        var dropdown = windowEl.querySelector('#pweather-city-dropdown');
        var citySelect = windowEl.querySelector('#pweather-city-select');
        cities.forEach(function(city) {
          var opt = document.createElement('div');
          opt.className = 'city-option';
          opt.textContent = city.name;
          opt.addEventListener('click', function() {
            selectCity(city);
            dropdown.style.display = 'none';
          });
          dropdown.appendChild(opt);
        });
        citySelect.addEventListener('click', function(e) {
          e.stopPropagation();
          if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
          } else {
            var rect = citySelect.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.top = (rect.bottom + 5) + 'px';
            dropdown.style.display = 'block';
          }
        });
        document.addEventListener('click', function() { dropdown.style.display = 'none'; });
        function fetchWeather(query, city, isForecast) {
          var url = 'https://api.open-meteo.com/v1/forecast?latitude=9999&longitude=9999&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&' +
            (isForecast ? 'daily=weather_code,temperature_2m_max,temperature_2m_min&' : '') +
            'timezone=auto';
          url = url.replace('latitude=9999&longitude=9999', getCoords(query));
          return fetch(url).then(function(res) { return res.json(); });
        }
        function getCoords(query) {
          var coordMap = {
            'Beijing,China': 'latitude=39.9&longitude=116.4',
            'Shanghai,China': 'latitude=31.2&longitude=121.5',
            'Guangzhou,China': 'latitude=23.1&longitude=113.3',
            'Shenzhen,China': 'latitude=22.5&longitude=114.1',
            'Hangzhou,China': 'latitude=30.3&longitude=120.2',
            'Chengdu,China': 'latitude=30.6&longitude=104.1',
            'Tokyo,Japan': 'latitude=35.7&longitude=139.7',
            'New York,USA': 'latitude=40.7&longitude=-74.0',
            'London,UK': 'latitude=51.5&longitude=-0.1',
            'Paris,France': 'latitude=48.9&longitude=2.3',
            'Seoul,South Korea': 'latitude=37.6&longitude=127.0',
            'Sydney,Australia': 'latitude=-33.9&longitude=151.2',
            'Singapore': 'latitude=1.3&longitude=103.8',
            'Bangkok,Thailand': 'latitude=13.8&longitude=100.5',
            'Moscow,Russia': 'latitude=55.8&longitude=37.6'
          };
          return coordMap[query] || 'latitude=39.9&longitude=116.4';
        }
        function updateWeatherDisplay(data, city) {
          var current = data.current;
          var code = String(current.weather_code);
          var info = weatherCodeMap[code] || { icon: '🌡️', desc: '未知' };
          windowEl.querySelector('#pweather-icon').textContent = info.icon;
          windowEl.querySelector('#pweather-temp').textContent = Math.round(current.temperature_2m) + '°';
          windowEl.querySelector('#pweather-desc').textContent = city.name + ' 实时天气 · ' + info.desc;
          windowEl.querySelector('#pweather-humidity').textContent = current.relative_humidity_2m + '%';
          var windKmh = current.wind_speed_10m;
          var windLevel = Math.round(windKmh / 5);
          windowEl.querySelector('#pweather-wind').textContent = windLevel + '级';
        }
        function updateForecast(data) {
          var fcEl = windowEl.querySelector('#pweather-forecast');
          if (!data.daily) { fcEl.innerHTML = '<span style="color:#666">暂无预报</span>'; return; }
          var daily = data.daily;
          var today = new Date().toISOString().split('T')[0];
          var html = '';
          for (var i = 1; i < Math.min(daily.time.length, 4); i++) {
            if (daily.time[i] === today) continue;
            var d = new Date(daily.time[i]);
            var label = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
            var code = String(daily.weather_code[i]);
            var info = weatherCodeMap[code] || { icon: '🌡️' };
            html += '<div class="pforecast-item"><span class="pforecast-label">' + label + '</span><span class="pforecast-icon">' + info.icon + '</span><span class="pforecast-temp">' + Math.round(daily.temperature_2m_max[i]) + '°/' + Math.round(daily.temperature_2m_min[i]) + '°</span></div>';
          }
          fcEl.innerHTML = html;
        }
        function selectCity(city) {
          citySelect.querySelector('.pweather-city-name').textContent = city.name;
          windowEl.querySelector('#pweather-temp').textContent = '--°';
          windowEl.querySelector('#pweather-desc').textContent = '加载中...';
          fetchWeather(city.query, city, true).then(function(data) {
            updateWeatherDisplay(data, city);
            updateForecast(data);
          }).catch(function() {
            windowEl.querySelector('#pweather-desc').textContent = '加载失败，请重试';
          });
        }
        selectCity(cities[0]);
      }
    },
    {
      id: 'qrcode',
      name: '二维码生成器',
      icon: '📱',
      description: '输入文本或网址，生成二维码图片',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '28KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-qrcode">' +
          '<div class="qr-input-area">' +
            '<input type="text" class="qr-input" id="qr-input" placeholder="输入文本或网址...">' +
            '<button class="qr-gen-btn" id="qr-gen-btn">生成</button>' +
          '</div>' +
          '<div class="qr-output" id="qr-output"></div>' +
          '<div class="qr-hint">提示：二维码可使用手机扫描</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var input = windowEl.querySelector('#qr-input');
        var genBtn = windowEl.querySelector('#qr-gen-btn');
        var output = windowEl.querySelector('#qr-output');
        genBtn.addEventListener('click', generate);
        input.addEventListener('keydown', function(e) { if (e.key === 'Enter') generate(); });
        function generate() {
          var text = input.value.trim();
          if (!text) { showNotification('二维码', '请输入内容'); return; }
          output.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(text) + '" alt="QR Code">';
          showNotification('二维码', '二维码已生成');
        }
      }
    },
    {
      id: 'stopwatch',
      name: '秒表计时器',
      icon: '⏱️',
      description: '高精度秒表，支持计次功能',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '24KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-stopwatch">' +
          '<div class="sw-display" id="sw-display">00:00.00</div>' +
          '<div class="sw-controls">' +
            '<button class="sw-btn" id="sw-start">开始</button>' +
            '<button class="sw-btn" id="sw-lap">计次</button>' +
            '<button class="sw-btn" id="sw-reset">重置</button>' +
          '</div>' +
          '<div class="sw-laps" id="sw-laps"></div>' +
        '</div>';
      },
      init: function(windowEl) {
        var display = windowEl.querySelector('#sw-display');
        var startBtn = windowEl.querySelector('#sw-start');
        var lapBtn = windowEl.querySelector('#sw-lap');
        var resetBtn = windowEl.querySelector('#sw-reset');
        var lapsEl = windowEl.querySelector('#sw-laps');
        var startTime = 0, elapsed = 0, running = false, interval = null, laps = [];
        startBtn.addEventListener('click', function() {
          if (running) {
            running = false;
            clearInterval(interval);
            startBtn.textContent = '继续';
          } else {
            running = true;
            startTime = Date.now() - elapsed;
            interval = setInterval(update, 10);
            startBtn.textContent = '暂停';
          }
        });
        lapBtn.addEventListener('click', function() {
          if (!running) return;
          laps.push(elapsed);
          var div = document.createElement('div');
          div.className = 'sw-lap-item';
          div.textContent = '计次 ' + laps.length + ': ' + formatTime(elapsed);
          lapsEl.insertBefore(div, lapsEl.firstChild);
        });
        resetBtn.addEventListener('click', function() {
          running = false;
          clearInterval(interval);
          elapsed = 0;
          laps = [];
          lapsEl.innerHTML = '';
          display.textContent = '00:00.00';
          startBtn.textContent = '开始';
        });
        function update() {
          elapsed = Date.now() - startTime;
          display.textContent = formatTime(elapsed);
        }
        function formatTime(ms) {
          var mins = Math.floor(ms / 60000);
          var secs = Math.floor((ms % 60000) / 1000);
          var hundredths = Math.floor((ms % 1000) / 10);
          return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(hundredths).padStart(2, '0');
        }
      }
    },
    {
      id: 'calculator-plugin',
      name: '计算器',
      icon: '🔢',
      description: '科学计算器，支持三角函数和对数运算',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '18KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-calc2">' +
          '<div class="calc2-display" id="calc2-display">0</div>' +
          '<div class="calc2-grid">' +
            '<button class="calc2-btn calc2-func" data-v="sin">sin</button>' +
            '<button class="calc2-btn calc2-func" data-v="cos">cos</button>' +
            '<button class="calc2-btn calc2-func" data-v="tan">tan</button>' +
            '<button class="calc2-btn calc2-func" data-v="sqrt">√</button>' +
            '<button class="calc2-btn calc2-func" data-v="log">log</button>' +
            '<button class="calc2-btn calc2-func" data-v="ln">ln</button>' +
            '<button class="calc2-btn calc2-func" data-v="pow">x²</button>' +
            '<button class="calc2-btn calc2-func" data-v="pi">π</button>' +
            '<button class="calc2-btn calc2-num" data-v="7">7</button>' +
            '<button class="calc2-btn calc2-num" data-v="8">8</button>' +
            '<button class="calc2-btn calc2-num" data-v="9">9</button>' +
            '<button class="calc2-btn calc2-op" data-v="/">÷</button>' +
            '<button class="calc2-btn calc2-num" data-v="4">4</button>' +
            '<button class="calc2-btn calc2-num" data-v="5">5</button>' +
            '<button class="calc2-btn calc2-num" data-v="6">6</button>' +
            '<button class="calc2-btn calc2-op" data-v="*">×</button>' +
            '<button class="calc2-btn calc2-num" data-v="1">1</button>' +
            '<button class="calc2-btn calc2-num" data-v="2">2</button>' +
            '<button class="calc2-btn calc2-num" data-v="3">3</button>' +
            '<button class="calc2-btn calc2-op" data-v="-">−</button>' +
            '<button class="calc2-btn calc2-num" data-v="0">0</button>' +
            '<button class="calc2-btn calc2-num" data-v=".">.</button>' +
            '<button class="calc2-btn calc2-eq" data-v="=">=</button>' +
            '<button class="calc2-btn calc2-op" data-v="+">+</button>' +
            '<button class="calc2-btn calc2-clear" data-v="C">C</button>' +
            '<button class="calc2-btn calc2-func" data-v="back">⌫</button>' +
            '<button class="calc2-btn calc2-num" data-v="(">(</button>' +
            '<button class="calc2-btn calc2-num" data-v=")">)</button>' +
          '</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var display = windowEl.querySelector('#calc2-display');
        var expr = '';
        windowEl.querySelectorAll('.calc2-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var v = btn.getAttribute('data-v');
            if (v === 'C') { expr = ''; display.textContent = '0'; return; }
            if (v === 'back') { expr = expr.slice(0, -1); display.textContent = expr || '0'; return; }
            if (v === '=') {
              try {
                var e = expr.replace(/sin\(/g, 'Math.sin(').replace(/cos\(/g, 'Math.cos(').replace(/tan\(/g, 'Math.tan(').replace(/sqrt\(/g, 'Math.sqrt(').replace(/log\(/g, 'Math.log10(').replace(/ln\(/g, 'Math.log(').replace(/pi/g, 'Math.PI').replace(/pow\(/g, 'Math.pow(');
                var result = eval(e);
                display.textContent = typeof result === 'number' ? (Math.round(result * 1e10) / 1e10) : result;
                expr = String(result);
              } catch (err) { display.textContent = '错误'; expr = ''; }
              return;
            }
            if (['sin', 'cos', 'tan', 'sqrt', 'log', 'ln', 'pow'].indexOf(v) !== -1) { expr += v + '('; display.textContent = expr; return; }
            if (v === 'pi') { expr += 'pi'; display.textContent = expr; return; }
            expr += v;
            display.textContent = expr;
          });
        });
      }
    },
    {
      id: 'password-gen',
      name: '密码生成器',
      icon: '🔐',
      description: '生成高强度随机密码，支持自定义长度和字符集',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '12KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-pwgen">' +
          '<div class="pwgen-output" id="pwgen-output">点击生成</div>' +
          '<div class="pwgen-strength" id="pwgen-strength"></div>' +
          '<div class="pwgen-options">' +
            '<div class="pwgen-row"><span>长度</span><input type="range" class="pwgen-range" id="pwgen-len" min="4" max="64" value="16"><span id="pwgen-len-val">16</span></div>' +
            '<label class="pwgen-check"><input type="checkbox" id="pwgen-upper" checked>大写 A-Z</label>' +
            '<label class="pwgen-check"><input type="checkbox" id="pwgen-lower" checked>小写 a-z</label>' +
            '<label class="pwgen-check"><input type="checkbox" id="pwgen-digits" checked>数字 0-9</label>' +
            '<label class="pwgen-check"><input type="checkbox" id="pwgen-symbols" checked>符号 !@#$</label>' +
          '</div>' +
          '<button class="pwgen-btn" id="pwgen-gen">生成密码</button>' +
          '<button class="pwgen-btn pwgen-copy" id="pwgen-copy">复制到剪贴板</button>' +
        '</div>';
      },
      init: function(windowEl) {
        var output = windowEl.querySelector('#pwgen-output');
        var strength = windowEl.querySelector('#pwgen-strength');
        var lenRange = windowEl.querySelector('#pwgen-len');
        var lenVal = windowEl.querySelector('#pwgen-len-val');
        lenRange.addEventListener('input', function() { lenVal.textContent = this.value; });
        function generate() {
          var chars = '';
          if (windowEl.querySelector('#pwgen-upper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          if (windowEl.querySelector('#pwgen-lower').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
          if (windowEl.querySelector('#pwgen-digits').checked) chars += '0123456789';
          if (windowEl.querySelector('#pwgen-symbols').checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
          if (!chars) { output.textContent = '请至少选择一种字符类型'; return; }
          var len = parseInt(lenRange.value);
          var pw = '';
          for (var i = 0; i < len; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
          output.textContent = pw;
          var s = 0;
          if (len >= 8) s++;
          if (len >= 12) s++;
          if (len >= 16) s++;
          if (chars.match(/[A-Z]/)) s++;
          if (chars.match(/[a-z]/)) s++;
          if (chars.match(/[0-9]/)) s++;
          if (chars.match(/[^A-Za-z0-9]/)) s++;
          var labels = ['很弱', '弱', '一般', '中等', '强', '很强', '极强'];
          strength.textContent = '强度: ' + labels[Math.min(s, 6)];
          strength.style.color = s < 3 ? '#ff5f57' : s < 5 ? '#febc2e' : '#00cc99';
        }
        windowEl.querySelector('#pwgen-gen').addEventListener('click', generate);
        windowEl.querySelector('#pwgen-copy').addEventListener('click', function() {
          if (output.textContent === '点击生成') return;
          navigator.clipboard.writeText(output.textContent);
          showNotification('密码生成器', '已复制到剪贴板');
        });
        generate();
      }
    },
    {
      id: 'color-picker',
      name: '颜色拾取器',
      icon: '🎨',
      description: '可视化调色板，支持 HEX/RGB/HSL 颜色值显示和复制',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '14KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-color">' +
          '<div class="color-preview" id="color-preview" style="background:#00b4d8"></div>' +
          '<input type="color" class="color-input" id="color-input" value="#00b4d8">' +
          '<div class="color-values">' +
            '<div class="color-row"><span>HEX</span><input class="color-val" id="color-hex" readonly><button class="color-copy" data-target="color-hex">复制</button></div>' +
            '<div class="color-row"><span>RGB</span><input class="color-val" id="color-rgb" readonly><button class="color-copy" data-target="color-rgb">复制</button></div>' +
            '<div class="color-row"><span>HSL</span><input class="color-val" id="color-hsl" readonly><button class="color-copy" data-target="color-hsl">复制</button></div>' +
          '</div>' +
          '<div class="color-palette" id="color-palette"></div>' +
        '</div>';
      },
      init: function(windowEl) {
        var preview = windowEl.querySelector('#color-preview');
        var input = windowEl.querySelector('#color-input');
        var hexInput = windowEl.querySelector('#color-hex');
        var rgbInput = windowEl.querySelector('#color-rgb');
        var hslInput = windowEl.querySelector('#color-hsl');
        function hexToRgb(hex) {
          var r = parseInt(hex.slice(1, 3), 16);
          var g = parseInt(hex.slice(3, 5), 16);
          var b = parseInt(hex.slice(5, 7), 16);
          return { r: r, g: g, b: b };
        }
        function rgbToHsl(r, g, b) {
          r /= 255; g /= 255; b /= 255;
          var max = Math.max(r, g, b), min = Math.min(r, g, b);
          var h, s, l = (max + min) / 2;
          if (max === min) { h = s = 0; } else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
              case g: h = ((b - r) / d + 2) / 6; break;
              case b: h = ((r - g) / d + 4) / 6; break;
            }
          }
          return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
        }
        function update(hex) {
          preview.style.background = hex;
          var rgb = hexToRgb(hex);
          var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
          hexInput.value = hex.toUpperCase();
          rgbInput.value = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
          hslInput.value = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
        }
        input.addEventListener('input', function() { update(this.value); });
        windowEl.querySelectorAll('.color-copy').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var target = windowEl.querySelector('#' + btn.getAttribute('data-target'));
            navigator.clipboard.writeText(target.value);
            showNotification('颜色拾取器', '已复制: ' + target.value);
          });
        });
        var palette = ['#ff5f57', '#febc2e', '#28c840', '#00b4d8', '#0077b6', '#6c5ce7', '#e84393', '#fd79a8', '#00cec9', '#55efc4', '#81ecec', '#74b9ff', '#a29bfe', '#dfe6e9', '#b2bec3', '#636e72', '#2d3436', '#ffffff'];
        var paletteEl = windowEl.querySelector('#color-palette');
        palette.forEach(function(c) {
          var swatch = document.createElement('div');
          swatch.className = 'color-swatch';
          swatch.style.background = c;
          swatch.addEventListener('click', function() { input.value = c; update(c); });
          paletteEl.appendChild(swatch);
        });
        update('#00b4d8');
      }
    },
    {
      id: 'word-count',
      name: '文字统计',
      icon: '📊',
      description: '粘贴文本，实时统计字数、段落数、阅读时间',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '8KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-wordcount">' +
          '<textarea class="wc-textarea" id="wc-textarea" placeholder="在此粘贴或输入文本..."></textarea>' +
          '<div class="wc-stats" id="wc-stats">' +
            '<div class="wc-stat"><span class="wc-stat-val" id="wc-chars">0</span><span class="wc-stat-label">字符数</span></div>' +
            '<div class="wc-stat"><span class="wc-stat-val" id="wc-words">0</span><span class="wc-stat-label">单词数</span></div>' +
            '<div class="wc-stat"><span class="wc-stat-val" id="wc-paragraphs">0</span><span class="wc-stat-label">段落数</span></div>' +
            '<div class="wc-stat"><span class="wc-stat-val" id="wc-lines">0</span><span class="wc-stat-label">行数</span></div>' +
            '<div class="wc-stat"><span class="wc-stat-val" id="wc-readtime">0秒</span><span class="wc-stat-label">阅读时间</span></div>' +
            '<div class="wc-stat"><span class="wc-stat-val" id="wc-speaktime">0秒</span><span class="wc-stat-label">朗读时间</span></div>' +
          '</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var textarea = windowEl.querySelector('#wc-textarea');
        textarea.addEventListener('input', function() {
          var text = this.value;
          windowEl.querySelector('#wc-chars').textContent = text.length;
          windowEl.querySelector('#wc-words').textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
          windowEl.querySelector('#wc-paragraphs').textContent = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;
          windowEl.querySelector('#wc-lines').textContent = text ? text.split('\n').length : 0;
          var wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
          windowEl.querySelector('#wc-readtime').textContent = Math.ceil(wordCount / 200 * 60) + '秒';
          windowEl.querySelector('#wc-speaktime').textContent = Math.ceil(wordCount / 150 * 60) + '秒';
        });
      }
    },
    {
      id: 'dice-roller',
      name: '骰子/随机数',
      icon: '🎲',
      description: '虚拟骰子，支持自定义面数和数量，掷骰子和随机数',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '10KB',
      category: 'game',
      installed: false,
      getContent: function() {
        return '<div class="plugin-dice">' +
          '<div class="dice-display" id="dice-display">🎲</div>' +
          '<div class="dice-result" id="dice-result">-</div>' +
          '<div class="dice-controls">' +
            '<div class="dice-row"><span>骰子数</span><input type="number" class="dice-input" id="dice-count" value="1" min="1" max="20"></div>' +
            '<div class="dice-row"><span>面数</span><input type="number" class="dice-input" id="dice-sides" value="6" min="2" max="100"></div>' +
          '</div>' +
          '<button class="dice-btn" id="dice-roll">🎲 掷子</button>' +
          '<button class="dice-btn" id="dice-random">🎰 随机数 (1-100)</button>' +
          '<div class="dice-history" id="dice-history"></div>' +
        '</div>';
      },
      init: function(windowEl) {
        var display = windowEl.querySelector('#dice-display');
        var result = windowEl.querySelector('#dice-result');
        var history = windowEl.querySelector('#dice-history');
        var faces = ['⚀', '⚁', '⚂', '⚃', '', '⚅'];
        windowEl.querySelector('#dice-roll').addEventListener('click', function() {
          var count = parseInt(windowEl.querySelector('#dice-count').value) || 1;
          var sides = parseInt(windowEl.querySelector('#dice-sides').value) || 6;
          var values = [];
          for (var i = 0; i < count; i++) values.push(Math.floor(Math.random() * sides) + 1);
          var total = values.reduce(function(a, b) { return a + b; }, 0);
          display.textContent = count === 1 && sides === 6 ? faces[values[0] - 1] : '🎲';
          result.textContent = values.join(' + ') + (count > 1 ? ' = ' + total : '');
          var item = document.createElement('div');
          item.className = 'dice-history-item';
          item.textContent = count + 'd' + sides + ' → ' + result.textContent;
          history.insertBefore(item, history.firstChild);
          if (history.children.length > 10) history.removeChild(history.lastChild);
        });
        windowEl.querySelector('#dice-random').addEventListener('click', function() {
          var n = Math.floor(Math.random() * 100) + 1;
          display.textContent = '🎰';
          result.textContent = n;
          var item = document.createElement('div');
          item.className = 'dice-history-item';
          item.textContent = '随机数 → ' + n;
          history.insertBefore(item, history.firstChild);
          if (history.children.length > 10) history.removeChild(history.lastChild);
        });
      }
    },
    {
      id: 'unit-converter',
      name: '单位转换器',
      icon: '🔄',
      description: '长度、重量、温度、面积等多种单位互转',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '16KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-converter">' +
          '<div class="conv-tabs" id="conv-tabs">' +
            '<button class="conv-tab active" data-cat="length">长度</button>' +
            '<button class="conv-tab" data-cat="weight">重量</button>' +
            '<button class="conv-tab" data-cat="temp">温度</button>' +
            '<button class="conv-tab" data-cat="area">面积</button>' +
            '<button class="conv-tab" data-cat="speed">速度</button>' +
          '</div>' +
          '<div class="conv-body">' +
            '<div class="conv-row"><select class="conv-select" id="conv-from"></select><input class="conv-input" id="conv-input" type="number" value="1"></div>' +
            '<div class="conv-arrow">↓</div>' +
            '<div class="conv-row"><select class="conv-select" id="conv-to"></select><input class="conv-input" id="conv-output" type="number" readonly></div>' +
          '</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var units = {
          length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
          weight: { kg: 1, g: 0.001, mg: 0.000001, t: 1000, lb: 0.453592, oz: 0.0283495 },
          temp: {},
          area: { m2: 1, km2: 1e6, cm2: 1e-4, ha: 1e4, ac: 4046.86, ft2: 0.092903 },
          speed: { 'm/s': 1, 'km/h': 0.277778, 'mph': 0.44704, 'kn': 0.514444 }
        };
        var cat = 'length';
        function populateSelects() {
          var fromSel = windowEl.querySelector('#conv-from');
          var toSel = windowEl.querySelector('#conv-to');
          var keys = Object.keys(units[cat]);
          fromSel.innerHTML = ''; toSel.innerHTML = '';
          keys.forEach(function(k) {
            fromSel.innerHTML += '<option value="' + k + '">' + k + '</option>';
            toSel.innerHTML += '<option value="' + k + '">' + k + '</option>';
          });
          if (keys.length > 1) toSel.selectedIndex = 1;
          convert();
        }
        function convert() {
          var val = parseFloat(windowEl.querySelector('#conv-input').value) || 0;
          var from = windowEl.querySelector('#conv-from').value;
          var to = windowEl.querySelector('#conv-to').value;
          var result;
          if (cat === 'temp') {
            var celsius = from === 'C' ? val : from === 'F' ? (val - 32) * 5 / 9 : val + 273.15;
            result = to === 'C' ? celsius : to === 'F' ? celsius * 9 / 5 + 32 : celsius - 273.15;
          } else {
            var base = val * units[cat][from];
            result = base / units[cat][to];
          }
          windowEl.querySelector('#conv-output').value = Math.round(result * 1e8) / 1e8;
        }
        windowEl.querySelectorAll('.conv-tab').forEach(function(tab) {
          tab.addEventListener('click', function() {
            windowEl.querySelectorAll('.conv-tab').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            cat = tab.getAttribute('data-cat');
            populateSelects();
          });
        });
        windowEl.querySelector('#conv-from').addEventListener('change', convert);
        windowEl.querySelector('#conv-to').addEventListener('change', convert);
        windowEl.querySelector('#conv-input').addEventListener('input', convert);
        populateSelects();
      }
    },
    {
      id: '2048-game',
      name: '2048',
      icon: '🧩',
      description: '经典2048数字滑动游戏',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '22KB',
      category: 'game',
      installed: false,
      getContent: function() {
        return '<div class="plugin-2048">' +
          '<div class="game2048-header">' +
            '<div class="game2048-score">得分: <span id="game2048-score">0</span></div>' +
            '<button class="game2048-new" id="game2048-new">新游戏</button>' +
          '</div>' +
          '<div class="game2048-grid" id="game2048-grid"></div>' +
          '<div class="game2048-hint">使用方向键或滑动控制</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var grid = windowEl.querySelector('#game2048-grid');
        var scoreEl = windowEl.querySelector('#game2048-score');
        var size = 4;
        var board = [], score = 0;
        var colors = { 0: 'rgba(255,255,255,0.05)', 2: '#00b4d8', 4: '#0099b5', 8: '#0077b6', 16: '#005f8a', 32: '#6c5ce7', 64: '#e84393', 128: '#fd79a8', 256: '#fdcb6e', 512: '#e17055', 1024: '#d63031', 2048: '#00cec9' };
        function init() {
          board = Array(size).fill(null).map(function() { return Array(size).fill(0); });
          score = 0; scoreEl.textContent = '0';
          addTile(); addTile(); render();
        }
        function addTile() {
          var empty = [];
          for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (!board[r][c]) empty.push([r, c]);
          if (!empty.length) return;
          var pos = empty[Math.floor(Math.random() * empty.length)];
          board[pos[0]][pos[1]] = Math.random() < 0.9 ? 2 : 4;
        }
        function render() {
          grid.innerHTML = '';
          grid.style.gridTemplateColumns = 'repeat(' + size + ', 1fr)';
          for (var r = 0; r < size; r++) {
            for (var c = 0; c < size; c++) {
              var cell = document.createElement('div');
              cell.className = 'cell2048';
              cell.style.background = colors[board[r][c]] || '#00cec9';
              cell.style.color = board[r][c] <= 4 ? '#fff' : '#fff';
              cell.textContent = board[r][c] || '';
              if (board[r][c] >= 128) cell.style.fontSize = '22px';
              if (board[r][c] >= 1024) cell.style.fontSize = '18px';
              grid.appendChild(cell);
            }
          }
        }
        function slide(row) {
          var arr = row.filter(Boolean);
          for (var i = 0; i < arr.length - 1; i++) {
            if (arr[i] === arr[i + 1]) { arr[i] *= 2; score += arr[i]; arr.splice(i + 1, 1); }
          }
          while (arr.length < size) arr.push(0);
          return arr;
        }
        function move(dir) {
          var moved = false;
          var old = JSON.stringify(board);
          if (dir === 'left') { for (var r = 0; r < size; r++) board[r] = slide(board[r]); }
          else if (dir === 'right') { for (var r = 0; r < size; r++) board[r] = slide(board[r].reverse()).reverse(); }
          else if (dir === 'up') { for (var c = 0; c < size; c++) { var col = board.map(function(row) { return row[c]; }); col = slide(col); col.forEach(function(v, r) { board[r][c] = v; }); } }
          else if (dir === 'down') { for (var c = 0; c < size; c++) { var col = board.map(function(row) { return row[c]; }).reverse(); col = slide(col).reverse(); col.forEach(function(v, r) { board[r][c] = v; }); } }
          if (JSON.stringify(board) !== old) { addTile(); scoreEl.textContent = score; render(); }
        }
        document.addEventListener('keydown', function(e) {
          if (!grid.contains(windowEl.querySelector(':focus'))) return;
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) === -1) return;
          e.preventDefault();
          var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
          move(map[e.key]);
        });
        windowEl.querySelector('#game2048-new').addEventListener('click', init);
        init();
      }
    },
    {
      id: 'notepad',
      name: '记事本',
      icon: '📝',
      description: '简洁的文本编辑器，支持自动保存',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '15KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-notepad">' +
          '<div class="notepad-toolbar">' +
            '<button class="notepad-btn" id="notepad-new">新建</button>' +
            '<button class="notepad-btn" id="notepad-save">保存</button>' +
            '<select id="notepad-font-size">' +
              '<option value="12">12px</option>' +
              '<option value="14" selected>14px</option>' +
              '<option value="16">16px</option>' +
              '<option value="18">18px</option>' +
              '<option value="20">20px</option>' +
            '</select>' +
            '<span class="notepad-status" id="notepad-status">就绪</span>' +
          '</div>' +
          '<textarea id="notepad-content" placeholder="开始输入..."></textarea>' +
        '</div>';
      },
      init: function(windowEl) {
        var content = windowEl.querySelector('#notepad-content');
        var status = windowEl.querySelector('#notepad-status');
        var fontSizeSelect = windowEl.querySelector('#notepad-font-size');
        var savedContent = localStorage.getItem('shadowos-notepad-content');
        if (savedContent) {
          content.value = savedContent;
          status.textContent = '已加载上次内容';
        }
        content.addEventListener('input', function() {
          localStorage.setItem('shadowos-notepad-content', content.value);
          var lines = content.value.split('\n').length;
          var chars = content.value.length;
          status.textContent = '行: ' + lines + ' | 字符: ' + chars;
        });
        windowEl.querySelector('#notepad-save').addEventListener('click', function() {
          localStorage.setItem('shadowos-notepad-content', content.value);
          status.textContent = '已保存 ✓';
          setTimeout(function() { status.textContent = '就绪'; }, 2000);
        });
        windowEl.querySelector('#notepad-new').addEventListener('click', function() {
          if (content.value && !confirm('确定要清空当前内容吗？')) return;
          content.value = '';
          localStorage.removeItem('shadowos-notepad-content');
          status.textContent = '新建文档';
        });
        fontSizeSelect.addEventListener('change', function() {
          content.style.fontSize = fontSizeSelect.value + 'px';
        });
        content.style.fontSize = fontSizeSelect.value + 'px';
        content.focus();
      }
    },
    {
      id: 'paint',
      name: '画图',
      icon: '🎨',
      description: '简易画板，支持多种画笔颜色',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '22KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-paint">' +
          '<div class="paint-toolbar">' +
            '<div class="paint-colors">' +
              '<button class="paint-color active" data-color="#000000" style="background:#000000"></button>' +
              '<button class="paint-color" data-color="#ff0000" style="background:#ff0000"></button>' +
              '<button class="paint-color" data-color="#00ff00" style="background:#00ff00"></button>' +
              '<button class="paint-color" data-color="#0000ff" style="background:#0000ff"></button>' +
              '<button class="paint-color" data-color="#ffff00" style="background:#ffff00"></button>' +
              '<button class="paint-color" data-color="#ff00ff" style="background:#ff00ff"></button>' +
              '<button class="paint-color" data-color="#00ffff" style="background:#00ffff"></button>' +
              '<button class="paint-color" data-color="#ffffff" style="background:#ffffff;border:1px solid #666"></button>' +
            '</div>' +
            '<div class="paint-tools">' +
              '<label>粗细: <input type="range" id="paint-size" min="1" max="50" value="5"></label>' +
              '<button class="paint-btn" id="paint-clear">清空</button>' +
              '<button class="paint-btn" id="paint-eraser">橡皮擦</button>' +
              '<button class="paint-btn" id="paint-save">保存图片</button>' +
            '</div>' +
          '</div>' +
          '<canvas id="paint-canvas" width="600" height="400"></canvas>' +
        '</div>';
      },
      init: function(windowEl) {
        var canvas = windowEl.querySelector('#paint-canvas');
        var ctx = canvas.getContext('2d');
        var currentColor = '#000000';
        var currentSize = 5;
        var isDrawing = false;
        var isEraser = false;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        windowEl.querySelectorAll('.paint-color').forEach(function(btn) {
          btn.addEventListener('click', function() {
            windowEl.querySelectorAll('.paint-color').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentColor = btn.getAttribute('data-color');
            isEraser = false;
          });
        });
        windowEl.querySelector('#paint-size').addEventListener('input', function(e) {
          currentSize = parseInt(e.target.value);
        });
        windowEl.querySelector('#paint-eraser').addEventListener('click', function() {
          isEraser = !isEraser;
          this.textContent = isEraser ? '画笔' : '橡皮擦';
          this.classList.toggle('active');
        });
        windowEl.querySelector('#paint-clear').addEventListener('click', function() {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        });
        windowEl.querySelector('#paint-save').addEventListener('click', function() {
          var link = document.createElement('a');
          link.download = 'painting.png';
          link.href = canvas.toDataURL();
          link.click();
        });
        function getPos(e) {
          var rect = canvas.getBoundingClientRect();
          return {
            x: (e.clientX || e.touches[0].clientX) - rect.left,
            y: (e.clientY || e.touches[0].clientY) - rect.top
          };
        }
        canvas.addEventListener('mousedown', function(e) {
          isDrawing = true;
          var pos = getPos(e);
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
        });
        canvas.addEventListener('mousemove', function(e) {
          if (!isDrawing) return;
          var pos = getPos(e);
          ctx.lineWidth = currentSize;
          ctx.strokeStyle = isEraser ? '#ffffff' : currentColor;
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        });
        canvas.addEventListener('mouseup', function() { isDrawing = false; });
        canvas.addEventListener('mouseleave', function() { isDrawing = false; });
        canvas.addEventListener('touchstart', function(e) {
          e.preventDefault();
          isDrawing = true;
          var pos = getPos(e);
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
        });
        canvas.addEventListener('touchmove', function(e) {
          e.preventDefault();
          if (!isDrawing) return;
          var pos = getPos(e);
          ctx.lineWidth = currentSize;
          ctx.strokeStyle = isEraser ? '#ffffff' : currentColor;
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        });
        canvas.addEventListener('touchend', function() { isDrawing = false; });
      }
    },
    {
      id: 'calendar',
      name: '日历',
      icon: '📅',
      description: '月历视图，支持添加日程提醒',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '18KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-calendar">' +
          '<div class="calendar-header">' +
            '<button class="calendar-nav" id="calendar-prev">◀</button>' +
            '<h3 id="calendar-title"></h3>' +
            '<button class="calendar-nav" id="calendar-next">▶</button>' +
          '</div>' +
          '<div class="calendar-grid" id="calendar-grid"></div>' +
          '<div class="calendar-events" id="calendar-events">' +
            '<h4>今日日程</h4>' +
            '<div id="calendar-events-list"></div>' +
            '<button class="calendar-add-btn" id="calendar-add-event">+ 添加日程</button>' +
          '</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var currentDate = new Date();
        var currentMonth = currentDate.getMonth();
        var currentYear = currentDate.getFullYear();
        var selectedDate = null;
        var events = JSON.parse(localStorage.getItem('shadowos-calendar-events') || '{}');
        function saveEvents() {
          localStorage.setItem('shadowos-calendar-events', JSON.stringify(events));
        }
        function renderCalendar() {
          var title = windowEl.querySelector('#calendar-title');
          var grid = windowEl.querySelector('#calendar-grid');
          var firstDay = new Date(currentYear, currentMonth, 1);
          var lastDay = new Date(currentYear, currentMonth + 1, 0);
          var startDay = firstDay.getDay();
          var daysInMonth = lastDay.getDate();
          title.textContent = currentYear + '年' + (currentMonth + 1) + '月';
          var html = '<div class="calendar-weekdays">';
          ['日', '一', '二', '三', '四', '五', '六'].forEach(function(d) {
            html += '<div class="calendar-weekday">' + d + '</div>';
          });
          html += '</div><div class="calendar-days">';
          for (var i = 0; i < startDay; i++) {
            html += '<div class="calendar-day empty"></div>';
          }
          var today = new Date();
          for (var day = 1; day <= daysInMonth; day++) {
            var dateStr = currentYear + '-' + String(currentMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            var isToday = (day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear());
            var hasEvents = events[dateStr] && events[dateStr].length > 0;
            var classes = 'calendar-day';
            if (isToday) classes += ' today';
            if (hasEvents) classes += ' has-events';
            if (selectedDate === dateStr) classes += ' selected';
            html += '<div class="' + classes + '" data-date="' + dateStr + '">' +
              '<span class="day-number">' + day + '</span>' +
              (hasEvents ? '<span class="event-dot"></span>' : '') +
            '</div>';
          }
          html += '</div>';
          grid.innerHTML = html;
          grid.querySelectorAll('.calendar-day:not(.empty)').forEach(function(dayEl) {
            dayEl.addEventListener('click', function() {
              selectedDate = this.getAttribute('data-date');
              renderCalendar();
              renderEvents();
            });
          });
        }
        function renderEvents() {
          var eventsList = windowEl.querySelector('#calendar-events-list');
          var title = windowEl.querySelector('#calendar-events h4');
          if (!selectedDate) {
            var today = new Date();
            selectedDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
          }
          title.textContent = selectedDate + ' 日程';
          var dayEvents = events[selectedDate] || [];
          if (dayEvents.length === 0) {
            eventsList.innerHTML = '<div class="no-events">暂无日程</div>';
          } else {
            eventsList.innerHTML = dayEvents.map(function(evt, i) {
              return '<div class="calendar-event-item">' +
                '<span class="event-time">' + evt.time + '</span>' +
                '<span class="event-text">' + evt.text + '</span>' +
                '<button class="event-delete" data-index="' + i + '">×</button>' +
              '</div>';
            }).join('');
            eventsList.querySelectorAll('.event-delete').forEach(function(btn) {
              btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-index'));
                events[selectedDate].splice(idx, 1);
                if (events[selectedDate].length === 0) delete events[selectedDate];
                saveEvents();
                renderCalendar();
                renderEvents();
              });
            });
          }
        }
        windowEl.querySelector('#calendar-prev').addEventListener('click', function() {
          currentMonth--;
          if (currentMonth < 0) { currentMonth = 11; currentYear--; }
          renderCalendar();
        });
        windowEl.querySelector('#calendar-next').addEventListener('click', function() {
          currentMonth++;
          if (currentMonth > 11) { currentMonth = 0; currentYear++; }
          renderCalendar();
        });
        windowEl.querySelector('#calendar-add-event').addEventListener('click', function() {
          if (!selectedDate) {
            var today = new Date();
            selectedDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
          }
          var time = prompt('请输入时间 (如: 14:30):', '09:00');
          if (!time) return;
          var text = prompt('请输入日程内容:');
          if (!text) return;
          if (!events[selectedDate]) events[selectedDate] = [];
          events[selectedDate].push({ time: time, text: text });
          events[selectedDate].sort(function(a, b) { return a.time.localeCompare(b.time); });
          saveEvents();
          renderCalendar();
          renderEvents();
        });
        renderCalendar();
        renderEvents();
      }
    },
    {
      id: 'translator',
      name: '翻译器',
      icon: '🌐',
      description: '简易中英文互译工具',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '14KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-translator">' +
          '<div class="translator-controls">' +
            '<select id="translator-from">' +
              '<option value="en">英语 → 中文</option>' +
              '<option value="zh">中文 → 英语</option>' +
            '</select>' +
            '<button class="translator-btn" id="translator-swap">⇄ 交换</button>' +
          '</div>' +
          '<div class="translator-inputs">' +
            '<textarea id="translator-source" placeholder="输入要翻译的文本..."></textarea>' +
            '<div class="translator-arrow">▼</div>' +
            '<textarea id="translator-result" placeholder="翻译结果" readonly></textarea>' +
          '</div>' +
          '<button class="translator-translate-btn" id="translator-do-translate">翻译</button>' +
          '<div class="translator-hint">注: 简易版翻译，复杂句子可能需要手动调整</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var basicDict = {
          'hello': '你好', 'world': '世界', 'good': '好', 'morning': '早上',
          'thank': '谢谢', 'you': '你', 'love': '爱', 'yes': '是',
          'no': '不', 'water': '水', 'food': '食物', 'friend': '朋友',
          'family': '家人', 'home': '家', 'work': '工作', 'play': '玩',
          'study': '学习', 'school': '学校', 'book': '书', 'computer': '电脑',
          'phone': '手机', 'music': '音乐', 'movie': '电影', 'game': '游戏',
          'happy': '快乐', 'sad': '悲伤', 'beautiful': '美丽', 'big': '大',
          'small': '小', 'hot': '热', 'cold': '冷', 'fast': '快', 'slow': '慢',
          '你好': 'hello', '世界': 'world', '谢谢': 'thank you', '爱': 'love',
          '朋友': 'friend', '家人': 'family', '学习': 'study', '工作': 'work',
          '快乐': 'happy', '美丽': 'beautiful', '电脑': 'computer', '手机': 'phone'
        };
        function translate(text, direction) {
          var result = text;
          if (direction === 'en') {
            Object.keys(basicDict).forEach(function(en) {
              var zh = basicDict[en];
              var regex = new RegExp(en, 'gi');
              result = result.replace(regex, zh);
            });
          } else {
            Object.keys(basicDict).forEach(function(zh) {
              var en = basicDict[zh];
              var regex = new RegExp(zh, 'g');
              result = result.replace(regex, en);
            });
          }
          return result;
        }
        windowEl.querySelector('#translator-do-translate').addEventListener('click', function() {
          var source = windowEl.querySelector('#translator-source').value;
          var direction = windowEl.querySelector('#translator-from').value;
          if (!source.trim()) {
            windowEl.querySelector('#translator-result').value = '';
            return;
          }
          var result = translate(source, direction);
          windowEl.querySelector('#translator-result').value = result;
        });
        windowEl.querySelector('#translator-swap').addEventListener('click', function() {
          var select = windowEl.querySelector('#translator-from');
          select.value = select.value === 'en' ? 'zh' : 'en';
          var source = windowEl.querySelector('#translator-source');
          var result = windowEl.querySelector('#translator-result');
          var temp = source.value;
          source.value = result.value;
          result.value = temp;
        });
      }
    },
    {
      id: 'pomodoro-app',
      name: '番茄钟',
      icon: '🍅',
      description: '25分钟专注计时器，支持休息提醒',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '16KB',
      category: 'efficiency',
      installed: false,
      getContent: function() {
        return '<div class="plugin-pomodoro">' +
          '<div class="pomodoro-display">' +
            '<div class="pomodoro-time" id="pomodoro-time">25:00</div>' +
            '<div class="pomodoro-status" id="pomodoro-status">准备开始</div>' +
          '</div>' +
          '<div class="pomodoro-controls">' +
            '<button class="pomodoro-btn" id="pomodoro-start">开始</button>' +
            '<button class="pomodoro-btn" id="pomodoro-pause">暂停</button>' +
            '<button class="pomodoro-btn" id="pomodoro-reset">重置</button>' +
            '<button class="pomodoro-btn" id="pomodoro-break">休息</button>' +
          '</div>' +
          '<div class="pomodoro-stats">' +
            '<div class="pomodoro-count">已完成: <span id="pomodoro-count">0</span> 个</div>' +
          '</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var timeDisplay = windowEl.querySelector('#pomodoro-time');
        var statusDisplay = windowEl.querySelector('#pomodoro-status');
        var countDisplay = windowEl.querySelector('#pomodoro-count');
        var workTime = 25 * 60;
        var breakTime = 5 * 60;
        var remaining = workTime;
        var interval = null;
        var isWork = true;
        var completed = parseInt(localStorage.getItem('shadowos-pomodoro-count') || '0');
        countDisplay.textContent = completed;
        function updateDisplay() {
          var mins = Math.floor(remaining / 60);
          var secs = remaining % 60;
          timeDisplay.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        }
        function startTimer() {
          if (interval) return;
          interval = setInterval(function() {
            remaining--;
            updateDisplay();
            if (remaining <= 0) {
              clearInterval(interval);
              interval = null;
              if (isWork) {
                completed++;
                localStorage.setItem('shadowos-pomodoro-count', String(completed));
                countDisplay.textContent = completed;
                showNotification('番茄钟', '专注完成！休息一下吧 🍅');
                statusDisplay.textContent = '休息时间';
                remaining = breakTime;
                isWork = false;
              } else {
                showNotification('番茄钟', '休息结束，继续加油！💪');
                statusDisplay.textContent = '准备开始';
                remaining = workTime;
                isWork = true;
              }
              updateDisplay();
            }
          }, 1000);
        }
        windowEl.querySelector('#pomodoro-start').addEventListener('click', function() {
          statusDisplay.textContent = isWork ? '专注中...' : '休息中...';
          startTimer();
        });
        windowEl.querySelector('#pomodoro-pause').addEventListener('click', function() {
          clearInterval(interval);
          interval = null;
          statusDisplay.textContent = '已暂停';
        });
        windowEl.querySelector('#pomodoro-reset').addEventListener('click', function() {
          clearInterval(interval);
          interval = null;
          remaining = workTime;
          isWork = true;
          updateDisplay();
          statusDisplay.textContent = '准备开始';
        });
        windowEl.querySelector('#pomodoro-break').addEventListener('click', function() {
          clearInterval(interval);
          interval = null;
          remaining = breakTime;
          isWork = false;
          updateDisplay();
          statusDisplay.textContent = '休息时间';
        });
        updateDisplay();
      }
    },
    {
      id: 'weather-app',
      name: '天气预报',
      icon: '🌤️',
      description: '查看实时天气和未来预报',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '20KB',
      category: 'tool',
      installed: false,
      getContent: function() {
        return '<div class="plugin-weather-app">' +
          '<div class="weather-search">' +
            '<input type="text" id="weather-city-input" placeholder="输入城市名称...">' +
            '<button class="weather-search-btn" id="weather-search">搜索</button>' +
          '</div>' +
          '<div class="weather-display" id="weather-display">' +
            '<div class="weather-city" id="weather-city">选择城市查看天气</div>' +
            '<div class="weather-icon-big" id="weather-icon">🌤️</div>' +
            '<div class="weather-temp" id="weather-temp">--°C</div>' +
            '<div class="weather-desc" id="weather-desc">--</div>' +
          '</div>' +
          '<div class="weather-details" id="weather-details">' +
            '<div class="weather-detail-item"><span>湿度</span><span id="weather-humidity">--%</span></div>' +
            '<div class="weather-detail-item"><span>风速</span><span id="weather-wind">-- km/h</span></div>' +
            '<div class="weather-detail-item"><span>体感</span><span id="weather-feels">--°C</span></div>' +
          '</div>' +
        '</div>';
      },
      init: function(windowEl) {
        var weatherData = {
          '北京': { temp: 22, desc: '晴', humidity: 45, wind: 12, feels: 23, icon: '☀️' },
          '上海': { temp: 25, desc: '多云', humidity: 65, wind: 8, feels: 26, icon: '⛅' },
          '广州': { temp: 28, desc: '雷阵雨', humidity: 80, wind: 15, feels: 30, icon: '⛈️' },
          '深圳': { temp: 27, desc: '晴间多云', humidity: 70, wind: 10, feels: 29, icon: '🌤️' },
          '成都': { temp: 20, desc: '阴', humidity: 75, wind: 5, feels: 19, icon: '☁️' },
          '杭州': { temp: 23, desc: '小雨', humidity: 78, wind: 9, feels: 24, icon: '🌧️' },
          '武汉': { temp: 24, desc: '晴', humidity: 55, wind: 11, feels: 25, icon: '☀️' },
          '西安': { temp: 21, desc: '多云', humidity: 50, wind: 13, feels: 20, icon: '⛅' },
          '南京': { temp: 22, desc: '晴', humidity: 58, wind: 10, feels: 23, icon: '☀️' },
          '重庆': { temp: 26, desc: '雾', humidity: 85, wind: 4, feels: 27, icon: '🌫️' },
          'Tokyo': { temp: 18, desc: 'Cloudy', humidity: 60, wind: 14, feels: 17, icon: '☁️' },
          'New York': { temp: 15, desc: 'Rainy', humidity: 75, wind: 18, feels: 13, icon: '🌧️' },
          'London': { temp: 12, desc: 'Foggy', humidity: 82, wind: 16, feels: 10, icon: '🌫️' },
          'Paris': { temp: 16, desc: 'Sunny', humidity: 50, wind: 10, feels: 17, icon: '☀️' },
          'Sydney': { temp: 20, desc: 'Partly Cloudy', humidity: 55, wind: 12, feels: 21, icon: '⛅' }
        };
        function showWeather(city) {
          var data = weatherData[city];
          if (!data) {
            windowEl.querySelector('#weather-city').textContent = '未找到: ' + city;
            windowEl.querySelector('#weather-temp').textContent = '--°C';
            windowEl.querySelector('#weather-desc').textContent = '请尝试其他城市';
            return;
          }
          windowEl.querySelector('#weather-city').textContent = city;
          windowEl.querySelector('#weather-temp').textContent = data.temp + '°C';
          windowEl.querySelector('#weather-desc').textContent = data.desc;
          windowEl.querySelector('#weather-icon').textContent = data.icon;
          windowEl.querySelector('#weather-humidity').textContent = data.humidity + '%';
          windowEl.querySelector('#weather-wind').textContent = data.wind + ' km/h';
          windowEl.querySelector('#weather-feels').textContent = data.feels + '°C';
        }
        windowEl.querySelector('#weather-search').addEventListener('click', function() {
          var city = windowEl.querySelector('#weather-city-input').value.trim();
          if (!city) return;
          var found = null;
          Object.keys(weatherData).forEach(function(c) {
            if (c.toLowerCase().indexOf(city.toLowerCase()) !== -1) {
              found = c;
            }
          });
          if (found) {
            showWeather(found);
          } else {
            windowEl.querySelector('#weather-city').textContent = '未找到: ' + city;
            windowEl.querySelector('#weather-desc').textContent = '可选城市: 北京, 上海, 广州, 深圳, Tokyo, New York 等';
          }
        });
        windowEl.querySelector('#weather-city-input').addEventListener('keypress', function(e) {
          if (e.key === 'Enter') windowEl.querySelector('#weather-search').click();
        });
      }
    },
    {
      id: 'mindmap',
      name: '思维导图',
      icon: '🧠',
      description: '创建简单的思维导图，整理思路',
      version: '1.0.0',
      author: 'ShadowOS',
      size: '25KB',
      category: 'efficiency',
      installed: false,
      getContent: function() {
        return '<div class="plugin-mindmap">' +
          '<div class="mindmap-toolbar">' +
            '<button class="mindmap-btn" id="mindmap-add">+ 添加节点</button>' +
            '<button class="mindmap-btn" id="mindmap-clear">清空</button>' +
            '<span class="mindmap-hint">点击节点可编辑，拖拽调整位置</span>' +
          '</div>' +
          '<div class="mindmap-canvas" id="mindmap-canvas"></div>' +
        '</div>';
      },
      init: function(windowEl) {
        var canvas = windowEl.querySelector('#mindmap-canvas');
        var nodes = [{ id: 1, text: '中心主题', x: 300, y: 200, parent: null, color: '#00b4d8' }];
        var nextId = 2;
        var selectedNode = null;
        var isDragging = false;
        var dragOffset = { x: 0, y: 0 };
        function render() {
          canvas.innerHTML = '';
          nodes.forEach(function(node) {
            if (node.parent !== null) {
              var parent = nodes.find(function(n) { return n.id === node.parent; });
              if (parent) {
                var line = document.createElement('div');
                line.className = 'mindmap-line';
                var dx = node.x - parent.x;
                var dy = node.y - parent.y;
                var length = Math.sqrt(dx * dx + dy * dy);
                var angle = Math.atan2(dy, dx) * 180 / Math.PI;
                line.style.width = length + 'px';
                line.style.left = parent.x + 'px';
                line.style.top = parent.y + 'px';
                line.style.transform = 'rotate(' + angle + 'deg)';
                line.style.transformOrigin = '0 0';
                canvas.appendChild(line);
              }
            }
          });
          nodes.forEach(function(node) {
            var el = document.createElement('div');
            el.className = 'mindmap-node';
            if (selectedNode && selectedNode.id === node.id) el.classList.add('selected');
            el.style.left = node.x + 'px';
            el.style.top = node.y + 'px';
            el.style.borderColor = node.color;
            el.innerHTML = '<div class="mindmap-node-content" contenteditable="true">' + node.text + '</div>';
            el.addEventListener('mousedown', function(e) {
              selectedNode = node;
              isDragging = true;
              dragOffset.x = e.clientX - node.x;
              dragOffset.y = e.clientY - node.y;
              render();
            });
            el.addEventListener('dblclick', function() {
              el.querySelector('.mindmap-node-content').focus();
            });
            el.querySelector('.mindmap-node-content').addEventListener('blur', function() {
              node.text = this.textContent;
            });
            canvas.appendChild(el);
          });
        }
        canvas.addEventListener('mousemove', function(e) {
          if (!isDragging || !selectedNode) return;
          selectedNode.x = e.clientX - dragOffset.x;
          selectedNode.y = e.clientY - dragOffset.y;
          render();
        });
        canvas.addEventListener('mouseup', function() { isDragging = false; });
        canvas.addEventListener('mouseleave', function() { isDragging = false; });
        windowEl.querySelector('#mindmap-add').addEventListener('click', function() {
          var parent = selectedNode || nodes[0];
          var angle = Math.random() * Math.PI * 2;
          var distance = 100 + Math.random() * 50;
          var colors = ['#00b4d8', '#06d6a0', '#ffc857', '#ff6b6b', '#a78bfa', '#60a5fa'];
          nodes.push({
            id: nextId++,
            text: '新节点',
            x: parent.x + Math.cos(angle) * distance,
            y: parent.y + Math.sin(angle) * distance,
            parent: parent.id,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
          render();
        });
        windowEl.querySelector('#mindmap-clear').addEventListener('click', function() {
          nodes = [{ id: 1, text: '中心主题', x: 300, y: 200, parent: null, color: '#00b4d8' }];
          nextId = 2;
          selectedNode = null;
          render();
        });
        render();
      }
    }
  ];

  var installedPlugins = JSON.parse(localStorage.getItem('shadowos-installed-plugins') || '[]');

  function openAppStore() {
    var categories = ['全部', '游戏', '工具', '效率'];
    var catFilters = categories.map(function(cat) {
      return '<button class="appstore-cat-btn' + (cat === '全部' ? ' active' : '') + '" data-cat="' + cat + '">' + cat + '</button>';
    }).join('');

    var pluginsHtml = pluginRegistry.map(function(p) {
      var isInstalled = installedPlugins.indexOf(p.id) !== -1;
      return '<div class="appstore-item" data-plugin-id="' + p.id + '" data-category="' + p.category + '">' +
        '<div class="appstore-item-icon">' + p.icon + '</div>' +
        '<div class="appstore-item-info">' +
          '<div class="appstore-item-name">' + p.name + '</div>' +
          '<div class="appstore-item-desc">' + p.description + '</div>' +
          '<div class="appstore-item-meta">' +
            '<span class="appstore-item-size">' + p.size + '</span>' +
            '<span class="appstore-item-author">' + p.author + '</span>' +
            '<span class="appstore-item-version">v' + p.version + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="appstore-item-btn' + (isInstalled ? ' installed' : '') + '" data-plugin-id="' + p.id + '">' + (isInstalled ? '打开' : '安装') + '</button>' +
      '</div>';
    }).join('');

    var contentHtml =
      '<div class="appstore-content">' +
        '<div class="appstore-header">' +
          '<div class="appstore-title">🛒 应用商店</div>' +
          '<div class="appstore-search">' +
            '<input type="text" class="appstore-search-input" id="appstore-search-input" placeholder="搜索应用...">' +
          '</div>' +
        '</div>' +
        '<div class="appstore-cats">' + catFilters + '</div>' +
        '<div class="appstore-list">' + pluginsHtml + '</div>' +
      '</div>';

    var windowId = createWindow('appstore', 'App Store', contentHtml);
    var windowEl = document.getElementById(windowId);

    windowEl.querySelectorAll('.appstore-cat-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        windowEl.querySelectorAll('.appstore-cat-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var cat = btn.dataset.cat;
        windowEl.querySelectorAll('.appstore-item').forEach(function(item) {
          item.style.display = (cat === '全部' || item.dataset.category === cat) ? '' : 'none';
        });
      });
    });

    windowEl.querySelector('#appstore-search-input').addEventListener('input', function() {
      var q = this.value.toLowerCase();
      windowEl.querySelectorAll('.appstore-item').forEach(function(item) {
        var name = item.querySelector('.appstore-item-name').textContent.toLowerCase();
        var desc = item.querySelector('.appstore-item-desc').textContent.toLowerCase();
        item.style.display = (name.indexOf(q) !== -1 || desc.indexOf(q) !== -1) ? '' : 'none';
      });
    });

    windowEl.querySelectorAll('.appstore-item-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var pluginId = btn.dataset.pluginId;
        var plugin = pluginRegistry.find(function(p) { return p.id === pluginId; });
        if (!plugin) return;
        var isInstalled = installedPlugins.indexOf(pluginId) !== -1;
        if (isInstalled) {
          openPluginApp(plugin);
        } else {
          installedPlugins.push(pluginId);
          localStorage.setItem('shadowos-installed-plugins', JSON.stringify(installedPlugins));
          btn.classList.add('installed');
          btn.textContent = '打开';
          showNotification('安装成功', plugin.name + ' 已安装');
        }
      });
    });
  }

  function openPluginApp(plugin) {
    var contentHtml = '<div class="plugin-app" id="plugin-app-' + plugin.id + '"></div>';
    var windowId = createWindow('plugin-' + plugin.id, plugin.name, contentHtml);
    var windowEl = document.getElementById(windowId);
    windowEl.querySelector('.window-content').innerHTML = plugin.getContent();
    plugin.init(windowEl);
    showNotification(plugin.name, '已打开');
  }

  function openSysMonitor() {
    var contentHtml =
      '<div class="sysmon-container">' +
        '<div class="sysmon-section">' +
          '<div class="sysmon-section-title"> CPU 使用率</div>' +
          '<div class="sysmon-gauge-wrap">' +
            '<canvas class="sysmon-canvas" id="sysmon-cpu-canvas" width="140" height="140"></canvas>' +
            '<div class="sysmon-gauge-label" id="sysmon-cpu-val">0%</div>' +
          '</div>' +
          '<div class="sysmon-bars" id="sysmon-cpu-bars"></div>' +
        '</div>' +
        '<div class="sysmon-section">' +
          '<div class="sysmon-section-title"> 内存使用</div>' +
          '<div class="sysmon-gauge-wrap">' +
            '<canvas class="sysmon-canvas" id="sysmon-mem-canvas" width="140" height="140"></canvas>' +
            '<div class="sysmon-gauge-label" id="sysmon-mem-val">0%</div>' +
          '</div>' +
          '<div class="sysmon-detail" id="sysmon-mem-detail">-- / --</div>' +
        '</div>' +
        '<div class="sysmon-section">' +
          '<div class="sysmon-section-title"> 网络</div>' +
          '<div class="sysmon-network" id="sysmon-network">' +
            '<div class="sysmon-net-item"><span class="sysmon-net-icon">↓</span><span id="sysmon-down">0 KB/s</span></div>' +
            '<div class="sysmon-net-item"><span class="sysmon-net-icon">↑</span><span id="sysmon-up">0 KB/s</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="sysmon-section">' +
          '<div class="sysmon-section-title"> 系统信息</div>' +
          '<div class="sysmon-info" id="sysmon-info"></div>' +
        '</div>' +
      '</div>';

    var windowId = createWindow('sysmon', '系统监控', contentHtml);
    var windowEl = document.getElementById(windowId);

    var cpuCores = navigator.hardwareConcurrency || 4;
    var cpuValues = [];
    for (var i = 0; i < cpuCores; i++) cpuValues.push(0);

    var memInfo = { total: 0, used: 0 };
    if (performance.memory) {
      memInfo.total = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(0);
      memInfo.used = (performance.memory.usedJSHeapSize / 1048576).toFixed(0);
    } else {
      memInfo.total = '8192';
      memInfo.used = '0';
    }

    var barsEl = windowEl.querySelector('#sysmon-cpu-bars');
    for (var i = 0; i < cpuCores; i++) {
      var bar = document.createElement('div');
      bar.className = 'sysmon-bar-item';
      bar.innerHTML = '<div class="sysmon-bar-label">核心 ' + i + '</div>' +
        '<div class="sysmon-bar-track"><div class="sysmon-bar-fill" id="sysmon-bar-' + i + '"></div></div>' +
        '<div class="sysmon-bar-val" id="sysmon-bar-val-' + i + '">0%</div>';
      barsEl.appendChild(bar);
    }

    var infoEl = windowEl.querySelector('#sysmon-info');
    infoEl.innerHTML =
      '<div class="sysmon-info-row"><span>平台</span><span>' + navigator.platform + '</span></div>' +
      '<div class="sysmon-info-row"><span>浏览器</span><span>' + navigator.appName + '</span></div>' +
      '<div class="sysmon-info-row"><span>语言</span><span>' + navigator.language + '</span></div>' +
      '<div class="sysmon-info-row"><span>屏幕</span><span>' + screen.width + '×' + screen.height + '</span></div>' +
      '<div class="sysmon-info-row"><span>色深</span><span>' + screen.colorDepth + ' bit</span></div>' +
      '<div class="sysmon-info-row"><span>在线</span><span>' + (navigator.onLine ? '是' : '否') + '</span></div>';

    windowEl.querySelector('#sysmon-mem-detail').textContent = memInfo.used + ' MB / ' + memInfo.total + ' MB';

    function drawGauge(canvasId, value, color) {
      var canvas = windowEl.querySelector(canvasId);
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var w = canvas.width, h = canvas.height;
      var cx = w / 2, cy = h / 2, r = 55;
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.stroke();
      var angle = 0.75 * Math.PI + (value / 100) * 1.5 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0.75 * Math.PI, angle);
      ctx.lineWidth = 10;
      var grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '88');
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    function update() {
      var cpuTotal = 0;
      for (var i = 0; i < cpuCores; i++) {
        cpuValues[i] = Math.max(0, Math.min(100, cpuValues[i] + (Math.random() * 30 - 15)));
        cpuValues[i] = Math.round(cpuValues[i] * 10) / 10;
        cpuTotal += cpuValues[i];
        var fillEl = windowEl.querySelector('#sysmon-bar-' + i);
        var valEl = windowEl.querySelector('#sysmon-bar-val-' + i);
        if (fillEl) fillEl.style.width = cpuValues[i] + '%';
        if (valEl) valEl.textContent = Math.round(cpuValues[i]) + '%';
      }
      var avgCpu = Math.round(cpuTotal / cpuCores);
      drawGauge('#sysmon-cpu-canvas', avgCpu, '#00b4d8');
      windowEl.querySelector('#sysmon-cpu-val').textContent = avgCpu + '%';

      var memUsed = parseFloat(memInfo.used) + Math.round(Math.random() * 50 - 25);
      memUsed = Math.max(100, Math.min(parseInt(memInfo.total), memUsed));
      var memPct = Math.round(memUsed / parseInt(memInfo.total) * 100);
      drawGauge('#sysmon-mem-canvas', memPct, '#00cc99');
      windowEl.querySelector('#sysmon-mem-val').textContent = memPct + '%';
      windowEl.querySelector('#sysmon-mem-detail').textContent = memUsed + ' MB / ' + memInfo.total + ' MB';

      var down = (Math.random() * 500 + 50).toFixed(0);
      var up = (Math.random() * 100 + 10).toFixed(0);
      windowEl.querySelector('#sysmon-down').textContent = down + ' KB/s';
      windowEl.querySelector('#sysmon-up').textContent = up + ' KB/s';
    }

    update();
    var monInterval = setInterval(update, 2000);

    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.removedNodes.length > 0) {
          for (var i = 0; i < m.removedNodes.length; i++) {
            if (m.removedNodes[i] === windowEl) {
              clearInterval(monInterval);
              observer.disconnect();
            }
          }
        }
      });
    });
    observer.observe(document.body, { childList: true });
  }

  function openCodeEditor() {
    var contentHtml =
      '<div class="codeeditor-container">' +
        '<div class="codeeditor-toolbar">' +
          '<select class="codeeditor-lang" id="codeeditor-lang">' +
            '<option value="javascript">JavaScript</option>' +
            '<option value="htmlmixed">HTML</option>' +
            '<option value="css">CSS</option>' +
            '<option value="python">Python</option>' +
            '<option value="xml">XML</option>' +
            '<option value="markdown">Markdown</option>' +
            '<option value="sql">SQL</option>' +
            '<option value="clike">C/C++/Java</option>' +
          '</select>' +
          '<div class="codeeditor-actions">' +
            '<button class="codeeditor-btn" id="codeeditor-run" title="运行 (Ctrl+Enter)">▶ 运行</button>' +
            '<button class="codeeditor-btn" id="codeeditor-save" title="保存 (Ctrl+S)">💾 保存</button>' +
            '<button class="codeeditor-btn" id="codeeditor-open" title="打开文件">📂 打开</button>' +
            '<button class="codeeditor-btn" id="codeeditor-format" title="格式化">✨ 格式化</button>' +
          '</div>' +
        '</div>' +
        '<div class="codeeditor-body">' +
          '<div class="codeeditor-editor-wrap">' +
            '<div class="codeeditor-editor-header">编辑器</div>' +
            '<textarea class="codeeditor-textarea" id="codeeditor-textarea"></textarea>' +
          '</div>' +
          '<div class="codeeditor-output-wrap">' +
            '<div class="codeeditor-output-header">输出 <button class="codeeditor-clear" id="codeeditor-clear">清空</button></div>' +
            '<div class="codeeditor-output" id="codeeditor-output"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var windowId = createWindow('codeeditor', '代码编辑器', contentHtml);
    var windowEl = document.getElementById(windowId);

    windowEl.querySelector('#codeeditor-textarea').value =
      '// 欢迎使用 ShadowOS 代码编辑器\n// 选择编程语言，编写代码，点击运行查看结果\n\nfunction greet(name) {\n  return "Hello, " + name + "!";\n}\n\nconsole.log(greet("ShadowOS"));\nconsole.log("当前时间: " + new Date().toLocaleTimeString());\n';

    var textarea = windowEl.querySelector('#codeeditor-textarea');
    var outputEl = windowEl.querySelector('#codeeditor-output');
    var langSelect = windowEl.querySelector('#codeeditor-lang');
    var cm = CodeMirror.fromTextArea(textarea, {
      lineNumbers: true,
      theme: 'material-darker',
      mode: 'javascript',
      indentUnit: 2,
      tabSize: 2,
      lineWrapping: true,
      extraKeys: {
        'Ctrl-Enter': function() { runCode(); },
        'Ctrl-S': function(e) {
          e.preventDefault();
          saveCode();
        }
      }
    });

    cm.setSize(null, '100%');

    langSelect.addEventListener('change', function() {
      cm.setOption('mode', this.value);
    });

    windowEl.querySelector('#codeeditor-run').addEventListener('click', runCode);

    function runCode() {
      var code = cm.getValue();
      outputEl.innerHTML = '';
      var logs = [];
      var origLog = console.log;
      console.log = function() {
        var args = Array.from(arguments).map(function(a) {
          if (typeof a === 'object') return JSON.stringify(a, null, 2);
          return String(a);
        });
        logs.push(args.join(' '));
        outputEl.innerHTML += '<div class="codeeditor-log">' + escapeHtml(args.join(' ')) + '</div>';
      };
      try {
        var result = new Function(code)();
        if (result !== undefined) {
          outputEl.innerHTML += '<div class="codeeditor-result">返回值: ' + escapeHtml(String(result)) + '</div>';
        }
      } catch (err) {
        outputEl.innerHTML += '<div class="codeeditor-error">错误: ' + escapeHtml(err.message) + '</div>';
      }
      console.log = origLog;
      if (logs.length === 0) {
        outputEl.innerHTML = '<div class="codeeditor-empty">无输出</div>';
      }
    }

    function saveCode() {
      var blob = new Blob([cm.getValue()], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'code.' + getExtension(langSelect.value);
      a.click();
      URL.revokeObjectURL(a.href);
      showNotification('代码编辑器', '文件已保存');
    }

    function getExtension(mode) {
      var map = { javascript: 'js', htmlmixed: 'html', css: 'css', python: 'py', xml: 'xml', markdown: 'md', sql: 'sql', clike: 'c' };
      return map[mode] || 'txt';
    }

    windowEl.querySelector('#codeeditor-save').addEventListener('click', saveCode);

    windowEl.querySelector('#codeeditor-open').addEventListener('click', function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.js,.html,.css,.py,.xml,.md,.sql,.c,.java,.txt,.json';
      input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          cm.setValue(ev.target.result);
          var ext = file.name.split('.').pop().toLowerCase();
          var modeMap = { js: 'javascript', html: 'htmlmixed', css: 'css', py: 'python', xml: 'xml', md: 'markdown', sql: 'sql', c: 'clike', java: 'clike', json: 'javascript', txt: 'javascript' };
          var mode = modeMap[ext] || 'javascript';
          langSelect.value = mode;
          cm.setOption('mode', mode);
          showNotification('代码编辑器', '已打开: ' + file.name);
        };
        reader.readAsText(file);
      };
      input.click();
    });

    windowEl.querySelector('#codeeditor-format').addEventListener('click', function() {
      var code = cm.getValue();
      try {
        var obj = JSON.parse(code);
        cm.setValue(JSON.stringify(obj, null, 2));
        showNotification('代码编辑器', 'JSON 格式化成功');
      } catch (e) {
        showNotification('代码编辑器', '仅支持 JSON 格式化');
      }
    });

    windowEl.querySelector('#codeeditor-clear').addEventListener('click', function() {
      outputEl.innerHTML = '';
    });
  }

  var searchApps = [
    { name: 'Terminal', icon: '🖥️', desc: '终端模拟器', action: openTerminal },
    { name: 'Files', icon: '📁', desc: '文件管理器', action: openFiles },
    { name: 'Browser', icon: '🌐', desc: '网页浏览器', action: openBrowser },
    { name: 'Calculator', icon: '🧮', desc: '计算器', action: openCalculator },
    { name: 'Notepad', icon: '📝', desc: '记事本', action: openNotepad },
    { name: 'Settings', icon: '️', desc: '系统设置', action: openSettings },
    { name: 'Sticky', icon: '📋', desc: '桌面便签', action: openSticky },
    { name: 'Calendar', icon: '📅', desc: '日历与日程', action: openCalendar },
    { name: 'Clock', icon: '⏰', desc: '世界时钟与倒计时', action: openClock },
    { name: 'Draw', icon: '🎨', desc: '画图工具', action: openDraw },
    { name: 'Music', icon: '🎵', desc: '音乐播放器', action: openMusic },
    { name: 'ImageViewer', icon: '🖼️', desc: '图片查看器', action: openImageViewer },
    { name: 'App Store', icon: '', desc: '应用商店', action: openAppStore },
    { name: '系统监控', icon: '📊', desc: 'CPU/内存/网络实时监控', action: openSysMonitor },
    { name: '代码编辑器', icon: '💻', desc: '支持语法高亮的代码编辑器', action: openCodeEditor }
  ];

  function filterSearch(query) {
    var results = globalSearchEl.querySelector('.search-results');
    results.innerHTML = '';
    if (!query) {
      results.innerHTML = '<div class="search-empty">输入关键词搜索应用和文件</div>';
      return;
    }
    var matched = searchApps.filter(function(a) {
      return a.name.toLowerCase().indexOf(query.toLowerCase()) !== -1 || a.desc.indexOf(query) !== -1;
    });
    var matchedFiles = Object.keys(fileSystem).filter(function(f) {
      return f.toLowerCase().indexOf(query.toLowerCase()) !== -1;
    });
    matchedFiles.forEach(function(f) {
      matched.push({ name: f, icon: '📄', desc: '系统文件', action: function() { openFiles(); } });
    });
    uploadedFiles.forEach(function(file) {
      if (file.name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
        matched.push({ name: file.name, icon: getFileIcon(file.name), desc: formatFileSize(file.size), action: function() { openFiles(); } });
      }
    });
    if (matched.length === 0) {
      results.innerHTML = '<div class="search-empty">没有找到匹配结果</div>';
    } else {
      matched.forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML =
          '<span class="search-result-icon">' + item.icon + '</span>' +
          '<div class="search-result-info">' +
            '<div class="search-result-name">' + item.name + '</div>' +
            '<div class="search-result-desc">' + item.desc + '</div>' +
          '</div>';
        div.addEventListener('click', function() {
          item.action();
          closeGlobalSearch();
        });
        results.appendChild(div);
      });
    }
  }

  globalSearchEl.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  globalSearchEl.querySelector('.global-search-input').addEventListener('input', function() {
    filterSearch(this.value);
  });

  globalSearchEl.querySelector('.global-search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeGlobalSearch();
    if (e.key === 'Enter') {
      var first = globalSearchEl.querySelector('.search-result-item');
      if (first) first.click();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      openGlobalSearch();
    }
    if (e.key === 'Escape') {
      closeGlobalSearch();
    }
    if (e.ctrlKey && e.key === 'w') {
      e.preventDefault();
      var topZ = 0;
      var topWin = null;
      Object.keys(activeWindows).forEach(function(id) {
        var z = parseInt(activeWindows[id].element.style.zIndex);
        if (z > topZ) { topZ = z; topWin = id; }
      });
      if (topWin) {
        activeWindows[topWin].element.querySelector('.window-close').click();
      }
    }
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      openTerminal();
    }
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      openNotepad();
    }
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      openCalculator();
    }
  });

  searchInput.addEventListener('click', function(e) {
    e.stopPropagation();
    openGlobalSearch();
  });

  searchInput.addEventListener('keydown', function(e) {
    e.stopPropagation();
    if (e.key === 'Escape') { closeGlobalSearch(); this.blur(); }
    if (e.key === 'Enter') {
      var query = this.value;
      filterSearch(query);
      globalSearchEl.querySelector('.global-search-input').value = query;
      globalSearchEl.querySelector('.global-search-input').focus();
    }
  });

  var calcDisplay = '0';
  var calcExpr = '';
  var calcNewNumber = true;

  function openCalculator() {
    var contentHtml =
      '<div class="calculator-content">' +
        '<div class="calc-display" id="calc-display">' + calcDisplay + '</div>' +
        '<div class="calc-buttons">' +
          '<button class="calc-btn clear" data-calc="C">C</button>' +
          '<button class="calc-btn operator" data-calc="(">(</button>' +
          '<button class="calc-btn operator" data-calc=")">)</button>' +
          '<button class="calc-btn operator" data-calc="/">/</button>' +
          '<button class="calc-btn" data-calc="7">7</button>' +
          '<button class="calc-btn" data-calc="8">8</button>' +
          '<button class="calc-btn" data-calc="9">9</button>' +
          '<button class="calc-btn operator" data-calc="*">*</button>' +
          '<button class="calc-btn" data-calc="4">4</button>' +
          '<button class="calc-btn" data-calc="5">5</button>' +
          '<button class="calc-btn" data-calc="6">6</button>' +
          '<button class="calc-btn operator" data-calc="-">-</button>' +
          '<button class="calc-btn" data-calc="1">1</button>' +
          '<button class="calc-btn" data-calc="2">2</button>' +
          '<button class="calc-btn" data-calc="3">3</button>' +
          '<button class="calc-btn operator" data-calc="+">+</button>' +
          '<button class="calc-btn" data-calc="0">0</button>' +
          '<button class="calc-btn" data-calc=".">.</button>' +
          '<button class="calc-btn operator" data-calc="%">%</button>' +
          '<button class="calc-btn equals" data-calc="=">=</button>' +
        '</div>' +
      '</div>';

    var windowId = createWindow('calculator', 'Calculator', contentHtml);
    var windowEl = document.getElementById(windowId);
    var display = windowEl.querySelector('#calc-display');
    var buttons = windowEl.querySelectorAll('.calc-btn');

    display.textContent = calcDisplay;

    buttons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var val = btn.getAttribute('data-calc');
        if (val === 'C') {
          calcDisplay = '0';
          calcExpr = '';
          calcNewNumber = true;
        } else if (val === '=') {
          try {
            calcExpr += calcDisplay;
            var result = Function('"use strict";return (' + calcExpr + ')')();
            calcDisplay = String(Math.round(result * 1e10) / 1e10);
            calcExpr = '';
            calcNewNumber = true;
          } catch (e) {
            calcDisplay = 'Error';
            calcExpr = '';
            calcNewNumber = true;
          }
        } else if (['+', '-', '*', '/', '%', '(', ')'].indexOf(val) !== -1) {
          calcExpr += calcDisplay + val;
          calcNewNumber = true;
        } else {
          if (calcNewNumber) {
            calcDisplay = val === '.' ? '0.' : val;
            calcNewNumber = false;
          } else {
            calcDisplay += val;
          }
        }
        display.textContent = calcDisplay;
      });
    });
  }

  function openNotepad() {
    var contentHtml =
      '<div class="notepad-content">' +
        '<div class="notepad-toolbar">' +
          '<button class="notepad-btn" id="notepad-new">新建</button>' +
          '<button class="notepad-btn" id="notepad-save">保存到文件</button>' +
          '<button class="notepad-btn" id="notepad-open">打开文件</button>' +
          '<input type="file" id="notepad-file-input" class="upload-input-hidden" accept=".txt,.md,.js,.css,.html,.json,.xml,.csv,.log">' +
        '</div>' +
        '<textarea class="notepad-textarea" placeholder="在此输入文本..."></textarea>' +
      '</div>';

    var windowId = createWindow('notepad', 'Notepad', contentHtml);
    var windowEl = document.getElementById(windowId);
    var textarea = windowEl.querySelector('.notepad-textarea');
    var newBtn = windowEl.querySelector('#notepad-new');
    var saveBtn = windowEl.querySelector('#notepad-save');
    var openBtn = windowEl.querySelector('#notepad-open');
    var fileInput = windowEl.querySelector('#notepad-file-input');

    newBtn.addEventListener('click', function() { textarea.value = ''; });

    saveBtn.addEventListener('click', function() {
      var blob = new Blob([textarea.value], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'note.txt';
      a.click();
      URL.revokeObjectURL(a.href);
      showNotification('Notepad', '文件已保存');
    });

    openBtn.addEventListener('click', function() { fileInput.click(); });

    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        textarea.value = ev.target.result;
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    textarea.focus();
  }

  function openSettings() {
    var wpHtml = '';
    Object.keys(wallpapers).forEach(function(name) {
      var bg = wallpapers[name];
      wpHtml += '<div class="wallpaper-thumb" data-wallpaper="' + name + '" style="background:' + bg + ';"></div>';
    });

    var contentHtml =
      '<div class="settings-content">' +
        '<div class="settings-section">' +
          '<div class="settings-title">主题颜色</div>' +
          '<div class="settings-option">' +
            '<span class="settings-label">界面色调</span>' +
            '<div>' +
              '<button class="theme-btn active" data-theme="cyan">青色</button>' +
              '<button class="theme-btn" data-theme="purple">紫色</button>' +
              '<button class="theme-btn" data-theme="green">绿色</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="settings-section">' +
          '<div class="settings-title">壁纸</div>' +
          '<div class="wallpaper-grid">' + wpHtml + '</div>' +
          '<div class="custom-wallpaper-section">' +
            '<div class="custom-wp-btn" id="custom-wp-upload">📷 上传自定义壁纸</div>' +
            '<input type="file" id="custom-wp-file-input" class="upload-input-hidden" accept="image/*">' +
            '<div id="custom-wp-preview" class="custom-wp-preview" style="display:none;"></div>' +
          '</div>' +
        '</div>' +
        '<div class="settings-section">' +
          '<div class="settings-title">字体大小</div>' +
          '<div class="settings-option">' +
            '<span class="settings-label">界面字体</span>' +
            '<div>' +
              '<button class="theme-btn" data-font="12">小</button>' +
              '<button class="theme-btn active" data-font="14">中</button>' +
              '<button class="theme-btn" data-font="16">大</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="settings-section">' +
          '<div class="settings-title">系统信息</div>' +
          '<p style="color:#888;font-size:13px;">ShadowOS v2.0.0<br>HTML + CSS + 原生 JavaScript<br>所有数据存储在浏览器本地</p>' +
        '</div>' +
      '</div>';

    var windowId = createWindow('settings', 'Settings', contentHtml);
    var windowEl = document.getElementById(windowId);

    var themeBtns = windowEl.querySelectorAll('[data-theme]');
    themeBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        themeBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var theme = btn.getAttribute('data-theme');
        var colors = {
          cyan: '#00ffff',
          purple: '#ff00ff',
          green: '#00ff00'
        };
        var c = colors[theme];
        document.documentElement.style.setProperty('--accent', c);
        document.querySelectorAll('.window').forEach(function(w) {
          w.style.borderColor = c + '66';
        });
        showNotification('设置', '主题已切换为' + btn.textContent);
      });
    });

    var wallpaperThumbs = windowEl.querySelectorAll('.wallpaper-thumb');
    wallpaperThumbs.forEach(function(thumb) {
      thumb.addEventListener('click', function() {
        wallpaperThumbs.forEach(function(t) { t.classList.remove('active'); });
        thumb.classList.add('active');
        var name = thumb.getAttribute('data-wallpaper');
        desktop.style.background = wallpapers[name];
        localStorage.setItem('webos-wallpaper', name);
        showNotification('设置', '壁纸已切换为 ' + name);
      });
    });

    var customWpBtn = windowEl.querySelector('#custom-wp-upload');
    var customWpInput = windowEl.querySelector('#custom-wp-file-input');
    var customWpPreview = windowEl.querySelector('#custom-wp-preview');

    customWpBtn.addEventListener('click', function() {
      customWpInput.click();
    });

    customWpInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var dataUrl = ev.target.result;
        customWpPreview.style.display = 'block';
        customWpPreview.innerHTML =
          '<img src="' + dataUrl + '" alt="预览">' +
          '<div class="custom-wp-preview-name">' + file.name + '</div>' +
          '<button class="custom-wp-apply" id="custom-wp-apply-btn">应用壁纸</button>' +
          '<button class="custom-wp-reset" id="custom-wp-reset-btn">恢复默认</button>';

        windowEl.querySelector('#custom-wp-apply-btn').addEventListener('click', function() {
          desktop.style.background = 'url(' + dataUrl + ') center/cover no-repeat';
          localStorage.setItem('shadowos-custom-wp', dataUrl);
          localStorage.removeItem('webos-wallpaper');
          showNotification('设置', '自定义壁纸已应用');
        });

        windowEl.querySelector('#custom-wp-reset-btn').addEventListener('click', function() {
          localStorage.removeItem('shadowos-custom-wp');
          desktop.style.background = wallpapers.cyberpunk;
          showNotification('设置', '已恢复默认壁纸');
        });
      };
      reader.readAsDataURL(file);
      customWpInput.value = '';
    });

    var fontBtns = windowEl.querySelectorAll('[data-font]');
    fontBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        fontBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.body.style.fontSize = btn.getAttribute('data-font') + 'px';
      });
    });

    // 初始化壁纸：优先使用自定义壁纸
    var customWp = localStorage.getItem('shadowos-custom-wp');
    if (customWp) {
      desktop.style.background = 'url(' + customWp + ') center/cover no-repeat';
    } else {
      var savedWp = localStorage.getItem('webos-wallpaper');
      if (savedWp && wallpapers[savedWp]) {
        desktop.style.background = wallpapers[savedWp];
      }
    }
  }

  function createWindow(appType, title, contentHtml) {
    var id = 'window-' + (++windowId);
    var windowEl = document.createElement('div');
    windowEl.className = 'window';
    windowEl.id = id;
    windowEl.style.zIndex = ++windowZIndex;

    if (appType === 'browser') {
      windowEl.style.width = (window.innerWidth - 200) + 'px';
      windowEl.style.height = (window.innerHeight - 150) + 'px';
      windowEl.style.left = '100px';
      windowEl.style.top = '50px';
    } else if (appType === 'calculator') {
      windowEl.style.minWidth = '300px';
      windowEl.style.minHeight = 'auto';
      windowEl.style.width = '320px';
      windowEl.style.height = 'auto';
      windowEl.style.left = (window.innerWidth / 2 - 160) + 'px';
      windowEl.style.top = (window.innerHeight / 2 - 200) + 'px';
    } else if (appType === 'appstore') {
      windowEl.style.width = '620px';
      windowEl.style.height = '550px';
      windowEl.style.left = (window.innerWidth / 2 - 310) + 'px';
      windowEl.style.top = (window.innerHeight / 2 - 275) + 'px';
    } else {
      windowEl.style.left = (80 + Math.random() * 80) + 'px';
      windowEl.style.top = (80 + Math.random() * 80) + 'px';
    }

    windowEl.innerHTML =
      '<div class="window-header">' +
        '<div class="window-title">' + title + '</div>' +
        '<div class="window-controls">' +
          '<button class="window-control window-minimize" title="最小化">−</button>' +
          '<button class="window-control window-maximize" title="最大化">□</button>' +
          '<button class="window-control window-close" title="关闭">×</button>' +
        '</div>' +
      '</div>' +
      '<div class="window-content">' + contentHtml + '</div>';

    desktop.appendChild(windowEl);
    setupWindowDrag(windowEl);
    setupWindowFocus(windowEl);
    setupWindowControls(windowEl, id, appType, title);
    setupWindowResize(windowEl);

    activeWindows[id] = {
      element: windowEl,
      appType: appType,
      title: title,
      minimized: false,
      maximized: false,
      prevStyle: null
    };

    addTaskbarItem(id, title);
    showNotification(title, title + ' 已打开');
    return id;
  }

  function setupWindowDrag(windowEl) {
    var header = windowEl.querySelector('.window-header');
    var isDragging = false;
    var offsetX, offsetY;

    header.addEventListener('mousedown', function(e) {
      if (e.target.classList.contains('window-control')) return;
      isDragging = true;
      var rect = windowEl.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      windowEl.style.transition = 'none';
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var newX = e.clientX - offsetX;
      var newY = e.clientY - offsetY;
      var taskbarHeight = 48;
      var maxX = window.innerWidth - windowEl.offsetWidth;
      var maxY = window.innerHeight - taskbarHeight - windowEl.offsetHeight;
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      windowEl.style.left = newX + 'px';
      windowEl.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', function() {
      isDragging = false;
      windowEl.style.transition = '';
    });
  }

  function setupWindowFocus(windowEl) {
    windowEl.addEventListener('mousedown', function() {
      windowEl.style.zIndex = ++windowZIndex;
    });
  }

  function setupWindowControls(windowEl, id, appType, title) {
    var closeBtn = windowEl.querySelector('.window-close');
    var minimizeBtn = windowEl.querySelector('.window-minimize');
    var maximizeBtn = windowEl.querySelector('.window-maximize');

    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      windowEl.classList.add('closing');
      setTimeout(function() {
        windowEl.remove();
        delete activeWindows[id];
        removeTaskbarItem(id);
      }, 300);
    });

    minimizeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      windowEl.style.display = 'none';
      activeWindows[id].minimized = true;
      updateTaskbarItem(id);
    });

    maximizeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var win = activeWindows[id];
      if (!win) return;

      if (win.maximized) {
        var prev = win.prevStyle;
        windowEl.style.left = prev.left;
        windowEl.style.top = prev.top;
        windowEl.style.width = prev.width;
        windowEl.style.height = prev.height;
        windowEl.style.borderRadius = '12px';
        win.maximized = false;
        maximizeBtn.textContent = '□';
      } else {
        win.prevStyle = {
          left: windowEl.style.left,
          top: windowEl.style.top,
          width: windowEl.style.width,
          height: windowEl.style.height
        };
        windowEl.style.left = '0px';
        windowEl.style.top = '0px';
        windowEl.style.width = '100vw';
        windowEl.style.height = (window.innerHeight - 48) + 'px';
        windowEl.style.borderRadius = '0px';
        win.maximized = true;
        maximizeBtn.textContent = '❐';
      }
    });
  }

  function setupWindowResize(windowEl) {
    var headerHeight = 38;
    var edgeSize = 6;

    var bottomHandle = document.createElement('div');
    bottomHandle.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:' + edgeSize + 'px;cursor:ns-resize;z-index:10000;pointer-events:auto;';
    windowEl.appendChild(bottomHandle);
    bottomHandle.addEventListener('mousedown', function(e) {
      e.preventDefault(); e.stopPropagation();
      var startY = e.clientY;
      var startH = windowEl.offsetHeight;
      windowEl.style.transition = 'none';
      function onMove(ev) {
        windowEl.style.height = Math.max(200, startH + (ev.clientY - startY)) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        windowEl.style.transition = '';
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    var rightHandle = document.createElement('div');
    rightHandle.style.cssText = 'position:absolute;right:0;top:' + headerHeight + 'px;bottom:0;width:' + edgeSize + 'px;cursor:ew-resize;z-index:10000;pointer-events:auto;';
    windowEl.appendChild(rightHandle);
    rightHandle.addEventListener('mousedown', function(e) {
      e.preventDefault(); e.stopPropagation();
      var startX = e.clientX;
      var startW = windowEl.offsetWidth;
      windowEl.style.transition = 'none';
      function onMove(ev) {
        windowEl.style.width = Math.max(300, startW + (ev.clientX - startX)) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        windowEl.style.transition = '';
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    var bottomRight = document.createElement('div');
    bottomRight.style.cssText = 'position:absolute;bottom:0;right:0;width:16px;height:16px;cursor:nwse-resize;z-index:10000;pointer-events:auto;';
    windowEl.appendChild(bottomRight);
    bottomRight.addEventListener('mousedown', function(e) {
      if (activeWindows[windowEl.id] && activeWindows[windowEl.id].maximized) return;
      e.preventDefault(); e.stopPropagation();
      var startX = e.clientX;
      var startY = e.clientY;
      var startW = windowEl.offsetWidth;
      var startH = windowEl.offsetHeight;
      windowEl.style.transition = 'none';
      function onMove(ev) {
        windowEl.style.width = Math.max(300, startW + (ev.clientX - startX)) + 'px';
        windowEl.style.height = Math.max(200, startH + (ev.clientY - startY)) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        windowEl.style.transition = '';
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    var leftHandle = document.createElement('div');
    leftHandle.style.cssText = 'position:absolute;left:0;top:' + headerHeight + 'px;bottom:0;width:' + edgeSize + 'px;cursor:ew-resize;z-index:10000;pointer-events:auto;';
    windowEl.appendChild(leftHandle);
    leftHandle.addEventListener('mousedown', function(e) {
      if (activeWindows[windowEl.id] && activeWindows[windowEl.id].maximized) return;
      e.preventDefault(); e.stopPropagation();
      var startX = e.clientX;
      var startW = windowEl.offsetWidth;
      var startLeft = windowEl.offsetLeft;
      windowEl.style.transition = 'none';
      function onMove(ev) {
        var newW = Math.max(300, startW - (ev.clientX - startX));
        windowEl.style.width = newW + 'px';
        windowEl.style.left = (startLeft + (startW - newW)) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        windowEl.style.transition = '';
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function addTaskbarItem(windowId, title) {
    var item = document.createElement('div');
    item.className = 'taskbar-item';
    item.dataset.windowId = windowId;
    item.textContent = title;

    item.addEventListener('click', function() {
      var win = activeWindows[windowId];
      if (!win) return;

      if (win.minimized) {
        win.element.style.display = 'flex';
        win.minimized = false;
        win.element.style.zIndex = ++windowZIndex;
        updateTaskbarItem(windowId);
      } else {
        win.element.style.zIndex = ++windowZIndex;
      }
    });

    taskbarItems.appendChild(item);
  }

  function updateTaskbarItem(windowId) {
    var item = taskbarItems.querySelector('.taskbar-item[data-window-id="' + windowId + '"]');
    if (item && activeWindows[windowId]) {
      if (activeWindows[windowId].minimized) {
        item.classList.add('minimized');
      } else {
        item.classList.remove('minimized');
      }
    }
  }

  function removeTaskbarItem(windowId) {
    var item = taskbarItems.querySelector('.taskbar-item[data-window-id="' + windowId + '"]');
    if (item) item.remove();
  }

  function openTerminal() {
    var contentHtml =
      '<div class="terminal-content">' +
        '<div class="terminal-output">ShadowOS Terminal v2.0\n输入 "help" 查看可用命令\n使用 "ai + 内容" 调用AI助手\n\n</div>' +
        '<div class="terminal-input-line">' +
          '<span class="terminal-prompt">$</span>' +
          '<input type="text" class="terminal-input" placeholder="输入命令...">' +
        '</div>' +
      '</div>';

    var windowId = createWindow('terminal', 'Terminal', contentHtml);
    var windowEl = document.getElementById(windowId);
    var input = windowEl.querySelector('.terminal-input');
    var output = windowEl.querySelector('.terminal-output');

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var command = input.value.trim();
        if (!command) return;

        output.textContent += '$ ' + command + '\n';

        if (command.startsWith('ai ')) {
          var aiQuery = command.substring(3).trim();
          if (!aiQuery) {
            output.textContent += '用法: ai + 您的问题或内容\n\n';
          } else {
            output.textContent += 'AI思考中...\n\n';
            output.scrollTop = output.scrollHeight;
            simulateAIResponse(aiQuery).then(function(response) {
              output.textContent += '🤖 AI回复:\n' + response + '\n\n';
              output.scrollTop = output.scrollHeight;
            });
          }
        } else if (command === 'clear') {
          output.textContent = '';
        } else {
          var parts = command.split(' ');
          var cmdName = parts[0];
          var cmdArgs = parts.slice(1).join(' ');
          
          if (terminalCommands[cmdName]) {
            var result = terminalCommands[cmdName](cmdArgs);
            if (result === '__CLEAR__') {
              output.textContent = '';
            } else {
              output.textContent += result + '\n\n';
            }
          } else {
            output.textContent += '未知命令: ' + cmdName + '\n输入 "help" 查看可用命令\n\n';
          }
        }

        input.value = '';
        output.scrollTop = output.scrollHeight;
      }
    });

    input.focus();
    windowEl.addEventListener('click', function() {
      input.focus();
    });
  }

  function getFileIcon(name) {
    var ext = name.split('.').pop().toLowerCase();
    var icons = {
      'txt': '', 'md': '', 'docx': '📘', 'doc': '📘',
      'pdf': '📕', 'png': '🖼️', 'jpg': '️', 'jpeg': '️',
      'gif': '🖼️', 'bmp': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
      'mp4': '🎬', 'webm': '', 'mp3': '🎵', 'wav': '🎵',
      'zip': '📦', 'rar': '', '7z': '📦'
    };
    return icons[ext] || '📎';
  }

  function getFileExt(name) {
    return name.split('.').pop().toLowerCase();
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  function showFilePreview(previewEl, name, content) {
    var ext = name.split('.').pop().toLowerCase();
    var isMd = ext === 'md';

    var html =
      '<div class="preview-header">' +
        '<span>📄 ' + name + '</span>' +
        '<button class="close-preview" onclick="this.parentElement.parentElement.style.display=\'none\'">×</button>' +
      '</div>';

    if (isMd && typeof marked !== 'undefined') {
      html += '<div class="md-content">' + marked.parse(content || '') + '</div>';
    } else {
      html += '<pre>' + escapeHtml(content || '') + '</pre>';
    }

    previewEl.style.display = 'block';
    previewEl.innerHTML = html;
  }

  function previewUploadedFile(previewEl, file) {
    var ext = getFileExt(file.name);
    var html =
      '<div class="preview-header">' +
        '<span>📄 ' + file.name + ' (' + formatFileSize(file.size) + ')</span>' +
        '<button class="close-preview" onclick="this.parentElement.parentElement.style.display=\'none\'">×</button>' +
      '</div>';

    if (ext === 'pdf') {
      var url = URL.createObjectURL(file);
      html += '<iframe class="preview-iframe" src="' + url + '"></iframe>';
      previewEl.style.display = 'block';
      previewEl.innerHTML = html;
      return;
    }

    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].indexOf(ext) !== -1) {
      var imgUrl = URL.createObjectURL(file);
      html += '<img class="preview-image" src="' + imgUrl + '" alt="' + file.name + '">';
      previewEl.style.display = 'block';
      previewEl.innerHTML = html;
      return;
    }

    if (['mp4', 'webm'].indexOf(ext) !== -1) {
      var videoUrl = URL.createObjectURL(file);
      html += '<video controls style="max-width:100%;border-radius:8px;margin:10px 0;">' +
        '<source src="' + videoUrl + '">' +
        '</video>';
      previewEl.style.display = 'block';
      previewEl.innerHTML = html;
      return;
    }

    if (['mp3', 'wav'].indexOf(ext) !== -1) {
      var audioUrl = URL.createObjectURL(file);
      html += '<audio controls style="width:100%;margin:10px 0;">' +
        '<source src="' + audioUrl + '">' +
        '</audio>';
      previewEl.style.display = 'block';
      previewEl.innerHTML = html;
      return;
    }

    if (['docx', 'doc'].indexOf(ext) !== -1) {
      var reader2 = new FileReader();
      reader2.onload = function(e) {
        if (typeof JSZip !== 'undefined') {
          JSZip.loadAsync(e.target.result).then(function(zip) {
            return zip.file('word/document.xml').async('string');
          }).then(function(content) {
            var text = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
            previewEl.innerHTML =
              '<div class="preview-header">' +
                '<span> ' + file.name + '</span>' +
                '<button class="close-preview" onclick="this.parentElement.parentElement.style.display=\'none\'">×</button>' +
              '</div>' +
              '<pre>' + escapeHtml(text) + '</pre>';
            previewEl.style.display = 'block';
          }).catch(function() { fallbackDocx(); });
        } else { fallbackDocx(); }
        function fallbackDocx() {
          previewEl.innerHTML =
            '<div class="preview-header">' +
              '<span> ' + file.name + '</span>' +
              '<button class="close-preview" onclick="this.parentElement.parentElement.style.display=\'none\'">×</button>' +
            '</div>' +
            '<div style="padding:20px;text-align:center;color:#888;">' +
              ' Word 文档<br><br>' +
              '<a href="' + URL.createObjectURL(file) + '" download="' + file.name + '" ' +
                'style="color:#00ffff;text-decoration:underline;">点击下载查看</a>' +
              '<br><span style="font-size:12px;color:#666;">浏览器无法直接渲染Word，请下载到本地查看</span>' +
            '</div>';
          previewEl.style.display = 'block';
        }
      };
      reader2.readAsArrayBuffer(file);
      return;
    }

    if (['txt', 'md', 'js', 'css', 'html', 'json', 'xml', 'csv', 'log'].indexOf(ext) !== -1) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var text = e.target.result;
        if (ext === 'md' && typeof marked !== 'undefined') {
          previewEl.innerHTML =
            '<div class="preview-header">' +
              '<span>📄 ' + file.name + '</span>' +
              '<button class="close-preview" onclick="this.parentElement.parentElement.style.display=\'none\'">×</button>' +
            '</div>' +
            '<div class="md-content">' + marked.parse(text) + '</div>';
        } else {
          previewEl.innerHTML =
            '<div class="preview-header">' +
              '<span> ' + file.name + '</span>' +
              '<button class="close-preview" onclick="this.parentElement.parentElement.style.display=\'none\'">×</button>' +
            '</div>' +
            '<pre>' + escapeHtml(text) + '</pre>';
        }
        previewEl.style.display = 'block';
      };
      reader.readAsText(file);
      return;
    }

    html += '<div style="padding:20px;text-align:center;color:#888;">' +
      '不支持预览此文件类型: .' + ext + '<br>' +
      '<span style="font-size:12px;">支持格式: txt, md, pdf, 图片, 视频, 音频等</span>' +
      '</div>';
    previewEl.style.display = 'block';
    previewEl.innerHTML = html;
  }

  function openFiles() {
    var sysFileHtml = '';
    Object.keys(fileSystem).forEach(function(path) {
      var icon = path.endsWith('.txt') || path.endsWith('.md') ? '📄' : '';
      sysFileHtml += '<div class="file-item" data-path="' + path + '" data-type="system">' + icon + ' ' + path + '</div>';
    });

    var contentHtml =
      '<div class="files-content">' +
        '<div class="files-header">📂 文件系统</div>' +
        '<div class="files-toolbar">' +
          '<button class="upload-btn" id="upload-trigger">📤 上传文件</button>' +
          '<span style="color: rgba(0,255,255,0.5); font-size: 12px;">支持 md, docx, pdf, txt, 图片等</span>' +
        '</div>' +
        '<input type="file" class="upload-input-hidden" id="file-upload-input" multiple ' +
          'accept=".md,.docx,.pdf,.txt,.doc,.png,.jpg,.jpeg,.gif,.bmp,.webp,.svg,.mp4,.webm,.mp3,.wav,.zip,.rar,.7z">' +
        '<div class="file-list" id="file-list">' + sysFileHtml + '</div>' +
        '<div class="file-preview-container" id="file-preview" style="display: none;"></div>' +
      '</div>';

    var windowId = createWindow('files', 'Files', contentHtml);
    var windowEl = document.getElementById(windowId);
    var uploadTrigger = windowEl.querySelector('#upload-trigger');
    var fileUploadInput = windowEl.querySelector('#file-upload-input');
    var fileList = windowEl.querySelector('#file-list');
    var filePreview = windowEl.querySelector('#file-preview');
    var localUploadedFiles = [];

    fileDB.loadAll(function(files) {
      uploadedFiles = files;
      uploadedFiles.forEach(function(file) {
        localUploadedFiles.push(file);
        var icon = getFileIcon(file.name);
        var sizeStr = formatFileSize(file.size);
        var item = document.createElement('div');
        item.className = 'file-item';
        item.setAttribute('data-type', 'uploaded');
        item.setAttribute('data-file-index', String(localUploadedFiles.length - 1));
        item.textContent = icon + ' ' + file.name + ' (' + sizeStr + ')';
        fileList.appendChild(item);
      });
    });

    uploadTrigger.addEventListener('click', function() {
      fileUploadInput.click();
    });

    fileUploadInput.addEventListener('change', function(e) {
      var files = Array.from(e.target.files);
      files.forEach(function(file) {
        fileDB.save(file);
        localUploadedFiles.push(file);
        uploadedFiles.push(file);
        var icon = getFileIcon(file.name);
        var sizeStr = formatFileSize(file.size);
        var item = document.createElement('div');
        item.className = 'file-item';
        item.setAttribute('data-type', 'uploaded');
        item.setAttribute('data-file-index', String(localUploadedFiles.length - 1));
        item.textContent = icon + ' ' + file.name + ' (' + sizeStr + ')';
        fileList.appendChild(item);
      });
      fileUploadInput.value = '';
      showNotification('Files', '已上传 ' + files.length + ' 个文件');
    });

    fileList.addEventListener('click', function(e) {
      var item = e.target.closest('.file-item');
      if (!item) return;

      if (item.getAttribute('data-type') === 'system') {
        var path = item.getAttribute('data-path');
        showFilePreview(filePreview, path, fileSystem[path]);
      } else {
        var idx = parseInt(item.getAttribute('data-file-index'));
        if (!isNaN(idx) && localUploadedFiles[idx]) {
          previewUploadedFile(filePreview, localUploadedFiles[idx]);
        }
      }
    });

    fileList.addEventListener('contextmenu', function(e) {
      var item = e.target.closest('.file-item');
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();

      var path = item.getAttribute('data-path');
      var type = item.getAttribute('data-type');

      var menuItems = [];
      if (type === 'system') {
        menuItems = [
          { label: ' 打开', action: function() { showFilePreview(filePreview, path, fileSystem[path]); } },
          { label: ' 删除', action: function() {
            delete fileSystem[path];
            item.remove();
            showNotification('Files', '已删除: ' + path);
          } }
        ];
      } else {
        menuItems = [
          { label: ' 打开', action: function() {
            var idx = parseInt(item.getAttribute('data-file-index'));
            if (!isNaN(idx) && localUploadedFiles[idx]) {
              previewUploadedFile(filePreview, localUploadedFiles[idx]);
            }
          } },
          { label: ' 删除', action: function() {
            var idx = parseInt(item.getAttribute('data-file-index'));
            if (!isNaN(idx) && localUploadedFiles[idx]) {
              fileDB.remove(localUploadedFiles[idx].name);
              uploadedFiles.splice(uploadedFiles.indexOf(localUploadedFiles[idx]), 1);
              localUploadedFiles.splice(idx, 1);
              fileList.querySelectorAll('.file-item').forEach(function(fi, fi2) {
                if (fi2 > idx) fi.setAttribute('data-file-index', String(fi2 - 1));
              });
            }
            item.remove();
            showNotification('Files', '已删除: ' + item.textContent.trim());
          } }
        ];
      }

      showContextMenu(e.clientX, e.clientY, menuItems);
    });
  }

  function openBrowser() {
    var contentHtml =
      '<div class="browser-container" style="display: flex; flex-direction: column; height: 100%;">' +
        '<div class="browser-toolbar" style="display: flex; gap: 8px; padding: 8px; background: rgba(0, 255, 255, 0.05); border-bottom: 1px solid rgba(0, 255, 255, 0.2);">' +
          '<input type="text" class="browser-url-input" placeholder="输入网址，例如 https://example.com" style="flex: 1; padding: 6px 12px; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(0, 255, 255, 0.3); border-radius: 4px; color: #00ffff; font-size: 13px; outline: none;">' +
          '<button class="browser-go-button" style="padding: 6px 16px; background: linear-gradient(90deg, #00ffff, #0088ff); border: none; border-radius: 4px; color: #000; font-weight: bold; cursor: pointer; font-size: 13px;">前往</button>' +
          '<button class="browser-open-new-tab" style="padding: 6px 16px; background: linear-gradient(90deg, #ff00ff, #aa00ff); border: none; border-radius: 4px; color: #fff; font-weight: bold; cursor: pointer; font-size: 13px;">新标签</button>' +
        '</div>' +
        '<iframe class="browser-content" style="flex: 1;" src="https://example.com"></iframe>' +
      '</div>';

    var windowId = createWindow('browser', '暗影浏览器', contentHtml);
    var windowEl = document.getElementById(windowId);
    var urlInput = windowEl.querySelector('.browser-url-input');
    var goButton = windowEl.querySelector('.browser-go-button');
    var newTabButton = windowEl.querySelector('.browser-open-new-tab');
    var iframe = windowEl.querySelector('.browser-content');

    function navigateToUrl() {
      var url = urlInput.value.trim();
      if (!url) return;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      urlInput.value = url;
      iframe.src = url;
      
      // 更新窗口标题栏和任务栏
      var titleEl = windowEl.querySelector('.window-title');
      if (titleEl) titleEl.textContent = url;
      var taskItem = taskbarItems.querySelector('.taskbar-item[data-window-id="' + windowId + '"]');
      if (taskItem) taskItem.textContent = url;
    }

    goButton.addEventListener('click', navigateToUrl);
    urlInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { navigateToUrl(); }
    });

    // iframe 加载完成后更新标题（处理跳转）
    iframe.addEventListener('load', function() {
      try {
        // 尝试获取 iframe 内的标题（跨域会失败）
        var iframeTitle = iframe.contentDocument.title;
        if (iframeTitle) {
          var titleEl = windowEl.querySelector('.window-title');
          if (titleEl) titleEl.textContent = iframeTitle;
          var taskItem = taskbarItems.querySelector('.taskbar-item[data-window-id="' + windowId + '"]');
          if (taskItem) taskItem.textContent = iframeTitle;
        }
      } catch (e) {
        // 跨域时回退到显示 URL
      }
    });

    newTabButton.addEventListener('click', function() {
      var url = urlInput.value.trim() || 'https://example.com';
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      window.open(url, '_blank');
    });

    urlInput.value = 'https://example.com';
  }

  var startBtn = document.getElementById('start-button');
  var startMenu = null;

  document.getElementById('taskbar-start').addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (startMenu) {
      startMenu.remove();
      startMenu = null;
      return;
    }

    startMenu = document.createElement('div');
    startMenu.id = 'start-menu';
    startMenu.innerHTML =
      '<div class="start-menu-header"> ShadowOS</div>' +
      '<div class="start-menu-section">' +
        '<div class="start-menu-item" data-action="terminal">🖥️ Terminal</div>' +
        '<div class="start-menu-item" data-action="files">📁 Files</div>' +
        '<div class="start-menu-item" data-action="browser">🌐 Browser</div>' +
        '<div class="start-menu-item" data-action="calculator">🧮 Calculator</div>' +
        '<div class="start-menu-item" data-action="notepad">📝 Notepad</div>' +
      '</div>' +
      '<div class="start-menu-divider"></div>' +
      '<div class="start-menu-section">' +
        '<div class="start-menu-item" data-action="sticky">📋 Sticky</div>' +
        '<div class="start-menu-item" data-action="calendar">📅 Calendar</div>' +
        '<div class="start-menu-item" data-action="clock">⏰ Clock</div>' +
        '<div class="start-menu-item" data-action="draw">🎨 Draw</div>' +
        '<div class="start-menu-item" data-action="music">🎵 Music</div>' +
        '<div class="start-menu-item" data-action="imageviewer">🖼️ ImageViewer</div>' +
      '</div>' +
      '<div class="start-menu-divider"></div>' +
      '<div class="start-menu-section">' +
        '<div class="start-menu-item" data-action="settings">⚙️ 系统设置</div>' +
        '<div class="start-menu-item" data-action="search">🔍 全局搜索 (Ctrl+K)</div>' +
        '<div class="start-menu-item" data-action="about">ℹ️ 关于系统</div>' +
        '<div class="start-menu-item" data-action="time">🕐 查看时间</div>' +
      '</div>' +
      '<div class="start-menu-divider"></div>' +
      '<div class="start-menu-section">' +
        '<div class="start-menu-item" data-action="lock">🔒 锁屏</div>' +
      '</div>' +
      '<div class="start-menu-footer">ShadowOS v2.0.0 Enhanced</div>';

    document.body.appendChild(startMenu);

    startMenu.addEventListener('click', function(ev) {
      var item = ev.target.closest('.start-menu-item');
      if (!item) return;

      var action = item.getAttribute('data-action');
      switch (action) {
        case 'terminal': openTerminal(); break;
        case 'files': openFiles(); break;
        case 'browser': openBrowser(); break;
        case 'calculator': openCalculator(); break;
        case 'notepad': openNotepad(); break;
        case 'sticky': openSticky(); break;
        case 'calendar': openCalendar(); break;
        case 'clock': openClock(); break;
        case 'draw': openDraw(); break;
        case 'music': openMusic(); break;
        case 'imageviewer': openImageViewer(); break;
        case 'appstore': openAppStore(); break;
        case 'sysmon': openSysMonitor(); break;
        case 'codeeditor': openCodeEditor(); break;
        case 'settings': openSettings(); break;
        case 'search': closeStartMenu(); openGlobalSearch(); break;
        case 'about':
          openAboutDialog();
          break;
        case 'time':
          alert('当前时间: ' + new Date().toLocaleString('zh-CN'));
          break;
        case 'lock':
          lockScreen.style.display = 'flex';
          lockScreen.classList.remove('hidden');
          break;
      }

      closeStartMenu();
    });
  });

  function closeStartMenu() {
    if (startMenu) { startMenu.remove(); startMenu = null; }
  }

  document.addEventListener('click', function(e) {
    var taskbarStart = document.getElementById('taskbar-start');
    if (taskbarStart && taskbarStart.contains(e.target)) return;
    var sm = document.getElementById('start-menu');
    if (sm && sm.contains(e.target)) return;
    closeStartMenu();
  });

  function openAboutDialog() {
    var contentHtml =
      '<div style="text-align: center; padding: 20px; color: #00ffff;">' +
        '<div style="font-size: 48px; margin-bottom: 15px;">⚡</div>' +
        '<h2 style="color: #00ffff; margin-bottom: 10px;">ShadowOS</h2>' +
        '<p style="color: #aaa; font-size: 14px; margin-bottom: 5px;">版本: 2.0.0 Enhanced</p>' +
        '<p style="color: #888; font-size: 13px; margin-bottom: 20px;">基于浏览器的模拟操作系统</p>' +
        '<div style="text-align: left; background: rgba(0,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(0, 255, 255, 0.2);">' +
          '<p style="color: #00ffff; margin-bottom: 8px;">功能特性:</p>' +
          '<p style="color: #aaa; font-size: 13px; line-height: 1.8;">' +
            '• 窗口管理（拖动/缩放/最小化/最大化/关闭）<br>' +
            '• Terminal 终端（含 AI 命令）<br>' +
            '• Files 文件管理器（支持上传和预览）<br>' +
            '• Browser 浏览器（地址栏导航）<br>' +
            '• Calculator 计算器<br>' +
            '• Notepad 记事本<br>' +
            '• 赛博朋克毛玻璃 UI<br>' +
            '• 桌面图标拖拽<br>' +
            '• 任务栏实时时钟<br>' +
            '• 鼠标点击涟漪动效<br>' +
            '• 右键上下文菜单<br>' +
            '• 锁屏界面<br>' +
            '• 系统设置（主题/壁纸/字体）<br>' +
            '• 通知中心<br>' +
            '• 快捷键支持（Ctrl+K/W/T/N/C）<br>' +
            '• 全局搜索' +
          '</p>' +
        '</div>' +
        '<p style="color: #666; font-size: 12px; margin-top: 15px;">HTML + CSS + 原生 JavaScript 构建</p>' +
      '</div>';

    createWindow('about', '关于 ShadowOS', contentHtml);
  }

  function openSticky() {
    var note = document.createElement('div');
    note.className = 'sticky-note';
    note.style.left = (150 + Math.random() * 200) + 'px';
    note.style.top = (100 + Math.random() * 150) + 'px';
    note.style.zIndex = ++windowZIndex;

    var colors = ['#ffff66', '#66ff66', '#66ccff', '#ff66ff', '#ff9966'];
    var colorBtns = colors.map(function(c) {
      return '<div class="sticky-color-btn" style="background:' + c + ';" data-color="' + c + '"></div>';
    }).join('');

    note.innerHTML =
      '<div class="sticky-header">' +
        '<div class="sticky-colors">' + colorBtns + '</div>' +
        '<button class="sticky-close">×</button>' +
      '</div>' +
      '<textarea class="sticky-textarea" placeholder="写点什么..."></textarea>';

    desktop.appendChild(note);

    var header = note.querySelector('.sticky-header');
    var isDragging = false, offsetX, offsetY;

    header.addEventListener('mousedown', function(e) {
      if (e.target.classList.contains('sticky-close') || e.target.classList.contains('sticky-color-btn')) return;
      isDragging = true;
      offsetX = e.clientX - note.offsetLeft;
      offsetY = e.clientY - note.offsetTop;
      note.style.zIndex = ++windowZIndex;
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      note.style.left = (e.clientX - offsetX) + 'px';
      note.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', function() { isDragging = false; });

    note.querySelector('.sticky-close').addEventListener('click', function() { note.remove(); });

    note.querySelector('.sticky-colors').addEventListener('click', function(e) {
      var btn = e.target.closest('.sticky-color-btn');
      if (!btn) return;
      note.style.background = btn.getAttribute('data-color');
    });

    note.querySelector('.sticky-textarea').addEventListener('focus', function() {
      note.style.zIndex = ++windowZIndex;
    });

    showNotification('Sticky', '新便签已创建');
  }

  var calendarEvents = {};
  try { calendarEvents = JSON.parse(localStorage.getItem('shadowos-events') || '{}'); } catch(e) { calendarEvents = {}; }
  var calMonth, calYear;

  function saveCalendarEvents() {
    try { localStorage.setItem('shadowos-events', JSON.stringify(calendarEvents)); } catch(e) {}
  }

  function openCalendar() {
    var now = new Date();
    calMonth = now.getMonth();
    calYear = now.getFullYear();

    var contentHtml =
      '<div class="calendar-content">' +
        '<div class="calendar-header">' +
          '<button class="calendar-nav" id="cal-prev">◀</button>' +
          '<div class="calendar-title" id="cal-title"></div>' +
          '<button class="calendar-nav" id="cal-next">▶</button>' +
        '</div>' +
        '<div class="calendar-weekdays">' +
          '<div class="calendar-weekday">日</div><div class="calendar-weekday">一</div>' +
          '<div class="calendar-weekday">二</div><div class="calendar-weekday">三</div>' +
          '<div class="calendar-weekday">四</div><div class="calendar-weekday">五</div>' +
          '<div class="calendar-weekday">六</div>' +
        '</div>' +
        '<div class="calendar-days" id="cal-days"></div>' +
        '<div class="calendar-events" id="cal-events"></div>' +
      '</div>';

    var windowId = createWindow('calendar', 'Calendar', contentHtml);
    var windowEl = document.getElementById(windowId);
    var selectedDate = null;

    function renderCalendar() {
      var titleEl = windowEl.querySelector('#cal-title');
      var daysEl = windowEl.querySelector('#cal-days');
      var eventsEl = windowEl.querySelector('#cal-events');
      titleEl.textContent = calYear + '年' + (calMonth + 1) + '月';

      var firstDay = new Date(calYear, calMonth, 1).getDay();
      var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      var daysInPrev = new Date(calYear, calMonth, 0).getDate();
      var today = new Date();

      var html = '';
      for (var i = firstDay - 1; i >= 0; i--) {
        html += '<div class="calendar-day other-month">' + (daysInPrev - i) + '</div>';
      }
      for (var d = 1; d <= daysInMonth; d++) {
        var key = calYear + '-' + (calMonth + 1) + '-' + d;
        var isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
        var hasEv = calendarEvents[key] && calendarEvents[key].length > 0;
        var cls = 'calendar-day' + (isToday ? ' today' : '') + (hasEv ? ' has-event' : '');
        html += '<div class="' + cls + '" data-day="' + d + '">' + d + '</div>';
      }
      var remaining = 42 - (firstDay + daysInMonth);
      for (var r = 1; r <= remaining && (firstDay + daysInMonth + r) <= 42; r++) {
        html += '<div class="calendar-day other-month">' + r + '</div>';
      }
      daysEl.innerHTML = html;

      daysEl.querySelectorAll('.calendar-day:not(.other-month)').forEach(function(dayEl) {
        dayEl.addEventListener('click', function() {
          var day = parseInt(dayEl.getAttribute('data-day'));
          selectedDate = calYear + '-' + (calMonth + 1) + '-' + day;
          renderEvents();
        });
      });

      if (selectedDate) renderEvents();
    }

    function renderEvents() {
      var eventsEl = windowEl.querySelector('#cal-events');
      if (!selectedDate) {
        eventsEl.innerHTML = '<p style="color:#666;font-size:12px;text-align:center;">点击日期添加日程</p>';
        return;
      }
      var evts = calendarEvents[selectedDate] || [];
      var html = '<div class="calendar-events-title">📌 ' + selectedDate + ' 的日程</div>';
      evts.forEach(function(evt, idx) {
        html += '<div class="calendar-event"><span>' + evt + '</span><button class="calendar-event-del" data-idx="' + idx + '">×</button></div>';
      });
      html += '<div class="calendar-add-event">' +
        '<input type="text" id="cal-event-input" placeholder="输入日程内容...">' +
        '<button id="cal-event-add">添加</button></div>';
      eventsEl.innerHTML = html;

      eventsEl.querySelector('#cal-event-add').addEventListener('click', function() {
        var input = eventsEl.querySelector('#cal-event-input');
        var val = input.value.trim();
        if (!val) return;
        if (!calendarEvents[selectedDate]) calendarEvents[selectedDate] = [];
        calendarEvents[selectedDate].push(val);
        saveCalendarEvents();
        input.value = '';
        renderCalendar();
        renderEvents();
      });

      eventsEl.querySelector('#cal-event-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') eventsEl.querySelector('#cal-event-add').click();
      });

      eventsEl.querySelectorAll('.calendar-event-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(btn.getAttribute('data-idx'));
          calendarEvents[selectedDate].splice(idx, 1);
          saveCalendarEvents();
          renderCalendar();
          renderEvents();
        });
      });
    }

    windowEl.querySelector('#cal-prev').addEventListener('click', function() {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });
    windowEl.querySelector('#cal-next').addEventListener('click', function() {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });

    renderCalendar();
    renderEvents();
  }

  var countdownTimer = null;
  var countdownRemaining = 0;

  function openClock() {
    var contentHtml =
      '<div class="clock-content">' +
        '<div id="world-clocks"></div>' +
        '<div class="countdown-section">' +
          '<div class="calendar-events-title">⏱️ 倒计时</div>' +
          '<div class="countdown-inputs">' +
            '<input type="number" id="cd-min" placeholder="分" min="0" max="999" value="5">' +
            '<span style="color:#888;">分</span>' +
            '<input type="number" id="cd-sec" placeholder="秒" min="0" max="59" value="0">' +
            '<span style="color:#888;">秒</span>' +
          '</div>' +
          '<div class="countdown-display" id="cd-display">05:00</div>' +
          '<div class="countdown-btns">' +
            '<button id="cd-start">开始</button>' +
            '<button id="cd-pause">暂停</button>' +
            '<button id="cd-reset">重置</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var windowId = createWindow('clock', 'Clock', contentHtml);
    var windowEl = document.getElementById(windowId);
    var worldEl = windowEl.querySelector('#world-clocks');
    var cdDisplay = windowEl.querySelector('#cd-display');
    var cdMinInput = windowEl.querySelector('#cd-min');
    var cdSecInput = windowEl.querySelector('#cd-sec');

    var cities = [
      { name: '北京', tz: 'Asia/Shanghai' },
      { name: '东京', tz: 'Asia/Tokyo' },
      { name: '纽约', tz: 'America/New_York' },
      { name: '伦敦', tz: 'Europe/London' },
      { name: '悉尼', tz: 'Australia/Sydney' },
      { name: '莫斯科', tz: 'Europe/Moscow' }
    ];

    function updateWorldClocks() {
      var html = '<div class="calendar-events-title">🌍 世界时钟</div>';
      cities.forEach(function(city) {
        var time = new Date().toLocaleTimeString('zh-CN', { timeZone: city.tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        html += '<div class="world-clock-item"><span class="clock-city">' + city.name + '</span><span class="clock-time">' + time + '</span></div>';
      });
      worldEl.innerHTML = html;
    }

    updateWorldClocks();
    var wcInterval = setInterval(updateWorldClocks, 1000);

    function updateCountdownDisplay() {
      var m = Math.floor(countdownRemaining / 60);
      var s = countdownRemaining % 60;
      cdDisplay.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    windowEl.querySelector('#cd-start').addEventListener('click', function() {
      if (countdownTimer) return;
      if (countdownRemaining <= 0) {
        countdownRemaining = parseInt(cdMinInput.value || 0) * 60 + parseInt(cdSecInput.value || 0);
      }
      if (countdownRemaining <= 0) return;
      cdDisplay.classList.remove('finished');
      countdownTimer = setInterval(function() {
        countdownRemaining--;
        updateCountdownDisplay();
        if (countdownRemaining <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          cdDisplay.classList.add('finished');
          cdDisplay.textContent = '⏰ 时间到！';
          showNotification('倒计时', '时间到了！', false);
        }
      }, 1000);
    });

    windowEl.querySelector('#cd-pause').addEventListener('click', function() {
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    });

    windowEl.querySelector('#cd-reset').addEventListener('click', function() {
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      countdownRemaining = 0;
      cdDisplay.classList.remove('finished');
      updateCountdownDisplay();
    });

    cdMinInput.addEventListener('input', function() { countdownRemaining = 0; updateCountdownDisplay(); });
    cdSecInput.addEventListener('input', function() { countdownRemaining = 0; updateCountdownDisplay(); });

    var cleanup = function() {
      clearInterval(wcInterval);
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    };
    var origClose = windowEl.querySelector('.window-close').onclick;
    windowEl.querySelector('.window-close').addEventListener('click', function() {
      cleanup();
    }, { once: false });
  }

  function openDraw() {
    var contentHtml =
      '<div class="draw-content">' +
        '<div class="draw-toolbar">' +
          '<button class="draw-tool-btn active" data-tool="pen">画笔</button>' +
          '<button class="draw-tool-btn" data-tool="eraser">橡皮</button>' +
          '<button class="draw-tool-btn" data-tool="line">直线</button>' +
          '<button class="draw-tool-btn" data-tool="rect">矩形</button>' +
          '<button class="draw-tool-btn" data-tool="circle">圆形</button>' +
          '<input type="color" class="draw-color-picker" id="draw-color" value="#00ffff">' +
          '<input type="range" class="draw-size-slider" id="draw-size" min="1" max="20" value="3">' +
          '<button class="draw-tool-btn" id="draw-clear">清空</button>' +
          '<button class="draw-tool-btn" id="draw-save">保存</button>' +
        '</div>' +
        '<div class="draw-canvas-wrap" id="draw-canvas-wrap"><canvas id="draw-canvas"></canvas></div>' +
      '</div>';

    var windowId = createWindow('draw', 'Draw', contentHtml);
    var windowEl = document.getElementById(windowId);
    var wrap = windowEl.querySelector('#draw-canvas-wrap');
    var canvas = windowEl.querySelector('#draw-canvas');
    var ctx = canvas.getContext('2d');

    function resizeCanvas() {
      var rect = wrap.getBoundingClientRect();
      var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(imgData, 0, 0);
    }

    setTimeout(resizeCanvas, 50);

    var currentTool = 'pen';
    var currentColor = '#00ffff';
    var currentSize = 3;
    var isDrawing = false;
    var lastX, lastY;
    var startX, startY;

    windowEl.querySelectorAll('[data-tool]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        windowEl.querySelectorAll('[data-tool]').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentTool = btn.getAttribute('data-tool');
      });
    });

    windowEl.querySelector('#draw-color').addEventListener('input', function(e) { currentColor = e.target.value; });
    windowEl.querySelector('#draw-size').addEventListener('input', function(e) { currentSize = parseInt(e.target.value); });

    windowEl.querySelector('#draw-clear').addEventListener('click', function() {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    windowEl.querySelector('#draw-save').addEventListener('click', function() {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'drawing.png';
      a.click();
      showNotification('Draw', '图片已保存');
    });

    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    var snapshot;

    canvas.addEventListener('mousedown', function(e) {
      isDrawing = true;
      var pos = getPos(e);
      lastX = pos.x; lastY = pos.y;
      startX = pos.x; startY = pos.y;
      if (['line', 'rect', 'circle'].indexOf(currentTool) !== -1) {
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    });

    canvas.addEventListener('mousemove', function(e) {
      if (!isDrawing) return;
      var pos = getPos(e);
      ctx.lineWidth = currentSize;
      ctx.lineCap = 'round';

      if (currentTool === 'pen') {
        ctx.strokeStyle = currentColor;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastX = pos.x; lastY = pos.y;
      } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, currentSize * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (currentTool === 'line') {
        ctx.putImageData(snapshot, 0, 0);
        ctx.strokeStyle = currentColor;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (currentTool === 'rect') {
        ctx.putImageData(snapshot, 0, 0);
        ctx.strokeStyle = currentColor;
        ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
      } else if (currentTool === 'circle') {
        ctx.putImageData(snapshot, 0, 0);
        ctx.strokeStyle = currentColor;
        var rx = Math.abs(pos.x - startX) / 2;
        var ry = Math.abs(pos.y - startY) / 2;
        var cx = startX + (pos.x - startX) / 2;
        var cy = startY + (pos.y - startY) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    canvas.addEventListener('mouseup', function() { isDrawing = false; });
    canvas.addEventListener('mouseleave', function() { isDrawing = false; });
  }

  var audioContext, analyser, audioData, musicAnimId;
  var musicPlaylist = [];
  var currentMusicIdx = -1;
  var audioEl = null;

  function openMusic() {
    var contentHtml =
      '<div class="music-content">' +
        '<div class="music-upload-area" id="music-upload">' +
          '<div class="music-upload-icon">🎵</div>' +
          '<div>点击或拖拽上传音乐文件</div>' +
          '<div style="font-size:11px;color:#666;margin-top:4px;">支持 MP3, WAV, OGG</div>' +
        '</div>' +
        '<input type="file" id="music-file-input" class="upload-input-hidden" accept=".mp3,.wav,.ogg,.flac,.aac" multiple>' +
        '<canvas class="music-visualizer" id="music-visualizer"></canvas>' +
        '<div class="music-player" id="music-player" style="display:none;">' +
          '<div class="music-title" id="music-title">未播放</div>' +
          '<div class="music-controls">' +
            '<button class="music-btn" id="music-prev">⏮</button>' +
            '<button class="music-btn" id="music-play">▶</button>' +
            '<button class="music-btn" id="music-next">⏭</button>' +
          '</div>' +
          '<div class="music-progress-wrap">' +
            '<span class="music-time" id="music-cur-time">0:00</span>' +
            '<div class="music-progress" id="music-progress"><div class="music-progress-fill" id="music-progress-fill" style="width:0%"></div></div>' +
            '<span class="music-time" id="music-total">0:00</span>' +
          '</div>' +
        '</div>' +
        '<div class="music-playlist" id="music-playlist"></div>' +
      '</div>';

    var windowId = createWindow('music', 'Music', contentHtml);
    var windowEl = document.getElementById(windowId);
    var uploadArea = windowEl.querySelector('#music-upload');
    var fileInput = windowEl.querySelector('#music-file-input');
    var playlistEl = windowEl.querySelector('#music-playlist');
    var playerEl = windowEl.querySelector('#music-player');
    var visualizer = windowEl.querySelector('#music-visualizer');
    var vCtx = visualizer.getContext('2d');

    function formatTime(sec) {
      var m = Math.floor(sec / 60);
      var s = Math.floor(sec % 60);
      return m + ':' + String(s).padStart(2, '0');
    }

    function initAudio() {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        audioData = new Uint8Array(analyser.frequencyBinCount);
      }
    }

    function drawVisualizer() {
      if (!analyser) return;
      analyser.getByteFrequencyData(audioData);
      var w = visualizer.width = visualizer.offsetWidth;
      var h = visualizer.height = visualizer.offsetHeight;
      vCtx.clearRect(0, 0, w, h);
      var barWidth = w / audioData.length * 2.5;
      var x = 0;
      for (var i = 0; i < audioData.length; i++) {
        var barHeight = (audioData[i] / 255) * h;
        var hue = (i / audioData.length) * 180 + 160;
        vCtx.fillStyle = 'hsla(' + hue + ', 100%, 60%, 0.8)';
        vCtx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
      musicAnimId = requestAnimationFrame(drawVisualizer);
    }

    function loadTrack(idx) {
      if (idx < 0 || idx >= musicPlaylist.length) return;
      currentMusicIdx = idx;
      if (audioEl) { audioEl.pause(); audioEl.remove(); }
      audioEl = new Audio();
      audioEl.src = URL.createObjectURL(musicPlaylist[idx]);
      windowEl.querySelector('#music-title').textContent = musicPlaylist[idx].name;

      audioEl.addEventListener('loadedmetadata', function() {
        windowEl.querySelector('#music-total').textContent = formatTime(audioEl.duration);
      });

      audioEl.addEventListener('timeupdate', function() {
        windowEl.querySelector('#music-cur-time').textContent = formatTime(audioEl.currentTime);
        var pct = (audioEl.currentTime / audioEl.duration) * 100;
        windowEl.querySelector('#music-progress-fill').style.width = pct + '%';
      });

      audioEl.addEventListener('ended', function() {
        if (currentMusicIdx < musicPlaylist.length - 1) {
          loadTrack(currentMusicIdx + 1);
          playMusic();
        }
      });

      audioEl.addEventListener('canplay', function() {
        initAudio();
        try {
          var src = audioContext.createMediaElementSource(audioEl);
          src.connect(analyser);
          analyser.connect(audioContext.destination);
        } catch(e) {}
        drawVisualizer();
      });

      renderPlaylist();
    }

    function playMusic() {
      if (!audioEl) return;
      initAudio();
      if (audioContext.state === 'suspended') audioContext.resume();
      audioEl.play();
      windowEl.querySelector('#music-play').textContent = '⏸';
    }

    function pauseMusic() {
      if (audioEl) audioEl.pause();
      windowEl.querySelector('#music-play').textContent = '▶';
    }

    windowEl.querySelector('#music-play').addEventListener('click', function() {
      if (!audioEl || audioEl.paused) {
        if (currentMusicIdx === -1 && musicPlaylist.length > 0) loadTrack(0);
        playMusic();
      } else {
        pauseMusic();
      }
    });

    windowEl.querySelector('#music-prev').addEventListener('click', function() {
      if (currentMusicIdx > 0) { loadTrack(currentMusicIdx - 1); playMusic(); }
    });

    windowEl.querySelector('#music-next').addEventListener('click', function() {
      if (currentMusicIdx < musicPlaylist.length - 1) { loadTrack(currentMusicIdx + 1); playMusic(); }
    });

    windowEl.querySelector('#music-progress').addEventListener('click', function(e) {
      if (!audioEl || !audioEl.duration) return;
      var rect = e.currentTarget.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      audioEl.currentTime = pct * audioEl.duration;
    });

    uploadArea.addEventListener('click', function() { fileInput.click(); });

    uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'rgba(0,255,255,0.6)'; });
    uploadArea.addEventListener('dragleave', function() { uploadArea.style.borderColor = 'rgba(0,255,255,0.3)'; });
    uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      uploadArea.style.borderColor = 'rgba(0,255,255,0.3)';
      var files = Array.from(e.dataTransfer.files).filter(function(f) {
        return f.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac)$/i.test(f.name);
      });
      if (files.length) addFiles(files);
    });

    fileInput.addEventListener('change', function(e) {
      addFiles(Array.from(e.target.files));
      fileInput.value = '';
    });

    function addFiles(files) {
      musicPlaylist = musicPlaylist.concat(files);
      renderPlaylist();
      if (currentMusicIdx === -1) {
        loadTrack(0);
        playerEl.style.display = 'block';
      }
      showNotification('Music', '已添加 ' + files.length + ' 首音乐');
    }

    function renderPlaylist() {
      var html = '';
      musicPlaylist.forEach(function(file, idx) {
        var active = idx === currentMusicIdx ? ' active' : '';
        html += '<div class="music-playlist-item' + active + '" data-idx="' + idx + '">' +
          '<span>🎵 ' + file.name + '</span><span style="color:#666;">' + formatFileSize(file.size) + '</span></div>';
      });
      playlistEl.innerHTML = html;

      playlistEl.querySelectorAll('.music-playlist-item').forEach(function(item) {
        item.addEventListener('click', function() {
          loadTrack(parseInt(item.getAttribute('data-idx')));
          playMusic();
        });
      });
    }

    var cleanupMusic = function() {
      if (musicAnimId) cancelAnimationFrame(musicAnimId);
      if (audioEl) { audioEl.pause(); audioEl = null; }
    };
    windowEl.querySelector('.window-close').addEventListener('click', cleanupMusic, { once: false });
  }

  var imgViewImages = [];
  var imgViewIdx = 0;
  var imgViewZoom = 1;
  var imgViewRotation = 0;

  function openImageViewer() {
    var contentHtml =
      '<div class="imgview-content">' +
        '<div class="imgview-toolbar">' +
          '<button class="notepad-btn" id="imgview-open">📂 打开图片</button>' +
          '<button class="notepad-btn" id="imgview-zoomin">🔍+</button>' +
          '<button class="notepad-btn" id="imgview-zoomout">🔍-</button>' +
          '<button class="notepad-btn" id="imgview-rotate">↻ 旋转</button>' +
          '<button class="notepad-btn" id="imgview-fit">适应</button>' +
          '<button class="notepad-btn" id="imgview-slideshow">▶ 幻灯片</button>' +
          '<input type="file" id="imgview-file-input" class="upload-input-hidden" accept=".png,.jpg,.jpeg,.gif,.bmp,.webp,.svg" multiple>' +
        '</div>' +
        '<div class="imgview-display" id="imgview-display">' +
          '<p style="color:#666;">点击"打开图片"加载图片</p>' +
        '</div>' +
        '<div class="imgview-info" id="imgview-info"></div>' +
        '<div class="imgview-slides" id="imgview-slides"></div>' +
      '</div>';

    var windowId = createWindow('imageviewer', 'Image Viewer', contentHtml);
    var windowEl = document.getElementById(windowId);
    var display = windowEl.querySelector('#imgview-display');
    var info = windowEl.querySelector('#imgview-info');
    var slides = windowEl.querySelector('#imgview-slides');
    var openBtn = windowEl.querySelector('#imgview-open');
    var fileInput = windowEl.querySelector('#imgview-file-input');
    var slideTimer = null;

    function showImage(idx) {
      if (idx < 0 || idx >= imgViewImages.length) return;
      imgViewIdx = idx;
      imgViewZoom = 1;
      imgViewRotation = 0;
      var url = URL.createObjectURL(imgViewImages[idx]);
      display.innerHTML = '<img id="imgview-img" src="' + url + '" style="transform:scale(' + imgViewZoom + ') rotate(' + imgViewRotation + 'deg);">';
      info.textContent = imgViewImages[idx].name + ' (' + formatFileSize(imgViewImages[idx].size) + ')';
      renderThumbs();
    }

    function renderThumbs() {
      var html = '';
      imgViewImages.forEach(function(file, idx) {
        var active = idx === imgViewIdx ? ' active' : '';
        html += '<img class="imgview-thumb' + active + '" src="' + URL.createObjectURL(file) + '" data-idx="' + idx + '">';
      });
      slides.innerHTML = html;
      slides.querySelectorAll('.imgview-thumb').forEach(function(thumb) {
        thumb.addEventListener('click', function() {
          showImage(parseInt(thumb.getAttribute('data-idx')));
        });
      });
    }

    function updateTransform() {
      var img = display.querySelector('img');
      if (img) img.style.transform = 'scale(' + imgViewZoom + ') rotate(' + imgViewRotation + 'deg)';
    }

    openBtn.addEventListener('click', function() { fileInput.click(); });

    fileInput.addEventListener('change', function(e) {
      var files = Array.from(e.target.files);
      if (files.length) {
        imgViewImages = files;
        imgViewIdx = 0;
        showImage(0);
        showNotification('ImageViewer', '已加载 ' + files.length + ' 张图片');
      }
      fileInput.value = '';
    });

    windowEl.querySelector('#imgview-zoomin').addEventListener('click', function() {
      imgViewZoom = Math.min(5, imgViewZoom + 0.25);
      updateTransform();
    });

    windowEl.querySelector('#imgview-zoomout').addEventListener('click', function() {
      imgViewZoom = Math.max(0.25, imgViewZoom - 0.25);
      updateTransform();
    });

    windowEl.querySelector('#imgview-rotate').addEventListener('click', function() {
      imgViewRotation = (imgViewRotation + 90) % 360;
      updateTransform();
    });

    windowEl.querySelector('#imgview-fit').addEventListener('click', function() {
      imgViewZoom = 1;
      imgViewRotation = 0;
      updateTransform();
    });

    windowEl.querySelector('#imgview-slideshow').addEventListener('click', function() {
      if (slideTimer) {
        clearInterval(slideTimer);
        slideTimer = null;
        showNotification('ImageViewer', '幻灯片已停止');
      } else {
        slideTimer = setInterval(function() {
          showImage((imgViewIdx + 1) % imgViewImages.length);
        }, 3000);
        showNotification('ImageViewer', '幻灯片播放中 (3秒/张)');
      }
    });

    display.addEventListener('wheel', function(e) {
      e.preventDefault();
      imgViewZoom = Math.max(0.25, Math.min(5, imgViewZoom + (e.deltaY > 0 ? -0.1 : 0.1)));
      updateTransform();
    });
  }

  document.querySelectorAll('.desktop-icon').forEach(function(icon) {
    icon.addEventListener('click', function() {
      if (!icon.classList.contains('was-dragged')) {
        var app = icon.getAttribute('data-app');
        switch (app) {
          case 'terminal': openTerminal(); break;
          case 'files': openFiles(); break;
          case 'browser': openBrowser(); break;
          case 'calculator': openCalculator(); break;
          case 'notepad': openNotepad(); break;
          case 'sticky': openSticky(); break;
          case 'calendar': openCalendar(); break;
          case 'clock': openClock(); break;
          case 'draw': openDraw(); break;
          case 'music': openMusic(); break;
          case 'imageviewer': openImageViewer(); break;
          case 'appstore': openAppStore(); break;
          case 'sysmon': openSysMonitor(); break;
          case 'codeeditor': openCodeEditor(); break;
        }
      }
      icon.classList.remove('was-dragged');
    });
  });

  document.querySelectorAll('.desktop-icon').forEach(function(icon) {
    var isDragging = false;
    var hasDragged = false;
    var startX, startY;
    var iconStartX, iconStartY;

    icon.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      isDragging = true;
      hasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      var rect = icon.getBoundingClientRect();
      iconStartX = rect.left;
      iconStartY = rect.top;
      icon.classList.add('dragging');
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasDragged = true;
        icon.classList.add('was-dragged');
      }
      if (hasDragged) {
        var newX = iconStartX + dx;
        var newY = iconStartY + dy;
        var maxX = window.innerWidth - icon.offsetWidth;
        var maxY = window.innerHeight - 48 - icon.offsetHeight;
        icon.style.position = 'absolute';
        icon.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
        icon.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
      }
    });

    document.addEventListener('mouseup', function() {
      isDragging = false;
      icon.classList.remove('dragging');
    });
  });

  updateClock();
  setInterval(updateClock, 1000);

  fileDB.loadAll(function(files) {
    uploadedFiles = files;
  });

  // ===== Weather Widget =====
  (function() {
    var weatherData = {
      '北京': { temp: 26, icon: '☀️', desc: '晴朗', humidity: '45%', wind: '3级', high: 28, low: 18, forecast: [
        { label: '明天', high: 28, low: 18, icon: '☀️' },
        { label: '后天', high: 25, low: 16, icon: '🌧️' },
        { label: '周四', high: 22, low: 14, icon: '' }
      ]},
      '上海': { temp: 28, icon: '⛅', desc: '多云', humidity: '55%', wind: '2级', high: 30, low: 22, forecast: [
        { label: '明天', high: 30, low: 22, icon: '⛅' },
        { label: '后天', high: 27, low: 20, icon: '🌧️' },
        { label: '周四', high: 25, low: 19, icon: '🌧️' }
      ]},
      '广州': { temp: 32, icon: '️', desc: '晴热', humidity: '60%', wind: '2级', high: 34, low: 25, forecast: [
        { label: '明天', high: 34, low: 25, icon: '🌤️' },
        { label: '后天', high: 33, low: 26, icon: '⛈️' },
        { label: '周四', high: 31, low: 24, icon: '🌧️' }
      ]},
      '深圳': { temp: 31, icon: '️', desc: '雷阵雨', humidity: '70%', wind: '4级', high: 33, low: 26, forecast: [
        { label: '明天', high: 33, low: 26, icon: '🌧️' },
        { label: '后天', high: 30, low: 24, icon: '⛅' },
        { label: '周四', high: 32, low: 25, icon: '☀️' }
      ]},
      '杭州': { temp: 27, icon: '🌧️', desc: '小雨', humidity: '65%', wind: '3级', high: 29, low: 20, forecast: [
        { label: '明天', high: 29, low: 20, icon: '🌧️' },
        { label: '后天', high: 26, low: 18, icon: '⛅' },
        { label: '周四', high: 28, low: 19, icon: '️' }
      ]},
      '成都': { temp: 23, icon: '☁️', desc: '阴天', humidity: '72%', wind: '1级', high: 25, low: 17, forecast: [
        { label: '明天', high: 25, low: 17, icon: '☁️' },
        { label: '后天', high: 22, low: 16, icon: '🌧️' },
        { label: '周四', high: 24, low: 18, icon: '⛅' }
      ]},
      '东京': { temp: 22, icon: '⛅', desc: '多云', humidity: '50%', wind: '2级', high: 24, low: 16, forecast: [
        { label: '明天', high: 24, low: 16, icon: '⛅' },
        { label: '后天', high: 21, low: 15, icon: '🌧️' },
        { label: '周四', high: 23, low: 17, icon: '☀️' }
      ]},
      '纽约': { temp: 18, icon: '🌧️', desc: '阵雨', humidity: '68%', wind: '5级', high: 20, low: 12, forecast: [
        { label: '明天', high: 20, low: 12, icon: '🌧️' },
        { label: '后天', high: 17, low: 10, icon: '☁️' },
        { label: '周四', high: 19, low: 11, icon: '⛅' }
      ]}
    };

    var currentCity = localStorage.getItem('shadowos-weather-city') || '北京';
    var citySelect = document.getElementById('weather-city-select');
    var cityDropdown = document.getElementById('weather-city-dropdown');
    var refreshBtn = document.getElementById('weather-refresh');
    var cityNameEl = document.querySelector('.weather-city-name');
    var weatherIconEl = document.getElementById('weather-icon');
    var weatherTempEl = document.getElementById('weather-temp');
    var weatherDescEl = document.getElementById('weather-desc');
    var weatherHumidityEl = document.getElementById('weather-humidity');
    var weatherWindEl = document.getElementById('weather-wind');
    var weatherForecastEl = document.getElementById('weather-forecast');

    function renderWeather(city) {
      var data = weatherData[city];
      if (!data) return;
      cityNameEl.textContent = city;
      weatherIconEl.textContent = data.icon;
      weatherTempEl.textContent = data.temp + '°';
      weatherDescEl.textContent = data.desc;
      weatherHumidityEl.textContent = data.humidity;
      weatherWindEl.textContent = data.wind;

      var forecastHtml = '';
      data.forecast.forEach(function(f) {
        forecastHtml += '<div class="forecast-day">' + f.label + ' <span class="forecast-temp">' + f.high + '°/' + f.low + '°</span> ' + f.icon + '</div>';
      });
      weatherForecastEl.innerHTML = forecastHtml;
    }

    function refreshWeather() {
      refreshBtn.classList.add('spinning');
      setTimeout(function() {
        var data = weatherData[currentCity];
        if (data) {
          // 模拟温度小幅波动
          data.temp += Math.floor(Math.random() * 3) - 1;
          renderWeather(currentCity);
        }
        refreshBtn.classList.remove('spinning');
      }, 600);
    }

    citySelect.addEventListener('click', function(e) {
      e.stopPropagation();
      citySelect.classList.toggle('open');
      cityDropdown.classList.toggle('show');
    });

    document.querySelectorAll('.city-option').forEach(function(opt) {
      opt.addEventListener('click', function() {
        currentCity = opt.getAttribute('data-city');
        localStorage.setItem('shadowos-weather-city', currentCity);
        renderWeather(currentCity);
        document.querySelectorAll('.city-option').forEach(function(o) { o.classList.remove('active'); });
        opt.classList.add('active');
        citySelect.classList.remove('open');
        cityDropdown.classList.remove('show');
      });
    });

    refreshBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      refreshWeather();
    });

    document.addEventListener('click', function() {
      citySelect.classList.remove('open');
      cityDropdown.classList.remove('show');
    });

    // 初始化
    document.querySelectorAll('.city-option').forEach(function(opt) {
      if (opt.getAttribute('data-city') === currentCity) {
        opt.classList.add('active');
      }
    });
    renderWeather(currentCity);
  })();

  // ===== Pomodoro Widget =====
  (function() {
    var pomoTimer = null;
    var pomoTimeLeft = 25 * 60;
    var pomoTotalTime = 25 * 60;
    var pomoRunning = false;
    var pomoMode = 'work';
    var pomoCompleted = parseInt(localStorage.getItem('pomo-completed') || '0');
    var pomoMinutes = parseInt(localStorage.getItem('pomo-minutes') || '0');

    var timeDisplay = document.getElementById('pomodoro-time');
    var statusEl = document.getElementById('pomodoro-status');
    var startBtn = document.getElementById('pomodoro-start');
    var pauseBtn = document.getElementById('pomodoro-pause');
    var resetBtn = document.getElementById('pomodoro-reset');
    var ringProgress = document.querySelector('.pomodoro-ring-progress');
    var countEl = document.getElementById('pomodoro-count');
    var totalEl = document.getElementById('pomodoro-total');
    var circumference = 339.292;

    function formatTime(sec) {
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function updateDisplay() {
      timeDisplay.textContent = formatTime(pomoTimeLeft);
      var progress = (1 - pomoTimeLeft / pomoTotalTime) * circumference;
      ringProgress.setAttribute('stroke-dashoffset', progress);
    }

    function updateStats() {
      countEl.textContent = pomoCompleted;
      totalEl.textContent = pomoMinutes;
    }

    function saveStats() {
      localStorage.setItem('pomo-completed', pomoCompleted);
      localStorage.setItem('pomo-minutes', pomoMinutes);
    }

    function tick() {
      pomoTimeLeft--;
      updateDisplay();
      if (pomoTimeLeft <= 0) {
        clearInterval(pomoTimer);
        pomoTimer = null;
        pomoRunning = false;
        startBtn.style.display = '';
        pauseBtn.style.display = 'none';

        if (pomoMode === 'work') {
          pomoCompleted++;
          pomoMinutes += 25;
          saveStats();
          updateStats();
          showNotification('番茄钟', '🎉 专注完成！休息一下吧', false);
          // 自动切换到休息
          document.querySelector('[data-mode="break"]').click();
        } else {
          showNotification('番茄钟', ' 休息结束！准备下一轮专注', false);
          // 自动切换到专注
          document.querySelector('[data-mode="work"]').click();
        }
      }
    }

    startBtn.addEventListener('click', function() {
      if (pomoRunning) return;
      pomoRunning = true;
      startBtn.style.display = 'none';
      pauseBtn.style.display = '';
      pomoTimer = setInterval(tick, 1000);
    });

    pauseBtn.addEventListener('click', function() {
      if (!pomoRunning) return;
      pomoRunning = false;
      clearInterval(pomoTimer);
      pomoTimer = null;
      startBtn.style.display = '';
      pauseBtn.style.display = 'none';
    });

    resetBtn.addEventListener('click', function() {
      if (pomoTimer) { clearInterval(pomoTimer); pomoTimer = null; }
      pomoRunning = false;
      pomoTimeLeft = pomoTotalTime;
      startBtn.style.display = '';
      pauseBtn.style.display = 'none';
      updateDisplay();
    });

    document.querySelectorAll('.pomodoro-mode').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (pomoTimer) { clearInterval(pomoTimer); pomoTimer = null; }
        pomoRunning = false;
        startBtn.style.display = '';
        pauseBtn.style.display = 'none';

        document.querySelectorAll('.pomodoro-mode').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');

        pomoMode = btn.getAttribute('data-mode');
        var time = parseInt(btn.getAttribute('data-time'));
        pomoTimeLeft = time * 60;
        pomoTotalTime = time * 60;

        if (pomoMode === 'work') {
          statusEl.textContent = '专注时间';
          timeDisplay.style.color = '#ff6b6b';
        } else {
          statusEl.textContent = '休息时间';
          timeDisplay.style.color = '#00ff00';
        }
        updateDisplay();
      });
    });

    updateDisplay();
    updateStats();
  })();

  setTimeout(function() {
    showNotification('ShadowOS', '欢迎使用 ShadowOS v2.0！试试右键菜单或 Ctrl+K 搜索');
  }, 1500);

})();
