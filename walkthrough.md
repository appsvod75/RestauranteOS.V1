# Walkthrough

## "Local" renombrado a "Restaurante" en toda la UI
- En el wizard de nuevo pedido, el botón ahora dice **Restaurante** en vez de Local.
- En la lista de pedidos, el header de grupo dice **RESTAURANTE** (último en el orden).
- En tabs de móvil/pantallas de completados: **RESTAURANTE**.
- En KDS, tickets, modal de auditoría, resumen diario: **Restaurante**.
- **Orden de grupos:** Cliente Retira → Delivery → Para Llevar → Restaurante.

## Contadores por tipo de servicio
- Cada chip de grupo tiene una pill idéntica al lado con la cantidad `(n)` de órdenes de ese tipo (fuera del chip).

## Search más pequeño + TOTAL a la derecha
- El input de búsqueda ahora es más compacto (`py-2`, `text-xs`, placeholder `BUSCAR...`).
- A su derecha, un badge **TOTAL: N** muestra la cantidad total de servicios del día sin filtrar.

## Timezone El Salvador (UTC-6) forzado en todos los endpoints
- `PUT /orders` y Auto-close ahora también setean `SET time_zone = '-06:00'` antes de usar `NOW()`.
- Todas las fechas se guardan y leen en hora local de El Salvador.

## Gestión de Usuarios — Desactivar y filtrar inactivos
- **Admin > Usuarios:** Al editar un usuario, el toggle Activo/Inactivo permite desactivarlo sin eliminarlo.
- **Filtro visual:** Al desactivar, el usuario desaparece de la lista. Un botón de ojito (`EyeIcon`) a la derecha del buscador permite mostrar/ocultar los usuarios desactivados.
- **Server:** `GET /initial-data` ahora retorna **todos** los usuarios (antes solo `is_active = 1`).

## Filtro de órdenes no pagadas
- **Pantalla principal de pedidos:** Nuevo botón `CreditCardIcon` al lado izquierdo del botón de IA (RobotIcon).
- Al activarlo, filtra la lista para mostrar solo órdenes **no pagadas** (`status !== 'completed'`).
- El botón se ilumina en ámbar cuando el filtro está activo.

## CashOpeningModal — Diseño y flash fix
- Botones "Ignorar" (rojo) y "No recordar" (azul) lado a lado debajo de "Registrar Apertura" (ámbar).
- Fecha actual agregada debajo del nombre de sucursal.
- `cashDataLoadedRef` evita que el modal se muestre antes de que los datos estén listos.

## Botón "Aperturar Caja" como grid item
- Cambiado de barra full-width a un item del grid con clase `grid-item`, mismo tamaño que los demás.
- Pulso ámbar con `CashRegisterIcon` + `PlusIcon` como badge.

## KDS — Flame icon + PIN en delete
- Botón de eliminar ticket en KDS ahora muestra `TrashIcon` + `FlameIcon` (llama) cuando el ticket está `in_process`.
- Al presionar, abre `PinVerificationModal` para confirmar.

## Prioridad de palomita (paid) sobre estado de cocina
- En `StartScreen.tsx` y `ActiveOrdersMobileScreen.tsx`, el `CheckIcon` (palomita) siempre se muestra si `isPaid` o `status === 'completed'`, sin importar el estado de cocina.

## Auto-update system
- `scripts/bump-version.js` — corre en prebuild, estampa versión y timestamp en `dist/version.json`.
- `lib/appUpdate.ts` — lógica central: `checkAndApplyUpdate`, `initAppVersionSync`, `applyAppUpdate`.
- **Overlay:** Al aplicar actualización, muestra "Actualización en curso" con spinner ámbar sobre fondo oscuro (reemplaza `document.body.innerHTML`).
- **Server:** `server/index.js` observa cambios en `dist/version.json` con debounce de 15s (para esperar subida completa por FileZilla) y broadcast vía socket. Fallback polling cada 30s.
- **Recarga:** Usa `window.location.reload()` con limpieza de caché y unregister de Service Worker.

## CashClosingScreen — Modal de auditoría por método de pago
- Cada método de pago en el resumen tiene un icono `ClipboardListIcon` que abre un modal.
- El modal muestra órdenes: #, hora, mesero, tipo, monto y total.
- El resumen ahora muestra el monto neto (resta el cambio) que coincide con el modal.

## Calendarios en Config. Maestra — Estilo ámbar
- Los inputs `type="date"` en la sección "Borrar Ventas" usan un SVG inline de calendario en color ámbar (`#fbbf24`) como icono del picker.

