// Plantillas por tipo de proyecto: un punto de partida (no una receta) para levantar el alcance rápido.
// Cada plantilla trae historias, exclusiones frecuentes, supuestos y lo que el cliente debe entregar.

export const PLANTILLAS = {
  ecommerce: {
    nombre: 'Tienda en línea',
    descripcion: 'Catálogo, carro, pago y despacho para una pyme.',
    notas: `Catálogo:
- Como clienta, quiero ver el detalle de cada producto antes de comprarlo, para decidir con toda la información
- Como clienta, quiero buscar y filtrar por categoría, para encontrar rápido lo que busco
Compra:
- Como clienta, quiero agregar productos al carro y ver el total con despacho, para saber cuánto pagaré
- Como clienta, quiero pagar con tarjeta o transferencia, para comprar sin salir de la tienda
- Como clienta, quiero recibir un correo con el detalle de mi compra, para tener un respaldo
Administración:
- Como dueña, quiero cargar y editar productos, para mantener el catálogo al día
- Como dueña, quiero ver los pedidos del día con su estado, para despacharlos a tiempo`,
    noIncluye: ['Integración con marketplaces (Mercado Libre, Falabella)', 'Facturación electrónica automática con el SII', 'Diseño de logo o identidad de marca', 'Fotografía de productos', 'Envíos internacionales'],
    supuestos: ['Se usa una pasarela de pago chilena con cuenta a nombre del cliente', 'Hasta 200 productos en la carga inicial', 'El despacho lo gestiona el cliente o su empresa de envíos'],
    cliente: ['Textos, fotos y precios de los productos', 'Cuenta habilitada en la pasarela de pago', 'Dominio y correo del negocio', 'Políticas de despacho, cambios y devoluciones'],
  },
  web: {
    nombre: 'Sitio web corporativo',
    descripcion: 'Sitio institucional con formulario de contacto.',
    notas: `Sitio:
- Como visitante, quiero entender en la portada qué hace la empresa, para saber si me sirve
- Como visitante, quiero ver los servicios con su detalle, para comparar opciones
- Como visitante, quiero enviar un formulario de contacto, para pedir una cotización
Administración:
- Como encargada de marketing, quiero editar textos e imágenes sin programar, para mantener el sitio al día
- Como encargada de marketing, quiero recibir los contactos por correo, para responder el mismo día`,
    noIncluye: ['Redacción de textos (copywriting)', 'Posicionamiento SEO pagado o campañas', 'Tienda en línea o pagos', 'Mantención mensual después de la entrega'],
    supuestos: ['Hasta 6 páginas', 'Dos rondas de cambios de diseño', 'Hosting y dominio a nombre del cliente'],
    cliente: ['Textos e imágenes finales', 'Logo y colores de la marca', 'Acceso al dominio y al hosting'],
  },
  integracion: {
    nombre: 'Integración de sistemas (API / ERP)',
    descripcion: 'Conectar dos sistemas para que compartan datos.',
    notas: `Integración:
- Investigar en 3 días la documentación y los límites de la API del ERP
- Como encargado de bodega, quiero que el stock del ERP se refleje en la tienda cada 15 minutos, para no vender lo que no hay
- Como contadora, quiero que cada venta se registre automáticamente en el ERP, para no digitarla dos veces
- Como administrador, quiero ver un registro de errores de sincronización, para corregirlos a tiempo`,
    noIncluye: ['Cambios o desarrollos dentro del ERP', 'Migración de datos históricos', 'Licencias del ERP o de la API', 'Soporte 24/7 después de la entrega'],
    supuestos: ['El ERP tiene una API documentada y estable', 'Existe un ambiente de pruebas', 'Hasta 2 tipos de documentos sincronizados'],
    cliente: ['Credenciales de prueba y de producción', 'Contacto técnico del proveedor del ERP', 'Casos reales para probar'],
  },
  dashboard: {
    nombre: 'Dashboard de datos',
    descripcion: 'Indicadores para tomar decisiones.',
    notas: `Indicadores:
- Como gerente, quiero ver las ventas del mes contra la meta, para reaccionar a tiempo
- Como gerente, quiero comparar las ventas por sucursal, para saber dónde reforzar
- Como analista, quiero filtrar por fecha y producto, para responder preguntas puntuales
Datos:
- Como analista, quiero que los datos se actualicen cada día automáticamente, para no armar planillas a mano
- Investigar en 2 días la calidad de los datos de origen y sus vacíos`,
    noIncluye: ['Limpieza masiva de datos históricos', 'Licencias de la herramienta de visualización', 'Modelos predictivos'],
    supuestos: ['Las fuentes de datos están disponibles y documentadas', 'Hasta 8 indicadores en la primera versión', 'Se usa la herramienta de visualización del cliente'],
    cliente: ['Acceso de lectura a las fuentes de datos', 'Definición de cada indicador y su meta', 'Persona de negocio para validar las cifras'],
  },
  movil: {
    nombre: 'MVP de app móvil',
    descripcion: 'Primera versión para validar una idea con usuarios reales.',
    notas: `Cuenta:
- Como persona usuaria, quiero registrarme con mi correo, para guardar mis datos
Núcleo:
- Como persona usuaria, quiero realizar la acción principal de la app en menos de 3 pasos, para resolver mi problema rápido
- Como persona usuaria, quiero recibir una notificación cuando algo cambie, para no tener que revisar a cada rato
Validación:
- Como dueño del producto, quiero medir cuántas personas completan la acción principal, para saber si la idea funciona`,
    noIncluye: ['Publicación en tiendas a nombre del desarrollador', 'Versión para tablet o web', 'Panel de administración avanzado', 'Soporte a dispositivos con más de 5 años'],
    supuestos: ['App multiplataforma (Android e iOS) con una base de código', 'Diseño basado en componentes estándar', 'Hasta 3 pantallas principales'],
    cliente: ['Cuentas de desarrollador en Google Play y App Store', 'Personas para pruebas con usuarios', 'Textos legales (términos y privacidad)'],
  },
  consultoria: {
    nombre: 'Consultoría de producto',
    descripcion: 'Ordenar el backlog y el roadmap de un equipo.',
    notas: `Diagnóstico:
- Como gerente de producto, quiero un diagnóstico del backlog actual, para saber dónde estamos
- Investigar en 1 semana con 5 clientes sus principales problemas con el producto
Ordenar:
- Como equipo de desarrollo, quiero un backlog priorizado con criterios claros, para saber qué hacer primero
- Como gerente de producto, quiero un roadmap trimestral con objetivos medibles, para alinear a la empresa
Traspaso:
- Como equipo, quiero una guía de refinamiento y priorización, para seguir solos después de la consultoría`,
    noIncluye: ['Desarrollo de software', 'Contratación o evaluación de personas', 'Herramientas o licencias'],
    supuestos: ['Disponibilidad de 2 horas semanales del equipo', 'Acceso a métricas y al backlog actual', 'Duración de 6 semanas'],
    cliente: ['Acceso al backlog y a las métricas', 'Agenda con clientes para entrevistas', 'Una persona responsable del lado del cliente'],
  },
};
