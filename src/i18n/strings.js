/**
 * LOTE 5 §5 of the prompt maestro: angle-lab's own UI chrome, bilingual (en/es) — decided
 * 2026-09-29 with Daniel: a real selector, not a one-shot translation, because he wants this app
 * sellable outside Spain too. `{token}` substitution is the same convention
 * dryland-test-logger's own `t()` already uses (catalog.js) — same idea, kept as a separate
 * implementation on purpose, same reason the two apps' bundles are independent (LOTE 3 §1).
 *
 * NOT in here yet, and deliberately left for its own slice: the battery's own vocabulary —
 * guide/landmark labels (export/guides.js) and test/metric labels (export/catalogRef.js), e.g.
 * "Bridge (puente)" or "Shoulder". Those are content (AQUAMAD's own naming, mirrored from
 * dryland-test-logger), not app chrome, and translating them means touching the files a
 * commercial build without AQUAMAD's battery would swap out entirely — see ESTADO.md.
 */

const LANG_STORAGE_KEY = 'angle-lab/lang';

const STRINGS = {
  en: {
    pageTitle: 'angle-lab',
    libraryButton: 'Library',
    cameraButton: 'Camera',
    fitButton: 'Fit to screen',
    deleteSelectedButton: 'Delete selected',
    protocolButton: 'Protocol',
    guideButton: 'Guides',
    historyButton: 'History',
    exportButton: 'Export',
    newProjectButton: 'New project',
    langButton: 'ES',
    closeButton: 'Close',
    deleteButton: 'Delete',

    wordZoom: 'Zoom',
    wordAngle: 'Angle',
    wordDistance: 'Distance',
    toolCalibrate: 'Calibrate',
    calibrationLengthLabel: 'Reference length',
    calibrationConfirm: 'Calibrate',
    calibrationCancel: 'Cancel',
    calibrationErrorInvalid: 'Enter a number greater than 0.',
    calibrationErrorTooClose: 'The two reference points are too close together — pick two points further apart.',
    clearCalibrationButton: 'Clear calibration',
    displayUnitLabel: 'Display unit',
    scaleUncalibrated: 'uncalibrated',
    scaleValue: '{value} mm/px',
    calibrationRefLabel: 'ref {value}',

    qualityGood: 'good',
    qualityOk: 'ok',
    qualityPoor: 'poor',
    uncalibratedSuffix: 'uncalibrated',

    disclaimerShort: 'Angles are <strong>projected</strong>: camera perpendicular to the gesture',

    emptyStep1: 'Open a photo',
    emptyStep2: 'Tap the joints',
    emptyStep3: 'Read the angle',
    emptyTrust: 'Photos never leave this device.',
    openPhotoLabel: 'Open photo',
    takePhotoLabel: 'Take photo',

    toolGroupLabel: 'Tool',
    toolSelect: 'Move',
    toolPoint: 'Point',
    toolLine: 'Line',
    toolAngle: 'Angle',
    toolDistance: 'Distance',
    toolRepeat: 'Precision test',

    protocolTitle1: 'Capture protocol',
    protocolBullet1:
      'Camera <strong>perpendicular</strong> to the plane of the gesture being measured — a tilted plane biases every angle by up to several degrees and shortens every length.',
    protocolBullet2:
      "Put the calibration reference <strong>in that same plane</strong>, at the subject's distance from the camera, not closer or farther.",
    protocolBullet3:
      'Keep a reasonable <strong>minimum distance</strong> from the subject — close-up shots exaggerate perspective error.',
    protocolBullet4:
      'Avoid the <strong>wide-angle</strong> lens/zoom level — wide angle increases perspective distortion at the frame edges.',
    protocolTitle2: "What this measures, and what it doesn't",
    protocolIntro:
      'angle-lab reads a <strong>projected</strong> angle and a <strong>scaled</strong> length off a single 2D photo. It does not reconstruct 3D geometry. Following the protocol above keeps the projection error small; it cannot remove it.',
    protocolBullet5:
      "<strong>Angles</strong> are immune to distance/scale, but not to the gesture's plane being tilted relative to the camera: roughly up to 8&deg; of error at a 30&deg; tilt.",
    protocolBullet6:
      '<strong>Lengths</strong> need a correct scale (mm/px), which only holds in the plane of the calibration reference — a limb 30&nbsp;cm closer to or farther from the camera than that plane reads 20&ndash;38% off. A tilted (foreshortened) limb reads short: roughly 13% short at a 30&deg; tilt.',
    protocolBullet7:
      'The on-screen quality colour (green/amber/red) reflects <strong>placement precision</strong> only — how exactly the points were tapped, at what zoom. It does not know about, and cannot warn about, camera tilt or distance.',
    protocolBullet8: 'angle-lab <strong>measures and reports</strong>. It does not diagnose or recommend.',

    guideTitle: 'Measurement guide',
    guideHint:
      'Tap the named landmarks in order on the photo; the angle or distance each one feeds is built and tagged for export automatically once every landmark it needs has a point. The points themselves stay ordinary points afterwards — draggable in Select, like any other.',
    guideListEmpty: 'No guides yet.',
    guideListItem: '{label} — {count} points',
    guideReadoutWaiting: '{guide}: tap {landmark} ({n}/{total}).',
    guideReadoutDone: '{guide}: done. Switch to Select to inspect or adjust.',

    hintSelect: 'Drag a point to move it. Tap a measurement to select it.',
    hintPoint: 'Tap to place a point. Slide without lifting to fine-tune.',
    hintAngleFirst: 'Angle · tap one end (1/3)',
    hintAngleVertex: 'Angle · tap the vertex (2/3)',
    hintAngleLast: 'Angle · tap the other end (3/3)',
    hintPairFirst: 'Tap the first point (1/2)',
    hintPairSecond: 'Tap the second point (2/2)',
    hintCalibrateFirst: 'Calibrate · tap both ends of something whose real length you know (1/2)',
    hintCalibrateSecond: 'Calibrate · tap the other end (2/2)',
    hintCalibrateLength: 'Calibrate · type the real length',
    hintCancel: 'Cancel selection',
    undoButton: 'Undo',
    redoButton: 'Redo',
    hintLineFirst: 'Line · tap the first point (1/2)',
    hintLineSecond: 'Line · tap the second point (2/2)',

    menuButton: 'Menu',
    menuSectionPhotos: 'Photos in this project',
    photoThumbLabel: 'Photo {n}',
    photoAddLabel: 'Add a photo',
    photoDeleteLabel: 'Delete photo {n}',
    photoDeleteConfirm: 'Delete photo {n}? Its points ({p}) and measurements ({m}) go with it and this cannot be undone.',
    menuSectionPhoto: 'Photo',
    menuSectionProject: 'Project',
    menuSectionMeasure: 'Measurement',
    menuSectionApp: 'App',
    languageLabel: 'Language',
    projectChipPhoto: 'photo {n} of {m}',

    historyTitle: 'History',
    historyHint:
      'Every project saved on this device, most recent first. Subject code is editable right here. "New project" (top bar) saves the one you\'re on and starts a blank one — nothing here is ever deleted except with the buttons below.',
    historyDeleteAllButton: 'Delete all projects',
    historyEmpty: 'No saved projects yet.',
    historyCodePlaceholder: 'no code',
    historyMeta: '{date} · {count} {photoWord}',
    historyPhotoOne: 'photo',
    historyPhotoMany: 'photos',
    historyCurrent: 'Current',
    historyOpen: 'Open',
    historyDeleteConfirm: 'Delete this project and its photos? This cannot be undone.',
    historyDeleteAllConfirm: 'Delete every saved project on this device, including the one open now? This cannot be undone.',

    exportTitle: 'Export',
    exportHint:
      'Fills rows for <code>mediciones-2026-27.csv</code> — the schema, not the file itself: this is a static site with no access to your OneDrive, so the CSV lands via Share/Save the same way seco\'s own export already does, and you paste or append it by hand. Only <strong>tagged</strong> readings below are exported; anything left "— untagged —" is skipped, not sent as a blank row.',
    exportSubjectCodeLabel: 'Subject code',
    exportCategoryLabel: 'Category',
    exportDateLabel: 'Date',
    exportEvaluatorLabel: 'Evaluator',
    exportPngButton: 'Share photo (PNG)',
    exportCsvButton: 'Share CSV rows',
    exportUntaggedOption: '— untagged —',
    exportNoPhoto: 'No photo loaded.',
    exportNoMeasurements: 'No angle/distance measurements on this photo yet.',
    exportTaggedCount: '{tagged} of {total} tagged — only tagged readings export.',
    exportReadingAngle: 'Angle · {value} ({quality})',
    exportReadingDistance: 'Distance · {value} ({quality})',

    exportFailed: 'The image could not be exported. Try again, or export a smaller photo.',
    photoSaveFailed: 'The photo could not be saved on this device. The measurements are kept, but the photo will be lost when you close the app. Free up space (History) and load it again.',
    photoMissing: 'This project\'s photo is no longer on this device. The points are still here, but you need to load the photo again.',

    storageWarning:
      'Device storage is {pct}% full. Open History to delete old projects, or export what you need, before the browser evicts it on its own.',

    seasonEndedBanner: 'The season ended on {end}. Delete this device\'s projects, or wait?',
    seasonPurgeButton: 'Delete season projects',
    seasonSnoozeButton: 'Remind me in 30 days',
    seasonPurgeConfirm:
      'This deletes {n} project(s) and their photos from this device. This cannot be undone: export anything you want to keep first. Sure?',

    repeatTapMoreOne: 'Tap the same point {n} more time.',
    repeatTapMoreMany: 'Tap the same point {n} more times.',
    repeatResult: 'Your own repeatability: ±{rms} px{realText} typical, {max} px worst of {count} taps. Tap again to redo.',

    returnBarButton: 'Send to seco',
    returnBarText: '{subject} · {test}/{metric}: {value} {unit} — ready to send to seco',
  },
  es: {
    pageTitle: 'angle-lab',
    libraryButton: 'Galería',
    cameraButton: 'Cámara',
    fitButton: 'Ajustar a pantalla',
    deleteSelectedButton: 'Borrar selección',
    protocolButton: 'Protocolo',
    guideButton: 'Guías',
    historyButton: 'Historial',
    exportButton: 'Exportar',
    newProjectButton: 'Nuevo proyecto',
    langButton: 'EN',
    closeButton: 'Cerrar',
    deleteButton: 'Borrar',

    wordZoom: 'Zoom',
    wordAngle: 'Ángulo',
    wordDistance: 'Distancia',
    toolCalibrate: 'Calibrar',
    calibrationLengthLabel: 'Longitud de referencia',
    calibrationConfirm: 'Calibrar',
    calibrationCancel: 'Cancelar',
    calibrationErrorInvalid: 'Introduce un número mayor que 0.',
    calibrationErrorTooClose: 'Los dos puntos de referencia están demasiado juntos — elige dos puntos más separados.',
    clearCalibrationButton: 'Quitar calibración',
    displayUnitLabel: 'Unidad de lectura',
    scaleUncalibrated: 'sin calibrar',
    scaleValue: '{value} mm/px',
    calibrationRefLabel: 'ref {value}',

    qualityGood: 'bueno',
    qualityOk: 'aceptable',
    qualityPoor: 'malo',
    uncalibratedSuffix: 'sin calibrar',

    disclaimerShort: 'Ángulos <strong>proyectados</strong>: cámara perpendicular al gesto',

    emptyStep1: 'Abre una foto',
    emptyStep2: 'Toca las articulaciones',
    emptyStep3: 'Lee el ángulo',
    emptyTrust: 'Las fotos no salen de este dispositivo.',
    openPhotoLabel: 'Abrir foto',
    takePhotoLabel: 'Hacer foto',

    toolGroupLabel: 'Herramienta',
    toolSelect: 'Mover',
    toolPoint: 'Punto',
    toolLine: 'Línea',
    toolAngle: 'Ángulo',
    toolDistance: 'Distancia',
    toolRepeat: 'Test de precisión',

    protocolTitle1: 'Protocolo de captura',
    protocolBullet1:
      'Cámara <strong>perpendicular</strong> al plano del gesto que se mide — un plano inclinado sesga cualquier ángulo varios grados y acorta cualquier longitud.',
    protocolBullet2:
      'Coloca la referencia de calibración <strong>en ese mismo plano</strong>, a la distancia del sujeto a la cámara, ni más cerca ni más lejos.',
    protocolBullet3:
      'Mantén una <strong>distancia mínima</strong> razonable del sujeto — las fotos muy de cerca exageran el error de perspectiva.',
    protocolBullet4:
      'Evita el <strong>gran angular</strong> — el gran angular aumenta la distorsión de perspectiva en los bordes del encuadre.',
    protocolTitle2: 'Qué mide esto, y qué no',
    protocolIntro:
      'angle-lab lee un ángulo <strong>proyectado</strong> y una longitud <strong>escalada</strong> a partir de una sola foto en 2D. No reconstruye la geometría en 3D. Seguir el protocolo de arriba mantiene pequeño el error de proyección; no puede eliminarlo.',
    protocolBullet5:
      'Los <strong>ángulos</strong> son inmunes a la distancia/escala, pero no a que el plano del gesto esté inclinado respecto a la cámara: hasta unos 8&deg; de error con una inclinación de 30&deg;.',
    protocolBullet6:
      'Las <strong>longitudes</strong> necesitan una escala correcta (mm/px), que solo es válida en el plano de la referencia de calibración — un segmento 30&nbsp;cm más cerca o más lejos de la cámara que ese plano se lee con un 20&ndash;38% de error. Un segmento inclinado (escorzado) se lee corto: hasta un 13% corto con una inclinación de 30&deg;.',
    protocolBullet7:
      'El color de calidad en pantalla (verde/ámbar/rojo) refleja solo la <strong>precisión de colocación</strong> — con qué exactitud se tocaron los puntos, a qué zoom. No sabe nada de, ni puede avisar de, la inclinación o la distancia de la cámara.',
    protocolBullet8: 'angle-lab <strong>mide y reporta</strong>. No diagnostica ni recomienda.',

    guideTitle: 'Guía de medición',
    guideHint:
      'Toca los puntos de referencia nombrados en orden sobre la foto; el ángulo o la distancia que cada uno alimenta se construye y etiqueta para exportar en cuanto todos sus puntos existen. Los puntos en sí siguen siendo puntos normales después — se pueden arrastrar en Seleccionar, como cualquier otro.',
    guideListEmpty: 'Todavía no hay guías.',
    guideListItem: '{label} — {count} puntos',
    guideReadoutWaiting: '{guide}: toca {landmark} ({n}/{total}).',
    guideReadoutDone: '{guide}: hecho. Cambia a Seleccionar para revisar o ajustar.',

    hintSelect: 'Arrastra un punto para moverlo. Toca una medida para seleccionarla.',
    hintPoint: 'Toca para colocar un punto. Desliza sin soltar para afinar.',
    hintAngleFirst: 'Ángulo · toca un extremo (1/3)',
    hintAngleVertex: 'Ángulo · toca el vértice (2/3)',
    hintAngleLast: 'Ángulo · toca el otro extremo (3/3)',
    hintPairFirst: 'Toca el primer punto (1/2)',
    hintPairSecond: 'Toca el segundo punto (2/2)',
    hintCalibrateFirst: 'Calibrar · toca los dos extremos de algo cuya longitud real conozcas (1/2)',
    hintCalibrateSecond: 'Calibrar · toca el otro extremo (2/2)',
    hintCalibrateLength: 'Calibrar · escribe la longitud real',
    hintCancel: 'Cancelar selección',
    undoButton: 'Deshacer',
    redoButton: 'Rehacer',
    hintLineFirst: 'Línea · toca el primer punto (1/2)',
    hintLineSecond: 'Línea · toca el segundo punto (2/2)',

    menuButton: 'Menú',
    menuSectionPhotos: 'Fotos de este proyecto',
    photoThumbLabel: 'Foto {n}',
    photoAddLabel: 'Añadir una foto',
    photoDeleteLabel: 'Borrar la foto {n}',
    photoDeleteConfirm: '¿Borrar la foto {n}? Se pierden sus puntos ({p}) y sus medidas ({m}) y no se puede deshacer.',
    menuSectionPhoto: 'Foto',
    menuSectionProject: 'Proyecto',
    menuSectionMeasure: 'Medición',
    menuSectionApp: 'App',
    languageLabel: 'Idioma',
    projectChipPhoto: 'foto {n} de {m}',

    historyTitle: 'Historial',
    historyHint:
      'Todos los proyectos guardados en este dispositivo, el más reciente primero. El código de sujeto se edita aquí mismo. «Nuevo proyecto» (barra superior) guarda el que tienes abierto y arranca uno en blanco — nada aquí se borra salvo con los botones de abajo.',
    historyDeleteAllButton: 'Borrar todos los proyectos',
    historyEmpty: 'Todavía no hay proyectos guardados.',
    historyCodePlaceholder: 'sin código',
    historyMeta: '{date} · {count} {photoWord}',
    historyPhotoOne: 'foto',
    historyPhotoMany: 'fotos',
    historyCurrent: 'Actual',
    historyOpen: 'Abrir',
    historyDeleteConfirm: '¿Borrar este proyecto y sus fotos? No se puede deshacer.',
    historyDeleteAllConfirm: '¿Borrar todos los proyectos guardados en este dispositivo, incluido el que tienes abierto ahora? No se puede deshacer.',

    exportTitle: 'Exportar',
    exportHint:
      'Rellena filas para <code>mediciones-2026-27.csv</code> — el esquema, no el archivo en sí: esto es un sitio estático sin acceso a tu OneDrive, así que el CSV sale por Compartir/Guardar igual que ya hace la exportación de seco, y lo pegas o lo añades a mano. Solo se exportan las lecturas <strong>etiquetadas</strong> de abajo; las que queden en "— sin etiquetar —" se saltan, nunca salen como fila en blanco.',
    exportSubjectCodeLabel: 'Código de sujeto',
    exportCategoryLabel: 'Categoría',
    exportDateLabel: 'Fecha',
    exportEvaluatorLabel: 'Evaluador',
    exportPngButton: 'Compartir foto (PNG)',
    exportCsvButton: 'Compartir filas CSV',
    exportUntaggedOption: '— sin etiquetar —',
    exportNoPhoto: 'No hay foto cargada.',
    exportNoMeasurements: 'Todavía no hay ángulos ni distancias en esta foto.',
    exportTaggedCount: '{tagged} de {total} etiquetadas — solo se exportan las etiquetadas.',
    exportReadingAngle: 'Ángulo · {value} ({quality})',
    exportReadingDistance: 'Distancia · {value} ({quality})',

    exportFailed: 'No se ha podido exportar la imagen. Inténtalo de nuevo o exporta una foto más pequeña.',
    photoSaveFailed: 'No se ha podido guardar la foto en este dispositivo. Las medidas se conservan, pero la foto se perderá al cerrar la app. Libera espacio (Historial) y vuelve a cargarla.',
    photoMissing: 'La foto de este proyecto ya no está en este dispositivo. Los puntos siguen aquí, pero tienes que volver a cargar la foto.',

    storageWarning:
      'El almacenamiento del dispositivo está al {pct}%. Abre Historial para borrar proyectos antiguos, o exporta lo que necesites, antes de que el navegador lo libere por su cuenta.',

    seasonEndedBanner: 'La temporada terminó el {end}. ¿Borras los proyectos de este dispositivo, o prefieres esperar?',
    seasonPurgeButton: 'Borrar proyectos de la temporada',
    seasonSnoozeButton: 'Recordarlo en 30 días',
    seasonPurgeConfirm:
      'Se borran {n} proyecto(s) y sus fotos de este dispositivo. No hay deshacer: exporta antes si hay algo que quieras conservar. ¿Seguro?',

    repeatTapMoreOne: 'Toca el mismo punto {n} vez más.',
    repeatTapMoreMany: 'Toca el mismo punto {n} veces más.',
    repeatResult: 'Tu propia repetibilidad: ±{rms} px{realText} típico, {max} px peor de {count} toques. Toca de nuevo para repetir.',

    returnBarButton: 'Enviar a seco',
    returnBarText: '{subject} · {test}/{metric}: {value} {unit} — listo para enviar a seco',
  },
};

function detectDefaultLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // Private browsing or a blocked origin: fall through to the navigator guess below, same
    // "degrade, don't throw" rule the rest of storage/db.js already follows.
  }
  return (typeof navigator !== 'undefined' && /^es/i.test(navigator.language || '')) ? 'es' : 'en';
}

let currentLang = detectDefaultLang();

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (lang !== 'en' && lang !== 'es') return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Same tolerance as everywhere else in this app: losing the preference is not worth
    // throwing into a caller that has no recovery path for it anyway.
  }
}

// Test-only accessor: whether a language's own table defines `key` at all, as opposed to t()'s
// runtime fallback (missing in the active language falls back to English, missing everywhere
// falls back to the bare key) — the fallback is the right behaviour for a page that must never
// throw over a translation gap, but it would silently hide that gap from a value-equality test.
export function hasOwnKey(lang, key) {
  return Object.prototype.hasOwnProperty.call(STRINGS[lang] || {}, key);
}

export function keysFor(lang) {
  return Object.keys(STRINGS[lang] || {});
}

export function t(key, vars) {
  let s = STRINGS[currentLang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}