## Customer Search Ordenado por Relevancia
- Al buscar un cliente, ahora aparecen primero las coincidencias exactas, luego empiezan con, luego contienen.
- Ej: buscar "ANA" → "ANA" primero, luego "ANA MARIA", luego "JOHAN", "HANA".

## Verificación Previa al Borrado (Clear-data con check)
- En Config. Maestra > Limpiar Ventas con fechas, primero verifica cuántas órdenes hay en ese rango.
- Si count === 0: toast rojo, no abre modal.
- Si count > 0: modal con "BORRARÁS N VENTAS DEL X AL X".

## Backup de Base de Datos
- Botón "Descargar Backup" en Config. Maestra > Mantenimiento (verde esmeralda).
- Pide PIN de SuperAdmin, genera un .sql con `mysqldump` y lo descarga al navegador.
- También se guarda una copia en `backups/` del proyecto en el VPS.

## Delivery Fee Auto-select
- Al tocar el input de "COSTO ENVÍO", se selecciona todo el valor automáticamente.
- Solo escribís el nuevo número sin borrar manualmente.

## Resumen del Día — Todas las Órdenes
- Ahora muestra órdenes activas (no pagadas) y completadas.
- Se actualiza por socket en tiempo real.

## PaymentModal — Fix isCashOnlyPayment
- `isCashOnlyPayment` usaba `payments.every()` que en array vacío retorna `true`.
- Ahora revisa `currentPaymentMethod !== PaymentMethod.Cash` directamente.
- Si el método no es Efectivo y el monto excede el total, muestra toast.error y bloquea.

## PaymentModal — z-index, toast, doble clic
- El modal tiene `z-[300]` para no quedar detrás de otros modales.
- El bloqueo de sobrepago no cash usa `toast.error` en vez de `alert()`.
- Botón COBRAR tiene guardia de doble clic con useRef.

## CashClosing — Banner de Discrepancias
- Muestra diferencia entre total de pagos recibidos vs total de órdenes.
- Por cada orden con diferencia: #orden, métodos de pago y montos.

## SalesProjectionsDashboard — Scroll en Móvil
- Vistas `list` y `create_config` ahora tienen `overflow-y-auto` para scrollear en móvil.

## Auditoría — Username en Razón de Borrado
- Al borrar un item, el log de auditoría dice `Eliminado por: {username}` en vez de `Eliminado por el usuario`.

## sendTicket.gs — RESTAURANTE
- Línea 87 corregida para mostrar RESTAURANTE en vez de LOCAL.

## Indicador de Conexión en Header
- Barrita ámbar debajo del header cuando el socket se desconecta por más de 3s.
- Sin botón para cerrar — desaparece sola al reconectar.
- Texto: "SIN CONEXIÓN · Reconectando..." con punto pulsante.

## Reintentos estilo FunkyFood (3 intentos × 3s/6s/9s)
- Cualquier error en fetchAllData se reintenta 3 veces antes de actuar.
- Si el server se recupera en ~9s, el usuario no nota nada.
- Alineado con FunkyFood que nunca presentaba este bug.

## Toast RECARGAR en vez de reload forzoso
- Cuando fallan los 3 reintentos y es error de assets, aparece toast ámbar con "RECARGAR".
- No se pierde la orden ni la sesión.
- Si el heartbeat siguiente tiene éxito, el toast se cierra solo.
- NotificationToast ahora soporta botón personalizado (actionLabel/onAction).

## Nginx devuelve JSON en errores 502/503/504
- Config agregada en `/etc/nginx/sites-available/restaurant`.
- Así nunca llega HTML a la app y no se activa el falso asset error.

## Sistema de Control de Pago (Renta de App)
- **Admin > Control de Pago** (SuperAdmin + PIN): configura día de pago (1-31), días de gracia (0-30) y toggle Pendiente/Pagada.
- **Auto Pendiente:** 5 días antes del vencimiento, el sistema marca automáticamente PENDIENTE. Si el admin lo pone PAGADA, no lo revierte aunque la fecha haya pasado.
- **Banner en pedidos:** Si está PENDIENTE y la fecha de pago ya venció:
  - Día 1 a N (grace): banner ámbar `⚠️ USO DE APLICACIÓN CON X DÍAS DE MORA...`
  - Día N+1+: banner rojo `🚫 CREACIÓN DE ÓRDENES DESACTIVADA...` + botón `+` desactivado.
- **Próximo vencimiento:** Se calcula automáticamente cada mes según el día configurado (ej: día 1 = cada 1ro). No requiere actualización manual.
- **Drag-to-scroll:** La vista usa drag-to-scroll sin scrollbar visible.

