const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// ── Database ──────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'oracle.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT UNIQUE NOT NULL,
    display   TEXT NOT NULL,
    team      TEXT DEFAULT '',
    password  TEXT NOT NULL DEFAULT '000000',
    points    INTEGER DEFAULT 1000,
    is_admin  INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS matches (
    id        TEXT PRIMARY KEY,
    label     TEXT NOT NULL,
    team1     TEXT,
    team2     TEXT,
    bo        INTEGER DEFAULT 3,
    result    TEXT,
    score     TEXT,
    locked    INTEGER DEFAULT 0,
    stage     TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS predictions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    match_id  TEXT NOT NULL,
    pick      TEXT NOT NULL,
    amount    INTEGER NOT NULL DEFAULT 100,
    payout    INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    settled   INTEGER DEFAULT 0,
    won       INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (match_id) REFERENCES matches(id),
    UNIQUE(user_id, match_id)
  );
  CREATE TABLE IF NOT EXISTS record_predictions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    category  TEXT NOT NULL,
    team_name TEXT NOT NULL,
    amount    INTEGER NOT NULL DEFAULT 0,
    payout    INTEGER DEFAULT 0,
    settled   INTEGER DEFAULT 0,
    won       INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, category, team_name)
  );
  CREATE TABLE IF NOT EXISTS checkins (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    day       TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, day)
  );
  CREATE TABLE IF NOT EXISTS markets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    match_label TEXT DEFAULT '',
    locked     INTEGER DEFAULT 0,
    result_option_id INTEGER,
    reward     INTEGER DEFAULT 100,
    settled    INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS market_options (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id  INTEGER NOT NULL,
    label      TEXT NOT NULL,
    FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS bets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    market_id  INTEGER NOT NULL,
    option_id  INTEGER NOT NULL,
    amount     INTEGER NOT NULL DEFAULT 0,
    payout     INTEGER DEFAULT 0,
    settled    INTEGER DEFAULT 0,
    won        INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (market_id) REFERENCES markets(id),
    FOREIGN KEY (option_id) REFERENCES market_options(id),
    UNIQUE(user_id, market_id)
  );
  CREATE TABLE IF NOT EXISTS coin_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    delta      INTEGER NOT NULL,
    balance    INTEGER NOT NULL,
    reason     TEXT NOT NULL,
    detail     TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  INSERT OR IGNORE INTO settings (key, value) VALUES ('lock_3-0', '0');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('lock_3-1', '0');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('lock_3-2', '0');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('lock_0-3', '0');
