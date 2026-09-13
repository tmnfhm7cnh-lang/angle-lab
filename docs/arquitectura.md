# angle-lab — arquitectura y plan

**Propuesta, pendiente de tu aprobación.** Escrito el 2026-09-13.

Análisis técnico y biomecánico sobre fotografía: puntos, ángulos, distancias y calibración a
unidades reales. Nace para las atletas de natación artística, pero se diseña genérico porque el
mismo trabajo sirve para calistenia, para tu cliente de personal y para ti.

---

## 0. La decisión de plataforma, y por qué

Pediste iOS nativo en Swift/SwiftUI. **No se puede construir aquí**, y conviene que quede escrito
por qué, porque no es una preferencia: es un hecho del entorno.

- Esta máquina es Windows. SwiftUI solo compila en macOS, con Xcode.
- Tu prompt exige *«después de cada fase: compilar, ejecutar tests, corregir errores»*, y el
  contrato del sistema dice *«no entregues código sin ejecutarlo»*. Escribir SwiftUI en Windows
  produce miles de líneas que nadie ha compilado nunca. Es exactamente el modo de fallo prohibido.
- Sin Mac y sin pagar, la única vía nativa es Swift Playgrounds en el iPad: no ejecuta tests
  unitarios, obliga a pasarte los archivos a mano por iCloud, y pone una versión usable en semanas.

Tú pediste **lo mejor y gratis, funcionando en el iPhone o el iPad lo antes posible**. Eso es una
**PWA**: la misma tecnología de `dryland-test-logger` y `wano-kuni`, que ya funcionan.

**Lo que NO se sacrifica**, y es la parte que importa de tu prompt: la separación estricta de capas,
el motor geométrico sin ninguna dependencia de la interfaz, los tests unitarios de verdad, la
precisión numérica y los ganchos para vídeo y detección automática. La arquitectura que pediste es
correcta y se respeta entera. Lo único que cambia es el lenguaje de la capa de presentación.

**Lo que sí se pierde, dicho sin adornos:** Apple Vision (`VNDetectHumanBodyPoseRequest`) da 19
landmarks anatómicos de una foto, gratis y sin descargar nada. En web, la Fase 2 necesitaría un
modelo de varios MB (MediaPipe o TensorFlow.js) con peor precisión. Si algún día la detección
automática se vuelve el corazón del proyecto, ese es el momento de portarlo — y el motor geométrico
se traduce a Swift casi línea a línea, porque está escrito sin tocar el navegador.

---

## 1. Capas

Regla de dependencia, estricta y en un solo sentido:

```
core  ──▶ (nada)
render ──▶ core
ui    ──▶ core, render
io    ──▶ core
```

`core` no sabe que existe un navegador. Ni `document`, ni `canvas`, ni `window`. Es lo que lo hace
testeable en esta máquina y portable a Swift el día que haga falta.

```
src/
  core/
    geometry.js       punto, distancia, ángulos, orientación     ✔ hecho
    units.js          mm · cm · m · in, y conversión entre ellas
    calibration.js    escala px ↔ mundo real
    model.js          AnalysisProject y entidades, serializable a JSON
    measurements.js   motor de medición: deriva valores del modelo
    viewport.js       transformaciones imagen ↔ vista (zoom, pan, rotación)
    hittest.js        qué elemento cae bajo un toque
  render/
    scene.js          orquesta el pintado
    overlays.js       puntos, segmentos, arcos, etiquetas
    exportImage.js    compone foto + capa en un PNG nuevo
  ui/
    gestures.js       pointer events, pinch-zoom, pan, Apple Pencil
    tools/            select · point · line · angle · distance · calibrate · text · delete
    panels.js         barra de herramientas y lista de mediciones
  io/
    imageSource.js    fototeca y cámara
    storage.js        IndexedDB
    projectFile.js    exportar / importar el análisis en .json
test/                 tests unitarios de todo lo que hay en core/
```

---

## 2. Sistema de coordenadas

El punto que más subrayaste, y con razón: es donde estas aplicaciones se rompen.

**Tres espacios distintos:**

| Espacio | Qué es | Quién lo usa |
|---|---|---|
| **Imagen** | Píxeles de la foto original. Origen arriba-izquierda, Y hacia abajo | **Todo el modelo, y solo él** |
| **Vista** | Píxeles CSS del contenedor en pantalla | Gestos y dibujo |
| **Dispositivo** | Vista × `devicePixelRatio` | Solo el renderizador |

La transformación es `{ scale, tx, ty, rotation }` — la rotación queda a 0 en el MVP, pero está en
la API desde el principio para no tener que reescribir nada cuando entre.

