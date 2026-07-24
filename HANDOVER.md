# 🦅 HANDOVER: Protocolo RestauranteOS (Manual Técnico Completo)

**Fecha de Actualización:** 02/Julio/2026
**Versión:** 5.2 (Customer Portal menú digital, QR code, descripción/imagen en productos, share desde órdenes)
**Arquitecto:** Antigravity (Google Deepmind)
**Usuario Principal:** El "Colega" (Dev Ops Pragmático / VPS User)

---

## 🛡️ 2. El "Blindaje" (Estabilidad & Sync)

### A. Sincronización de KDS (Anti-Blue Screen)
*   **Problema:** Las actualizaciones parciales de socket desde el KDS borraban el array de items en el estado global, causando crashes (pantalla azul).
*   **Solución:** 
     1.  **Backend Logic**: En `PUT /orders/:id`, el servidor ahora realiza un **Poblado Manual** (joins de productos, carnes y extras) antes de emitir por socket. Esto garantiza que el KDS siempre reciba objetos listos para renderizar, eliminando el fallo de referencia nula.
     2.  **Frontend Safety**: Se implementó `hydrateOrder()` y guardas defensivas (`?.`) en `KdsScreen.tsx` como doble capa de seguridad.
     3.  **Merge Guard**: El listener de sockets en `App.tsx` realiza una **fusión profunda** que preserva items y metadatos si el mensaje entrante es parcial (Ghosting Guard).

### D. Inmutabilidad de Ítems (POS Safety)
*   **Bloqueo Individual**: Cuando un ítem tiene `completed: true` (marcado en KDS), se bloquea toda edición en el POS (cantidad, extras, borrado).
*   **Nueva Línea Automática**: El sistema impide fusionar productos nuevos con líneas ya completadas, forzando la creación de una entrada independiente para la cocina.

### B. Sistema de Actualización Forzada
*   **version.json**: Generado en cada build via `scripts/bump-version.js` (prebuild).
*   **checkAndApplyUpdate()**: Centralizado en `lib/appUpdate.ts`. Ante cambios, invalida caches, desinstala el SW y recarga automáticamente.
*   **Overlay**: Muestra "Actualización en curso" con spinner ámbar sobre fondo oscuro durante la actualización.
*   **Server watcher**: `server/index.js` observa `dist/version.json` con debounce de 15s y broadcast vía socket. Fallback polling cada 30s.

### C. Persistencia de Vista
*   La app ahora guarda `currentView` en `localStorage`. Al presionar F5, el usuario regresa exactamente a donde estaba (KDS, POS, Admin, etc.).

---

## 🌯 3. Sistema de Combos & BOM (Bill of Materials)

### A. Gestión Administrativa
*   Se implementó una interfaz de gestión de combos en `AdminPanel.tsx` que permite definir productos fijos (Bundles) y dinámicos (Pasos/Steps).
*   **BOM**: Los combos descuentan stock de forma recursiva según su configuración.

### B. Flujo de Selección (POS)
*   `ComboSelectionModal.tsx` maneja selecciones secuenciales para combos dinámicos (ej: elegir carne, luego acompañamiento).

---

## 🖥️ 4. KDS de Alto Rendimiento (Efecto FunkyFood)

### A. Layout & Typography
*   **Masonry Grid**: Rejilla optimizada para tablets (`lg:columns-4`). Verás 4 órdenes a lo ancho en horizontal.
*   **Visuales "Chef-Ready"**: Tipografía extra-negrita (`font-black`) y mayúsculas para máxima visibilidad a distancia.
*   **Áreas de Toque**: Botones de acción (`py-4`) agrandados para uso táctil intensivo.

### B. Screen Wake Lock
*   Se integró la API `navigator.wakeLock` en el KDS para evitar que la tablet apague la pantalla durante la operación.

### C. Flame Icon + PIN en Delete
*   Botón eliminar ticket en KDS: `TrashIcon` + `FlameIcon` (llama naranja) cuando el ticket está `in_process`.
*   Al presionar, abre `PinVerificationModal` para confirmar la acción.

---

## 👤 5. Gestión de Usuarios (Desactivar y filtrar)

### A. Soft Delete / Desactivación
*   Los usuarios tienen toggle Activo/Inactivo en el editor de usuario (`AdminPanel.tsx`).
*   Al desactivar, el usuario se oculta de la lista por defecto (el PIN se libera para reuso).

### B. Filtro de Inactivos
*   Botón `EyeIcon`/`EyeOffIcon` a la par del buscador de usuarios.
*   Por defecto solo se muestran usuarios activos. Al tocar el ojito, se alterna la visibilidad de los desactivados.

### C. Server
*   `GET /initial-data` ahora retorna **todos** los usuarios (sin `WHERE is_active = 1`).

---

## 💰 6. CashOpeningModal (Apertura de Caja)

### A. Diseño
*   Botones "Ignorar" (rojo) y "No recordar" (azul) lado a lado debajo de "Registrar Apertura" (ámbar).
*   Fecha actual mostrada debajo del nombre de sucursal.

### B. Flash Fix
*   `cashDataLoadedRef` evita que el modal se renderice antes de que los datos de caja estén listos.

### C. Botón "Aperturar Caja"
*   Cambiado de barra full-width a un item del grid (pulso ámbar, `CashRegisterIcon` + `PlusIcon` badge).

