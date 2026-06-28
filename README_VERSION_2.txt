VERSIÓN 2.1 OPTIMIZADA - LA POLLA DEL LOQUITO

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