**El invariante que garantiza todo lo que pediste:** cada evento de puntero se convierte a
coordenadas de imagen **en el instante en que entra**, y a partir de ahí nadie vuelve a ver un píxel
de pantalla. Consecuencia: girar el iPad, pasar del iPhone al iPad, hacer zoom al 2000 % — nada de
eso puede mover un punto, porque el punto no está guardado en función de la pantalla.

**Un detalle pequeño con consecuencia grande, que tu prompt no menciona:** el radio con el que se
«agarra» un punto se define en **coordenadas de vista** (unos 22 px CSS, que es el tamaño real de una
yema), y se convierte a imagen dividiendo por `scale`. Si se definiera en coordenadas de imagen, con
zoom alto sería imposible acertar y con zoom bajo se agarrarían tres puntos a la vez.

---

## 3. Modelo de datos

```
AnalysisProject
  id · createdAt · updatedAt · schemaVersion
  subjectCode          'ATL-07' — nunca un nombre
  title · notes
  images[]             array desde el día 1, aunque el MVP use una sola
  activeImageId
  points[] · segments[] · measurements[] · annotations[]
  calibration

Point               id · imageId · x · y · label · source · landmark
Segment             id · aId · bId
AngleMeasurement    id · vertexId · aId · cId
DistanceMeasurement id · aId · bId
Calibration         id · imageId · aId · bId · realLength · unit
TextAnnotation      id · imageId · x · y · text
ImageReference      id · blobKey · width · height · exifOrientation · capturedAt
```

**La decisión que más consecuencias tiene: las mediciones no guardan su valor, solo referencias a
los puntos.** El número se calcula siempre que se pide.

Eso resuelve de un golpe tu requisito *«las mediciones deben actualizarse automáticamente cuando se
muevan los puntos»*: no hay nada que actualizar, porque no existe ninguna copia que pueda quedarse
vieja. La alternativa —guardar el ángulo calculado— es un bug latente esperando a que alguien mueva
un punto por un camino que no dispara el recálculo.

**Tres ganchos de futuro que hoy cuestan cero:**

- `imageId` en cada entidad → varias fotos, y luego frames de vídeo: un frame es una
  `ImageReference` con `videoId` y `frameIndex`. La Fase 3 no toca el modelo, lo extiende.
- `source: 'manual' | 'auto'` y `landmark` en `Point` → la Fase 2 convierte una detección
  automática en un punto normal, editable y borrable como cualquier otro. Nada más cambia.
- `schemaVersion` → migrar análisis viejos cuando el formato crezca.

---

## 4. Renderizado

Canvas 2D, dos capas con papeles distintos.

**Capa de foto.** Las fotos del iPhone son de 12 a 48 MP. Redibujar el original completo en cada
fotograma de un gesto de zoom va a tirones. Se mantiene una **copia reducida para la vista
interactiva**, y el **original solo se toca al exportar**. No se pierde precisión: los puntos viven
en coordenadas del original, la copia reducida solo afecta a lo que ves mientras arrastras.

**Capa de mediciones.** Se dibuja en coordenadas de vista, y aquí va una decisión deliberada: **los
elementos se transforman, pero no se escalan.** Un punto mide 8 px en pantalla con zoom 1× y con
zoom 20×. Si se escalaran, al ampliar para afinar la posición el propio punto taparía justo lo que
intentas medir — es decir, el zoom dejaría de servir para lo único que sirve.

**Legibilidad sobre foto deportiva:** doble trazo, halo oscuro debajo y trazo claro encima. Funciona
sobre bañador oscuro y sobre agua brillante sin tener que elegir color por foto.

**Lupa de precisión.** Al arrastrar un punto con el dedo, el dedo tapa el punto. Un recuadro flotante
con la zona ampliada y una cruz resuelve eso. **No es un adorno: sin ella la app no se puede usar con
el dedo**, solo con Pencil.

**Apple Pencil.** Pointer Events distingue `pointerType === 'pen'` y expone `getCoalescedEvents()`
para recoger las posiciones intermedias de un trazo rápido. Con Pencil se puede afinar más y la lupa
puede apagarse sola.

---

## 5. Persistencia

- **IndexedDB**, API nativa del navegador, sin ninguna librería. Las fotos como `Blob` en su propio
  almacén; los proyectos como JSON en otro.
- `localStorage` **no sirve**: tiene unos 5 MB y una sola foto de iPhone ocupa de 3 a 5.
- Sin servidor, sin cuentas y sin red, igual que `dryland-test-logger`.
- Guardado automático con retardo, para no escribir en cada píxel de un arrastre.
- El análisis se puede exportar como `.json` (sin la foto) y la imagen compuesta como PNG.

