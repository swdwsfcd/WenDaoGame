/**
 * 问道风格MMORPG游戏服务器
 * 使用JSON文件数据库，无需编译
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ============ JSON数据库 ============
const DB_FILE = './wendao.json';

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initDB = {
            players: [
                { id: 'demo1', username: '勇者Demo', password: '123', sect: '火',
                  level: 10, exp: 500, hp: 300, maxHp: 300, mp: 150, maxMp: 150,
                  atk: 35, def: 20, spd: 25, matk: 40,
                  gold: 5000, silver: 20000, yuanbao: 500,
                  x: 100, y: 100, map: 'newbie', createTime: new Date().toISOString(), lastLogin: new Date().toISOString() }
            ],
            pets: [
                { id: 'pet_demo1', playerId: 'demo1', name: '火麒麟', type: '火', level: 8, exp: 200, hp: 180, atk: 45, def: 30, spd: 35, skill: '烈焰冲击', isBattle: 1 }
            ],
            equipment: [
                { id: 'eq_demo1', playerId: 'demo1', type: 'weapon', name: '铁剑', atkBonus: 10, defBonus: 0, hpBonus: 0, spdBonus: 0, matkBonus: 0, level: 1, enhanceLevel: 0 }
            ],
            inventory: [
                { id: 'inv_demo1', playerId: 'demo1', itemId: 'potion', itemName: '治疗药水', quantity: 5, type: 'consumable' }
            ],
            friends: [],
            guilds: [],
            guild_members: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initDB, null, 2));
        return initDB;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let DB = loadDB();

// 数据库操作函数
function dbGet(table, query) {
    return DB[table].find(row => {
        return Object.entries(query).every(([k, v]) => row[k] === v);
    }) || null;
}

function dbAll(table, query) {
    return DB[table].filter(row => {
        return Object.entries(query).every(([k, v]) => row[k] === v);
    });
}

function dbInsert(table, data) {
    DB[table].push(data);
    saveDB(DB);
}

function dbUpdate(table, query, updates) {
    const idx = DB[table].findIndex(row => {
        return Object.entries(query).every(([k, v]) => row[k] === v);
    });
    if (idx !== -1) {
        DB[table][idx] = { ...DB[table][idx], ...updates };
        saveDB(DB);
        return DB[table][idx];
    }
    return null;
}

function dbDelete(table, query) {
    const idx = DB[table].findIndex(row => {
        return Object.entries(query).every(([k, v]) => row[k] === v);
    });
    if (idx !== -1) {
        DB[table].splice(idx, 1);
        saveDB(DB);
    }
}

console.log('✅ JSON数据库加载成功，玩家数:', DB.players.length);

// ============ 游戏数据定义 ============
const GAME_DATA = {
    sects: {
        '金': { name: '金系', color: '#FFD700', desc: '物理攻击强，防御高', baseStats: { atk: 15, def: 8, hp: 120, spd: 6, matk: 5 } },
        '木': { name: '木系', color: '#00FF00', desc: '擅长治疗和辅助', baseStats: { atk: 8, def: 6, hp: 100, spd: 7, matk: 12 } },
        '水': { name: '水系', color: '#00BFFF', desc: '控制技能强，速度最快', baseStats: { atk: 7, def: 5, hp: 90, spd: 12, matk: 10 } },
        '火': { name: '火系', color: '#FF4500', desc: '法术攻击强，爆发高', baseStats: { atk: 6, def: 4, hp: 85, spd: 10, matk: 18 } },
        '土': { name: '土系', color: '#8B4513', desc: '血厚防高，擅长坦克', baseStats: { atk: 10, def: 12, hp: 150, spd: 5, matk: 6 } }
    },
    skills: {
        '金': [
            { id: 'jin1', name: '金光斩', type: 'physical', dmg: 1.5, mp: 10, desc: '发出金色光芒斩击敌人' },
            { id: 'jin2', name: '铁壁防御', type: 'buff', effect: 'def_up', value: 0.5, mp: 15, desc: '提升自身防御50%' },
            { id: 'jin3', name: '万剑归宗', type: 'physical', dmg: 2.5, mp: 30, desc: '召唤万剑攻击全体敌人', aoe: true }
        ],
        '木': [
            { id: 'mu1', name: '生命之泉', type: 'heal', value: 0.3, mp: 12, desc: '恢复30%生命值' },
            { id: 'mu2', name: '藤蔓缠绕', type: 'debuff', effect: 'spd_down', value: 0.3, mp: 10, desc: '降低敌人速度30%' },
            { id: 'mu3', name: '自然之恩', type: 'heal', value: 0.5, mp: 25, desc: '恢复全队50%生命值', aoe: true }
        ],
        '水': [
            { id: 'shui1', name: '冰封术', type: 'debuff', effect: 'freeze', value: 1, mp: 15, desc: '冻结敌人一回合' },
            { id: 'shui2', name: '水龙卷', type: 'magic', dmg: 1.8, mp: 18, desc: '召唤水龙卷攻击' },
            { id: 'shui3', name: '寒冰领域', type: 'magic', dmg: 2.0, mp: 28, desc: '冰封全场敌人', aoe: true }
        ],
        '火': [
            { id: 'huo1', name: '烈火术', type: 'magic', dmg: 1.6, mp: 12, desc: '发射火球攻击' },
            { id: 'huo2', name: '灼烧', type: 'debuff', effect: 'burn', value: 0.1, mp: 10, desc: '灼烧敌人，每回合掉血10%' },
            { id: 'huo3', name: '地狱烈焰', type: 'magic', dmg: 2.2, mp: 35, desc: '召唤地狱火焰攻击全体', aoe: true }
        ],
        '土': [
            { id: 'tu1', name: '岩石冲击', type: 'physical', dmg: 1.4, mp: 10, desc: '召唤岩石冲击敌人' },
            { id: 'tu2', name: '大地守护', type: 'buff', effect: 'hp_up', value: 0.3, mp: 20, desc: '提升最大生命值30%' },
            { id: 'tu3', name: '陨石坠落', type: 'physical', dmg: 2.8, mp: 40, desc: '召唤陨石攻击单体', single: true }
        ]
    },
    pets: [
        { id: 'pet1', name: '小精灵', type: '木', baseHp: 80, baseAtk: 12, baseDef: 8, baseSpd: 10, skill: '生命祝福' },
        { id: 'pet2', name: '火麒麟', type: '火', baseHp: 90, baseAtk: 18, baseDef: 6, baseSpd: 12, skill: '烈焰冲击' },
        { id: 'pet3', name: '水晶龟', type: '水', baseHp: 120, baseAtk: 8, baseDef: 15, baseSpd: 5, skill: '水之护盾' },
        { id: 'pet4', name: '金角虫', type: '金', baseHp: 70, baseAtk: 20, baseDef: 10, baseSpd: 8, skill: '金属穿刺' },
        { id: 'pet5', name: '石巨人', type: '土', baseHp: 150, baseAtk: 15, baseDef: 20, baseSpd: 3, skill: '岩石皮肤' },
        { id: 'pet6', name: '九尾狐', type: '火', baseHp: 100, baseAtk: 22, baseDef: 8, baseSpd: 15, skill: '魅惑之术' }
    ]
};

// 在线玩家
const onlinePlayers = new Map();

// ============ WebSocket处理 ============
wss.on('connection', (ws) => {
    console.log('🎮 新玩家连接');
    let currentPlayer = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (err) {
            console.error('消息解析错误:', err);
        }
    });

    ws.on('close', () => {
        if (currentPlayer) {
            onlinePlayers.delete(currentPlayer.id);
            broadcast({ type: 'player_leave', playerId: currentPlayer.id, onlineCount: onlinePlayers.size });
            console.log(`👋 玩家离开: ${currentPlayer.username}`);
        }
    });

    function handleMessage(ws, data) {
        switch (data.type) {
            case 'register':
                handleRegister(ws, data);
                break;
            case 'login':
                handleLogin(ws, data);
                break;
            case 'create_character':
                handleCreateCharacter(ws, data);
                break;
            case 'get_game_data':
                handleGetGameData(ws, data);
                break;
            case 'battle_action':
                handleBattleAction(ws, data);
                break;
            case 'catch_pet':
                handleCatchPet(ws, data);
                break;
            case 'move':
                handleMove(ws, data);
                break;
            case 'chat':
                handleChat(ws, data);
                break;
            default:
                ws.send(JSON.stringify({ type: 'error', message: '未知操作: ' + data.type }));
        }
    }

    function handleRegister(ws, data) {
        const { username, password } = data;
        const exist = dbGet('players', { username });
        if (exist) {
            ws.send(JSON.stringify({ type: 'register_fail', message: '用户名已存在' }));
        } else {
            const id = uuidv4();
            dbInsert('players', {
                id, username, password,
                sect: null, level: 1, exp: 0,
                hp: 100, maxHp: 100, mp: 50, maxMp: 50,
                atk: 10, def: 5, spd: 8, matk: 10,
                gold: 1000, silver: 5000, yuanbao: 100,
                x: 100, y: 100, map: 'newbie',
                createTime: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            });
            ws.send(JSON.stringify({ type: 'register_success', message: '注册成功，请登录' }));
            console.log(`✅ 新用户注册: ${username}`);
        }
    }

    function handleLogin(ws, data) {
        const { username, password } = data;
        const player = dbGet('players', { username, password });
        if (player) {
            currentPlayer = player;
            onlinePlayers.set(player.id, { ws, data: player });
            dbUpdate('players', { id: player.id }, { lastLogin: new Date().toISOString() });
            ws.send(JSON.stringify({
                type: 'login_success',
                player,
                skills: GAME_DATA.skills[player.sect] || [],
                onlineCount: onlinePlayers.size
            }));
            broadcast({ type: 'player_join', player, onlineCount: onlinePlayers.size }, ws);
            console.log(`✅ 玩家登录: ${username}, 在线: ${onlinePlayers.size}`);
        } else {
            ws.send(JSON.stringify({ type: 'login_fail', message: '用户名或密码错误' }));
        }
    }

    function handleCreateCharacter(ws, data) {
        const { playerId, sect } = data;
        if (!GAME_DATA.sects[sect]) {
            ws.send(JSON.stringify({ type: 'create_fail', message: '无效门派' }));
            return;
        }
        const baseStats = GAME_DATA.sects[sect].baseStats;
        const player = dbUpdate('players', { id: playerId }, {
            sect,
            hp: baseStats.hp, maxHp: baseStats.hp,
            mp: Math.floor(baseStats.hp * 0.5), maxMp: Math.floor(baseStats.hp * 0.5),
            atk: baseStats.atk, def: baseStats.def,
            spd: baseStats.spd, matk: baseStats.matk
        });
        if (player) {
            currentPlayer = player;
            ws.send(JSON.stringify({
                type: 'create_success',
                player,
                skills: GAME_DATA.skills[sect]
            }));
            console.log(`✅ 角色创建: ${player.username}, 门派: ${sect}`);
        } else {
            ws.send(JSON.stringify({ type: 'create_fail', message: '创建角色失败' }));
        }
    }

    function handleGetGameData(ws, data) {
        const { playerId } = data;
        const pets = dbAll('pets', { playerId });
        const equipment = dbAll('equipment', { playerId });
        const inventory = dbAll('inventory', { playerId });
        ws.send(JSON.stringify({
            type: 'game_data',
            pets,
            equipment,
            inventory,
            gameData: GAME_DATA
        }));
    }

    function handleBattleAction(ws, data) {
        const { playerId } = data;
        const expGain = Math.floor(Math.random() * 20) + 5;
        const goldGain = Math.floor(Math.random() * 50) + 10;
        dbUpdate('players', { id: playerId }, {
            exp: (dbGet('players', { id: playerId }) || {}).exp + expGain,
            gold: (dbGet('players', { id: playerId }) || {}).gold + goldGain
        });
        ws.send(JSON.stringify({
            type: 'battle_result',
            expGain,
            goldGain
        }));
    }

    function handleCatchPet(ws, data) {
        const { playerId, petType } = data;
        const petTemplate = GAME_DATA.pets.find(p => p.type === petType) || GAME_DATA.pets[0];
        const petId = uuidv4();
        dbInsert('pets', {
            id: petId,
            playerId,
            name: petTemplate.name,
            type: petTemplate.type,
            level: 1,
            exp: 0,
            hp: petTemplate.baseHp,
            atk: petTemplate.baseAtk,
            def: petTemplate.baseDef,
            spd: petTemplate.baseSpd,
            skill: petTemplate.skill,
            isBattle: 0
        });
        ws.send(JSON.stringify({
            type: 'catch_success',
            pet: { id: petId, ...petTemplate, level: 1 }
        }));
        console.log(`🐾 玩家 ${playerId} 捕捉了宠物: ${petTemplate.name}`);
    }

    function handleMove(ws, data) {
        const { playerId, x, y, map } = data;
        if (currentPlayer && currentPlayer.id === playerId) {
            dbUpdate('players', { id: playerId }, { x, y, map });
            broadcast({
                type: 'player_move',
                playerId,
                x,
                y,
                map
            }, ws);
        }
    }

    function handleChat(ws, data) {
        const { playerId, message: msg, channel } = data;
        const playerName = currentPlayer ? currentPlayer.username : '未知';
        broadcast({
            type: 'chat_message',
            playerId,
            playerName,
            message: msg,
            channel: channel || 'world'
        });
    }

    function broadcast(data, excludeWs = null) {
        const message = JSON.stringify(data);
        onlinePlayers.forEach((player) => {
            if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(message);
            }
        });
    }
});

// ============ REST API ============
app.get('/api/leaderboard', (req, res) => {
    const sorted = [...DB.players].sort((a, b) => b.level - a.level || b.exp - a.exp).slice(0, 50);
    res.json({ leaderboard: sorted.map(p => ({ username: p.username, sect: p.sect, level: p.level, exp: p.exp })) });
});

app.get('/api/market', (req, res) => {
    const marketItems = [
        { id: '1', name: '龙泉剑', type: 'weapon', price: 1000, seller: '系统' },
        { id: '2', name: '玄武甲', type: 'armor', price: 800, seller: '系统' },
        { id: '3', name: '速度之靴', type: 'shoes', price: 500, seller: '系统' },
        { id: '4', name: '火系宠物蛋', type: 'pet_egg', price: 2000, seller: '系统' },
        { id: '5', name: '强化石', type: 'material', price: 100, seller: '系统' }
    ];
    res.json({ items: marketItems });
});

app.get('/api/online', (req, res) => {
    res.json({ count: onlinePlayers.size, players: [...onlinePlayers.values()].map(p => p.data.username) });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('🎮 问道MMORPG服务器启动成功！');
    console.log(`📡 WebSocket: ws://localhost:${PORT}`);
    console.log(`🌐 游戏客户端: http://localhost:${PORT}`);
    console.log(`🔧 后台管理: http://localhost:${PORT}/admin.html`);
    console.log('='.repeat(50));
});