---

## 📋 7. CashClosingScreen — Auditoría por Método de Pago

### A. Modal de Auditoría
*   Cada método de pago en el resumen tiene un icono `ClipboardListIcon` que abre un modal.
*   El modal muestra órdenes: # orden, hora, mesero, tipo, monto del método, total de la orden.

### B. Neto vs Bruto
*   El resumen ahora muestra el monto **neto** (resta el cambio dado) en lugar del bruto.
*   El cálculo de `expectedCash` usa el total bruto de efectivo (sin restar cambio).

---

## 🔥 8. Prioridad de Palomita (Paid > Kitchen)

*   En `StartScreen.tsx` y `ActiveOrdersMobileScreen.tsx`, el `CheckIcon` (palomita verde) siempre se muestra si `isPaid` o `status === 'completed'`, sin importar el estado de cocina.

---

## 🎯 9. Filtro de Órdenes No Pagadas

*   Botón `CreditCardIcon` en la cabecera de pedidos, al lado izquierdo del botón de IA.
*   Al activarse (ámbar), filtra la lista para mostrar solo órdenes no pagadas (`status !== 'completed'`).

---

## 🛠️ 10. Configuración del Servidor (Nginx & Archivos a desplegar)

### Archivos a subir al VPS en cada deploy:
1. `dist/` (build frontend)
2. `server/routes.js` (backend con migraciones automáticas)
3. `server/utils/closingUtils.js` (webhook de cierre de caja)
4. `server/index.js` (watcher de version.json con debounce 15s)

### Nginx
Para asegurar que las actualizaciones funcionen, el archivo `version.json` debe saltarse cualquier tipo de caché en el VPS:

```nginx
location = /version.json {
    root /ruta/a/tu/dist;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
    add_header Pragma "no-cache";
    expires 0;
    try_files $uri =404;
}
```

### Deploy rápido
```bash
npm run build                    # genera dist/
# subir dist/, server/routes.js, server/index.js al VPS
# si solo cambió frontend: solo dist/
# si cambió backend: pm2 restart all
```

---

## 📅 11. Date Pickers con Estilo Ámbar

*   Los inputs `type="date"` en Config. Maestra > Borrar Ventas usan un SVG inline de calendario en color ámbar (`#fbbf24`) para el picker indicator.
*   `color-scheme: dark` para que el popup nativo sea legible sobre fondo oscuro.

---

## 🚫 6. Skip KDS (Ocultar productos de cocina)

### A. Campo `show_in_kds`
*   Se agregó la columna `show_in_kds` (TINYINT(1) DEFAULT 1) a la tabla `products` mediante auto-migración.
*   **Admin:** En el editor de productos hay un toggle "Mostrar en Cocina (KDS)" (ámbar). Al desactivarlo, el producto deja de aparecer en la pantalla de cocina.
*   **KDS:** `KdsScreen.tsx` filtra los items con `showInKds === false`.
*   **Reapertura:** La lógica de reapertura de KDS en `App.tsx` ignora productos con `showInKds === false` (ej: agregar una bebida a una orden "Lista" no la reabre en cocina).

---

## 📧 7. Closing Webhook (Email automático al cerrar caja)

### A. Configuración
*   Nuevos campos en `branches`: `closing_webhook_url` (TEXT) y `closing_email` (TEXT).
*   **Admin > Sucursales > Editar:** Campos "Webhook Cierre (Email)" y "Correo(s) para Reporte".
*   **Server:** `server/utils/closingUtils.js` — función `triggerClosingWebhook()` que POSTea el reporte al GAS webhook con los datos del cierre y los correos.

### B. Disparo
*   Al guardar/actualizar un cierre de caja (`POST /cash-closing`), se dispara el webhook automáticamente en segundo plano.
*   El payload es idéntico al de FunkyFood_OS, compatible con el mismo GAS.

---

## ⏰ 12. Timezone El Salvador (UTC-6) Forzado

*   **Problema:** Algunos endpoints usaban `NOW()` de MySQL sin setear `SET time_zone`, lo que podía guardar fechas en UTC del servidor en vez de UTC-6.
*   **Arquitectura:**
    1.  `server/index.js:1` — `process.env.TZ = 'America/El_Salvador'` (Node.js)
    2.  `server/db.js:23` — `timezone: '-06:00'` en pool de mysql2 (serialización de Date objects)
    3.  `server/routes.js:12` — `query()` helper setea `SET time_zone = '-06:00'` en cada consulta GET
    4.  `server/routes.js:1563` — POST /orders seteaba timezone ✅
    5.  `server/routes.js:1725` — **FIX:** PUT /orders ahora setea timezone (antes no, afectaba `ready_at = NOW()`)
    6.  `server/index.js:95` — **FIX:** Auto-close ahora setea timezone (antes no, afectaba `completed_at = NOW()`)
*   **Resultado:** Todas las fechas se guardan y leen consistentemente en hora local de El Salvador.

---

## 🏷️ 13. "Local" Renombrado a "Restaurante" en toda la UI

