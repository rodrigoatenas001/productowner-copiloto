// Glosario de la jerga ágil: lo que muestran los botones «?» junto a cada término.
// Definiciones cortas, en lenguaje simple y con un ejemplo cuando ayuda.

export const GLOSARIO = {
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
