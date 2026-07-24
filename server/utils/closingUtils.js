import pool from '../db.js';

const query = async (sql, params) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
};

export async function triggerClosingWebhook(branchId, reportData) {
    try {
        const [branch] = await query('SELECT * FROM branches WHERE id = ?', [branchId]);
        if (branch && branch.closing_webhook_url) {
            console.log(`[CLOSING-WEBHOOK] Triggering for Branch ${branchId} (${branch.name})...`);

            const webhookData = {
                type: 'cash_closing',
                branch: {
                    name: branch.name,
                    address: branch.address,
                    phone: branch.phone
                },
                report: {
                    date: reportData.date,
                    initialCash: reportData.initialCash,
                    totalSales: reportData.totalSales,
                    totalCashIn: reportData.totalCashIn,
                    totalChangeOut: reportData.totalChangeOut,
                    expectedCash: reportData.expectedCash,
                    totalOrders: reportData.totalOrders,
                    summary: reportData.summary
                },
                emails: branch.closing_email
            };

            fetch(branch.closing_webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookData)
            }).catch(err => console.error(`[CLOSING-WEBHOOK] Fetch Error (Branch ${branchId}):`, err.message));

            return true;
        }
        return false;
    } catch (err) {
        console.error(`[CLOSING-WEBHOOK] Failed for Branch ${branchId}:`, err);
        return false;
    }
}
