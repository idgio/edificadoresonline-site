# Trabajo mensual de Predicas y Discipulado

Cuando el usuario pida actualizar contenido de un mes, usa este flujo. Puede pedir meses distintos para Predicas y Discipulado; resuélvelos por separado. Lee primero `README.md` y el estado actual de Git. Conserva los cambios ajenos al trabajo.

## Fuentes y preparación

- Las carpetas de Google Drive cuelgan de `drive_id` y llevan nombres de meses en español. `REFUGIO` o `Refugios` en Drive corresponde a Discipulado en el sitio.
- El importador es `npm run import:monthly -- --month=<mes> --action=refugio|predicas --year=<año>`. Para Refugio, `--doc='Descripción Web'` selecciona el documento descriptivo; cambia ese parámetro si el nombre real difiere.
- Las credenciales están en `.env`; `account_json` apunta al archivo de la cuenta de servicio de Google. Nunca muestres valores secretos ni añadas `.env`, la clave JSON o `.monthly-import/` a Git.
- El importador descarga y comprime PDF, convierte imágenes, convierte PPTX de Predicas a PDF cuando aparecen, y sube los PDF a R2. Al repetir el mismo mes, reutiliza las rutas existentes en R2. Su manifiesto y los textos extraídos quedan en `.monthly-import/<año>/<mes>/<acción>/`.

## Discipulado

- Usa el documento descriptivo, la portada y los dos PDF del manifiesto para añadir exactamente una entrada del mes a `src/data/discipulados.json`. Extrae el enlace de YouTube del documento y comprueba las URLs y la imagen.
- Mantén la estructura y el tono de las entradas existentes. Verifica con `npm run build`. La entrega habitual es un commit en `main`.

## Predicas

- Actualiza `src/data/predicas/<año>/predicas_<año>.json` con un elemento del mes. Debe tener una entrada por cada combinación de domingo del mes y servicio de `7:00 am`, `9:00 am` y `11:00 am`: total = domingos × 3.
- Usa solo streams dominicales de esos tres servicios, en la zona `America/El_Salvador`. Excluye eventos entre semana y servicios de las 5:00. Empareja cada PDF o PPTX convertido con el video usando fecha, horario, título, predicador y contenido; no inventes correspondencias. Si falta un video público, conserva la entrada con `youtube_url: null` y repórtalo.
- Incluye `service` en cada entrada nueva. Reutiliza imágenes existentes si Drive no aporta nuevas. Ejecuta `npm run validate:predicas -- --year=<año> --month=<mes>` y `npm run build`; resuelve cualquier hueco o duplicado de fecha y servicio antes de entregar.
- La entrega habitual es una rama y un PR contra `main`. Actualiza `deployment` solo si el usuario lo pide.

En el resumen final, indica los meses procesados, el total de Predicas frente a domingos × 3, enlaces de YouTube pendientes, resultado de las verificaciones y el commit o PR creado.
