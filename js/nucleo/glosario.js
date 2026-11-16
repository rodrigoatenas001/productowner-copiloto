// Glosario de la jerga ágil: lo que muestran los botones «?» junto a cada término.
// Definiciones cortas, en lenguaje simple y con un ejemplo cuando ayuda.

export const GLOSARIO = {
  alcance: {
    termino: 'Alcance',
    texto: 'Lo que el proyecto incluye y, tan importante, lo que no incluye. Escribirlo evita discusiones al final: si no está en el alcance, es un cambio y se cotiza aparte.',
  },
  cotizacion: {
    termino: 'Cotización',
    texto: 'Cuánto cuesta el proyecto y cómo se calcula: horas o puntos por tarifa, más un margen por riesgo. Se puede expresar en UF para que no pierda valor si el proyecto se alarga.',
  },
  hitos: {
    termino: 'Hitos de pago',
    texto: 'Entregas acordadas que, al ser aceptadas por el cliente, gatillan un pago. Ej.: 30% al firmar, 40% al entregar el catálogo, 30% al salir a producción. Cada hito se cierra con un acta.',
  },
  cambios: {
    termino: 'Control de cambios',
    texto: 'Registro de lo que el cliente pide después de acordar el alcance, con su impacto en plazo y precio. Un cambio aprobado entra al backlog; uno rechazado queda anotado para no volver a discutirlo.',
  },
  sprint: {
    termino: 'Sprint',
    texto: 'Un período corto y fijo (1 a 4 semanas) en que el equipo se compromete con un conjunto de historias y al final muestra algo funcionando. Al cerrarlo se hace la revisión con el cliente y la retrospectiva.',
  },
  retro: {
    termino: 'Retrospectiva',
    texto: 'Reunión al cerrar el sprint para mejorar la forma de trabajar, no el producto: qué salió bien, qué mejorar y qué acciones concretas se toman (con responsable). Al empezar la siguiente se revisa si se cumplieron.',
  },
  okr: {
    termino: 'Objetivos y resultados clave',
    texto: 'El objetivo dice qué se quiere lograr (cualitativo); los resultados clave, cómo se sabe que se logró (medibles, con línea base y meta). Ej.: «Vender en línea» → «30 pedidos web al mes».',
  },
  entrega: {
    termino: 'Tiempo de entrega y de ciclo',
    texto: 'Entrega: desde que el trabajo entra al tablero hasta que se termina (lo que espera quien lo pidió). Ciclo: desde que se empieza hasta que se termina. Se mira el percentil 85: «el 85% se termina en este tiempo o menos», que sirve para comprometer plazos.',
  },
  cfd: {
    termino: 'Diagrama de flujo acumulado',
    texto: 'Cuántas historias hay cada día por hacer, en curso y hechas. Si la banda «en curso» se ensancha, entra más trabajo del que sale: hay un cuello de botella o demasiado trabajo abierto.',
  },
  daily: {
    termino: 'Daily',
    texto: 'Reunión diaria de 15 minutos del equipo para sincronizarse: qué se terminó, en qué se sigue y qué está bloqueado. No es un informe para jefaturas: los problemas se resuelven después, con quienes corresponda.',
  },
  adopcion: {
    termino: 'KPIs de producto y adopción',
    texto: 'Indicadores que dicen si el sistema cambió algo, no solo si se entregó: cuántas personas lo usan en vez del papel, cuánto bajó el tiempo de ciclo, cuántos errores menos hay. Se mide una línea base antes, una meta y mediciones periódicas.',
  },
  stakeholders: {
    termino: 'Matriz de stakeholders (poder / interés)',
    texto: 'Ubica a cada persona según su poder sobre el proyecto y su interés en él. Alto y alto: gestionar de cerca. Alto poder y bajo interés: mantener satisfechos. Bajo poder y alto interés (muchas veces quienes operan): mantener informados y escucharlos.',
  },
  vsm: {
    termino: 'Flujo de valor (VSM)',
    texto: 'Mapa del proceso de punta a punta con el tiempo que se trabaja y el que se espera en cada paso. La eficiencia es trabajo dividido por tiempo total. Muestra el cuello de botella real antes de automatizar algo que no era el problema.',
  },
  bpmn: {
    termino: 'BPMN (mapa del proceso)',
    texto: 'Notación estándar para dibujar procesos. Aquí usamos lo esencial: inicio (círculo), tarea (rectángulo), decisión (rombo), fin (círculo grueso) y un carril por cada actor. Sirve para validar el circuito con el cliente antes de escribir historias.',
  },
  criterios: {
    termino: 'Criterios de aceptación',
    texto: 'Las condiciones que debe cumplir la historia para darla por terminada. Se escriben para poder probarlas con el cliente: «Dado… cuando… entonces…». Ej.: «Dado un producto agotado, cuando la clienta abre su ficha, entonces no puede agregarlo al carro».',
  },
  reglas: {
    termino: 'Reglas de negocio',
    texto: 'Políticas, excepciones o controles del negocio que la historia debe respetar, aunque no sean una funcionalidad en sí. Ej.: «Despacho solo a Ñuñoa y Providencia» o «Tortas con 48 horas de anticipación».',
  },
  epica: {
    termino: 'Épica',
    texto: 'Un grupo de historias que juntas cubren un proceso o un objetivo grande. Ej.: «Compra» agrupa carro, pago y correo de confirmación.',
  },
  puntos: {
    termino: 'Puntos de historia',
    texto: 'Una medida relativa del esfuerzo: complejidad, incertidumbre y trabajo. No son horas. Se comparan entre historias: una de 8 cuesta más o menos el doble que una de 3.',
  },
  moscow: {
    termino: 'Prioridad MoSCoW',
    texto: 'Imprescindible (sin esto no sirve), Importante (duele no tenerlo), Deseable (si alcanza) y Esta vez no (acordado que queda fuera). Deja claro qué entra primero y por qué.',
  },
  tipo: {
    termino: 'Tipo de ítem',
    texto: 'Historia: entrega valor a alguien. Bug: algo que no funciona como se acordó. Spike: investigación con plazo fijo para despejar una duda. Deuda técnica: mejora interna que evita problemas después.',
  },
  invest: {
    termino: 'INVEST',
    texto: 'Lista para revisar una buena historia: Independiente, Negociable, Valiosa, Estimable, pequeña (Small) y Testeable. El copiloto revisa estas reglas y sugiere mejoras.',
  },
  ready: {
    termino: 'Definition of Ready',
    texto: 'Lo que una historia debe tener antes de entrar a un sprint: por ejemplo, criterios claros, estimación y dudas resueltas. Evita empezar trabajo que después se detiene.',
  },
  done: {
    termino: 'Definition of Done',
    texto: 'Lo que debe cumplirse para decir que una historia está terminada de verdad: probada, revisada y aceptada. Es igual para todas las historias del equipo.',
  },
  wsjf: {
    termino: 'WSJF',
    texto: 'Primero el trabajo más corto con mayor costo de esperar. Suma valor para el negocio, urgencia y reducción de riesgo, y lo divide por el esfuerzo (puntos). Mayor puntaje, antes va.',
  },
  rice: {
    termino: 'RICE',
    texto: 'Alcance × Impacto × Confianza ÷ Esfuerzo. Sirve cuando puedes estimar a cuántas personas llega cada cambio. Mayor puntaje, antes va.',
  },
  matriz: {
    termino: 'Matriz valor / esfuerzo',
    texto: 'Ubica cada historia según su valor (costo de esperar) y su esfuerzo (puntos). Las de mucho valor y poco esfuerzo son ganancias rápidas: conviene hacerlas primero.',
  },
  velocidad: {
    termino: 'Velocidad',
    texto: 'Los puntos que el equipo termina en promedio por sprint. Sirve para planificar cuánto cabe en el próximo, no para comparar equipos.',
  },
  burndown: {
    termino: 'Burndown',
    texto: 'Gráfico de los puntos que faltan día a día. Si la línea real va sobre la ideal, el sprint viene atrasado y conviene conversarlo antes del final.',
  },
  wip: {
    termino: 'Límite de trabajo en curso (WIP)',
    texto: 'Cuántas tarjetas pueden estar a la vez en una columna. Limitarlo obliga a terminar antes de empezar algo nuevo, y así todo sale más rápido.',
  },
};
