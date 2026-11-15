/**
 * LOTE 5 §5 of the prompt maestro: angle-lab's own UI chrome, bilingual (en/es) — decided
 * 2026-09-29 with Daniel: a real selector, not a one-shot translation, because he wants this app
 * sellable outside Spain too. `{token}` in a text is replaced by the value of the same name
 * passed to t().
 *
 * Since LOTE 7 it also holds the text of the measurement guides (guide.*, landmark.*, measure.*
 * keys, see src/export/guides.js), which is content for the user, not app chrome.
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

    guideTitle: 'Measurement guides',
    guideListEmpty: 'No guides yet.',
    guideListItem: '{label} — {count} points',
    guideReadoutWaiting: '{guide}: tap {landmark} ({n}/{total}).',
    guideReadoutDone: '{guide}: done. Switch to Move to inspect or adjust.',

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
    exportSubjectCodeLabel: 'Subject code',
    exportDateLabel: 'Date',
    exportPngButton: 'Share photo (PNG)',
    exportNoPhoto: 'No photo loaded.',
    exportNoMeasurements: 'No angle/distance measurements on this photo yet.',
    exportReadingAngle: 'Angle · {value} ({quality})',
    exportReadingDistance: 'Distance · {value} ({quality})',
    exportHint:
      'Share the photo with its measurements written under it, or a table (CSV) of the measurements, which opens in Numbers or Excel. Give each measurement a name (select it, then Label) to tell the rows apart.',
    exportCsvButton: 'Share table (CSV)',
    exportNameLabel: 'Name',
    exportNamePlaceholder: 'Name (optional)',
    exportNoName: 'unnamed',
    footerDisclaimer: 'Angles projected on a single photo',
    footerMore: '+{n} more',
    labelButton: 'Label',
    labelDialogTitle: 'Name this measurement',
    labelDialogField: 'Name',
    labelDialogPlaceholder: 'e.g. left knee',
    labelSave: 'Save',
    historyHint:
      'Every project saved on this device, most recent first. Subject code is editable right here. "New project" (in the menu) saves the one you\'re on and starts a blank one — nothing here is ever deleted except with the buttons below.',
    guideHint:
      'Pick a position. You get how to take the photo and which points to tap, in order; the angles are then built and named automatically. The points stay ordinary points afterwards — draggable in Move, like any other.',
    guideStartButton: 'Start',
    guideBackButton: 'Back',
    guideDetailCamera: 'How to take the photo',
    guideDetailPoints: 'Points to tap, in order',
    guideDetailResult: 'What you get',
    guideDetailExtra: 'Optional extra',

    'guide.handstand': 'Handstand',
    'guide.handstand.camera':
      'Side view (profile): the camera perpendicular to the plane of the movement, still, at a moderate distance, with the whole body in frame from wrists to ankles. Tap the points on the side of the body that faces the camera.',
    'guide.handstand.read':
      'Shoulder angle: close to 180° in a classic straight-line handstand; lower means the shoulder is not fully opening. Hip angle: close to 180° is a straight line; closing towards the back is a lumbar arch, closing forward is a bent hip (pike). 180° is a coaching reference, not a clinical range.',
    'guide.handstand.extra':
      'Elbow angle (vertex at the elbow, rays to the shoulder and the wrist), to check the arm is locked. Add it with the Angle tool.',
    'guide.bridge': 'Bridge',
    'guide.bridge.camera':
      'Side view (profile): the camera perpendicular to the plane of the movement, still, at a moderate distance, with the whole body in frame. Tap the points on the side of the body that faces the camera.',
    'guide.bridge.read':
      'Shoulder angle: how far the shoulder opens over the head, the most frequent limiter. Hip angle: if it stays well under 180° the hip is not opening and the lower back is paying for the bridge. 180° is a coaching reference, not a clinical range.',
    'guide.bridge.extra':
      'Elbow angle (vertex at the elbow, rays to the shoulder and the wrist), to check the arm is straight and not compensating bent. Add it with the Angle tool.',
    'guide.split_front': 'Front split',
    'guide.split_front.camera':
      'Side view: the camera perpendicular to the plane of the legs (they go forward and back), still, at a moderate distance, with the whole body in frame. Tap the points on the side of the body that faces the camera.',
    'guide.split_front.read':
      'Total angle: the legs at the hip, 180° is a full split; it is the single most informative number. Back-leg hip angle: shoulder, hip and back ankle; it usually limits before the front leg (psoas, rectus femoris), so it deserves its own look.',
    'guide.split_front.extra':
      'Knee angle (vertex at the knee, rays to the hip and the ankle of that leg) if you suspect the knee bends instead of the hip opening: it should approach 180°. Add it with the Angle tool.',
    'guide.split_side': 'Side split',
    'guide.split_side.camera':
      'Front view: the camera in front of the athlete, perpendicular to the plane of the legs (they open to the sides), still, at a moderate distance, with the whole body in frame.',
    'guide.split_side.read':
      'Angle between the legs: vertex where the legs meet, rays to each ankle. 180° is a full side split, a coaching reference rather than a clinical range.',

    'landmark.wrist': 'Wrist (styloid process)',
    'landmark.wrist.where': 'The bone that sticks out at the side of the wrist.',
    'landmark.shoulder': 'Shoulder (acromion)',
    'landmark.shoulder.where': 'The bony edge at the tip of the shoulder.',
    'landmark.hip': 'Hip (greater trochanter)',
    'landmark.hip.where': 'The bump on the side of the hip, easy to feel.',
    'landmark.knee': 'Knee (lateral epicondyle)',
    'landmark.knee.where': 'The bony bump on the outside of the knee.',
    'landmark.ankle': 'Ankle (lateral malleolus)',
    'landmark.ankle.where': 'The outer ankle bone.',
    'landmark.ankle_front': 'Front ankle (lateral malleolus)',
    'landmark.ankle_front.where': 'The outer ankle bone of the leg in front.',
    'landmark.ankle_back': 'Back ankle (lateral malleolus)',
    'landmark.ankle_back.where': 'The outer ankle bone of the leg behind.',
    'landmark.ankle_one': 'Ankle, one side (lateral malleolus)',
    'landmark.ankle_one.where': 'The outer ankle bone of one leg.',
    'landmark.ankle_other': 'Ankle, other side (lateral malleolus)',
    'landmark.ankle_other.where': 'The outer ankle bone of the other leg.',
    'landmark.crotch': 'Crotch',
    'landmark.crotch.where': 'The point where the two legs meet, at the lowest part of the pelvis.',

    'measure.shoulder': 'Shoulder angle',
    'measure.hip': 'Hip angle',
    'measure.split_total': 'Total split angle',
    'measure.back_hip': 'Back-leg hip angle',

    exportFailed: 'The image could not be exported. Try again, or export a smaller photo.',
    photoSaveFailed: 'The photo could not be saved on this device. The measurements are kept, but the photo will be lost when you close the app. Free up space (History) and load it again.',
    photoMissing: 'This project\'s photo is no longer on this device. The points are still here, but you need to load the photo again.',

    storageWarning:
      'Device storage is {pct}% full. Open History to delete old projects, or export what you need, before the browser evicts it on its own.',


    repeatTapMoreOne: 'Tap the same point {n} more time.',
    repeatTapMoreMany: 'Tap the same point {n} more times.',
    repeatResult: 'Your own repeatability: ±{rms} px{realText} typical, {max} px worst of {count} taps. Tap again to redo.',

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

    guideTitle: 'Guías de medición',
    guideListEmpty: 'Todavía no hay guías.',
    guideListItem: '{label} — {count} puntos',
    guideReadoutWaiting: '{guide}: toca {landmark} ({n}/{total}).',
    guideReadoutDone: '{guide}: hecho. Cambia a Mover para revisar o ajustar.',

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
    exportSubjectCodeLabel: 'Código de sujeto',
    exportDateLabel: 'Fecha',
    exportPngButton: 'Compartir foto (PNG)',
    exportNoPhoto: 'No hay foto cargada.',
    exportNoMeasurements: 'Todavía no hay ángulos ni distancias en esta foto.',
    exportReadingAngle: 'Ángulo · {value} ({quality})',
    exportReadingDistance: 'Distancia · {value} ({quality})',
    exportHint:
      'Comparte la foto con sus medidas escritas debajo, o una tabla (CSV) con las medidas, que se abre en Numbers o Excel. Ponle nombre a cada medida (selecciónala y pulsa Etiquetar) para distinguir las filas.',
    exportCsvButton: 'Compartir tabla (CSV)',
    exportNameLabel: 'Nombre',
    exportNamePlaceholder: 'Nombre (opcional)',
    exportNoName: 'sin nombre',
    footerDisclaimer: 'Ángulos proyectados sobre una sola foto',
    footerMore: '+{n} más',
    labelButton: 'Etiquetar',
    labelDialogTitle: 'Pon nombre a esta medida',
    labelDialogField: 'Nombre',
    labelDialogPlaceholder: 'p. ej. rodilla izquierda',
    labelSave: 'Guardar',
    historyHint:
      'Todos los proyectos guardados en este dispositivo, el más reciente primero. El código de sujeto se edita aquí mismo. «Nuevo proyecto» (en el menú) guarda el que tienes abierto y arranca uno en blanco — nada aquí se borra salvo con los botones de abajo.',
    guideHint:
      'Elige una posición. Verás cómo hacer la foto y qué puntos tocar, en orden; los ángulos se construyen y se nombran solos. Los puntos siguen siendo puntos normales — se arrastran con Mover, como cualquier otro.',
    guideStartButton: 'Empezar',
    guideBackButton: 'Volver',
    guideDetailCamera: 'Cómo hacer la foto',
    guideDetailPoints: 'Puntos que tocar, en orden',
    guideDetailResult: 'Qué obtienes',
    guideDetailExtra: 'Extra opcional',

    'guide.handstand': 'Pino',
    'guide.handstand.camera':
      'Vista lateral (de perfil): la cámara perpendicular al plano del movimiento, quieta, a distancia moderada y con todo el cuerpo en el encuadre, de las muñecas a los tobillos. Toca los puntos del lado del cuerpo que mira a la cámara.',
    'guide.handstand.read':
      'Ángulo de hombro: cercano a 180° en un pino de línea recta clásica; por debajo, el hombro no se abre del todo. Ángulo de cadera: cerca de 180° es línea recta; si se cierra hacia la espalda es arqueo lumbar, y si se cierra hacia delante es cadera doblada (pike). 180° es una referencia de entrenamiento, no un rango clínico.',
    'guide.handstand.extra':
      'Ángulo de codo (vértice en el codo, rayos al hombro y a la muñeca), para comprobar que el brazo está bloqueado. Añádelo con la herramienta Ángulo.',
    'guide.bridge': 'Puente',
    'guide.bridge.camera':
      'Vista lateral (de perfil): la cámara perpendicular al plano del movimiento, quieta, a distancia moderada y con todo el cuerpo en el encuadre. Toca los puntos del lado del cuerpo que mira a la cámara.',
    'guide.bridge.read':
      'Ángulo de hombro: cuánto se abre el hombro por encima de la cabeza, el limitante más frecuente. Ángulo de cadera: si se queda muy por debajo de 180°, la cadera no se abre y la zona lumbar paga el puente. 180° es una referencia de entrenamiento, no un rango clínico.',
    'guide.bridge.extra':
      'Ángulo de codo (vértice en el codo, rayos al hombro y a la muñeca), para comprobar que el brazo está extendido y no compensa doblado. Añádelo con la herramienta Ángulo.',
    'guide.split_front': 'Spagat frontal',
    'guide.split_front.camera':
      'Vista lateral: la cámara perpendicular al plano de las piernas (van hacia delante y hacia atrás), quieta, a distancia moderada y con todo el cuerpo en el encuadre. Toca los puntos del lado del cuerpo que mira a la cámara.',
    'guide.split_front.read':
      'Ángulo total: las piernas en la cadera, 180° es spagat completo; es el número más informativo. Ángulo de cadera de la pierna trasera: hombro, cadera y tobillo trasero; casi siempre limita antes que la pierna delantera (psoas, recto femoral), así que merece mirarse aparte.',
    'guide.split_front.extra':
      'Ángulo de rodilla (vértice en la rodilla, rayos a la cadera y al tobillo de esa pierna) si sospechas que se dobla la rodilla en vez de abrirse la cadera: debe acercarse a 180°. Añádelo con la herramienta Ángulo.',
    'guide.split_side': 'Spagat lateral',
    'guide.split_side.camera':
      'Vista frontal: la cámara delante del deportista, perpendicular al plano de las piernas (se abren hacia los lados), quieta, a distancia moderada y con todo el cuerpo en el encuadre.',
    'guide.split_side.read':
      'Ángulo entre las piernas: vértice donde se unen las piernas, rayos a cada tobillo. 180° es spagat lateral completo, una referencia de entrenamiento más que un rango clínico.',

    'landmark.wrist': 'Muñeca (apófisis estiloides)',
    'landmark.wrist.where': 'El hueso que sobresale en el lado de la muñeca.',
    'landmark.shoulder': 'Hombro (acromion)',
    'landmark.shoulder.where': 'El borde óseo en la punta del hombro.',
    'landmark.hip': 'Cadera (trocánter mayor)',
    'landmark.hip.where': 'El bulto lateral de la cadera, se palpa fácil.',
    'landmark.knee': 'Rodilla (epicóndilo lateral)',
    'landmark.knee.where': 'El bulto óseo en la cara externa de la rodilla.',
    'landmark.ankle': 'Tobillo (maléolo lateral)',
    'landmark.ankle.where': 'El tobillo externo.',
    'landmark.ankle_front': 'Tobillo delantero (maléolo lateral)',
    'landmark.ankle_front.where': 'El tobillo externo de la pierna que va delante.',
    'landmark.ankle_back': 'Tobillo trasero (maléolo lateral)',
    'landmark.ankle_back.where': 'El tobillo externo de la pierna que va detrás.',
    'landmark.ankle_one': 'Tobillo de un lado (maléolo lateral)',
    'landmark.ankle_one.where': 'El tobillo externo de una pierna.',
    'landmark.ankle_other': 'Tobillo del otro lado (maléolo lateral)',
    'landmark.ankle_other.where': 'El tobillo externo de la otra pierna.',
    'landmark.crotch': 'Entrepierna',
    'landmark.crotch.where': 'El punto donde se unen las dos piernas, en la parte más baja de la pelvis.',

    'measure.shoulder': 'Ángulo de hombro',
    'measure.hip': 'Ángulo de cadera',
    'measure.split_total': 'Ángulo total del spagat',
    'measure.back_hip': 'Ángulo de cadera de la pierna trasera',

    exportFailed: 'No se ha podido exportar la imagen. Inténtalo de nuevo o exporta una foto más pequeña.',
    photoSaveFailed: 'No se ha podido guardar la foto en este dispositivo. Las medidas se conservan, pero la foto se perderá al cerrar la app. Libera espacio (Historial) y vuelve a cargarla.',
    photoMissing: 'La foto de este proyecto ya no está en este dispositivo. Los puntos siguen aquí, pero tienes que volver a cargar la foto.',

    storageWarning:
      'El almacenamiento del dispositivo está al {pct}%. Abre Historial para borrar proyectos antiguos, o exporta lo que necesites, antes de que el navegador lo libere por su cuenta.',


    repeatTapMoreOne: 'Toca el mismo punto {n} vez más.',
    repeatTapMoreMany: 'Toca el mismo punto {n} veces más.',
    repeatResult: 'Tu propia repetibilidad: ±{rms} px{realText} típico, {max} px peor de {count} toques. Toca de nuevo para repetir.',

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