`);

// ── Seed data ─────────────────────────────────────────────
const PLAYERS = [
  ['lucazheng','郑宇','你看的懂吗'],['aaronzzhao','赵宇涵','带头冲锋'],['alenjiang','蒋佳志','明牌四保一'],
  ['ambitionli','李思鹏','数值溢出'],['aphelioyan','严云天','数值溢出'],['ashinliu','刘培俊','紧急需求'],
  ['azhong','钟文迪','冷静稳健运营'],['baoqili','李宝琪','灵宝真好养'],['beichenxiu','修北辰','教练带的兵'],
  ['bugyang','杨蔚庆','灵宝真好养'],['butiyawu','吴亭瑶','签运爆表'],['chadliang','梁辰','卷起来好吗'],
  ['chancetan','谭章斌','守感来了'],['daizhang','张岱','通天岱丶何龙王'],['davylong','龙柯宇','通天岱丶何龙王'],
  ['dongfu','付启煜','数值溢出'],['doonewang','王旭东','教练带的兵'],['drankjhuang','黄俊','温+宝'],
  ['drawnryang','杨程博','你看的懂吗'],['dubhehe','何博文','通天岱丶何龙王'],['ergoumao','毛于升','带头冲锋'],
  ['foxistjia','贾宇新','明牌四保一'],['georgeqiao','乔榛','男模团'],['granderyuan','苑韬','紧急需求'],
  ['hakusu','苏宇','明牌四保一'],['halleyli','李浩','好想打五排'],['haoyzhu','朱羽豪','冷静稳健运营'],
  ['hexyang','杨栋','卷起来好吗'],['huihelin','林辉河','教练带的兵'],['jadenzhang','张晋','你看的懂吗'],
  ['jaryjyzhang','张嘉予','男模团'],['jasonjsliu','刘景晟','男模团'],['jasonjywang','王稼钰','通天岱丶何龙王'],
  ['jayzhe','贺江舟','守感来了'],['jestemzeng','曾沛源','灵宝真好养'],['jingqizhou','周靖奇','教练带的兵'],
  ['jjlinzhang','张益帆','紧急需求'],['johnsmzhang','张斯铭','教练带的兵'],['jtzhou','周金滔','紧急需求'],
  ['junguiyang','杨润泽','男模团'],['keqincao','曹克勤','数值溢出'],['kiiliu','刘应池','冷静稳健运营'],
  ['kiritozhao','赵左臣','守感来了'],['kumaguo','郭琦','你看的懂吗'],['leftgao','高世豪','男模团'],
  ['loneding','丁亮','带头冲锋'],['lostsong','宋天磊','通天岱丶何龙王'],['louissli','李石','卷起来好吗'],
  ['lulujlzhang','张嘉璐','带头冲锋'],['mahaoma','马浩','带头冲锋'],['maqiannanwu','吴马倩男','卷起来好吗'],
  ['pawnwang','王鹏森','冷静稳健运营'],['pengxwen','温鹏祥','温+宝'],['peterxiang','向牧','幕后黑手'],
  ['pokemonchen','陈磊','温+宝'],['racoonpang','庞汉雄','守感来了'],['redtong','童颜','紧急需求'],
  ['richgao','高磊','签运爆表'],['riderzhou','周萌','数值溢出'],['seleneyu','于筱薇','幕后黑手'],
  ['sephyzhang','张书嘉','好想打五排'],['shaunsun','孙少文','温+宝'],['spuryu','于智鑫','好想打五排'],
  ['stewartli','李仁杰','幕后黑手'],['tianbaizuo','左天白','签运爆表'],['timmyyu','俞承驰','幕后黑手'],
  ['townesyan','晏晨熙','守感来了'],['toxicwang','王强','明牌四保一'],['v_cjwicchen','陈均伟','好想打五排'],
  ['v_tatazhuo','卓慧玲','灵宝真好养'],['varusdeng','邓淦','温+宝'],['waynedli','李丁','你看的懂吗'],
  ['willmao','毛竹','幕后黑手'],['xlongqin','秦祥龙','卷起来好吗'],['yibohao','郝奕博','灵宝真好养'],
  ['yjunhe','何怡君','明牌四保一'],['yokelluo','罗凯','签运爆表'],['yuchenhe','何昱辰','签运爆表'],
  ['yuhualiu','刘宇骅','冷静稳健运营'],['zenithwang','王铭宇','好想打五排'],
];

const MATCHES_SEED = [
  ['W1','胜者组R1','S1','S8',3,'group'],
  ['W2','胜者组R1','S4','S5',3,'group'],
  ['W3','胜者组R1','S2','S7',3,'group'],
  ['W4','胜者组R1','S3','S6',3,'group'],
  ['W5','胜者组半决赛','W1w','W2w',3,'winners'],
  ['W6','胜者组半决赛','W3w','W4w',3,'winners'],
  ['W7','胜者组决赛','W5w','W6w',3,'winners'],
  ['L1','败者组R1','W1l','W2l',3,'losers'],
  ['L2','败者组R1','W3l','W4l',3,'losers'],
  ['L3','败者组R2','L1w','W6l',3,'losers'],
  ['L4','败者组R2','L2w','W5l',3,'losers'],
  ['L5','败者组半决赛','L3w','L4w',3,'losers'],
  ['L6','败者组决赛','L5w','W7l',3,'losers'],
  ['GF','总决赛','W7w','L6w',5,'final'],
];

const SWISS_MATCHES = [
  // R1: 0-0 (8 BO3)
  ['SR1_1','R1 · 0-0','','',3,'swiss_r1'],
  ['SR1_2','R1 · 0-0','','',3,'swiss_r1'],
  ['SR1_3','R1 · 0-0','','',3,'swiss_r1'],
  ['SR1_4','R1 · 0-0','','',3,'swiss_r1'],
  ['SR1_5','R1 · 0-0','','',3,'swiss_r1'],
  ['SR1_6','R1 · 0-0','','',3,'swiss_r1'],
  ['SR1_7','R1 · 0-0','','',3,'swiss_r1'],
  ['SR1_8','R1 · 0-0','','',3,'swiss_r1'],
  // R2: 1-0 (4 BO3)
  ['SR2_10_1','R2 · 1-0','','',3,'swiss_r2'],
  ['SR2_10_2','R2 · 1-0','','',3,'swiss_r2'],
  ['SR2_10_3','R2 · 1-0','','',3,'swiss_r2'],
  ['SR2_10_4','R2 · 1-0','','',3,'swiss_r2'],
  // R2: 0-1 (4 BO3)
  ['SR2_01_1','R2 · 0-1','','',3,'swiss_r2'],
  ['SR2_01_2','R2 · 0-1','','',3,'swiss_r2'],
  ['SR2_01_3','R2 · 0-1','','',3,'swiss_r2'],
  ['SR2_01_4','R2 · 0-1','','',3,'swiss_r2'],
  // R3: 2-0 (2 BO3) -> winners = 1st/2nd
  ['SR3_20_1','R3 · 2-0','','',3,'swiss_r3'],
  ['SR3_20_2','R3 · 2-0','','',3,'swiss_r3'],
  // R3: 1-1 (4 BO3)
  ['SR3_11_1','R3 · 1-1','','',3,'swiss_r3'],
  ['SR3_11_2','R3 · 1-1','','',3,'swiss_r3'],
  ['SR3_11_3','R3 · 1-1','','',3,'swiss_r3'],
  ['SR3_11_4','R3 · 1-1','','',3,'swiss_r3'],
  // R3: 0-2 (2 BO3) -> losers eliminated
  ['SR3_02_1','R3 · 0-2','','',3,'swiss_r3'],
  ['SR3_02_2','R3 · 0-2','','',3,'swiss_r3'],
  // R4: 2-1 (4 BO3) -> winners = 3rd/4th/5th
  ['SR4_21_1','R4 · 2-1','','',3,'swiss_r4'],
  ['SR4_21_2','R4 · 2-1','','',3,'swiss_r4'],
  ['SR4_21_3','R4 · 2-1','','',3,'swiss_r4'],
  ['SR4_21_4','R4 · 2-1','','',3,'swiss_r4'],
  // R4: 1-2 (4 BO3) -> losers eliminated
  ['SR4_12_1','R4 · 1-2','','',3,'swiss_r4'],
  ['SR4_12_2','R4 · 1-2','','',3,'swiss_r4'],
  ['SR4_12_3','R4 · 1-2','','',3,'swiss_r4'],
  ['SR4_12_4','R4 · 1-2','','',3,'swiss_r4'],
  // R5: 2-2 (3 BO3) -> winners = 6th/7th/8th
  ['SR5_22_1','R5 · 2-2','','',3,'swiss_r5'],
  ['SR5_22_2','R5 · 2-2','','',3,'swiss_r5'],
  ['SR5_22_3','R5 · 2-2','','',3,'swiss_r5'],
];

function seedDB() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO users (username, display, team, password, is_admin) VALUES (?,?,?,?,?)');
    const tx = db.transaction(() => {
      // admin account
      insert.run('admin', '管理员', '', 'admin123', 1);
      for (const [uname, dname, team] of PLAYERS) {
        insert.run(uname, dname, team, '000000', 0);
      }
    });
    tx();
    console.log(`Seeded ${PLAYERS.length} players + 1 admin`);
  }

  const matchCount = db.prepare('SELECT COUNT(*) as c FROM matches').get().c;
  if (matchCount === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO matches (id, label, team1, team2, bo, stage) VALUES (?,?,?,?,?,?)');
    const tx = db.transaction(() => {
      for (const m of MATCHES_SEED) insert.run(...m);
      for (const m of SWISS_MATCHES) insert.run(m[0], m[1], m[2], m[3], parseInt(m[4]), m[5]);
    });
    tx();
    console.log(`Seeded ${MATCHES_SEED.length + SWISS_MATCHES.length} matches`);
  }
}
seedDB();

// ── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'honor-of-kings-quiz-2026-stella',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 3600 * 1000 }
}));

function logCoins(userId, delta, reason, detail) {
  db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(delta, userId);
  const bal = db.prepare('SELECT points FROM users WHERE id = ?').get(userId).points;
  db.prepare('INSERT INTO coin_logs (user_id, delta, balance, reason, detail) VALUES (?,?,?,?,?)').run(userId, delta, bal, reason, detail || '');
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: '请先登录' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(403).json({ error: '需要管理员权限' });
  next();
}
function isCategoryLocked(cat) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get('lock_' + cat);
  return row && row.value === '1';
}
function getLockStatus() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'lock_%'").all();
  const locks = {};
  for (const r of rows) locks[r.key.replace('lock_', '')] = r.value === '1';
  return locks;
}

// ── Auth API ──────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入账号和密码' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (!user) return res.status(401).json({ error: '账号不存在' });
  if (user.password !== password) return res.status(401).json({ error: '密码错误' });

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.display = user.display;
  req.session.isAdmin = !!user.is_admin;

  res.json({ ok: true, user: { id: user.id, username: user.username, display: user.display, team: user.team, points: user.points, is_admin: !!user.is_admin } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, display, team, points, is_admin FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: '用户不存在' });
  res.json({ user: { ...user, is_admin: !!user.is_admin } });
});

// ── Checkin API ───────────────────────────────────────────
app.get('/api/checkin', requireAuth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const done = db.prepare('SELECT id FROM checkins WHERE user_id = ? AND day = ?').get(req.session.userId, today);
  const total = db.prepare('SELECT COUNT(*) as c FROM checkins WHERE user_id = ?').get(req.session.userId).c;
  res.json({ checkedIn: !!done, today, totalDays: total });
});

app.post('/api/checkin', requireAuth, (req, res) => {
  if (req.session.isAdmin) return res.status(403).json({ error: '管理员不可签到' });
  const today = new Date().toISOString().slice(0, 10);
  const existing = db.prepare('SELECT id FROM checkins WHERE user_id = ? AND day = ?').get(req.session.userId, today);
  if (existing) return res.status(400).json({ error: '今天已经签过到了' });

  db.prepare('INSERT INTO checkins (user_id, day) VALUES (?, ?)').run(req.session.userId, today);
  logCoins(req.session.userId, 100, '签到');
  const total = db.prepare('SELECT COUNT(*) as c FROM checkins WHERE user_id = ?').get(req.session.userId).c;
  res.json({ ok: true, totalDays: total });
});

// ── Predictions API ───────────────────────────────────────
app.get('/api/predictions', requireAuth, (req, res) => {
  const preds = db.prepare('SELECT match_id, pick, amount, payout, settled, won FROM predictions WHERE user_id = ?').all(req.session.userId);
  const recordPreds = db.prepare('SELECT category, team_name, amount, payout, settled, won FROM record_predictions WHERE user_id = ?').all(req.session.userId);
  res.json({ predictions: preds, recordPredictions: recordPreds });
});

app.post('/api/predict', requireAuth, (req, res) => {
  if (req.session.isAdmin) return res.status(403).json({ error: '管理员不可预测' });
  const { match_id, pick, amount, action } = req.body;
  if (!match_id) return res.status(400).json({ error: '参数缺失' });

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: '比赛不存在' });
  if (match.locked) return res.status(400).json({ error: '该场比赛已封盘' });
  if (match.result) return res.status(400).json({ error: '该场比赛已有结果' });

  const existing = db.prepare('SELECT * FROM predictions WHERE user_id = ? AND match_id = ?').get(req.session.userId, match_id);

  if (action === 'cancel') {
    if (!existing) return res.status(400).json({ error: '没有预测记录' });
    const tx = db.transaction(() => {
      logCoins(req.session.userId, existing.amount, '撤回预测', match_id);
      db.prepare('DELETE FROM predictions WHERE id = ?').run(existing.id);
    });
    tx();
    return res.json({ ok: true });
  }

  if (!pick) return res.status(400).json({ error: '请选择预测队伍' });
  const betAmount = Math.floor(Number(amount));
  if (!betAmount || betAmount <= 0) return res.status(400).json({ error: '请输入下注金额' });

  const user = db.prepare('SELECT points FROM users WHERE id = ?').get(req.session.userId);
  const available = user.points + (existing ? existing.amount : 0);
  if (betAmount > available) return res.status(400).json({ error: `竞彩币不足（可用 ${available}）` });

  const tx = db.transaction(() => {
    if (existing) {
      logCoins(req.session.userId, existing.amount, '退回旧注', match_id);
    }
    logCoins(req.session.userId, -betAmount, '比赛下注', `${match_id} → ${pick}`);
    db.prepare(`INSERT INTO predictions (user_id, match_id, pick, amount) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, match_id) DO UPDATE SET pick = excluded.pick, amount = excluded.amount, created_at = datetime('now','localtime')`)
      .run(req.session.userId, match_id, pick, betAmount);
  });
  tx();

  res.json({ ok: true });
});

app.post('/api/predict-record', requireAuth, (req, res) => {
  if (req.session.isAdmin) return res.status(403).json({ error: '管理员不可预测' });
  const { category, teams, amount, action } = req.body;
  const validCats = ['3-0','3-1','3-2','0-3'];
  const catLimits = {'3-0':2, '3-1':3, '3-2':3, '0-3':2};
  if (!category || !validCats.includes(category)) return res.status(400).json({ error: '参数缺失或分类无效' });
  if (!req.session.isAdmin && isCategoryLocked(category)) return res.status(403).json({ error: `${category} 已封盘，暂不可操作` });

  if (action === 'remove') {
    const oldRows = db.prepare('SELECT * FROM record_predictions WHERE user_id = ? AND category = ?').all(req.session.userId, category);
    const oldAmount = oldRows.length > 0 ? oldRows[0].amount : 0;
    const tx = db.transaction(() => {
      if (oldAmount > 0) logCoins(req.session.userId, oldAmount, '撤回8强预测', category);
      db.prepare('DELETE FROM record_predictions WHERE user_id = ? AND category = ?').run(req.session.userId, category);
    });
    tx();
    return res.json({ ok: true });
  }

  if (!teams || !Array.isArray(teams)) return res.status(400).json({ error: '请选择队伍' });
  const required = catLimits[category] || 2;
  if (teams.length !== required) return res.status(400).json({ error: `${category} 必须选择 ${required} 支队伍` });

  const betAmount = Math.floor(Number(amount));
  if (!betAmount || betAmount <= 0) return res.status(400).json({ error: '请输入下注金额' });

  const oldRows = db.prepare('SELECT * FROM record_predictions WHERE user_id = ? AND category = ?').all(req.session.userId, category);
  const oldAmount = oldRows.length > 0 ? oldRows[0].amount : 0;

  const user = db.prepare('SELECT points FROM users WHERE id = ?').get(req.session.userId);
  const available = user.points + oldAmount;
  if (betAmount > available) return res.status(400).json({ error: `竞彩币不足（可用 ${available}）` });

  const tx = db.transaction(() => {
    if (oldAmount > 0) logCoins(req.session.userId, oldAmount, '退回旧注', `8强${category}`);
    db.prepare('DELETE FROM record_predictions WHERE user_id = ? AND category = ?').run(req.session.userId, category);
    logCoins(req.session.userId, -betAmount, '8强下注', `${category} → ${teams.join(',')}`);
    const ins = db.prepare('INSERT INTO record_predictions (user_id, category, team_name, amount) VALUES (?, ?, ?, ?)');
    for (const t of teams) ins.run(req.session.userId, category, t, betAmount);
  });
  tx();
  res.json({ ok: true });
});

// ── Matches API ───────────────────────────────────────────
app.get('/api/matches', (req, res) => {
  const matches = db.prepare('SELECT * FROM matches').all();
  const betStats = db.prepare(`
    SELECT match_id, pick, COUNT(*) as cnt, COALESCE(SUM(amount),0) as total
    FROM predictions GROUP BY match_id, pick
  `).all();
  const statsMap = {};
  for (const s of betStats) {
    if (!statsMap[s.match_id]) statsMap[s.match_id] = {};
    statsMap[s.match_id][s.pick] = { cnt: s.cnt, total: s.total };
  }
  const result = matches.map(m => ({ ...m, betStats: statsMap[m.id] || {} }));
  res.json({ matches: result });
});

// ── Undo helpers ─────────────────────────────────────────
function undoMatchResult(matchId) {
  const preds = db.prepare('SELECT * FROM predictions WHERE match_id = ? AND settled = 1').all(matchId);
  const tx = db.transaction(() => {
    for (const p of preds) {
      if (p.won && p.payout > 0) {
        logCoins(p.user_id, -p.payout, '撤销结算-扣回', matchId);
      }
      if (!p.won) {
        logCoins(p.user_id, p.amount, '撤销结算-退回', matchId);
      }
    }
    db.prepare('UPDATE predictions SET settled = 0, won = 0, payout = 0 WHERE match_id = ? AND settled = 1').run(matchId);
    db.prepare("UPDATE matches SET result = NULL, score = '', locked = 1 WHERE id = ?").run(matchId);
  });
  tx();
  return preds.length;
}

function undoSettleMarket(marketId) {
  const bets = db.prepare('SELECT * FROM bets WHERE market_id = ? AND settled = 1').all(marketId);
  const tx = db.transaction(() => {
    for (const b of bets) {
      if (b.won && b.payout > 0) {
        logCoins(b.user_id, -b.payout, '撤销盘口-扣回', `盘口${marketId}`);
      }
      if (!b.won) {
        logCoins(b.user_id, b.amount, '撤销盘口-退回', `盘口${marketId}`);
      }
    }
    db.prepare('UPDATE bets SET settled = 0, won = 0, payout = 0 WHERE market_id = ? AND settled = 1').run(marketId);
    db.prepare('UPDATE markets SET settled = 0, result_option_id = NULL, locked = 1 WHERE id = ?').run(marketId);
  });
  tx();
  return bets.length;
}

// ── Admin: set result / lock ──────────────────────────────
app.post('/api/admin/match-result', requireAuth, requireAdmin, (req, res) => {
  const { match_id, result, score } = req.body;
  if (!match_id || !result) return res.status(400).json({ error: '参数缺失' });

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: '比赛不存在' });
  if (!match.team1 || !match.team2) return res.status(400).json({ error: '该场比赛还没有设置队伍' });
  if (result !== match.team1 && result !== match.team2) return res.status(400).json({ error: `胜方必须是 ${match.team1} 或 ${match.team2}` });

  if (match.result) {
    undoMatchResult(match_id);
  }

  db.prepare('UPDATE matches SET result = ?, score = ?, locked = 1 WHERE id = ?')
    .run(result, score || '', match_id);

  const preds = db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(match_id);
  const pool = preds.reduce((s, p) => s + p.amount, 0);
  const winners = preds.filter(p => p.pick === result);
  const winnerTotal = winners.reduce((s, p) => s + p.amount, 0);

  const updatePred = db.prepare('UPDATE predictions SET settled = 1, won = ?, payout = ? WHERE id = ?');

  const tx = db.transaction(() => {
    for (const p of preds) {
      const isWinner = p.pick === result;
      if (isWinner && winnerTotal > 0) {
        const payout = Math.floor(pool * p.amount / winnerTotal);
        updatePred.run(1, payout, p.id);
        logCoins(p.user_id, payout, '比赛命中', `${match_id} +${payout}`);
      } else {
        updatePred.run(0, 0, p.id);
      }
    }
  });
  tx();

  res.json({ ok: true, settled: preds.length, pool, winners: winners.length });
});

app.post('/api/admin/lock-match', requireAuth, requireAdmin, (req, res) => {
  const { match_id, locked } = req.body;
  db.prepare('UPDATE matches SET locked = ? WHERE id = ?').run(locked ? 1 : 0, match_id);
  res.json({ ok: true });
});

app.post('/api/admin/undo-match-result', requireAuth, requireAdmin, (req, res) => {
  const { match_id } = req.body;
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: '比赛不存在' });
  if (!match.result) return res.status(400).json({ error: '该场比赛没有结果可撤销' });
  const count = undoMatchResult(match_id);
  res.json({ ok: true, undone: count });
});

app.post('/api/admin/settle-records', requireAuth, requireAdmin, (req, res) => {
  const { category, teams } = req.body;
  const validCats = ['3-0','3-1','3-2','0-3'];
  if (!category || !teams || !validCats.includes(category)) return res.status(400).json({ error: '参数缺失' });

  const preds = db.prepare('SELECT * FROM record_predictions WHERE category = ? AND settled = 0').all(category);

  const userBets = {};
  for (const p of preds) {
    if (!userBets[p.user_id]) userBets[p.user_id] = { amount: p.amount, teams: [], rows: [] };
    userBets[p.user_id].teams.push(p.team_name);
    userBets[p.user_id].rows.push(p);
  }

  const pool = Object.values(userBets).reduce((s, u) => s + u.amount, 0);
  const winnerUsers = {};
  for (const [uid, u] of Object.entries(userBets)) {
    if (u.teams.every(t => teams.includes(t))) winnerUsers[uid] = u;
  }
  const winnerTotal = Object.values(winnerUsers).reduce((s, u) => s + u.amount, 0);

  const updatePred = db.prepare('UPDATE record_predictions SET settled = 1, won = ?, payout = ? WHERE id = ?');

  let settledCount = 0;
  const tx = db.transaction(() => {
    for (const [uid, u] of Object.entries(userBets)) {
      const isWinner = !!winnerUsers[uid];
      const payout = (isWinner && winnerTotal > 0) ? Math.floor(pool * u.amount / winnerTotal) : 0;
      for (const row of u.rows) {
        const rowWon = teams.includes(row.team_name) ? 1 : 0;
        updatePred.run(rowWon, isWinner ? payout : 0, row.id);
        settledCount++;
      }
      if (isWinner && payout > 0) logCoins(parseInt(uid), payout, '8强命中', `${category} +${payout}`);
    }
  });
  tx();

  res.json({ ok: true, settled: settledCount, pool, winners: Object.keys(winnerUsers).length });
});

app.get('/api/record-stats', (req, res) => {
  const stats = db.prepare(`
    SELECT category, team_name, COUNT(*) as picks, COALESCE(SUM(amount),0) as total_amount
    FROM record_predictions GROUP BY category, team_name
    ORDER BY category, total_amount DESC
  `).all();
  const poolByCat = db.prepare(`
    SELECT category, COALESCE(SUM(amount),0) as pool FROM (
      SELECT category, user_id, MAX(amount) as amount FROM record_predictions GROUP BY category, user_id
    ) GROUP BY category
  `).all();
  const pools = {};
  for (const p of poolByCat) pools[p.category] = p.pool;
  res.json({ stats, pools });
});

// ── Markets (custom betting) API ──────────────────────────
app.get('/api/markets', (req, res) => {
  const markets = db.prepare('SELECT * FROM markets ORDER BY id DESC').all();
  const options = db.prepare('SELECT * FROM market_options ORDER BY id').all();
  const betStats = db.prepare(`
    SELECT option_id, COUNT(*) as cnt, COALESCE(SUM(amount),0) as total_amount FROM bets GROUP BY option_id
  `).all();
  const statMap = {};
  for (const s of betStats) statMap[s.option_id] = { cnt: s.cnt, total: s.total_amount };

  const result = markets.map(m => {
    const mOpts = options.filter(o => o.market_id === m.id);
    const pool = mOpts.reduce((s, o) => s + (statMap[o.id]?.total || 0), 0);
    return {
      ...m,
      pool,
      options: mOpts.map(o => {
        const st = statMap[o.id] || { cnt: 0, total: 0 };
        const odds = st.total > 0 ? +(pool / st.total).toFixed(2) : 0;
        return { ...o, votes: st.cnt, total_amount: st.total, odds };
      })
    };
  });
  res.json({ markets: result });
});

app.get('/api/my-bets', requireAuth, (req, res) => {
  const bets = db.prepare('SELECT market_id, option_id, amount, payout, settled, won FROM bets WHERE user_id = ?').all(req.session.userId);
  res.json({ bets });
});

app.post('/api/bet', requireAuth, (req, res) => {
  if (req.session.isAdmin) return res.status(403).json({ error: '管理员不可下注' });
  const { market_id, option_id, amount } = req.body;
  if (!market_id || !option_id || !amount) return res.status(400).json({ error: '参数缺失' });
  const betAmount = Math.floor(Number(amount));
  if (betAmount <= 0) return res.status(400).json({ error: '下注金额必须大于 0' });

  const market = db.prepare('SELECT * FROM markets WHERE id = ?').get(market_id);
  if (!market) return res.status(404).json({ error: '盘口不存在' });
  if (market.locked) return res.status(400).json({ error: '该盘口已封盘' });
  if (market.settled) return res.status(400).json({ error: '该盘口已结算' });

  const option = db.prepare('SELECT * FROM market_options WHERE id = ? AND market_id = ?').get(option_id, market_id);
  if (!option) return res.status(400).json({ error: '选项不存在' });

  const user = db.prepare('SELECT points FROM users WHERE id = ?').get(req.session.userId);
  const existing = db.prepare('SELECT * FROM bets WHERE user_id = ? AND market_id = ?').get(req.session.userId, market_id);

  let available = user.points;
  if (existing) available += existing.amount;
  if (betAmount > available) return res.status(400).json({ error: `竞彩币不足（可用 ${available}）` });

  const tx = db.transaction(() => {
    if (existing) {
      logCoins(req.session.userId, existing.amount, '退回旧注', `盘口${market_id}`);
    }
    logCoins(req.session.userId, -betAmount, '盘口下注', `盘口${market_id}`);
    db.prepare(`INSERT INTO bets (user_id, market_id, option_id, amount) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, market_id) DO UPDATE SET option_id = excluded.option_id, amount = excluded.amount, created_at = datetime('now','localtime')`)
      .run(req.session.userId, market_id, option_id, betAmount);
  });
  tx();

  res.json({ ok: true });
});

// ── Admin: market management ─────────────────────────────
app.post('/api/admin/create-market', requireAuth, requireAdmin, (req, res) => {
  const { title, match_label, options } = req.body;
  if (!title || !options || !options.length) return res.status(400).json({ error: '请填写标题和选项' });

  const r = db.prepare('INSERT INTO markets (title, match_label) VALUES (?, ?)').run(title, match_label || '');
  const marketId = r.lastInsertRowid;
  const insertOpt = db.prepare('INSERT INTO market_options (market_id, label) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const label of options) {
      if (label.trim()) insertOpt.run(marketId, label.trim());
    }
  });
  tx();

  res.json({ ok: true, market_id: marketId });
});

app.post('/api/admin/lock-market', requireAuth, requireAdmin, (req, res) => {
  const { market_id, locked } = req.body;
  db.prepare('UPDATE markets SET locked = ? WHERE id = ?').run(locked ? 1 : 0, market_id);
  res.json({ ok: true });
});

app.post('/api/admin/settle-market', requireAuth, requireAdmin, (req, res) => {
  const { market_id, option_id } = req.body;
  if (!market_id || !option_id) return res.status(400).json({ error: '参数缺失' });

  const market = db.prepare('SELECT * FROM markets WHERE id = ?').get(market_id);
  if (!market) return res.status(404).json({ error: '盘口不存在' });
  if (market.settled) return res.status(400).json({ error: '该盘口已结算' });

  const betsAll = db.prepare('SELECT * FROM bets WHERE market_id = ?').all(market_id);
  const pool = betsAll.reduce((s, b) => s + b.amount, 0);
  const winners = betsAll.filter(b => b.option_id === option_id);
  const winnerTotal = winners.reduce((s, b) => s + b.amount, 0);

  const updateBet = db.prepare('UPDATE bets SET settled = 1, won = ?, payout = ? WHERE id = ?');

  let settledCount = 0;
  const tx = db.transaction(() => {
    db.prepare('UPDATE markets SET result_option_id = ?, settled = 1, locked = 1 WHERE id = ?').run(option_id, market_id);

    for (const b of betsAll) {
      const isWinner = b.option_id === option_id;
      if (isWinner && winnerTotal > 0) {
        const payout = Math.floor(pool * b.amount / winnerTotal);
        updateBet.run(1, payout, b.id);
        logCoins(b.user_id, payout, '盘口命中', `盘口${market_id} +${payout}`);
      } else {
        updateBet.run(0, 0, b.id);
      }
      settledCount++;
    }

  });
  tx();

  res.json({ ok: true, settled: settledCount, pool, winnerTotal, winners: winners.length });
});

app.post('/api/admin/undo-settle-market', requireAuth, requireAdmin, (req, res) => {
  const { market_id } = req.body;
  const market = db.prepare('SELECT * FROM markets WHERE id = ?').get(market_id);
  if (!market) return res.status(404).json({ error: '盘口不存在' });
  if (!market.settled) return res.status(400).json({ error: '该盘口未结算，无需撤销' });
  const count = undoSettleMarket(market_id);
  res.json({ ok: true, undone: count });
});

app.post('/api/admin/delete-market', requireAuth, requireAdmin, (req, res) => {
  const { market_id } = req.body;
  const market = db.prepare('SELECT * FROM markets WHERE id = ?').get(market_id);
  if (!market) return res.status(404).json({ error: '盘口不存在' });
  if (market.settled) return res.status(400).json({ error: '已结算的盘口不可删除' });

  const betsAll = db.prepare('SELECT * FROM bets WHERE market_id = ?').all(market_id);

  const tx = db.transaction(() => {
    for (const b of betsAll) {
      if (b.amount > 0) logCoins(b.user_id, b.amount, '盘口删除退回', `盘口${market_id}`);
    }
    db.prepare('DELETE FROM bets WHERE market_id = ?').run(market_id);
    db.prepare('DELETE FROM market_options WHERE market_id = ?').run(market_id);
    db.prepare('DELETE FROM markets WHERE id = ?').run(market_id);
  });
  tx();

  res.json({ ok: true, refunded: betsAll.length });
});

// ── Admin: data overview ──────────────────────────────────
app.get('/api/admin/overview', requireAuth, requireAdmin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin = 0').get().c;
  const totalPredictions = db.prepare('SELECT COUNT(*) as c FROM predictions').get().c;
  const totalRecordPreds = db.prepare('SELECT COUNT(*) as c FROM record_predictions').get().c;
  const totalBets = db.prepare('SELECT COUNT(*) as c FROM bets').get().c;
  const totalMarkets = db.prepare('SELECT COUNT(*) as c FROM markets').get().c;
  const participatedUsers = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as c FROM (
      SELECT user_id FROM predictions UNION ALL SELECT user_id FROM record_predictions UNION ALL SELECT user_id FROM bets
    )
  `).get().c;
  const settledMatches = db.prepare("SELECT COUNT(*) as c FROM matches WHERE result IS NOT NULL AND result != ''").get().c;
  const totalMatches = db.prepare('SELECT COUNT(*) as c FROM matches').get().c;

  res.json({ totalUsers, totalPredictions, totalRecordPreds, totalBets, totalMarkets, participatedUsers, settledMatches, totalMatches });
});