## Verificación
1. **Desactivar usuario:** Admin > Usuarios > editar > toggle desactivar > guardar. Debe desaparecer de la lista. Ojito para verlo.
2. **Filtro no pagados:** En pedidos, tocar botón de tarjeta (junto a IA). Deben ocultarse las órdenes pagadas.
3. **Auto-update:** Subir nuevo `dist/` al VPS. En <= 30s debe aparecer "Actualización en curso" y recargar.
4. **KDS flame:** Ticket en proceso debe mostrar llama al lado del trash.
5. **Auditoría:** En cierre de caja, tocar icono de lista junto a cada método de pago.
6. **CashOpening:** Al iniciar turno sin apertura registrada, debe aparecer el modal con botones.
7. **Calendarios:** En Config. Maestra > Borrar Ventas, el icono del date picker debe verse ámbar.
8. **Restaurante vs Local:** Ir a nuevo pedido, el primer botón dice "Restaurante". En la lista, los grupos aparecen en orden: Cliente Retira → Delivery → Para Llevar → Restaurante, cada uno con su contador.
9. **TOTAL + Search:** El search es más pequeño, a su derecha hay un badge "TOTAL: N".
10. **Timezone:** Crear una orden, marcarla como lista y completarla. Verificar en DB que `created_at`, `ready_at` y `completed_at` estén en hora El Salvador (UTC-6).
11. **Customer search:** Buscar "ANA" debe mostrar "ANA" primero, no "JOHAN" o "HANA".
12. **Backup:** Config. Maestra > Descargar Backup, ingresar PIN, debe descargar .sql.
13. **Delivery fee:** En orden Delivery, tocar el input de costo envío — se selecciona todo.
14. **Resumen del Día:** Debe mostrar órdenes activas (no pagadas) y completadas juntas.
15. **PaymentModal overpay:** Orden de $4.75, seleccionar Transfer, meter $5 — debe mostrar toast.error y no dejar agregar. Con Efectivo sí debe dejar y mostrar cambio.
16. **PaymentModal z-index:** Abrir PaymentModal y otro modal encima — PaymentModal debe quedar visible (z-[300]).
17. **Auditoría username:** Borrar un item de orden, revisar log de auditoría — debe decir "Eliminado por: {username}".
18. **Scroll móvil:** En SalesProjectionsDashboard, vista create_config con muchos campos — debe poder scrollear para ver botón Guardar.
19. **Discrepancy banner:** En CashClosing, si una orden tiene diferencia entre pagos y total, debe aparecer banner con detalle.
20. **Indicador de conexión:** Desconectar el internet del teléfono — debe aparecer barrita ámbar "SIN CONEXIÓN · Reconectando..." debajo del header, sin botón para cerrar. Al reconectar, debe desaparecer sola.
21. **Toast RECARGAR:** Bloquear el server (pm2 stop all) — después de ~9s debe aparecer toast ámbar "ERROR DE CARGA" con botón "RECARGAR". Al tocar RECARGAR, recarga la página sin perder órdenes locales.
22. **Recuperación automática:** Estando con el toast visible, iniciar el server de nuevo (pm2 restart all) — el próximo heartbeat debe cerrar el toast solo y sincronizar datos.
23. **Control de Pago:** Admin > Control de Pago (pide PIN). Setear día 15, grace 3, PENDIENTE, guardar. Volver a pedidos — debe mostrar banner ámbar. Cambiar a PAGADA, guardar — banner desaparece. Cerrar sesión y volver — debe seguir PAGADA.
24. **Días de gracia:** Con day=15, grace=5, PENDIENTE, día 20 (día 5 de mora) — banner ámbar aún visible. Día 21 (día 6) — banner rojo + botón + desactivado.
25. **Auto-set automático:** Con day=15 (hoy 10), PENDIENTE → PAGADA. El día 10 (5 días antes del 15) el server auto-marca PENDIENTE. Verificar al recargar app.
26. **Drag-to-scroll:** En Control de Pago, arrastrar con mouse para scrollear — sin scrollbar visible.
27. **Transferencia con exceso:** En PaymentModal, seleccionar Transfer y pagar más del total — debe mostrar "Para Otros: $X" en púrpura. En la línea de pago debe aparecer `($X otros)`.
28. **Transfer Otros:** En PaymentModal, debe aparecer botón "Transfer Otros". Pagar con este método — el monto completo va a "Transfer. Otros".
29. **CashClosing desglose:** En Cierre de Caja, debe mostrar "Transfer. Propias" y "Transfer. Otros" como líneas separadas. "Transfer. Otros" no debe estar incluido en el total audit de Transfer. Propias.
30. **Ticket cierre:** En el ticket de cierre, Transfer. Otros debe aparecer en gris abajo del desglose.

