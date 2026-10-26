# Link in bio

Mi página de enlaces para la bio de Instagram y TikTok: foto, nombre, mis redes con el número de
seguidores (se actualiza solo) y un botón de contacto por email. Es HTML, CSS y JS sin nada que
instalar: se abre `index.html` y funciona.

## Pendiente antes de publicar

| Qué | Dónde |
| --- | --- |
| Imagen para compartir | `index.html`: la etiqueta `og:image` comentada, cuando haya dirección web |

La foto es `img/foto.jpg`: 640×640, recortada de tu foto de perfil y con negro fuera del círculo,
para que sirva también de icono en el iPhone. Para cambiarla, otra cuadrada con el mismo nombre.

El nombre (Miguel Guerrero) está en el `<h1>`, el `<title>`, las etiquetas `og:` y el pie. Las cuentas
son @mm_guerreroo en TikTok e Instagram y @MM_GUERREROO en YouTube (los 6 enlaces de `index.html`).

**De momento la página va sin cifras de seguidores** (decisión del 24/10/2026). El sistema
automático está hecho, pero apagado: no se activa hasta que lo decidas.

El email (`mguem10@gmail.com`) ya está puesto en `app.js`, en `CONTACTO`.

## Ver cómo queda en el móvil

Abre `vista-movil.html` en el PC. Muestra la página dentro de un móvil, por defecto con la barra
del navegador de Instagram, que es como la ve quien toca el enlace de la bio. Arriba se elige el modelo
(iPhone 15, iPhone SE, Pro Max, Android), el tema (**Como el PC**, **Claro** u **Oscuro**), se quita
o se pone la barra de Instagram y se recarga para volver a ver la animación de entrada. Tras cambiar
`index.html`, pulsa **Recargar**.

La página cabe entera sin scroll en todos esos modelos, también dentro de Instagram. En los más bajos
(iPhone SE) se esconden la fila de iconos y el pie.

Es solo una herramienta para ti: no se publica.

## Seguidores automáticos

La web es estática, así que no puede guardar contraseñas. Las cifras las trae **GitHub** cada 6 horas
con las APIs oficiales de cada red y las escribe en `stats.js`, que la página lee al cargar. La misma
tarea publica la web en GitHub Pages.

```
GitHub Actions (cada 6 h) ──► YouTube Data API      ─┐
  scripts/actualizar-        ► Instagram API         ├─► stats.js ──► la página
  seguidores.mjs             ► TikTok Display API   ─┘
```

- Las cifras no se escriben a mano en ningún sitio. Si una red aún no está conectada, su botón sale
  sin número.
- Si una red falla (por ejemplo, un token caducado), se queda la última cifra buena y GitHub te avisa
  por email.
- Los tokens de Instagram y TikTok se guardan **cifrados** en `datos/tokens.enc`. La clave que los
  abre (`STATE_KEY`) está en tu `.env` y en los secrets de GitHub, nunca en el repositorio.

### 1. Publicar en GitHub (hecho el 24/10/2026)

La web vive en **https://mmguerreroo.github.io/**. El repositorio es `mmguerreroo/mmguerreroo.github.io`
(público, dentro de la organización gratuita `mmguerreroo`). Cada vez que se sube un cambio a `main`,
GitHub la vuelve a publicar en un minuto. Pages tiene que estar en **Settings → Pages → Source:
GitHub Actions**.

### 2. YouTube

1. Pon tu canal en el botón de YouTube de `index.html` (`youtube.com/@tucanal`).
2. La clave de la API ya está en `.env` (`YT_API_KEY`, la misma de Kontent). Compruébalo con
   `node scripts/conectar.mjs youtube`.

### 3. Instagram (cuenta profesional)

1. En tu app de Meta (la misma que necesita Kontent): **Instagram → API setup with Instagram login →
   Generate token** con tu cuenta.
2. Ejecuta `node scripts/conectar.mjs instagram` y pega el token. La primera vez se crea `STATE_KEY`
   en `.env`.
3. El token dura 60 días, pero la tarea lo renueva cada semana, así que no caduca.

### 4. TikTok

1. En developers.tiktok.com: **Manage apps → Connect an app**. Añade el producto **Login Kit** con los
   permisos `user.info.basic` y `user.info.stats`, y como *Redirect URI* la dirección de tu web
   (`https://mmguerreroo.github.io/`).
2. Crea un **Sandbox** y añade tu cuenta de TikTok como *target user*. Así funciona sin pasar la
   revisión de TikTok. Si el sandbox no diera el número de seguidores, habría que enviar la app a
   revisión.
3. Copia `.env.example` a `.env` si no existe y rellena `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` y
   `TIKTOK_REDIRECT_URI`.
4. Ejecuta `node scripts/conectar.mjs tiktok`, abre el enlace, acepta, copia la dirección a la que
   vuelves y ejecuta `node scripts/conectar.mjs tiktok "LA-DIRECCIÓN"`.
5. TikTok obliga a reconectar una vez al año; el script te dice la fecha.

### 5. Secrets y primera ejecución

1. En el repositorio: **Settings → Secrets and variables → Actions → New repository secret**, con
   los valores de tu `.env`: `STATE_KEY`, `YT_API_KEY`, `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET`.
2. Sube `datos/tokens.enc` al repositorio.
3. En **Actions → Publicar y actualizar seguidores → Run workflow** lánzala a mano y mira que cada red
   diga su cifra.

`node scripts/conectar.mjs` sin nada más te dice qué está conectado.

## Cómo funciona la página

- **Botones vivos:** al tocar (o al pasar el ratón) cada botón se llena con el color de su red desde
  el punto donde está el dedo. Al cargar, se encienden una vez en cascada y los contadores suben
  desde cero.
- **Contacta conmigo:** abre una hoja con el email y tres opciones: la app de correo, Gmail en la web
  (por si el navegador de Instagram no abre la app) o copiar la dirección. El email no aparece en el
  HTML para que no lo recojan los robots de spam.
- **Compartir** (arriba a la derecha): el menú de compartir del móvil, o copia el enlace en PC.
- Móvil primero; a partir de 960 px de ancho se pone en dos columnas.
- **Tema claro u oscuro según el visitante:** sigue el modo de su móvil u ordenador. En oscuro es
  negra con "Contacta conmigo" blanco; en claro, blanca con "Contacta conmigo" negro y el logo de
  TikTok en negro. Los colores están en las variables de `styles.css` (`:root` es el oscuro; la
  paleta clara va justo debajo, escrita dos veces). `index.html?tema=claro` u `?tema=oscuro` fuerza
  uno de los dos; lo usa la vista móvil.
- La tipografía (Bricolage Grotesque, licencia OFL) va dentro de `fonts/` para que cargue rápido y no
  dependa de Google.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `index.html`, `styles.css`, `app.js`, `fonts/`, `img/`, `favicon.svg` | La página |
| `stats.js` | Las cifras de seguidores; lo escribe GitHub, no se toca a mano |
| `scripts/actualizar-seguidores.mjs` | Trae las cifras (lo ejecuta GitHub cada 6 h) |
| `scripts/conectar.mjs` | Conecta Instagram y TikTok desde el PC |
| `scripts/lib.mjs` | Lo que comparten los dos scripts: APIs y cifrado |
| `.github/workflows/publicar.yml` | La tarea de GitHub: cifras + publicar |
| `datos/tokens.enc` | Tokens cifrados (aparece al conectar Instagram o TikTok) |
| `.env` | Tus claves; **no se sube** (`.gitignore`) |
| `vista-movil.html` | La vista de móvil para probar; no se publica |