app.get('/api/admin/all-predictions', requireAuth, requireAdmin, (req, res) => {
  const matchPreds = db.prepare(`
    SELECT u.display, u.team, p.match_id, p.pick, p.amount, p.payout, p.settled, p.won, p.created_at
    FROM predictions p JOIN users u ON u.id = p.user_id
    ORDER BY p.match_id, u.display
  `).all();

  const recordPreds = db.prepare(`
    SELECT u.display, u.team, r.category, r.team_name, r.amount, r.payout, r.settled, r.won
    FROM record_predictions r JOIN users u ON u.id = r.user_id
    ORDER BY r.category, u.display
  `).all();

  const userSummary = db.prepare(`
    SELECT u.id, u.username, u.display, u.team, u.points,
      (SELECT COUNT(*) FROM predictions WHERE user_id = u.id) as match_preds,
      (SELECT COUNT(*) FROM record_predictions WHERE user_id = u.id) as record_preds,
      (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND settled = 1 AND won = 1) +
      (SELECT COUNT(*) FROM record_predictions WHERE user_id = u.id AND settled = 1 AND won = 1) as hits,
      (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND settled = 1) +
      (SELECT COUNT(*) FROM record_predictions WHERE user_id = u.id AND settled = 1) as settled
    FROM users u WHERE u.is_admin = 0
    ORDER BY u.points DESC
  `).all();

  const notParticipated = db.prepare(`
    SELECT u.username, u.display, u.team FROM users u
    WHERE u.is_admin = 0
      AND u.id NOT IN (SELECT DISTINCT user_id FROM predictions)
      AND u.id NOT IN (SELECT DISTINCT user_id FROM record_predictions)
      AND u.id NOT IN (SELECT DISTINCT user_id FROM bets)
  `).all();

  res.json({ matchPreds, recordPreds, userSummary, notParticipated });
});

