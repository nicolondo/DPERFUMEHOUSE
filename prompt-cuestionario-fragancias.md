# PROMPT: Sistema de Cuestionario de Recomendación de Fragancias para Venta Directa en Colombia

## CONTEXTO DEL PROYECTO

Soy dueño de una marca de perfumes en Colombia. Estoy desarrollando un modelo de venta directa donde los vendedores tienen un set de muestras físicas y una app desde la cual realizan la venta. Desde un centro logístico se envía el producto al cliente final — el vendedor no invierte en inventario ni maneja logística, solo vende.

Necesito que desarrolles un cuestionario web interactivo de recomendación de fragancias. El vendedor le envía el link del cuestionario al cliente por WhatsApp, el cliente responde en menos de 3 minutos desde el celular, y el sistema recomienda los 3 perfumes de mi catálogo que mejor se adaptan a esa persona.

---

## ESPECIFICACIONES FUNCIONALES

### Flujo general
1. El vendedor comparte un link único por WhatsApp: `miapp.com/q/[codigo_vendedor]`
2. El cliente abre el link en el celular y responde 8 preguntas
3. El sistema calcula un puntaje para cada perfume del catálogo
4. El cliente ve sus 3 perfumes recomendados con porcentaje de compatibilidad
5. El cliente puede pedir una muestra o contactar al vendedor
6. El vendedor recibe en su dashboard una tarjeta con el perfil del cliente, las recomendaciones, y argumentos de venta pre-armados

### Dos vistas de resultados
- **Vista cliente:** Pantalla limpia con los 3 perfumes recomendados, imagen, nombre, frase corta de posicionamiento, porcentaje de compatibilidad, y botón de acción
- **Vista vendedor (dashboard):** Resumen del perfil del cliente en una línea, top 3 con argumentos de venta pre-escritos para cada perfume, objeciones anticipadas con respuestas sugeridas, y dato de contexto para romper el hielo

---

## LAS 8 PREGUNTAS DEL CUESTIONARIO

### BLOQUE A — Contexto (3 preguntas)

**P1: ¿El perfume es para vos o para regalar?**
- Para mí
- Para regalar

Si responde "para regalar," se despliega:

**P1b: ¿Para quién es el regalo?**
- Mi pareja
- Mi mamá / papá
- Un amigo o amiga
- Un compañero de trabajo

Lógica de regalo:
- Pareja → Se permiten recomendaciones más atrevidas y sensuales
- Mamá/papá → Se sesga hacia clásicos, elegantes, seguros
- Amigo/a → Se prioriza versatilidad y crowd-pleasers
- Compañero de trabajo → Se elimina todo lo demasiado personal o intenso

**P2: ¿En qué ciudad vivís?**
Selector con las principales ciudades colombianas. El sistema clasifica internamente por piso térmico:
- Frío: Bogotá, Tunja, Manizales, Pasto, Sogamoso, Duitama, Ipiales
- Templado: Medellín, Pereira, Bucaramanga, Armenia, Popayán
- Cálido: Cali, Ibagué, Neiva, Villavicencio
- Caliente: Cartagena, Barranquilla, Santa Marta, Cúcuta, Valledupar, Montería

Si la ciudad no está en la lista, opción de "Otra" con campo de texto.

**P3: ¿Para qué momento lo buscás principalmente?**
- Para el día a día y la oficina
- Para salir de noche o eventos especiales
- Para el fin de semana, descansar
- Quiero uno todoterreno que sirva para todo

---

### BLOQUE B — Perfil olfativo (3 preguntas)

**P4: ¿Cuál de estas experiencias te gusta más?**
- El olor a tierra mojada cuando empieza a llover (→ mapea a familia amaderado/terroso/verde)
- Un chocolate caliente con pan en una tarde fría (→ mapea a familia oriental/especiado/gourmand)
- La ropa recién lavada cuando la sacás de la lavadora (→ mapea a familia fresco/limpio/almizcle blanco)
- Pasar por una floristería o un puesto de flores en la calle (→ mapea a familia floral/verde)
- La brisa fresca por la ventana en una mañana soleada (→ mapea a familia cítrico/acuático/fresco)

IMPORTANTE: Estas opciones están diseñadas para el público colombiano. Son experiencias que cualquier persona urbana colombiana ha vivido, independientemente de estrato socioeconómico, edad o ciudad. No cambiar por experiencias aspiracionales o culturalmente ajenas.

**P5: ¿Qué tan fuerte te gusta que sea tu perfume?**
- Que lo sienta yo y quien esté muy cerca (→ proyección baja)
- Que deje un rastro sutil al pasar (→ proyección media)
- Que se note cuando entro a un lugar (→ proyección alta)

**P6: ¿Hay algún tipo de olor que te moleste o no te guste?**
- Los muy dulces o empalagosos
- Los muy fuertes o que "marean"
- Los que huelen a viejo o a abuela
- Los florales
- Todos me gustan, no tengo problema

