process.env.TZ = 'America/El_Salvador';

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import routes from './routes.js';
import { triggerClosingWebhook } from './utils/closingUtils.js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION_FILE = path.join(__dirname, '..', 'dist', 'version.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now (adjust for production security)
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

app.use(cors());
app.use(express.json());

// Pass io to routes via middleware
app.use((req, res, next) => {
    req.io = io;
    next();
});

// API Routes
app.use('/api', routes);

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    socket.on('request_app_version', () => {
        if (currentAppVersion) {
            socket.emit('app_version', { version: currentAppVersion });
        }
    });
});

const PORT = process.env.PORT || 3001;


// --- AUTO CLOSE JOB (Moved here to access IO) ---
import pool from './db.js';

// Helper for AutoClose
const query = async (sql, params) => {
    const [rows, fields] = await pool.execute(sql, params);
    return rows;
};

// Check every 10 minutes (600,000 ms)
setInterval(async () => {
    try {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        const markRun = async (branchId) => {
            try {
                await query('UPDATE branches SET last_auto_close_run = ? WHERE id = ?', [today, branchId]);
            } catch (e) {
                console.error('[AutoClose] Failed to mark run (column might not exist yet):', e.message);
            }
        };

        const branches = await query('SELECT * FROM branches WHERE auto_close_enabled = 1 AND auto_close_time IS NOT NULL');

        for (const branch of branches) {
            const dbTime = String(branch.auto_close_time || '').split('.')[0];
            if (!dbTime || currentTime < dbTime) continue;

            const lastRun = branch.last_auto_close_run ? new Date(branch.last_auto_close_run) : null;
            const lastRunStr = lastRun ? `${lastRun.getFullYear()}-${pad(lastRun.getMonth() + 1)}-${pad(lastRun.getDate())}` : null;
            if (lastRunStr === today) continue;

            console.log(`[AutoClose] Running for Branch ${branch.name} at ${currentTime}...`);

            const pendingOrders = await query(
                'SELECT id, total FROM orders WHERE branch_id = ? AND status != "completed"',
                [branch.id]
            );

            if (pendingOrders.length > 0) {
                const conn = await pool.getConnection();
                try {
                    await conn.query("SET time_zone = '-06:00'");
                    await conn.beginTransaction();

                    for (const order of pendingOrders) {
                        const [paymentRows] = await conn.execute(
                            'SELECT SUM(amount) as total_paid FROM payments WHERE order_id = ?',
                            [order.id]
                        );
                        const paidSoFar = parseFloat(paymentRows[0].total_paid || 0);
                        const balance = Math.max(0, order.total - paidSoFar);

                        await conn.execute(
                            'UPDATE orders SET status = "completed", kitchen_status = "served", ready_at = IFNULL(ready_at, NOW()), completed_at = NOW(), amount_paid = ?, change_given = 0 WHERE id = ?',
                            [order.total, order.id]
                        );

                        if (balance > 0) {
                            await conn.execute(
                                'INSERT INTO payments (order_id, method, amount, received_by) VALUES (?, "Efectivo", ?, "Sistema Auto-Close")',
                                [order.id, balance]
                            );
                        }
                    }

                    await conn.commit();

                    console.log(`[AutoClose] Closed ${pendingOrders.length} orders for ${branch.name}.`);

                    io.emit('orders_updated');
                    console.log('[AutoClose] Sent refresh signal to clients via Socket.IO');
                } catch (err) {
                    await conn.rollback();
                    console.error(`[AutoClose] Error closing orders for ${branch.name}:`, err);
                } finally {
                    conn.release();
                }

                console.log(`[AutoClose] Orders closed for ${branch.name}. Proceeding to closing report...`);
            } else {
                console.log(`[AutoClose] No open orders for ${branch.name}. Proceeding to closing report...`);
            }

            // Save/update cash closing report (runs for both branches with and without pending orders)
            try {
                const cc = await pool.getConnection();
                try {
                    const [totals] = await cc.execute(
                        `SELECT COUNT(*) as totalOrders, COALESCE(SUM(amount_paid),0) as totalSales, COALESCE(SUM(change_given),0) as totalChangeOut
                         FROM orders WHERE branch_id = ? AND DATE(completed_at) = CURDATE()`,
                        [branch.id]
                    );
                    const [payments] = await cc.execute(
                        `SELECT COALESCE(SUM(p.amount),0) as totalCashIn
                         FROM payments p JOIN orders o ON o.id = p.order_id
                         WHERE o.branch_id = ? AND p.method = 'Efectivo' AND DATE(o.completed_at) = CURDATE()`,
                        [branch.id]
                    );
                    const [prev] = await cc.execute(
                        'SELECT expected_cash FROM cash_closing_reports WHERE branch_id = ? ORDER BY date DESC LIMIT 1',
                        [branch.id]
                    );
                    const initialCash = prev.length ? parseFloat(prev[0].expected_cash) : 0;
                    const totalOrders = parseInt(totals[0].totalOrders);
                    const totalSales = parseFloat(totals[0].totalSales);
                    const totalChangeOut = parseFloat(totals[0].totalChangeOut);
                    const totalCashIn = parseFloat(payments[0].totalCashIn);
                    const expectedCash = initialCash + totalCashIn - totalChangeOut;

                    const [methods] = await cc.execute(
                        `SELECT p.method, COALESCE(SUM(p.amount),0) as total
                         FROM payments p JOIN orders o ON o.id = p.order_id
                         WHERE o.branch_id = ? AND DATE(o.completed_at) = CURDATE() GROUP BY p.method`,
                        [branch.id]
                    );
                    const summary = {};
                    for (const m of methods) summary[m.method] = parseFloat(m.total);

                    await cc.execute(`
                        INSERT INTO cash_closing_reports
                        (branch_id, date, initial_cash, total_sales, total_cash_in, total_change_out, expected_cash, total_orders, summary)
                        VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                        initial_cash=VALUES(initial_cash), total_sales=VALUES(total_sales),
                        total_cash_in=VALUES(total_cash_in), total_change_out=VALUES(total_change_out),
                        expected_cash=VALUES(expected_cash), total_orders=VALUES(total_orders),
                        summary=VALUES(summary), created_at=NOW()
                    `, [branch.id, initialCash, totalSales, totalCashIn, totalChangeOut, expectedCash, totalOrders, JSON.stringify(summary)]);

                    console.log(`[AutoClose] Cash closing report saved for ${branch.name}.`);

                    triggerClosingWebhook(branch.id, { date: today, initialCash, totalSales, totalCashIn, totalChangeOut, expectedCash, totalOrders, summary })
                        .catch(e => console.error('[AutoClose] Webhook trigger failed:', e.message));
                } finally {
                    cc.release();
                }
            } catch (e) {
                console.error('[AutoClose] Failed to save cash closing report:', e.message);
            }

            await markRun(branch.id);
        }
    } catch (e) {
        console.error('[AutoClose] Job failed:', e);
    }
}, 600000);

