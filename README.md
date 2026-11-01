# edificadoresonline-site

## Importar contenido mensual

Configura `.env` con `drive_id`, `account_json` (ruta al JSON de una cuenta de servicio con acceso de lectura a Drive), `cloudR2AccessKey`, `cloudR2SecretKey`, `cloudR2Bucket`, `r2_s3_API_URL`, `youtube_channel` y `youtube_api_key`. El archivo de la cuenta de servicio debe quedar fuera de Git. `R2_PUBLIC_URL` es opcional; por defecto se usa `https://downloads.edificadoresonline.com`.

```sh
npm run import:monthly -- --month=noviembre --action=refugio --year=2026 --doc='Descripción Web'
npm run import:monthly -- --month=octubre --action=predicas --year=2026
```

`--dry-run` descarga y comprime sin subir a R2 ni copiar imágenes. Cada ejecución deja un manifiesto y textos extraídos en `.monthly-import/<año>/<mes>/<acción>/`, excluidos de Git. Para `refugio`, el agente usa el documento descriptivo y el manifiesto para añadir una entrada a `src/data/discipulados.json`. Para `predicas`, el manifiesto de YouTube solo incluye transmisiones dominicales completas de los servicios de 7:00, 9:00 y 11:00 a. m. (hora de El Salvador). El agente coteja esos videos con fecha, hora y título del PDF antes de añadir el mes a `src/data/predicas/<año>/predicas_<año>.json`; los PDF de otros eventos no se incluyen en el JSON. Las imágenes encontradas quedan listadas en el manifiesto. Verifica los enlaces y ejecuta `npm run build` antes de publicar el cambio.