Esta es la pregunta más importante del cuestionario. Su peso negativo debe ser el más alto del sistema. Si alguien dice que odia lo dulce, un perfume gourmand se elimina sin importar lo demás.

---

### BLOQUE C — Personalidad y cierre (2 preguntas)

**P7: ¿Cómo describirías tu estilo?**
- Clásico / elegante
- Moderno / a la moda
- Atrevido / que no pasa desapercibido
- Relajado / fresco

**P8: ¿Qué querés que tu perfume diga de vos?**
- Que soy una persona seria y confiable
- Que tengo buen gusto y me cuido
- Que soy diferente y no me da miedo mostrar personalidad
- Que soy alguien cercano y agradable

IMPORTANTE: P8 NO entra en el algoritmo de scoring. Su propósito es darle al vendedor el encuadre emocional para el pitch de venta.

---

### PREGUNTA POST-RESULTADOS (después de mostrar las recomendaciones)

**¿Cuánto tenés pensado invertir?**
- Menos de $150.000
- $150.000 - $300.000
- $300.000 - $500.000
- Más de $500.000

Esta pregunta NO afecta la recomendación. Le dice al vendedor si ofrecer presentación grande, chica, o hablar de cuotas/pagos.

---

## MOTOR DE RECOMENDACIÓN (SCORING)

### Ficha de atributos por perfume
Cada perfume del catálogo debe tener estos atributos registrados:
- `familia_olfativa`: amaderado | oriental | fresco | floral | cítrico | gourmand
- `intensidad`: baja | media | alta
- `contexto_ideal`: diario | nocturno | casual | versátil
- `clima_ideal`: frío | templado | cálido | universal
- `perfil_personalidad`: clásico | moderno | atrevido | relajado
- `notas_destacadas`: texto libre para argumentos de venta
- `duracion_estimada`: texto (ej: "8-10 horas")
- `tags_negativos`: [dulce, fuerte, viejo, floral] — los tags que harían que P6 lo penalice

### Tabla de pesos

| Pregunta | Peso | Tipo |
|----------|------|------|
| P6 (descarte de olores) | -4 | Penalización. Si el cliente marca "dulces" y el perfume tiene tag "dulce", se resta -4 |
| P4 (experiencia olfativa) | +3 | Coincidencia entre experiencia elegida y familia olfativa del perfume |
| P5 (intensidad) | +2 | Coincidencia entre intensidad preferida y la del perfume |
| P3 (momento de uso) | +2 | Coincidencia entre contexto buscado y contexto ideal del perfume |
| P2 (ciudad → clima) | +2 | Coincidencia entre clima de la ciudad y clima ideal del perfume |
| P7 (estilo) | +1 | Coincidencia entre estilo del cliente y perfil de personalidad del perfume |
| P1b (tipo de regalo) | Modificador | Ajusta el pool de candidatos según la relación |
| P8 (aspiración) | +0 | No entra en scoring. Solo para argumentos de venta |

### Cálculo
- Para cada perfume, sumar los puntos de coincidencia y restar las penalizaciones
- Ordenar de mayor a menor
- Mostrar los top 3
- El porcentaje de compatibilidad se calcula como: (puntaje del perfume / puntaje máximo posible) × 100, redondeado

---

## PRESENTACIÓN DE RESULTADOS — VISTA CLIENTE

Pantalla con diseño limpio, premium, sin publicidad. Debe sentirse como una marca de lujo, no como un catálogo de Yanbal.

```
[Logo de la marca]

Tu perfume ideal es:
[NOMBRE DEL PERFUME]
[Imagen del frasco]
"Envolvente, cálido, para quien quiere dejar huella"
Compatibilidad: 96%

También te pueden gustar:
[Perfume 2] — 89%
[Perfume 3] — 82%

[BOTÓN: Pedí tu muestra gratis]
[BOTÓN: Hablá con tu asesor por WhatsApp]
```

El botón de WhatsApp debe abrir un chat directo con el vendedor que compartió el cuestionario (usando su número de WhatsApp registrado en el sistema), con un mensaje pre-armado tipo: "Hola, acabo de hacer el test de fragancias y me interesa probar [nombre del perfume]. ¿Me podés ayudar?"

---

## PRESENTACIÓN DE RESULTADOS — VISTA VENDEDOR (DASHBOARD)

Para cada cliente que complete el cuestionario, generar una tarjeta con:

### 1. Resumen de perfil (una línea)
Generar automáticamente una frase tipo:
"Mujer en Medellín, busca perfume para salir de noche, le gustan los aromas cálidos y envolventes, odia lo floral, estilo atrevido, quiere mostrar personalidad."

### 2. Top 3 recomendaciones con argumentos de venta

Para cada perfume recomendado:

**[Nombre del perfume] — [porcentaje]% de compatibilidad**

**Argumento principal de venta:**
"Este perfume es perfecto para vos porque buscás algo que [dato de P3] y que [dato de P5]. Tiene esa [referencia a P4] que te gusta, pero con [diferenciador del perfume]."