## Banner de Mora Persistente
- El cálculo de mora ahora usa `getDaysOverdue()` desde `lib/utils.ts` que compara contra el último vencimiento, no contra la fecha actual. El banner no desaparece al cambiar de mes.
- Verificar: Con day=15, PENDIENTE, si hoy es 5 del mes siguiente — el banner aún debe mostrar los días de mora acumulados.

## SalesProjections — Números sin Truncar
- Los inputs ya no son `type="number"`, son `type="text"` con `inputMode`.
- Verificar: Escribir `25000` en una meta de proyección. Guardar. Al recargar debe mostrar `25000`, no `25`.

## Auto-Close — Reporte de Caja Automático
- El auto-close ahora genera automáticamente el cash closing report al cerrar las órdenes del día.
- Verificar: Esperar el auto-close (23:30) o forzarlo con `UPDATE branches SET last_auto_close_run = NULL WHERE auto_close_enabled = 1`. Revisar en Historial de Cierres que aparezca el reporte con datos correctos.

## CashClosingHistoryScreen — Rediseño Lista
- Ahora es una lista vertical estilo FunkyFood (sin tabla, sin scroll horizontal).
- Columnas: SERVICIOS, VENTAS (ámbar), CAJA (esmeralda).
- Chip de sucursal en badge gris con borde.
- Ordenado por fecha del cierre (date), no por fecha de creación.
- Verificar: Actualizar un cierre del día 26 hoy. Debe aparecer entre el 25 y el 27, no hasta arriba.

## Customer Portal (Menú Digital para Clientes)
- Portal público de solo lectura accesible en `/{origin}/menu`, `/?view=menu` o `/portal`.
- Muestra productos con fotos, descripciones, precios y filtro por categorías.
- No requiere login — cualquier cliente con el link puede verlo.
- **Campos nuevos en productos:** `Descripción` (textarea) y `URL de Imagen` en el editor de Admin > Productos.
- **Verificar:** Ir a `https://tudominio.com/menu` — debe mostrar el menú con productos activos, fotos y descripciones. El modal de detalle debe abrirse al tocar un producto.

## QR Code del Menú Digital
- Nueva sección en **Config. Maestra > Menú Digital (Código QR)** con QR generado dinámicamente.
- Botón "Descargar QR para imprimir" — descarga PNG del QR con tamaño Ultra-HD.
- **Verificar:** Abrir Config. Maestra, debe verse el QR apuntando a `{origin}/menu`. Descargar y escanear — debe abrir el portal.

## Compartir Menú desde Órdenes
- Dos botones nuevos en el header de la pantalla de pedidos (junto a los filtros):
  - **Icono QR** (ámbar) — comparte el link del menú digital.
  - **Icono Share** (verde) — comparte el link del menú digital.
- En móvil usa `navigator.share()` (share sheet nativo). En desktop copia al portapapeles con toast de confirmación.
- Accesible para meseros, cajeros, admins — cualquier rol en la vista de órdenes.
- **Verificar:** Tocar el botón QR o Share en la pantalla de pedidos. En móvil debe abrir el share sheet. En desktop debe copiar el link y mostrar toast "ENLACE DEL MENÚ DIGITAL COPIADO".

## Heartbeat Sin Restricción
- El heartbeat y la reconexión ahora funcionan aunque haya una orden activa abierta.
- **Verificar:** Abrir una orden en el POS (OrderScreen). Esperar heartbeat (1 min). Debe ejecutarse `fetchAllData` sin importar que haya una orden activa. También desconectar y reconectar el socket — debe refrescar datos automáticamente.

## Ghosting Guard Eliminado
- El handler de `order_updated` ya no ignora los items del socket cuando la orden está siendo editada.
- **Verificar:** En un dispositivo KDS, marcar un item como listo. En el POS, con esa misma orden abierta, debe verse el cambio en tiempo real (antes se ignoraba si la orden estaba siendo editada).

## ~~Server Heartbeat 30s~~ **REVERTIDO**
- ~~El servidor emite `orders_updated` cada 30 segundos para mantener sincronizados todos los clientes.~~
- **Revertido (13/Julio/2026):** Causaba parpadeo en la UI. El heartbeat del frontend (60s) es suficiente.

## Banner de Mora Persistente
- El cálculo de mora ahora usa el vencimiento del mes actual únicamente. El banner no desaparece al cambiar de mes.
- **Verificar:** Configurar día de pago 15, PENDIENTE. Si hoy es 5 del mes siguiente — el banner debe seguir mostrando los días de mora acumulados (antes desaparecía porque `getLastDueDate` se iba al mes anterior).

> [!IMPORTANT]
> Tras cambios en `server/`, reiniciar PM2. Para cambios en frontend, `npm run build` y subir `dist/`.