---

## 6. Privacidad — y aquí las atletas pueden ser menores

Esto es §8 del contrato, no un apartado de cortesía:

- **Ningún nombre en ningún campo.** No existe donde escribirlo. El análisis se identifica por
  `subjectCode`, con los mismos códigos `ATL-01` que ya usan las hojas y `dryland-test-logger`.
- **Todo se queda en el dispositivo.** Sin red. El service worker cachea la aplicación, jamás los
  datos.
- **El PNG exportado lleva el código, nunca un nombre.**
- **Ninguna foto de atleta entra en git, nunca.** Para desarrollar y probar uso imágenes sintéticas
  generadas aquí.
- **Aviso al exportar**, porque un PNG guardado en la fototeca sale del entorno controlado: iCloud lo
  sincroniza. Que la decisión de exportar sea consciente.

---

## 7. Precisión

- Todo en coma flotante de 64 bits, que es lo nativo en JavaScript. **Cero redondeo interno.**
- Se redondea **solo al mostrar**: `127.43892…°` se enseña como `127.4°`.
- **Corrección a tu prompt:** pediste calcular el ángulo con producto escalar y `arccos`. La fórmula
  `acos(dot / (|u|·|v|))` **pierde casi toda su precisión cerca de 0° y de 180°**, porque su
  argumento se satura en ±1. Se usa `atan2(|cross|, dot)`, que es estable en todo el rango y da el
  mismo resultado donde `acos` funciona bien. Importa precisamente aquí: una pierna casi estirada es
  un ángulo cercano a 180°, y es de las medidas que más vas a tomar.
- La calibración guarda **la longitud real y la longitud en píxeles por separado**, no solo su
  cociente, para poder recalcular la escala si mueves un extremo de la referencia.
- El zoom nunca toca el modelo.

---

## 8. Plan por fases

Cada fase termina ejecutando los tests y dejando algo que funciona.

| Fase | Qué entra | Se puede probar |
|---|---|---|
| **F0** ✔ | Motor geométrico: distancias, ángulos, orientación, hit-test | **Hecho. 49 tests en verde** |
| **F1** | Unidades, calibración y sistema de coordenadas | Tests aquí |
| **F2** | Modelo de datos y motor de medición | Tests aquí |
| **F3** | Lienzo: cargar foto, zoom, pan | **Primera vez que ves algo** |
| **F4** | Puntos: crear, seleccionar, mover, borrar. Con lupa | En el iPhone |
| **F5** | Segmentos, ángulos y distancias, con su dibujo | **Aquí ya sirve para trabajar** |
| **F6** | Calibración en la interfaz y distancias reales | En el iPhone |
| **F7** | Texto, guardar en IndexedDB, exportar PNG | En el iPhone |
| **F8** | Instalable en la pantalla de inicio y publicada | En el iPhone |

**Corte recomendado: F5.** En F5 ya puedes abrir la foto de un espagat, poner tres puntos y leer el
ángulo. Sin calibración, sin guardar y sin exportar, pero **resuelve el problema que te hizo pedir la
app**. De F6 a F8 es lo que la convierte en herramienta de trabajo en vez de instrumento de consulta.

**Estimación honesta:** de nueve a once sesiones de trabajo. Con natación artística los martes,
Albufeira el 16 de octubre y 2 h/día para todo, eso son **unas tres semanas si le dedicas tiempo
seguido**, no una semana. El corte de F5 cae sobre la quinta o sexta sesión.

---

## 9. Lo que NO entra en el MVP

Dicho para que no se cuele después sin darse cuenta:

- Vídeo, timeline, frames (tu Fase 3).
- Detección automática de personas (tu Fase 2).
- Seguimiento de puntos (tu Fase 4).
- ROM, velocidad angular, comparación entre intentos (tu Fase 5).
- Varias fotos por análisis: el **modelo lo soporta**, la interfaz del MVP no lo expone.
- Rotación de la imagen: la **transformación lo soporta**, el MVP la deja en 0.

---

## 10. Decisiones pendientes de Daniel

1. **¿Corte en F5?** ¿Te vale empezar a usarla midiendo ángulos, sin guardar ni exportar todavía?
2. **¿El nombre `angle-lab`?** En inglés por la regla del frente, y genérico a propósito.
3. **¿Repositorio público aparte para publicarla**, como `dryland-test-logger`? GitHub Pages solo es
   gratis desde repositorio público, y `sistema-claude` es privado.