*   El enum `OrderType.Local = 'Local'` se mantiene en DB y comparaciones, pero la UI muestra "Restaurante" / "RESTAURANTE".
*   Archivos modificados: `StartScreen.tsx`, `ActiveOrdersMobileScreen.tsx`, `CompletedOrdersScreen.tsx`, `KdsScreen.tsx`, `KdsHistoryModal.tsx`, `OrderScreen.tsx`, `TicketModal.tsx`, `CashClosingScreen.tsx`, `DailySummaryScreen.tsx`.
*   `sendTicket.gs` (Google Apps Script) requiere cambio manual.

---

## 📊 14. Grupos de Órdenes Reordenados + Contadores + Search + TOTAL

*   **Nuevo orden fijo:** Cliente Retira → Delivery → Para Llevar → Restaurante (antes Local iba primero).
*   **Contadores fuera del chip:** Cada chip de grupo tiene una pill idéntica al lado con la cantidad `(n)` de órdenes de ese tipo (ya no va dentro del chip).
*   **Search más pequeño:** Input reducido (`py-2`, `text-xs`) con placeholder "BUSCAR...", sin ancho fijo máximo.
*   **TOTAL badge:** A la derecha del search, muestra el total de órdenes del día sin filtrar (`activeOrders.length`).

---

## 🔒 8. Doble Seguridad en Config. Maestra

*   El acceso a "Config. Maestra" ahora requiere PIN de SuperAdmin (igual que Sucursales).
*   `PinVerificationModal` con `requiredRole={UserRole.SuperAdmin}` como doble capa de seguridad.

---

## 🔮 9. Roadmap & Estado Actual

El sistema se encuentra en su versión más estable y pulida hasta la fecha.

---

## 👥 15. Customer Search Ordenado por Relevancia

*   **Problema:** Buscar "ANA" mostraba "JOHAN", "HANA" antes que "ANA" porque no había sorting.
*   **Solución:** Se agregó orden por relevancia en `StartScreen.tsx` y `ManageCustomersScreen.tsx`:
    1. Coincidencia exacta (nombre === búsqueda)
    2. Empieza con (nombre startsWith búsqueda)
    3. Contiene (nombre includes búsqueda)
    4. Teléfono

---

## 🛡️ 16. Verificación Previa al Borrado (check-orders-range)

*   **Endpoint nuevo:** `POST /api/admin/check-orders-range` — cuenta órdenes en un rango de fechas sin borrar.
*   **Frontend:** Al hacer clic en "EJECUTAR LIMPIEZA POR RANGO", primero se consulta el conteo.
    *   Si count === 0: toast rojo "No hay órdenes entre X y X", no abre modal.
    *   Si count > 0: abre modal de PIN mostrando "BORRARÁS N VENTAS DEL X AL X".

---

## 💾 17. Descargar Backup de Base de Datos

*   **Endpoint nuevo:** `POST /api/admin/backup-database` (SuperAdmin + PIN).
*   Ejecuta `mysqldump` y guarda el .sql en `backups/` del proyecto (se crea automáticamente).
*   Descarga el archivo al navegador del usuario.
*   **Frontend:** Botón "Descargar Backup" en Config. Maestra > Mantenimiento (verde esmeralda).
*   **Requiere:** `mysqldump` instalado en el servidor.

---

## ⚡ 18. Delivery Fee — Auto-select al Enfocar

*   `OrderScreen.tsx:720` — `onFocus={(e) => e.target.select()}` selecciona todo el valor al tocar el input.
*   El usuario escribe el nuevo número directamente sin borrar manualmente.
*   `isNaN` guard por si el campo queda vacío.

---

## 📊 19. Resumen del Día — Muestra Todas las Órdenes

*   `AdminPanel.tsx:266` — Se eliminó el filtro `.filter(o => o.status === 'completed')`.
*   Ahora `DailySummaryScreen` recibe **todas** las órdenes (activas y completadas).
*   Se actualiza por socket en tiempo real al agregar/quitar items.

---

## 🔧 20. PaymentModal — Bug fix isCashOnlyPayment con array vacío

*   **Problema:** `isCashOnlyPayment` usaba `payments.every(p => p.method === PaymentMethod.Cash)`. `[].every()` retorna `true` aunque no haya pagos. Al seleccionar Transfer como primer pago, el guard de sobrepago se saltaba y dejaba pagar de más.
*   **Solución:** Se cambió la condición para revisar `currentPaymentMethod !== PaymentMethod.Cash` directamente en vez de depender de `isCashOnlyPayment`.
*   **Efecto:** Si el método actual no es Efectivo y el monto excede el total, muestra toast.error y bloquea el pago.

## 🧾 21. PaymentModal — z-index, toast en vez de alert, double-click guard

*   **z-index:** Cambiado de `z-50` a `z-[300]` en `PaymentModal.tsx:90` para que no aparezca detrás de otros modales.
*   **Toast vs Alert:** El bloqueo de `alert()` se reemplazó por `toast.error()` para que el modal siga usable.
*   **Double-click guard:** Botón COBRAR tiene un `useRef` que previene doble clic en conexiones lentas. Ref se resetea al cerrar el modal.

## 📋 22. CashClosing — Banner de Discrepancias

*   `CashClosingScreen.tsx` — nuevo banner que compara el total de pagos recibidos vs el total de órdenes.
*   Por cada orden con diferencia, muestra: número de orden, métodos de pago usados y montos.
*   Ayuda a detectar pagos manuales o ajustes que no cuadran con los tickets.

## 🖥️ 23. SalesProjectionsDashboard — Scroll en Móvil

