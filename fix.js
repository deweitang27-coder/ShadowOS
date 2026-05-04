const fs = require('fs');
let content = fs.readFileSync('d:\\trae\\demo\\app.js', 'utf8');
content = content.replace(
  /(\{ name: '系统监控', icon: '📊', desc: 'CPU\/内存\/网络实时监控', action: openSysMonitor \})/,
  "$1,\n    { name: '代码编辑器', icon: '💻', desc: '支持语法高亮的代码编辑器', action: openCodeEditor }"
);
fs.writeFileSync('d:\\trae\\demo\\app.js', content, 'utf8');
console.log('Done');
