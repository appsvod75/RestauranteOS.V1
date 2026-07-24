import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Cargamos el JSON
const serviceAccount = require('./serviceAccountKey.json');

/**
 * Procesamiento de la llave privada.
 * La forma más segura y estándar es solo reemplazar los saltos de línea escapados.
 */
if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

// Inicialización segura
const initializeFirebase = () => {
    try {
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('[PUSH-INIT] Firebase Admin inicializado correctamente ✅');
        }
    } catch (e) {
        console.error('[PUSH-INIT] Error fatal al inicializar:', e.message);
    }
};

// Inicializamos al cargar el módulo
initializeFirebase();

export const sendPushNotification = async (tokens, title, body, data = {}, actions = []) => {
    if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) return;

    // Aseguramos que Firebase esté listo antes de usar messaging()
    if (admin.apps.length === 0) initializeFirebase();

    const message = {
        notification: { title, body },
        data: {
            ...data,
            url: data.url || '/',
            // FIX: Enviar acciones como data stringificada para que el SW las pueda leer manualmente
            // si el navegador no las soporta nativamente desde 'notification'.
            actions: JSON.stringify(actions)
        },
        android: {
            priority: 'high',
            notification: {
                priority: 'max',
                channel_id: 'restaurante_notifs'
            }
        },
        webpush: {
            headers: {
                Urgency: 'high'
            },
            notification: {
                title,
                body,
                icon: '/icon.png',
                badge: '/icon.png',
                tag: data.orderId || 'new-order',
                renotify: true,
                requireInteraction: true,
                actions: actions.length > 0 ? actions : undefined
            },
            fcm_options: {
                link: data.url || '/'
            }
        }
    };

    try {
        const messaging = admin.messaging();
        if (Array.isArray(tokens)) {
            const uniqueTokens = [...new Set(tokens)].filter(t => typeof t === 'string' && t.length > 10);
            if (uniqueTokens.length === 0) return;

            const response = await messaging.sendEachForMulticast({
                tokens: uniqueTokens,
                ...message
            });
            console.log(`[PUSH] Sent to ${response.successCount} devices. ${response.failureCount} failed.`);

            // Log de errores específicos para limpieza
            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.error(`[PUSH-FAIL] Token: ${uniqueTokens[idx].substring(0, 20)}... Error: ${resp.error.code}`);
                    }
                });
            }
            return response;
        } else {
            const response = await messaging.send({
                token: tokens,
                ...message
            });
            console.log('[PUSH] Sent successfully to one device.');
            return response;
        }
    } catch (error) {
        console.error('[PUSH] Error sending notification:', error);
    }
};

export default admin;