*   **Problema:** Las vistas `list` y `create_config` no tenían `overflow-y-auto` en su contenedor principal. El `<main>` del panel admin tiene `overflow-hidden`, por lo que el contenido se desbordaba sin posibilidad de scroll en móvil.
*   **Solución:** Se agregó `overflow-y-auto scrollbar-hide pb-4` a los contenedores de ambas vistas. La vista `detail_view` ya lo tenía.

## 🔍 24. Auditoría — Username en Razón de Borrado

*   `OrderScreen.tsx` — Al eliminar un item de una orden, la razón en el log de auditoría cambió de `'Eliminado por el usuario'` a `` `Eliminado por: ${currentUser?.username || 'Usuario'}` ``.

## 📧 25. sendTicket.gs — Fix RESTAURANTE

*   `sendTicket.gs:87` — Se corrigió la línea para mostrar `RESTAURANTE` en vez de `LOCAL` en el ticket impreso.
*   Usa el mismo patrón: `` `${order.type === 'Local' ? 'RESTAURANTE' : String(order.type).toUpperCase()}` ``.

---

## 🔌 26. Indicador de Conexión en Header (Sin botón)

*   **Problema:** Usuarios tocaban el toast de error de conexión o su botón de cerrar, descartaban la advertencia y se quedaban en una vista desactualizada sin saber que seguían desconectados.
*   **Solución:** Se agregó una barrita ámbar debajo del header cuando el socket se desconecta:
    *   Sin botón para cerrar — el usuario no puede descartarla manualmente.
    *   Desaparece automática cuando el socket reconecta.
    *   Texto: `SIN CONEXIÓN · Reconectando...` con un punto pulsante ámbar.
    *   Muy compacta (px-3 py-1, texto 9px) para no robar espacio en móviles.
    *   Delay de 3s antes de mostrar, para evitar falsos positivos al bloquear/desbloquear pantalla.
*   **Archivos:** `App.tsx` — nuevo estado `isConnected`, `connectionTimerRef`, listeners `socket.on('connect'/'disconnect')`, barra en layout.

---

## 🔄 27. Eliminación de window.location.reload() en Asset Errors

*   **Problema original:** `fetchAllData` detectaba `is not a valid JSON` o `Unexpected token` y llamaba a `window.location.reload()`, perdiendo la orden en curso y dejando al usuario en una pantalla "SESIÓN REINICIADA" sin salida.
*   **Solución en 3 capas:**

### Capa 1 — Reintentos estilo FunkyFood (App.tsx)
*   **Antes:** solo se reintentaban errores de red. Errores de parseo (HTML en vez de JSON) iban directo al reload.
*   **Ahora:** **cualquier error** se reintenta 3 veces con delays de 3s, 6s y 9s antes de tomar acción.
*   Si el server se recupera en esos ~9s, el usuario no nota nada.
*   Alineado con FunkyFood_OS que nunca presentaba este bug.

### Capa 2 — Toast RECARGAR en vez de reload (App.tsx + NotificationToast)
*   Si fallan los 3 reintentos y es error de assets, se muestra un **NotificationToast persistente** (ámbar, posición bottom) con botón **"RECARGAR"**.
*   El usuario no pierde su orden ni su sesión — puede seguir trabajando o recargar cuando quiera.
*   Si el próximo `fetchAllData` (heartbeat) tiene éxito, el toast se **auto-cierra**.
*   `NotificationToast` ahora soporta `actionLabel` y `onAction` para botones personalizados.

### Capa 3 — Nginx devuelve JSON en errores 502/503/504
*   Configuración en `/etc/nginx/sites-available/restaurant`:
    ```nginx
    error_page 502 503 504 /json-error;
    location = /json-error {
        internal;
        return 200 '{"error":"temporary"}';
        add_header Content-Type application/json;
    }
    ```
*   Así Nginx nunca devuelve HTML en errores, la app jamás detecta `is not a valid JSON`.

### Botón "VOLVER AL MENÚ"
*   Ahora también llama a `fetchAllData(true)` e incrementa `startScreenKey` para refrescar datos al navegar.

---

## 🪑 28. Fix: Mesas No se Liberaban Después de Pagar

*   **Problema:** En la sesión del 14/Junio se reportó que al pagar una orden, las mesas no se liberaban ni reflejaban como seleccionables de inmediato en la StartScreen de los otros dispositivos.

*   **Causa Raíz:** Triple problema:

    1.  **Server broadcast incompleto** (`server/routes.js:1850`): El PUT /orders emitía `order_updated` con un dbOrder que contenía `table_id` (número) pero **no** el objeto `table: { id, name, branchId }`. La promesa de "FULL POPULATED order" en el comentario era falsa — solo se populaban items y payments.
    
    2.  **Merge destructivo en frontend** (`App.tsx:672`): El handler de `order_updated` hacía `{ ...o, ...incomingHydrated }`, y como `incomingHydrated.table` era `undefined`, se sobreescribía el objeto `table` existente en `o`. Esto hacía que `isOccupied` (que depende de `o.table && ...`) perdiera la referencia a la mesa.
    
    3.  **Sin remount de StartScreen** (`App.tsx:1324`): `onCompleteOrder` llamaba a `setActiveOrderId(null)` y `setCurrentView('start')`, pero no incrementaba `startScreenKey`. En algunos casos, el componente StartScreen no se remontaba, dejando una vista con datos desactualizados.