// --- FORCE LOGOUT JOB (3:00 AM) ---
// We check every minute to be precise if we are at 03:00 manually, 
// or once per hour. Let's do it like the AutoClose job.
setInterval(async () => {
    try {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        // Global Logout at 03:00 AM
        // We use a simple variable to avoid multiple triggers in the same minute
        if (currentTime === "03:00") {
            console.log(`[ForceLogout] Global Trigger at ${currentTime}...`);
            io.emit('force_logout', { reason: 'daily_reset', time: today });
            console.log('[ForceLogout] Sent logout signal to all clients.');
        }
    } catch (e) {
        console.error('[ForceLogout] Job failed:', e);
    }
}, 60000); // Check every minute

// --- APP VERSION WATCHER (Auto-update via Socket.IO) ---
function readAppVersionFromDisk() {
    try {
        const raw = fs.readFileSync(VERSION_FILE, 'utf-8');
        const data = JSON.parse(raw);
        return data?.version != null ? String(data.version) : null;
    } catch {
        return null;
    }
}

let currentAppVersion = readAppVersionFromDisk();

function broadcastAppVersionUpdate(version) {
    if (!version) return;
    console.log(`🚀 Nueva versión en servidor: ${version}`);
    io.emit('app_version_update', { version });
}

function applyServerVersionIfChanged(nextVersion) {
    if (!nextVersion || nextVersion === currentAppVersion) return false;
    currentAppVersion = nextVersion;
    broadcastAppVersionUpdate(nextVersion);
    return true;
}

function startAppVersionWatcher() {
    let debounceTimer;
    const DEBOUNCE_MS = 15000; // 15s — espera a que FileZilla suba todos los assets
    try {
        fs.watch(VERSION_FILE, () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                applyServerVersionIfChanged(readAppVersionFromDisk());
            }, DEBOUNCE_MS);
        });
        console.log(`👀 Observando actualizaciones en ${VERSION_FILE} (debounce ${DEBOUNCE_MS / 1000}s)`);
    } catch (e) {
        console.warn('⚠️ No se pudo observar version.json:', e.message);
    }

    // Fallback polling cada 30s por si fs.watch no detecta (ej. SFTP)
    setInterval(() => {
        applyServerVersionIfChanged(readAppVersionFromDisk());
    }, 30000);
}

startAppVersionWatcher();
if (currentAppVersion) {
    console.log(`📦 Versión de app en servidor: ${currentAppVersion}`);
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
