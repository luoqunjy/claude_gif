/**
 * 158 个内置动画预设 — 从 archived/gif-maker 恢复
 *
 * 背景:2026-04-22 commit 9daf109 合并 gif-maker → emoji-studio 时只迁了 15 个动效,
 * 本文件是后续回归修复(commit 6e1ca39 之后),把剩下的 158 个补齐。
 *
 * 数据结构:{ id, name, emoji, cat, keys, fn }
 * fn 是箭头函数(t ∈ [0,1] 进度),返回 Canvas transform: {x,y,scaleX,scaleY,rotation,alpha}
 *
 * 前端实际执行通过 service.js 的 fnToCode() 把 fn.toString() 转成 code 字符串后
 * new Function('t', code) 执行 — 与既有 ANIM_PRESETS(15 个 code 字符串形式)统一范式。
 */

const PI = Math.PI, sin = Math.sin, cos = Math.cos, abs = Math.abs, exp = Math.exp, floor = Math.floor, round = Math.round, pow = Math.pow, max = Math.max, min = Math.min;

// 伪随机(由时间索引决定,保证动画可复现)
const rnd = (i) => { const x = sin(i * 12.9898 + 78.233) * 43758.5453; return x - floor(x); };

export const BUILTIN_EFFECTS = [
  // ─── 渐变 10 ───
  {id:'fade',name:'淡入淡出',emoji:'✨',cat:'渐变',keys:'透明 消失 出现 alpha',fn:t=>({alpha:sin(t*PI)})},
  {id:'fade-in',name:'渐显',emoji:'🌅',cat:'渐变',keys:'淡入 出现',fn:t=>({alpha:t})},
  {id:'fade-out',name:'渐隐',emoji:'🌇',cat:'渐变',keys:'淡出 消失',fn:t=>({alpha:1-t})},
  {id:'blink',name:'闪烁',emoji:'💡',cat:'渐变',keys:'闪 频闪',fn:t=>({alpha:round(sin(t*PI*6)*0.5+0.5)})},
  {id:'breathe',name:'呼吸灯',emoji:'🫧',cat:'渐变',keys:'呼吸 发光 脉冲',fn:t=>{const s=1+sin(t*PI*2)*0.06;return{scaleX:s,scaleY:s,alpha:0.65+sin(t*PI*2)*0.35};}},
  {id:'strobe',name:'频闪',emoji:'⚡',cat:'渐变',keys:'闪烁 快速',fn:t=>({alpha:floor(t*12)%2===0?1:0})},
  {id:'neon-pulse',name:'霓虹脉冲',emoji:'🔆',cat:'渐变',keys:'霓虹 发光',fn:t=>{const p=sin(t*PI*3);return{alpha:0.6+abs(p)*0.4,scaleX:1+p*0.04,scaleY:1+p*0.04};}},
  {id:'ghost-fade',name:'幽灵隐现',emoji:'👻',cat:'渐变',keys:'幽灵 鬼影',fn:t=>({alpha:0.3+sin(t*PI*4)*0.35,y:-sin(t*PI*2)*8})},
  {id:'morse-blink',name:'摩斯闪烁',emoji:'📡',cat:'渐变',keys:'摩斯 密码',fn:t=>{const p=t*12%4;return{alpha:p<1.2||(p>=2&&p<2.3)?1:0};}},
  {id:'soft-glow',name:'柔光脉动',emoji:'🌟',cat:'渐变',keys:'柔和 光晕',fn:t=>{const p=sin(t*PI*2);return{alpha:0.75+p*0.25,scaleX:1+p*0.02,scaleY:1+p*0.02};}},

  // ─── 移动 15 ───
  {id:'float',name:'上下浮动',emoji:'🌊',cat:'移动',keys:'浮 飘',fn:t=>({y:-sin(t*PI*2)*14})},
  {id:'shake-lr',name:'左右摇摆',emoji:'📳',cat:'移动',keys:'抖 晃',fn:t=>({x:sin(t*PI*6)*10})},
  {id:'bounce',name:'弹跳',emoji:'🏀',cat:'移动',keys:'跳 弹',fn:t=>({y:-abs(sin(t*PI*2))*22})},
  {id:'slide-up',name:'向上滑入',emoji:'⬆️',cat:'移动',keys:'进场 滑动',fn:t=>({y:(1-t)*40,alpha:min(t*2.5,1)})},
  {id:'slide-down',name:'向下滑入',emoji:'⬇️',cat:'移动',keys:'进场 滑动',fn:t=>({y:-(1-t)*40,alpha:min(t*2.5,1)})},
  {id:'slide-left',name:'向左滑入',emoji:'⬅️',cat:'移动',keys:'进场 滑动',fn:t=>({x:(1-t)*50,alpha:min(t*2.5,1)})},
  {id:'slide-right',name:'向右滑入',emoji:'➡️',cat:'移动',keys:'进场 滑动',fn:t=>({x:-(1-t)*50,alpha:min(t*2.5,1)})},
  {id:'vibrate',name:'高频抖动',emoji:'📱',cat:'移动',keys:'震动 颤抖',fn:t=>({x:sin(t*PI*22)*5,y:cos(t*PI*19)*3})},
  {id:'drift',name:'漂移',emoji:'🍃',cat:'移动',keys:'飘 漂',fn:t=>({x:sin(t*PI)*20,y:-sin(t*PI*2)*10})},
  {id:'pendulum',name:'钟摆',emoji:'🕰️',cat:'移动',keys:'摆 晃',fn:t=>({rotation:sin(t*PI*2)*22,y:(1-cos(t*PI*2))*4})},
  {id:'gravity-fall',name:'重力落下',emoji:'🎳',cat:'移动',keys:'落下 重力',fn:t=>{const bounce=abs(sin(t*PI*3))*pow(1-t,2);return{y:-bounce*30+(t<0.3?-(0.3-t)*100:0)};}},
  {id:'nod',name:'点头(大幅)',emoji:'🪆',cat:'移动',keys:'点头 yes',fn:t=>({y:sin(t*PI*4)*8,rotation:sin(t*PI*4)*4})},
  {id:'head-bang',name:'摇头',emoji:'🤘',cat:'移动',keys:'摇头 no',fn:t=>({x:sin(t*PI*5)*14,rotation:sin(t*PI*5)*8})},
  {id:'tipsy',name:'醉醺醺',emoji:'🍺',cat:'移动',keys:'醉 摇晃',fn:t=>({x:sin(t*PI*2)*12+sin(t*PI*5)*4,rotation:sin(t*PI*1.5)*10,y:sin(t*PI*3)*3})},
  {id:'electric-jump',name:'电流游走',emoji:'⚡',cat:'移动',keys:'电 跳',fn:t=>{const s=floor(t*15);return{x:(rnd(s)-0.5)*12,y:(rnd(s+99)-0.5)*8};}},

  // ─── 缩放 15 ───
  {id:'pulse',name:'脉冲缩放',emoji:'💓',cat:'缩放',keys:'脉冲 心跳',fn:t=>{const s=1+sin(t*PI*2)*0.14;return{scaleX:s,scaleY:s};}},
  {id:'zoom-in',name:'逐渐放大',emoji:'🔍',cat:'缩放',keys:'放大 进场',fn:t=>{const s=0.55+t*0.45;return{scaleX:s,scaleY:s,alpha:t};}},
  {id:'zoom-out',name:'逐渐缩小',emoji:'🔎',cat:'缩放',keys:'缩小 消失',fn:t=>{const s=1-t*0.45;return{scaleX:s,scaleY:s,alpha:1-t};}},
  {id:'heartbeat',name:'心跳',emoji:'❤️',cat:'缩放',keys:'心 爱心',fn:t=>{const p=t%0.5/0.5;const b=p<0.12?1+p*3:p<0.24?1.36-(p-0.12)*2:p<0.36?1.12+(p-0.24)*2:p<0.48?1.36-(p-0.36)*3:1;return{scaleX:b,scaleY:b};}},
  {id:'pop-big',name:'弹出',emoji:'🎈',cat:'缩放',keys:'弹 进场',fn:t=>{if(t<0.35){const s=(t/0.35)*1.28;return{scaleX:s,scaleY:s,alpha:t/0.35};}if(t<0.55){const s=1.28-(t-0.35)/0.2*0.28;return{scaleX:s,scaleY:s};}return{};}},
  {id:'jello',name:'果冻抖动',emoji:'🟡',cat:'缩放',keys:'果冻 扭',fn:t=>{const d=max(0,1-t*1.8);return{scaleX:1+sin(t*PI*5)*0.28*d,scaleY:1-sin(t*PI*5)*0.18*d};}},
  {id:'rubber',name:'橡皮筋',emoji:'🪀',cat:'缩放',keys:'弹性 拉伸',fn:t=>{const p=t*PI*2;return{scaleX:1+sin(p)*0.2,scaleY:1-sin(p)*0.14};}},
  {id:'squeeze',name:'挤压弹跳',emoji:'🫴',cat:'缩放',keys:'压缩 挤',fn:t=>{const s=sin(t*PI);return{scaleX:1+s*0.35,scaleY:1-s*0.22};}},
  {id:'impact',name:'冲击落地',emoji:'💢',cat:'缩放',keys:'冲击 落地',fn:t=>{if(t<0.2){const s=1+(0.2-t)*3;return{scaleY:s,scaleX:1/(s*0.5+0.5),y:-(0.2-t)*60};}const b=exp(-(t-0.2)*8);return{scaleX:1+b*0.2,scaleY:1-b*0.15};}},
  {id:'stamp',name:'盖章',emoji:'📮',cat:'缩放',keys:'盖章 砸下',fn:t=>{if(t<0.3){return{scaleX:1.8-t*2.5,scaleY:1.8-t*2.5,alpha:t*3};}if(t<0.45){const s=1-sin((t-0.3)/0.15*PI)*0.1;return{scaleX:s,scaleY:s};}return{};}},
  {id:'drip',name:'滴落拉伸',emoji:'💧',cat:'缩放',keys:'滴 拉',fn:t=>{const s=sin(t*PI*2);return{scaleY:1+max(0,s)*0.5,scaleX:1-max(0,s)*0.15,y:max(0,s)*15};}},
  {id:'melt',name:'融化变形',emoji:'🫠',cat:'缩放',keys:'融 化',fn:t=>({scaleY:1+t*0.3,scaleX:1-t*0.1,y:t*12,alpha:1-t*0.2})},
  {id:'implode',name:'向内坍塌',emoji:'🌀',cat:'缩放',keys:'坍塌 消失',fn:t=>{const s=1-pow(t,2);return{scaleX:s,scaleY:s,rotation:t*360,alpha:s};}},
  {id:'explode-scale',name:'向外爆炸',emoji:'💥',cat:'缩放',keys:'爆炸 放大',fn:t=>({scaleX:1+pow(t,2)*3,scaleY:1+pow(t,2)*3,alpha:1-t*t})},
  {id:'spring-bounce',name:'弹簧反弹',emoji:'🪝',cat:'缩放',keys:'弹簧 反弹',fn:t=>{const s=1+sin(t*PI*4)*exp(-t*3)*0.3;return{scaleX:s,scaleY:s};}},

  // ─── 旋转 15 ───
  {id:'rotate-cw',name:'顺时针转',emoji:'🌀',cat:'旋转',keys:'旋转 rotate',fn:t=>({rotation:t*360})},
  {id:'rotate-ccw',name:'逆时针转',emoji:'↩️',cat:'旋转',keys:'旋转 逆',fn:t=>({rotation:-t*360})},
  {id:'rotate-2',name:'双圈旋转',emoji:'💫',cat:'旋转',keys:'旋转 快',fn:t=>({rotation:t*720})},
  {id:'swing-lr',name:'左右晃动',emoji:'🎸',cat:'旋转',keys:'晃 摇',fn:t=>({rotation:sin(t*PI*2)*18})},
  {id:'wobble',name:'摇摆衰减',emoji:'🎯',cat:'旋转',keys:'摇 衰减',fn:t=>{const d=exp(-t*3.5);return{rotation:sin(t*PI*6)*24*d,x:sin(t*PI*6)*8*d};}},
  {id:'spin-fade',name:'旋转消失',emoji:'🌪️',cat:'旋转',keys:'旋转 消失',fn:t=>({rotation:t*540,alpha:1-t,scaleX:1-t*0.4,scaleY:1-t*0.4})},
  {id:'flip-h',name:'水平翻转',emoji:'↔️',cat:'旋转',keys:'翻转 水平',fn:t=>({scaleX:cos(t*PI*2)})},
  {id:'flip-v',name:'垂直翻转',emoji:'↕️',cat:'旋转',keys:'翻转 垂直',fn:t=>({scaleY:cos(t*PI*2)})},
  {id:'spiral-out',name:'螺旋展开',emoji:'🌀',cat:'旋转',keys:'螺旋 进场',fn:t=>{const r=(1-t)*45;const a=(1-t)*PI*4;const s=0.2+t*0.8;return{x:cos(a)*r,y:sin(a)*r,rotation:t*720,scaleX:s,scaleY:s,alpha:t};}},
  {id:'spin-fast',name:'闪速旋转',emoji:'⚡',cat:'旋转',keys:'旋转 闪速',fn:t=>({rotation:t*1440})},
  {id:'clock-tick',name:'时钟滴答',emoji:'🕐',cat:'旋转',keys:'时钟 滴答',fn:t=>({rotation:floor(t*12)*30})},
  {id:'helicopter',name:'直升机螺旋',emoji:'🚁',cat:'旋转',keys:'直升机',fn:t=>({rotation:t*1080,x:sin(t*PI*2)*6,y:cos(t*PI*3)*4})},
  {id:'tilt-chaos',name:'混沌倾斜',emoji:'🌊',cat:'旋转',keys:'混沌 倾斜',fn:t=>({rotation:sin(t*PI*3)*45+sin(t*PI*7)*15,x:sin(t*PI*4)*8})},
  {id:'gyroscope',name:'陀螺仪',emoji:'🌐',cat:'旋转',keys:'陀螺',fn:t=>{const a=t*PI*4;return{rotation:a*180/PI,scaleX:cos(a)*0.6+0.4,scaleY:1};}},
  {id:'pinwheel',name:'风车',emoji:'🎑',cat:'旋转',keys:'风车',fn:t=>{const acc=pow(t,2);return{rotation:acc*720};}},

  // ─── 组合 20 ───
  {id:'tada',name:'Tada！',emoji:'🎉',cat:'组合',keys:'庆祝 tada',fn:t=>({x:sin(t*PI*8)*8,scaleX:1+sin(t*PI)*0.07,scaleY:1+sin(t*PI)*0.07})},
  {id:'bounce-spin',name:'弹跳旋转',emoji:'🎠',cat:'组合',keys:'弹跳 旋转',fn:t=>({y:-abs(sin(t*PI*2))*20,rotation:t*360})},
  {id:'float-spin',name:'浮动旋转',emoji:'🎡',cat:'组合',keys:'浮动 旋转',fn:t=>({y:-sin(t*PI*2)*12,rotation:sin(t*PI*2)*22})},
  {id:'figure8',name:'8字运动',emoji:'♾️',cat:'组合',keys:'8 轨迹',fn:t=>{const a=t*PI*2;return{x:sin(a)*22,y:sin(a*2)*11};}},
  {id:'orbit',name:'轨道环绕',emoji:'🪐',cat:'组合',keys:'轨道 环绕',fn:t=>{const a=t*PI*2;return{x:cos(a)*20,y:sin(a)*11};}},
  {id:'shockwave',name:'冲击波',emoji:'💥',cat:'组合',keys:'冲击 震',fn:t=>{if(t<0.25){const s=1+(t/0.25)*0.45;return{scaleX:s,scaleY:s};}const p=(t-0.25)/0.75;const s=1.45-p*0.45;return{scaleX:s,scaleY:s,alpha:1-p*p};}},
  {id:'ripple',name:'水波纹',emoji:'💧',cat:'组合',keys:'水 波纹',fn:t=>{const s=1+sin(t*PI*3)*0.11;return{scaleX:s,scaleY:1/s,alpha:0.65+sin(t*PI*3)*0.35};}},
  {id:'tiktok',name:'抖音风',emoji:'🎵',cat:'组合',keys:'抖音 节奏',fn:t=>({x:sin(t*PI*10)*4,y:sin(t*PI*13)*3,rotation:sin(t*PI*8)*5})},
  {id:'wave-dance',name:'波浪舞',emoji:'🌈',cat:'组合',keys:'波浪 律动',fn:t=>({x:sin(t*PI*4)*14,y:-sin(t*PI*2)*9,rotation:sin(t*PI*4)*10})},
  {id:'explosive',name:'爆炸弹出 Plus',emoji:'🚀',cat:'组合',keys:'爆炸 进场',fn:t=>{if(t<0.18){const s=t/0.18*1.35;return{scaleX:s,scaleY:s,alpha:t/0.18};}if(t<0.38){const p=(t-0.18)/0.2;return{scaleX:1.35-p*0.35,scaleY:1.35-p*0.35};}return{alpha:1-(t-0.38)/0.62};}},
  {id:'spiral-in',name:'螺旋进场',emoji:'🌪️',cat:'组合',keys:'螺旋 进场',fn:t=>{const r=(1-t)*42;const a=(1-t)*PI*4;const s=0.3+t*0.7;return{x:cos(a)*r,y:sin(a)*r,scaleX:s,scaleY:s,alpha:t};}},
  {id:'pendulum-swing',name:'大钟摆',emoji:'⚖️',cat:'组合',keys:'钟摆',fn:t=>{const angle=sin(t*PI*2)*30;const rad=angle*PI/180;return{x:sin(rad)*18,y:(1-cos(rad))*6,rotation:angle};}},
  {id:'drunk-walk',name:'醉步',emoji:'🍻',cat:'组合',keys:'醉步',fn:t=>({x:sin(t*PI*2.5)*18,rotation:sin(t*PI*2.7)*12,y:sin(t*PI*5.1)*4})},
  {id:'hyper-shake',name:'疯狂抖动 Plus',emoji:'🤪',cat:'组合',keys:'疯狂 抖',fn:t=>{const s=floor(t*30);return{x:(rnd(s)-0.5)*18,y:(rnd(s+11)-0.5)*14,rotation:(rnd(s+22)-0.5)*12};}},
  {id:'dimension-warp',name:'维度扭曲',emoji:'🔮',cat:'组合',keys:'维度 扭曲',fn:t=>{const p=sin(t*PI*2);return{scaleX:1+p*0.5,scaleY:1-p*0.5,rotation:p*8};}},
  {id:'spiral-fall',name:'螺旋坠落',emoji:'🌀',cat:'组合',keys:'螺旋 落',fn:t=>({y:t*30-15,rotation:t*720,scaleX:1-t*0.3,scaleY:1-t*0.3,alpha:1-t*0.5})},
  {id:'tornado',name:'龙卷风',emoji:'🌪️',cat:'组合',keys:'龙卷',fn:t=>({rotation:t*1080,scaleX:1-t*0.4,scaleY:1-t*0.4,x:sin(t*PI*8)*5})},
  {id:'magnetic-pull',name:'磁力吸引',emoji:'🧲',cat:'组合',keys:'磁力',fn:t=>{const p=sin(t*PI);return{x:(p<0.5?sin(t*PI*2)*25:-sin(t*PI*2)*25),scaleX:1+abs(p)*0.1};}},
  {id:'roll-in',name:'滚入场',emoji:'⚽',cat:'组合',keys:'滚 进场',fn:t=>({x:(1-t)*50,rotation:(1-t)*-540,alpha:min(t*2,1)})},
  {id:'flip-bounce',name:'翻转弹跳',emoji:'🤸',cat:'组合',keys:'翻转 弹',fn:t=>({rotation:t*360,y:-abs(sin(t*PI*2))*15,scaleX:cos(t*PI*2)})},

  // ─── 扭曲 10 ───
  {id:'wave-distort',name:'波浪扭曲',emoji:'〰️',cat:'扭曲',keys:'波浪 变形',fn:t=>{const p=t*PI*3;return{scaleX:1+sin(p)*0.25,scaleY:1+cos(p)*0.18};}},
  {id:'glitch',name:'数字故障',emoji:'👾',cat:'扭曲',keys:'glitch 故障',fn:t=>{const s=floor(t*20);const j1=rnd(s),j2=rnd(s+7);return{x:(j1-0.5)*12,y:(j2-0.5)*6,scaleX:1+(j1-0.5)*0.1,alpha:j2>0.95?0.3:1};}},
  {id:'jitter-fine',name:'随机颤抖',emoji:'🫨',cat:'扭曲',keys:'颤抖',fn:t=>{const s=floor(t*50);return{x:(rnd(s)-0.5)*4,y:(rnd(s+1)-0.5)*4};}},
  {id:'rubber-band',name:'弹弓效果',emoji:'🏹',cat:'扭曲',keys:'弹弓 拉',fn:t=>{if(t<0.3){const p=t/0.3;return{scaleX:1+p*0.4,scaleY:1-p*0.2};}const p=(t-0.3)/0.7;const sp=sin(p*PI*3)*exp(-p*3);return{x:-p*40+sp*20,scaleX:1+sp*0.1};}},
  {id:'earthquake',name:'地震效果',emoji:'🌋',cat:'扭曲',keys:'地震',fn:t=>{const s=floor(t*40);return{x:(rnd(s)-0.5)*16,y:(rnd(s+3)-0.5)*10,rotation:(rnd(s+5)-0.5)*8};}},
  {id:'warp-speed',name:'扭曲加速',emoji:'🚀',cat:'扭曲',keys:'加速',fn:t=>{const p=pow(t,3);return{scaleX:1-p*0.4,scaleY:1+p*2.5,alpha:1-p*0.3};}},
  {id:'matrix-glitch',name:'矩阵故障',emoji:'💻',cat:'扭曲',keys:'矩阵',fn:t=>{const s=floor(t*15);return{y:(rnd(s)-0.5)*8,scaleX:1+(rnd(s+2)-0.5)*0.15,alpha:rnd(s+4)>0.9?0.5:1};}},
  {id:'acid-trip',name:'幻觉扭曲',emoji:'🌈',cat:'扭曲',keys:'幻觉',fn:t=>{const p=t*PI*4;return{scaleX:1+sin(p)*0.2,scaleY:1+cos(p*1.3)*0.2,rotation:sin(p*0.7)*8};}},
  {id:'scanner',name:'扫描线',emoji:'📡',cat:'扭曲',keys:'扫描',fn:t=>({alpha:0.4+sin(t*PI*6)*0.3+(sin(t*PI*30)*0.15)})},
  {id:'hologram',name:'全息投影',emoji:'💠',cat:'扭曲',keys:'全息',fn:t=>{const p=floor(t*25);return{alpha:0.7+rnd(p)*0.3,y:(rnd(p+9)-0.5)*3,scaleX:1+(rnd(p+1)-0.5)*0.05};}},

  // ─── 可爱 15 ───
  {id:'cute-bounce',name:'萌系弹跳',emoji:'🐰',cat:'可爱',keys:'萌 弹跳',fn:t=>{const b=abs(sin(t*PI*2));return{y:-b*18,scaleX:1+(1-b)*0.15,scaleY:1-(1-b)*0.1};}},
  {id:'wiggle-butt',name:'扭屁股',emoji:'🐛',cat:'可爱',keys:'扭 摆',fn:t=>({x:sin(t*PI*5)*8,rotation:sin(t*PI*5)*6,scaleX:1+sin(t*PI*5)*0.08})},
  {id:'kawaii-shake',name:'卖萌抖动',emoji:'🌸',cat:'可爱',keys:'萌 卖',fn:t=>({x:sin(t*PI*8)*3,y:cos(t*PI*6)*2,rotation:sin(t*PI*8)*3,scaleX:1+sin(t*PI*4)*0.05,scaleY:1+cos(t*PI*4)*0.05})},
  {id:'nyan',name:'彩虹飞行',emoji:'🌈',cat:'可爱',keys:'彩虹 飞',fn:t=>({x:sin(t*PI*2)*25,y:cos(t*PI*3)*6,rotation:sin(t*PI*4)*8})},
  {id:'disco',name:'迪斯科',emoji:'🕺',cat:'可爱',keys:'迪斯科',fn:t=>{const beat=floor(t*8);return{scaleX:1+(beat%2?0.15:-0.05),scaleY:1+(beat%2?-0.05:0.15),rotation:(beat%4-1.5)*10};}},
  {id:'derp',name:'呆萌',emoji:'😵',cat:'可爱',keys:'呆萌',fn:t=>({x:sin(t*PI*1.3)*6,y:sin(t*PI*1.7)*4,rotation:sin(t*PI*0.9)*5,scaleX:1+sin(t*PI*2.3)*0.04})},
  {id:'hyper-spin',name:'超速旋转',emoji:'🌀',cat:'可爱',keys:'超速',fn:t=>({rotation:t*2160,scaleX:0.9+sin(t*PI*4)*0.1,scaleY:0.9+sin(t*PI*4)*0.1})},
  {id:'crazy-eyes',name:'眼花缭乱',emoji:'😵‍💫',cat:'可爱',keys:'眼花',fn:t=>{const p=t*PI*2;return{x:sin(p*3)*8,y:cos(p*5)*6,scaleX:1+sin(p*7)*0.1,scaleY:1+cos(p*4)*0.1,rotation:sin(p*2)*15};}},
  {id:'yo-yo',name:'溜溜球',emoji:'🪀',cat:'可爱',keys:'溜溜',fn:t=>{const s=0.5+abs(sin(t*PI*2))*0.7;return{scaleX:s,scaleY:s,y:sin(t*PI*4)*10};}},
  {id:'silly-walk',name:'怪走路',emoji:'🚶',cat:'可爱',keys:'怪走',fn:t=>({x:sin(t*PI*2)*15,y:abs(sin(t*PI*4))*-8,rotation:sin(t*PI*2)*8})},
  {id:'jelly-float',name:'水母漂游',emoji:'🪼',cat:'可爱',keys:'水母',fn:t=>{const p=t*PI*2;return{y:-sin(p)*10,scaleX:1+sin(p*2)*0.15,scaleY:1+cos(p*2)*0.15};}},
  {id:'candy-pop',name:'糖果弹出',emoji:'🍬',cat:'可爱',keys:'糖果 弹',fn:t=>{if(t<0.25){const p=t/0.25;return{scaleX:sin(p*PI/2)*1.3,scaleY:sin(p*PI/2)*1.3,rotation:-p*30,alpha:p};}const p=(t-0.25)/0.75;return{scaleX:1.3-p*0.3,scaleY:1.3-p*0.3,rotation:-30+p*30};}},
  {id:'dumb-dumb',name:'傻乎乎',emoji:'😜',cat:'可爱',keys:'傻',fn:t=>({rotation:sin(t*PI*2)*15,y:sin(t*PI*3)*5,scaleX:1+sin(t*PI*2.5)*0.08})},
  {id:'star-burst',name:'星爆',emoji:'⭐',cat:'可爱',keys:'星 爆',fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.25,scaleY:1+p*0.25,rotation:t*360,alpha:0.7+p*0.3};}},
  {id:'ultra-chaos',name:'终极混沌',emoji:'🤯',cat:'可爱',keys:'混沌',fn:t=>{const p=t*PI*2,s=floor(t*20);return{x:sin(p*3)*12+(rnd(s)-0.5)*8,y:cos(p*4)*8+(rnd(s+1)-0.5)*6,rotation:sin(p*2)*30+(rnd(s+2)-0.5)*20,scaleX:1+sin(p*5)*0.15,scaleY:1+cos(p*7)*0.15};}},

  // ─── 表情包专用 30 ───
  {id:'meme-vibe',name:'鬼畜摇头',emoji:'🎶',cat:'表情包',keys:'鬼畜 摇头 meme',fn:t=>({rotation:sin(t*PI*16)*18,y:abs(sin(t*PI*16))*-4,scaleX:1+sin(t*PI*32)*0.05,scaleY:1-sin(t*PI*32)*0.03})},
  {id:'meme-nod-hard',name:'猛烈点头',emoji:'💯',cat:'表情包',keys:'点头 对 是',fn:t=>({y:sin(t*PI*10)*14,rotation:sin(t*PI*10)*6,scaleY:1-abs(sin(t*PI*10))*0.08})},
  {id:'meme-shake-no',name:'坚决摇头',emoji:'🙅',cat:'表情包',keys:'不 no 摇头',fn:t=>({x:sin(t*PI*10)*18,rotation:sin(t*PI*10)*10})},
  {id:'meme-crazy-shake',name:'疯狂抖动 Meme',emoji:'🤪',cat:'表情包',keys:'疯狂 抖 鬼畜',fn:t=>{const s=floor(t*40);return{x:(rnd(s)-0.5)*30,y:(rnd(s+3)-0.5)*20,rotation:(rnd(s+7)-0.5)*40,scaleX:1+(rnd(s+11)-0.5)*0.2,scaleY:1+(rnd(s+13)-0.5)*0.2};}},
  {id:'meme-wtf',name:'黑人问号',emoji:'❓',cat:'表情包',keys:'问号 懵 问',fn:t=>{const p=sin(t*PI*2);return{rotation:p*22,x:p*10,scaleX:1+abs(p)*0.1,scaleY:1+abs(p)*0.1};}},
  {id:'meme-lol',name:'嘎嘎狂笑',emoji:'🤣',cat:'表情包',keys:'笑 哈哈 lol',fn:t=>{const f=t*PI*14;return{scaleX:1+sin(f)*0.14,scaleY:1-sin(f)*0.08,x:sin(f*0.5)*7,rotation:sin(f*0.35)*10};}},
  {id:'meme-faint',name:'笑晕过去',emoji:'😵',cat:'表情包',keys:'晕 笑倒',fn:t=>{const p=t<0.5?t*2:1-(t-0.5)*2;return{rotation:p*80,y:p*16,scaleY:1-p*0.2,scaleX:1+p*0.1};}},
  {id:'meme-zoom-panic',name:'惊慌放大',emoji:'😱',cat:'表情包',keys:'惊 慌 放大',fn:t=>{if(t<0.5){const s=1+pow(t/0.5,2)*1.3;return{scaleX:s,scaleY:s};}const sh=sin((t-0.5)*PI*40)*(1-(t-0.5))*12;return{scaleX:2.3,scaleY:2.3,x:sh,y:cos((t-0.5)*PI*32)*(1-(t-0.5))*8};}},
  {id:'meme-brain-boom',name:'脑子炸了',emoji:'🤯',cat:'表情包',keys:'炸 脑 爆',fn:t=>{if(t<0.3){const s=1+sin(t/0.3*PI*8)*0.12;return{scaleX:s,scaleY:s};}if(t<0.55){const p=(t-0.3)/0.25;const s=1+p*p*3.5;return{scaleX:s,scaleY:s,alpha:1-p*0.6};}return{scaleX:3.5,scaleY:3.5,alpha:0};}},
  {id:'meme-big-energy',name:'big 能量',emoji:'⚡',cat:'表情包',keys:'能量 big',fn:t=>{const pulse=abs(sin(t*PI*6));return{scaleX:1+pulse*0.28,scaleY:1+pulse*0.28,rotation:sin(t*PI*2)*6,x:sin(t*PI*16)*2};}},
  {id:'meme-defeat',name:'emo 躺平',emoji:'😔',cat:'表情包',keys:'躺平 emo 丧',fn:t=>{const p=sin(t*PI);return{y:p*20,rotation:p*12,scaleY:1-p*0.12,alpha:1-p*0.15};}},
  {id:'meme-showoff',name:'自信展示',emoji:'💪',cat:'表情包',keys:'展示 秀 自信',fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.2,scaleY:1+p*0.2,rotation:p*-6,y:-p*4};}},
  {id:'meme-turn-away',name:'哼 转身走',emoji:'😤',cat:'表情包',keys:'转身 哼 生气',fn:t=>{if(t<0.3){return{scaleX:1-(t/0.3)*1.9,rotation:(t/0.3)*35};}if(t<0.55){const p=(t-0.3)/0.25;return{scaleX:-0.9+p*1.9,rotation:35-p*35};}return{};}},
  {id:'meme-pose',name:'帅气定格',emoji:'🕶️',cat:'表情包',keys:'帅 定格 酷',fn:t=>{if(t<0.15){const p=t/0.15;return{x:(1-p)*90,rotation:-(1-p)*60,scaleX:0.4+p*0.6,scaleY:0.4+p*0.6,alpha:p};}if(t<0.28){const sh=sin((t-0.15)*PI*12)*3.5;return{x:sh};}return{};}},
  {id:'meme-hiphop',name:'鬼步律动',emoji:'🕺',cat:'表情包',keys:'鬼步 跳舞 律动',fn:t=>{const bp=(t*8)%1;const beat=floor(t*8);const dir=beat%2?1:-1;return{x:dir*sin(bp*PI)*14,y:-abs(sin(bp*PI*2))*10,rotation:dir*sin(bp*PI)*10};}},
  {id:'meme-panic',name:'慌得一批',emoji:'😵‍💫',cat:'表情包',keys:'慌 急 乱',fn:t=>{const s=floor(t*50);return{x:(rnd(s)-0.5)*28,y:(rnd(s+17)-0.5)*18,rotation:(rnd(s+33)-0.5)*22,scaleX:1+(rnd(s+41)-0.5)*0.15};}},
  {id:'meme-rise',name:'地位上升',emoji:'📈',cat:'表情包',keys:'上升 涨 成功',fn:t=>{const p=t<0.7?t/0.7:1;const s=1+p*0.35;return{y:-p*25,scaleX:s,scaleY:s,rotation:(1-p)*-8};}},
  {id:'meme-fall',name:'跌落谷底',emoji:'📉',cat:'表情包',keys:'跌 下 失败',fn:t=>{const s=1-t*0.35;return{y:t*28,scaleX:s,scaleY:s,alpha:1-t*0.4,rotation:t*35};}},
  {id:'meme-nope',name:'坚决拒绝',emoji:'🚫',cat:'表情包',keys:'拒绝 no 不要',fn:t=>({x:sin(t*PI*10)*20,rotation:sin(t*PI*10)*14})},
  {id:'meme-shy',name:'害羞扭动',emoji:'☺️',cat:'表情包',keys:'害羞 扭 萌',fn:t=>{const p=sin(t*PI*4);return{x:p*9,rotation:p*12,scaleY:1+abs(p)*0.06,scaleX:1-abs(p)*0.04};}},
  {id:'meme-peek',name:'偷偷观察',emoji:'👀',cat:'表情包',keys:'偷看 躲',fn:t=>{const p=t*PI*3;return{x:-60+sin(p)*65,alpha:0.4+abs(sin(p*2))*0.6,rotation:sin(p)*6};}},
  {id:'meme-rollin',name:'笑到打滚',emoji:'🤸',cat:'表情包',keys:'打滚 翻滚',fn:t=>({rotation:t*720,x:sin(t*PI*2)*18,y:-abs(sin(t*PI*4))*10})},
  {id:'meme-hot',name:'这很赞',emoji:'🔥',cat:'表情包',keys:'赞 火 牛',fn:t=>{const s=floor(t*30);const jitter=sin(t*PI*14)*2.5;return{x:jitter+(rnd(s)-0.5)*3,scaleY:1+sin(t*PI*8)*0.1,scaleX:1-sin(t*PI*8)*0.04};}},
  {id:'meme-poof',name:'溜了溜了',emoji:'💨',cat:'表情包',keys:'溜 跑 走',fn:t=>{if(t<0.4)return{};const p=(t-0.4)/0.6;return{x:-p*p*80,rotation:-p*120,scaleX:1-p*0.5,scaleY:1-p*0.5,alpha:1-p};}},
  {id:'meme-boss',name:'霸气登场',emoji:'👑',cat:'表情包',keys:'登场 霸气 出场',fn:t=>{if(t<0.4){const p=t/0.4;const s=pow(p,2)*1.25;return{scaleX:s,scaleY:s,rotation:(1-p)*540,alpha:p};}if(t<0.55){const sh=sin((t-0.4)*PI*20)*5;return{scaleX:1.25,scaleY:1.25,x:sh};}return{scaleX:1.25,scaleY:1.25};}},
  {id:'meme-flex',name:'秀肌肉',emoji:'💪',cat:'表情包',keys:'秀 肌肉 炫',fn:t=>{const p=t%0.5/0.5;if(p<0.25){const b=p/0.25;return{scaleX:1+b*0.35,scaleY:1+b*0.2};}if(p<0.5){return{scaleX:1.35,scaleY:1.2};}const b=(1-p)*2;return{scaleX:1+b*0.35,scaleY:1+b*0.2};}},
  {id:'meme-drop',name:'麦克风砸地',emoji:'🎤',cat:'表情包',keys:'砸 下 mic',fn:t=>{if(t<0.4){return{y:-(0.4-t)*80,rotation:-(0.4-t)*30};}if(t<0.55){const p=(t-0.4)/0.15;return{scaleY:1-sin(p*PI)*0.3,scaleX:1+sin(p*PI)*0.2};}return{};}},
  {id:'meme-slide',name:'滑跪登场',emoji:'🏂',cat:'表情包',keys:'滑 跪 登场',fn:t=>{if(t<0.5){const p=t/0.5;return{x:(1-p)*100,rotation:(1-p)*-15,alpha:p};}if(t<0.65){const sh=sin((t-0.5)*PI*15)*5;return{x:sh,y:sh*0.3};}return{};}},
  {id:'meme-aggressive-zoom',name:'战术放大',emoji:'🔍',cat:'表情包',keys:'战术 放大',fn:t=>{const steps=[1,1.3,1,1.8,1,2.3,1];const i=floor(t*steps.length)%steps.length;const ni=(i+1)%steps.length;const p=(t*steps.length)%1;const s=steps[i]+(steps[ni]-steps[i])*p;return{scaleX:s,scaleY:s};}},
  {id:'meme-whip',name:'鞭打特效',emoji:'🎯',cat:'表情包',keys:'鞭打 快速',fn:t=>{if(t<0.25){const p=t/0.25;return{x:(1-p)*-80,rotation:(1-p)*-45,scaleX:0.5+p*0.5,scaleY:0.5+p*0.5};}if(t<0.45){const p=(t-0.25)/0.2;return{x:sin(p*PI)*15,rotation:sin(p*PI*2)*8};}return{};}},

  // ─── 表情包扩展 M2 · 尺寸变换 10 ───
  {id:'m2-elastic-boom',name:'弹性爆开',emoji:'💥',cat:'表情包',keys:'弹性 爆开 pop',fn:t=>{const p=sin(t*PI);const s=1+p*0.9+sin(t*PI*8)*exp(-t*3)*0.15;return{scaleX:s,scaleY:s};}},
  {id:'m2-wide-stretch',name:'横向拉长',emoji:'🔁',cat:'表情包',keys:'拉长 扁',fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.8,scaleY:1-p*0.2};}},
  {id:'m2-tall-stretch',name:'竖向拔高',emoji:'📏',cat:'表情包',keys:'拔高 细长',fn:t=>{const p=sin(t*PI);return{scaleX:1-p*0.25,scaleY:1+p*0.9};}},
  {id:'m2-balloon',name:'充气鼓胀',emoji:'🎈',cat:'表情包',keys:'气球 鼓',fn:t=>{const p=sin(t*PI);const s=1+p*0.55+sin(t*PI*6)*0.02*p;return{scaleX:s,scaleY:s};}},
  {id:'m2-deflate',name:'漏气瘪掉',emoji:'🎐',cat:'表情包',keys:'漏气 瘪',fn:t=>{const p=sin(t*PI);const s=1-p*0.45;return{scaleX:s+sin(t*PI*12)*0.03*p,scaleY:s-sin(t*PI*12)*0.03*p};}},
  {id:'m2-mega-pulse',name:'极速脉冲',emoji:'💓',cat:'表情包',keys:'脉冲 快 心跳',fn:t=>{const s=1+abs(sin(t*PI*12))*0.3;return{scaleX:s,scaleY:s};}},
  {id:'m2-sudden-big',name:'突然变大',emoji:'🔍',cat:'表情包',keys:'突变 大',fn:t=>{const s=t<0.35?1:t<0.55?1+(t-0.35)/0.2*0.7:t<0.78?1.7:1+(1-t)/0.22*0.7;return{scaleX:s,scaleY:s};}},
  {id:'m2-sudden-small',name:'突然变小',emoji:'🤏',cat:'表情包',keys:'突变 小',fn:t=>{const s=t<0.35?1:t<0.55?1-(t-0.35)/0.2*0.55:t<0.78?0.45:0.45+(t-0.78)/0.22*0.55;return{scaleX:s,scaleY:s};}},
  {id:'m2-counter-pulse',name:'反向脉动',emoji:'⏸️',cat:'表情包',keys:'反向',fn:t=>{const p=sin(t*PI*4);return{scaleX:1+p*0.28,scaleY:1-p*0.28};}},
  {id:'m2-dimension-chaos',name:'维度错乱',emoji:'🌀',cat:'表情包',keys:'维度',fn:t=>{const p=t*PI*3;return{scaleX:1+sin(p)*0.35,scaleY:1+cos(p*1.3)*0.35,rotation:sin(p*0.7)*10};}},

  // ─── M2 · 旋转 10 ───
  {id:'m2-gyro-wobble',name:'陀螺无双',emoji:'💫',cat:'表情包',keys:'陀螺 旋',fn:t=>({rotation:t*720,x:sin(t*PI*8)*6,y:cos(t*PI*9)*4})},
  {id:'m2-barrel-roll',name:'横滚翻腾',emoji:'🎢',cat:'表情包',keys:'横滚',fn:t=>({scaleX:cos(t*PI*2),rotation:sin(t*PI*2)*12})},
  {id:'m2-3d-flip-y',name:'3D 翻卡',emoji:'🔄',cat:'表情包',keys:'3d 翻',fn:t=>{const p=t*PI*2;return{scaleY:cos(p),y:sin(p)*10};}},
  {id:'m2-drill-spin',name:'钻头冲击',emoji:'🔩',cat:'表情包',keys:'钻头',fn:t=>{const s=1+sin(t*PI)*0.3;return{rotation:t*1080,scaleX:s,scaleY:s};}},
  {id:'m2-random-rot',name:'随机角度',emoji:'🎲',cat:'表情包',keys:'随机 角度',fn:t=>{const s=floor(t*10);return{rotation:(rnd(s)-0.5)*90,x:(rnd(s+7)-0.5)*6};}},
  {id:'m2-quick-spin-stop',name:'急转定格',emoji:'⚡',cat:'表情包',keys:'急转',fn:t=>{if(t<0.3)return{rotation:t/0.3*360};if(t<0.5){const sh=sin((t-0.3)*PI*16)*6*(1-(t-0.3)/0.2);return{rotation:360,x:sh};}return{rotation:360};}},
  {id:'m2-spiral-down',name:'螺旋降落',emoji:'🍃',cat:'表情包',keys:'螺旋',fn:t=>({rotation:t*540,y:pow(t,2)*28,scaleX:1-t*0.3,scaleY:1-t*0.3,alpha:1-t*0.3})},
  {id:'m2-eye-roll-y',name:'翻白眼',emoji:'🙄',cat:'表情包',keys:'翻白眼',fn:t=>{const p=t<0.5?t*2:(1-t)*2;return{scaleY:1-p*1.7,y:-p*8};}},
  {id:'m2-full-tornado',name:'天旋地转',emoji:'🌪️',cat:'表情包',keys:'天旋',fn:t=>({rotation:t*1080,x:sin(t*PI*4)*15,y:cos(t*PI*5)*10,scaleX:1-sin(t*PI)*0.25,scaleY:1-sin(t*PI)*0.25})},
  {id:'m2-warp-spin',name:'光速旋转',emoji:'✨',cat:'表情包',keys:'光速 旋',fn:t=>{const r=pow(t,2)*2160;return{rotation:r,scaleX:1-t*0.3,scaleY:1-t*0.3,alpha:1-t*0.4};}},

  // ─── M2 · 移动 10 ───
  {id:'m2-strut-walk',name:'走秀步伐',emoji:'💃',cat:'表情包',keys:'走秀',fn:t=>{const bp=(t*6)%1;const beat=floor(t*6);const dir=beat%2?1:-1;return{x:dir*sin(bp*PI)*14,y:-abs(sin(bp*PI*2))*6,rotation:dir*4};}},
  {id:'m2-step-back',name:'缓缓后退',emoji:'👣',cat:'表情包',keys:'后退',fn:t=>{const p=sin(t*PI);return{x:-p*35,scaleX:1-p*0.08,scaleY:1-p*0.08,alpha:1-p*0.15};}},
  {id:'m2-fast-dash',name:'闪现而过',emoji:'🏃',cat:'表情包',keys:'闪现 快',fn:t=>{if(t<0.1||t>0.9)return{};const p=(t-0.1)/0.8;return{x:-120+p*240};}},
  {id:'m2-heavy-drop',name:'垂直坠落',emoji:'⬇️',cat:'表情包',keys:'坠落 跌',fn:t=>{if(t<0.45){const p=t/0.45;return{y:-(1-p*p)*40};}if(t<0.6){const p=(t-0.45)/0.15;return{scaleY:1-sin(p*PI)*0.25,scaleX:1+sin(p*PI)*0.18};}return{};}},
  {id:'m2-anti-gravity',name:'反重力飘',emoji:'🪂',cat:'表情包',keys:'反重力',fn:t=>{const p=sin(t*PI);return{y:-p*30+sin(t*PI*6)*3,alpha:1-p*0.15};}},
  {id:'m2-zigzag',name:'锯齿穿梭',emoji:'⚡',cat:'表情包',keys:'锯齿 穿梭',fn:t=>{const p=t*PI*6;return{x:sin(p)*18,y:sin(p*2)*8,rotation:sin(p)*6};}},
  {id:'m2-crash-entry',name:'破空而至',emoji:'☄️',cat:'表情包',keys:'破空 入',fn:t=>{if(t<0.22){const p=t/0.22;return{x:-(1-p)*120,y:-(1-p)*60,rotation:(1-p)*-270,scaleX:0.4+p*0.6,scaleY:0.4+p*0.6};}if(t<0.4){const p=(t-0.22)/0.18;const sh=sin(p*PI*10)*5*(1-p);return{x:sh,y:sh*0.4};}return{};}},
  {id:'m2-hover-sway',name:'悬浮摆动',emoji:'🛸',cat:'表情包',keys:'悬浮',fn:t=>({y:sin(t*PI*2)*8+sin(t*PI*6)*2,rotation:sin(t*PI*2)*4})},
  {id:'m2-snake-weave',name:'游走蛇形',emoji:'🐍',cat:'表情包',keys:'蛇形',fn:t=>({x:sin(t*PI*4)*22,rotation:sin(t*PI*4+PI/2)*12})},
  {id:'m2-rocket-launch',name:'冲天起飞',emoji:'🚀',cat:'表情包',keys:'起飞 冲天',fn:t=>{if(t<0.3){const sh=sin(t*PI*30)*3;return{x:sh,scaleY:1+t/0.3*0.12};}const p=(t-0.3)/0.7;return{y:-p*p*80,scaleX:1+p*0.1,scaleY:1+p*0.25,alpha:1-p*0.4};}},

  // ─── M2 · 情绪反应 15 ───
  {id:'m2-omg',name:'OMG 震惊',emoji:'😮',cat:'表情包',keys:'omg 震惊',fn:t=>{if(t<0.3){const s=1+t/0.3*0.85;return{scaleX:s,scaleY:s};}if(t<0.6)return{scaleX:1.85,scaleY:1.85};const sh=sin((t-0.6)*PI*14)*4*(1-(t-0.6)/0.4);return{scaleX:1.85,scaleY:1.85,x:sh};}},
  {id:'m2-dead-inside',name:'心如死灰',emoji:'💀',cat:'表情包',keys:'心死 emo',fn:t=>{const p=sin(t*PI);return{alpha:1-p*0.55,scaleY:1-p*0.12,y:p*6};}},
  {id:'m2-ecstatic',name:'欣喜若狂',emoji:'🤩',cat:'表情包',keys:'狂喜',fn:t=>{const p=t*PI*4;const s=1+abs(sin(p))*0.28;return{scaleX:s,scaleY:s,rotation:sin(p*0.5)*18,y:-abs(sin(p))*8};}},
  {id:'m2-sleepy',name:'困得不行',emoji:'😴',cat:'表情包',keys:'困 累',fn:t=>{const p=sin(t*PI*2);return{rotation:p*10,y:abs(p)*8,scaleY:1-abs(p)*0.1};}},
  {id:'m2-dizzy',name:'头晕目眩',emoji:'😵‍💫',cat:'表情包',keys:'头晕',fn:t=>{const p=t*PI*2;return{x:cos(p*3)*10,y:sin(p*2)*8,rotation:sin(p)*18,scaleX:1+sin(p*4)*0.08,scaleY:1+cos(p*5)*0.08};}},
  {id:'m2-awkward-sway',name:'尴尬扭动',emoji:'😬',cat:'表情包',keys:'尴尬',fn:t=>{const p=sin(t*PI*3);return{x:p*7,rotation:p*-6,scaleX:1+abs(p)*0.05};}},
  {id:'m2-facepalm-hide',name:'捂脸害羞',emoji:'🫣',cat:'表情包',keys:'捂脸 害羞',fn:t=>{if(t<0.2){return{rotation:-t/0.2*22,y:t/0.2*6,scaleY:1-t/0.2*0.05};}if(t<0.78)return{rotation:-22,y:6,scaleY:0.95};const p=(t-0.78)/0.22;return{rotation:-22+p*22,y:6-p*6,scaleY:0.95+p*0.05};}},
  {id:'m2-frozen-shock',name:'定格惊呆',emoji:'🥶',cat:'表情包',keys:'惊呆 定格',fn:t=>{if(t<0.15){const s=1+t/0.15*0.3;return{scaleX:s,scaleY:s};}const sh=(floor(t*50)%2?1:-1)*0.8;return{scaleX:1.3,scaleY:1.3,x:sh,y:sh*0.3};}},
  {id:'m2-aha',name:'恍然大悟',emoji:'💡',cat:'表情包',keys:'悟 懂',fn:t=>{if(t<0.4)return{};if(t<0.55){const p=(t-0.4)/0.15;const s=1+p*0.3;return{scaleX:s,scaleY:s,rotation:p*22};}if(t<0.8)return{scaleX:1.3,scaleY:1.3,rotation:22};const p=(t-0.8)/0.2;return{scaleX:1.3-p*0.3,scaleY:1.3-p*0.3,rotation:22-p*22};}},
  {id:'m2-disappointed',name:'失望透顶',emoji:'😞',cat:'表情包',keys:'失望',fn:t=>{const p=sin(t*PI);return{y:p*14,scaleY:1-p*0.13,alpha:1-p*0.18};}},
  {id:'m2-rising-rage',name:'情绪爆发',emoji:'😡',cat:'表情包',keys:'爆发 怒',fn:t=>{const amp=t*22;const s=floor(t*40);return{x:(rnd(s)-0.5)*amp,y:(rnd(s+7)-0.5)*amp*0.7,rotation:(rnd(s+13)-0.5)*amp*0.6,scaleX:1+t*0.2,scaleY:1+t*0.2};}},
  {id:'m2-furious-roar',name:'狂怒咆哮',emoji:'👹',cat:'表情包',keys:'狂怒 咆哮',fn:t=>{const sh=sin(t*PI*22)*5;const s=1+abs(sin(t*PI*4))*0.22;return{x:sh,y:cos(t*PI*19)*4,rotation:sh*0.5,scaleX:s,scaleY:s};}},
  {id:'m2-smug-tilt',name:'冷笑不屑',emoji:'😏',cat:'表情包',keys:'冷笑 不屑',fn:t=>{const p=sin(t*PI*2);return{rotation:p*16,x:-p*5,scaleX:1+abs(p)*0.06};}},
  {id:'m2-inner-chatter',name:'内心戏多',emoji:'💭',cat:'表情包',keys:'内心',fn:t=>{const s=floor(t*15);return{x:(rnd(s)-0.5)*5,y:(rnd(s+3)-0.5)*3,rotation:(rnd(s+7)-0.5)*5};}},
  {id:'m2-shy-twirl',name:'含羞带怯',emoji:'🥺',cat:'表情包',keys:'含羞',fn:t=>{const p=sin(t*PI*2);return{x:p*5,rotation:p*-8,scaleX:1-abs(p)*0.05,alpha:1-abs(p)*0.1};}},

  // ─── M2 · 动作手势 10 ───
  {id:'m2-deep-bow',name:'深情鞠躬',emoji:'🙇',cat:'表情包',keys:'鞠躬',fn:t=>{if(t<0.3){return{rotation:t/0.3*32,y:t/0.3*10};}if(t<0.7)return{rotation:32,y:10};const p=(t-0.7)/0.3;return{rotation:32-p*32,y:10-p*10};}},
  {id:'m2-worship',name:'膜拜大佬',emoji:'🙏',cat:'表情包',keys:'膜拜',fn:t=>{const p=abs(sin(t*PI*3));return{y:10-p*20,rotation:-p*22};}},
  {id:'m2-hide-peek',name:'躲猫猫',emoji:'🫥',cat:'表情包',keys:'躲',fn:t=>{if(t<0.3){const p=t/0.3;return{scaleX:1-p*0.85,scaleY:1-p*0.85,alpha:1-p*0.9};}if(t<0.55)return{scaleX:0.15,scaleY:0.15,alpha:0.1};const p=(t-0.55)/0.45;return{scaleX:0.15+p*0.85,scaleY:0.15+p*0.85,alpha:0.1+p*0.9};}},
  {id:'m2-blow-kiss',name:'飞吻发射',emoji:'😘',cat:'表情包',keys:'飞吻',fn:t=>{if(t<0.25){return{scaleX:1-t/0.25*0.08,scaleY:1-t/0.25*0.08,rotation:-t/0.25*12};}const p=(t-0.25)/0.75;return{x:p*p*70,y:-p*p*30,rotation:-12+p*22,scaleX:0.92-p*0.3,scaleY:0.92-p*0.3,alpha:1-p};}},
  {id:'m2-wave-bye',name:'挥手拜拜',emoji:'👋',cat:'表情包',keys:'拜拜',fn:t=>{const p=sin(t*PI*6);const fade=t>0.5?1-(t-0.5)*2:1;return{rotation:p*22,x:p*8,alpha:fade};}},
  {id:'m2-bear-hug',name:'大力熊抱',emoji:'🤗',cat:'表情包',keys:'熊抱',fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.45,scaleY:1+p*0.3,rotation:sin(t*PI*4)*3};}},
  {id:'m2-high-knee',name:'高抬腿',emoji:'🏃',cat:'表情包',keys:'抬腿',fn:t=>{const p=abs(sin(t*PI*4));return{y:-p*16,rotation:sin(t*PI*4)*8,scaleY:1-p*0.06};}},
  {id:'m2-flying-kick',name:'飞踹一脚',emoji:'🦵',cat:'表情包',keys:'踹',fn:t=>{if(t<0.2){return{x:-(1-t/0.2)*60,rotation:(1-t/0.2)*-30};}if(t<0.4){const p=(t-0.2)/0.2;return{x:p*40,rotation:p*48};}if(t<0.65)return{x:40,rotation:48};const p=(t-0.65)/0.35;return{x:40-p*40,rotation:48-p*48};}},
  {id:'m2-shrug',name:'摊手耸肩',emoji:'🤷',cat:'表情包',keys:'摊手',fn:t=>{const p=sin(t*PI);return{scaleX:1+p*0.32,rotation:p*-5,y:-p*3};}},
  {id:'m2-kneel-down',name:'跪下投降',emoji:'🧎',cat:'表情包',keys:'跪',fn:t=>{if(t<0.3){return{y:t/0.3*18,scaleY:1-t/0.3*0.17,rotation:(t/0.3)*-9};}if(t<0.7)return{y:18,scaleY:0.83,rotation:-9};const p=(t-0.7)/0.3;return{y:18-p*18,scaleY:0.83+p*0.17,rotation:-9+p*9};}},

  // ─── M2 · 物理/故障 10 ───
  {id:'m2-elastic-land',name:'弹性落地',emoji:'🎾',cat:'表情包',keys:'落地 弹',fn:t=>{if(t<0.3){return{y:-(0.3-t)/0.3*45};}const p=(t-0.3)/0.7;const bounce=abs(sin(p*PI*3))*exp(-p*3);return{y:-bounce*22,scaleY:1-bounce*0.18,scaleX:1+bounce*0.12};}},
  {id:'m2-rubberband',name:'橡皮筋拉',emoji:'🏹',cat:'表情包',keys:'橡皮筋 拉',fn:t=>{if(t<0.4){const p=t/0.4;return{x:-p*45,scaleX:1+p*0.3,scaleY:1-p*0.15};}const p=(t-0.4)/0.6;const sp=sin(p*PI*4)*exp(-p*3);return{x:-45+p*90+sp*22,scaleX:1.3-p*0.3+sp*0.1};}},
  {id:'m2-tornado-suck',name:'漩涡吸入',emoji:'🌪️',cat:'表情包',keys:'漩涡 吸',fn:t=>{const r=t*PI*4;const rad=(1-t)*35;return{x:cos(r)*rad,y:sin(r)*rad,rotation:t*720,scaleX:1-t*0.45,scaleY:1-t*0.45,alpha:1-t*0.3};}},
  {id:'m2-pingpong',name:'乒乓往返',emoji:'🏓',cat:'表情包',keys:'乒乓',fn:t=>{const p=t*PI*4;return{x:sin(p)*28,rotation:sin(p+PI/2)*15};}},
  {id:'m2-quantum-jump',name:'量子跳跃',emoji:'⚛️',cat:'表情包',keys:'量子',fn:t=>{const s=floor(t*8);return{x:(rnd(s)-0.5)*35,y:(rnd(s+11)-0.5)*22,alpha:floor(t*40)%2?1:0.35};}},
  {id:'m2-after-image',name:'多重残影',emoji:'👥',cat:'表情包',keys:'残影',fn:t=>{const p=t*PI*6;return{x:sin(p)*22,alpha:0.65+sin(p)*0.35};}},
  {id:'m2-heavy-glitch',name:'严重故障',emoji:'📺',cat:'表情包',keys:'故障 glitch',fn:t=>{const s=floor(t*25);return{x:(rnd(s)-0.5)*22,y:(rnd(s+5)-0.5)*8,scaleX:1+(rnd(s+11)-0.5)*0.3,alpha:rnd(s+17)>0.85?0.3:1};}},
  {id:'m2-flash-in',name:'闪光登场',emoji:'⚡',cat:'表情包',keys:'闪光',fn:t=>{if(t<0.15){return{alpha:floor(t*30)%2?1:0.2,scaleX:0.4+t/0.15*0.6,scaleY:0.4+t/0.15*0.6};}if(t<0.3){const p=(t-0.15)/0.15;const s=1+sin(p*PI*6)*0.12;return{scaleX:s,scaleY:s};}return{};}},
  {id:'m2-dual-ghost',name:'重影分离',emoji:'👻',cat:'表情包',keys:'重影',fn:t=>({x:sin(t*PI*8)*13,alpha:0.7+sin(t*PI*16)*0.3})},
  {id:'m2-hyper-freq',name:'超频振动',emoji:'⚡',cat:'表情包',keys:'超频',fn:t=>({x:sin(t*PI*40)*3.5,y:cos(t*PI*43)*3,scaleX:1+sin(t*PI*40)*0.025})},

  // ─── M2 · 史诗炫酷 5 ───
  {id:'m2-slow-mo',name:'慢镜回放',emoji:'🎬',cat:'表情包',keys:'慢镜 慢动作',fn:t=>{const ease=1-pow(1-t,3);const p=sin(ease*PI);return{x:p*15,scaleX:1+p*0.15,scaleY:1+p*0.15,rotation:p*6};}},
  {id:'m2-hyper-dash',name:'光速冲刺',emoji:'💨',cat:'表情包',keys:'光速',fn:t=>{const cycle=(t*2)%1;if(cycle<0.05)return{x:-80,alpha:0};if(cycle<0.1){const p=(cycle-0.05)/0.05;return{x:-80+p*160,alpha:p};}if(cycle<0.3)return{x:80,alpha:1};if(cycle<0.35){const p=(cycle-0.3)/0.05;return{x:80-p*80,alpha:1};}return{};}},
  {id:'m2-epic-entry',name:'史诗登场',emoji:'🎭',cat:'表情包',keys:'史诗 登场',fn:t=>{if(t<0.3){const p=t/0.3;return{x:(1-p)*150,rotation:(1-p)*360,scaleX:2-p,scaleY:2-p,alpha:p};}if(t<0.5){const p=(t-0.3)/0.2;const sh=sin(p*PI*10)*8*(1-p);return{x:sh,y:sh*0.5,scaleX:1+(1-p)*0.2,scaleY:1+(1-p)*0.2};}return{};}},
  {id:'m2-legendary-aura',name:'传说威压',emoji:'👑',cat:'表情包',keys:'传说',fn:t=>{const s=1.08+sin(t*PI*2)*0.07;const p=sin(t*PI*2);return{scaleX:s,scaleY:s,alpha:0.75+abs(p)*0.25,y:p*-2};}},
  {id:'m2-boss-battle',name:'Boss 战',emoji:'🐲',cat:'表情包',keys:'boss',fn:t=>{const sh=sin(t*PI*12)*3;const s=1+abs(sin(t*PI*2))*0.18;return{x:sh,y:cos(t*PI*12)*2,rotation:sh*0.3,scaleX:s,scaleY:s};}}
];