*   **Solución en 3 partes:**

    1.  **Server (`routes.js:1898`)**: Se agregó lookup de `tables` para poblar `dbOrder.table` antes del broadcast:
        ```javascript
        if (dbOrder.table_id) {
            const [table] = await query('SELECT * FROM tables WHERE id = ?', [dbOrder.table_id]);
            if (table) {
                dbOrder.table = { id: table.id, name: table.name, branchId: table.branch_id };
            }
        }
        ```
    
    2.  **Frontend merge defensivo (`App.tsx:672`)**: Se preservan `table`, `customer` y `waiter` del estado existente si el incoming no los trae:
        ```typescript
        table: incomingHydrated.table || o.table,
        customer: incomingHydrated.customer || o.customer,
        waiter: incomingHydrated.waiter || o.waiter,
        ```
    
    3.  **Frontend remount (`App.tsx:1324`)**: Se agregó `setStartScreenKey(prev => prev + 1)` en `onCompleteOrder` para forzar remount de StartScreen con datos frescos.

*   **Efecto:** Al pagar una orden desde cualquier dispositivo, la mesa se libera inmediatamente en TODOS los dispositivos conectados, sin necesidad de esperar el próximo `orders_updated` ni hacer refresh manual.

---

## Archivos modificados en sesión (13/Junio/2026)

| Archivo | Cambio |
|---------|--------|
| `components/AdminPanel.tsx` | Ojito filtrar inactivos, desactivación de usuarios |
| `components/StartScreen.tsx` | Botón filtrar no pagados, palomita prioritaria |
| `components/CashOpeningModal.tsx` | Diseño botones, date display, flash fix |
| `components/KdsScreen.tsx` | Flame icon + PIN en delete |
| `components/ActiveOrdersMobileScreen.tsx` | Flame icon + palomita prioritaria |
| `components/CashClosingScreen.tsx` | Modal auditoría por método, neto cash |
| `components/MasterSettingsScreen.tsx` | Date picker ámbar |
| `lib/appUpdate.ts` | Overlay "Actualización en curso", checkAndApplyUpdate |
| `server/index.js` | Watcher version.json con debounce 15s |
| `server/routes.js` | Initial-data retorna todos los usuarios |
| `scripts/bump-version.js` | Genera version.json en prebuild |
| `vite.config.ts` | `__APP_VERSION__` via define |
| `App.tsx` | Version sync, cashOpeningModal guard |
| `server/routes.js` | Timezone fix en PUT /orders + nuevas secciones HANDOVER |
| `server/index.js` | Timezone fix en auto-close |
| `components/StartScreen.tsx` | "Local" → "Restaurante", reorden grupos, contadores, search + TOTAL |
| `components/ActiveOrdersMobileScreen.tsx` | "LOCAL" → "RESTAURANTE" en tabs y display |
| `components/CompletedOrdersScreen.tsx` | "LOCAL" → "RESTAURANTE" en tabs y display |
| `components/KdsScreen.tsx` | Display "Local" → "Restaurante" |
| `components/KdsHistoryModal.tsx` | Display "Local" → "Restaurante" |
| `components/OrderScreen.tsx` | Display "Local" → "Restaurante" |
| `components/TicketModal.tsx` | Display "Local" → "Restaurante" |
| `components/CashClosingScreen.tsx` | Display "Local" → "Restaurante" (2 lugares) |
| `components/DailySummaryScreen.tsx` | Display "Local" → "Restaurante" |
| `components/StartScreen.tsx` | Customer search sorted by relevance (exact → starts → contains) |
| `components/ManageCustomersScreen.tsx` | Customer search sorted by relevance |
| `components/OrderScreen.tsx` | Delivery fee auto-select en focus, isNaN guard |
| `components/AdminPanel.tsx` | DailySummary ya no filtra solo completed |
| `components/MasterSettingsScreen.tsx` | Verificación previa (check-orders-range), backup button + PIN modal genérico |
| `api.ts` | `backupDatabase()`, `checkOrdersRange()` |
| `server/routes.js` | Endpoints `POST /admin/check-orders-range` y `POST /admin/backup-database` |
| `HANDOVER.md` | Esta actualización |
| `walkthrough.md` | Walkthrough actualizado |
| `components/PaymentModal.tsx` | Fix isCashOnlyPayment empty array, z-index z-[300], toast en vez de alert, useRef double-click guard |
| `components/SalesProjectionsDashboard.tsx` | overflow-y-auto en vistas list y create_config para scroll móvil |
| `components/CashClosingScreen.tsx` | Banner de discrepancias entre pagos y órdenes |
| `components/OrderScreen.tsx` | Username en razón de auditoría al borrar item |
| `sendTicket.gs` | Fix línea 87 RESTAURANTE en vez de LOCAL |
| `App.tsx` | Indicador de conexión (isConnected + connectionTimerRef + barra ámbar), reintentos 3x estilo FunkyFood, toast RECARGAR en vez de reload, VOLVER AL MENÚ ahora refresca datos, fix merge destructivo (preserva table/customer/waiter), startScreenKey en onCompleteOrder |
| `components/NotificationToast.tsx` | Nuevos props actionLabel/onAction para botón personalizado en modo persistente |
| `server/routes.js` | Fix broadcast: lookup de `tables` para poblar `dbOrder.table` antes de emitir `order_updated` |
| `types.ts` | `paymentDueDate`, `paymentPending`, `paymentGraceDays` en CompanySettings |
| `server/routes.js` | Auto-migration payment settings + `autoSetPaymentPending()` + `getNextDueDate()` |
| `components/PaymentControl.tsx` | **Nuevo** — Control de Pago (día, gracia, toggle, drag-to-scroll) |
| `components/AdminPanel.tsx` | Menu item "Control Pago" (final, PIN) + vista |
| `components/StartScreen.tsx` | Banner mora en header + desactivar botón crear + grace days dinámico |
| `components/icons.tsx` | `XCircleIcon` |
| `App.tsx` | Mapeo payment fields desde globalSettings, props a StartScreen/AdminPanel |
| `HANDOVER.md` | Esta actualización |
| `walkthrough.md` | Walkthrough actualizado |