**Si el cliente duda:**
[Sugerencia de manejo de objeción basada en el perfume]

**Si pregunta por precio:**
[Presentaciones disponibles y rangos de precio]

**Si pregunta por duración:**
[Dato de duración del perfume]

### 3. Dato para romper el hielo
Basado en la respuesta de P4:
"Tu cliente eligió la experiencia de '[texto de la opción elegida].' Podés arrancar diciéndole que este perfume tiene exactamente esa sensación, pero en una versión sofisticada/elegante/moderna."

### 4. Presupuesto del cliente
"Presupuesto indicado: $150.000 - $300.000 → Recomendá la presentación de [X]ml."

---

## REQUISITOS TÉCNICOS

### Optimización para Colombia
- El cuestionario se comparte por WhatsApp — es el canal principal de ventas en Colombia
- Debe cargar en menos de 3 segundos en red 4G colombiana
- Diseño 100% mobile-first
- URL corta y limpia con código del vendedor: miapp.com/q/[codigo]
- Open Graph bien configurado para que la preview del link en WhatsApp se vea atractiva (imagen, título, descripción)
- Los resultados deben poder compartirse como link o screenshot
- Cero registro requerido para ver resultados — los datos de contacto se piden DESPUÉS de mostrar la recomendación

### Stack sugerido
- Frontend: Next.js o React con Tailwind CSS
- Backend: API server-side para el scoring (la lógica nunca se expone al cliente)
- Base de datos: Para almacenar respuestas, vincularlas al vendedor, y alimentar el dashboard
- URL única por vendedor para tracking de leads

### Tono y diseño
- El cuestionario debe sentirse premium. Diseño limpio, minimalista, tipografía elegante
- Tono cercano, tuteo (o voseo según la región), pero no infantil
- No debe parecer un formulario — debe sentirse como una experiencia personalizada
- Transiciones suaves entre preguntas (una pregunta a la vez, no un form largo)
- Barra de progreso visible para que el cliente sepa cuánto falta

---

## CATÁLOGO DE PERFUMES

[INSERTAR AQUÍ EL CATÁLOGO CON LOS ATRIBUTOS DE CADA PERFUME]

Para cada perfume necesito que registres:
- Nombre
- Género (masculino / femenino / unisex)
- Familia olfativa principal
- Intensidad / proyección
- Contexto ideal
- Clima ideal
- Perfil de personalidad
- Notas destacadas (para argumentos de venta)
- Duración estimada
- Tags negativos (para P6)
- Precio por presentación
- Frase de posicionamiento (una línea)

---

## FUNCIONALIDADES ADICIONALES A IMPLEMENTAR

### A) Captación de leads
El cuestionario funciona como herramienta de prospección. El vendedor publica el link en estados de WhatsApp, Instagram Stories, grupos de Facebook. Cada persona que completa el cuestionario es un lead con nombre, ciudad, preferencias y presupuesto, asignado automáticamente al vendedor que compartió el link.

### B) Recompra inteligente
Si un cliente compró un perfume hace X meses y su perfil coincide con un producto nuevo o complementario, el sistema notifica al vendedor: "Tu cliente [nombre] que compró [perfume A] probablemente le va a gustar [perfume B]. Escribile."

### C) Sets de muestras optimizados por zona
Usar la data agregada de cuestionarios por ciudad para optimizar qué muestras lleva cada vendedor. Si en Barranquilla el 70% prefiere frescas, el set barranquillero debe pesar hacia allá.

### D) Ranking de vendedores
Medir tasa de conversión: cuestionarios enviados vs. ventas cerradas. Identificar a los mejores vendedores para premiarlos y que capaciten a los demás.

### E) Modo temporada de regalos
Mensajes pre-armados para fechas clave colombianas: Día de la Madre (mayo), Amor y Amistad (septiembre), Navidad/amigo secreto (diciembre). El vendedor puede enviar el cuestionario con un mensaje contextualizado: "¿Ya sabés qué regalarle a tu mamá este Día de la Madre?"

### F) Modo comparador
Cuando el cliente está entre dos perfumes después de probar muestras, el vendedor abre una vista comparativa lado a lado: duración, proyección, momento ideal, argumento de cada uno.

---

## INSTRUCCIONES FINALES

1. Desarrollá primero el cuestionario frontend completo con las 8 preguntas, transiciones animadas, y barra de progreso
2. Implementá el motor de scoring server-side con la tabla de pesos especificada
3. Generá ambas vistas de resultados (cliente y vendedor)
4. Dejá el catálogo de perfumes como un JSON/base de datos editable para que yo pueda cargar los productos con sus atributos
5. Asegurate de que el link de WhatsApp del botón de contacto use la API de WhatsApp (wa.me/[numero]?text=[mensaje]) con el número del vendedor y un mensaje pre-armado
6. Todo el diseño debe ser mobile-first, premium, y cargar rápido