export const CATEGORIES = ['全部','⭐收藏','表情包','渐变','移动','缩放','旋转','组合','扭曲','可爱','自定义'];

/**
 * 把一个基于 PI/sin/cos/rnd 等闭包变量的箭头函数
 * 转成可以独立执行的 code 字符串(前端 new Function('t', code)).
 *
 * 策略:给 code 前面加 Math 别名 preamble + rnd 辅助,这样 body 内部的 sin/cos/PI/rnd 都能解析。
 */
export function fnToCode(fn) {
  const src = fn.toString();
  const m = src.match(/^\s*t\s*=>\s*([\s\S]*)$/);
  if (!m) return '';
  const body = m[1].trim();

  const preamble =
    "const PI=Math.PI,sin=Math.sin,cos=Math.cos,abs=Math.abs,exp=Math.exp,floor=Math.floor,round=Math.round,pow=Math.pow,max=Math.max,min=Math.min;" +
    "const rnd=(i)=>{const x=Math.sin(i*12.9898+78.233)*43758.5453;return x-Math.floor(x);};";

  // 形式 1: t => ({ expr })  —— body 以 "(" 开头,是表达式
  if (body.startsWith('(')) {
    return preamble + "return " + body.replace(/;?\s*$/, '') + ";";
  }
  // 形式 2: t => { stmts; return ...; } —— body 以 "{" 开头,去掉最外层花括号
  if (body.startsWith('{')) {
    return preamble + body.slice(1, -1);
  }
  // 形式 3: t => expr(罕见)
  return preamble + "return " + body + ";";
}