---

## 💳 29. Sistema de Control de Pago (Renta de App)

### A. Lógica General
*   Sistema de recordatorio de pago para alquiler/venta de la app.
*   SuperAdmin configura **día de pago** (1-31) y estado Pendiente/Pagada en Admin > Control de Pago.
*   El sistema calcula dinámicamente la próxima fecha de vencimiento cada mes.

### B. Auto-set de Pendiente
*   `autoSetPaymentPending()` — corre al iniciar server, en `GET /settings` y `GET /initial-data`.
*   Solo auto-marca PENDIENTE si `CURDATE()` está en `[día_vencimiento - 5, día_vencimiento]`.
*   Si la fecha pasó y el admin lo puso PAGADA, **no lo revierte**.

### C. Banner en StartScreen
*   Banner sticky dentro del header.
*   **Día 1 a N** (N = grace days): ámbar — `⚠️ USO DE APLICACIÓN CON X DÍAS DE MORA...`
*   **Día N+1+**: rojo — `🚫 CREACIÓN DE ÓRDENES DESACTIVADA POR FALTA DE PAGO` + botón `+` desactivado.

### D. Días de Gracia Configurables
*   `payment_grace_days` en `app_config` (default `3`, rango 0-30).
*   Ej: grace=5 → banner días 1-5, bloqueo al día 6.

### E. Panel de Control (Admin > Control de Pago — SuperAdmin + PIN)
*   `PaymentControl.tsx` — indicador estado, próximo vencimiento, día pago, días gracia, toggle.
*   Drag-to-scroll, sin scrollbar. Al final del menú AdminPanel.

### F. Database (app_config)
*   `payment_due_date` — día de pago (1-31).
*   `payment_pending` — `"1"` = Pendiente, `"0"` = Pagada.
*   `payment_grace_days` — días de gracia (default `"3"`).

### 30. Transferencia con Exceso + Transfer Otros
**Propósito:** Manejar pagos por transferencia que exceden el total de la orden (el excedente va a otros negocios) y pagos completos para otros negocios mediante el método "Transfer Otros".

**Columnas nuevas:**
*   `payments.excess_amount DECIMAL(10,2) DEFAULT 0.00` — auto-migration en `routes.js`.

**PaymentMethod enum:**
*   `TransferOther = 'Transfer Otros'` — nuevo método de pago.

**Flujo en PaymentModal:**
*   Transfer ya permite sobrepago (como Efectivo). El excedente se guarda como `excessAmount`.
*   `Transfer Otros` — el monto completo es `excessAmount` (100% para otros negocios).
*   Muestra "Para Otros: $X" (fondo púrpura) cuando hay excedente por transferencia.
*   Cada payment line muestra `($X otros)` si tiene excess.

**Flujo en server:**
*   `INSERT INTO payments` incluye `excess_amount` desde `p.excessAmount`.
*   Hydratación de payments incluye `excessAmount: parseFloat(p.excess_amount || 0)`.

**CashClosingScreen — desglose:**
*   `Transfer. Propias` = Transfer.amount - Transfer.excessAmount.
*   `Transfer. Otros` = Transfer.excessAmount + TransferOtros.amount.
*   `Total Ventas` = suma de todos los métodos (incluye todas las transferencias).
*   Audit modal separado para "Transfer. Propias" y "Transfer. Otros".

**CashClosingTicketModal:**
*   Transfer. Otros se muestra en gris aparte del desglose principal.

**Archivos modificados:**
| Archivo | Cambio |
|---|---|
| `types.ts` | `TransferOther` en PaymentMethod, `excessAmount` en Payment |
| `server/routes.js` | Auto-migration excess_amount, guardar/hydrate excessAmount |
| `components/PaymentModal.tsx` | Permitir sobrepago Transfer, UI "Para Otros", botón Transfer Otros |
| `components/CashClosingScreen.tsx` | Desglose Transfer. Propias/Otros en summary |
| `components/CashClosingTicketModal.tsx` | Transfer. Otros en gris

---

## 📱 35. Customer Portal (Menú Digital para Clientes)

### A. Descripción
Portal público de solo lectura donde los clientes pueden ver el menú con fotos, descripciones y precios. Accesible via:
- `/?view=menu` (query param)
- `/menu` (path)
- `/portal` (path legacy)

No requiere login. Muestra un grid de productos con búsqueda, filtro por categorías (drag-to-scroll), y modal de detalle con imagen ampliada.

