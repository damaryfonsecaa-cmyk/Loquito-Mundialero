VERSIÓN 2.2 OPTIMIZADA + BOTÓN VOLVER - LA POLLA DEL LOQUITO

Estructura del proyecto:

Mundial-2026/
├── index.html          -> Portada principal / Hub
├── styles.css          -> Estilos de la portada
├── grupos/             -> Polla fase de grupos, basada en la última versión subida
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── schedule.js
└── segunda-fase/       -> Polla eliminatoria independiente
    ├── index.html
    ├── styles.css
    ├── app.js
    └── schedule.js

Cómo subir a GitHub:
1. Haz respaldo del repositorio actual.
2. Sube index.html y styles.css en la raíz del repo.
3. Crea la carpeta grupos/ y sube dentro la app actual.
4. Crea la carpeta segunda-fase/ y sube dentro la app de segunda fase.
5. Abre:
   https://polla2026.github.io/Mundial-2026/

Importante:
- La fase de grupos usa las colecciones originales:
  participants, matches, predictions, settings.
- La segunda fase usa colecciones nuevas:
  ko_participants, ko_matches, ko_predictions, ko_settings.

Firestore Rules para segunda fase:

match /ko_participants/{id} {
  allow read: if true;
  allow write: if isAdmin();
}

match /ko_matches/{id} {
  allow read: if true;
  allow write: if isAdmin();
}

match /ko_predictions/{id} {
  allow read: if true;
  allow write: if isAdmin();
}

match /ko_settings/{id} {
  allow read: if true;
  allow write: if isAdmin();
}


OPTIMIZACIÓN v2.1:
- La portada principal no consulta Firebase.
- La fase de grupos queda dentro de /grupos/ y solo consume lecturas cuando alguien entra ahí.
- La segunda fase usa carga puntual de datos en vez de escuchas en tiempo real permanentes.
- En Segunda Fase hay un botón "Actualizar datos" para refrescar manualmente si es necesario.


CAMBIO v2.2:
- Se agregó botón “← Volver al inicio” en /grupos/ y /segunda-fase/.


CAMBIO v2.3:
- Se agrega hoja Estadísticas en Segunda Fase.
- Se agrega carga rápida desde texto/WhatsApp.
- Se refuerza actualización de datos tras agregar participantes, apuestas y resultados.
- Se mantiene reducción de lecturas: los datos se cargan de forma puntual.


CAMBIO v2.4:
- Corrige/fortalece botón Admin y muestra estado del correo conectado.
- Agrega alertas claras si Firestore Rules bloquea escrituras.
- Agrega botón “Sincronizar desde fase de grupos” para construir segunda fase según las llaves ya definidas en la primera página.
- Agrega editor manual de partidos de segunda fase.


CAMBIO v2.5:
- Segunda Fase incorpora pestaña Llaves visuales.
- La llave se puede editar haciendo clic en cada partido.
- Se mantiene sincronización desde Fase de Grupos para copiar los cruces ya definidos.
- La llave visual se conecta con partidos, apuestas y resultados de Segunda Fase.