// ── Leaderboard API ───────────────────────────────────────
app.get('/api/leaderboard', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.display, u.team, u.points,
      (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND settled = 1 AND won = 1) +
      (SELECT COUNT(*) FROM record_predictions WHERE user_id = u.id AND settled = 1 AND won = 1) +
      (SELECT COUNT(*) FROM bets WHERE user_id = u.id AND settled = 1 AND won = 1) as hits,
      (SELECT COUNT(*) FROM predictions WHERE user_id = u.id) +
      (SELECT COUNT(*) FROM record_predictions WHERE user_id = u.id) +
      (SELECT COUNT(*) FROM bets WHERE user_id = u.id) as total_preds,
      (SELECT COUNT(*) FROM predictions WHERE user_id = u.id AND settled = 1) +
      (SELECT COUNT(*) FROM record_predictions WHERE user_id = u.id AND settled = 1) +
      (SELECT COUNT(*) FROM bets WHERE user_id = u.id AND settled = 1) as settled
    FROM users u WHERE u.is_admin = 0
    ORDER BY u.points DESC
  `).all();
  res.json({ leaderboard: users });
});

// ── Admin: update teams on matches (for after groups) ─────
app.post('/api/admin/update-match-teams', requireAuth, requireAdmin, (req, res) => {
  const { match_id, team1, team2 } = req.body;
  const t1 = team1 || '';
  const t2 = team2 || '';
  const tx = db.transaction(() => {
    db.prepare('UPDATE matches SET team1 = ?, team2 = ? WHERE id = ?').run(t1, t2, match_id);
    if (!t1 || !t2) {
      db.prepare("UPDATE matches SET result = NULL, score = '', locked = 0 WHERE id = ?").run(match_id);
      const bets = db.prepare('SELECT * FROM predictions WHERE match_id = ? AND settled = 0').all(match_id);
      for (const b of bets) {
        logCoins(b.user_id, b.amount, '对阵清除退回', match_id);
      }
      db.prepare('DELETE FROM predictions WHERE match_id = ? AND settled = 0').run(match_id);
    }
  });
  tx();
  res.json({ ok: true });
});

// ── Lock status ───────────────────────────────────────────
app.get('/api/lock-status', (req, res) => {
  const categories = getLockStatus();
  const matchLocks = {};
  const matches = db.prepare('SELECT id, locked FROM matches').all();
  for (const m of matches) matchLocks[m.id] = !!m.locked;
  res.json({ categories, matches: matchLocks });
});

app.post('/api/admin/lock-category', requireAuth, requireAdmin, (req, res) => {
  const { category, locked } = req.body;
  const validCats = ['3-0','3-1','3-2','0-3'];
  if (!validCats.includes(category)) return res.status(400).json({ error: '无效分类' });
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('lock_' + category, locked ? '1' : '0');
  res.json({ ok: true });
});

app.post('/api/admin/lock-all', requireAuth, requireAdmin, (req, res) => {
  const { locked } = req.body;
  const val = locked ? '1' : '0';
  const tx = db.transaction(() => {
    for (const cat of ['3-0','3-1','3-2','0-3']) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('lock_' + cat, val);
    }
    db.prepare('UPDATE matches SET locked = ?').run(locked ? 1 : 0);
  });
  tx();
  res.json({ ok: true });
});

// ── Clear unsettled ───────────────────────────────────────
app.post('/api/admin/clear-unsettled', requireAuth, requireAdmin, (req, res) => {
  let refunded = 0;
  const tx = db.transaction(() => {
    const preds = db.prepare('SELECT * FROM predictions WHERE settled = 0').all();
    for (const p of preds) {
      logCoins(p.user_id, p.amount, '管理员清除退回', p.match_id);
      refunded++;
    }
    db.prepare('DELETE FROM predictions WHERE settled = 0').run();

    const recUsers = db.prepare('SELECT user_id, category, MAX(amount) as amount FROM record_predictions WHERE settled = 0 GROUP BY user_id, category').all();
    for (const r of recUsers) {
      logCoins(r.user_id, r.amount, '管理员清除退回', `8强${r.category}`);
      refunded++;
    }
    db.prepare('DELETE FROM record_predictions WHERE settled = 0').run();

    const bets = db.prepare('SELECT * FROM bets WHERE settled = 0').all();
    for (const b of bets) {
      logCoins(b.user_id, b.amount, '管理员清除退回', `盘口${b.market_id}`);
      refunded++;
    }
    db.prepare('DELETE FROM bets WHERE settled = 0').run();
  });
  tx();
  res.json({ ok: true, refunded });
});

// ── Coin logs ─────────────────────────────────────────────
app.get('/api/coin-logs', requireAuth, (req, res) => {
  const logs = db.prepare('SELECT * FROM coin_logs WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(req.session.userId);
  res.json({ logs });
});

app.get('/api/admin/coin-logs', requireAuth, requireAdmin, (req, res) => {
  const { user_id } = req.query;
  let logs;
  if (user_id) {
    logs = db.prepare('SELECT c.*, u.display FROM coin_logs c JOIN users u ON u.id=c.user_id WHERE c.user_id = ? ORDER BY c.id DESC LIMIT 200').all(parseInt(user_id));
  } else {
    logs = db.prepare('SELECT c.*, u.display FROM coin_logs c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC LIMIT 500').all();
  }
  res.json({ logs });
});

// ── Admin: reset password ─────────────────────────────────
app.post('/api/admin/reset-password', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.body;
  db.prepare("UPDATE users SET password = '000000' WHERE username = ?").run(username);
  res.json({ ok: true });
});

// ── Change own password (logged in) ───────────────────────
app.post('/api/change-password', requireAuth, (req, res) => {
  const { old_password, new_password } = req.body;
  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.session.userId);
  if (user.password !== old_password) return res.status(400).json({ error: '原密码错误' });
  if (!new_password || new_password.length < 4) return res.status(400).json({ error: '新密码至少4位' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(new_password, req.session.userId);
  res.json({ ok: true });
});

// ── Change password from login page (no session) ─────────
app.post('/api/change-password-public', (req, res) => {
  const { username, old_password, new_password } = req.body;
  if (!username || !old_password || !new_password) return res.status(400).json({ error: '请填写完整' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (!user) return res.status(401).json({ error: '账号不存在' });
  if (user.password !== old_password) return res.status(400).json({ error: '原密码错误' });
  if (new_password.length < 4) return res.status(400).json({ error: '新密码至少4位' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(new_password, user.id);
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🏆 王者荣耀策划联赛竞猜 - 已启动`);
  console.log(`  📍 http://localhost:${PORT}`);
  console.log(`  👤 管理员: admin / admin123`);
  console.log(`  👥 选手: 英文名 / 000000\n`);
});