### B. Componentes
- **`CustomerPortal.tsx`** — Pantalla pública con header de marca, búsqueda, categorías, grid de productos y modal de detalle.
- **Renderizado en `App.tsx`** — Detectado antes del login, sin header de admin ni wrapper.

### C. Campos Nuevos en Productos
- **`description`** (TEXT, nullable) — Descripción del producto para el portal.
- **`image_url`** (VARCHAR(500), nullable) — URL de imagen del producto.

### D. Auto-migraciones en `routes.js`
- `ALTER TABLE products ADD COLUMN description TEXT DEFAULT NULL`
- `ALTER TABLE products ADD COLUMN image_url VARCHAR(500) DEFAULT NULL`

### E. Editor de Productos
- Nuevos campos "Descripción (Portal Clientes)" (textarea) y "URL de Imagen (Portal Clientes)" (input) en el formulario de producto en `AdminPanel.tsx`.

### F. Endpoints Actualizados
- `POST /products` — guarda `image_url` y `description`
- `PUT /products/:id` — actualiza `image_url` y `description`
- `GET /initial-data` — mapea `image_url` y `description` al objeto Product

---

## 🖼️ 36. QR Code del Menú Digital

### A. Generación
- Nueva sección "Menú Digital (Código QR)" en **Config. Maestra** (`MasterSettingsScreen.tsx`).
- Usa `qrcode.react` con tamaño Ultra-HD (2048px), nivel de corrección H, logo opcional en el centro.
- URL generada dinámicamente: `{window.location.origin}/menu`

### B. Descarga
- Botón "Descargar QR para imprimir" que descarga el QR como PNG.

---

## 🔗 37. Compartir Menú Digital desde Órdenes

### A. Botones en Header de StartScreen
- **Icono QR** (ámbar) — botón que copia/comparte `{origin}/menu`.
- **Icono Share** (verde) — mismo comportamiento, ambos usan `navigator.share()` si disponible, copia al portapapeles + toast si no.

### B. Accesible para todos los roles
Meseros, cajeros, admins — cualquiera que pueda ver la pantalla de pedidos puede compartir el menú digital.

---

## Archivos modificados en sesión (02/Julio/2026)

| Archivo | Cambio |
|---------|--------|
| `types.ts` | Product: imageUrl?, description? |
| `server/routes.js` | Auto-migration description/image_url, POST/PUT /products, initial-data mapping |
| `components/AdminPanel.tsx` | Campos descripción e imagen en editor de producto |
| `components/CustomerPortal.tsx` | **Nuevo** — Portal público de menú digital |
| `components/App.tsx` | CurrentView +menu, URL detection, render sin header |
| `components/icons.tsx` | ShareIcon, QrCodeIcon |
| `components/StartScreen.tsx` | Botones QR y Share en header |
| `components/MasterSettingsScreen.tsx` | Sección QR del menú digital |
| `package.json` | +qrcode.react |
| `HANDOVER.md` | Esta actualización |
| `walkthrough.md` | Walkthrough actualizado |<｜end▁of▁thinking｜>

### A. Problema
El banner de mora en `StartScreen.tsx` desaparecía al cambiar de mes porque `autoSetPaymentPending()` usaba una ventana de 5 días antes del vencimiento. Al cruzar el mes, el cálculo del próximo vencimiento se reiniciaba, limpiando el banner.

### B. Solución
*   **`lib/utils.ts`** — Nuevo archivo con funciones centralizadas:
    *   `getLastDueDate()`: Último día de vencimiento basado en el día configurado y la fecha actual.
    *   `getDaysOverdue()`: Días transcurridos desde el último vencimiento.
    *   `getNextDueDate()`: Próximo vencimiento futuro.
*   **`StartScreen.tsx`**: `paymentInfo` memo simplificado a 3 líneas usando `getDaysOverdue`.
*   **`PaymentControl.tsx`**: Eliminadas funciones inline, importa desde `lib/utils.ts`.

### C. Efecto
El banner de mora persiste aunque cambie el mes, y se actualiza correctamente según los días de atraso.

---

## 🔢 32. SalesProjections — Fix Truncamiento de Números

### A. Problema
Input `type="number"` truncaba valores como `25000` a `25` porque el navegador ignoraba dígitos después de cierta precisión al hacer parse automático.

### B. Solución
*   Cambiado `type="number"` a `type="text"` + `inputMode="decimal"/"numeric"`.
*   Sanitización en `onChange` y al guardar: solo dígitos y puntos.

---

## ⏰ 33. Auto-Close — Cash Closing Report + Fixes

### A. Problemas Encontrados
1. `last_auto_close_run` column no existía en la auto-migración de `routes.js`.
2. El string de TIME de MySQL (ej. `'23:30:00.000000'`) no coincidía con `'23:30:00'` en la comparación.
3. Si `markRun()` fallaba, se revertía toda la transacción de cierre de órdenes.
4. No se generaba cash closing report automáticamente.

### B. Solución
*   `routes.js`: Agregada columna `last_auto_close_run` a la auto-migración de branches.
*   `index.js`: Stripeo de microsegundos con `.split('.')[0]` para comparación correcta.
*   `index.js`: `markRun()` extraído con try/catch fuera de la transacción principal.
*   `index.js`: Movido `UPDATE last_auto_close_run` después del commit de órdenes.
*   `index.js`: Generación de cash closing report (INSERT/UPDATE upsert) con totales, resumen y disparo de webhook al cierre automático.

### C. Efecto
El auto-close cierra órdenes, genera el reporte de caja, dispara el webhook de email y marca su ejecución. Todo robusto: si falla el marker, las órdenes ya están cerradas.

---

## 🎨 34. CashClosingHistoryScreen — Rediseño estilo FunkyFood

### A. Cambios
*   Reemplazada la tabla con scroll horizontal por un layout de lista/tarjetas estilo FunkyFood.
*   Contenedor `rounded-[40px]` con `divide-y divide-gray-800`.
*   Chip de sucursal estilo FunkyFood: `bg-gray-800 border-gray-700 rounded-lg text-gray-400`.
*   Columnas: **SERVICIOS** (hidden en mobile), **VENTAS** (ámbar), **CAJA** (esmeralda).
*   Subtítulo "REGISTRO CRONOLÓGICO DE CAJA".
*   Empty state con `StoreIcon`.
*   Ordenado por `report.date` (no por `createdAt`) para que los cierres se muestren por su fecha real.

---

## Archivos modificados en sesión (02/Julio/2026)

| Archivo | Cambio |
|---------|--------|
| `lib/utils.ts` | **Nuevo** — getLastDueDate, getDaysOverdue, getNextDueDate |
| `components/StartScreen.tsx` | PaymentInfo simplificado con getDaysOverdue |
| `components/PaymentControl.tsx` | Importa helpers desde lib/utils |
| `components/SalesProjectionsDashboard.tsx` | type="text" + inputMode + sanitize |
| `server/routes.js` | Auto-migration last_auto_close_run |
| `server/index.js` | Fix microsegundos, markRun try/catch, cash closing report + webhook |
| `components/CashClosingHistoryScreen.tsx` | Rediseño lista estilo FunkyFood, sort por date |
| `HANDOVER.md` | Esta actualización |
| `walkthrough.md` | Walkthrough actualizado |

---

## ⚡ 38. Heartbeat Sin Restricción + Ghosting Guard Eliminado + Server Heartbeat

### A. Heartbeat y Reconnect Sin Restricción
*   **Problema:** El heartbeat y la reconexión del socket tenían un guard `!activeOrderId` que impedía sincronizar datos si el mesero tenía una orden abierta. En la práctica, si alguien dejaba una orden abierta y cambiaba de dispositivo, no recibía actualizaciones hasta cerrarla.
*   **Solución:** Se eliminó la condición `!activeOrderId` tanto del heartbeat (`App.tsx`) como del refresco al reconectar. Ahora el sistema sincroniza datos en segundo plano aunque haya una orden activa siendo editada.

### B. Ghosting Guard Eliminado
*   **Problema:** El handler de `order_updated` tenía una protección (`isActiveEditing`) que ignoraba los items del socket si la orden era la que el usuario estaba editando. Esto prevenía datos obsoletos pero también impedía actualizaciones legítimas de otros dispositivos (ej: KDS marcaba items listos y no se reflejaban).
*   **Solución:** Se eliminó completamente el Ghosting Guard. Ahora el merge siempre toma los items del incoming si vienen poblados, y preserva los existentes solo si el incoming llega sin items. Más simple y predecible.

### C. ~~Server Heartbeat (Sync Forzado)~~ **REVERTIDO**
*   ~~**Problema:** Si no había cambios en `version.json` o eventos de socket, los clientes podían quedar desincronizados por minutos.~~
*   ~~**Solución:** Nuevo `setInterval` en `server/index.js` que emite `orders_updated` cada 30 segundos. Todos los clientes reciben este pulso y refrescan sus datos periódicamente.~~
*   **Revertido (13/Julio/2026):** Causaba parpadeo en la UI al refrescar data cada 30s en todos los clientes. El heartbeat del frontend cada 60s ya mantiene la sincronización en segundo plano sin afectar la UI.

### D. getLastDueDate Simplificado
*   **Problema:** `getLastDueDate` calculaba el vencimiento del mes anterior si la fecha actual aún no había alcanzado el día de pago del mes actual. Esto hacía que el banner de mora desapareciera al cambiar de mes.
*   **Solución:** Se simplificó para que siempre retorne el vencimiento del mes actual (el día de pago de este mes). El cálculo de mora ahora solo mira hacia atrás desde hoy.

## Archivos modificados en sesión (11/Julio/2026)

| Archivo | Cambio |
|---------|--------|
| `App.tsx` | Heartbeat: removido `!activeOrderId`. Reconnect: removido `!activeOrderIdRef`. Ghosting Guard eliminado del handler `order_updated`. |
| `lib/utils.ts` | `getLastDueDate` simplificado: siempre retorna vencimiento del mes actual. |
| `server/index.js` | ~~Nuevo server heartbeat: emite `orders_updated` cada 30s.~~ **REVERTIDO** — causaba parpadeo. |
| `HANDOVER.md` | Esta actualización |
| `walkthrough.md` | Walkthrough actualizado |

---

**Nota Final:**** El proyecto está en su punto más dulce. Si mueves el proyecto de PC: 
1. `npm install`
2. Configura el `.env` con la base de datos.
3. Corre las migraciones pendientes.
4. `npm run build` y ¡listo! 🚀🦾🌮🤜🤛
